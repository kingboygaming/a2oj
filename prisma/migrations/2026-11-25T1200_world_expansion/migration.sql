-- A2 Kingdom expansion: building rewards, wall progression, fog of war,
-- scouting missions, redeem codes and admin audit trail.
--
-- Additive only: every new column has a default (or is nullable), no existing
-- column is altered or dropped, and no row is deleted.

ALTER TABLE "WorldBase" ADD COLUMN "wallLevel" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "WorldBase" ADD COLUMN "wallPendingLevel" INTEGER;
ALTER TABLE "WorldBase" ADD COLUMN "wallUpgradeCompletesAt" TIMESTAMP(3);

CREATE TABLE "WorldBuildingReward" (
    "id" TEXT NOT NULL,
    "baseId" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "buildingType" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "wood" INTEGER NOT NULL DEFAULT 0,
    "stone" INTEGER NOT NULL DEFAULT 0,
    "food" INTEGER NOT NULL DEFAULT 0,
    "iron" INTEGER NOT NULL DEFAULT 0,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorldBuildingReward_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorldBuildingReward_buildingId_level_key" ON "WorldBuildingReward"("buildingId", "level");
CREATE INDEX "WorldBuildingReward_baseId_grantedAt_idx" ON "WorldBuildingReward"("baseId", "grantedAt");

ALTER TABLE "WorldBuildingReward" ADD CONSTRAINT "WorldBuildingReward_baseId_fkey"
    FOREIGN KEY ("baseId") REFERENCES "WorldBase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WorldExploration" (
    "id" TEXT NOT NULL,
    "baseId" TEXT NOT NULL,
    "regionX" INTEGER NOT NULL,
    "regionZ" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'SCOUT',
    "rewardWood" INTEGER NOT NULL DEFAULT 0,
    "rewardStone" INTEGER NOT NULL DEFAULT 0,
    "rewardFood" INTEGER NOT NULL DEFAULT 0,
    "rewardIron" INTEGER NOT NULL DEFAULT 0,
    "revealedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorldExploration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorldExploration_baseId_regionX_regionZ_key" ON "WorldExploration"("baseId", "regionX", "regionZ");
CREATE INDEX "WorldExploration_baseId_revealedAt_idx" ON "WorldExploration"("baseId", "revealedAt");

ALTER TABLE "WorldExploration" ADD CONSTRAINT "WorldExploration_baseId_fkey"
    FOREIGN KEY ("baseId") REFERENCES "WorldBase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WorldScoutMission" (
    "id" TEXT NOT NULL,
    "baseId" TEXT NOT NULL,
    "targetRegionX" INTEGER NOT NULL,
    "targetRegionZ" INTEGER NOT NULL,
    "infantry" INTEGER NOT NULL DEFAULT 0,
    "archers" INTEGER NOT NULL DEFAULT 0,
    "cavalry" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'IN_TRANSIT',
    "dispatchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "arrivesAt" TIMESTAMP(3) NOT NULL,
    "completesAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "report" TEXT,
    "revealedCount" INTEGER NOT NULL DEFAULT 0,
    "rewardWood" INTEGER NOT NULL DEFAULT 0,
    "rewardStone" INTEGER NOT NULL DEFAULT 0,
    "rewardFood" INTEGER NOT NULL DEFAULT 0,
    "rewardIron" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "WorldScoutMission_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorldScoutMission_baseId_dispatchedAt_idx" ON "WorldScoutMission"("baseId", "dispatchedAt");
CREATE INDEX "WorldScoutMission_status_completesAt_idx" ON "WorldScoutMission"("status", "completesAt");

ALTER TABLE "WorldScoutMission" ADD CONSTRAINT "WorldScoutMission_baseId_fkey"
    FOREIGN KEY ("baseId") REFERENCES "WorldBase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WorldRedeemCode" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "codePreview" TEXT NOT NULL,
    "campaign" TEXT NOT NULL,
    "rewardWood" INTEGER NOT NULL DEFAULT 0,
    "rewardStone" INTEGER NOT NULL DEFAULT 0,
    "rewardFood" INTEGER NOT NULL DEFAULT 0,
    "rewardIron" INTEGER NOT NULL DEFAULT 0,
    "rewardA2Coin" INTEGER NOT NULL DEFAULT 0,
    "maxUses" INTEGER NOT NULL DEFAULT 0,
    "perUserLimit" INTEGER NOT NULL DEFAULT 1,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorldRedeemCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorldRedeemCode_codeHash_key" ON "WorldRedeemCode"("codeHash");
CREATE INDEX "WorldRedeemCode_enabled_expiresAt_idx" ON "WorldRedeemCode"("enabled", "expiresAt");
CREATE INDEX "WorldRedeemCode_createdAt_idx" ON "WorldRedeemCode"("createdAt");

ALTER TABLE "WorldRedeemCode" ADD CONSTRAINT "WorldRedeemCode_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "WorldRedeemRedemption" (
    "id" TEXT NOT NULL,
    "codeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 1,
    "rewardWood" INTEGER NOT NULL DEFAULT 0,
    "rewardStone" INTEGER NOT NULL DEFAULT 0,
    "rewardFood" INTEGER NOT NULL DEFAULT 0,
    "rewardIron" INTEGER NOT NULL DEFAULT 0,
    "rewardA2Coin" INTEGER NOT NULL DEFAULT 0,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorldRedeemRedemption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorldRedeemRedemption_codeId_userId_sequence_key" ON "WorldRedeemRedemption"("codeId", "userId", "sequence");
CREATE INDEX "WorldRedeemRedemption_userId_redeemedAt_idx" ON "WorldRedeemRedemption"("userId", "redeemedAt");
CREATE INDEX "WorldRedeemRedemption_codeId_redeemedAt_idx" ON "WorldRedeemRedemption"("codeId", "redeemedAt");

ALTER TABLE "WorldRedeemRedemption" ADD CONSTRAINT "WorldRedeemRedemption_codeId_fkey"
    FOREIGN KEY ("codeId") REFERENCES "WorldRedeemCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorldRedeemRedemption" ADD CONSTRAINT "WorldRedeemRedemption_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WorldAdminAuditLog" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "detail" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorldAdminAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorldAdminAuditLog_createdAt_idx" ON "WorldAdminAuditLog"("createdAt");
CREATE INDEX "WorldAdminAuditLog_adminUserId_createdAt_idx" ON "WorldAdminAuditLog"("adminUserId", "createdAt");

ALTER TABLE "WorldAdminAuditLog" ADD CONSTRAINT "WorldAdminAuditLog_adminUserId_fkey"
    FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
