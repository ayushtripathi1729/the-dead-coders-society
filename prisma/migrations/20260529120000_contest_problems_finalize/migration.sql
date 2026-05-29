ALTER TABLE "Contest" ADD COLUMN IF NOT EXISTS "standingsFinalizedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "ContestProblem" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContestProblem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProblemFirstSolve" (
    "id" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProblemFirstSolve_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ContestProblem_contestId_code_key" ON "ContestProblem"("contestId", "code");
CREATE INDEX IF NOT EXISTS "ContestProblem_contestId_sortOrder_idx" ON "ContestProblem"("contestId", "sortOrder");
CREATE UNIQUE INDEX IF NOT EXISTS "ProblemFirstSolve_problemId_playerId_key" ON "ProblemFirstSolve"("problemId", "playerId");
CREATE INDEX IF NOT EXISTS "ProblemFirstSolve_playerId_createdAt_idx" ON "ProblemFirstSolve"("playerId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ContestProblem_contestId_fkey'
  ) THEN
    ALTER TABLE "ContestProblem" ADD CONSTRAINT "ContestProblem_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProblemFirstSolve_problemId_fkey'
  ) THEN
    ALTER TABLE "ProblemFirstSolve" ADD CONSTRAINT "ProblemFirstSolve_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "ContestProblem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProblemFirstSolve_playerId_fkey'
  ) THEN
    ALTER TABLE "ProblemFirstSolve" ADD CONSTRAINT "ProblemFirstSolve_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
