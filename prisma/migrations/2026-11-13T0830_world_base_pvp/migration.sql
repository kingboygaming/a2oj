ALTER TABLE "WorldBase" ADD COLUMN "activePvpAttackId" TEXT;
ALTER TABLE "WorldBase" ADD COLUMN "pvpShieldUntil" TIMESTAMP(3);

CREATE TABLE "WorldBaseAttack" (
    "id" TEXT NOT NULL,
    "attackerUserId" TEXT NOT NULL,
    "defenderUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_TRANSIT',
    "distanceMeters" INTEGER NOT NULL,
    "infantry" INTEGER NOT NULL,
    "archers" INTEGER NOT NULL,
    "cavalry" INTEGER NOT NULL,
    "attackerPower" INTEGER NOT NULL DEFAULT 0,
    "defenderPower" INTEGER NOT NULL DEFAULT 0,
    "winnerUserId" TEXT,
    "stolenWood" INTEGER NOT NULL DEFAULT 0,
    "stolenStone" INTEGER NOT NULL DEFAULT 0,
    "attackerCasualties" INTEGER NOT NULL DEFAULT 0,
    "defenderCasualties" INTEGER NOT NULL DEFAULT 0,
    "dispatchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "arrivesAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    CONSTRAINT "WorldBaseAttack_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorldBaseOccupation" (
    "id" TEXT NOT NULL,
    "attackId" TEXT NOT NULL,
    "controllerUserId" TEXT NOT NULL,
    "formerOwnerUserId" TEXT NOT NULL,
    "coordinateX" INTEGER NOT NULL,
    "coordinateZ" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    CONSTRAINT "WorldBaseOccupation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorldBaseAttack_status_arrivesAt_idx" ON "WorldBaseAttack"("status", "arrivesAt");
CREATE INDEX "WorldBaseAttack_attackerUserId_dispatchedAt_idx" ON "WorldBaseAttack"("attackerUserId", "dispatchedAt");
CREATE INDEX "WorldBaseAttack_defenderUserId_dispatchedAt_idx" ON "WorldBaseAttack"("defenderUserId", "dispatchedAt");
CREATE UNIQUE INDEX "WorldBaseOccupation_attackId_key" ON "WorldBaseOccupation"("attackId");
CREATE INDEX "WorldBaseOccupation_status_endsAt_idx" ON "WorldBaseOccupation"("status", "endsAt");
CREATE INDEX "WorldBaseOccupation_controllerUserId_endsAt_idx" ON "WorldBaseOccupation"("controllerUserId", "endsAt");
CREATE INDEX "WorldBaseOccupation_formerOwnerUserId_endsAt_idx" ON "WorldBaseOccupation"("formerOwnerUserId", "endsAt");

ALTER TABLE "WorldBaseAttack" ADD CONSTRAINT "WorldBaseAttack_attackerUserId_fkey"
    FOREIGN KEY ("attackerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorldBaseAttack" ADD CONSTRAINT "WorldBaseAttack_defenderUserId_fkey"
    FOREIGN KEY ("defenderUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorldBaseOccupation" ADD CONSTRAINT "WorldBaseOccupation_attackId_fkey"
    FOREIGN KEY ("attackId") REFERENCES "WorldBaseAttack"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorldBaseOccupation" ADD CONSTRAINT "WorldBaseOccupation_controllerUserId_fkey"
    FOREIGN KEY ("controllerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorldBaseOccupation" ADD CONSTRAINT "WorldBaseOccupation_formerOwnerUserId_fkey"
    FOREIGN KEY ("formerOwnerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
