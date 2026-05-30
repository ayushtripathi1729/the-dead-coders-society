-- Contest lifecycle is derived from startTime + duration at read time.
DROP INDEX IF EXISTS "Contest_status_startTime_idx";
ALTER TABLE "Contest" DROP COLUMN IF EXISTS "status";
DROP TYPE IF EXISTS "ContestStatus";

-- Persist exact per-problem results. Existing count-only rows retain the prior
-- interpretation during migration: the first N ordered problems are solved.
ALTER TABLE "ContestStanding" RENAME COLUMN "solvedPoints" TO "rawScore";
ALTER TABLE "ContestStanding" ADD COLUMN "solveVector" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
ALTER TABLE "ContestStanding" ADD COLUMN "solvedProblems" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

WITH ordered_problems AS (
  SELECT
    "contestId",
    "code",
    "points",
    ROW_NUMBER() OVER (PARTITION BY "contestId" ORDER BY "sortOrder", "code", "id") AS position
  FROM "ContestProblem"
),
vectors AS (
  SELECT
    standing."id",
    COALESCE(ARRAY_AGG(CASE WHEN problem.position <= standing."solved" THEN 1 ELSE 0 END ORDER BY problem.position), ARRAY[]::INTEGER[]) AS solve_vector,
    COALESCE(ARRAY_AGG(problem."code" ORDER BY problem.position) FILTER (WHERE problem.position <= standing."solved"), ARRAY[]::TEXT[]) AS solved_problems,
    COALESCE(SUM(problem."points") FILTER (WHERE problem.position <= standing."solved"), 0)::INTEGER AS raw_score
  FROM "ContestStanding" standing
  LEFT JOIN ordered_problems problem ON problem."contestId" = standing."contestId"
  GROUP BY standing."id"
)
UPDATE "ContestStanding" standing
SET
  "solveVector" = vectors.solve_vector,
  "solvedProblems" = vectors.solved_problems,
  "rawScore" = vectors.raw_score,
  "contestScore" = vectors.raw_score - standing."penalty",
  "finalScore" = vectors.raw_score - standing."penalty" + standing."bonusPoints"
FROM vectors
WHERE standing."id" = vectors."id";

ALTER TABLE "ContestParticipation" ADD COLUMN "solveVector" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
ALTER TABLE "ContestParticipation" ADD COLUMN "solvedProblems" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "ContestParticipation" ADD COLUMN "rawScore" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ContestParticipation" ADD COLUMN "contestScore" INTEGER NOT NULL DEFAULT 0;

UPDATE "ContestParticipation" participation
SET
  "solveVector" = standing."solveVector",
  "solvedProblems" = standing."solvedProblems",
  "rawScore" = standing."rawScore",
  "contestScore" = standing."contestScore",
  "finalRank" = standing."rank",
  "finalScore" = standing."finalScore",
  "solved" = standing."solved",
  "penalty" = standing."penalty"
FROM "ContestStanding" standing
WHERE participation."contestId" = standing."contestId"
  AND participation."playerId" = standing."playerId";

-- Username is the canonical player identity for every player-linked record.
ALTER TABLE "FirstSolve" ADD COLUMN "playerUsername" TEXT;
ALTER TABLE "ContestParticipation" ADD COLUMN "playerUsername" TEXT;
ALTER TABLE "ContestStanding" ADD COLUMN "playerUsername" TEXT;
ALTER TABLE "Achievement" ADD COLUMN "playerUsername" TEXT;
ALTER TABLE "HallOfFame" ADD COLUMN "playerUsername" TEXT;
ALTER TABLE "MonthlyLeaderboard" ADD COLUMN "playerUsername" TEXT;
ALTER TABLE "YearlyLeaderboard" ADD COLUMN "playerUsername" TEXT;
ALTER TABLE "RatingHistory" ADD COLUMN "playerUsername" TEXT;
ALTER TABLE "UploadAsset" ADD COLUMN "playerUsername" TEXT;
ALTER TABLE "Certificate" ADD COLUMN "playerUsername" TEXT;

