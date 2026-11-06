import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RoadmapLesson } from "@/components/RoadmapLesson";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Bài học lộ trình | A2OJ",
  description: "Học từng bước lập trình thi đấu theo lộ trình A2OJ.",
};

export default async function RoadmapLessonPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, user] = await Promise.all([params, getCurrentUser()]);
  const [currentStage, stages] = await Promise.all([
    prisma.roadmapStage.findUnique({ where: { id } }),
    prisma.roadmapStage.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        sortOrder: true,
        level: true,
        title: true,
        description: true,
        topics: true,
        checkpoint: true,
        resources: true,
      },
    }),
  ]);
  if (!currentStage) notFound();

  const lessonStages = stages.map((stage) => ({
    id: stage.id,
    sortOrder: stage.sortOrder,
    level: stage.level,
    title: stage.title,
    description: stage.description,
    topics: JSON.parse(stage.topics) as string[],
    content: stage.id === currentStage.id ? currentStage.content : "",
    checkpoint: stage.checkpoint,
    resources: JSON.parse(stage.resources) as { label: string; href: string }[],
  }));

  return (
    <RoadmapLesson
      stages={lessonStages}
      currentStageId={currentStage.id}
      isAdmin={user?.role === "ADMIN"}
    />
  );
}
