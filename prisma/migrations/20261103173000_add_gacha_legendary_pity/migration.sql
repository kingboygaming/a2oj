ALTER TABLE "GachaBanner" ADD COLUMN "legendaryPity" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "UserGachaBannerPity" (
    "userId" TEXT NOT NULL,
    "bannerId" TEXT NOT NULL,
    "failedPulls" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "UserGachaBannerPity_pkey" PRIMARY KEY ("userId", "bannerId")
);

ALTER TABLE "UserGachaBannerPity" ADD CONSTRAINT "UserGachaBannerPity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserGachaBannerPity" ADD CONSTRAINT "UserGachaBannerPity_bannerId_fkey" FOREIGN KEY ("bannerId") REFERENCES "GachaBanner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
