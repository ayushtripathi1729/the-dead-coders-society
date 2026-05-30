-- Replace legacy base-point scoring with points derived from contest problems.
ALTER TABLE "ContestProblem" ADD COLUMN IF NOT EXISTS "points" INTEGER;

-- Older contests without problem metadata receive a visible, editable A-E placeholder set.
INSERT INTO "ContestProblem" ("id", "contestId", "code", "title", "points", "sortOrder", "createdAt", "updatedAt")
SELECT
  CONCAT('legacy:', contest."id", ':', defaults."code"),
  contest."id",
  defaults."code",
  NULL,
  defaults."points",
  defaults."sortOrder",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Contest" contest
CROSS JOIN (
  VALUES
    ('A', 100, 0),
    ('B', 200, 1),
    ('C', 300, 2),
    ('D', 400, 3),
    ('E', 500, 4)
) AS defaults("code", "points", "sortOrder")
WHERE NOT EXISTS (
  SELECT 1 FROM "ContestProblem" problem WHERE problem."contestId" = contest."id"
)
ON CONFLICT ("contestId", "code") DO NOTHING;

WITH ordered_problems AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (PARTITION BY "contestId" ORDER BY "sortOrder", "code", "id") AS position
  FROM "ContestProblem"
)
UPDATE "ContestProblem" problem
SET "points" = ordered.position * 100
FROM ordered_problems ordered
WHERE problem."id" = ordered."id" AND problem."points" IS NULL;

ALTER TABLE "ContestProblem" ALTER COLUMN "points" SET NOT NULL;

UPDATE "Contest" contest
SET "totalPoints" = totals.points
FROM (
  SELECT "contestId", SUM("points")::INTEGER AS points
  FROM "ContestProblem"
  GROUP BY "contestId"
) totals
WHERE contest."id" = totals."contestId";

ALTER TABLE "Contest" ALTER COLUMN "totalPoints" SET DEFAULT 0;

-- Keep one canonical first-solve relation linked directly to a contest problem.
INSERT INTO "ProblemFirstSolve" ("id", "problemId", "playerId", "createdAt")
SELECT legacy."id", problem."id", legacy."playerId", legacy."createdAt"
FROM "FirstSolve" legacy
JOIN "ContestProblem" problem
  ON problem."contestId" = legacy."contestId"
 AND problem."code" = legacy."problemCode"
ON CONFLICT ("problemId", "playerId") DO NOTHING;

DROP TABLE "FirstSolve";
ALTER TABLE "ProblemFirstSolve" RENAME TO "FirstSolve";
ALTER INDEX "ProblemFirstSolve_problemId_playerId_key" RENAME TO "FirstSolve_problemId_playerId_key";
ALTER INDEX "ProblemFirstSolve_playerId_createdAt_idx" RENAME TO "FirstSolve_playerId_createdAt_idx";
ALTER TABLE "FirstSolve" RENAME CONSTRAINT "ProblemFirstSolve_pkey" TO "FirstSolve_pkey";
ALTER TABLE "FirstSolve" RENAME CONSTRAINT "ProblemFirstSolve_problemId_fkey" TO "FirstSolve_problemId_fkey";
ALTER TABLE "FirstSolve" RENAME CONSTRAINT "ProblemFirstSolve_playerId_fkey" TO "FirstSolve_playerId_fkey";

ALTER TABLE "ContestStanding" RENAME COLUMN "rawScore" TO "contestScore";
ALTER TABLE "ContestStanding" ADD COLUMN "solvedPoints" INTEGER NOT NULL DEFAULT 0;

WITH scored AS (
  SELECT
    standing."id",
    COALESCE(SUM(problem."points") FILTER (WHERE problem.position <= standing."solved"), 0)::INTEGER AS solved_points
  FROM "ContestStanding" standing
  LEFT JOIN (
    SELECT
      "contestId",
      "points",
      ROW_NUMBER() OVER (PARTITION BY "contestId" ORDER BY "sortOrder", "code", "id") AS position
    FROM "ContestProblem"
  ) problem ON problem."contestId" = standing."contestId"
  GROUP BY standing."id"
)
UPDATE "ContestStanding" standing
SET
  "solvedPoints" = scored.solved_points,
  "contestScore" = scored.solved_points - standing."penalty",
  "finalScore" = scored.solved_points - standing."penalty" + standing."bonusPoints"
FROM scored
WHERE standing."id" = scored."id";

UPDATE "ContestParticipation" participation
SET
  "finalRank" = standing."rank",
  "finalScore" = standing."finalScore",
  "solved" = standing."solved",
  "penalty" = standing."penalty"
FROM "ContestStanding" standing
WHERE participation."contestId" = standing."contestId"
  AND participation."playerId" = standing."playerId";
