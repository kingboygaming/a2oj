import Link from "next/link";
import { notFound } from "next/navigation";
import { RoadmapStageForm } from "@/components/RoadmapStageForm";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function NewRoadmapStagePage({
  searchParams,
}: {
  searchParams: Promise<{ parentId?: string }>;
}) {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") notFound();
  const { parentId: requestedParentId } = await searchParams;
  const [lastRoot, parents, selectedParent] = await Promise.all([
    prisma.roadmapStage.findFirst({
      where: requestedParentId ? { parentId: requestedParentId } : { parentId: null },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    }),
    prisma.roadmapStage.findMany({ where: { parentId: null }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true, title: true, level: true } }),
    requestedParentId
      ? prisma.roadmapStage.findFirst({ where: { id: requestedParentId, parentId: null }, select: { id: true, level: true } })
      : null,
  ]);
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/wiki/roadmap/manage" className="text-sm font-medium text-[var(--teal)] hover:underline">← Quản lý lộ trình</Link>
      <div>
        <h1 className="text-3xl font-semibold text-[var(--navy)]">Thêm chặng học</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Chọn thứ tự để sắp xếp chặng trên trang roadmap.</p>
      </div>
      <RoadmapStageForm
        parents={parents}
        initialSortOrder={(lastRoot?.sortOrder ?? 0) + 1}
        initialParentId={selectedParent?.id}
        initialLevel={selectedParent?.level}
      />
    </div>
  );
}
