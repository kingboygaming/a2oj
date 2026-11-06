import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RoadmapView } from "@/components/RoadmapView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Lộ trình học thuật toán | A2OJ",
  description: "Lộ trình gợi ý để học và luyện tập thuật toán từ cơ bản đến nâng cao.",
};

export default async function RoadmapPage() {
  const [user, savedStages] = await Promise.all([
    getCurrentUser(),
    prisma.roadmapStage.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
  ]);
  const stages = savedStages.map((stage) => ({
    id: stage.id,
    level: stage.level,
    title: stage.title,
    description: stage.description,
    topics: JSON.parse(stage.topics) as string[],
    checkpoint: stage.checkpoint,
    resources: JSON.parse(stage.resources) as { label: string; href: string }[],
  }));

  return <RoadmapView stages={stages} isAdmin={user?.role === "ADMIN"} />;
}
