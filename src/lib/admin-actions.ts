import "server-only";

import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { bonusForRank, contestScore, finalChampionshipScore, rawScoreForSolveVector, societyRatingDelta } from "@/lib/scoring";
import { deleteFromCloudinary } from "@/server/uploads/cloudinary";

const visibilitySchema = z.enum(["PUBLIC", "PRIVATE", "ARCHIVED"]);
type DbClient = Prisma.TransactionClient | typeof prisma;
const httpUrlSchema = z.string().url().refine((value) => /^https?:\/\//i.test(value), "Only HTTP(S) URLs are allowed.");

const coordinatorSchema = z.object({
  name: z.string().min(1).max(120),
  role: z.string().min(1).max(80),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  phone: z.string().min(4).max(32),
  discord: z.string().max(80).optional().or(z.literal("")).nullable(),
});

const problemSchema = z.object({
  code: z.string().min(1).max(16),
  title: z.string().max(120).optional().or(z.literal("")).nullable(),
  points: z.coerce.number().int().positive().max(1_000_000),
  firstSolveStatus: z.enum(["ASSIGNED", "UNSOLVED", "NONE"]).optional(),
  firstSolveUsername: z.string().min(1).max(48).optional().or(z.literal("")).nullable(),
  firstSolveUsernames: z.array(z.string().min(1).max(48)).optional(),
});

type ParsedProblem = {
  code: string;
  title?: string | null;
  points: number;
  firstSolveStatus: "ASSIGNED" | "UNSOLVED" | "NONE";
  firstSolveUsername: string | null;
};

const playerInputSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  username: z.string().trim().min(1).max(48).regex(/^[a-zA-Z0-9_.+-]+$/),
  year: z.coerce.number().int().min(1).max(8),
  email: z.string().trim().email().optional().or(z.literal("")).nullable(),
  branchCourse: z.string().trim().max(120).optional().or(z.literal("")).nullable(),
  avatar: httpUrlSchema.optional().or(z.literal("")).nullable(),
  bio: z.string().trim().max(1000).optional().or(z.literal("")).nullable(),
});

export const contestInputSchema = z.object({
  title: z.string().min(2).max(140),
  slug: z.string().optional(),
  description: z.string().max(5000).default(""),
  invitePoster: httpUrlSchema.optional().or(z.literal("")).nullable(),
  bannerPoster: httpUrlSchema.optional().or(z.literal("")).nullable(),
  contestBanner: httpUrlSchema.optional().or(z.literal("")).nullable(),
  platform: z.string().min(2).max(80).default("Codeforces"),
  contestLink: httpUrlSchema.optional().or(z.literal("")).nullable(),
  startTime: z.coerce.date(),
  duration: z.coerce.number().int().positive().max(1440).default(120),
  visibility: visibilitySchema.default("PUBLIC"),
  scoringSystem: z.string().min(2).max(80).default("TDCS_TOP5_V1"),
  prizePool: z.string().max(120).optional().or(z.literal("")).nullable(),
  coordinators: z.array(coordinatorSchema).optional(),
  problems: z.array(problemSchema).optional(),
});

export const entryInputSchema = z.object({
  username: z.string().trim().min(1).max(48).regex(/^[a-zA-Z0-9_.+-]+$/),
  fullName: z.string().trim().min(1).max(120),
  penalty: z.coerce.number().int().min(0),
  solveVector: z.preprocess(parseSolveVector, z.array(z.number().int().min(0).max(1))),
  notes: z.string().max(1000).optional().nullable(),
});

export type EntryInput = z.infer<typeof entryInputSchema>;

