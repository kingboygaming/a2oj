"use client";

import { useState } from "react";
import {
  WORLD_BUILDING_DEFINITIONS,
  WORLD_BUILDING_TYPES,
  type WorldBuildingType,
  type WorldBuildingView,
} from "@/lib/world-buildings";

export function CityBuildingPanel({
  plotIndex,
  building,
  castleLevel,
  wood,
  stone,
  busy,
  onChoose,
  onAction,
}: {
  plotIndex: number | null;
  building: WorldBuildingView | null;
  castleLevel: number;
  wood: number;
  stone: number;
  busy: boolean;
  onChoose: (type: WorldBuildingType) => void;
  onAction: (action: "BUILD" | "UPGRADE" | "DEMOLISH", plotIndex: number, type?: WorldBuildingType) => void;
}) {
  const [confirmDemolish, setConfirmDemolish] = useState(false);

  if (plotIndex === null) {
    return (
      <div className="rounded-xl border border-amber-100/10 bg-[#211f1a]/70 p-4 text-sm text-amber-50/75">
        <p className="font-bold text-amber-100">Đất xây dựng</p>
        <p className="mt-2 text-xs leading-5 text-white/55">Chọn một ô viền xanh trong thành phố để xem công trình khả dụng và đặt bản xem trước.</p>
      </div>
    );
  }

  if (building) {
    const definition = WORLD_BUILDING_DEFINITIONS[building.type];
    const effectiveLevel = building.pendingLevel ?? building.level;
    const nextLevel = effectiveLevel + 1;
    const woodCost = definition.woodCost * nextLevel;
    const stoneCost = definition.stoneCost * nextLevel;
    const inProgress = building.status !== "COMPLETED";
    return (
      <div className="rounded-xl border border-amber-100/15 bg-[#211f1a]/80 p-4 text-amber-50">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300/70">Ô đất {plotIndex + 1}</p>
        <h3 className="mt-1 text-lg font-bold">{definition.name}</h3>
        <p className="mt-1 text-xs text-white/55">
          {inProgress
            ? `Đang ${building.status === "UPGRADING" ? "nâng cấp" : "xây dựng"} · hoàn tất ${new Date(building.completesAt).toLocaleString("vi-VN")}`
            : `Cấp ${effectiveLevel} · ${definition.description}`}
        </p>
        {!inProgress && (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || nextLevel > 20 || wood < woodCost || stone < stoneCost}
              onClick={() => onAction("UPGRADE", plotIndex)}
              className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
            >
              Nâng cấp · {woodCost} gỗ / {stoneCost} đá
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmDemolish(true)}
              className="rounded-lg border border-rose-300/30 px-3 py-2 text-xs font-bold text-rose-200 disabled:opacity-40"
            >
              Phá dỡ
            </button>
          </div>
        )}
        {confirmDemolish && (
          <div className="mt-3 rounded-lg border border-rose-300/20 bg-rose-950/30 p-3 text-xs">
            <p>Phá dỡ sẽ xóa công trình và hoàn lại 25% chi phí mỗi cấp.</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setConfirmDemolish(false);
                  onAction("DEMOLISH", plotIndex);
                }}
                className="rounded bg-rose-700 px-3 py-1.5 font-bold"
              >
                Xác nhận
              </button>
              <button type="button" onClick={() => setConfirmDemolish(false)} className="rounded bg-white/10 px-3 py-1.5">
                Hủy
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-200/15 bg-[#211f1a]/80 p-4 text-amber-50">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300/75">Ô đất trống · {plotIndex + 1}</p>
      <h3 className="mt-1 text-lg font-bold">Chọn công trình</h3>
      <p className="mt-1 text-xs text-white/50">Chọn công trình để đặt ghost preview, sau đó xác nhận xây dựng.</p>
      {(["Quân sự", "Kinh tế"] as const).map((group) => (
        <div key={group} className="mt-4">
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-amber-200/70">{group}</h4>
          <div className="space-y-1.5">
            {WORLD_BUILDING_TYPES.filter((type) => WORLD_BUILDING_DEFINITIONS[type].group === group).map((type) => {
              const definition = WORLD_BUILDING_DEFINITIONS[type];
              const unlocked = castleLevel >= definition.requiredCastleLevel;
              const affordable = wood >= definition.woodCost && stone >= definition.stoneCost;
              return (
                <button
                  key={type}
                  type="button"
                  disabled={busy || !unlocked || !affordable}
                  onClick={() => onChoose(type)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-white/8 bg-white/[0.035] px-3 py-2 text-left hover:border-emerald-300/30 hover:bg-emerald-300/5 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <span>
                    <span className="block text-xs font-semibold">{definition.name}</span>
                    <span className="mt-0.5 block text-[10px] text-white/45">{definition.description}</span>
                  </span>
                  <span className="shrink-0 text-right text-[10px] text-amber-100/65">
                    {unlocked ? `${definition.woodCost}🪵 ${definition.stoneCost}🪨` : `Thành cấp ${definition.requiredCastleLevel}`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
