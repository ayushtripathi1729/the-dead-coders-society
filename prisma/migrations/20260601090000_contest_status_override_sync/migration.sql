CREATE TYPE "ContestStatusOverride" AS ENUM ('AUTO', 'FORCE_UPCOMING', 'FORCE_LIVE', 'FORCE_COMPLETED');
CREATE TYPE "SyncStatus" AS ENUM ('IDLE', 'RUNNING', 'SUCCESS', 'FAILED');

ALTER TABLE "Contest"
  ADD COLUMN "statusOverride" "ContestStatusOverride" NOT NULL DEFAULT 'AUTO',
  ADD COLUMN "lastSyncedAt" TIMESTAMP(3),
  ADD COLUMN "syncStatus" "SyncStatus" NOT NULL DEFAULT 'IDLE',
  ADD COLUMN "syncMessage" TEXT;
