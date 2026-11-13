CREATE TABLE "WorldBuilding" (
    "id" TEXT NOT NULL,
    "baseId" TEXT NOT NULL,
    "plotIndex" INTEGER NOT NULL,
    "buildingType" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 0,
    "pendingLevel" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'CONSTRUCTING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "completesAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorldBuilding_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "WorldBase" ALTER COLUMN "factoryLevel" SET DEFAULT 0;
ALTER TABLE "WorldBase" ALTER COLUMN "wood" SET DEFAULT 350;
ALTER TABLE "WorldBase" ALTER COLUMN "stone" SET DEFAULT 250;
ALTER TABLE "WorldBase" ADD COLUMN "castleLevel" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "WorldBase" ADD COLUMN "castlePendingLevel" INTEGER;
ALTER TABLE "WorldBase" ADD COLUMN "castleUpgradeCompletesAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "WorldBuilding_baseId_plotIndex_key" ON "WorldBuilding"("baseId", "plotIndex");
CREATE INDEX "WorldBuilding_baseId_status_completesAt_idx" ON "WorldBuilding"("baseId", "status", "completesAt");

ALTER TABLE "WorldBuilding" ADD CONSTRAINT "WorldBuilding_baseId_fkey"
    FOREIGN KEY ("baseId") REFERENCES "WorldBase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
