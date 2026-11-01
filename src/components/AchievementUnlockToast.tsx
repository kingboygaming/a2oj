"use client";

import { useEffect, useRef, useState } from "react";
import type { RankBadge } from "@/lib/ranks";

const rarityLabel: Record<string, string> = {
  COMMON: "Common", UNCOMMON: "Uncommon", RARE: "Rare", EPIC: "Epic", LEGENDARY: "Legendary", SECRET: "Secret",
};
const rarityStyle: Record<string, string> = {
  COMMON: "border-slate-400/50",
  UNCOMMON: "border-emerald-400/60",
  RARE: "border-sky-400/70",
  EPIC: "border-violet-400/80",
  LEGENDARY: "border-amber-300 shadow-amber-400/20",
  SECRET: "border-fuchsia-300 shadow-fuchsia-500/30",
};

export function AchievementUnlockToast({ achievements }: { achievements: RankBadge[] }) {
  const [queue, setQueue] = useState<RankBadge[]>([]);
  const [active, setActive] = useState<RankBadge | null>(null);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    const fresh = achievements.filter((achievement) => {
      if (seen.current.has(achievement.key)) return false;
      seen.current.add(achievement.key);
      return true;
    });
    if (fresh.length) setQueue((current) => [...current, ...fresh]);
  }, [achievements]);

  useEffect(() => {
    if (active || queue.length === 0) return;
    setActive(queue[0]);
    setQueue((current) => current.slice(1));
  }, [active, queue]);

  useEffect(() => {
    if (!active) return;
    const timeout = window.setTimeout(() => setActive(null), 5200);
    return () => window.clearTimeout(timeout);
  }, [active]);

  if (!active) return null;
  return <div className="pointer-events-none fixed right-4 top-20 z-[100] w-[min(22rem,calc(100vw-2rem))]" aria-live="polite" aria-atomic="true">
    <div key={active.key} className={`achievement-toast-enter rounded-xl border-2 bg-[#20242c] p-4 text-white shadow-2xl ${rarityStyle[active.rarity] ?? "border-slate-400/50"}`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-200">Đã mở khóa thành tựu!</p>
      <div className="mt-2 flex items-center gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-white/10 text-3xl">{active.icon}</span>
        <div className="min-w-0">
          <p className="truncate font-semibold">{active.title}</p>
          <p className="mt-0.5 text-xs text-amber-100">{rarityLabel[active.rarity] ?? active.rarity}</p>
        </div>
      </div>
      <p className="mt-2 line-clamp-2 text-xs text-white/70">{active.description}</p>
    </div>
  </div>;
}
