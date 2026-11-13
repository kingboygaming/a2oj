"use client";

import { useState } from "react";
import {
  resourceKindLabel,
  type WorldMapObject,
} from "@/lib/world-map-objects";
import type { WorldMapMissionView, WorldMapObjectState } from "@/lib/world";
import { worldMilitaryTierName } from "@/lib/world-research";

type ArmyCounts = { infantry: number; archers: number; cavalry: number };

export function WorldObjectPanel({
  object,
  state,
  army,
  militaryTier,
  isOwner,
  mission,
  onDispatch,
  onGather,
  onClose,
}: {
  object: WorldMapObject;
  state: WorldMapObjectState;
  army: ArmyCounts;
  militaryTier: number;
  isOwner: boolean;
  mission: WorldMapMissionView | null;
  onDispatch: (troops: ArmyCounts) => Promise<string>;
  onGather: () => Promise<string>;
  onClose: () => void;
}) {
  const [troops, setTroops] = useState<ArmyCounts>({ infantry: 0, archers: 0, cavalry: 0 });
  const [result, setResult] = useState("");
  const [resultIsError, setResultIsError] = useState(false);
  const [busy, setBusy] = useState(false);

  const troopPower = Math.floor(
    (troops.infantry * 10 + troops.archers * 15 + troops.cavalry * 20) * (1 + militaryTier * 0.25),
  );
  const allocated = troops.infantry + troops.archers + troops.cavalry;
  const resource = object.kind === "RESOURCE";
  const resourceState = state.kind === "RESOURCE" ? state : null;
  const campState = state.kind === "ROGUE_CAMP" ? state : null;
  const remaining = resourceState?.remaining ?? 0;
  const depleted = resource && (remaining <= 0 || resourceState?.status === "DEPLETED");
  const cooldown = campState?.status === "COOLDOWN";
  const ownerName = resourceState?.ownerUserId
    ? isOwner ? "Bạn" : resourceState.ownerName ?? "Người chơi khác"
    : null;
  const tierLabel = object.kind === "ROGUE_CAMP"
    ? object.tier === "ELITE" ? "Tinh anh" : `Cấp ${object.level}`
    : `Cấp ${object.level}`;

  function setTroopCount(type: keyof ArmyCounts, value: number) {
    setTroops((current) => ({
      ...current,
      [type]: Math.min(army[type], 500, Math.max(0, value)),
    }));
  }

  async function runAction(action: () => Promise<string>) {
    setBusy(true);
    setResult("");
    setResultIsError(false);
    try {
      setResult(await action());
    } catch (error) {
      setResultIsError(true);
      setResult(error instanceof Error ? error.message : "Không thể hoàn tất thao tác.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="pointer-events-auto w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-amber-100/20 bg-[#171b19]/95 text-amber-50 shadow-2xl shadow-black/50 backdrop-blur-xl">
      <header className="flex items-start justify-between gap-3 border-b border-white/10 bg-gradient-to-r from-[#685034]/50 to-transparent p-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300/75">
            {resource ? "Khu tài nguyên" : "Trại lưu khấu"}
          </p>
          <h2 className="mt-1 text-base font-bold">{object.name}</h2>
          <p className="mt-1 text-xs text-white/55">{tierLabel}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng thông tin khu vực"
          className="rounded-full px-2 py-1 text-lg leading-none text-white/55 hover:bg-white/10 hover:text-white"
        >
          ×
        </button>
      </header>

      <div className="space-y-3 p-4 text-sm">
        {resource ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Info label="Tài nguyên" value={resourceKindLabel(object.resource)} />
              <Info label="Trữ lượng" value={`${remaining.toLocaleString("vi-VN")} còn lại`} />
              <Info label="Sản lượng" value={`${object.yieldPerMinute}/phút`} />
              <Info label="Chủ sở hữu" value={ownerName ?? "Chưa chiếm"} />
            </div>
            <p className="rounded-lg border border-amber-300/15 bg-amber-200/5 px-3 py-2 text-xs text-amber-100/70">
              Yêu cầu chiến lực {object.requiredPower.toLocaleString("vi-VN")}.
              {resourceState?.occupiedUntil ? ` Hết hạn ${new Date(resourceState.occupiedUntil).toLocaleString("vi-VN")}.` : ""}
              {resourceState?.respawnsAt ? ` Tái tạo ${new Date(resourceState.respawnsAt).toLocaleString("vi-VN")}.` : ""}
            </p>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Info label="Loài quái" value={object.monsterType} />
              <Info label="Quân số" value={`${object.troopCount} đơn vị`} />
              <Info label="Chiến lực" value={object.combatPower.toLocaleString("vi-VN")} />
              <Info label="Phần thưởng dự kiến" value={object.reward} />
            </div>
            <p className="rounded-lg border border-rose-300/15 bg-rose-200/5 px-3 py-2 text-xs text-rose-100/70">
              {cooldown && campState?.availableAt
                ? `Trại đang hồi phục đến ${new Date(campState.availableAt).toLocaleString("vi-VN")}.`
                : object.tier === "ELITE" ? "Khu vực tinh anh — nguy hiểm cao." : `Mối đe dọa cấp ${object.level}.`}
            </p>
          </>
        )}

        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-white/75">Điều quân</p>
            <p className="text-[10px] text-white/45">Chiến lực chọn: {troopPower} · cấp {worldMilitaryTierName(militaryTier)}</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {([
              ["infantry", "Bộ binh"],
              ["archers", "Cung thủ"],
              ["cavalry", "Kỵ binh"],
            ] as const).map(([type, label]) => (
              <label key={type} className="text-[10px] text-white/50">
                {label} · {army[type]}
                <input
                  type="number"
                  min={0}
                  max={Math.min(army[type], 500)}
                  value={troops[type]}
                  onChange={(event) => setTroopCount(type, Number(event.target.value) || 0)}
                  className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white"
                />
              </label>
            ))}
          </div>
        </div>

        {mission?.report && (
          <p className="rounded-lg border border-sky-300/20 bg-sky-300/10 px-3 py-2 text-xs text-sky-100">
            {mission.report}
          </p>
        )}
        {result && (
          <p
            role={resultIsError ? "alert" : "status"}
            className={`rounded-lg border px-3 py-2 text-xs ${
              resultIsError
                ? "border-rose-300/20 bg-rose-300/10 text-rose-100"
                : "border-emerald-300/20 bg-emerald-300/10 text-emerald-100"
            }`}
          >
            {result}
          </p>
        )}

        {resource ? (
          <div className="flex gap-2">
            {isOwner ? (
              <button
                type="button"
                disabled={busy || depleted}
                onClick={() => void runAction(onGather)}
                className="flex-1 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? "Đang khai thác..." : depleted ? "Đã cạn" : "Thu hoạch tài nguyên"}
              </button>
            ) : (
              <button
                type="button"
                disabled={busy || depleted || allocated === 0 || troopPower < object.requiredPower}
                onClick={() => void runAction(() => onDispatch(troops))}
                className="flex-1 rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? "Đang điều quân..." : depleted ? "Đã cạn" : ownerName ? "Tranh chấp khu vực" : "Điều quân chiếm đóng"}
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            disabled={busy || cooldown || allocated === 0}
            onClick={() => void runAction(() => onDispatch(troops))}
            className="w-full rounded-lg bg-rose-700 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Đang điều quân..." : cooldown ? "Trại đang hồi phục" : "Điều quân tấn công"}
          </button>
        )}
      </div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.035] p-2">
      <p className="text-[10px] uppercase tracking-wider text-white/40">{label}</p>
      <p className="mt-1 text-xs font-semibold text-amber-50">{value}</p>
    </div>
  );
}
