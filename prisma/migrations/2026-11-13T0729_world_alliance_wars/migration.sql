CREATE TABLE "WorldAllianceWar" (
    "id" TEXT NOT NULL,
    "challengerAllianceId" TEXT NOT NULL,
    "defenderAllianceId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "challengerScore" INTEGER NOT NULL DEFAULT 0,
    "defenderScore" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "winnerAllianceId" TEXT,
    CONSTRAINT "WorldAllianceWar_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorldAllianceWarLock" (
    "allianceId" TEXT NOT NULL,
    "warId" TEXT NOT NULL,
    CONSTRAINT "WorldAllianceWarLock_pkey" PRIMARY KEY ("allianceId")
);

CREATE TABLE "WorldAllianceWarScore" (
    "id" TEXT NOT NULL,
    "warId" TEXT NOT NULL,
    "allianceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "lastAttackAt" TIMESTAMP(3),
    CONSTRAINT "WorldAllianceWarScore_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorldAllianceWar_challengerAllianceId_createdAt_idx" ON "WorldAllianceWar"("challengerAllianceId", "createdAt");
CREATE INDEX "WorldAllianceWar_defenderAllianceId_createdAt_idx" ON "WorldAllianceWar"("defenderAllianceId", "createdAt");
CREATE INDEX "WorldAllianceWar_status_endsAt_idx" ON "WorldAllianceWar"("status", "endsAt");
CREATE UNIQUE INDEX "WorldAllianceWarLock_warId_allianceId_key" ON "WorldAllianceWarLock"("warId", "allianceId");
CREATE UNIQUE INDEX "WorldAllianceWarScore_warId_userId_key" ON "WorldAllianceWarScore"("warId", "userId");
CREATE INDEX "WorldAllianceWarScore_warId_allianceId_score_idx" ON "WorldAllianceWarScore"("warId", "allianceId", "score");

ALTER TABLE "WorldAllianceWar" ADD CONSTRAINT "WorldAllianceWar_challengerAllianceId_fkey"
    FOREIGN KEY ("challengerAllianceId") REFERENCES "WorldAlliance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorldAllianceWar" ADD CONSTRAINT "WorldAllianceWar_defenderAllianceId_fkey"
    FOREIGN KEY ("defenderAllianceId") REFERENCES "WorldAlliance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorldAllianceWarLock" ADD CONSTRAINT "WorldAllianceWarLock_allianceId_fkey"
    FOREIGN KEY ("allianceId") REFERENCES "WorldAlliance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorldAllianceWarLock" ADD CONSTRAINT "WorldAllianceWarLock_warId_fkey"
    FOREIGN KEY ("warId") REFERENCES "WorldAllianceWar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorldAllianceWarScore" ADD CONSTRAINT "WorldAllianceWarScore_warId_fkey"
    FOREIGN KEY ("warId") REFERENCES "WorldAllianceWar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorldAllianceWarScore" ADD CONSTRAINT "WorldAllianceWarScore_allianceId_fkey"
    FOREIGN KEY ("allianceId") REFERENCES "WorldAlliance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorldAllianceWarScore" ADD CONSTRAINT "WorldAllianceWarScore_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