function optionalString(value?: string | null) {
  return value ? value : null;
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const defaultProblems = Array.from({ length: 5 }, (_, index) => ({
  code: String.fromCharCode("A".charCodeAt(0) + index),
  title: "",
  points: (index + 1) * 100,
  firstSolveStatus: "NONE" as const,
  firstSolveUsername: null,
}));

function rankEntries(entries: EntryInput[], problems: { code: string; points: number }[]) {
  const seen = new Set<string>();
  const normalized = entries.map((entry) => {
    const parsed = entryInputSchema.parse(entry);
    const key = parsed.username.toLowerCase();
    if (seen.has(key)) throw new Error("Username already exists in this contest.");
    if (parsed.solveVector.length !== problems.length) {
      throw new Error(`Solve vector for "${parsed.username}" must contain exactly ${problems.length} values.`);
    }
    seen.add(key);
    const solved = parsed.solveVector.reduce((sum, value) => sum + value, 0);
    const solvedProblems = problems.filter((_, index) => parsed.solveVector[index] === 1).map((problem) => problem.code);
    const rawScore = rawScoreForSolveVector(problems.map((problem) => problem.points), parsed.solveVector);
    return {
      ...parsed,
      username: key,
      solved,
      solvedProblems,
      rawScore,
      contestScore: contestScore(rawScore, parsed.penalty),
    };
  });

  let previous: (typeof normalized)[number] | undefined;
  let previousRank = 0;
  return normalized
    .sort((a, b) => (
      b.solved - a.solved
      || a.penalty - b.penalty
      || a.username.localeCompare(b.username)
    ))
    .map((entry, index) => {
      const rank = previous
        && previous.solved === entry.solved
        && previous.penalty === entry.penalty
        ? previousRank
        : index + 1;
      const bonusPoints = bonusForRank(rank);
      const rankedEntry = { ...entry, rank, bonusPoints, finalScore: finalChampionshipScore(entry.contestScore, bonusPoints) };
      previous = entry;
      previousRank = rank;
      return rankedEntry;
    })
}

function parseSolveVector(value: unknown) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`Invalid solve vector "${value}". Use a JSON array such as [1,1,0,1].`);
  }
}

function parseProblems(rawProblems: unknown[]) {
  const problems: ParsedProblem[] = rawProblems.map((problem) => {
    const parsed = problemSchema.parse(problem);
    const username = (parsed.firstSolveUsername || parsed.firstSolveUsernames?.[0] || "").trim().toLowerCase();
    const status = parsed.firstSolveStatus ?? (username ? "ASSIGNED" : "NONE");
    if (status === "ASSIGNED" && !username) throw new Error(`First solve assignment for problem "${parsed.code}" requires a username.`);
    return {
      code: parsed.code,
      title: parsed.title,
      points: parsed.points,
      firstSolveStatus: status,
      firstSolveUsername: status === "ASSIGNED" ? username : null,
    };
  });
  if (!problems.length) throw new Error("Add at least one contest problem.");
  const seenProblemCodes = new Set<string>();
  for (const problem of problems) {
    const code = problem.code.trim().toUpperCase();
    if (seenProblemCodes.has(code)) throw new Error(`Duplicate problem code: ${code}`);
    seenProblemCodes.add(code);
  }
  return problems;
}

export async function createOrUpdateContest(input: unknown, id?: string, adminId?: string) {
  const data = contestInputSchema.parse(input);
  const { coordinators, problems: rawProblems, ...contestFields } = data;
  const problems = rawProblems ? parseProblems(rawProblems) : id ? undefined : defaultProblems;
  let slug = data.slug ? slugify(data.slug) : id ? undefined : slugify(data.title);
  if (!id && !slug) throw new Error("Contest title must produce a valid slug.");
  if (data.slug && !slug) throw new Error("Contest slug must contain at least one letter or number.");
  if (!id && slug && !data.slug) slug = await uniqueContestSlug(slug);
  const payload: Prisma.ContestUncheckedUpdateInput = {
    ...contestFields,
    ...(slug ? { slug } : {}),
    invitePoster: optionalString(data.invitePoster),
    bannerPoster: optionalString(data.bannerPoster),
    contestBanner: optionalString(data.contestBanner),
    contestLink: optionalString(data.contestLink),
    prizePool: optionalString(data.prizePool),
    ...(!id ? { createdById: adminId } : {}),
    ...(problems ? { totalPoints: problems.reduce((sum, problem) => sum + problem.points, 0) } : {}),
  };

  const contest = await prisma.$transaction(async (tx) => {
    const saved = id
      ? await tx.contest.update({ where: { id }, data: payload })
      : await tx.contest.create({ data: payload as Prisma.ContestUncheckedCreateInput });
    const uploadUrls = [saved.invitePoster, saved.bannerPoster].filter((url): url is string => Boolean(url));
    if (uploadUrls.length) {
      await tx.uploadAsset.updateMany({
        where: { url: { in: uploadUrls }, contestId: null },
        data: { contestId: saved.id },
      });
    }
    if (coordinators) {
      await tx.contestCoordinator.deleteMany({ where: { contestId: saved.id } });
      await tx.contestCoordinator.createMany({
        data: coordinators.map((coordinator) => ({
          contestId: saved.id,
          name: coordinator.name,
          role: coordinator.role,
          email: optionalString(coordinator.email),
          phone: coordinator.phone,
          discord: optionalString(coordinator.discord),
        })),
      });
    }
    if (problems) {
      await saveContestProblems(saved.id, problems, tx);
      if (id) await refreshAllDerived(tx);
    }
    return saved;
  });

  await logActivity(adminId, id ? "contest.update" : "contest.create", "Contest", contest.id, { title: contest.title });
  return contest;
}

