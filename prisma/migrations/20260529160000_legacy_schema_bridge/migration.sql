-- Bridge the original prototype schema into the production model names used by
-- later migrations. Every block is intentionally idempotent so this migration is
-- safe to resolve/apply on databases that were already advanced by db push.

DO $$
BEGIN
  IF to_regclass('"User"') IS NOT NULL AND to_regclass('"Admin"') IS NULL THEN
    ALTER TABLE "User" RENAME TO "Admin";
  END IF;
END $$;

ALTER TABLE IF EXISTS "Admin" DROP COLUMN IF EXISTS "role";
ALTER TABLE IF EXISTS "Admin" RENAME CONSTRAINT "User_pkey" TO "Admin_pkey";
ALTER INDEX IF EXISTS "User_email_key" RENAME TO "Admin_email_key";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ContestVisibility') THEN
    CREATE TYPE "ContestVisibility" AS ENUM ('PUBLIC', 'PRIVATE', 'ARCHIVED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UploadAssetKind') THEN
    CREATE TYPE "UploadAssetKind" AS ENUM ('POSTER', 'INVITE_POSTER', 'BANNER', 'CERTIFICATE', 'PROFILE_IMAGE', 'LOGO', 'EDITORIAL');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CertificateType') THEN
    CREATE TYPE "CertificateType" AS ENUM ('PARTICIPATION', 'WINNER', 'CONTEST');
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Player' AND column_name = 'avatarUrl')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Player' AND column_name = 'avatar') THEN
    ALTER TABLE "Player" RENAME COLUMN "avatarUrl" TO "avatar";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Player' AND column_name = 'rating')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Player' AND column_name = 'currentRating') THEN
    ALTER TABLE "Player" RENAME COLUMN "rating" TO "currentRating";
  END IF;
END $$;

ALTER TABLE "Player" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "Player" ADD COLUMN IF NOT EXISTS "branchCourse" TEXT;
ALTER TABLE "Player" ADD COLUMN IF NOT EXISTS "peakRating" INTEGER NOT NULL DEFAULT 1200;
ALTER TABLE "Player" ADD COLUMN IF NOT EXISTS "monthlyRank" INTEGER;
ALTER TABLE "Player" ADD COLUMN IF NOT EXISTS "yearlyRank" INTEGER;
ALTER TABLE "Player" ADD COLUMN IF NOT EXISTS "contestsPlayed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Player" ADD COLUMN IF NOT EXISTS "totalSolved" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Player" ADD COLUMN IF NOT EXISTS "totalScore" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Player" ADD COLUMN IF NOT EXISTS "wins" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Player" ADD COLUMN IF NOT EXISTS "podiums" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Player" ADD COLUMN IF NOT EXISTS "firstSolves" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Player" ADD COLUMN IF NOT EXISTS "averageRank" DOUBLE PRECISION;
ALTER TABLE "Player" ADD COLUMN IF NOT EXISTS "bestRank" INTEGER;
UPDATE "Player" SET "peakRating" = GREATEST("peakRating", "currentRating") WHERE "currentRating" IS NOT NULL;
DROP INDEX IF EXISTS "Player_rating_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "Player_email_key" ON "Player"("email");
CREATE INDEX IF NOT EXISTS "Player_currentRating_idx" ON "Player"("currentRating");
CREATE INDEX IF NOT EXISTS "Player_monthlyRank_idx" ON "Player"("monthlyRank");
CREATE INDEX IF NOT EXISTS "Player_yearlyRank_idx" ON "Player"("yearlyRank");

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Contest' AND column_name = 'startsAt')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Contest' AND column_name = 'startTime') THEN
    ALTER TABLE "Contest" RENAME COLUMN "startsAt" TO "startTime";
  END IF;
END $$;

