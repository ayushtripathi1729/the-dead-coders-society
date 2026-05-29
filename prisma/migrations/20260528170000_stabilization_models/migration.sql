-- Production stabilization models for contest banners, coordinators, and first solves.
ALTER TABLE "Contest" ADD COLUMN IF NOT EXISTS "bannerPoster" TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Contest' AND column_name = 'contestBanner'
  ) THEN
    UPDATE "Contest"
    SET "bannerPoster" = "contestBanner"
    WHERE "bannerPoster" IS NULL AND "contestBanner" IS NOT NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "ContestCoordinator" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "discord" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContestCoordinator_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FirstSolve" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "problemCode" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FirstSolve_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ContestCoordinator_contestId_idx" ON "ContestCoordinator"("contestId");
CREATE UNIQUE INDEX IF NOT EXISTS "FirstSolve_contestId_problemCode_key" ON "FirstSolve"("contestId", "problemCode");
CREATE INDEX IF NOT EXISTS "FirstSolve_contestId_timestamp_idx" ON "FirstSolve"("contestId", "timestamp");
CREATE INDEX IF NOT EXISTS "FirstSolve_playerId_timestamp_idx" ON "FirstSolve"("playerId", "timestamp");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ContestCoordinator_contestId_fkey'
  ) THEN
    ALTER TABLE "ContestCoordinator"
    ADD CONSTRAINT "ContestCoordinator_contestId_fkey"
    FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'FirstSolve_contestId_fkey'
  ) THEN
    ALTER TABLE "FirstSolve"
    ADD CONSTRAINT "FirstSolve_contestId_fkey"
    FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'FirstSolve_playerId_fkey'
  ) THEN
    ALTER TABLE "FirstSolve"
    ADD CONSTRAINT "FirstSolve_playerId_fkey"
    FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