export async function deleteContest(id: string, adminId?: string) {
  const assets = await prisma.uploadAsset.findMany({ where: { contestId: id }, select: { publicId: true } });
  const contest = await prisma.contest.delete({ where: { id } });
  await refreshAllDerived();
  await logActivity(adminId, "contest.delete", "Contest", id, { title: contest.title });
  await Promise.all(assets.map((asset) => deleteFromCloudinary(asset.publicId).catch(() => undefined)));
  return contest;
}

async function uniqueContestSlug(baseSlug: string) {
  const existing = await prisma.contest.findMany({
    where: { slug: { startsWith: baseSlug } },
    select: { slug: true },
  });
  const taken = new Set(existing.map((contest) => contest.slug));
  if (!taken.has(baseSlug)) return baseSlug;
  for (let suffix = 2; suffix < 10_000; suffix += 1) {
    const candidate = `${baseSlug}-${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error("Unable to generate a unique contest slug.");
}

export async function upsertContestEntries(contestId: string, rawEntries: unknown[], adminId?: string, { allowExisting = false } = {}) {
  const entries = rawEntries.map((entry) => entryInputSchema.parse(entry));
  const saved = await prisma.$transaction(async (tx) => {
    const existing = await tx.contestStanding.findMany({ where: { contestId }, include: { player: true } });
    const merged = new Map<string, EntryInput>(existing.map((row) => [row.player.username.toLowerCase(), { username: row.player.username, fullName: row.player.fullName, solveVector: row.solveVector, penalty: row.penalty, notes: row.notes }]));
    const incoming = new Set<string>();
    for (const entry of entries) {
      const key = entry.username.toLowerCase();
      if (incoming.has(key) || (!allowExisting && merged.has(key))) {
        throw new Error("Username already exists in this contest.");
      }
      incoming.add(key);
      merged.set(key, entry);
    }
    const rows = await replaceContestStandings(contestId, [...merged.values()], tx);
    await refreshAllDerived(tx);
    return rows;
  }, { maxWait: 10_000, timeout: 120_000 });

  await logActivity(adminId, entries.length === 1 ? "participant.added" : "standings.draft.upsert", "ContestStanding", contestId, { rows: saved.length });
  return saved;
}

export async function updateContestEntry(contestId: string, standingId: string, input: unknown, adminId?: string) {
  const entry = entryInputSchema.parse(input);
  await prisma.$transaction(async (tx) => {
    const standing = await tx.contestStanding.findUniqueOrThrow({ where: { id: standingId }, include: { player: true } });
    if (standing.contestId !== contestId) throw new Error("Standing row not found.");
    const rows = await tx.contestStanding.findMany({ where: { contestId }, include: { player: true } });
    const next = rows.map((row) => row.id === standingId ? entry : { username: row.player.username, fullName: row.player.fullName, solveVector: row.solveVector, penalty: row.penalty, notes: row.notes });
    await replaceContestStandings(contestId, next, tx);
    await refreshAllDerived(tx);
  }, { maxWait: 10_000, timeout: 120_000 });
  await logActivity(adminId, "participant.edited", "ContestStanding", standingId, { contestId });
}

export async function deleteContestEntry(contestId: string, standingId: string, adminId?: string) {
  await prisma.$transaction(async (tx) => {
    const standing = await tx.contestStanding.findUniqueOrThrow({ where: { id: standingId } });
    if (standing.contestId !== contestId) throw new Error("Standing row not found.");
    await tx.firstSolve.deleteMany({ where: { playerUsername: standing.playerUsername, problem: { contestId } } });
    await tx.contestStanding.delete({ where: { id: standingId } });
    await tx.contestParticipation.deleteMany({ where: { contestId, playerUsername: standing.playerUsername } });
    const rows = await tx.contestStanding.findMany({ where: { contestId }, include: { player: true } });
    await replaceContestStandings(contestId, rows.map((row) => ({ username: row.player.username, fullName: row.player.fullName, solveVector: row.solveVector, penalty: row.penalty, notes: row.notes })), tx);
    await refreshAllDerived(tx);
  }, { maxWait: 10_000, timeout: 120_000 });
  await logActivity(adminId, "participant.deleted", "ContestStanding", standingId, { contestId });
}

export async function saveContestProblemDraft(contestId: string, rawProblems: unknown[] = [], adminId?: string) {
  const problems = parseProblems(rawProblems);
  await prisma.$transaction(async (tx) => {
    const previousProblems = await tx.contestProblem.findMany({
      where: { contestId },
      include: { firstSolves: true },
      orderBy: { sortOrder: "asc" },
    });
    const previousByCode = new Map(previousProblems.map((problem) => [problem.code, problem]));
    await saveContestProblems(contestId, problems, tx);
    const nextCodes = new Set(problems.map((problem) => problem.code.trim().toUpperCase()));
    const added = problems.filter((problem) => !previousByCode.has(problem.code.trim().toUpperCase())).length;
    const edited = problems.filter((problem, index) => {
      const code = problem.code.trim().toUpperCase();
      const previous = previousByCode.get(code);
      return previous && (previous.title !== optionalString(problem.title) || previous.points !== problem.points || previous.sortOrder !== index);
    }).length;
    const deleted = previousProblems.filter((problem) => !nextCodes.has(problem.code)).length;
    if (added) {
      await tx.activityLog.create({
        data: {
          admin: adminId ? { connect: { id: adminId } } : undefined,
          action: "problem.added",
          entity: "ContestProblem",
          entityId: contestId,
          metadata: { added },
        },
      });
    }
    if (edited) {
      await tx.activityLog.create({
        data: {
          admin: adminId ? { connect: { id: adminId } } : undefined,
          action: "problem.edited",
          entity: "ContestProblem",
          entityId: contestId,
          metadata: { edited },
        },
      });
    }
    if (deleted) {
      await tx.activityLog.create({
        data: {
          admin: adminId ? { connect: { id: adminId } } : undefined,
          action: "problem.deleted",
          entity: "ContestProblem",
          entityId: contestId,
          metadata: { deleted },
        },
      });
    }
    await tx.activityLog.create({
      data: {
        admin: adminId ? { connect: { id: adminId } } : undefined,
        action: "first-solves.updated",
        entity: "ContestProblem",
        entityId: contestId,
        metadata: { problems: problems.length },
      },
    });
    await refreshAllDerived(tx);
  }, { maxWait: 10_000, timeout: 120_000 });
}

export async function finalizeContestStandings(contestId: string, rawProblems: unknown[] = [], adminId?: string) {
  const problems = parseProblems(rawProblems);
  const result = await prisma.$transaction(async (tx) => {
    const contest = await tx.contest.findUniqueOrThrow({ where: { id: contestId }, select: { standingsFinalizedAt: true } });
    if (contest.standingsFinalizedAt) {
      await refreshAllDerived(tx);
      return { finalized: false, rows: await tx.contestStanding.count({ where: { contestId } }) };
    }
    const standings = await tx.contestStanding.findMany({ where: { contestId } });
    if (!standings.length) throw new Error("Add at least one participant before finalizing standings.");
    await saveContestProblems(contestId, problems, tx);
    await tx.contest.update({ where: { id: contestId }, data: { standingsFinalizedAt: new Date() } });
    await refreshAllDerived(tx);
    await tx.activityLog.create({
      data: {
        admin: adminId ? { connect: { id: adminId } } : undefined,
        action: "standings.finalize",
        entity: "Contest",
        entityId: contestId,
        metadata: { rows: standings.length },
      },
    });
    return { finalized: true, rows: standings.length };
  }, { maxWait: 10_000, timeout: 120_000 });

  if (!result.finalized) await logActivity(adminId, "standings.finalize.idempotent", "Contest", contestId, { rows: result.rows });
  return result;
}

export async function recalculateContest(contestId: string, adminId?: string) {
  await prisma.$transaction(async (tx) => {
    await tx.contest.findUniqueOrThrow({ where: { id: contestId }, select: { id: true } });
    const rows = await tx.contestStanding.findMany({ where: { contestId }, include: { player: true } });
    await replaceContestStandings(contestId, rows.map((row) => ({ username: row.player.username, fullName: row.player.fullName, solveVector: row.solveVector, penalty: row.penalty, notes: row.notes })), tx);
    await refreshAllDerived(tx);
  }, { maxWait: 10_000, timeout: 120_000 });
  await logActivity(adminId, "standings.recalculate", "Contest", contestId);
}

async function replaceContestStandings(contestId: string, entries: EntryInput[], db: DbClient) {
  const problems = await db.contestProblem.findMany({ where: { contestId }, orderBy: [{ sortOrder: "asc" }, { code: "asc" }] });
  if (!problems.length) throw new Error("Add contest problems before entering standings.");
  const ranked = rankEntries(entries, problems);
  const savedUsernames: string[] = [];

  for (const entry of ranked) {
    const existingPlayer = await db.player.findFirst({
      where: { username: { equals: entry.username, mode: "insensitive" } },
    });
    const player = existingPlayer
      ? await db.player.update({ where: { id: existingPlayer.id }, data: { fullName: entry.fullName, username: existingPlayer.username } })
      : await db.player.create({ data: { username: entry.username, fullName: entry.fullName } });

    savedUsernames.push(player.username);
    await db.contestParticipation.upsert({
      where: { contestId_playerUsername: { contestId, playerUsername: player.username } },
      update: {
        finalRank: entry.rank,
        finalScore: entry.finalScore,
        solved: entry.solved,
        solveVector: entry.solveVector,
        solvedProblems: entry.solvedProblems,
        rawScore: entry.rawScore,
        contestScore: entry.contestScore,
        penalty: entry.penalty,
      },
      create: {
        contest: { connect: { id: contestId } },
        player: { connect: { username: player.username } },
        finalRank: entry.rank,
        finalScore: entry.finalScore,
        solved: entry.solved,
        solveVector: entry.solveVector,
        solvedProblems: entry.solvedProblems,
        rawScore: entry.rawScore,
        contestScore: entry.contestScore,
        penalty: entry.penalty,
      },
    });

    await db.contestStanding.upsert({
      where: { contestId_playerUsername: { contestId, playerUsername: player.username } },
      update: {
        rank: entry.rank,
        solved: entry.solved,
        solveVector: entry.solveVector,
        solvedProblems: entry.solvedProblems,
        penalty: entry.penalty,
        rawScore: entry.rawScore,
        contestScore: entry.contestScore,
        bonusPoints: entry.bonusPoints,
        finalScore: entry.finalScore,
        notes: entry.notes || undefined,
      },
      create: {
        contest: { connect: { id: contestId } },
        player: { connect: { username: player.username } },
        rank: entry.rank,
        solved: entry.solved,
        solveVector: entry.solveVector,
        solvedProblems: entry.solvedProblems,
        penalty: entry.penalty,
        rawScore: entry.rawScore,
        contestScore: entry.contestScore,
        bonusPoints: entry.bonusPoints,
        finalScore: entry.finalScore,
        firstSolves: 0,
        notes: entry.notes || undefined,
      },
    });
  }
  const removedStandings = await db.contestStanding.findMany({
    where: { contestId, playerUsername: savedUsernames.length ? { notIn: savedUsernames } : undefined },
    select: { playerUsername: true },
  });
  const removedUsernames = removedStandings.map((standing) => standing.playerUsername);
  if (removedUsernames.length) {
    await db.firstSolve.deleteMany({ where: { playerUsername: { in: removedUsernames }, problem: { contestId } } });
  }
  await db.contestParticipation.deleteMany({ where: { contestId, playerUsername: savedUsernames.length ? { notIn: savedUsernames } : undefined } });
  await db.contestStanding.deleteMany({ where: { contestId, playerUsername: savedUsernames.length ? { notIn: savedUsernames } : undefined } });
  await syncFirstSolveCounts(contestId, db);
  return db.contestStanding.findMany({ where: { contestId }, orderBy: { rank: "asc" } });
}

export async function updatePlayerProfile(username: string, input: unknown, adminId?: string) {
  const data = playerInputSchema.parse(input);
  const current = await prisma.player.findUniqueOrThrow({ where: { username } });
  const nextUsername = data.username.toLowerCase();
  const usernameOwner = await prisma.player.findFirst({
    where: { username: { equals: nextUsername, mode: "insensitive" }, NOT: { id: current.id } },
    select: { id: true },
  });
  if (usernameOwner) throw new Error("Username already belongs to another player.");
  if (data.email) {
    const emailOwner = await prisma.player.findFirst({
      where: { email: { equals: data.email, mode: "insensitive" }, NOT: { id: current.id } },
      select: { id: true },
    });
    if (emailOwner) throw new Error("Email already belongs to another player.");
  }

  const player = await prisma.$transaction(async (tx) => {
    const saved = await tx.player.update({
      where: { id: current.id },
      data: {
        fullName: data.fullName,
        username: nextUsername,
        year: data.year,
        email: optionalString(data.email),
        branchCourse: optionalString(data.branchCourse),
        avatar: optionalString(data.avatar),
        bio: optionalString(data.bio),
      },
      select: { id: true, fullName: true, username: true, year: true, email: true, branchCourse: true, avatar: true, bio: true },
    });
    await refreshAllDerived(tx);
    return saved;
  }, { maxWait: 10_000, timeout: 60_000 });

  await logActivity(adminId, "player.update", "Player", player.username, { previousUsername: current.username });
  return player;
}

async function saveContestProblems(contestId: string, problems: ParsedProblem[], db: DbClient) {
  await db.contestProblem.deleteMany({ where: { contestId } });
  const standingPlayers = await db.contestStanding.findMany({ where: { contestId }, include: { player: true } });
  const playersByUsername = new Map(standingPlayers.map((standing) => [standing.player.username.toLowerCase(), standing.player]));

  for (const [index, problem] of problems.entries()) {
    const contestProblem = await db.contestProblem.create({
      data: {
        contest: { connect: { id: contestId } },
        code: problem.code.trim().toUpperCase(),
        title: optionalString(problem.title),
        points: problem.points,
        sortOrder: index,
      },
    });

    if (problem.firstSolveStatus === "UNSOLVED") {
      await db.firstSolve.create({
        data: {
          problem: { connect: { id: contestProblem.id } },
          status: "UNSOLVED",
        },
      });
    }
    if (problem.firstSolveStatus === "ASSIGNED" && problem.firstSolveUsername) {
      const player = playersByUsername.get(problem.firstSolveUsername);
      if (!player) throw new Error(`First solve user "${problem.firstSolveUsername}" is not in this contest's standings.`);
      await db.firstSolve.create({
        data: {
          player: { connect: { username: player.username } },
          problem: { connect: { id: contestProblem.id } },
          status: "ASSIGNED",
        },
      });
    }
  }
  await db.contest.update({
    where: { id: contestId },
    data: { totalPoints: problems.reduce((sum, problem) => sum + problem.points, 0) },
  });
  await syncFirstSolveCounts(contestId, db);
  if (standingPlayers.length) {
    await replaceContestStandings(contestId, standingPlayers.map((standing) => ({
      username: standing.player.username,
      fullName: standing.player.fullName,
      solveVector: standing.solveVector,
      penalty: standing.penalty,
      notes: standing.notes,
    })), db);
  }
}