ALTER TABLE "Contest" ADD COLUMN IF NOT EXISTS "invitePoster" TEXT;
ALTER TABLE "Contest" ADD COLUMN IF NOT EXISTS "contestBanner" TEXT;
ALTER TABLE "Contest" ADD COLUMN IF NOT EXISTS "platform" TEXT NOT NULL DEFAULT 'Codeforces';
ALTER TABLE "Contest" ADD COLUMN IF NOT EXISTS "contestLink" TEXT;
ALTER TABLE "Contest" ADD COLUMN IF NOT EXISTS "duration" INTEGER NOT NULL DEFAULT 120;
ALTER TABLE "Contest" ADD COLUMN IF NOT EXISTS "visibility" "ContestVisibility" NOT NULL DEFAULT 'PUBLIC';
ALTER TABLE "Contest" ADD COLUMN IF NOT EXISTS "scoringSystem" TEXT NOT NULL DEFAULT 'TDCS_ELO_V1';
ALTER TABLE "Contest" ADD COLUMN IF NOT EXISTS "prizePool" TEXT;
ALTER TABLE "Contest" ADD COLUMN IF NOT EXISTS "createdById" TEXT;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Contest' AND column_name = 'invitationUrl') THEN
    UPDATE "Contest" SET "invitePoster" = COALESCE("invitePoster", "invitationUrl");
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Contest' AND column_name = 'posterUrl') THEN
    UPDATE "Contest" SET "invitePoster" = COALESCE("invitePoster", "posterUrl");
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Contest' AND column_name = 'bannerUrl') THEN
    UPDATE "Contest" SET "contestBanner" = COALESCE("contestBanner", "bannerUrl");
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Contest' AND column_name = 'codeforcesUrl') THEN
    UPDATE "Contest" SET "contestLink" = COALESCE("contestLink", "codeforcesUrl");
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Contest' AND column_name = 'endsAt') THEN
    UPDATE "Contest"
    SET "duration" = GREATEST(1, CEIL(EXTRACT(EPOCH FROM ("endsAt" - "startTime")) / 60.0)::INTEGER)
    WHERE "endsAt" IS NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Contest' AND column_name = 'isArchived')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Contest' AND column_name = 'isHidden') THEN
    UPDATE "Contest"
    SET "visibility" = CASE
      WHEN "isArchived" THEN 'ARCHIVED'::"ContestVisibility"
      WHEN "isHidden" THEN 'PRIVATE'::"ContestVisibility"
      ELSE 'PUBLIC'::"ContestVisibility"
    END;
  END IF;
END $$;

ALTER TABLE "Contest" DROP COLUMN IF EXISTS "posterUrl";
ALTER TABLE "Contest" DROP COLUMN IF EXISTS "bannerUrl";
ALTER TABLE "Contest" DROP COLUMN IF EXISTS "invitationUrl";
ALTER TABLE "Contest" DROP COLUMN IF EXISTS "certificateUrl";
ALTER TABLE "Contest" DROP COLUMN IF EXISTS "codeforcesUrl";
ALTER TABLE "Contest" DROP COLUMN IF EXISTS "editorialUrl";
ALTER TABLE "Contest" DROP COLUMN IF EXISTS "endsAt";
ALTER TABLE "Contest" DROP COLUMN IF EXISTS "isSurprise";
ALTER TABLE "Contest" DROP COLUMN IF EXISTS "isHidden";
ALTER TABLE "Contest" DROP COLUMN IF EXISTS "isArchived";
DROP INDEX IF EXISTS "Contest_isHidden_startsAt_idx";
DROP INDEX IF EXISTS "Contest_status_startsAt_idx";
CREATE INDEX IF NOT EXISTS "Contest_visibility_startTime_idx" ON "Contest"("visibility", "startTime");
CREATE INDEX IF NOT EXISTS "Contest_createdById_idx" ON "Contest"("createdById");
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Contest_createdById_fkey') THEN
    ALTER TABLE "Contest" ADD CONSTRAINT "Contest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('"Standing"') IS NOT NULL AND to_regclass('"ContestStanding"') IS NULL THEN
    ALTER TABLE "Standing" RENAME TO "ContestStanding";
  END IF;
END $$;

