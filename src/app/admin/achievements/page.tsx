import Link from "next/link";
import { notFound } from "next/navigation";
import { AchievementAdminForm } from "@/components/AchievementAdminForm";
import { AdminDeleteButton } from "@/components/AdminDeleteButton";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const rarityNames: Record<string, string> = { COMMON: "Common", UNCOMMON: "Uncommon", RARE: "Rare", EPIC: "Epic", LEGENDARY: "Legendary", SECRET: "Secret" };
const triggerNames: Record<string, string> = { SOLVED_PROBLEMS: "Giải bài", CONTESTS: "Tham gia contest", CONTEST_PODIUMS: "Top 3 contest", CONTEST_WINS: "Vô địch contest", RANK_POINTS: "Điểm rank", PROBLEM_AC: "AC bài cụ thể", HEURISTIC_SCORE: "Điểm heuristic" };

export default async function AdminAchievementsPage() {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") notFound();
  const achievements = await prisma.achievement.findMany({ orderBy: [{ rarity: "asc" }, { createdAt: "desc" }] });
  return <div>
    <Link href="/admin" className="text-sm font-medium text-[var(--teal)] hover:underline">← Quay lại quản trị</Link>
    <header className="mb-6 mt-4"><p className="text-sm font-medium uppercase tracking-wide text-[var(--teal)]">Quản trị cộng đồng</p><h1 className="mt-1 text-3xl font-semibold text-[var(--navy)]">Thành tựu</h1><p className="mt-2 text-sm text-[var(--muted)]">Thành tựu Secret được giấu cho tới khi người dùng vô tình thỏa điều kiện.</p></header>
    <AchievementAdminForm />
    <section className="mt-8 space-y-3"><h2 className="text-lg font-semibold text-[var(--navy)]">Thành tựu đã tạo ({achievements.length})</h2>
      {achievements.length === 0 ? <p className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-5 text-sm text-[var(--muted)]">Chưa có thành tựu tùy chỉnh.</p> : achievements.map((achievement) => <article key={achievement.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-4">
        <div className="min-w-0"><p className="font-semibold text-[var(--navy)]">{achievement.icon} {achievement.title} <span className="ml-1 rounded-full bg-[var(--navy)]/5 px-2 py-0.5 text-[10px] uppercase text-[var(--muted)]">{rarityNames[achievement.rarity] ?? achievement.rarity}</span></p>
          <p className="mt-1 text-sm text-[var(--muted)]">{achievement.description}</p><p className="mt-1 text-xs text-[var(--muted)]">{triggerNames[achievement.triggerType] ?? achievement.triggerType} · mốc {achievement.threshold}{achievement.problemSlug ? ` · ${achievement.problemSlug}` : ""}{achievement.secret ? " · Ẩn đến khi mở khóa" : ""}{achievement.nameColorEnabled ? ` · Màu ${achievement.nameColor}` : ""}</p></div>
        <AdminDeleteButton endpoint={`/api/admin/achievements/${achievement.id}`} confirmation={`Xóa thành tựu “${achievement.title}”?`} />
      </article>)}
    </section>
  </div>;
}
