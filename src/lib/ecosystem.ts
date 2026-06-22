import "server-only";

import type { AcademyDifficulty, Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

export const academySeed = [
  ["implementation", "Implementation", "Translate statements into clean code with careful edge-case handling."],
  ["greedy", "Greedy", "Choose locally optimal moves and prove they compose into a global optimum."],
  ["binary-search", "Binary Search", "Use monotonic predicates and search spaces to find exact thresholds."],
  ["prefix-sum", "Prefix Sum", "Precompute cumulative information for constant-time range queries."],
  ["two-pointers", "Two Pointers", "Scan ordered structures with moving boundaries."],
  ["sliding-window", "Sliding Window", "Maintain dynamic windows over arrays and strings."],
  ["trees", "Trees", "Reason over rooted and unrooted tree structure."],
  ["graphs", "Graphs", "Model states and relationships with vertices and edges."],
  ["dfs", "DFS", "Explore depth-first for components, trees, and backtracking."],
  ["bfs", "BFS", "Explore shortest unweighted distances and layers."],
  ["dp", "DP", "Break problems into reusable states and transitions."],
  ["bitmasking", "Bitmasking", "Represent sets and states compactly with bits."],
  ["number-theory", "Number Theory", "Use divisibility, primes, modular arithmetic, and gcd structure."],
  ["strings", "Strings", "Process textual patterns, hashes, prefixes, and matching."],
] as const;

export type AcademyTopicView = Prisma.AcademyTopicGetPayload<{
  include: {
    resources: true;
    problems: true;
    _count: { select: { progress: true; recommendations: true } };
  };
}>;

export type SeasonView = Prisma.SeasonGetPayload<{
  include: {
    contests: { select: { id: true; title: true; slug: true; startTime: true } };
    standings: { include: { player: { select: { fullName: true; username: true; ratingTitle: true } } } };
    teamStandings: { include: { team: true } };
  };
}>;

export type TeamView = Prisma.TeamGetPayload<{
  include: {
    institution: true;
    memberships: { include: { player: { select: { fullName: true; username: true; currentRating: true; ratingTitle: true } } } };
    standings: { include: { season: true } };
    achievements: true;
  };
}>;

export type DiscussionThreadView = Prisma.DiscussionThreadGetPayload<{
  include: {
    contest: { select: { title: true; slug: true } };
    posts: true;
  };
}>;

export type RecommendationView = Prisma.TrainingRecommendationGetPayload<{
  include: {
    topic: true;
  };
}>;

export type EcosystemStats = {
  academyTopics: number;
  seasonCount: number;
  teamCount: number;
  pendingDiscussions: number;
  issuedCertificates: number;
};

const topicInclude = {
  resources: { orderBy: { sortOrder: "asc" as const } },
  problems: { orderBy: [{ difficulty: "asc" as const }, { rating: "asc" as const }, { sortOrder: "asc" as const }] },
  _count: { select: { progress: true, recommendations: true } },
};

export const getAcademyTopics = unstable_cache(async (): Promise<AcademyTopicView[]> => {
  return prisma.academyTopic.findMany({
    orderBy: { sortOrder: "asc" },
    include: topicInclude,
  });
}, ["academy-topics"], { revalidate: 300, tags: ["ecosystem"] });

export const getAcademyTopic = unstable_cache(async (slug: string): Promise<AcademyTopicView | null> => {
  return prisma.academyTopic.findUnique({
    where: { slug },
    include: topicInclude,
  });
}, ["academy-topic"], { revalidate: 300, tags: ["ecosystem"] });

export const getSeasons = unstable_cache(async (): Promise<SeasonView[]> => {
  return prisma.season.findMany({
    orderBy: { startsAt: "asc" },
    include: {
      contests: { orderBy: { startTime: "asc" }, select: { id: true, title: true, slug: true, startTime: true } },
      standings: {
        take: 20,
        orderBy: { rank: "asc" },
        include: { player: { select: { fullName: true, username: true, ratingTitle: true } } },
      },
      teamStandings: {
        take: 10,
        orderBy: { rank: "asc" },
        include: { team: true },
      },
    },
  });
}, ["seasons"], { revalidate: 120, tags: ["ecosystem"] });

export const getTeams = unstable_cache(async (): Promise<TeamView[]> => {
  return prisma.team.findMany({
    orderBy: [{ points: "desc" }, { rating: "desc" }, { name: "asc" }],
    include: {
      institution: true,
      memberships: {
        orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
        include: { player: { select: { fullName: true, username: true, currentRating: true, ratingTitle: true } } },
      },
      standings: { orderBy: { rank: "asc" }, include: { season: true } },
      achievements: { orderBy: { earnedAt: "desc" } },
    },
  });
}, ["teams"], { revalidate: 120, tags: ["ecosystem"] });

export const getDiscussionThreads = unstable_cache(async (): Promise<DiscussionThreadView[]> => {
  return prisma.discussionThread.findMany({
    where: { status: "APPROVED" },
    orderBy: { updatedAt: "desc" },
    take: 30,
    include: {
      contest: { select: { title: true, slug: true } },
      posts: { where: { status: "APPROVED" }, orderBy: { createdAt: "asc" }, take: 5 },
    },
  });
}, ["discussion-threads"], { revalidate: 60, tags: ["ecosystem"] });

export const getPlayerRecommendations = unstable_cache(async (username: string): Promise<RecommendationView[]> => {
  return prisma.trainingRecommendation.findMany({
    where: { playerUsername: username.toLowerCase() },
    orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
    take: 6,
    include: { topic: true },
  });
}, ["player-recommendations"], { revalidate: 120, tags: ["ecosystem"] });

export const getEcosystemStats = unstable_cache(async (): Promise<EcosystemStats> => {
  const [academyTopics, seasonCount, teamCount, pendingDiscussions, issuedCertificates] = await Promise.all([
    prisma.academyTopic.count(),
    prisma.season.count(),
    prisma.team.count(),
    prisma.discussionPost.count({ where: { status: "PENDING" } }),
    prisma.certificate.count(),
  ]);
  return { academyTopics, seasonCount, teamCount, pendingDiscussions, issuedCertificates };
}, ["ecosystem-stats"], { revalidate: 60, tags: ["ecosystem"] });

export function suggestedDifficulty(rating: number): AcademyDifficulty {
  if (rating >= 1600) return "ADVANCED";
  if (rating >= 1200) return "INTERMEDIATE";
  return "BEGINNER";
}
