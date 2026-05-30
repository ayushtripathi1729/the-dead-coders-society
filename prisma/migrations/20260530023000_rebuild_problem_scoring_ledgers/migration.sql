-- Rebuild historical derived records after converting standing scores.
WITH ranked AS (
  SELECT
    "id",
    RANK() OVER (PARTITION BY "contestId" ORDER BY "solved" DESC, "penalty" ASC)::INTEGER AS rank
  FROM "ContestStanding"
)
UPDATE "ContestStanding" standing
SET "rank" = ranked.rank
FROM ranked
WHERE standing."id" = ranked."id";

UPDATE "ContestStanding"
SET
  "firstSolves" = (
    SELECT COUNT(*)::INTEGER
    FROM "FirstSolve" first_solve
    JOIN "ContestProblem" problem ON problem."id" = first_solve."problemId"
    WHERE problem."contestId" = "ContestStanding"."contestId"
      AND first_solve."playerId" = "ContestStanding"."playerId"
  ),
  "bonusPoints" = CASE "rank"
    WHEN 1 THEN 500
    WHEN 2 THEN 250
    WHEN 3 THEN 125
    WHEN 4 THEN 50
    WHEN 5 THEN 25
    ELSE 0
  END;

UPDATE "ContestStanding"
SET "finalScore" = "contestScore" + "bonusPoints";

UPDATE "ContestParticipation" participation
SET
  "finalRank" = standing."rank",
  "finalScore" = standing."finalScore",
  "solved" = standing."solved",
  "penalty" = standing."penalty"
FROM "ContestStanding" standing
WHERE participation."contestId" = standing."contestId"
  AND participation."playerId" = standing."playerId";

UPDATE "Player" player
SET
  "contestsPlayed" = stats.contests,
  "totalSolved" = stats.solved,
  "totalScore" = stats.score,
  "wins" = stats.wins,
  "podiums" = stats.podiums,
  "firstSolves" = stats.first_solves,
  "averageRank" = stats.average_rank,
  "bestRank" = stats.best_rank
FROM (
  SELECT
    player."id" AS player_id,
    COUNT(standing."id")::INTEGER AS contests,
    COALESCE(SUM(standing."solved"), 0)::INTEGER AS solved,
    COALESCE(SUM(standing."finalScore"), 0)::INTEGER AS score,
    COUNT(standing."id") FILTER (WHERE standing."rank" = 1)::INTEGER AS wins,
    COUNT(standing."id") FILTER (WHERE standing."rank" <= 3)::INTEGER AS podiums,
    COALESCE(SUM(standing."firstSolves"), 0)::INTEGER AS first_solves,
    AVG(standing."rank")::DOUBLE PRECISION AS average_rank,
    MIN(standing."rank")::INTEGER AS best_rank
  FROM "Player" player
  LEFT JOIN "ContestStanding" standing
    ON standing."playerId" = player."id"
   AND EXISTS (
     SELECT 1 FROM "Contest" contest
     WHERE contest."id" = standing."contestId"
       AND contest."standingsFinalizedAt" IS NOT NULL
   )
  GROUP BY player."id"
) stats
WHERE player."id" = stats.player_id;

DELETE FROM "MonthlyLeaderboard";
WITH period_stats AS (
  SELECT
    standing."playerId",
    EXTRACT(YEAR FROM contest."startTime")::INTEGER AS year,
    EXTRACT(MONTH FROM contest."startTime")::INTEGER AS month,
    SUM(standing."finalScore")::INTEGER AS total_score,
    COUNT(*)::INTEGER AS contests,
    COUNT(*) FILTER (WHERE standing."rank" = 1)::INTEGER AS wins,
    SUM(standing."solved")::INTEGER AS solved,
    SUM(standing."firstSolves")::INTEGER AS first_solves,
    AVG(standing."rank")::DOUBLE PRECISION AS average_rank
  FROM "ContestStanding" standing
  JOIN "Contest" contest ON contest."id" = standing."contestId"
  WHERE contest."standingsFinalizedAt" IS NOT NULL
    AND contest."visibility" <> 'PRIVATE'
  GROUP BY standing."playerId", EXTRACT(YEAR FROM contest."startTime"), EXTRACT(MONTH FROM contest."startTime")
),
ranked AS (
  SELECT
    *,
    ROW_NUMBER() OVER (PARTITION BY year, month ORDER BY total_score DESC, wins DESC, solved DESC)::INTEGER AS rank
  FROM period_stats
)
INSERT INTO "MonthlyLeaderboard" ("id", "playerId", "year", "month", "rank", "totalScore", "contests", "wins", "solved", "firstSolves", "averageRank", "createdAt", "updatedAt")
SELECT
  CONCAT('monthly:', "playerId", ':', year, ':', month),
  "playerId",
  year,
  month,
  rank,
  total_score,
  contests,
  wins,
  solved,
  first_solves,
  average_rank,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM ranked;

DELETE FROM "YearlyLeaderboard";
WITH period_stats AS (
  SELECT
    standing."playerId",
    EXTRACT(YEAR FROM contest."startTime")::INTEGER AS year,
    SUM(standing."finalScore")::INTEGER AS total_score,
    COUNT(*)::INTEGER AS contests,
    COUNT(*) FILTER (WHERE standing."rank" = 1)::INTEGER AS wins,
    SUM(standing."solved")::INTEGER AS solved,
    SUM(standing."firstSolves")::INTEGER AS first_solves,
    AVG(standing."rank")::DOUBLE PRECISION AS average_rank
  FROM "ContestStanding" standing
  JOIN "Contest" contest ON contest."id" = standing."contestId"
  WHERE contest."standingsFinalizedAt" IS NOT NULL
    AND contest."visibility" <> 'PRIVATE'
  GROUP BY standing."playerId", EXTRACT(YEAR FROM contest."startTime")
),
ranked AS (
  SELECT
    *,
    ROW_NUMBER() OVER (PARTITION BY year ORDER BY total_score DESC, wins DESC, solved DESC)::INTEGER AS rank
  FROM period_stats
)
INSERT INTO "YearlyLeaderboard" ("id", "playerId", "year", "rank", "totalScore", "contests", "wins", "solved", "firstSolves", "averageRank", "createdAt", "updatedAt")
SELECT
  CONCAT('yearly:', "playerId", ':', year),
  "playerId",
  year,
  rank,
  total_score,
  contests,
  wins,
  solved,
  first_solves,
  average_rank,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM ranked;

UPDATE "Player" SET "monthlyRank" = NULL, "yearlyRank" = NULL;
UPDATE "Player" player
SET "monthlyRank" = leaderboard."rank"
FROM "MonthlyLeaderboard" leaderboard
WHERE player."id" = leaderboard."playerId"
  AND leaderboard."year" = EXTRACT(YEAR FROM CURRENT_TIMESTAMP)::INTEGER
  AND leaderboard."month" = EXTRACT(MONTH FROM CURRENT_TIMESTAMP)::INTEGER;

UPDATE "Player" player
SET "yearlyRank" = leaderboard."rank"
FROM "YearlyLeaderboard" leaderboard
WHERE player."id" = leaderboard."playerId"
  AND leaderboard."year" = EXTRACT(YEAR FROM CURRENT_TIMESTAMP)::INTEGER;

UPDATE "HallOfFame" hall
SET "score" = standing."finalScore"
FROM "ContestStanding" standing
WHERE hall."contestId" = standing."contestId"
  AND hall."playerId" = standing."playerId";
