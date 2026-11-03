-- CreateEnum
CREATE TYPE "Role" AS ENUM ('STUDENT', 'TEACHER', 'ADMIN');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "Verdict" AS ENUM ('QUEUED', 'RUNNING', 'AC', 'WA', 'TLE', 'RTE', 'CE', 'MLE');

-- CreateEnum
CREATE TYPE "Language" AS ENUM ('CPP', 'PYTHON');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'STUDENT',
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "bio" TEXT NOT NULL DEFAULT '',
    "school" TEXT NOT NULL DEFAULT '',
    "avatarData" BYTEA,
    "avatarMimeType" TEXT,
    "email" TEXT,
    "emailVerifiedAt" TIMESTAMP(3),
    "pendingEmail" TEXT,
    "emailVerificationTokenHash" TEXT,
    "emailVerificationExpiresAt" TIMESTAMP(3),
    "emailVerificationSentAt" TIMESTAMP(3),
    "nameColorMode" TEXT NOT NULL DEFAULT 'RANK',
    "nameColorAchievementId" TEXT,
    "achievementNotificationsInitialized" BOOLEAN NOT NULL DEFAULT false,
    "gachaTickets" INTEGER NOT NULL DEFAULT 0,
    "featuredGachaCardId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "News" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authorId" TEXT NOT NULL,

    CONSTRAINT "News_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WikiArticle" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL,
    "sourceName" TEXT,
    "sourceUrl" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WikiArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '≡ƒÅà',
    "rarity" TEXT NOT NULL DEFAULT 'COMMON',
    "secret" BOOLEAN NOT NULL DEFAULT false,
    "triggerType" TEXT NOT NULL,
    "threshold" INTEGER NOT NULL DEFAULT 1,
    "problemSlug" TEXT,
    "nameColorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "nameColor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AchievementUnlock" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "achievementKey" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AchievementUnlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Problem" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "timeLimitMs" INTEGER NOT NULL DEFAULT 1000,
    "memoryLimitMb" INTEGER NOT NULL DEFAULT 256,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'EASY',
    "published" BOOLEAN NOT NULL DEFAULT true,
    "contestOnly" BOOLEAN NOT NULL DEFAULT false,
    "judgeType" TEXT NOT NULL DEFAULT 'STANDARD',
    "scoringMode" TEXT NOT NULL DEFAULT 'ICPC',
    "heuristicTolerancePercent" INTEGER NOT NULL DEFAULT 5,
    "achievementBadgeTitle" TEXT,
    "achievementBadgeDescription" TEXT,
    "achievementScoreThreshold" INTEGER,
    "ioMode" TEXT NOT NULL DEFAULT 'STDIO',
    "inputFile" TEXT,
    "outputFile" TEXT,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gachaAcRewardMin" INTEGER NOT NULL DEFAULT 5,
    "gachaAcRewardMax" INTEGER NOT NULL DEFAULT 10,
    "gachaPacRewardMin" INTEGER NOT NULL DEFAULT 0,
    "gachaPacRewardMax" INTEGER NOT NULL DEFAULT 5,
    "specialGachaCardId" TEXT,
    "specialGachaDropRate" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "Problem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestCase" (
    "id" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "input" TEXT NOT NULL,
    "output" TEXT NOT NULL,
    "isSample" BOOLEAN NOT NULL DEFAULT false,
    "points" INTEGER NOT NULL DEFAULT 100,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TestCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contest" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "testLimit" INTEGER NOT NULL DEFAULT 5,
    "scoringMode" TEXT NOT NULL DEFAULT 'ICPC',
    "rankPointsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "passwordHash" TEXT,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gachaAcRewardMin" INTEGER NOT NULL DEFAULT 5,
    "gachaAcRewardMax" INTEGER NOT NULL DEFAULT 10,
    "gachaPacRewardMin" INTEGER NOT NULL DEFAULT 0,
    "gachaPacRewardMax" INTEGER NOT NULL DEFAULT 5,
    "specialGachaCardId" TEXT,
    "specialGachaDropRate" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "Contest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContestProblem" (
    "contestId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "letter" TEXT NOT NULL,
    "customTitle" TEXT,
    "judgeType" TEXT,
    "ioMode" TEXT,
    "inputFile" TEXT,
    "outputFile" TEXT,
    "points" INTEGER NOT NULL DEFAULT 100,

    CONSTRAINT "ContestProblem_pkey" PRIMARY KEY ("contestId","problemId")
);

-- CreateTable
CREATE TABLE "ContestRegistration" (
    "contestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "ContestRegistration_pkey" PRIMARY KEY ("contestId","userId")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "contestId" TEXT,
    "language" "Language" NOT NULL,
    "source" TEXT NOT NULL,
    "verdict" "Verdict" NOT NULL DEFAULT 'QUEUED',
    "timeMs" INTEGER,
    "memoryKb" INTEGER,
    "score" INTEGER NOT NULL DEFAULT 0,
    "log" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "judgeAttempts" INTEGER NOT NULL DEFAULT 0,
    "judgeNextAttemptAt" TIMESTAMP(3),
    "judgeStartedAt" TIMESTAMP(3),

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GachaBanner" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT 'NORMAL',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legendaryPity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GachaBanner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GachaCard" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "rarity" TEXT NOT NULL DEFAULT 'COMMON',
    "specialOnly" BOOLEAN NOT NULL DEFAULT false,
    "category" TEXT NOT NULL DEFAULT 'DISPLAY',
    "battleType" TEXT NOT NULL DEFAULT 'MONSTER',
    "attack" INTEGER NOT NULL DEFAULT 0,
    "defense" INTEGER NOT NULL DEFAULT 0,
    "manaCost" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "requiredTributes" INTEGER,
    "element" TEXT NOT NULL DEFAULT 'Tin hß╗ìc',
    "icon" TEXT NOT NULL DEFAULT '≡ƒâÅ',
    "critRate" INTEGER NOT NULL DEFAULT 0,
    "evasionRate" INTEGER NOT NULL DEFAULT 0,
    "counterRate" INTEGER NOT NULL DEFAULT 0,
    "lifeStealRate" INTEGER NOT NULL DEFAULT 0,
    "specialEffect" TEXT NOT NULL DEFAULT 'NONE',
    "bugPart" TEXT,
    "imageData" BYTEA,
    "imageMimeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GachaCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GachaBannerCard" (
    "bannerId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "dropRate" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "GachaBannerCard_pkey" PRIMARY KEY ("bannerId","cardId")
);

-- CreateTable
CREATE TABLE "UserGachaCard" (
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "UserGachaCard_pkey" PRIMARY KEY ("userId","cardId")
);

-- CreateTable
CREATE TABLE "UserGachaBannerPity" (
    "userId" TEXT NOT NULL,
    "bannerId" TEXT NOT NULL,
    "failedPulls" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "UserGachaBannerPity_pkey" PRIMARY KEY ("userId","bannerId")
);

-- CreateTable
CREATE TABLE "UserBattleDeck" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserBattleDeck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBattleDeckCard" (
    "deckId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "UserBattleDeckCard_pkey" PRIMARY KEY ("deckId","cardId")
);

-- CreateTable
CREATE TABLE "GachaPull" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bannerId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GachaPull_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GachaRewardClaim" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "contestId" TEXT,
    "submissionId" TEXT,
    "rewardType" TEXT NOT NULL,
    "ticketsAwarded" INTEGER NOT NULL DEFAULT 0,
    "cardId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GachaRewardClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ProblemTags" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ProblemTags_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "WikiArticle_slug_key" ON "WikiArticle"("slug");

-- CreateIndex
CREATE INDEX "WikiArticle_category_published_idx" ON "WikiArticle"("category", "published");

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_slug_key" ON "Achievement"("slug");

-- CreateIndex
CREATE INDEX "Achievement_rarity_secret_idx" ON "Achievement"("rarity", "secret");

-- CreateIndex
CREATE INDEX "AchievementUnlock_userId_unlockedAt_idx" ON "AchievementUnlock"("userId", "unlockedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AchievementUnlock_userId_achievementKey_key" ON "AchievementUnlock"("userId", "achievementKey");

-- CreateIndex
CREATE UNIQUE INDEX "Problem_slug_key" ON "Problem"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Contest_slug_key" ON "Contest"("slug");

-- CreateIndex
CREATE INDEX "Submission_verdict_judgeNextAttemptAt_createdAt_idx" ON "Submission"("verdict", "judgeNextAttemptAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GachaBanner_slug_key" ON "GachaBanner"("slug");

-- CreateIndex
CREATE INDEX "GachaBanner_active_type_startsAt_endsAt_idx" ON "GachaBanner"("active", "type", "startsAt", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "GachaCard_slug_key" ON "GachaCard"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "UserBattleDeck_userId_key" ON "UserBattleDeck"("userId");

-- CreateIndex
CREATE INDEX "GachaPull_userId_createdAt_idx" ON "GachaPull"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GachaRewardClaim_eventKey_key" ON "GachaRewardClaim"("eventKey");

-- CreateIndex
CREATE INDEX "GachaRewardClaim_userId_createdAt_idx" ON "GachaRewardClaim"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "GachaRewardClaim_submissionId_idx" ON "GachaRewardClaim"("submissionId");

-- CreateIndex
CREATE INDEX "_ProblemTags_B_index" ON "_ProblemTags"("B");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_featuredGachaCardId_fkey" FOREIGN KEY ("featuredGachaCardId") REFERENCES "GachaCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "News" ADD CONSTRAINT "News_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WikiArticle" ADD CONSTRAINT "WikiArticle_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AchievementUnlock" ADD CONSTRAINT "AchievementUnlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Problem" ADD CONSTRAINT "Problem_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Problem" ADD CONSTRAINT "Problem_specialGachaCardId_fkey" FOREIGN KEY ("specialGachaCardId") REFERENCES "GachaCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCase" ADD CONSTRAINT "TestCase_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contest" ADD CONSTRAINT "Contest_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contest" ADD CONSTRAINT "Contest_specialGachaCardId_fkey" FOREIGN KEY ("specialGachaCardId") REFERENCES "GachaCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestProblem" ADD CONSTRAINT "ContestProblem_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestProblem" ADD CONSTRAINT "ContestProblem_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestRegistration" ADD CONSTRAINT "ContestRegistration_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestRegistration" ADD CONSTRAINT "ContestRegistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GachaBannerCard" ADD CONSTRAINT "GachaBannerCard_bannerId_fkey" FOREIGN KEY ("bannerId") REFERENCES "GachaBanner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GachaBannerCard" ADD CONSTRAINT "GachaBannerCard_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "GachaCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGachaCard" ADD CONSTRAINT "UserGachaCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGachaCard" ADD CONSTRAINT "UserGachaCard_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "GachaCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGachaBannerPity" ADD CONSTRAINT "UserGachaBannerPity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGachaBannerPity" ADD CONSTRAINT "UserGachaBannerPity_bannerId_fkey" FOREIGN KEY ("bannerId") REFERENCES "GachaBanner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBattleDeck" ADD CONSTRAINT "UserBattleDeck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBattleDeckCard" ADD CONSTRAINT "UserBattleDeckCard_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "UserBattleDeck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBattleDeckCard" ADD CONSTRAINT "UserBattleDeckCard_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "GachaCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GachaPull" ADD CONSTRAINT "GachaPull_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GachaPull" ADD CONSTRAINT "GachaPull_bannerId_fkey" FOREIGN KEY ("bannerId") REFERENCES "GachaBanner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GachaPull" ADD CONSTRAINT "GachaPull_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "GachaCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GachaRewardClaim" ADD CONSTRAINT "GachaRewardClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GachaRewardClaim" ADD CONSTRAINT "GachaRewardClaim_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "GachaCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProblemTags" ADD CONSTRAINT "_ProblemTags_A_fkey" FOREIGN KEY ("A") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProblemTags" ADD CONSTRAINT "_ProblemTags_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

