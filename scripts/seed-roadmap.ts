import { prisma } from "../src/lib/prisma";
import { defaultRoadmapStages } from "../src/lib/roadmap-defaults";

async function main() {
  const stageCount = await prisma.roadmapStage.count();
  if (stageCount === 0) {
    await prisma.roadmapStage.createMany({
      data: defaultRoadmapStages.map((stage) => ({
        ...stage,
        topics: JSON.stringify(stage.topics),
        resources: JSON.stringify(stage.resources),
      })),
    });
    return;
  }

  for (const stage of defaultRoadmapStages) {
    await prisma.roadmapStage.updateMany({
      where: { id: stage.id, content: "" },
      data: { content: stage.content },
    });
  }
}

main()
  .catch((error: unknown) => {
    console.error("Failed to seed roadmap stages:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
