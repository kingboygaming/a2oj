-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'STUDENT',
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "bio" TEXT NOT NULL DEFAULT '',
    "school" TEXT NOT NULL DEFAULT '',
    "avatarData" BLOB,
    "avatarMimeType" TEXT,
    "email" TEXT,
    "emailVerifiedAt" DATETIME,
    "pendingEmail" TEXT,
    "emailVerificationTokenHash" TEXT,
    "emailVerificationExpiresAt" DATETIME,
    "emailVerificationSentAt" DATETIME,
    "nameColorMode" TEXT NOT NULL DEFAULT 'RANK',
    "nameColorAchievementId" TEXT,
    "achievementNotificationsInitialized" BOOLEAN NOT NULL DEFAULT false,
    "gachaTickets" INTEGER NOT NULL DEFAULT 0,
    "featuredGachaCardId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_featuredGachaCardId_fkey" FOREIGN KEY ("featuredGachaCardId") REFERENCES "GachaCard" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "News" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authorId" TEXT NOT NULL,
    CONSTRAINT "News_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WikiArticle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL,
    "sourceName" TEXT,
    "sourceUrl" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "authorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WikiArticle_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '🏅',
    "rarity" TEXT NOT NULL DEFAULT 'COMMON',
    "secret" BOOLEAN NOT NULL DEFAULT false,
    "triggerType" TEXT NOT NULL,
    "threshold" INTEGER NOT NULL DEFAULT 1,
    "problemSlug" TEXT,
    "nameColorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "nameColor" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AchievementUnlock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "achievementKey" TEXT NOT NULL,
    "unlockedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AchievementUnlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Problem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "timeLimitMs" INTEGER NOT NULL DEFAULT 1000,
    "memoryLimitMb" INTEGER NOT NULL DEFAULT 256,
    "difficulty" TEXT NOT NULL DEFAULT 'EASY',
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gachaAcRewardMin" INTEGER NOT NULL DEFAULT 5,
    "gachaAcRewardMax" INTEGER NOT NULL DEFAULT 10,
    "gachaPacRewardMin" INTEGER NOT NULL DEFAULT 0,
    "gachaPacRewardMax" INTEGER NOT NULL DEFAULT 5,
    "specialGachaCardId" TEXT,
    "specialGachaDropRate" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "Problem_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Problem_specialGachaCardId_fkey" FOREIGN KEY ("specialGachaCardId") REFERENCES "GachaCard" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "TestCase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "problemId" TEXT NOT NULL,
    "input" TEXT NOT NULL,
    "output" TEXT NOT NULL,
    "isSample" BOOLEAN NOT NULL DEFAULT false,
    "points" INTEGER NOT NULL DEFAULT 100,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "TestCase_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Contest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "startAt" DATETIME NOT NULL,
    "endAt" DATETIME NOT NULL,
    "testLimit" INTEGER NOT NULL DEFAULT 5,
    "scoringMode" TEXT NOT NULL DEFAULT 'ICPC',
    "rankPointsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "passwordHash" TEXT,
    "authorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gachaAcRewardMin" INTEGER NOT NULL DEFAULT 5,
    "gachaAcRewardMax" INTEGER NOT NULL DEFAULT 10,
    "gachaPacRewardMin" INTEGER NOT NULL DEFAULT 0,
    "gachaPacRewardMax" INTEGER NOT NULL DEFAULT 5,
    "specialGachaCardId" TEXT,
    "specialGachaDropRate" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "Contest_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Contest_specialGachaCardId_fkey" FOREIGN KEY ("specialGachaCardId") REFERENCES "GachaCard" ("id") ON DELETE SET NULL ON UPDATE CASCADE
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

    PRIMARY KEY ("contestId", "problemId"),
    CONSTRAINT "ContestProblem_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ContestProblem_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContestRegistration" (
    "contestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    PRIMARY KEY ("contestId", "userId"),
    CONSTRAINT "ContestRegistration_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ContestRegistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "contestId" TEXT,
    "language" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "verdict" TEXT NOT NULL DEFAULT 'QUEUED',
    "timeMs" INTEGER,
    "memoryKb" INTEGER,
    "score" INTEGER NOT NULL DEFAULT 0,
    "log" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "judgeAttempts" INTEGER NOT NULL DEFAULT 0,
    "judgeNextAttemptAt" DATETIME,
    "judgeStartedAt" DATETIME,
    CONSTRAINT "Submission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Submission_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Submission_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GachaBanner" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT 'NORMAL',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" DATETIME,
    "endsAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legendaryPity" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "GachaCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "element" TEXT NOT NULL DEFAULT 'Tin học',
    "icon" TEXT NOT NULL DEFAULT '🃏',
    "critRate" INTEGER NOT NULL DEFAULT 0,
    "evasionRate" INTEGER NOT NULL DEFAULT 0,
    "counterRate" INTEGER NOT NULL DEFAULT 0,
    "lifeStealRate" INTEGER NOT NULL DEFAULT 0,
    "specialEffect" TEXT NOT NULL DEFAULT 'NONE',
    "bugPart" TEXT,
    "imageData" BLOB,
    "imageMimeType" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "GachaBannerCard" (
    "bannerId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "dropRate" REAL NOT NULL,

    PRIMARY KEY ("bannerId", "cardId"),
    CONSTRAINT "GachaBannerCard_bannerId_fkey" FOREIGN KEY ("bannerId") REFERENCES "GachaBanner" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GachaBannerCard_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "GachaCard" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserGachaCard" (
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,

    PRIMARY KEY ("userId", "cardId"),
    CONSTRAINT "UserGachaCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserGachaCard_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "GachaCard" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserGachaBannerPity" (
    "userId" TEXT NOT NULL,
    "bannerId" TEXT NOT NULL,
    "failedPulls" INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY ("userId", "bannerId"),
    CONSTRAINT "UserGachaBannerPity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserGachaBannerPity_bannerId_fkey" FOREIGN KEY ("bannerId") REFERENCES "GachaBanner" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserBattleDeck" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserBattleDeck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserBattleDeckCard" (
    "deckId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,

    PRIMARY KEY ("deckId", "cardId"),
    CONSTRAINT "UserBattleDeckCard_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "UserBattleDeck" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserBattleDeckCard_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "GachaCard" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GachaPull" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "bannerId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GachaPull_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GachaPull_bannerId_fkey" FOREIGN KEY ("bannerId") REFERENCES "GachaBanner" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GachaPull_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "GachaCard" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GachaRewardClaim" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "contestId" TEXT,
    "submissionId" TEXT,
    "rewardType" TEXT NOT NULL,
    "ticketsAwarded" INTEGER NOT NULL DEFAULT 0,
    "cardId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GachaRewardClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GachaRewardClaim_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "GachaCard" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_ProblemTags" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_ProblemTags_A_fkey" FOREIGN KEY ("A") REFERENCES "Problem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_ProblemTags_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
CREATE UNIQUE INDEX "_ProblemTags_AB_unique" ON "_ProblemTags"("A", "B");

-- CreateIndex
CREATE INDEX "_ProblemTags_B_index" ON "_ProblemTags"("B");
