-- Stage 1 stabilization indexes for common public reads and admin audit panels.
CREATE INDEX IF NOT EXISTS "Player_createdAt_idx" ON "Player"("createdAt");
CREATE INDEX IF NOT EXISTS "Player_updatedAt_idx" ON "Player"("updatedAt");

CREATE INDEX IF NOT EXISTS "Contest_startTime_idx" ON "Contest"("startTime");
CREATE INDEX IF NOT EXISTS "Contest_updatedAt_idx" ON "Contest"("updatedAt");

CREATE INDEX IF NOT EXISTS "FirstSolve_status_createdAt_idx" ON "FirstSolve"("status", "createdAt");

CREATE INDEX IF NOT EXISTS "ContestStanding_createdAt_idx" ON "ContestStanding"("createdAt");
CREATE INDEX IF NOT EXISTS "ContestStanding_updatedAt_idx" ON "ContestStanding"("updatedAt");

CREATE INDEX IF NOT EXISTS "HallOfFame_contestId_awardedAt_idx" ON "HallOfFame"("contestId", "awardedAt");

CREATE INDEX IF NOT EXISTS "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");
