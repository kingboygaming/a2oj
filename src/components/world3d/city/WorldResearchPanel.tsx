"use client";

import {
  WORLD_RESEARCH_DEFINITIONS,
  WORLD_RESEARCH_KEYS,
  worldMilitaryTierName,
  type WorldResearchKey,
  type WorldResearchStep,
} from "@/lib/world-research";

type ResearchView = {
  key: WorldResearchKey;
  level: number;
};

type ActiveResearch = {
  key: WorldResearchKey;
  level: number;
  completesAt: string;
} | null;

const RESOURCE_LABELS: Array<[keyof WorldResearchStep["cost"], string]> = [
  ["wood", "gỗ"],
  ["stone", "đá"],
  ["iron", "sắt"],
  ["food", "lương thực"],
  ["rare", "hiếm"],
];

export function WorldResearchPanel({
  research,
  activeResearch,
  militaryTier,
  researchSpeedLevel,
  castleLevel,
  resources,
  busy,
  onStart,
}: {
  research: ResearchView[];
  activeResearch: ActiveResearch;
  militaryTier: number;
  researchSpeedLevel: number;
  castleLevel: number;
  resources: WorldResearchStep["cost"];
  busy: boolean;
  onStart: (key: WorldResearchKey) => void;
}) {
  const levels = new Map(research.map((entry) => [entry.key, entry.level]));

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-amber-200/15 bg-gradient-to-br from-amber-300/10 to-transparent p-4">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-200/70">Viện nghiên cứu</p>
        <p className="mt-1 text-lg font-bold text-white">Quân đội cấp {worldMilitaryTierName(militaryTier)}</p>
        <p className="mt-1 text-xs text-white/55">
          Hiệu suất sản xuất +{(levels.get("PRODUCTION_EFFICIENCY") ?? 0) * 10}% · tốc độ nghiên cứu −{researchSpeedLevel * 10}%
        </p>
        {activeResearch && (
          <p className="mt-3 rounded-lg bg-sky-300/10 px-3 py-2 text-xs text-sky-100">
            Đang nghiên cứu {WORLD_RESEARCH_DEFINITIONS[activeResearch.key].step(activeResearch.level).name}
            {" · "}hoàn tất {new Date(activeResearch.completesAt).toLocaleString("vi-VN")}
          </p>
        )}
      </div>

      {WORLD_RESEARCH_KEYS.map((key) => {
        const definition = WORLD_RESEARCH_DEFINITIONS[key];
        const level = levels.get(key) ?? 0;
        const nextStep = level < definition.maxLevel ? definition.step(level + 1) : null;
        const effectiveSeconds = nextStep
          ? Math.max(30, Math.ceil(nextStep.durationSeconds * Math.max(0.5, 1 - researchSpeedLevel * 0.1)))
          : 0;
        const affordable = nextStep
          ? RESOURCE_LABELS.every(([resource]) => resources[resource] >= nextStep.cost[resource])
          : false;
        const currentEffect = level > 0
          ? key === "MILITARY_TIER"
            ? `Quân đội cấp ${worldMilitaryTierName(level)} · ${WORLD_RESEARCH_DEFINITIONS[key].step(level).effect}`
            : definition.step(level).effect
          : key === "MILITARY_TIER"
            ? "Quân đội cấp Đá · chưa có thưởng nghiên cứu."
            : "Chưa nghiên cứu.";
        const researching = activeResearch?.key === key;

        return (
          <section key={key} className="rounded-xl border border-white/10 bg-[#211f1a]/75 p-4 text-amber-50">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold">{definition.name}</h3>
                <p className="mt-1 text-xs text-white/55">{definition.description}</p>
              </div>
              <span className="shrink-0 rounded-full bg-white/10 px-2 py-1 text-[10px] text-white/70">
                {level}/{definition.maxLevel}
              </span>
            </div>
            <p className="mt-2 text-xs text-emerald-200/80">{currentEffect}</p>
            {nextStep ? (
              <>
                <p className="mt-3 text-xs font-semibold text-amber-100">{nextStep.name} · {formatDuration(effectiveSeconds)}</p>
                <p className="mt-1 text-[10px] leading-5 text-white/50">
                  {RESOURCE_LABELS
                    .filter(([resource]) => nextStep.cost[resource] > 0)
                    .map(([resource, label]) => `${nextStep.cost[resource]} ${label}`)
                    .join(" · ")}
                  {" · "}{nextStep.effect}
                </p>
                <button
                  type="button"
                  disabled={busy || Boolean(activeResearch) || !affordable || castleLevel < nextStep.castleLevel}
                  onClick={() => onStart(key)}
                  className="mt-3 rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {researching ? "Đang nghiên cứu..." : `Bắt đầu ${nextStep.name}`}
                </button>
                {castleLevel < nextStep.castleLevel && (
                  <p className="mt-2 text-[10px] text-rose-200/70">Cần Thành chính cấp {nextStep.castleLevel}.</p>
                )}
              </>
            ) : (
              <p className="mt-3 text-xs text-amber-200/60">Đã đạt cấp tối đa hiện tại.</p>
            )}
          </section>
        );
      })}
    </div>
  );
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds} giây`;
  const minutes = Math.ceil(seconds / 60);
  return minutes < 60 ? `${minutes} phút` : `${Math.ceil(minutes / 60)} giờ`;
}