UPDATE "FirstSolve" row SET "playerUsername" = player."username" FROM "Player" player WHERE row."playerId" = player."id";
UPDATE "ContestParticipation" row SET "playerUsername" = player."username" FROM "Player" player WHERE row."playerId" = player."id";
UPDATE "ContestStanding" row SET "playerUsername" = player."username" FROM "Player" player WHERE row."playerId" = player."id";
UPDATE "Achievement" row SET "playerUsername" = player."username" FROM "Player" player WHERE row."playerId" = player."id";
UPDATE "HallOfFame" row SET "playerUsername" = player."username" FROM "Player" player WHERE row."playerId" = player."id";
UPDATE "MonthlyLeaderboard" row SET "playerUsername" = player."username" FROM "Player" player WHERE row."playerId" = player."id";
UPDATE "YearlyLeaderboard" row SET "playerUsername" = player."username" FROM "Player" player WHERE row."playerId" = player."id";
UPDATE "RatingHistory" row SET "playerUsername" = player."username" FROM "Player" player WHERE row."playerId" = player."id";
UPDATE "UploadAsset" row SET "playerUsername" = player."username" FROM "Player" player WHERE row."playerId" = player."id";
UPDATE "Certificate" row SET "playerUsername" = player."username" FROM "Player" player WHERE row."playerId" = player."id";

ALTER TABLE "FirstSolve" ALTER COLUMN "playerUsername" SET NOT NULL;
ALTER TABLE "ContestParticipation" ALTER COLUMN "playerUsername" SET NOT NULL;
ALTER TABLE "ContestStanding" ALTER COLUMN "playerUsername" SET NOT NULL;
ALTER TABLE "Achievement" ALTER COLUMN "playerUsername" SET NOT NULL;
ALTER TABLE "HallOfFame" ALTER COLUMN "playerUsername" SET NOT NULL;
ALTER TABLE "MonthlyLeaderboard" ALTER COLUMN "playerUsername" SET NOT NULL;
ALTER TABLE "YearlyLeaderboard" ALTER COLUMN "playerUsername" SET NOT NULL;
ALTER TABLE "RatingHistory" ALTER COLUMN "playerUsername" SET NOT NULL;

DROP INDEX IF EXISTS "FirstSolve_problemId_playerId_key";
DROP INDEX IF EXISTS "FirstSolve_playerId_createdAt_idx";
DROP INDEX IF EXISTS "ContestParticipation_contestId_playerId_key";
DROP INDEX IF EXISTS "ContestParticipation_playerId_joinedAt_idx";
DROP INDEX IF EXISTS "ContestStanding_contestId_playerId_key";
DROP INDEX IF EXISTS "ContestStanding_playerId_finalScore_idx";
DROP INDEX IF EXISTS "Achievement_playerId_earnedAt_idx";
DROP INDEX IF EXISTS "HallOfFame_playerId_idx";
DROP INDEX IF EXISTS "MonthlyLeaderboard_playerId_year_month_key";
DROP INDEX IF EXISTS "YearlyLeaderboard_playerId_year_key";
DROP INDEX IF EXISTS "RatingHistory_playerId_createdAt_idx";
DROP INDEX IF EXISTS "UploadAsset_playerId_idx";
DROP INDEX IF EXISTS "Certificate_playerId_issuedAt_idx";

