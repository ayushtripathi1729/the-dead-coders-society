import "server-only";

import type { Prisma } from "@prisma/client";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { contestStatusAt } from "@/lib/contest-status";
import { NON_ARCHIVED_CONTEST_WHERE, RANKED_CONTEST_WHERE } from "@/lib/contest-filters";
import { bonusForRank, contestScore, finalChampionshipScore, ratingTitle, rawScoreForSolveVector, societyRatingDelta } from "@/lib/scoring";
import { deleteFromCloudinary } from "@/server/uploads/cloudinary";

const visibilitySchema = z.enum(["PUBLIC", "PRIVATE", "ARCHIVED"]);
const statusOverrideSchema = z.enum(["AUTO", "FORCE_UPCOMING", "FORCE_LIVE", "FORCE_COMPLETED"]);
const playerRoleSchema = z.enum(["MEMBER", "ADMIN"]);
type DbClient = Prisma.TransactionClient | typeof prisma;
const httpUrlSchema = z.string().url().refine((value) => /^https?:\/\//i.test(value), "Only HTTP(S) URLs are allowed.");
const publicRevalidationPaths = [
  "/",
  "/contests",
  "/contests/upcoming",
  "/contests/live",
  "/contests/archive",
  "/players",
  "/hall-of-fame",
  "/leaderboards/monthly",
  "/leaderboards/yearly",
  "/academy",
  "/seasons",
  "/teams",
  "/discussions",
];

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
  role: playerRoleSchema.default("MEMBER"),
  currentRating: z.coerce.number().int().min(0).max(100_000),
  peakRating: z.coerce.number().int().min(0).max(100_000),
  totalSolved: z.coerce.number().int().min(0).max(100_000),
  wins: z.coerce.number().int().min(0).max(100_000),
  firstSolves: z.coerce.number().int().min(0).max(100_000),
  totalScore: z.coerce.number().int().min(0).max(100_000_000),
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
  statusOverride: statusOverrideSchema.default("AUTO"),
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

function revalidatePublicPages(extraPaths: string[] = []) {
  revalidateTag("public-leaderboards");
  revalidateTag("public-contests");
  revalidateTag("public-players");
  revalidateTag("ecosystem");
  for (const path of [...publicRevalidationPaths, ...extraPaths]) {
    revalidatePath(path);
  }
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

function rankEntries(entries: EntryInput[], problems: { code: string; points: number }[], adminUsernames = new Set<string>()) {
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

  const members = normalized.filter((entry) => !adminUsernames.has(entry.username));
  const admins = normalized.filter((entry) => adminUsernames.has(entry.username));
  let previous: (typeof normalized)[number] | undefined;
  let previousRank = 0;
  const rankedMembers = members
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
  const rankedAdmins = admins
    .sort((a, b) => b.solved - a.solved || a.penalty - b.penalty || a.username.localeCompare(b.username))
    .map((entry, index) => ({ ...entry, rank: rankedMembers.length + index + 1, bonusPoints: 0, finalScore: entry.contestScore }));
  return [...rankedMembers, ...rankedAdmins];
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
    if (problems) await saveContestProblems(saved.id, problems, tx);
    return saved;
  });

  if (id || problems) await refreshAllDerived();
  revalidatePublicPages([`/contests/${contest.slug}`]);
  await logActivity(adminId, id ? "contest.edited" : "contest.created", "Contest", contest.id, { title: contest.title });
  return contest;
}

export async function deleteContest(id: string, adminId?: string) {
  const assets = await prisma.uploadAsset.findMany({ where: { contestId: id }, select: { publicId: true } });
  const contest = await prisma.contest.delete({ where: { id } });
  await refreshAllDerived();
  revalidatePublicPages([`/contests/${contest.slug}`]);
  await logActivity(adminId, "contest.deleted", "Contest", id, { title: contest.title });
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
    return rows;
  }, { maxWait: 10_000, timeout: 120_000 });

  await refreshAllDerived();
  revalidatePublicPages();
  await logActivity(adminId, "standings.updated", "ContestStanding", contestId, { rows: saved.length, source: entries.length === 1 ? "single-row" : "draft" });
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
  }, { maxWait: 10_000, timeout: 120_000 });
  await refreshAllDerived();
  revalidatePublicPages();
  await logActivity(adminId, "standings.updated", "ContestStanding", standingId, { contestId, source: "row-edit" });
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
  }, { maxWait: 10_000, timeout: 120_000 });
  await refreshAllDerived();
  revalidatePublicPages();
  await logActivity(adminId, "standings.updated", "ContestStanding", standingId, { contestId, source: "row-delete" });
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
        action: "first-solve.modified",
        entity: "ContestProblem",
        entityId: contestId,
        metadata: { problems: problems.length },
      },
    });
  }, { maxWait: 10_000, timeout: 120_000 });
  await refreshAllDerived();
  revalidatePublicPages();
}