async function syncFirstSolveCounts(contestId: string, db: DbClient) {
  await db.contestStanding.updateMany({ where: { contestId }, data: { firstSolves: 0 } });
  const firstSolves = await db.firstSolve.findMany({ where: { status: "ASSIGNED", playerUsername: { not: null }, problem: { contestId } }, select: { playerUsername: true } });
  const counts = new Map<string, number>();
  for (const firstSolve of firstSolves) {
    if (firstSolve.playerUsername) counts.set(firstSolve.playerUsername, (counts.get(firstSolve.playerUsername) ?? 0) + 1);
  }
  for (const [playerUsername, firstSolves] of counts) {
    await db.contestStanding.updateMany({ where: { contestId, playerUsername }, data: { firstSolves } });
  }
}

async function refreshAllDerived(db: DbClient = prisma) {
  await recomputeRatings(db);
  await recalculateAllStats(db);
  const contests = await db.contest.findMany({ where: { standingsFinalizedAt: { not: null } }, select: { id: true, startTime: true } });
  const months = new Set(contests.map((contest) => `${contest.startTime.getUTCFullYear()}-${contest.startTime.getUTCMonth() + 1}`));
  const years = new Set(contests.map((contest) => contest.startTime.getUTCFullYear()));
  for (const key of months) {
    const [year, month] = key.split("-").map(Number);
    await rebuildMonthlyLeaderboard(year, month, db);
  }
  for (const year of years) await rebuildYearlyLeaderboard(year, db);
  await db.hallOfFame.deleteMany({ where: { contestId: { not: null } } });
  for (const contest of contests) await rebuildHallOfFame(contest.id, db);
  await rebuildAchievements(db);
}

