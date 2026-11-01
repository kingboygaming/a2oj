ALTER TABLE "User" ADD COLUMN "achievementNotificationsInitialized" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "AchievementUnlock" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "achievementKey" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AchievementUnlock_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AchievementUnlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AchievementUnlock_userId_achievementKey_key" ON "AchievementUnlock"("userId", "achievementKey");
CREATE INDEX "AchievementUnlock_userId_unlockedAt_idx" ON "AchievementUnlock"("userId", "unlockedAt");