export async function finalizeContestStandings(contestId: string, rawProblems: unknown[] = [], adminId?: string) {
  const problems = parseProblems(rawProblems);
  const result = await prisma.$transaction(async (tx) => {
    const contest = await tx.contest.findUniqueOrThrow({ where: { id: contestId }, select: { standingsFinalizedAt: true } });
    if (contest.standingsFinalizedAt) return { finalized: false, rows: await tx.contestStanding.count({ where: { contestId } }) };
    const standings = await tx.contestStanding.findMany({ where: { contestId } });
    if (!standings.length) throw new Error("Add at least one participant before finalizing standings.");
    await saveContestProblems(contestId, problems, tx);
    await tx.contest.update({ where: { id: contestId }, data: { standingsFinalizedAt: new Date() } });
    await tx.activityLog.create({
      data: {
        admin: adminId ? { connect: { id: adminId } } : undefined,
        action: "standings.updated",
        entity: "Contest",
        entityId: contestId,
        metadata: { rows: standings.length },
      },
    });
    return { finalized: true, rows: standings.length };
  }, { maxWait: 10_000, timeout: 120_000 });

  await refreshAllDerived();
  revalidatePublicPages();
  if (!result.finalized) await logActivity(adminId, "standings.updated", "Contest", contestId, { rows: result.rows, source: "finalize-refresh" });
  return result;
}

export async function recalculateContest(contestId: string, adminId?: string) {
  await prisma.$transaction(async (tx) => {
    await tx.contest.findUniqueOrThrow({ where: { id: contestId }, select: { id: true } });
    const rows = await tx.contestStanding.findMany({ where: { contestId }, include: { player: true } });
    await replaceContestStandings(contestId, rows.map((row) => ({ username: row.player.username, fullName: row.player.fullName, solveVector: row.solveVector, penalty: row.penalty, notes: row.notes })), tx);
  }, { maxWait: 10_000, timeout: 120_000 });
  await refreshAllDerived();
  revalidatePublicPages();
  await logActivity(adminId, "standings.updated", "Contest", contestId, { source: "recalculate" });
}

export async function checkAndFinalizeContest(contestId: string, adminId?: string) {
  const contest = await prisma.contest.findUnique({
    where: { id: contestId },
    select: { id: true, startTime: true, duration: true, statusOverride: true, standingsFinalizedAt: true, standings: { select: { id: true } } },
  });

  if (!contest) throw new Error("Contest not found.");
  if (contest.standingsFinalizedAt) return { finalized: false, message: "Contest already finalized." };
  if (!contest.standings.length) return { finalized: false, message: "No participants to finalize." };

  const status = contestStatusAt(contest.startTime, contest.duration, contest.statusOverride);
  if (status !== "COMPLETED") return { finalized: false, message: `Contest status is ${status}, not COMPLETED.` };

  await finalizeContestStandings(contestId, [], adminId);
  return { finalized: true, message: "Contest finalized successfully." };
}

export async function updateContestVisibility(contestId: string, visibility: "PUBLIC" | "PRIVATE" | "ARCHIVED", adminId?: string) {
  const previous = await prisma.contest.findUniqueOrThrow({ where: { id: contestId }, select: { visibility: true } });
  const contest = await prisma.contest.update({
    where: { id: contestId },
    data: { visibility },
  });
  revalidatePublicPages([`/contests/${contest.slug}`]);
  await logActivity(adminId, `contest.visibility.${visibility.toLowerCase()}`, "Contest", contestId, { previous: previous.visibility, new: visibility });
  return contest;
}

async function replaceContestStandings(contestId: string, entries: EntryInput[], db: DbClient) {
  const problems = await db.contestProblem.findMany({ where: { contestId }, orderBy: [{ sortOrder: "asc" }, { code: "asc" }] });
  if (!problems.length) throw new Error("Add contest problems before entering standings.");
  const parsedEntries = entries.map((entry) => entryInputSchema.parse(entry));
  const playerRoles = await db.player.findMany({
    where: { username: { in: parsedEntries.map((entry) => entry.username.toLowerCase()) } },
    select: { username: true, role: true } as const,
  });
  const adminUsernames = new Set(playerRoles.filter((player) => player.role === "ADMIN").map((player) => player.username.toLowerCase()));
  const ranked = rankEntries(parsedEntries, problems, adminUsernames);

  const rankedUsernames = ranked.map((entry) => entry.username);
  const existingPlayers = await db.player.findMany({
    where: { username: { in: rankedUsernames } },
    select: { username: true },
  });
  const existingUsernames = new Set(existingPlayers.map((player) => player.username));
  const newPlayers = ranked.filter((entry) => !existingUsernames.has(entry.username));
  if (newPlayers.length) {
    await db.player.createMany({
      data: newPlayers.map((entry) => ({ username: entry.username, fullName: entry.fullName })),
      skipDuplicates: true,
    });
  }
  const savedUsernames = rankedUsernames;

  // Batch upsert participations
  await Promise.all(
    ranked.map((entry) =>
      db.contestParticipation.upsert({
        where: { contestId_playerUsername: { contestId, playerUsername: entry.username } },
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
          player: { connect: { username: entry.username } },
          finalRank: entry.rank,
          finalScore: entry.finalScore,
          solved: entry.solved,
          solveVector: entry.solveVector,
          solvedProblems: entry.solvedProblems,
          rawScore: entry.rawScore,
          contestScore: entry.contestScore,
          penalty: entry.penalty,
        },
      })
    )
  );

  // Batch upsert standings
  await Promise.all(
    ranked.map((entry) =>
      db.contestStanding.upsert({
        where: { contestId_playerUsername: { contestId, playerUsername: entry.username } },
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
          player: { connect: { username: entry.username } },
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
      })
    )
  );

  // Clean up removed standings
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
        role: data.role,
        currentRating: data.currentRating,
        peakRating: Math.max(data.peakRating, data.currentRating),
        totalSolved: data.totalSolved,
        wins: data.wins,
        firstSolves: data.firstSolves,
        totalScore: data.totalScore,
      },
      select: { id: true, fullName: true, username: true, year: true, email: true, branchCourse: true, avatar: true, bio: true, role: true, currentRating: true, peakRating: true, totalSolved: true, wins: true, firstSolves: true, totalScore: true },
    });
    return saved;
  }, { maxWait: 10_000, timeout: 60_000 });

  await logActivity(adminId, "player.edited", "Player", player.username, { previousUsername: current.username });
  revalidatePublicPages([`/players/${player.username}`, `/players/${current.username}`]);
  return player;
}

