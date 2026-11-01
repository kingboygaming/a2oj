import type { RankBadge } from "@/lib/ranks";
import { NameColorPreference } from "@/components/NameColorPreference";

const rarityStyles: Record<string, string> = {
  COMMON: "bg-slate-100 text-slate-700", UNCOMMON: "bg-emerald-100 text-emerald-800",
  RARE: "bg-blue-100 text-blue-800", EPIC: "bg-violet-100 text-violet-800",
  LEGENDARY: "bg-amber-100 text-amber-900", SECRET: "bg-fuchsia-100 text-fuchsia-900",
};

export function RankSummary({ summary, showColorPreference = false }: { summary: { points: number; problemPoints: number; contestPoints: number; cePenalty: number; solvedCount: number; rank: { name: string; min: number; color: string; badge: string }; nextRank: { name: string; min: number } | undefined; badges: RankBadge[]; nameColorMode: string; nameColorAchievementId: string | null }; showColorPreference?: boolean }) {
  const earned = summary.badges.filter((badge) => badge.earned);
  const colorAchievements = earned.filter((badge) => badge.achievementId && badge.nameColorEnabled);
  const progress = summary.nextRank ? Math.max(0, Math.min(100, Math.round(((summary.points - summary.rank.min) / (summary.nextRank.min - summary.rank.min)) * 100))) : 100;
  return <section className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-sm text-[var(--muted)]">Rank hiện tại</p><h2 className={`mt-1 text-2xl font-bold ${summary.rank.color}`}>{summary.rank.badge} {summary.rank.name}</h2><p className="mt-1 text-sm"><strong>{summary.points.toLocaleString("vi-VN")}</strong> điểm · {summary.solvedCount} bài AC</p></div>
      <div className="text-right text-xs text-[var(--muted)]"><p>{summary.problemPoints} điểm từ problem</p>{summary.cePenalty > 0 && <p className="text-rose-600">−{summary.cePenalty} điểm phạt CE</p>}<p>{summary.contestPoints} điểm thưởng contest</p></div>
    </div>
    <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--line)]"><div className="h-full rounded-full bg-[var(--teal)] transition-all" style={{ width: `${progress}%` }} /></div>
    <p className="mt-2 text-xs text-[var(--muted)]">{summary.nextRank ? `${(summary.nextRank.min - summary.points).toLocaleString("vi-VN")} điểm nữa để lên ${summary.nextRank.name}` : "Bạn đã đạt rank cao nhất!"}</p>
    <div className="mt-5"><h3 className="text-sm font-semibold">Huy hiệu ({earned.length}/{summary.badges.length})</h3><div className="mt-2 flex flex-wrap gap-2">{summary.badges.map((badge) => <span key={badge.key} title={badge.description} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs ${badge.earned ? "border-amber-300 bg-amber-50 text-amber-900" : "border-[var(--line)] text-[var(--muted)] opacity-55"}`}><span>{badge.icon}</span>{badge.title}<span className={`rounded-full px-1.5 py-0.5 text-[9px] uppercase ${rarityStyles[badge.rarity] ?? "bg-slate-100 text-slate-700"}`}>{badge.rarity}</span></span>)}</div></div>
    {showColorPreference && <NameColorPreference mode={summary.nameColorMode} achievementId={summary.nameColorAchievementId} achievements={colorAchievements} />}
    <p className="mt-4 text-[11px] text-[var(--muted)]">AC lần đầu ở phần luyện tập: Dễ +3, Trung bình +8, Khó +15. CE liên tiếp cùng bài luyện tập: −10, −20, −40...; lượt khác CE sẽ đặt lại chuỗi. Contest bật tính rank thưởng top 3: +100, +70, +50 điểm.</p>
  </section>;
}
