import Link from "next/link";
import { notFound } from "next/navigation";
import { RoadmapStageForm } from "@/components/RoadmapStageForm";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function EditRoadmapStagePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") notFound();

  const { id } = await params;
  const stage = await prisma.roadmapStage.findUnique({ where: { id } });
  if (!stage) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/wiki/roadmap/manage" className="text-sm font-medium text-[var(--teal)] hover:underline">← Quản lý lộ trình</Link>
      <div>
        <h1 className="text-3xl font-semibold text-[var(--navy)]">Sửa chặng học</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Thay đổi nội dung hiển thị công khai trên lộ trình.</p>
      </div>
      <RoadmapStageForm stage={{
        ...stage,
        topics: JSON.parse(stage.topics) as string[],
        resources: JSON.parse(stage.resources) as { label: string; href: string }[],
      }} />
    </div>
  );
}