export async function deletePlayer(username: string, adminId?: string) {
  const player = await prisma.player.findUniqueOrThrow({ where: { username } });
  await prisma.$transaction(async (tx) => {
    await tx.player.delete({ where: { id: player.id } });
  }, { maxWait: 10_000, timeout: 120_000 });
  await refreshAllDerived();
  revalidatePublicPages([`/players/${username}`]);
  await logActivity(adminId, "player.deleted", "Player", username, { fullName: player.fullName });
}

async function saveContestProblems(contestId: string, problems: ParsedProblem[], db: DbClient) {
  await db.contestProblem.deleteMany({ where: { contestId } });
  const standingPlayers = await db.contestStanding.findMany({
    where: { contestId },
    select: {
      playerUsername: true,
      player: { select: { username: true, fullName: true } },
      solveVector: true,
      penalty: true,
      notes: true,
    },
  });
  const playersByUsername = new Map(standingPlayers.map((standing) => [standing.player.username.toLowerCase(), standing.player.username]));
  const missingFirstSolveUser = problems.find((problem) => problem.firstSolveStatus === "ASSIGNED" && problem.firstSolveUsername && !playersByUsername.has(problem.firstSolveUsername));
  if (missingFirstSolveUser?.firstSolveUsername) {
    throw new Error(`First solve user "${missingFirstSolveUser.firstSolveUsername}" is not in this contest's standings.`);
  }

  await db.contestProblem.createMany({
    data: problems.map((problem, index) => ({
      contestId,
      code: problem.code.trim().toUpperCase(),
      title: optionalString(problem.title),
      points: problem.points,
      sortOrder: index,
    })),
  });

  const savedProblems = await db.contestProblem.findMany({
    where: { contestId },
    select: { id: true, code: true },
  });
  const problemIdsByCode = new Map(savedProblems.map((problem) => [problem.code, problem.id]));
  const firstSolveRows: Prisma.FirstSolveCreateManyInput[] = [];
  for (const problem of problems) {
    const problemId = problemIdsByCode.get(problem.code.trim().toUpperCase());
    if (!problemId) continue;
    if (problem.firstSolveStatus === "UNSOLVED") {
      firstSolveRows.push({ problemId, status: "UNSOLVED" });
    }
    if (problem.firstSolveStatus === "ASSIGNED" && problem.firstSolveUsername) {
      firstSolveRows.push({
        problemId,
        playerUsername: playersByUsername.get(problem.firstSolveUsername),
        status: "ASSIGNED",
      });
    }
  }
  if (firstSolveRows.length) {
    await db.firstSolve.createMany({ data: firstSolveRows });
  }
  await db.contest.update({
    where: { id: contestId },
    data: { totalPoints: problems.reduce((sum, problem) => sum + problem.points, 0) },
  });
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
  await Promise.all([...counts].map(([playerUsername, firstSolves]) => (
    db.contestStanding.updateMany({ where: { contestId, playerUsername }, data: { firstSolves } })
  )));
}

export async function refreshAllDerived(db: DbClient = prisma) {
  await recomputeRatings(db);
  await recalculateAllStats(db);
  await assignContestsToSeasons(db);
  const contests = await db.contest.findMany({ where: { standingsFinalizedAt: { not: null } }, select: { id: true, startTime: true } });
  const months = new Set(contests.map((contest) => `${contest.startTime.getUTCFullYear()}-${contest.startTime.getUTCMonth() + 1}`));
  const years = new Set(contests.map((contest) => contest.startTime.getUTCFullYear()));
  for (const key of months) {
    const [year, month] = key.split("-").map(Number);
    await rebuildMonthlyLeaderboard(year, month, db);
  }
  for (const year of years) await rebuildYearlyLeaderboard(year, db);
  await db.hallOfFame.deleteMany({ where: { contestId: { not: null } } });
  for (const contest of contests) {
    await rebuildContestAnalytics(contest.id, db);
    await rebuildHallOfFame(contest.id, db);
  }
  await rebuildAchievements(db);
  await rebuildSeasonStandings(db);
  await rebuildTrainingRecommendations(db);
  await rebuildTeamStandings(db);
  await rebuildCertificates(db);
}

let lastLifecycleCheckAt = 0;
const LIFECYCLE_REFRESH_INTERVAL_MS = 180_000;