async function recomputeRatings(db: DbClient = prisma) {
  const players = await db.player.findMany({ select: { username: true } });
  const ratings = new Map(players.map((player) => [player.username, 1200]));
  const peaks = new Map(players.map((player) => [player.username, 1200]));
  const contests = await db.contest.findMany({
    where: { visibility: { not: "PRIVATE" }, standingsFinalizedAt: { not: null } },
    include: { standings: { orderBy: { rank: "asc" } } },
    orderBy: { startTime: "asc" },
  });

  await db.ratingHistory.deleteMany();
  for (const contest of contests) {
    const participantCount = Math.max(contest.standings.length, 1);
    for (const standing of contest.standings) {
      const current = ratings.get(standing.playerUsername) ?? 1200;
      const delta = societyRatingDelta({ rank: standing.rank, solved: standing.solved, participantCount, finalScore: standing.finalScore, firstSolves: standing.firstSolves });
      const next = Math.max(100, current + delta);
      ratings.set(standing.playerUsername, next);
      peaks.set(standing.playerUsername, Math.max(peaks.get(standing.playerUsername) ?? 1200, next));
      await db.ratingHistory.create({
        data: {
          player: { connect: { username: standing.playerUsername } },
          contest: { connect: { id: contest.id } },
          rating: next,
          delta,
          reason: "TDCS standings finalization",
        },
      });
      await db.contestParticipation.updateMany({ where: { contestId: contest.id, playerUsername: standing.playerUsername }, data: { ratingDelta: delta } });
    }
  }

  for (const player of players) {
    await db.player.update({ where: { username: player.username }, data: { currentRating: ratings.get(player.username) ?? 1200, peakRating: peaks.get(player.username) ?? 1200 } });
  }
}

