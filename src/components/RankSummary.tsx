import type { RankBadge } from "@/lib/ranks";

export function RankSummary({ summary }: { summary: { points: number; problemPoints: number; contestPoints: number; solvedCount: number; rank: { name: string; min: number; color: string; badge: string }; nextRank: { name: string; min: number } | undefined; badges: RankBadge[] } }) {
  const earned = summary.badges.filter((badge) => badge.earned);
  const progress = summary.nextRank ? Math.min(100, Math.round(((summary.points - summary.rank.min) / (summary.nextRank.min - summary.rank.min)) * 100)) : 100;
  return <section className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-sm text-[var(--muted)]">Rank hiện tại</p><h2 className={`mt-1 text-2xl font-bold ${summary.rank.color}`}>{summary.rank.badge} {summary.rank.name}</h2><p className="mt-1 text-sm"><strong>{summary.points.toLocaleString("vi-VN")}</strong> điểm · {summary.solvedCount} bài AC</p></div>
      <div className="text-right text-xs text-[var(--muted)]"><p>{summary.problemPoints} điểm từ problem</p><p>{summary.contestPoints} điểm thưởng contest</p></div>
    </div>
    <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--line)]"><div className="h-full rounded-full bg-[var(--teal)] transition-all" style={{ width: `${progress}%` }} /></div>
    <p className="mt-2 text-xs text-[var(--muted)]">{summary.nextRank ? `${(summary.nextRank.min - summary.points).toLocaleString("vi-VN")} điểm nữa để lên ${summary.nextRank.name}` : "Bạn đã đạt rank cao nhất!"}</p>
    <div className="mt-5"><h3 className="text-sm font-semibold">Huy hiệu ({earned.length}/{summary.badges.length})</h3><div className="mt-2 flex flex-wrap gap-2">{summary.badges.map((badge) => <span key={badge.key} title={badge.description} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs ${badge.earned ? "border-amber-300 bg-amber-50 text-amber-900" : "border-[var(--line)] text-[var(--muted)] opacity-55"}`}><span>{badge.icon}</span>{badge.title}</span>)}</div></div>
    <p className="mt-4 text-[11px] text-[var(--muted)]">AC lần đầu: Dễ +3, Trung bình +8, Khó +15. Top 3 contest đã kết thúc: +100, +70, +50 điểm.</p>
  </section>;
}