export async function syncCompletedContests(adminId?: string, { force = true }: { force?: boolean } = {}) {
  const nowMs = Date.now();
  if (!force && nowMs - lastLifecycleCheckAt < LIFECYCLE_REFRESH_INTERVAL_MS) {
    return { checked: 0, synced: 0, finalized: 0, lastSyncedAt: new Date(lastLifecycleCheckAt || nowMs).toISOString(), message: "Lifecycle check skipped; recent refresh is still fresh." };
  }
  lastLifecycleCheckAt = nowMs;
  const candidates = await prisma.contest.findMany({
    where: NON_ARCHIVED_CONTEST_WHERE,
    include: { standings: { select: { id: true } } },
    orderBy: { startTime: "asc" },
  });
  const completed = candidates.filter((contest) => contestStatusAt(contest.startTime, contest.duration, contest.statusOverride) === "COMPLETED");
  const startedAt = new Date();

  if (!completed.length) {
    return { checked: candidates.length, synced: 0, finalized: 0, lastSyncedAt: startedAt.toISOString(), message: "No completed contests detected." };
  }

  await prisma.contest.updateMany({ where: { id: { in: completed.map((contest) => contest.id) } }, data: { syncStatus: "RUNNING", syncMessage: "Refresh in progress." } });

  try {
    let finalized = 0;
    await prisma.$transaction(async (tx) => {
      for (const contest of completed) {
        if (!contest.standingsFinalizedAt && contest.standings.length) {
          await tx.contest.update({ where: { id: contest.id }, data: { standingsFinalizedAt: startedAt } });
          finalized += 1;
        }
      }
      await tx.contest.updateMany({
        where: { id: { in: completed.map((contest) => contest.id) } },
        data: { lastSyncedAt: startedAt, syncStatus: "RUNNING", syncMessage: `Finalized ${finalized} contest${finalized === 1 ? "" : "s"}; rebuilding derived data.` },
      });
      await tx.activityLog.create({
        data: {
          admin: adminId ? { connect: { id: adminId } } : undefined,
          action: "standings.updated",
          entity: "Contest",
          metadata: { checked: candidates.length, synced: completed.length, finalized },
        },
      });
    }, { maxWait: 10_000, timeout: 120_000 });
    await refreshAllDerived();
    revalidatePublicPages();
    await prisma.contest.updateMany({
      where: { id: { in: completed.map((contest) => contest.id) } },
      data: { lastSyncedAt: startedAt, syncStatus: "SUCCESS", syncMessage: `Synced ${completed.length} completed contest${completed.length === 1 ? "" : "s"}.` },
    });
    return { checked: candidates.length, synced: completed.length, finalized, lastSyncedAt: startedAt.toISOString(), message: "Completed contest data refreshed." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed.";
    await prisma.contest.updateMany({ where: { id: { in: completed.map((contest) => contest.id) } }, data: { syncStatus: "FAILED", syncMessage: message } });
    await logActivity(adminId, "sync.failed", "Contest", undefined, { checked: candidates.length, attempted: completed.length, message });
    throw error;
  }
}

export async function rebuildRatings(adminId?: string) {
  await recomputeRatings();
  await recalculateAllStats();
  await rebuildAchievements();
  revalidatePublicPages();
  await logActivity(adminId, "ratings.rebuilt", "System");
}

export async function rebuildLeaderboards(adminId?: string) {
  const contests = await prisma.contest.findMany({ where: { standingsFinalizedAt: { not: null } }, select: { startTime: true } });
  const months = new Set(contests.map((contest) => `${contest.startTime.getUTCFullYear()}-${contest.startTime.getUTCMonth() + 1}`));
  const years = new Set(contests.map((contest) => contest.startTime.getUTCFullYear()));
  for (const key of months) {
    const [year, month] = key.split("-").map(Number);
    await rebuildMonthlyLeaderboard(year, month);
  }
  for (const year of years) await rebuildYearlyLeaderboard(year);
  revalidatePublicPages();
  await logActivity(adminId, "leaderboards.rebuilt", "System");
}

export async function rebuildHallOfFameOnly(adminId?: string) {
  const contests = await prisma.contest.findMany({ where: { standingsFinalizedAt: { not: null } }, select: { id: true } });
  await prisma.hallOfFame.deleteMany({ where: { contestId: { not: null } } });
  for (const contest of contests) await rebuildHallOfFame(contest.id);
  revalidatePublicPages(["/hall-of-fame"]);
  await logActivity(adminId, "hall-of-fame.rebuilt", "System");
}

export async function rebuildEverything(adminId?: string) {
  await syncCompletedContests(adminId, { force: true });
  await refreshAllDerived();
  revalidatePublicPages();
  await logActivity(adminId, "everything.rebuilt", "System");
}

async function recomputeRatings(db: DbClient = prisma) {
  const players = await db.player.findMany({ select: { username: true, role: true } as const });
  const memberPlayers = players.filter((player) => player.role === "MEMBER");
  const ratings = new Map(players.map((player) => [player.username, 1200]));
  const peaks = new Map(players.map((player) => [player.username, 1200]));
  const contests = await db.contest.findMany({
    where: RANKED_CONTEST_WHERE,
    include: { standings: { include: { player: true }, orderBy: { rank: "asc" } } },
    orderBy: { startTime: "asc" },
  });

  await db.ratingHistory.deleteMany();
  await db.ratingTitleHistory.deleteMany();
  await db.contestParticipation.updateMany({ data: { ratingDelta: 0 } });

  // Batch create rating history and collect updates
  const ratingHistoryRecords: Prisma.RatingHistoryCreateManyInput[] = [];
  const titleHistoryRecords: Prisma.RatingTitleHistoryCreateManyInput[] = [];
  const participationDeltaUpdates: Array<{ contestId: string; playerUsername: string; delta: number }> = [];

  for (const contest of contests) {
    const memberStandings = contest.standings.filter((standing) => standing.player.role === "MEMBER");
    const participantCount = Math.max(memberStandings.length, 1);
    for (const standing of memberStandings) {
      const current = ratings.get(standing.playerUsername) ?? 1200;
      const delta = societyRatingDelta({ rank: standing.rank, solved: standing.solved, participantCount, finalScore: standing.finalScore, firstSolves: standing.firstSolves });
      const next = Math.max(100, current + delta);
      const previousTitle = ratingTitle(current);
      const nextTitle = ratingTitle(next);
      ratings.set(standing.playerUsername, next);
      peaks.set(standing.playerUsername, Math.max(peaks.get(standing.playerUsername) ?? 1200, next));
      ratingHistoryRecords.push({
        playerUsername: standing.playerUsername,
        contestId: contest.id,
        rating: next,
        delta,
        reason: "TDCS standings finalization",
      });
      if (previousTitle !== nextTitle || !titleHistoryRecords.some((row) => row.playerUsername === standing.playerUsername)) {
        titleHistoryRecords.push({
          playerUsername: standing.playerUsername,
          contestId: contest.id,
          title: nextTitle,
          rating: next,
        });
      }
      participationDeltaUpdates.push({ contestId: contest.id, playerUsername: standing.playerUsername, delta });
    }
  }

  // Batch create rating history
  if (ratingHistoryRecords.length) {
    await db.ratingHistory.createMany({ data: ratingHistoryRecords });
  }
  if (titleHistoryRecords.length) {
    await db.ratingTitleHistory.createMany({ data: titleHistoryRecords });
  }

  // Batch update participation deltas
  await Promise.all(
    participationDeltaUpdates.map((update) =>
      db.contestParticipation.updateMany({ where: { contestId: update.contestId, playerUsername: update.playerUsername }, data: { ratingDelta: update.delta } })
    )
  );

  // Batch update player ratings
  await Promise.all(
    memberPlayers.map((player) =>
      db.player.update({
        where: { username: player.username },
        data: { currentRating: ratings.get(player.username) ?? 1200, peakRating: peaks.get(player.username) ?? 1200, ratingTitle: ratingTitle(ratings.get(player.username) ?? 1200) },
      })
    )
  );
}

async function recalculateAllStats(db: DbClient = prisma) {
  const players = await db.player.findMany({ include: { standings: { include: { contest: true } } } });

  // Prepare batch update data
  const playerUpdates: Array<{id: string; data: Prisma.PlayerUpdateInput}> = [];

  for (const player of players) {
    const standings = player.standings.filter((standing) => standing.contest.standingsFinalizedAt && standing.contest.visibility !== "PRIVATE");
    const rankedStandings = player.role === "ADMIN" ? [] : standings;
    const contestsPlayed = standings.length;
    const totalScore = standings.reduce((sum, item) => sum + item.finalScore, 0);
    const totalSolved = standings.reduce((sum, item) => sum + item.solved, 0);
    const wins = rankedStandings.filter((item) => item.rank === 1).length;
    const podiums = rankedStandings.filter((item) => item.rank <= 3).length;
    const firstSolves = standings.reduce((sum, item) => sum + item.firstSolves, 0);
    const averageRank = rankedStandings.length ? rankedStandings.reduce((sum, item) => sum + item.rank, 0) / rankedStandings.length : null;
    const bestRank = rankedStandings.length ? Math.min(...rankedStandings.map((item) => item.rank)) : null;
    playerUpdates.push({
      id: player.id,
      data: { contestsPlayed, totalScore, totalSolved, wins, podiums, firstSolves, averageRank, bestRank },
    });
  }

  // Batch update players
  await Promise.all(
    playerUpdates.map((update) =>
      db.player.update({ where: { id: update.id }, data: update.data })
    )
  );
}

async function rebuildMonthlyLeaderboard(year: number, month: number, db: DbClient = prisma) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  const rows = await aggregatePeriod({ startTime: { gte: start, lt: end }, ...RANKED_CONTEST_WHERE }, db);
  const now = new Date();
  const isCurrentMonth = year === now.getUTCFullYear() && month === now.getUTCMonth() + 1;
  await db.monthlyLeaderboard.deleteMany({ where: { year, month } });
  if (isCurrentMonth) await db.player.updateMany({ data: { monthlyRank: null } });

  // Batch create monthly leaderboard entries
  if (rows.length) {
    await db.monthlyLeaderboard.createMany({
      data: rows.map((row) => ({
        playerUsername: row.playerUsername,
        year,
        month,
        rank: row.rank,
        totalScore: row.totalScore,
        contests: row.contests,
        wins: row.wins,
        solved: row.solved,
        firstSolves: row.firstSolves,
        averageRank: row.averageRank,
      })),
    });
  }

  // Batch update player monthly ranks
  if (isCurrentMonth && rows.length) {
    await Promise.all(
      rows.map((row) =>
        db.player.update({ where: { username: row.playerUsername }, data: { monthlyRank: row.rank } })
      )
    );
  }
}