async function recalculateAllStats(db: DbClient = prisma) {
  const players = await db.player.findMany({ include: { standings: { include: { contest: true } } } });
  for (const player of players) {
    const standings = player.standings.filter((standing) => standing.contest.standingsFinalizedAt && standing.contest.visibility !== "PRIVATE");
    const contestsPlayed = standings.length;
    const totalScore = standings.reduce((sum, item) => sum + item.finalScore, 0);
    const totalSolved = standings.reduce((sum, item) => sum + item.solved, 0);
    const wins = standings.filter((item) => item.rank === 1).length;
    const podiums = standings.filter((item) => item.rank <= 3).length;
    const firstSolves = standings.reduce((sum, item) => sum + item.firstSolves, 0);
    const averageRank = contestsPlayed ? standings.reduce((sum, item) => sum + item.rank, 0) / contestsPlayed : null;
    const bestRank = contestsPlayed ? Math.min(...standings.map((item) => item.rank)) : null;
    await db.player.update({ where: { id: player.id }, data: { contestsPlayed, totalScore, totalSolved, wins, podiums, firstSolves, averageRank, bestRank } });
  }
}

async function rebuildMonthlyLeaderboard(year: number, month: number, db: DbClient = prisma) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  const rows = await aggregatePeriod({ startTime: { gte: start, lt: end }, visibility: { not: "PRIVATE" }, standingsFinalizedAt: { not: null } }, db);
  const now = new Date();
  const isCurrentMonth = year === now.getUTCFullYear() && month === now.getUTCMonth() + 1;
  await db.monthlyLeaderboard.deleteMany({ where: { year, month } });
  if (isCurrentMonth) await db.player.updateMany({ data: { monthlyRank: null } });
  for (const row of rows) {
    await db.monthlyLeaderboard.create({
      data: {
        player: { connect: { username: row.playerUsername } },
        year,
        month,
        rank: row.rank,
        totalScore: row.totalScore,
        contests: row.contests,
        wins: row.wins,
        solved: row.solved,
        firstSolves: row.firstSolves,
        averageRank: row.averageRank,
      },
    });
    if (isCurrentMonth) await db.player.update({ where: { username: row.playerUsername }, data: { monthlyRank: row.rank } });
  }
}