ALTER TABLE IF EXISTS "ContestStanding" RENAME CONSTRAINT "Standing_pkey" TO "ContestStanding_pkey";
ALTER TABLE IF EXISTS "ContestStanding" RENAME CONSTRAINT "Standing_contestId_fkey" TO "ContestStanding_contestId_fkey";
ALTER TABLE IF EXISTS "ContestStanding" RENAME CONSTRAINT "Standing_playerId_fkey" TO "ContestStanding_playerId_fkey";
DROP INDEX IF EXISTS "Standing_rank_idx";
DROP INDEX IF EXISTS "Standing_contestId_rank_idx";
DROP INDEX IF EXISTS "Standing_playerId_finalScore_idx";
DROP INDEX IF EXISTS "Standing_contestId_playerId_key";
CREATE INDEX IF NOT EXISTS "ContestStanding_rank_idx" ON "ContestStanding"("rank");
CREATE INDEX IF NOT EXISTS "ContestStanding_contestId_rank_idx" ON "ContestStanding"("contestId", "rank");
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ContestStanding' AND column_name = 'playerId') THEN
    CREATE INDEX IF NOT EXISTS "ContestStanding_playerId_finalScore_idx" ON "ContestStanding"("playerId", "finalScore");
    CREATE UNIQUE INDEX IF NOT EXISTS "ContestStanding_contestId_playerId_key" ON "ContestStanding"("contestId", "playerId");
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('"Problem"') IS NOT NULL THEN
    EXECUTE $bridge$
      INSERT INTO "ContestProblem" ("id", "contestId", "code", "title", "sortOrder", "createdAt", "updatedAt")
      SELECT "id", "contestId", "index", "title", 0, "createdAt", "createdAt"
      FROM "Problem"
      ON CONFLICT ("contestId", "code") DO NOTHING
    $bridge$;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('"ProblemFirst"') IS NOT NULL AND to_regclass('"FirstSolve"') IS NOT NULL THEN
    INSERT INTO "FirstSolve" ("id", "contestId", "problemCode", "playerId", "timestamp", "pointsAwarded", "createdAt")
    SELECT "id", "contestId", "problemCode", "playerId", COALESCE("solvedAt", CURRENT_TIMESTAMP), 0, COALESCE("solvedAt", CURRENT_TIMESTAMP)
    FROM "ProblemFirst"
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

DROP TABLE IF EXISTS "ProblemFirst" CASCADE;
DROP TABLE IF EXISTS "Problem" CASCADE;

CREATE TABLE IF NOT EXISTS "ContestParticipation" (
  "id" TEXT NOT NULL,
  "contestId" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finalRank" INTEGER,
  "finalScore" INTEGER NOT NULL DEFAULT 0,
  "solved" INTEGER NOT NULL DEFAULT 0,
  "penalty" INTEGER NOT NULL DEFAULT 0,
  "ratingDelta" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "ContestParticipation_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ContestStanding' AND column_name = 'playerId')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ContestParticipation' AND column_name = 'playerId') THEN
    EXECUTE $bridge$
      INSERT INTO "ContestParticipation" ("id", "contestId", "playerId", "finalRank", "finalScore", "solved", "penalty")
      SELECT CONCAT('participation:', "contestId", ':', "playerId"), "contestId", "playerId", "rank", "finalScore", "solved", "penalty"
      FROM "ContestStanding"
      ON CONFLICT ("id") DO NOTHING
    $bridge$;
    CREATE UNIQUE INDEX IF NOT EXISTS "ContestParticipation_contestId_playerId_key" ON "ContestParticipation"("contestId", "playerId");
    CREATE INDEX IF NOT EXISTS "ContestParticipation_playerId_joinedAt_idx" ON "ContestParticipation"("playerId", "joinedAt");
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "ContestParticipation_contestId_finalRank_idx" ON "ContestParticipation"("contestId", "finalRank");
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ContestParticipation_contestId_fkey') THEN
    ALTER TABLE "ContestParticipation" ADD CONSTRAINT "ContestParticipation_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ContestParticipation' AND column_name = 'playerId')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ContestParticipation_playerId_fkey') THEN
    ALTER TABLE "ContestParticipation" ADD CONSTRAINT "ContestParticipation_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "HallOfFame" (
  "id" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "contestId" TEXT,
  "title" TEXT NOT NULL,
  "score" INTEGER NOT NULL DEFAULT 0,
  "badges" TEXT NOT NULL DEFAULT '[]',
  "specialTitles" TEXT NOT NULL DEFAULT '[]',
  "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HallOfFame_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "HallOfFame_awardedAt_idx" ON "HallOfFame"("awardedAt");
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'HallOfFame' AND column_name = 'playerId') THEN
    CREATE INDEX IF NOT EXISTS "HallOfFame_playerId_idx" ON "HallOfFame"("playerId");
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'HallOfFame' AND column_name = 'playerId')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'HallOfFame_playerId_fkey') THEN
    ALTER TABLE "HallOfFame" ADD CONSTRAINT "HallOfFame_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'HallOfFame_contestId_fkey') THEN
    ALTER TABLE "HallOfFame" ADD CONSTRAINT "HallOfFame_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('"MonthlyRanking"') IS NOT NULL AND to_regclass('"MonthlyLeaderboard"') IS NULL THEN
    ALTER TABLE "MonthlyRanking" RENAME TO "MonthlyLeaderboard";
  END IF;
  IF to_regclass('"YearlyRanking"') IS NOT NULL AND to_regclass('"YearlyLeaderboard"') IS NULL THEN
    ALTER TABLE "YearlyRanking" RENAME TO "YearlyLeaderboard";
  END IF;
  IF to_regclass('"Rating"') IS NOT NULL AND to_regclass('"RatingHistory"') IS NULL THEN
    ALTER TABLE "Rating" RENAME TO "RatingHistory";
  END IF;
  IF to_regclass('"Upload"') IS NOT NULL AND to_regclass('"UploadAsset"') IS NULL THEN
    ALTER TABLE "Upload" RENAME TO "UploadAsset";
  END IF;
