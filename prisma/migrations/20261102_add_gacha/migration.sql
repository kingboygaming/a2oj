ALTER TABLE "User" ADD COLUMN "gachaTickets" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "featuredGachaCardId" TEXT;

ALTER TABLE "Problem" ADD COLUMN "gachaAcRewardMin" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "Problem" ADD COLUMN "gachaAcRewardMax" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "Problem" ADD COLUMN "gachaPacRewardMin" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Problem" ADD COLUMN "gachaPacRewardMax" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "Problem" ADD COLUMN "specialGachaCardId" TEXT;
ALTER TABLE "Problem" ADD COLUMN "specialGachaDropRate" DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "Contest" ADD COLUMN "gachaAcRewardMin" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "Contest" ADD COLUMN "gachaAcRewardMax" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "Contest" ADD COLUMN "gachaPacRewardMin" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Contest" ADD COLUMN "gachaPacRewardMax" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "Contest" ADD COLUMN "specialGachaCardId" TEXT;
ALTER TABLE "Contest" ADD COLUMN "specialGachaDropRate" DOUBLE PRECISION NOT NULL DEFAULT 0;

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
    CONSTRAINT "GachaBanner_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GachaCard" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "rarity" TEXT NOT NULL DEFAULT 'COMMON',
    "specialOnly" BOOLEAN NOT NULL DEFAULT false,
    "imageData" BYTEA,
    "imageMimeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GachaCard_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GachaBannerCard" (
    "bannerId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "dropRate" DOUBLE PRECISION NOT NULL,
    CONSTRAINT "GachaBannerCard_pkey" PRIMARY KEY ("bannerId", "cardId")
);

CREATE TABLE "UserGachaCard" (
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "UserGachaCard_pkey" PRIMARY KEY ("userId", "cardId")
);

CREATE TABLE "GachaPull" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bannerId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GachaPull_pkey" PRIMARY KEY ("id")
);

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

CREATE UNIQUE INDEX "GachaBanner_slug_key" ON "GachaBanner"("slug");
CREATE INDEX "GachaBanner_active_type_startsAt_endsAt_idx" ON "GachaBanner"("active", "type", "startsAt", "endsAt");
CREATE UNIQUE INDEX "GachaCard_slug_key" ON "GachaCard"("slug");
CREATE INDEX "GachaPull_userId_createdAt_idx" ON "GachaPull"("userId", "createdAt");
CREATE UNIQUE INDEX "GachaRewardClaim_eventKey_key" ON "GachaRewardClaim"("eventKey");
CREATE INDEX "GachaRewardClaim_userId_createdAt_idx" ON "GachaRewardClaim"("userId", "createdAt");
CREATE INDEX "GachaRewardClaim_submissionId_idx" ON "GachaRewardClaim"("submissionId");

ALTER TABLE "GachaBannerCard" ADD CONSTRAINT "GachaBannerCard_bannerId_fkey" FOREIGN KEY ("bannerId") REFERENCES "GachaBanner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GachaBannerCard" ADD CONSTRAINT "GachaBannerCard_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "GachaCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserGachaCard" ADD CONSTRAINT "UserGachaCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserGachaCard" ADD CONSTRAINT "UserGachaCard_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "GachaCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GachaPull" ADD CONSTRAINT "GachaPull_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GachaPull" ADD CONSTRAINT "GachaPull_bannerId_fkey" FOREIGN KEY ("bannerId") REFERENCES "GachaBanner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GachaPull" ADD CONSTRAINT "GachaPull_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "GachaCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GachaRewardClaim" ADD CONSTRAINT "GachaRewardClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GachaRewardClaim" ADD CONSTRAINT "GachaRewardClaim_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "GachaCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_featuredGachaCardId_fkey" FOREIGN KEY ("featuredGachaCardId") REFERENCES "GachaCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Problem" ADD CONSTRAINT "Problem_specialGachaCardId_fkey" FOREIGN KEY ("specialGachaCardId") REFERENCES "GachaCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Contest" ADD CONSTRAINT "Contest_specialGachaCardId_fkey" FOREIGN KEY ("specialGachaCardId") REFERENCES "GachaCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;
