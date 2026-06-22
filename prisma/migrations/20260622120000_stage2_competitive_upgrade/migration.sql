ALTER TABLE "Player" ADD COLUMN IF NOT EXISTS "ratingTitle" TEXT NOT NULL DEFAULT 'Pupil';

UPDATE "Player"
SET "ratingTitle" = CASE
  WHEN "currentRating" < 1200 THEN 'Newbie'
  WHEN "currentRating" < 1400 THEN 'Pupil'
  WHEN "currentRating" < 1600 THEN 'Specialist'
  WHEN "currentRating" < 1900 THEN 'Expert'
  WHEN "currentRating" < 2100 THEN 'Candidate Master'
  WHEN "currentRating" < 2400 THEN 'Master'
  ELSE 'Grandmaster'
END;

ALTER TABLE "Achievement" ADD COLUMN IF NOT EXISTS "code" TEXT;
ALTER TABLE "Achievement" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'GENERAL';
ALTER TABLE "Achievement" ADD COLUMN IF NOT EXISTS "contestId" TEXT;

CREATE TABLE IF NOT EXISTS "RatingTitleHistory" (
  "id" TEXT NOT NULL,
  "playerUsername" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "contestId" TEXT,
  "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RatingTitleHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ContestAnalytics" (
  "id" TEXT NOT NULL,
  "contestId" TEXT NOT NULL,
  "participants" INTEGER NOT NULL DEFAULT 0,
  "totalSolves" INTEGER NOT NULL DEFAULT 0,
  "averageScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "averageSolved" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "winnerUsername" TEXT,
  "fastestUsername" TEXT,
  "hardestProblemCode" TEXT,
  "mostSolvedProblemCode" TEXT,
  "unsolvedProblems" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "problemStats" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContestAnalytics_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Achievement_playerUsername_code_key" ON "Achievement"("playerUsername", "code");
CREATE INDEX IF NOT EXISTS "Achievement_code_idx" ON "Achievement"("code");
CREATE INDEX IF NOT EXISTS "Player_ratingTitle_idx" ON "Player"("ratingTitle");
CREATE INDEX IF NOT EXISTS "RatingTitleHistory_playerUsername_earnedAt_idx" ON "RatingTitleHistory"("playerUsername", "earnedAt");
CREATE INDEX IF NOT EXISTS "RatingTitleHistory_contestId_idx" ON "RatingTitleHistory"("contestId");
CREATE UNIQUE INDEX IF NOT EXISTS "ContestAnalytics_contestId_key" ON "ContestAnalytics"("contestId");
CREATE INDEX IF NOT EXISTS "ContestAnalytics_winnerUsername_idx" ON "ContestAnalytics"("winnerUsername");
CREATE INDEX IF NOT EXISTS "ContestAnalytics_updatedAt_idx" ON "ContestAnalytics"("updatedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RatingTitleHistory_playerUsername_fkey'
  ) THEN
    ALTER TABLE "RatingTitleHistory"
      ADD CONSTRAINT "RatingTitleHistory_playerUsername_fkey"
      FOREIGN KEY ("playerUsername") REFERENCES "Player"("username") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ContestAnalytics_contestId_fkey'
  ) THEN
    ALTER TABLE "ContestAnalytics"
      ADD CONSTRAINT "ContestAnalytics_contestId_fkey"
      FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