END $$;

ALTER TABLE IF EXISTS "MonthlyLeaderboard" RENAME CONSTRAINT "MonthlyRanking_pkey" TO "MonthlyLeaderboard_pkey";
ALTER TABLE IF EXISTS "YearlyLeaderboard" RENAME CONSTRAINT "YearlyRanking_pkey" TO "YearlyLeaderboard_pkey";
ALTER TABLE IF EXISTS "RatingHistory" RENAME CONSTRAINT "Rating_pkey" TO "RatingHistory_pkey";
ALTER TABLE IF EXISTS "UploadAsset" RENAME CONSTRAINT "Upload_pkey" TO "UploadAsset_pkey";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'MonthlyLeaderboard' AND column_name = 'score')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'MonthlyLeaderboard' AND column_name = 'totalScore') THEN
    ALTER TABLE "MonthlyLeaderboard" RENAME COLUMN "score" TO "totalScore";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'YearlyLeaderboard' AND column_name = 'score')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'YearlyLeaderboard' AND column_name = 'totalScore') THEN
    ALTER TABLE "YearlyLeaderboard" RENAME COLUMN "score" TO "totalScore";
  END IF;
END $$;

ALTER TABLE "MonthlyLeaderboard" ADD COLUMN IF NOT EXISTS "contests" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "MonthlyLeaderboard" ADD COLUMN IF NOT EXISTS "wins" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "MonthlyLeaderboard" ADD COLUMN IF NOT EXISTS "solved" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "MonthlyLeaderboard" ADD COLUMN IF NOT EXISTS "firstSolves" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "MonthlyLeaderboard" ADD COLUMN IF NOT EXISTS "averageRank" DOUBLE PRECISION;
ALTER TABLE "MonthlyLeaderboard" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "YearlyLeaderboard" ADD COLUMN IF NOT EXISTS "contests" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "YearlyLeaderboard" ADD COLUMN IF NOT EXISTS "wins" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "YearlyLeaderboard" ADD COLUMN IF NOT EXISTS "solved" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "YearlyLeaderboard" ADD COLUMN IF NOT EXISTS "firstSolves" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "YearlyLeaderboard" ADD COLUMN IF NOT EXISTS "averageRank" DOUBLE PRECISION;
ALTER TABLE "YearlyLeaderboard" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE IF EXISTS "RatingHistory" RENAME CONSTRAINT "Rating_playerId_fkey" TO "RatingHistory_playerId_fkey";
ALTER INDEX IF EXISTS "Rating_playerId_createdAt_idx" RENAME TO "RatingHistory_playerId_createdAt_idx";
CREATE INDEX IF NOT EXISTS "RatingHistory_contestId_idx" ON "RatingHistory"("contestId");
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RatingHistory_contestId_fkey') THEN
    ALTER TABLE "RatingHistory" ADD CONSTRAINT "RatingHistory_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'UploadAsset' AND column_name = 'playerUsername') THEN
    ALTER TABLE "UploadAsset" ADD COLUMN IF NOT EXISTS "playerId" TEXT;
  END IF;
