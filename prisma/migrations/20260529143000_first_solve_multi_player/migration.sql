DROP INDEX IF EXISTS "FirstSolve_contestId_problemCode_key";

CREATE UNIQUE INDEX IF NOT EXISTS "FirstSolve_contestId_problemCode_playerId_key"
ON "FirstSolve"("contestId", "problemCode", "playerId");
