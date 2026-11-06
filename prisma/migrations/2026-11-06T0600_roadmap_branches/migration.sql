ALTER TABLE "RoadmapStage"
ADD COLUMN "parentId" TEXT;

CREATE INDEX "RoadmapStage_parentId_sortOrder_idx"
ON "RoadmapStage"("parentId", "sortOrder");

ALTER TABLE "RoadmapStage"
ADD CONSTRAINT "RoadmapStage_parentId_fkey"
FOREIGN KEY ("parentId") REFERENCES "RoadmapStage"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