async function rebuildYearlyLeaderboard(year: number, db: DbClient = prisma) {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));
  const rows = await aggregatePeriod({ startTime: { gte: start, lt: end }, ...RANKED_CONTEST_WHERE }, db);
  const isCurrentYear = year === new Date().getUTCFullYear();
  await db.yearlyLeaderboard.deleteMany({ where: { year } });
  if (isCurrentYear) await db.player.updateMany({ data: { yearlyRank: null } });

  // Batch create yearly leaderboard entries
  if (rows.length) {
    await db.yearlyLeaderboard.createMany({
      data: rows.map((row) => ({
        playerUsername: row.playerUsername,
        year,
        rank: row.rank,
        totalScore: row.totalScore,
        contests: row.contests,
        wins: row.wins,
        solved: row.solved,
        firstSolves: row.firstSolves,
        averageRank: row.averageRank,
      })),
    });
  }

  // Batch update player yearly ranks
  if (isCurrentYear && rows.length) {
    await Promise.all(
      rows.map((row) =>
        db.player.update({ where: { username: row.playerUsername }, data: { yearlyRank: row.rank } })
      )
    );
  }
}

async function aggregatePeriod(where: Prisma.ContestWhereInput, db: DbClient = prisma) {
  const contests = await db.contest.findMany({ where, include: { standings: { include: { player: true } } } });
  const grouped = new Map<string, { playerUsername: string; totalScore: number; contests: number; wins: number; solved: number; firstSolves: number; penalty: number; placements: number }>();
  for (const standing of contests.flatMap((contest) => contest.standings)) {
    if (standing.player.role === "ADMIN") continue;
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
    include: { contest: true, player: true },
    orderBy: { rank: "asc" },
  });
  for (const standing of finalists.filter((standing) => standing.player.role === "MEMBER")) {
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
        badges: JSON.stringify([isWinner ? "Champion" : "Top 5", `Rank #${standing.rank}`, ratingTitle(standing.player.currentRating)]),
        specialTitles: JSON.stringify([isWinner ? "Society Laureate" : "Society Finalist"]),
      },
    });
  }
}

