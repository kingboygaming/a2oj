ALTER TABLE "WorldBase" ADD COLUMN "iron" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "WorldBase" ADD COLUMN "food" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "WorldBase" ADD COLUMN "foodRemainder" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "WorldBase" ADD COLUMN "rare" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "WorldBase" ADD COLUMN "experience" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "WorldBase" ADD COLUMN "activeResearchKey" TEXT;
ALTER TABLE "WorldBase" ADD COLUMN "activeResearchLevel" INTEGER;
ALTER TABLE "WorldBase" ADD COLUMN "researchCompletesAt" TIMESTAMP(3);
ALTER TABLE "WorldBaseAttack" ADD COLUMN "attackerTroopTier" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "WorldBaseAttack" ADD COLUMN "defenderTroopTier" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "WorldMarch" ADD COLUMN "troopTier" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "WorldResearch" (
    "id" TEXT NOT NULL,
    "baseId" TEXT NOT NULL,
    "researchKey" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorldResearch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorldResourceNode" (
    "id" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "maxAmount" INTEGER NOT NULL,
    "remaining" INTEGER NOT NULL,
    "yieldPerMinute" INTEGER NOT NULL,
    "requiredPower" INTEGER NOT NULL,
    "x" INTEGER NOT NULL,
    "z" INTEGER NOT NULL,
    "ownerUserId" TEXT,
    "garrisonInfantry" INTEGER NOT NULL DEFAULT 0,
    "garrisonArchers" INTEGER NOT NULL DEFAULT 0,
    "garrisonCavalry" INTEGER NOT NULL DEFAULT 0,
    "garrisonTier" INTEGER NOT NULL DEFAULT 0,
    "occupiedAt" TIMESTAMP(3),
    "occupiedUntil" TIMESTAMP(3),
    "lastCollectedAt" TIMESTAMP(3),
    "respawnsAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "WorldResourceNode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorldRogueCamp" (
    "id" TEXT NOT NULL,
    "monsterType" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "troopCount" INTEGER NOT NULL,
    "combatPower" INTEGER NOT NULL,
    "x" INTEGER NOT NULL,
    "z" INTEGER NOT NULL,
    "availableAt" TIMESTAMP(3),
    "lastDefeatedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "WorldRogueCamp_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorldMapMarch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetKind" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "infantry" INTEGER NOT NULL DEFAULT 0,
    "archers" INTEGER NOT NULL DEFAULT 0,
    "cavalry" INTEGER NOT NULL DEFAULT 0,
    "troopTier" INTEGER NOT NULL DEFAULT 0,
    "casualtiesInfantry" INTEGER NOT NULL DEFAULT 0,
    "casualtiesArchers" INTEGER NOT NULL DEFAULT 0,
    "casualtiesCavalry" INTEGER NOT NULL DEFAULT 0,
    "dispatchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "arrivesAt" TIMESTAMP(3) NOT NULL,
    "returnsAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'IN_TRANSIT',
    "report" TEXT,
    "rewardWood" INTEGER NOT NULL DEFAULT 0,
    "rewardStone" INTEGER NOT NULL DEFAULT 0,
    "rewardIron" INTEGER NOT NULL DEFAULT 0,
    "rewardFood" INTEGER NOT NULL DEFAULT 0,
    "rewardRare" INTEGER NOT NULL DEFAULT 0,
    "rewardExperience" INTEGER NOT NULL DEFAULT 0,
    "rewardItemKey" TEXT,
    "rewardItemCount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "WorldMapMarch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorldItemStack" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorldItemStack_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorldItemStack_userId_itemKey_key" ON "WorldItemStack"("userId", "itemKey");
CREATE INDEX "WorldItemStack_userId_updatedAt_idx" ON "WorldItemStack"("userId", "updatedAt");
CREATE UNIQUE INDEX "WorldResearch_baseId_researchKey_key" ON "WorldResearch"("baseId", "researchKey");
CREATE INDEX "WorldResearch_baseId_level_idx" ON "WorldResearch"("baseId", "level");
CREATE INDEX "WorldResourceNode_ownerUserId_occupiedUntil_idx" ON "WorldResourceNode"("ownerUserId", "occupiedUntil");
CREATE INDEX "WorldResourceNode_remaining_respawnsAt_idx" ON "WorldResourceNode"("remaining", "respawnsAt");
CREATE INDEX "WorldRogueCamp_availableAt_idx" ON "WorldRogueCamp"("availableAt");
CREATE INDEX "WorldMapMarch_status_arrivesAt_idx" ON "WorldMapMarch"("status", "arrivesAt");
CREATE INDEX "WorldMapMarch_status_returnsAt_idx" ON "WorldMapMarch"("status", "returnsAt");
CREATE INDEX "WorldMapMarch_userId_dispatchedAt_idx" ON "WorldMapMarch"("userId", "dispatchedAt");
CREATE INDEX "WorldMapMarch_targetId_dispatchedAt_idx" ON "WorldMapMarch"("targetId", "dispatchedAt");

ALTER TABLE "WorldResourceNode" ADD CONSTRAINT "WorldResourceNode_ownerUserId_fkey"
    FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorldMapMarch" ADD CONSTRAINT "WorldMapMarch_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorldItemStack" ADD CONSTRAINT "WorldItemStack_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorldResearch" ADD CONSTRAINT "WorldResearch_baseId_fkey"
    FOREIGN KEY ("baseId") REFERENCES "WorldBase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
