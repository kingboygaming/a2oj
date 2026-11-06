import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminDeleteButton } from "@/components/AdminDeleteButton";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ManageRoadmapPage() {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") notFound();

  const stages = await prisma.roadmapStage.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link href="/wiki/roadmap" className="text-sm font-medium text-[var(--teal)] hover:underline">← Xem lộ trình</Link>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[var(--teal)]">QUẢN TRỊ WIKI</p>
          <h1 className="mt-1 text-3xl font-semibold text-[var(--navy)]">Quản lý lộ trình</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">Chỉ quản trị viên có thể thêm, sửa, sắp xếp hoặc xóa chặng.</p>
        </div>
        <Link href="/wiki/roadmap/new" className="rounded-md bg-[var(--teal)] px-4 py-2 text-sm font-medium text-white">Thêm chặng</Link>
      </header>
      <section className="space-y-3">
        {stages.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--line)] p-5 text-sm text-[var(--muted)]">Chưa có chặng học nào.</p>
        ) : stages.map((stage) => (
          <article key={stage.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[var(--teal)]">CHẶNG {stage.sortOrder} · {stage.level}</p>
              <h2 className="mt-1 font-semibold text-[var(--navy)]">{stage.title}</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">{stage.description}</p>
            </div>
            <div className="flex items-center gap-2">
              <Link href={`/wiki/roadmap/${stage.id}/edit`} className="rounded-md border border-[var(--line)] px-3 py-1.5 text-sm hover:border-[var(--teal)]">Sửa</Link>
              <AdminDeleteButton endpoint={`/api/wiki/roadmap/${stage.id}`} confirmation={`Xóa chặng “${stage.title}”?`} />
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