async function rebuildAchievements(db: DbClient = prisma) {
  const players = await db.player.findMany({ include: { standings: { include: { contest: true }, orderBy: { contest: { startTime: "asc" } } } } });
  for (const player of players) {
    const finalized = player.standings.filter((standing) => standing.contest.standingsFinalizedAt && standing.contest.visibility !== "PRIVATE");
    const ranked = player.role === "ADMIN" ? [] : finalized;
    const sortedMonths = [...new Set(finalized.map((standing) => `${standing.contest.startTime.getUTCFullYear()}-${standing.contest.startTime.getUTCMonth()}`))];
    const awards: Array<{ code: string; title: string; description: string; category?: string; contestId?: string }> = [];
    if (finalized.length >= 1) awards.push({ code: "FIRST_CONTEST", title: "First Contest", description: "Completed a first official TDS contest." });
    if (player.firstSolves >= 1) awards.push({ code: "FIRST_SOLVE", title: "First Solve", description: "Recorded a first solve." });
    if (player.wins >= 1) awards.push({ code: "CONTEST_WINNER", title: "Contest Winner", description: "Won an official contest.", category: "PLACEMENT" });
    if (player.podiums >= 1) awards.push({ code: "TOP_3_FINISH", title: "Top 3 Finish", description: "Reached the podium.", category: "PLACEMENT" });
    if (ranked.some((standing) => standing.rank <= 10)) awards.push({ code: "TOP_10_FINISH", title: "Top 10 Finish", description: "Placed in the top ten.", category: "PLACEMENT" });
    if (finalized.length >= 3 || sortedMonths.length >= 3) awards.push({ code: "THREE_CONTEST_STREAK", title: "3 Contest Streak", description: "Built a three-contest record.", category: "STREAK" });
    if (finalized.length >= 5 || sortedMonths.length >= 5) awards.push({ code: "FIVE_CONTEST_STREAK", title: "5 Contest Streak", description: "Built a five-contest record.", category: "STREAK" });
    if (player.totalScore >= 1000) awards.push({ code: "POINTS_1000", title: "1000 Points Club", description: "Crossed 1000 championship points.", category: "POINTS" });
    if (player.totalScore >= 5000) awards.push({ code: "POINTS_5000", title: "5000 Points Club", description: "Crossed 5000 championship points.", category: "POINTS" });
    if (player.totalSolved >= 10) awards.push({ code: "PROBLEM_SLAYER", title: "Problem Slayer", description: "Solved at least ten problems.", category: "SOLVES" });
    if (player.firstSolves >= 3) awards.push({ code: "FIRST_BLOOD_COLLECTOR", title: "First Blood Collector", description: "Collected at least three first solves.", category: "SOLVES" });
    if (player.monthlyRank === 1) awards.push({ code: "MONTHLY_CHAMPION", title: "Monthly Champion", description: "Held the top monthly rank.", category: "RANK" });
    if (player.yearlyRank === 1) awards.push({ code: "YEARLY_CHAMPION", title: "Yearly Champion", description: "Held the top yearly rank.", category: "RANK" });
    for (const award of awards) {
      await db.achievement.upsert({
        where: { playerUsername_code: { playerUsername: player.username, code: award.code } },
        update: { title: award.title, description: award.description, category: award.category ?? "GENERAL", contestId: award.contestId },
        create: { playerUsername: player.username, code: award.code, title: award.title, description: award.description, category: award.category ?? "GENERAL", contestId: award.contestId },
      });
    }
  }
}

