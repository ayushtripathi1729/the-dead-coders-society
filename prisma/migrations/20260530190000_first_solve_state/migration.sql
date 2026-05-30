DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FirstSolveStatus') THEN
    CREATE TYPE "FirstSolveStatus" AS ENUM ('ASSIGNED', 'UNSOLVED');
  END IF;
END $$;

ALTER TABLE "FirstSolve" ADD COLUMN IF NOT EXISTS "status" "FirstSolveStatus" NOT NULL DEFAULT 'ASSIGNED';

DELETE FROM "FirstSolve"
WHERE "id" IN (
  SELECT "id"
  FROM (
    SELECT "id", ROW_NUMBER() OVER (PARTITION BY "problemId" ORDER BY "createdAt" ASC, "id" ASC) AS row_number
    FROM "FirstSolve"
  ) ranked
  WHERE ranked.row_number > 1
);

DROP INDEX IF EXISTS "FirstSolve_problemId_playerUsername_key";
CREATE UNIQUE INDEX IF NOT EXISTS "FirstSolve_problemId_key" ON "FirstSolve"("problemId");
ALTER TABLE "FirstSolve" ALTER COLUMN "playerUsername" DROP NOT NULL;
