import "server-only";

import type { Achievement, AcademyTopic, Certificate, Contest, ContestAnalytics, ContestCoordinator, ContestEditorial, ContestParticipation, ContestProblem, ContestStanding, FirstSolve, Player, Prisma, RatingHistory, RatingTitleHistory, TrainingRecommendation } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { contestStatusAt } from "@/lib/contest-status";
import { PUBLIC_CONTEST_WHERE, RANKED_CONTEST_WHERE } from "@/lib/contest-filters";
import { prisma } from "@/lib/prisma";
import type { ContestView, LeaderboardRow } from "@/lib/types";

type EntryWithPlayer = ContestStanding & { player: Player };
type ContestWithEntries = Contest & {
  standings: EntryWithPlayer[];
  coordinators: ContestCoordinator[];
  problems: (ContestProblem & { firstSolves: (FirstSolve & { player: Player | null })[] })[];
  analytics: ContestAnalytics | null;
  editorial: ContestEditorial | null;
};
type ContestCardWithWinner = Prisma.ContestGetPayload<{ include: typeof contestCardInclude }>;
type PlayerStandingWithContest = ContestStanding & { contest: Contest };
type PlayerParticipationWithContest = ContestParticipation & { contest: Contest };

export type PlayerProfile = {
  username: string;
  fullName: string;
  year: number;
  rating: number;
  ratingTitle: string;
  peakRating: number;
  totalScore: number;
  currentRank: number;
  yearlyRank: number;
  monthlyRank: number;
  wins: number;
  podiums: number;
  firstSolves: number;
  solved: number;
  participationCount: number;
  averagePlacement: number;
  bestPlacement: number;
  history: { contest: Contest; entry: PlayerStandingWithContest }[];
  participations: PlayerParticipationWithContest[];
  ratings: RatingHistory[];
  titleHistory: RatingTitleHistory[];
  achievements: Achievement[];
  certificates: Certificate[];
  recommendations: (TrainingRecommendation & { topic: AcademyTopic | null })[];
  firstSolveHistory: {
    id: string;
    problemCode: string;
    pointsAwarded: number;
    createdAt: string;
    contest: Contest;
  }[];
  winrate: number;
  ratingDeltaHistory: {
    contestId: string | null;
    delta: number;
    rating: number;
    createdAt: string;
  }[];
};

type ProblemStatView = NonNullable<ContestView["analytics"]>["problemStats"][number];

function parseProblemStats(value: Prisma.JsonValue): ProblemStatView[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
    return {
      code: String(row.code ?? ""),
      title: typeof row.title === "string" ? row.title : null,
      points: Number(row.points ?? 0),
      solves: Number(row.solves ?? 0),
      solveRate: Number(row.solveRate ?? 0),
      firstSolver: typeof row.firstSolver === "string" ? row.firstSolver : null,
      unsolved: Boolean(row.unsolved),
    };
  }).filter((row) => row.code);
}

function parseEditorialResources(value: Prisma.JsonValue): { title: string; url: string }[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
    return {
      title: String(row.title ?? ""),
      url: String(row.url ?? ""),
    };
  }).filter((row) => row.title && /^https?:\/\//i.test(row.url));
}

