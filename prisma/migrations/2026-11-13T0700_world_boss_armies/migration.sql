ALTER TABLE "WorldBase"
    ADD COLUMN "infantry" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "archers" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "cavalry" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "trainingType" TEXT,
    ADD COLUMN "trainingCount" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "trainingCompletesAt" TIMESTAMP(3),
    ADD COLUMN "marchActive" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "WorldEvent"
    ADD COLUMN "eventType" TEXT NOT NULL DEFAULT 'RESOURCE_RUSH',
    ADD COLUMN "bossHp" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "bossHpRemaining" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "marchTravelSeconds" INTEGER NOT NULL DEFAULT 60;

CREATE TABLE "WorldMarch" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "infantry" INTEGER NOT NULL DEFAULT 0,
    "archers" INTEGER NOT NULL DEFAULT 0,
    "cavalry" INTEGER NOT NULL DEFAULT 0,
    "damage" INTEGER NOT NULL DEFAULT 0,
    "casualties" INTEGER NOT NULL DEFAULT 0,
    "dispatchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "arrivesAt" TIMESTAMP(3) NOT NULL,
    "returnsAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'IN_TRANSIT',
    CONSTRAINT "WorldMarch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorldMarch_status_arrivesAt_idx" ON "WorldMarch"("status", "arrivesAt");
CREATE INDEX "WorldMarch_status_returnsAt_idx" ON "WorldMarch"("status", "returnsAt");
CREATE INDEX "WorldMarch_userId_status_idx" ON "WorldMarch"("userId", "status");
CREATE INDEX "WorldMarch_eventId_dispatchedAt_idx" ON "WorldMarch"("eventId", "dispatchedAt");

ALTER TABLE "WorldMarch" ADD CONSTRAINT "WorldMarch_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "WorldEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorldMarch" ADD CONSTRAINT "WorldMarch_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "WorldBase"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