async function rebuildContestAnalytics(contestId: string, db: DbClient = prisma) {
  const contest = await db.contest.findUnique({
    where: { id: contestId },
    include: {
      problems: { orderBy: [{ sortOrder: "asc" }, { code: "asc" }], include: { firstSolves: { include: { player: true } } } },
      standings: { include: { player: true }, orderBy: [{ rank: "asc" }, { penalty: "asc" }] },
    },
  });
  if (!contest) return;
  const participants = contest.standings.filter((standing) => standing.player.role === "MEMBER");
  const participantCount = participants.length;
  const totalSolves = participants.reduce((sum, standing) => sum + standing.solved, 0);
  const averageScore = participantCount ? Number((participants.reduce((sum, standing) => sum + standing.finalScore, 0) / participantCount).toFixed(1)) : 0;
  const averageSolved = participantCount ? Number((totalSolves / participantCount).toFixed(1)) : 0;
  const problemStats = contest.problems.map((problem, index) => {
    const solveCount = participants.reduce((sum, standing) => sum + (standing.solveVector[index] === 1 ? 1 : 0), 0);
    const firstSolve = problem.firstSolves[0];
    return {
      code: problem.code,
      title: problem.title,
      points: problem.points,
      solves: solveCount,
      solveRate: participantCount ? Number(((solveCount / participantCount) * 100).toFixed(1)) : 0,
      firstSolver: firstSolve?.status === "ASSIGNED" && firstSolve.player ? firstSolve.player.username : null,
      unsolved: solveCount === 0,
    };
  });
  const hardest = [...problemStats].sort((a, b) => a.solves - b.solves || b.points - a.points)[0];
  const mostSolved = [...problemStats].sort((a, b) => b.solves - a.solves || a.points - b.points)[0];
  const fastest = [...participants].filter((standing) => standing.solved > 0).sort((a, b) => a.penalty - b.penalty || b.solved - a.solved)[0];
  await db.contestAnalytics.upsert({
    where: { contestId },
    update: {
      participants: participantCount,
      totalSolves,
      averageScore,
      averageSolved,
      winnerUsername: participants[0]?.playerUsername,
      fastestUsername: fastest?.playerUsername,
      hardestProblemCode: hardest?.code,
      mostSolvedProblemCode: mostSolved?.code,
      unsolvedProblems: problemStats.filter((problem) => problem.unsolved).map((problem) => problem.code),
      problemStats,
    },
    create: {
      contestId,
      participants: participantCount,
      totalSolves,
      averageScore,
      averageSolved,
      winnerUsername: participants[0]?.playerUsername,
      fastestUsername: fastest?.playerUsername,
      hardestProblemCode: hardest?.code,
      mostSolvedProblemCode: mostSolved?.code,
      unsolvedProblems: problemStats.filter((problem) => problem.unsolved).map((problem) => problem.code),
      problemStats,
    },
  });
}

async function assignContestsToSeasons(db: DbClient = prisma) {
  const [seasons, contests] = await Promise.all([
    db.season.findMany({ select: { id: true, startsAt: true, endsAt: true } }),
    db.contest.findMany({ select: { id: true, startTime: true, seasonId: true } }),
  ]);
  await Promise.all(contests.map((contest) => {
    const season = seasons.find((item) => contest.startTime >= item.startsAt && contest.startTime <= item.endsAt);
    if (!season || contest.seasonId === season.id) return Promise.resolve();
    return db.contest.update({ where: { id: contest.id }, data: { seasonId: season.id } });
  }));
}

async function rebuildSeasonStandings(db: DbClient = prisma) {
  const seasons = await db.season.findMany({
    include: {
      contests: {
        where: RANKED_CONTEST_WHERE,
        include: { standings: { include: { player: true } } },
      },
    },
  });
  await db.seasonStanding.deleteMany();
  for (const season of seasons) {
    const grouped = new Map<string, { playerUsername: string; points: number; contests: number; wins: number; solved: number; rating: number }>();
    for (const standing of season.contests.flatMap((contest) => contest.standings)) {
      if (standing.player.role === "ADMIN") continue;
      const current = grouped.get(standing.playerUsername) ?? { playerUsername: standing.playerUsername, points: 0, contests: 0, wins: 0, solved: 0, rating: standing.player.currentRating };
      current.points += standing.finalScore;
      current.contests += 1;
      current.wins += standing.rank === 1 ? 1 : 0;
      current.solved += standing.solved;
      current.rating = standing.player.currentRating;
      grouped.set(standing.playerUsername, current);
    }
    const rows = [...grouped.values()].sort((a, b) => b.points - a.points || b.wins - a.wins || b.solved - a.solved || b.rating - a.rating);
    if (rows.length) {
      await db.seasonStanding.createMany({
        data: rows.map((row, index) => ({ ...row, seasonId: season.id, rank: index + 1 })),
      });
    }
  }
}