function toContestView(contest: ContestWithEntries): ContestView {
  return {
    id: contest.id,
    slug: contest.slug,
    title: contest.title,
    description: contest.description,
    invitePoster: contest.invitePoster,
    bannerPoster: contest.bannerPoster,
    contestBanner: contest.contestBanner,
    platform: contest.platform,
    contestLink: contest.contestLink,
    startTime: contest.startTime.toISOString(),
    duration: contest.duration,
    status: contestStatusAt(contest.startTime, contest.duration, contest.statusOverride),
    statusOverride: contest.statusOverride,
    updatedAt: contest.updatedAt.toISOString(),
    visibility: contest.visibility,
    scoringSystem: contest.scoringSystem,
    prizePool: contest.prizePool,
    standingsFinalizedAt: contest.standingsFinalizedAt?.toISOString() ?? null,
    lastSyncedAt: contest.lastSyncedAt?.toISOString() ?? null,
    syncStatus: contest.syncStatus,
    syncMessage: contest.syncMessage,
    totalPoints: contest.totalPoints,
    analytics: contest.analytics ? {
      participants: contest.analytics.participants,
      totalSolves: contest.analytics.totalSolves,
      averageScore: contest.analytics.averageScore,
      averageSolved: contest.analytics.averageSolved,
      winnerUsername: contest.analytics.winnerUsername,
      fastestUsername: contest.analytics.fastestUsername,
      hardestProblemCode: contest.analytics.hardestProblemCode,
      mostSolvedProblemCode: contest.analytics.mostSolvedProblemCode,
      unsolvedProblems: contest.analytics.unsolvedProblems,
      problemStats: parseProblemStats(contest.analytics.problemStats),
    } : null,
    editorial: contest.editorial ? {
      content: contest.editorial.content,
      resources: parseEditorialResources(contest.editorial.resources),
      updatedAt: contest.editorial.updatedAt.toISOString(),
    } : null,
    coordinators: contest.coordinators.map((coordinator) => ({
      id: coordinator.id,
      name: coordinator.name,
      role: coordinator.role,
      email: coordinator.email,
      phone: coordinator.phone,
      discord: coordinator.discord,
    })),
    firstSolveRows: contest.problems
      .flatMap((problem) => problem.firstSolves.filter((firstSolve) => firstSolve.status === "ASSIGNED" && firstSolve.player).map((firstSolve) => ({
        id: firstSolve.id,
        problemCode: problem.code,
        timestamp: firstSolve.createdAt.toISOString(),
        pointsAwarded: problem.points,
        status: firstSolve.status,
        player: { username: firstSolve.player!.username, fullName: firstSolve.player!.fullName },
      })))
      .sort((a, b) => a.problemCode.localeCompare(b.problemCode) || a.player.username.localeCompare(b.player.username)),
    problems: contest.problems
      .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code))
      .map((problem) => ({
        id: problem.id,
        code: problem.code,
        title: problem.title,
        points: problem.points,
        sortOrder: problem.sortOrder,
        firstSolves: problem.firstSolves.map((firstSolve) => ({
          id: firstSolve.id,
          status: firstSolve.status,
          player: firstSolve.player ? { username: firstSolve.player.username, fullName: firstSolve.player.fullName } : null,
        })),
      })),
    entries: contest.standings
      .sort((a, b) => a.rank - b.rank)
      .map((entry) => ({
        id: entry.id,
        username: entry.player.username,
        fullName: entry.player.fullName,
        year: entry.player.year,
        role: entry.player.role,
        rank: entry.rank,
        solved: entry.solved,
        solveVector: entry.solveVector,
        solvedProblems: entry.solvedProblems,
        penalty: entry.penalty,
        rawScore: entry.rawScore,
        contestScore: entry.contestScore,
        bonusPoints: entry.bonusPoints,
        finalScore: entry.finalScore,
        firstSolves: entry.firstSolves,
        rating: entry.player.currentRating,
        ratingTitle: entry.player.ratingTitle,
      })),
  };
}

const contestInclude = {
  standings: { include: { player: true } },
  coordinators: true,
  problems: { include: { firstSolves: { include: { player: true } } } },
  analytics: true,
  editorial: true,
};

const contestCardInclude = {
  standings: {
    take: 1,
    orderBy: { rank: "asc" as const },
    include: { player: true },
  },
};

function toContestCardView(contest: ContestCardWithWinner): ContestView {
  return {
    id: contest.id,
    slug: contest.slug,
    title: contest.title,
    description: contest.description,
    invitePoster: contest.invitePoster,
    bannerPoster: contest.bannerPoster,
    contestBanner: contest.contestBanner,
    platform: contest.platform,
    contestLink: contest.contestLink,
    startTime: contest.startTime.toISOString(),
    duration: contest.duration,
    status: contestStatusAt(contest.startTime, contest.duration, contest.statusOverride),
    statusOverride: contest.statusOverride,
    updatedAt: contest.updatedAt.toISOString(),
    visibility: contest.visibility,
    scoringSystem: contest.scoringSystem,
    prizePool: contest.prizePool,
    standingsFinalizedAt: contest.standingsFinalizedAt?.toISOString() ?? null,
    lastSyncedAt: contest.lastSyncedAt?.toISOString() ?? null,
    syncStatus: contest.syncStatus,
    syncMessage: contest.syncMessage,
    totalPoints: contest.totalPoints,
    analytics: null,
    editorial: null,
    coordinators: [],
    firstSolveRows: [],
    problems: [],
    entries: contest.standings.map((entry) => ({
      id: entry.id,
      username: entry.player.username,
      fullName: entry.player.fullName,
      year: entry.player.year,
      role: entry.player.role,
      rank: entry.rank,
      solved: entry.solved,
      solveVector: entry.solveVector,
      solvedProblems: entry.solvedProblems,
      penalty: entry.penalty,
      rawScore: entry.rawScore,
      contestScore: entry.contestScore,
      bonusPoints: entry.bonusPoints,
      finalScore: entry.finalScore,
      firstSolves: entry.firstSolves,
      rating: entry.player.currentRating,
      ratingTitle: entry.player.ratingTitle,
    })),
  };
}

