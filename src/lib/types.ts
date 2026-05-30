export type ContestStatus = "UPCOMING" | "LIVE" | "COMPLETED";

export type ContestEntry = {
  id?: string;
  username: string;
  fullName: string;
  year?: number;
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
      player: { username: string; fullName: string };
    }[];
  }[];
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
  averagePlacement: number;
  bestPlacement: number;
};