END $$;
ALTER TABLE "UploadAsset" ADD COLUMN IF NOT EXISTS "contestId" TEXT;
ALTER TABLE "UploadAsset" ALTER COLUMN "kind" TYPE "UploadAssetKind" USING "kind"::text::"UploadAssetKind";
ALTER TABLE IF EXISTS "UploadAsset" RENAME CONSTRAINT "Upload_contestId_fkey" TO "UploadAsset_contestId_fkey";
DROP INDEX IF EXISTS "Upload_kind_createdAt_idx";
CREATE INDEX IF NOT EXISTS "UploadAsset_kind_createdAt_idx" ON "UploadAsset"("kind", "createdAt");
CREATE INDEX IF NOT EXISTS "UploadAsset_contestId_idx" ON "UploadAsset"("contestId");
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'UploadAsset' AND column_name = 'playerId') THEN
    CREATE INDEX IF NOT EXISTS "UploadAsset_playerId_idx" ON "UploadAsset"("playerId");
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'UploadAsset' AND column_name = 'playerId')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UploadAsset_playerId_fkey') THEN
    ALTER TABLE "UploadAsset" ADD CONSTRAINT "UploadAsset_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "Certificate" (
  "id" TEXT NOT NULL,
  "type" "CertificateType" NOT NULL,
  "title" TEXT NOT NULL,
  "playerId" TEXT,
  "contestId" TEXT,
  "assetUrl" TEXT,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,
  CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Certificate_contestId_issuedAt_idx" ON "Certificate"("contestId", "issuedAt");
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Certificate' AND column_name = 'playerId') THEN
    CREATE INDEX IF NOT EXISTS "Certificate_playerId_issuedAt_idx" ON "Certificate"("playerId", "issuedAt");
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Certificate' AND column_name = 'playerId')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Certificate_playerId_fkey') THEN
    ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Certificate_contestId_fkey') THEN
    ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "ActivityLog" (
  "id" TEXT NOT NULL,
  "adminId" TEXT,
  "action" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "entityId" TEXT,
  "metadata" JSONB,
  "ipAddress" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ActivityLog_adminId_createdAt_idx" ON "ActivityLog"("adminId", "createdAt");
CREATE INDEX IF NOT EXISTS "ActivityLog_entity_entityId_idx" ON "ActivityLog"("entity", "entityId");
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ActivityLog_adminId_fkey') THEN
    ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

ALTER INDEX IF EXISTS "MonthlyRanking_year_month_rank_idx" RENAME TO "MonthlyLeaderboard_year_month_rank_idx";
ALTER INDEX IF EXISTS "MonthlyRanking_playerId_year_month_key" RENAME TO "MonthlyLeaderboard_playerId_year_month_key";
ALTER INDEX IF EXISTS "YearlyRanking_year_rank_idx" RENAME TO "YearlyLeaderboard_year_rank_idx";
ALTER INDEX IF EXISTS "YearlyRanking_playerId_year_key" RENAME TO "YearlyLeaderboard_playerId_year_key";
CREATE INDEX IF NOT EXISTS "MonthlyLeaderboard_year_month_rank_idx" ON "MonthlyLeaderboard"("year", "month", "rank");
CREATE INDEX IF NOT EXISTS "YearlyLeaderboard_year_rank_idx" ON "YearlyLeaderboard"("year", "rank");
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'MonthlyLeaderboard' AND column_name = 'playerId') THEN
    CREATE UNIQUE INDEX IF NOT EXISTS "MonthlyLeaderboard_playerId_year_month_key" ON "MonthlyLeaderboard"("playerId", "year", "month");
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'YearlyLeaderboard' AND column_name = 'playerId') THEN
    CREATE UNIQUE INDEX IF NOT EXISTS "YearlyLeaderboard_playerId_year_key" ON "YearlyLeaderboard"("playerId", "year");
  END IF;
END $$;

DROP TYPE IF EXISTS "UserRole";
DROP TYPE IF EXISTS "UploadKind";
