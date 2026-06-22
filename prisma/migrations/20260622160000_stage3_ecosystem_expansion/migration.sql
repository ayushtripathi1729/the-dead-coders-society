DO $$
BEGIN
  ALTER TYPE "CertificateType" ADD VALUE IF NOT EXISTS 'ACHIEVEMENT';
  ALTER TYPE "CertificateType" ADD VALUE IF NOT EXISTS 'SEASON';
  ALTER TYPE "CertificateType" ADD VALUE IF NOT EXISTS 'TEAM';
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AcademyDifficulty') THEN
    CREATE TYPE "AcademyDifficulty" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DiscussionScope') THEN
    CREATE TYPE "DiscussionScope" AS ENUM ('GENERAL', 'CONTEST', 'PROBLEM');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ModerationStatus') THEN
    CREATE TYPE "ModerationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TeamRole') THEN
    CREATE TYPE "TeamRole" AS ENUM ('CAPTAIN', 'MEMBER');
  END IF;
END $$;

ALTER TABLE "Player" ADD COLUMN IF NOT EXISTS "institutionId" TEXT;
ALTER TABLE "Contest" ADD COLUMN IF NOT EXISTS "seasonId" TEXT;

CREATE TABLE IF NOT EXISTS "Institution" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "departments" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "batches" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Institution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AcademyTopic" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "overview" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AcademyTopic_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AcademyResource" (
  "id" TEXT NOT NULL,
  "topicId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'ARTICLE',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "AcademyResource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AcademyProblem" (
  "id" TEXT NOT NULL,
  "topicId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "url" TEXT,
  "difficulty" "AcademyDifficulty" NOT NULL DEFAULT 'BEGINNER',
  "rating" INTEGER NOT NULL DEFAULT 800,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "AcademyProblem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AcademyProgress" (
  "id" TEXT NOT NULL,
  "playerUsername" TEXT NOT NULL,
  "topicId" TEXT NOT NULL,
  "completed" INTEGER NOT NULL DEFAULT 0,
  "total" INTEGER NOT NULL DEFAULT 0,
  "lastPracticedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AcademyProgress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PlayerTopicStat" (
  "id" TEXT NOT NULL,
  "playerUsername" TEXT NOT NULL,
  "topicId" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "solved" INTEGER NOT NULL DEFAULT 0,
  "strengthScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlayerTopicStat_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TrainingRecommendation" (
  "id" TEXT NOT NULL,
  "playerUsername" TEXT NOT NULL,
  "topicId" TEXT,
  "problemId" TEXT,
  "reason" TEXT NOT NULL,
  "nextDifficulty" "AcademyDifficulty" NOT NULL DEFAULT 'BEGINNER',
  "priority" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TrainingRecommendation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Season" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SeasonStanding" (
  "id" TEXT NOT NULL,
  "seasonId" TEXT NOT NULL,
  "playerUsername" TEXT NOT NULL,
  "rank" INTEGER NOT NULL,
  "points" INTEGER NOT NULL DEFAULT 0,
  "contests" INTEGER NOT NULL DEFAULT 0,
  "wins" INTEGER NOT NULL DEFAULT 0,
  "solved" INTEGER NOT NULL DEFAULT 0,
  "rating" INTEGER NOT NULL DEFAULT 1200,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeasonStanding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Team" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "institutionId" TEXT,
  "rating" INTEGER NOT NULL DEFAULT 1200,
  "points" INTEGER NOT NULL DEFAULT 0,
  "wins" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TeamMembership" (
  "id" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "playerUsername" TEXT NOT NULL,
  "role" "TeamRole" NOT NULL DEFAULT 'MEMBER',
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeamMembership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TeamStanding" (
  "id" TEXT NOT NULL,
  "seasonId" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "rank" INTEGER NOT NULL,
  "points" INTEGER NOT NULL DEFAULT 0,
  "rating" INTEGER NOT NULL DEFAULT 1200,
  "wins" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeamStanding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TeamAchievement" (
  "id" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeamAchievement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ContestEditorial" (
  "id" TEXT NOT NULL,
  "contestId" TEXT NOT NULL,
  "content" TEXT NOT NULL DEFAULT '',
  "resources" JSONB NOT NULL DEFAULT '[]',
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContestEditorial_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EditorialRevision" (
  "id" TEXT NOT NULL,
  "editorialId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EditorialRevision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DiscussionThread" (
  "id" TEXT NOT NULL,
  "scope" "DiscussionScope" NOT NULL DEFAULT 'GENERAL',
  "contestId" TEXT,
  "problemCode" TEXT,
  "title" TEXT NOT NULL,
  "status" "ModerationStatus" NOT NULL DEFAULT 'APPROVED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DiscussionThread_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DiscussionPost" (
  "id" TEXT NOT NULL,
  "threadId" TEXT NOT NULL,
  "author" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "status" "ModerationStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DiscussionPost_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Institution_slug_key" ON "Institution"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "AcademyTopic_slug_key" ON "AcademyTopic"("slug");
CREATE INDEX IF NOT EXISTS "AcademyTopic_sortOrder_idx" ON "AcademyTopic"("sortOrder");
CREATE INDEX IF NOT EXISTS "AcademyResource_topicId_sortOrder_idx" ON "AcademyResource"("topicId", "sortOrder");
CREATE INDEX IF NOT EXISTS "AcademyProblem_topicId_difficulty_sortOrder_idx" ON "AcademyProblem"("topicId", "difficulty", "sortOrder");
CREATE UNIQUE INDEX IF NOT EXISTS "AcademyProgress_playerUsername_topicId_key" ON "AcademyProgress"("playerUsername", "topicId");
CREATE INDEX IF NOT EXISTS "AcademyProgress_topicId_updatedAt_idx" ON "AcademyProgress"("topicId", "updatedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "PlayerTopicStat_playerUsername_topicId_key" ON "PlayerTopicStat"("playerUsername", "topicId");
CREATE INDEX IF NOT EXISTS "PlayerTopicStat_playerUsername_strengthScore_idx" ON "PlayerTopicStat"("playerUsername", "strengthScore");
CREATE INDEX IF NOT EXISTS "TrainingRecommendation_playerUsername_priority_idx" ON "TrainingRecommendation"("playerUsername", "priority");
CREATE INDEX IF NOT EXISTS "TrainingRecommendation_topicId_idx" ON "TrainingRecommendation"("topicId");
CREATE UNIQUE INDEX IF NOT EXISTS "Season_slug_key" ON "Season"("slug");
CREATE INDEX IF NOT EXISTS "Season_startsAt_endsAt_idx" ON "Season"("startsAt", "endsAt");
CREATE UNIQUE INDEX IF NOT EXISTS "SeasonStanding_seasonId_playerUsername_key" ON "SeasonStanding"("seasonId", "playerUsername");
CREATE INDEX IF NOT EXISTS "SeasonStanding_seasonId_rank_idx" ON "SeasonStanding"("seasonId", "rank");
CREATE INDEX IF NOT EXISTS "SeasonStanding_playerUsername_idx" ON "SeasonStanding"("playerUsername");
CREATE UNIQUE INDEX IF NOT EXISTS "Team_slug_key" ON "Team"("slug");
CREATE INDEX IF NOT EXISTS "Team_rating_idx" ON "Team"("rating");
CREATE INDEX IF NOT EXISTS "Team_points_idx" ON "Team"("points");
CREATE INDEX IF NOT EXISTS "Team_institutionId_idx" ON "Team"("institutionId");
CREATE UNIQUE INDEX IF NOT EXISTS "TeamMembership_teamId_playerUsername_key" ON "TeamMembership"("teamId", "playerUsername");
CREATE INDEX IF NOT EXISTS "TeamMembership_playerUsername_idx" ON "TeamMembership"("playerUsername");
CREATE UNIQUE INDEX IF NOT EXISTS "TeamStanding_seasonId_teamId_key" ON "TeamStanding"("seasonId", "teamId");
CREATE INDEX IF NOT EXISTS "TeamStanding_seasonId_rank_idx" ON "TeamStanding"("seasonId", "rank");
CREATE UNIQUE INDEX IF NOT EXISTS "TeamAchievement_teamId_code_key" ON "TeamAchievement"("teamId", "code");
CREATE UNIQUE INDEX IF NOT EXISTS "ContestEditorial_contestId_key" ON "ContestEditorial"("contestId");
CREATE UNIQUE INDEX IF NOT EXISTS "EditorialRevision_editorialId_version_key" ON "EditorialRevision"("editorialId", "version");
CREATE INDEX IF NOT EXISTS "DiscussionThread_scope_status_updatedAt_idx" ON "DiscussionThread"("scope", "status", "updatedAt");
CREATE INDEX IF NOT EXISTS "DiscussionThread_contestId_idx" ON "DiscussionThread"("contestId");
CREATE INDEX IF NOT EXISTS "DiscussionPost_threadId_status_createdAt_idx" ON "DiscussionPost"("threadId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "Player_institutionId_idx" ON "Player"("institutionId");
CREATE INDEX IF NOT EXISTS "Contest_seasonId_idx" ON "Contest"("seasonId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Player_institutionId_fkey') THEN
    ALTER TABLE "Player" ADD CONSTRAINT "Player_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Contest_seasonId_fkey') THEN
    ALTER TABLE "Contest" ADD CONSTRAINT "Contest_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AcademyResource_topicId_fkey') THEN
    ALTER TABLE "AcademyResource" ADD CONSTRAINT "AcademyResource_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "AcademyTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AcademyProblem_topicId_fkey') THEN
    ALTER TABLE "AcademyProblem" ADD CONSTRAINT "AcademyProblem_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "AcademyTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AcademyProgress_playerUsername_fkey') THEN
    ALTER TABLE "AcademyProgress" ADD CONSTRAINT "AcademyProgress_playerUsername_fkey" FOREIGN KEY ("playerUsername") REFERENCES "Player"("username") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AcademyProgress_topicId_fkey') THEN
    ALTER TABLE "AcademyProgress" ADD CONSTRAINT "AcademyProgress_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "AcademyTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PlayerTopicStat_playerUsername_fkey') THEN
    ALTER TABLE "PlayerTopicStat" ADD CONSTRAINT "PlayerTopicStat_playerUsername_fkey" FOREIGN KEY ("playerUsername") REFERENCES "Player"("username") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PlayerTopicStat_topicId_fkey') THEN
    ALTER TABLE "PlayerTopicStat" ADD CONSTRAINT "PlayerTopicStat_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "AcademyTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TrainingRecommendation_playerUsername_fkey') THEN
    ALTER TABLE "TrainingRecommendation" ADD CONSTRAINT "TrainingRecommendation_playerUsername_fkey" FOREIGN KEY ("playerUsername") REFERENCES "Player"("username") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TrainingRecommendation_topicId_fkey') THEN
    ALTER TABLE "TrainingRecommendation" ADD CONSTRAINT "TrainingRecommendation_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "AcademyTopic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SeasonStanding_seasonId_fkey') THEN
    ALTER TABLE "SeasonStanding" ADD CONSTRAINT "SeasonStanding_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SeasonStanding_playerUsername_fkey') THEN
    ALTER TABLE "SeasonStanding" ADD CONSTRAINT "SeasonStanding_playerUsername_fkey" FOREIGN KEY ("playerUsername") REFERENCES "Player"("username") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Team_institutionId_fkey') THEN
    ALTER TABLE "Team" ADD CONSTRAINT "Team_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TeamMembership_teamId_fkey') THEN
    ALTER TABLE "TeamMembership" ADD CONSTRAINT "TeamMembership_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TeamMembership_playerUsername_fkey') THEN
    ALTER TABLE "TeamMembership" ADD CONSTRAINT "TeamMembership_playerUsername_fkey" FOREIGN KEY ("playerUsername") REFERENCES "Player"("username") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TeamStanding_seasonId_fkey') THEN
    ALTER TABLE "TeamStanding" ADD CONSTRAINT "TeamStanding_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TeamStanding_teamId_fkey') THEN
    ALTER TABLE "TeamStanding" ADD CONSTRAINT "TeamStanding_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TeamAchievement_teamId_fkey') THEN
    ALTER TABLE "TeamAchievement" ADD CONSTRAINT "TeamAchievement_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ContestEditorial_contestId_fkey') THEN
    ALTER TABLE "ContestEditorial" ADD CONSTRAINT "ContestEditorial_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EditorialRevision_editorialId_fkey') THEN
    ALTER TABLE "EditorialRevision" ADD CONSTRAINT "EditorialRevision_editorialId_fkey" FOREIGN KEY ("editorialId") REFERENCES "ContestEditorial"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DiscussionThread_contestId_fkey') THEN
    ALTER TABLE "DiscussionThread" ADD CONSTRAINT "DiscussionThread_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DiscussionPost_threadId_fkey') THEN
    ALTER TABLE "DiscussionPost" ADD CONSTRAINT "DiscussionPost_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "DiscussionThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

INSERT INTO "Season" ("id", "name", "slug", "startsAt", "endsAt")
VALUES
  ('season-1', 'Season 1', 'season-1', '2026-01-01T00:00:00Z', '2026-04-30T23:59:59Z'),
  ('season-2', 'Season 2', 'season-2', '2026-05-01T00:00:00Z', '2026-08-31T23:59:59Z'),
  ('season-3', 'Season 3', 'season-3', '2026-09-01T00:00:00Z', '2026-12-31T23:59:59Z')
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "AcademyTopic" ("id", "slug", "title", "overview", "sortOrder")
VALUES
  ('implementation', 'implementation', 'Implementation', 'Translate statements into clean code with careful edge-case handling.', 1),
  ('greedy', 'greedy', 'Greedy', 'Choose locally optimal moves and prove they compose into a global optimum.', 2),
  ('binary-search', 'binary-search', 'Binary Search', 'Use monotonic predicates and search spaces to find exact thresholds.', 3),
  ('prefix-sum', 'prefix-sum', 'Prefix Sum', 'Precompute cumulative information for constant-time range queries.', 4),
  ('two-pointers', 'two-pointers', 'Two Pointers', 'Scan ordered structures with moving boundaries.', 5),
  ('sliding-window', 'sliding-window', 'Sliding Window', 'Maintain dynamic windows over arrays and strings.', 6),
  ('trees', 'trees', 'Trees', 'Reason over rooted and unrooted tree structure.', 7),
  ('graphs', 'graphs', 'Graphs', 'Model states and relationships with vertices and edges.', 8),
  ('dfs', 'dfs', 'DFS', 'Explore depth-first for components, trees, and backtracking.', 9),
  ('bfs', 'bfs', 'BFS', 'Explore shortest unweighted distances and layers.', 10),
  ('dp', 'dp', 'DP', 'Break problems into reusable states and transitions.', 11),
  ('bitmasking', 'bitmasking', 'Bitmasking', 'Represent sets and states compactly with bits.', 12),
  ('number-theory', 'number-theory', 'Number Theory', 'Use divisibility, primes, modular arithmetic, and gcd structure.', 13),
  ('strings', 'strings', 'Strings', 'Process textual patterns, hashes, prefixes, and matching.', 14)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "overview" = EXCLUDED."overview", "sortOrder" = EXCLUDED."sortOrder";

INSERT INTO "AcademyResource" ("id", "topicId", "title", "url", "kind", "sortOrder")
VALUES
  ('resource-implementation-guide', 'implementation', 'Implementation Checklist', 'https://cp-algorithms.com/', 'ARTICLE', 1),
  ('resource-greedy-guide', 'greedy', 'Greedy Proof Patterns', 'https://cp-algorithms.com/', 'ARTICLE', 1),
  ('resource-binary-search-guide', 'binary-search', 'Binary Search on Answer', 'https://cp-algorithms.com/num_methods/binary_search.html', 'ARTICLE', 1),
  ('resource-prefix-sum-guide', 'prefix-sum', 'Prefix Sum Notes', 'https://cp-algorithms.com/', 'ARTICLE', 1),
  ('resource-two-pointers-guide', 'two-pointers', 'Two Pointers Practice', 'https://cp-algorithms.com/', 'ARTICLE', 1),
  ('resource-sliding-window-guide', 'sliding-window', 'Sliding Window Patterns', 'https://cp-algorithms.com/', 'ARTICLE', 1),
  ('resource-trees-guide', 'trees', 'Tree Algorithms', 'https://cp-algorithms.com/graph/depth-first-search.html', 'ARTICLE', 1),
  ('resource-graphs-guide', 'graphs', 'Graph Algorithms', 'https://cp-algorithms.com/graph/breadth-first-search.html', 'ARTICLE', 1),
  ('resource-dfs-guide', 'dfs', 'DFS Notes', 'https://cp-algorithms.com/graph/depth-first-search.html', 'ARTICLE', 1),
  ('resource-bfs-guide', 'bfs', 'BFS Notes', 'https://cp-algorithms.com/graph/breadth-first-search.html', 'ARTICLE', 1),
  ('resource-dp-guide', 'dp', 'Dynamic Programming Intro', 'https://cp-algorithms.com/dynamic_programming/intro-to-dp.html', 'ARTICLE', 1),
  ('resource-bitmasking-guide', 'bitmasking', 'Bitmask DP Patterns', 'https://cp-algorithms.com/algebra/all-submasks.html', 'ARTICLE', 1),
  ('resource-number-theory-guide', 'number-theory', 'Number Theory Library', 'https://cp-algorithms.com/algebra/euclid-algorithm.html', 'ARTICLE', 1),
  ('resource-strings-guide', 'strings', 'String Algorithms', 'https://cp-algorithms.com/string/prefix-function.html', 'ARTICLE', 1)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "url" = EXCLUDED."url", "kind" = EXCLUDED."kind", "sortOrder" = EXCLUDED."sortOrder";

INSERT INTO "AcademyProblem" ("id", "topicId", "title", "url", "difficulty", "rating", "sortOrder")
VALUES
  ('problem-implementation-beginner', 'implementation', 'Careful Simulation Drill', NULL, 'BEGINNER', 800, 1),
  ('problem-implementation-intermediate', 'implementation', 'Edge Case Construction', NULL, 'INTERMEDIATE', 1200, 2),
  ('problem-implementation-advanced', 'implementation', 'Long Statement Implementation', NULL, 'ADVANCED', 1600, 3),
  ('problem-greedy-beginner', 'greedy', 'Local Choice Warmup', NULL, 'BEGINNER', 900, 1),
  ('problem-greedy-intermediate', 'greedy', 'Exchange Argument Practice', NULL, 'INTERMEDIATE', 1300, 2),
  ('problem-greedy-advanced', 'greedy', 'Greedy with Sorting', NULL, 'ADVANCED', 1700, 3),
  ('problem-binary-search-beginner', 'binary-search', 'Search Boundaries', NULL, 'BEGINNER', 900, 1),
  ('problem-binary-search-intermediate', 'binary-search', 'Monotonic Predicate', NULL, 'INTERMEDIATE', 1400, 2),
  ('problem-binary-search-advanced', 'binary-search', 'Binary Search on Answer', NULL, 'ADVANCED', 1800, 3),
  ('problem-prefix-sum-beginner', 'prefix-sum', 'Range Sum Warmup', NULL, 'BEGINNER', 800, 1),
  ('problem-prefix-sum-intermediate', 'prefix-sum', '2D Prefix Practice', NULL, 'INTERMEDIATE', 1300, 2),
  ('problem-prefix-sum-advanced', 'prefix-sum', 'Difference Array Strategy', NULL, 'ADVANCED', 1600, 3),
  ('problem-two-pointers-beginner', 'two-pointers', 'Sorted Pair Scan', NULL, 'BEGINNER', 900, 1),
  ('problem-two-pointers-intermediate', 'two-pointers', 'Opposite Pointers', NULL, 'INTERMEDIATE', 1300, 2),
  ('problem-two-pointers-advanced', 'two-pointers', 'Invariant Pointers', NULL, 'ADVANCED', 1700, 3),
  ('problem-sliding-window-beginner', 'sliding-window', 'Fixed Window Sum', NULL, 'BEGINNER', 900, 1),
  ('problem-sliding-window-intermediate', 'sliding-window', 'Variable Window', NULL, 'INTERMEDIATE', 1400, 2),
  ('problem-sliding-window-advanced', 'sliding-window', 'Window with Counts', NULL, 'ADVANCED', 1700, 3),
  ('problem-trees-beginner', 'trees', 'Rooted Tree Basics', NULL, 'BEGINNER', 1000, 1),
  ('problem-trees-intermediate', 'trees', 'Subtree Aggregates', NULL, 'INTERMEDIATE', 1500, 2),
  ('problem-trees-advanced', 'trees', 'Rerooting Practice', NULL, 'ADVANCED', 1900, 3),
  ('problem-graphs-beginner', 'graphs', 'Components Warmup', NULL, 'BEGINNER', 1000, 1),
  ('problem-graphs-intermediate', 'graphs', 'Shortest Path Modeling', NULL, 'INTERMEDIATE', 1500, 2),
  ('problem-graphs-advanced', 'graphs', 'State Graph Practice', NULL, 'ADVANCED', 1900, 3),
  ('problem-dfs-beginner', 'dfs', 'Recursive Traversal', NULL, 'BEGINNER', 900, 1),
  ('problem-dfs-intermediate', 'dfs', 'Cycle Detection', NULL, 'INTERMEDIATE', 1400, 2),
  ('problem-dfs-advanced', 'dfs', 'Backtracking States', NULL, 'ADVANCED', 1800, 3),
  ('problem-bfs-beginner', 'bfs', 'Layered Search', NULL, 'BEGINNER', 900, 1),
  ('problem-bfs-intermediate', 'bfs', 'Grid BFS', NULL, 'INTERMEDIATE', 1400, 2),
  ('problem-bfs-advanced', 'bfs', 'Multi-source BFS', NULL, 'ADVANCED', 1800, 3),
  ('problem-dp-beginner', 'dp', 'One-dimensional DP', NULL, 'BEGINNER', 1100, 1),
  ('problem-dp-intermediate', 'dp', 'Knapsack Style DP', NULL, 'INTERMEDIATE', 1600, 2),
  ('problem-dp-advanced', 'dp', 'State Compression DP', NULL, 'ADVANCED', 2100, 3),
  ('problem-bitmasking-beginner', 'bitmasking', 'Subset Enumeration', NULL, 'BEGINNER', 1200, 1),
  ('problem-bitmasking-intermediate', 'bitmasking', 'Mask Transitions', NULL, 'INTERMEDIATE', 1700, 2),
  ('problem-bitmasking-advanced', 'bitmasking', 'Bitmask DP', NULL, 'ADVANCED', 2100, 3),
  ('problem-number-theory-beginner', 'number-theory', 'GCD Warmup', NULL, 'BEGINNER', 900, 1),
  ('problem-number-theory-intermediate', 'number-theory', 'Modular Arithmetic', NULL, 'INTERMEDIATE', 1500, 2),
  ('problem-number-theory-advanced', 'number-theory', 'Prime Factor Strategy', NULL, 'ADVANCED', 1900, 3),
  ('problem-strings-beginner', 'strings', 'String Scanning', NULL, 'BEGINNER', 900, 1),
  ('problem-strings-intermediate', 'strings', 'Prefix Function Practice', NULL, 'INTERMEDIATE', 1500, 2),
  ('problem-strings-advanced', 'strings', 'Hashing and Matching', NULL, 'ADVANCED', 1900, 3)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "difficulty" = EXCLUDED."difficulty", "rating" = EXCLUDED."rating", "sortOrder" = EXCLUDED."sortOrder";
