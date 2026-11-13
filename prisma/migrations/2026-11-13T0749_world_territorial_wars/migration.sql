ALTER TABLE "WorldAllianceWar" ADD COLUMN "territoryId" TEXT;

CREATE TABLE "WorldTerritory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "dailyWood" INTEGER NOT NULL DEFAULT 0,
    "dailyStone" INTEGER NOT NULL DEFAULT 0,
    "controllerAllianceId" TEXT,
    "capturedAt" TIMESTAMP(3),
    "nextRewardAt" TIMESTAMP(3),
    CONSTRAINT "WorldTerritory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorldTerritoryWarLock" (
    "territoryId" TEXT NOT NULL,
    "warId" TEXT NOT NULL,
    CONSTRAINT "WorldTerritoryWarLock_pkey" PRIMARY KEY ("territoryId")
);

CREATE UNIQUE INDEX "WorldTerritoryWarLock_warId_key" ON "WorldTerritoryWarLock"("warId");
CREATE INDEX "WorldAllianceWar_territoryId_createdAt_idx" ON "WorldAllianceWar"("territoryId", "createdAt");
CREATE INDEX "WorldTerritory_controllerAllianceId_idx" ON "WorldTerritory"("controllerAllianceId");

ALTER TABLE "WorldAllianceWar" ADD CONSTRAINT "WorldAllianceWar_territoryId_fkey"
    FOREIGN KEY ("territoryId") REFERENCES "WorldTerritory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorldTerritory" ADD CONSTRAINT "WorldTerritory_controllerAllianceId_fkey"
    FOREIGN KEY ("controllerAllianceId") REFERENCES "WorldAlliance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorldTerritoryWarLock" ADD CONSTRAINT "WorldTerritoryWarLock_territoryId_fkey"
    FOREIGN KEY ("territoryId") REFERENCES "WorldTerritory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorldTerritoryWarLock" ADD CONSTRAINT "WorldTerritoryWarLock_warId_fkey"
    FOREIGN KEY ("warId") REFERENCES "WorldAllianceWar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "WorldTerritory" ("id", "name", "description", "dailyWood", "dailyStone") VALUES
    ('ironwood', 'Rừng Thiết Mộc', 'Vùng rừng chiến lược ở phía bắc.', 180, 20),
    ('granite-pass', 'Ải Đá Xám', 'Cửa ải hiểm yếu nối liền các vùng đất.', 80, 120),
    ('emerald-valley', 'Thung lũng Lục Bảo', 'Thung lũng màu mỡ giữa bản đồ.', 120, 80),
    ('sun-coast', 'Bờ biển Ánh Dương', 'Dải bờ biển có vị trí giao thương quan trọng.', 100, 100),
    ('frost-peak', 'Đỉnh Băng Giá', 'Cao địa khó tiếp cận nhưng giàu giá trị chiến lược.', 60, 140);
