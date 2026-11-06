import Link from "next/link";
import { notFound } from "next/navigation";
import { RoadmapStageForm } from "@/components/RoadmapStageForm";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function NewRoadmapStagePage() {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") notFound();
  const lastStage = await prisma.roadmapStage.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/wiki/roadmap/manage" className="text-sm font-medium text-[var(--teal)] hover:underline">← Quản lý lộ trình</Link>
      <div>
        <h1 className="text-3xl font-semibold text-[var(--navy)]">Thêm chặng học</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Chọn thứ tự để sắp xếp chặng trên trang roadmap.</p>
      </div>
      <RoadmapStageForm initialSortOrder={(lastStage?.sortOrder ?? 0) + 1} />
    </div>
  );
}
