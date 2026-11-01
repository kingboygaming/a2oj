ALTER TABLE "User" ADD COLUMN "nameColorMode" TEXT NOT NULL DEFAULT 'RANK';
ALTER TABLE "User" ADD COLUMN "nameColorAchievementId" TEXT;

CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Achievement_slug_key" ON "Achievement"("slug");
CREATE INDEX "Achievement_rarity_secret_idx" ON "Achievement"("rarity", "secret");
