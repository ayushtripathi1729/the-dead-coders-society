-- CreateEnum
CREATE TYPE "ContestStatus" AS ENUM ('UPCOMING', 'LIVE', 'FINISHED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'STAFF');

-- CreateEnum
CREATE TYPE "UploadKind" AS ENUM ('POSTER', 'BANNER', 'CERTIFICATE', 'PROFILE_IMAGE', 'LOGO', 'EDITORIAL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'ADMIN',
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "year" INTEGER NOT NULL DEFAULT 1,
    "avatarUrl" TEXT,
    "rating" INTEGER NOT NULL DEFAULT 1200,
    "bio" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contest" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "posterUrl" TEXT,
    "bannerUrl" TEXT,
    "invitationUrl" TEXT,
    "certificateUrl" TEXT,
    "codeforcesUrl" TEXT,
    "editorialUrl" TEXT,
    "status" "ContestStatus" NOT NULL DEFAULT 'UPCOMING',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "totalPoints" INTEGER NOT NULL DEFAULT 1000,
    "isSurprise" BOOLEAN NOT NULL DEFAULT false,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Standing" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "solved" INTEGER NOT NULL,
    "penalty" INTEGER NOT NULL,
    "rawScore" INTEGER NOT NULL,
    "bonusPoints" INTEGER NOT NULL,
    "finalScore" INTEGER NOT NULL,
    "firstSolves" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Standing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Problem" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "index" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "statementUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Problem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProblemFirst" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "problemId" TEXT,
    "playerId" TEXT NOT NULL,
    "problemCode" TEXT NOT NULL,
    "solvedAt" TIMESTAMP(3),

    CONSTRAINT "ProblemFirst_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rating" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "contestId" TEXT,
    "rating" INTEGER NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyRanking" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonthlyRanking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YearlyRanking" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "YearlyRanking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Upload" (
    "id" TEXT NOT NULL,
    "kind" "UploadKind" NOT NULL,
    "url" TEXT NOT NULL,
    "publicId" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'cloudinary',
    "contestId" TEXT,
    "playerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Upload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Player_username_key" ON "Player"("username");

-- CreateIndex
CREATE INDEX "Player_rating_idx" ON "Player"("rating");

-- CreateIndex
CREATE INDEX "Player_year_idx" ON "Player"("year");

-- CreateIndex
CREATE UNIQUE INDEX "Contest_slug_key" ON "Contest"("slug");

-- CreateIndex
CREATE INDEX "Contest_status_startsAt_idx" ON "Contest"("status", "startsAt");

-- CreateIndex
CREATE INDEX "Contest_isHidden_startsAt_idx" ON "Contest"("isHidden", "startsAt");

-- CreateIndex
CREATE INDEX "Standing_rank_idx" ON "Standing"("rank");

-- CreateIndex
CREATE INDEX "Standing_contestId_rank_idx" ON "Standing"("contestId", "rank");

-- CreateIndex
CREATE INDEX "Standing_playerId_finalScore_idx" ON "Standing"("playerId", "finalScore");

-- CreateIndex
CREATE UNIQUE INDEX "Standing_contestId_playerId_key" ON "Standing"("contestId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "Problem_contestId_index_key" ON "Problem"("contestId", "index");

-- CreateIndex
CREATE UNIQUE INDEX "ProblemFirst_contestId_problemCode_key" ON "ProblemFirst"("contestId", "problemCode");

-- CreateIndex
CREATE INDEX "Achievement_playerId_earnedAt_idx" ON "Achievement"("playerId", "earnedAt");

-- CreateIndex
CREATE INDEX "Rating_playerId_createdAt_idx" ON "Rating"("playerId", "createdAt");

-- CreateIndex
CREATE INDEX "MonthlyRanking_year_month_rank_idx" ON "MonthlyRanking"("year", "month", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyRanking_playerId_year_month_key" ON "MonthlyRanking"("playerId", "year", "month");

-- CreateIndex
CREATE INDEX "YearlyRanking_year_rank_idx" ON "YearlyRanking"("year", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "YearlyRanking_playerId_year_key" ON "YearlyRanking"("playerId", "year");

-- CreateIndex
CREATE INDEX "Upload_kind_createdAt_idx" ON "Upload"("kind", "createdAt");

-- AddForeignKey
ALTER TABLE "Standing" ADD CONSTRAINT "Standing_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Standing" ADD CONSTRAINT "Standing_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Problem" ADD CONSTRAINT "Problem_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemFirst" ADD CONSTRAINT "ProblemFirst_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemFirst" ADD CONSTRAINT "ProblemFirst_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemFirst" ADD CONSTRAINT "ProblemFirst_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyRanking" ADD CONSTRAINT "MonthlyRanking_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YearlyRanking" ADD CONSTRAINT "YearlyRanking_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
