export type ContestStatus = "UPCOMING" | "LIVE" | "COMPLETED";
export type ContestStatusOverride = "AUTO" | "FORCE_UPCOMING" | "FORCE_LIVE" | "FORCE_COMPLETED";
export type SyncStatus = "IDLE" | "RUNNING" | "SUCCESS" | "FAILED";
export type PlayerRole = "MEMBER" | "ADMIN";

export type ContestEntry = {
  id?: string;
  username: string;
  fullName: string;
  year?: number;
  role?: PlayerRole;
  rank: number;
  solved: number;
  solveVector: number[];
  solvedProblems: string[];
  penalty: number;
  rawScore: number;
  contestScore: number;
  bonusPoints: number;
  finalScore: number;
  firstSolves: number;
  rating?: number;
  ratingDelta?: number;
  ratingTitle?: string;
};

export type ContestEntryView = ContestEntry & {
  id: string;
};

export type Contest = {
  id: string;
  title: string;
  slug: string;
  description: string;
  invitePoster: string | null;
  bannerPoster?: string | null;
  contestBanner?: string | null;
  contestLink?: string | null;
  platform: string;
  status: ContestStatus;
  statusOverride: ContestStatusOverride;
  startTime: string;
  updatedAt: string;
  duration: number;
  totalPoints: number;
  entries: ContestEntry[];
};

export type ContestView = Omit<Contest, "bannerPoster" | "entries"> & {
  bannerPoster: string | null;
  contestBanner: string | null;
  contestLink: string | null;
  visibility: "PUBLIC" | "PRIVATE" | "ARCHIVED";
  scoringSystem: string;
  prizePool: string | null;
  standingsFinalizedAt: string | null;
  lastSyncedAt: string | null;
  syncStatus: SyncStatus;
  syncMessage: string | null;
  coordinators: {
    id: string;
    name: string;
    role: string;
    email: string | null;
    phone: string;
    discord: string | null;
  }[];
  firstSolveRows: {
    id: string;
    problemCode: string;
    timestamp: string;
    pointsAwarded: number;
    status: "ASSIGNED" | "UNSOLVED";
    player: { username: string; fullName: string };
  }[];
  problems: {
    id: string;
    code: string;
    title: string | null;
    points: number;
    sortOrder: number;
    firstSolves: {
      id: string;
      status: "ASSIGNED" | "UNSOLVED";
      player: { username: string; fullName: string } | null;
    }[];
  }[];
  analytics: {
    participants: number;
    totalSolves: number;
    averageScore: number;
    averageSolved: number;
    winnerUsername: string | null;
    fastestUsername: string | null;
    hardestProblemCode: string | null;
    mostSolvedProblemCode: string | null;
    unsolvedProblems: string[];
    problemStats: {
      code: string;
      title: string | null;
      points: number;
      solves: number;
      solveRate: number;
      firstSolver: string | null;
      unsolved: boolean;
    }[];
  } | null;
  editorial: {
    content: string;
    resources: { title: string; url: string }[];
    updatedAt: string;
  } | null;
  entries: ContestEntryView[];
};

export type LeaderboardRow = {
  username: string;
  fullName: string;
  year: number;
  rank: number;
  totalScore: number;
  contests: number;
  wins: number;
  podiums: number;
  solved: number;
  penalty: number;
  firstSolves: number;
  rating: number;
  ratingTitle: string;
  averagePlacement: number;
  bestPlacement: number;
};