async function rebuildTrainingRecommendations(db: DbClient = prisma) {
  const [topics, players] = await Promise.all([
    db.academyTopic.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, slug: true } }),
    db.player.findMany({
      where: { role: "MEMBER" },
      select: { username: true, currentRating: true, totalSolved: true, contestsPlayed: true, firstSolves: true, averageRank: true },
    }),
  ]);
  if (!topics.length) return;
  await db.trainingRecommendation.deleteMany();
  const statRows: Array<Prisma.PlayerTopicStatCreateManyInput & { playerUsername: string; topicId: string; strengthScore: number }> = [];
  const recommendationRows: Prisma.TrainingRecommendationCreateManyInput[] = [];
  for (const player of players) {
    const baseStrength = Math.min(100, Math.max(0, (player.totalSolved * 8) + (player.contestsPlayed * 5) + Math.max(0, player.currentRating - 1000) / 12));
    const weakOffset = player.averageRank && player.averageRank > 3 ? -12 : 0;
    topics.forEach((topic, index) => {
      const topicBias = ((player.username.length + index * 7) % 18) - 9;
      const strengthScore = Number(Math.max(0, Math.min(100, baseStrength + topicBias + weakOffset)).toFixed(1));
      const solved = Math.max(0, Math.floor((player.totalSolved * Math.max(20, strengthScore)) / (topics.length * 100)));
      const attempts = solved + Math.max(1, Math.floor((100 - strengthScore) / 25));
      statRows.push({ playerUsername: player.username, topicId: topic.id, attempts, solved, strengthScore });
    });
    const weakTopics = statRows
      .filter((row) => row.playerUsername === player.username)
      .sort((a, b) => a.strengthScore - b.strengthScore)
      .slice(0, 3);
    weakTopics.forEach((row, index) => {
      recommendationRows.push({
        playerUsername: player.username,
        topicId: row.topicId,
        reason: row.strengthScore < 35 ? "Weak area detected from contest history." : "Good next topic for balanced growth.",
        nextDifficulty: player.currentRating >= 1600 ? "ADVANCED" : player.currentRating >= 1200 ? "INTERMEDIATE" : "BEGINNER",
        priority: index + 1,
      });
    });
  }
  await db.playerTopicStat.deleteMany();
  if (statRows.length) await db.playerTopicStat.createMany({ data: statRows });
  if (recommendationRows.length) await db.trainingRecommendation.createMany({ data: recommendationRows });
}

async function rebuildTeamStandings(db: DbClient = prisma) {
  const teams = await db.team.findMany({
    include: {
      memberships: { include: { player: true } },
    },
  });
  const seasons = await db.season.findMany({ select: { id: true } });
  await db.teamStanding.deleteMany();
  for (const team of teams) {
    const members = team.memberships.filter((membership) => membership.player.role === "MEMBER").map((membership) => membership.player);
    const points = members.reduce((sum, player) => sum + player.totalScore, 0);
    const wins = members.reduce((sum, player) => sum + player.wins, 0);
    const rating = members.length ? Math.round(members.reduce((sum, player) => sum + player.currentRating, 0) / members.length) : 1200;
    await db.team.update({ where: { id: team.id }, data: { points, wins, rating } });
  }
  for (const season of seasons) {
    const seasonRows = await db.seasonStanding.findMany({ where: { seasonId: season.id } });
    const pointByPlayer = new Map(seasonRows.map((row) => [row.playerUsername, row.points]));
    const currentTeams = await db.team.findMany({ include: { memberships: true } });
    const rows = currentTeams.map((team) => ({
      teamId: team.id,
      points: team.memberships.reduce((sum, membership) => sum + (pointByPlayer.get(membership.playerUsername) ?? 0), 0),
      rating: team.rating,
      wins: team.wins,
    })).filter((row) => row.points > 0).sort((a, b) => b.points - a.points || b.rating - a.rating);
    if (rows.length) {
      await db.teamStanding.createMany({
        data: rows.map((row, index) => ({ ...row, seasonId: season.id, rank: index + 1 })),
      });
    }
  }
  const championTeams = await db.team.findMany({ where: { wins: { gt: 0 } }, select: { id: true, wins: true } });
  for (const team of championTeams) {
    await db.teamAchievement.upsert({
      where: { teamId_code: { teamId: team.id, code: "TEAM_WINNERS" } },
      update: { title: "Team Winners" },
      create: { teamId: team.id, code: "TEAM_WINNERS", title: "Team Winners" },
    });
  }
}

async function rebuildCertificates(db: DbClient = prisma) {
  const [winners, achievements, seasonChampions] = await Promise.all([
    db.contestStanding.findMany({ where: { rank: 1, contest: RANKED_CONTEST_WHERE }, include: { contest: true } }),
    db.achievement.findMany({ select: { id: true, playerUsername: true, title: true, code: true } }),
    db.seasonStanding.findMany({ where: { rank: 1 }, include: { season: true } }),
  ]);
  for (const standing of winners) {
    await db.certificate.upsert({
      where: { id: `winner:${standing.contestId}:${standing.playerUsername}` },
      update: { title: `${standing.contest.title} Champion`, metadata: { rank: 1, score: standing.finalScore } },
      create: { id: `winner:${standing.contestId}:${standing.playerUsername}`, type: "WINNER", title: `${standing.contest.title} Champion`, playerUsername: standing.playerUsername, contestId: standing.contestId, metadata: { rank: 1, score: standing.finalScore } },
    });
  }
  for (const achievement of achievements) {
    await db.certificate.upsert({
      where: { id: `achievement:${achievement.id}` },
      update: { title: achievement.title, metadata: { code: achievement.code } },
      create: { id: `achievement:${achievement.id}`, type: "ACHIEVEMENT", title: achievement.title, playerUsername: achievement.playerUsername, metadata: { code: achievement.code } },
    });
  }
  for (const standing of seasonChampions) {
    await db.certificate.upsert({
      where: { id: `season:${standing.seasonId}:${standing.playerUsername}` },
      update: { title: `${standing.season.name} Champion`, metadata: { points: standing.points, contests: standing.contests } },
      create: { id: `season:${standing.seasonId}:${standing.playerUsername}`, type: "SEASON", title: `${standing.season.name} Champion`, playerUsername: standing.playerUsername, metadata: { points: standing.points, contests: standing.contests } },
    });
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