async function rebuildYearlyLeaderboard(year: number, db: DbClient = prisma) {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));
  const rows = await aggregatePeriod({ startTime: { gte: start, lt: end }, visibility: { not: "PRIVATE" }, standingsFinalizedAt: { not: null } }, db);
  const isCurrentYear = year === new Date().getUTCFullYear();
  await db.yearlyLeaderboard.deleteMany({ where: { year } });
  if (isCurrentYear) await db.player.updateMany({ data: { yearlyRank: null } });
  for (const row of rows) {
    await db.yearlyLeaderboard.create({
      data: {
        player: { connect: { username: row.playerUsername } },
        year,
        rank: row.rank,
        totalScore: row.totalScore,
        contests: row.contests,
        wins: row.wins,
        solved: row.solved,
        firstSolves: row.firstSolves,
        averageRank: row.averageRank,
      },
    });
    if (isCurrentYear) await db.player.update({ where: { username: row.playerUsername }, data: { yearlyRank: row.rank } });
  }
}

async function aggregatePeriod(where: Prisma.ContestWhereInput, db: DbClient = prisma) {
  const contests = await db.contest.findMany({ where, include: { standings: true } });
  const grouped = new Map<string, { playerUsername: string; totalScore: number; contests: number; wins: number; solved: number; firstSolves: number; penalty: number; placements: number }>();
  for (const standing of contests.flatMap((contest) => contest.standings)) {
    const current = grouped.get(standing.playerUsername) ?? { playerUsername: standing.playerUsername, totalScore: 0, contests: 0, wins: 0, solved: 0, firstSolves: 0, penalty: 0, placements: 0 };
    current.totalScore += standing.finalScore;
    current.contests += 1;
    current.wins += standing.rank === 1 ? 1 : 0;
    current.solved += standing.solved;
    current.firstSolves += standing.firstSolves;
    current.penalty += standing.penalty;
    current.placements += standing.rank;
    grouped.set(standing.playerUsername, current);
  }
  return [...grouped.values()]
    .sort((a, b) => b.totalScore - a.totalScore || b.wins - a.wins || a.penalty - b.penalty || b.solved - a.solved)
    .map((row, index) => ({ ...row, rank: index + 1, averageRank: Number((row.placements / row.contests).toFixed(1)) }));
}