ALTER TABLE "FirstSolve" DROP COLUMN "playerId" CASCADE;
ALTER TABLE "ContestParticipation" DROP COLUMN "playerId" CASCADE;
ALTER TABLE "ContestStanding" DROP COLUMN "playerId" CASCADE;
ALTER TABLE "Achievement" DROP COLUMN "playerId" CASCADE;
ALTER TABLE "HallOfFame" DROP COLUMN "playerId" CASCADE;
ALTER TABLE "MonthlyLeaderboard" DROP COLUMN "playerId" CASCADE;
ALTER TABLE "YearlyLeaderboard" DROP COLUMN "playerId" CASCADE;
ALTER TABLE "RatingHistory" DROP COLUMN "playerId" CASCADE;
ALTER TABLE "UploadAsset" DROP COLUMN "playerId" CASCADE;
ALTER TABLE "Certificate" DROP COLUMN "playerId" CASCADE;

ALTER TABLE "FirstSolve" ADD CONSTRAINT "FirstSolve_playerUsername_fkey" FOREIGN KEY ("playerUsername") REFERENCES "Player"("username") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContestParticipation" ADD CONSTRAINT "ContestParticipation_playerUsername_fkey" FOREIGN KEY ("playerUsername") REFERENCES "Player"("username") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContestStanding" ADD CONSTRAINT "ContestStanding_playerUsername_fkey" FOREIGN KEY ("playerUsername") REFERENCES "Player"("username") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_playerUsername_fkey" FOREIGN KEY ("playerUsername") REFERENCES "Player"("username") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HallOfFame" ADD CONSTRAINT "HallOfFame_playerUsername_fkey" FOREIGN KEY ("playerUsername") REFERENCES "Player"("username") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MonthlyLeaderboard" ADD CONSTRAINT "MonthlyLeaderboard_playerUsername_fkey" FOREIGN KEY ("playerUsername") REFERENCES "Player"("username") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "YearlyLeaderboard" ADD CONSTRAINT "YearlyLeaderboard_playerUsername_fkey" FOREIGN KEY ("playerUsername") REFERENCES "Player"("username") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RatingHistory" ADD CONSTRAINT "RatingHistory_playerUsername_fkey" FOREIGN KEY ("playerUsername") REFERENCES "Player"("username") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UploadAsset" ADD CONSTRAINT "UploadAsset_playerUsername_fkey" FOREIGN KEY ("playerUsername") REFERENCES "Player"("username") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_playerUsername_fkey" FOREIGN KEY ("playerUsername") REFERENCES "Player"("username") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "FirstSolve_problemId_playerUsername_key" ON "FirstSolve"("problemId", "playerUsername");
CREATE INDEX "FirstSolve_playerUsername_createdAt_idx" ON "FirstSolve"("playerUsername", "createdAt");
CREATE UNIQUE INDEX "ContestParticipation_contestId_playerUsername_key" ON "ContestParticipation"("contestId", "playerUsername");
CREATE INDEX "ContestParticipation_playerUsername_joinedAt_idx" ON "ContestParticipation"("playerUsername", "joinedAt");
CREATE UNIQUE INDEX "ContestStanding_contestId_playerUsername_key" ON "ContestStanding"("contestId", "playerUsername");
CREATE INDEX "ContestStanding_playerUsername_finalScore_idx" ON "ContestStanding"("playerUsername", "finalScore");
CREATE INDEX "Achievement_playerUsername_earnedAt_idx" ON "Achievement"("playerUsername", "earnedAt");
CREATE INDEX "HallOfFame_playerUsername_idx" ON "HallOfFame"("playerUsername");
CREATE UNIQUE INDEX "MonthlyLeaderboard_playerUsername_year_month_key" ON "MonthlyLeaderboard"("playerUsername", "year", "month");
CREATE UNIQUE INDEX "YearlyLeaderboard_playerUsername_year_key" ON "YearlyLeaderboard"("playerUsername", "year");
CREATE INDEX "RatingHistory_playerUsername_createdAt_idx" ON "RatingHistory"("playerUsername", "createdAt");
CREATE INDEX "UploadAsset_playerUsername_idx" ON "UploadAsset"("playerUsername");
CREATE INDEX "Certificate_playerUsername_issuedAt_idx" ON "Certificate"("playerUsername", "issuedAt");