export async function listContests({ includeHidden = false }: { includeHidden?: boolean } = {}): Promise<ContestView[]> {
  const contests = await prisma.contest.findMany({
    where: includeHidden ? undefined : PUBLIC_CONTEST_WHERE,
    include: contestInclude,
    orderBy: { startTime: "desc" },
  });
  return contests.map(toContestView);
}

const cachedContest = unstable_cache(async (idOrSlug: string): Promise<ContestView | null> => {
  const contest = await prisma.contest.findFirst({
    where: { AND: [PUBLIC_CONTEST_WHERE, { OR: [{ id: idOrSlug }, { slug: idOrSlug }] }] },
    include: contestInclude,
  });
  return contest ? toContestView(contest) : null;
}, ["contest-detail"], { revalidate: 60, tags: ["public-contests"] });

export async function getContest(idOrSlug: string): Promise<ContestView | null> {
  return cachedContest(idOrSlug);
}

function aggregate(entries: EntryWithPlayer[]): LeaderboardRow[] {
  const rows = new Map<string, Omit<LeaderboardRow, "rank" | "averagePlacement" | "bestPlacement"> & { placements: number; bestPlacement: number }>();
  for (const item of entries) {
    if (item.player.role === "ADMIN") continue;
    const current = rows.get(item.player.username) ?? {
      username: item.player.username,
      fullName: item.player.fullName,
      year: item.player.year,
      totalScore: 0,
      contests: 0,
      wins: 0,
      podiums: 0,
      solved: 0,
      penalty: 0,
      firstSolves: 0,
      rating: item.player.currentRating,
      ratingTitle: item.player.ratingTitle,
      placements: 0,
      bestPlacement: Number.MAX_SAFE_INTEGER,
    };
    current.totalScore += item.finalScore;
    current.contests += 1;
    current.wins += item.rank === 1 ? 1 : 0;
    current.podiums += item.rank <= 3 ? 1 : 0;
    current.solved += item.solved;
    current.penalty += item.penalty;
    current.firstSolves += item.firstSolves;
    current.placements += item.rank;
    current.bestPlacement = Math.min(current.bestPlacement, item.rank);
    rows.set(item.player.username, current);
  }

  return [...rows.values()]
    .sort((a, b) => b.totalScore - a.totalScore || b.wins - a.wins || a.penalty - b.penalty)
    .map((row, index) => ({
      ...row,
      rank: index + 1,
      averagePlacement: Number((row.placements / row.contests).toFixed(1)),
      bestPlacement: row.bestPlacement === Number.MAX_SAFE_INTEGER ? 0 : row.bestPlacement,
    }));
}

const cachedMonthlyLeaderboard = unstable_cache(async (year: number, month: number): Promise<{ contests: ContestView[]; rows: LeaderboardRow[] }> => {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  const [contests, boardRows] = await Promise.all([
    prisma.contest.findMany({
      where: { startTime: { gte: start, lt: end }, ...RANKED_CONTEST_WHERE },
      include: contestCardInclude,
      orderBy: { startTime: "asc" },
    }),
    prisma.monthlyLeaderboard.findMany({
      where: { year, month },
      orderBy: { rank: "asc" },
      include: { player: { select: { fullName: true, username: true, year: true, currentRating: true, ratingTitle: true, bestRank: true } } },
    }),
  ]);
  return {
    contests: contests.map(toContestCardView),
    rows: boardRows.length ? boardRows.map((row) => ({
      username: row.player.username,
      fullName: row.player.fullName,
      year: row.player.year,
      rank: row.rank,
      totalScore: row.totalScore,
      contests: row.contests,
      wins: row.wins,
      podiums: 0,
      solved: row.solved,
      penalty: 0,
      firstSolves: row.firstSolves,
      rating: row.player.currentRating,
      ratingTitle: row.player.ratingTitle,
      averagePlacement: row.averageRank ?? 0,
      bestPlacement: row.player.bestRank ?? 0,
    })) : aggregate(contests.flatMap((contest) => contest.standings)),
  };
}, ["monthly-leaderboard"], { revalidate: 60, tags: ["public-leaderboards"] });

export async function monthlyLeaderboard(year: number, month: number): Promise<{ contests: ContestView[]; rows: LeaderboardRow[] }> {
  return cachedMonthlyLeaderboard(year, month);
}

