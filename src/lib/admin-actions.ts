import "server-only";

import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { bonusForRank, finalContestScore, societyRatingDelta } from "@/lib/scoring";
import { deleteFromCloudinary } from "@/server/uploads/cloudinary";

const statusSchema = z.enum(["UPCOMING", "LIVE", "FINISHED"]);
const visibilitySchema = z.enum(["PUBLIC", "PRIVATE", "ARCHIVED"]);
type DbClient = Prisma.TransactionClient | typeof prisma;

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
  firstSolveUsernames: z.array(z.string().min(1).max(48)).default([]),
});

export const contestInputSchema = z.object({
  title: z.string().min(2).max(140),
  slug: z.string().optional(),
  description: z.string().max(5000).default(""),
  invitePoster: z.string().url().optional().or(z.literal("")).nullable(),
  bannerPoster: z.string().url().optional().or(z.literal("")).nullable(),
  contestBanner: z.string().url().optional().or(z.literal("")).nullable(),
  platform: z.string().min(2).max(80).default("Codeforces"),
  contestLink: z.string().url().optional().or(z.literal("")).nullable(),
  startTime: z.coerce.date(),
  duration: z.coerce.number().int().positive().max(1440).default(120),
  status: statusSchema.default("UPCOMING"),
  visibility: visibilitySchema.default("PUBLIC"),
  scoringSystem: z.string().min(2).max(80).default("TDCS_TOP5_V1"),
  prizePool: z.string().max(120).optional().or(z.literal("")).nullable(),
  totalPoints: z.coerce.number().int().positive().default(1000),
  coordinators: z.array(coordinatorSchema).optional(),
});

