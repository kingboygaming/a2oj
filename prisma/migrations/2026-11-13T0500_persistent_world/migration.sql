CREATE TABLE "WorldBase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "wood" INTEGER NOT NULL DEFAULT 200,
    "woodRemainder" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stone" INTEGER NOT NULL DEFAULT 100,
    "stoneRemainder" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "factoryLevel" INTEGER NOT NULL DEFAULT 1,
    "warehouseLevel" INTEGER NOT NULL DEFAULT 1,
    "upgradeType" TEXT,
    "upgradeCompletesAt" TIMESTAMP(3),
    "lastSimulatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorldBase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorldEvent" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "participantLimit" INTEGER NOT NULL DEFAULT 200,
    "participantCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorldEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorldEventParticipation" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "lastContributionAt" TIMESTAMP(3),
    "rewardWood" INTEGER NOT NULL DEFAULT 0,
    "rewardStone" INTEGER NOT NULL DEFAULT 0,
    "rewardClaimedAt" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorldEventParticipation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorldJob" (
    "id" TEXT NOT NULL,
    "uniqueKey" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "runAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lockedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorldJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorldBase_userId_key" ON "WorldBase"("userId");
CREATE INDEX "WorldBase_lastSimulatedAt_idx" ON "WorldBase"("lastSimulatedAt");
CREATE UNIQUE INDEX "WorldEvent_slug_key" ON "WorldEvent"("slug");
CREATE INDEX "WorldEvent_status_startsAt_endsAt_idx" ON "WorldEvent"("status", "startsAt", "endsAt");
CREATE UNIQUE INDEX "WorldEventParticipation_eventId_userId_key" ON "WorldEventParticipation"("eventId", "userId");
CREATE INDEX "WorldEventParticipation_eventId_score_joinedAt_idx" ON "WorldEventParticipation"("eventId", "score", "joinedAt");
CREATE INDEX "WorldEventParticipation_userId_joinedAt_idx" ON "WorldEventParticipation"("userId", "joinedAt");
CREATE UNIQUE INDEX "WorldJob_uniqueKey_key" ON "WorldJob"("uniqueKey");
CREATE INDEX "WorldJob_status_runAt_lockedAt_idx" ON "WorldJob"("status", "runAt", "lockedAt");

ALTER TABLE "WorldBase" ADD CONSTRAINT "WorldBase_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorldEventParticipation" ADD CONSTRAINT "WorldEventParticipation_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "WorldEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorldEventParticipation" ADD CONSTRAINT "WorldEventParticipation_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorldJob" ADD CONSTRAINT "WorldJob_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "WorldEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