const cachedYearlyLeaderboard = unstable_cache(async (year: number): Promise<{ contests: ContestView[]; rows: LeaderboardRow[] }> => {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));
  const boardRows = await prisma.yearlyLeaderboard.findMany({
      where: { year },
      orderBy: { rank: "asc" },
      include: { player: { select: { fullName: true, username: true, year: true, currentRating: true, ratingTitle: true, bestRank: true } } },
    });
  return {
    contests: [],
    rows: boardRows.length ? boardRows.map((row) => ({
      username: row.player.username,
      fullName: row.player.fullName,
      year: row.player.year,
      rank: row.rank,
      totalScore: row.totalScore,
      contests: row.contests,
      wins: row.wins,
      podiums: 0,
      solved: row.solved,
      penalty: 0,
      firstSolves: row.firstSolves,
      rating: row.player.currentRating,
      ratingTitle: row.player.ratingTitle,
      averagePlacement: row.averageRank ?? 0,
      bestPlacement: row.player.bestRank ?? 0,
    })) : aggregate((await prisma.contest.findMany({
      where: { startTime: { gte: start, lt: end }, ...RANKED_CONTEST_WHERE },
      include: { standings: { include: { player: true } } },
      orderBy: { startTime: "asc" },
    })).flatMap((contest) => contest.standings)),
  };
}, ["yearly-leaderboard"], { revalidate: 60, tags: ["public-leaderboards"] });

export async function yearlyLeaderboard(year: number): Promise<{ contests: ContestView[]; rows: LeaderboardRow[] }> {
  return cachedYearlyLeaderboard(year);
}

const cachedPlayer = unstable_cache(async (username: string): Promise<PlayerProfile | null> => {
  const player = await prisma.player.findUnique({
    where: { username: username.toLowerCase() },
    include: {
      standings: {
        where: { contest: RANKED_CONTEST_WHERE },
        include: { contest: true },
        orderBy: { contest: { startTime: "desc" } },
      },
      ratingHistory: { orderBy: { createdAt: "asc" } },
      titleHistory: { orderBy: { earnedAt: "asc" } },
      achievements: { orderBy: { earnedAt: "desc" } },
      certificates: { orderBy: { issuedAt: "desc" }, take: 12 },
      recommendations: {
        orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
        take: 6,
        include: { topic: true },
      },
      firstSolveRows: {
        where: { status: "ASSIGNED", problem: { contest: PUBLIC_CONTEST_WHERE } },
        include: { problem: { include: { contest: true } } },
        orderBy: { createdAt: "desc" },
      },
      participations: {
        where: { contest: RANKED_CONTEST_WHERE },
        include: { contest: true },
        orderBy: { contest: { startTime: "desc" } },
      },
    },
  });
  if (!player) return null;

  return {
    username: player.username,
    fullName: player.fullName,
    year: player.year,
    rating: player.currentRating,
    ratingTitle: player.ratingTitle,
    peakRating: player.peakRating,
    totalScore: player.totalScore,
    currentRank: player.yearlyRank ?? 0,
    yearlyRank: player.yearlyRank ?? 0,
    monthlyRank: player.monthlyRank ?? 0,
    wins: player.wins,
    podiums: player.podiums,
    firstSolves: player.firstSolves,
    solved: player.totalSolved,
    participationCount: player.contestsPlayed,
    averagePlacement: player.averageRank ?? 0,
    bestPlacement: player.bestRank ?? 0,
    history: player.standings.map((entry) => ({ contest: entry.contest, entry })),
    participations: player.participations,
    ratings: player.ratingHistory,
    titleHistory: player.titleHistory,
    achievements: player.achievements,
    certificates: player.certificates,
    recommendations: player.recommendations,
    firstSolveHistory: player.firstSolveRows.map((firstSolve) => ({
      id: firstSolve.id,
      problemCode: firstSolve.problem.code,
      pointsAwarded: firstSolve.problem.points,
      createdAt: firstSolve.createdAt.toISOString(),
      contest: firstSolve.problem.contest,
    })),
    winrate: player.contestsPlayed ? Number(((player.wins / player.contestsPlayed) * 100).toFixed(1)) : 0,
    ratingDeltaHistory: player.ratingHistory.map((rating) => ({ contestId: rating.contestId, delta: rating.delta, rating: rating.rating, createdAt: rating.createdAt.toISOString() })),
  };
}, ["player-profile"], { revalidate: 60, tags: ["public-players"] });

export async function getPlayer(username: string): Promise<PlayerProfile | null> {
  return cachedPlayer(username);
}