export const entryInputSchema = z.object({
  username: z.string().min(1).max(48).regex(/^[a-zA-Z0-9_.-]+$/),
  fullName: z.string().min(1).max(120),
  solved: z.coerce.number().int().min(0),
  penalty: z.coerce.number().int().min(0),
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

function rankEntries(entries: EntryInput[], totalPoints: number) {
  const seen = new Set<string>();
  const normalized = entries.map((entry) => {
    const parsed = entryInputSchema.parse(entry);
    const key = parsed.username.toLowerCase();
    if (seen.has(key)) throw new Error(`Duplicate participant username: ${parsed.username}`);
    seen.add(key);
    return {
      ...parsed,
      rawScore: totalPoints - parsed.penalty,
    };
  });

  return normalized
    .sort((a, b) => b.solved - a.solved || a.penalty - b.penalty || a.username.localeCompare(b.username))
    .map((entry, index) => {
      const rank = index + 1;
      const bonusPoints = bonusForRank(rank);
      return { ...entry, rank, bonusPoints, finalScore: finalContestScore(totalPoints, entry.penalty, bonusPoints) };
    })
}

function parseProblems(rawProblems: unknown[]) {
  const problems = rawProblems.map((problem) => problemSchema.parse(problem));
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
  const { coordinators, ...contestFields } = data;
  const slug = data.slug ? slugify(data.slug) : slugify(data.title);
  const payload = {
    ...contestFields,
    slug,
    invitePoster: optionalString(data.invitePoster),
    bannerPoster: optionalString(data.bannerPoster),
    contestBanner: optionalString(data.contestBanner),
    contestLink: optionalString(data.contestLink),
    prizePool: optionalString(data.prizePool),
    createdById: adminId,
  };

  const contest = await prisma.$transaction(async (tx) => {
    const saved = id ? await tx.contest.update({ where: { id }, data: payload }) : await tx.contest.create({ data: payload });
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

export async function upsertContestEntries(contestId: string, rawEntries: unknown[], adminId?: string) {
  const entries = rawEntries.map((entry) => entryInputSchema.parse(entry));
  const saved = await prisma.$transaction(async (tx) => {
    await ensureContestMutable(contestId, tx);
    const existing = await tx.contestStanding.findMany({ where: { contestId }, include: { player: true } });
    const merged = new Map<string, EntryInput>(existing.map((row) => [row.player.username.toLowerCase(), { username: row.player.username, fullName: row.player.fullName, solved: row.solved, penalty: row.penalty, notes: row.notes }]));
    for (const entry of entries) merged.set(entry.username.toLowerCase(), entry);
    return replaceContestStandings(contestId, [...merged.values()], tx);
  }, { maxWait: 10_000, timeout: 30_000 });

  await logActivity(adminId, entries.length === 1 ? "participant.added" : "standings.draft.upsert", "ContestStanding", contestId, { rows: saved.length });
  return saved;
}

export async function updateContestEntry(contestId: string, standingId: string, input: unknown, adminId?: string) {
  const entry = entryInputSchema.parse(input);
  await prisma.$transaction(async (tx) => {
    await ensureContestMutable(contestId, tx);
    const standing = await tx.contestStanding.findUniqueOrThrow({ where: { id: standingId }, include: { player: true } });
    if (standing.contestId !== contestId) throw new Error("Standing row not found.");
    const rows = await tx.contestStanding.findMany({ where: { contestId }, include: { player: true } });
    const next = rows.map((row) => row.id === standingId ? entry : { username: row.player.username, fullName: row.player.fullName, solved: row.solved, penalty: row.penalty, notes: row.notes });
    await replaceContestStandings(contestId, next, tx);
  }, { maxWait: 10_000, timeout: 30_000 });
  await logActivity(adminId, "participant.edited", "ContestStanding", standingId, { contestId });
}

export async function deleteContestEntry(contestId: string, standingId: string, adminId?: string) {
  await prisma.$transaction(async (tx) => {
    await ensureContestMutable(contestId, tx);
    const standing = await tx.contestStanding.findUniqueOrThrow({ where: { id: standingId } });
    if (standing.contestId !== contestId) throw new Error("Standing row not found.");
    await tx.contestStanding.delete({ where: { id: standingId } });
    await tx.contestParticipation.deleteMany({ where: { contestId, playerId: standing.playerId } });
    const rows = await tx.contestStanding.findMany({ where: { contestId }, include: { player: true } });
    await replaceContestStandings(contestId, rows.map((row) => ({ username: row.player.username, fullName: row.player.fullName, solved: row.solved, penalty: row.penalty, notes: row.notes })), tx);
  }, { maxWait: 10_000, timeout: 30_000 });
  await logActivity(adminId, "participant.deleted", "ContestStanding", standingId, { contestId });
}

export async function saveContestProblemDraft(contestId: string, rawProblems: unknown[] = [], adminId?: string) {
  const problems = parseProblems(rawProblems);
  await prisma.$transaction(async (tx) => {
    await ensureContestMutable(contestId, tx);
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
      return previous && (previous.title !== optionalString(problem.title) || previous.sortOrder !== index);
    }).length;
    const deleted = previousProblems.filter((problem) => !nextCodes.has(problem.code)).length;
    if (added) {
      await tx.activityLog.create({
        data: {
          adminId,
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
          adminId,
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
          adminId,
          action: "problem.deleted",
          entity: "ContestProblem",
          entityId: contestId,
          metadata: { deleted },
        },
      });
    }
    await tx.activityLog.create({
      data: {
        adminId,
        action: "first-solves.updated",
        entity: "ContestProblem",
        entityId: contestId,
        metadata: { problems: problems.length },
      },
    });
  }, { maxWait: 10_000, timeout: 30_000 });
}

export async function finalizeContestStandings(contestId: string, rawProblems: unknown[] = [], adminId?: string) {
  const problems = parseProblems(rawProblems);
  const result = await prisma.$transaction(async (tx) => {
    const contest = await tx.contest.findUniqueOrThrow({ where: { id: contestId }, select: { standingsFinalizedAt: true } });
    if (contest.standingsFinalizedAt) return { finalized: false, rows: await tx.contestStanding.count({ where: { contestId } }) };
    const standings = await tx.contestStanding.findMany({ where: { contestId } });
    if (!standings.length) throw new Error("Add at least one participant before finalizing standings.");
    await saveContestProblems(contestId, problems, tx);
    await tx.contest.update({ where: { id: contestId }, data: { standingsFinalizedAt: new Date(), status: "FINISHED" } });
    await tx.activityLog.create({
      data: {
        adminId,
        action: "standings.finalize",
        entity: "Contest",
        entityId: contestId,
        metadata: { rows: standings.length },
      },
    });
    return { finalized: true, rows: standings.length };
  }, { maxWait: 10_000, timeout: 30_000 });

  if (result.finalized) await refreshAllDerived();
  if (!result.finalized) await logActivity(adminId, "standings.finalize.idempotent", "Contest", contestId, { rows: result.rows });
  return result;
}

export async function recalculateContest(contestId: string, adminId?: string) {
  await prisma.$transaction(async (tx) => {
    const contest = await tx.contest.findUniqueOrThrow({ where: { id: contestId }, select: { standingsFinalizedAt: true } });
    if (contest.standingsFinalizedAt) {
      await refreshAllDerived(tx);
      return;
    }
    const rows = await tx.contestStanding.findMany({ where: { contestId }, include: { player: true } });
    await replaceContestStandings(contestId, rows.map((row) => ({ username: row.player.username, fullName: row.player.fullName, solved: row.solved, penalty: row.penalty, notes: row.notes })), tx);
    await refreshAllDerived(tx);
  }, { maxWait: 10_000, timeout: 30_000 });
  await logActivity(adminId, "standings.recalculate", "Contest", contestId);
}

async function ensureContestMutable(contestId: string, db: DbClient) {
  const contest = await db.contest.findUniqueOrThrow({ where: { id: contestId }, select: { standingsFinalizedAt: true } });
  if (contest.standingsFinalizedAt) throw new Error("Standings are finalized. Create a new contest revision to change results.");
}

async function replaceContestStandings(contestId: string, entries: EntryInput[], db: DbClient) {
  const contest = await db.contest.findUniqueOrThrow({ where: { id: contestId }, select: { totalPoints: true } });
  const ranked = rankEntries(entries, contest.totalPoints);
  const saved = [];
  await db.contestParticipation.deleteMany({ where: { contestId } });
  await db.contestStanding.deleteMany({ where: { contestId } });

  for (const entry of ranked) {
    const existingPlayer = await db.player.findFirst({
      where: { username: { equals: entry.username, mode: "insensitive" } },
    });
    const player = existingPlayer
      ? await db.player.update({ where: { id: existingPlayer.id }, data: { fullName: entry.fullName, username: existingPlayer.username } })
      : await db.player.create({ data: { username: entry.username, fullName: entry.fullName } });

    await db.contestParticipation.create({
      data: {
        contestId,
        playerId: player.id,
        finalRank: entry.rank,
        finalScore: entry.finalScore,
        solved: entry.solved,
        penalty: entry.penalty,
      },
    });

    saved.push(await db.contestStanding.create({
      data: {
        contestId,
        playerId: player.id,
        rank: entry.rank,
        solved: entry.solved,
        penalty: entry.penalty,
        rawScore: entry.rawScore,
        bonusPoints: entry.bonusPoints,
        finalScore: entry.finalScore,
        firstSolves: 0,
        notes: entry.notes || undefined,
      },
    }));
  }
  return saved;
}

async function saveContestProblems(contestId: string, problems: z.infer<typeof problemSchema>[], db: DbClient) {
  await db.firstSolve.deleteMany({ where: { contestId } });
  await db.contestProblem.deleteMany({ where: { contestId } });
  await db.contestStanding.updateMany({ where: { contestId }, data: { firstSolves: 0 } });
  const standingPlayers = await db.contestStanding.findMany({ where: { contestId }, include: { player: true } });
  const playersByUsername = new Map(standingPlayers.map((standing) => [standing.player.username.toLowerCase(), standing.player]));

  for (const [index, problem] of problems.entries()) {
    const contestProblem = await db.contestProblem.create({
      data: {
        contestId,
        code: problem.code.trim().toUpperCase(),
        title: optionalString(problem.title),
        sortOrder: index,
      },
    });

    const uniqueUsernames = [...new Set(problem.firstSolveUsernames.map((username) => username.trim().toLowerCase()).filter(Boolean))];
    for (const username of uniqueUsernames) {
      const player = playersByUsername.get(username);
      if (!player) throw new Error(`First solve user "${username}" is not in this contest's standings.`);
      await db.problemFirstSolve.create({ data: { problemId: contestProblem.id, playerId: player.id } });
      await db.firstSolve.create({
        data: {
          contestId,
          playerId: player.id,
          problemCode: contestProblem.code,
          timestamp: new Date(),
          pointsAwarded: 0,
        },
      });
    }
  }

  const counts = await db.firstSolve.groupBy({ by: ["playerId"], where: { contestId }, _count: { _all: true } });
  for (const count of counts) {
    await db.contestStanding.updateMany({ where: { contestId, playerId: count.playerId }, data: { firstSolves: count._count._all } });
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
  const players = await db.player.findMany({ select: { id: true } });
  const ratings = new Map(players.map((player) => [player.id, 1200]));
  const peaks = new Map(players.map((player) => [player.id, 1200]));
  const contests = await db.contest.findMany({
    where: { visibility: { not: "PRIVATE" }, standingsFinalizedAt: { not: null } },
    include: { standings: { orderBy: { rank: "asc" } } },
    orderBy: { startTime: "asc" },
  });

  await db.ratingHistory.deleteMany();
  for (const contest of contests) {
    const participantCount = Math.max(contest.standings.length, 1);
    for (const standing of contest.standings) {
      const current = ratings.get(standing.playerId) ?? 1200;
      const delta = societyRatingDelta({ rank: standing.rank, solved: standing.solved, participantCount, finalScore: standing.finalScore, firstSolves: standing.firstSolves });
      const next = Math.max(100, current + delta);
      ratings.set(standing.playerId, next);
      peaks.set(standing.playerId, Math.max(peaks.get(standing.playerId) ?? 1200, next));
      await db.ratingHistory.create({ data: { playerId: standing.playerId, contestId: contest.id, rating: next, delta, reason: "TDCS standings finalization" } });
      await db.contestParticipation.updateMany({ where: { contestId: contest.id, playerId: standing.playerId }, data: { ratingDelta: delta } });
    }
  }

  for (const player of players) {
    await db.player.update({ where: { id: player.id }, data: { currentRating: ratings.get(player.id) ?? 1200, peakRating: peaks.get(player.id) ?? 1200 } });
  }
}

async function recalculateAllStats(db: DbClient = prisma) {
  const players = await db.player.findMany({ include: { standings: { include: { contest: true } } } });
  for (const player of players) {
    const standings = player.standings.filter((standing) => standing.contest.standingsFinalizedAt);
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
    await db.monthlyLeaderboard.create({ data: { playerId: row.playerId, year, month, rank: row.rank, totalScore: row.totalScore, contests: row.contests, wins: row.wins, solved: row.solved, firstSolves: row.firstSolves, averageRank: row.averageRank } });
    if (isCurrentMonth) await db.player.update({ where: { id: row.playerId }, data: { monthlyRank: row.rank } });
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
    await db.yearlyLeaderboard.create({ data: { playerId: row.playerId, year, rank: row.rank, totalScore: row.totalScore, contests: row.contests, wins: row.wins, solved: row.solved, firstSolves: row.firstSolves, averageRank: row.averageRank } });
    if (isCurrentYear) await db.player.update({ where: { id: row.playerId }, data: { yearlyRank: row.rank } });
  }
}

async function aggregatePeriod(where: Prisma.ContestWhereInput, db: DbClient = prisma) {
  const contests = await db.contest.findMany({ where, include: { standings: true } });
  const grouped = new Map<string, { playerId: string; totalScore: number; contests: number; wins: number; solved: number; firstSolves: number; placements: number }>();
  for (const standing of contests.flatMap((contest) => contest.standings)) {
    const current = grouped.get(standing.playerId) ?? { playerId: standing.playerId, totalScore: 0, contests: 0, wins: 0, solved: 0, firstSolves: 0, placements: 0 };
    current.totalScore += standing.finalScore;
    current.contests += 1;
    current.wins += standing.rank === 1 ? 1 : 0;
    current.solved += standing.solved;
    current.firstSolves += standing.firstSolves;
    current.placements += standing.rank;
    grouped.set(standing.playerId, current);
  }
  return [...grouped.values()]
    .sort((a, b) => b.totalScore - a.totalScore || b.wins - a.wins || b.solved - a.solved)
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
      where: { id: `${contestId}:${standing.playerId}` },
      update: { score: standing.bonusPoints },
      create: {
        id: `${contestId}:${standing.playerId}`,
        playerId: standing.playerId,
        contestId,
        title: `${isWinner ? "Champion" : `Rank #${standing.rank}`} of ${standing.contest.title}`,
        score: standing.bonusPoints,
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
      await db.achievement.create({ data: { playerId: player.id, title } });
    }
  }
}

export function parseStandingsText(text: string): EntryInput[] {
  const lines = text.replace(/<[^>]*>/g, "\n").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return lines.map((line) => {
    const parts = line.split(/,|\t|\s{2,}/).map((part) => part.trim()).filter(Boolean);
    if (parts.length < 4) throw new Error(`Invalid standings row: "${line}". Use full name, username, penalty, solved.`);
    const [fullName, username, penalty, solved] = parts;
    return { fullName, username, penalty: Number(penalty), solved: Number(solved) };
  });
}

export async function logActivity(adminId: string | undefined, action: string, entity: string, entityId?: string, metadata?: Prisma.InputJsonValue) {
  await prisma.activityLog.create({ data: { adminId, action, entity, entityId, metadata } });
}
