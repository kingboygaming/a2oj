CREATE TABLE "WorldAlliance" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "leaderUserId" TEXT NOT NULL,
    "memberCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorldAlliance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorldAllianceMember" (
    "id" TEXT NOT NULL,
    "allianceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorldAllianceMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorldAlliance_tag_key" ON "WorldAlliance"("tag");
CREATE INDEX "WorldAlliance_memberCount_createdAt_idx" ON "WorldAlliance"("memberCount", "createdAt");
CREATE UNIQUE INDEX "WorldAllianceMember_userId_key" ON "WorldAllianceMember"("userId");
CREATE INDEX "WorldAllianceMember_allianceId_joinedAt_idx" ON "WorldAllianceMember"("allianceId", "joinedAt");

ALTER TABLE "WorldAlliance" ADD CONSTRAINT "WorldAlliance_leaderUserId_fkey"
    FOREIGN KEY ("leaderUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorldAllianceMember" ADD CONSTRAINT "WorldAllianceMember_allianceId_fkey"
    FOREIGN KEY ("allianceId") REFERENCES "WorldAlliance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorldAllianceMember" ADD CONSTRAINT "WorldAllianceMember_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