async function rebuildHallOfFame(contestId: string, db: DbClient = prisma) {
  const finalists = await db.contestStanding.findMany({
    where: { contestId, rank: { lte: 5 } },
    include: { contest: true },
    orderBy: { rank: "asc" },
  });
  for (const standing of finalists) {
    const isWinner = standing.rank === 1;
    await db.hallOfFame.upsert({
      where: { id: `${contestId}:${standing.playerUsername}` },
      update: { score: standing.finalScore },
      create: {
        id: `${contestId}:${standing.playerUsername}`,
        player: { connect: { username: standing.playerUsername } },
        contest: { connect: { id: contestId } },
        title: `${isWinner ? "Champion" : `Rank #${standing.rank}`} of ${standing.contest.title}`,
        score: standing.finalScore,
        badges: JSON.stringify([isWinner ? "Champion" : "Top 5", `Rank #${standing.rank}`]),
        specialTitles: JSON.stringify([isWinner ? "Society Laureate" : "Society Finalist"]),
      },
    });
  }
}

async function rebuildAchievements(db: DbClient = prisma) {
  await db.achievement.deleteMany();
  const players = await db.player.findMany({ include: { standings: true } });
  for (const player of players) {
    const titles = new Set<string>();
    if (player.wins > 0) titles.add("Contest Dominator");
    if (player.firstSolves >= 3) titles.add("First Blood Hunter");
    if (player.totalSolved >= 10) titles.add("Problem Slayer");
    if (player.monthlyRank === 1) titles.add("Monthly Champion");
    if (player.yearlyRank === 1) titles.add("Yearly Champion");
    for (const title of titles) {
      await db.achievement.create({ data: { player: { connect: { username: player.username } }, title } });
    }
  }
}

export function parseStandingsText(text: string): EntryInput[] {
  const cleaned = text.replace(/<[^>]*>/g, "\n").trim();
  if (!cleaned) throw new Error("Add at least one standings row.");
  const pattern = /([^,\n]+?)\s*,\s*([^,\n]+?)\s*,\s*(\d+)\s*,\s*(\[[^\]]*\])/g;
  const entries: EntryInput[] = [];
  const unmatched: string[] = [];
  let cursor = 0;
  for (const match of cleaned.matchAll(pattern)) {
    const index = match.index ?? 0;
    const separator = cleaned.slice(cursor, index).replace(/[\s,;]+/g, "");
    if (separator) unmatched.push(separator);
    entries.push(entryInputSchema.parse({
      fullName: match[1],
      username: match[2],
      penalty: match[3],
      solveVector: match[4],
    }));
    cursor = index + match[0].length;
  }
  const tail = cleaned.slice(cursor).replace(/[\s,;]+/g, "");
  if (tail) unmatched.push(tail);
  if (!entries.length || unmatched.length) {
    throw new Error("Invalid standings format. Use: Full Name, username, penalty, [1,1,0,1].");
  }
  return entries;
}

export async function logActivity(adminId: string | undefined, action: string, entity: string, entityId?: string, metadata?: Prisma.InputJsonValue) {
  await prisma.activityLog.create({ data: { admin: adminId ? { connect: { id: adminId } } : undefined, action, entity, entityId, metadata } });
}
