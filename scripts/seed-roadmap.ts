import { prisma } from "../src/lib/prisma";
import { defaultRoadmapStages } from "../src/lib/roadmap-defaults";

async function main() {
  const stageCount = await prisma.roadmapStage.count();
  if (stageCount > 0) return;

  await prisma.roadmapStage.createMany({
    data: defaultRoadmapStages.map((stage) => ({
      ...stage,
      topics: JSON.stringify(stage.topics),
      resources: JSON.stringify(stage.resources),
    })),
  });
}

main()
  .catch((error: unknown) => {
    console.error("Failed to seed roadmap stages:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
