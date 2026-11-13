ALTER TABLE "WorldBase" ADD COLUMN "coordinateX" INTEGER;
ALTER TABLE "WorldBase" ADD COLUMN "coordinateZ" INTEGER;

CREATE UNIQUE INDEX "WorldBase_coordinateX_coordinateZ_key" ON "WorldBase"("coordinateX", "coordinateZ");

CREATE TABLE "WorldMapAllocator" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "revision" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "WorldMapAllocator_pkey" PRIMARY KEY ("id")
);

INSERT INTO "WorldMapAllocator" ("id", "revision") VALUES (1, 0);
