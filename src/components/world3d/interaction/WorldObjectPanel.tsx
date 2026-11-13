"use client";

import { useState } from "react";
import {
  resourceKindLabel,
  type WorldMapObject,
} from "./worldObjects";

type ArmyCounts = { infantry: number; archers: number; cavalry: number };

export function WorldObjectPanel({
  object,
  army,
  ownerName,
  remaining,
  onOccupy,
  onGather,
  onAttack,
  onClose,
}: {
  object: WorldMapObject;
  army: ArmyCounts;
  ownerName: string | null;
  remaining: number;
  onOccupy: (troops: ArmyCounts) => string;
  onGather: (amount: number) => string;
  onAttack: (troops: ArmyCounts) => string;
  onClose: () => void;
}) {
  const [troops, setTroops] = useState<ArmyCounts>({ infantry: 0, archers: 0, cavalry: 0 });
  const [result, setResult] = useState("");

  const troopPower = troops.infantry * 10 + troops.archers * 15 + troops.cavalry * 20;
  const allocated = troops.infantry + troops.archers + troops.cavalry;
  const resource = object.kind === "RESOURCE";
  const resourceOwner = ownerName;
  const depleted = resource && remaining <= 0;
  const tierLabel = object.kind === "ROGUE_CAMP"
    ? object.tier === "ELITE" ? "Tinh anh" : `Cấp ${object.level}`
    : `Cấp ${object.level}`;

  function setTroopCount(type: keyof ArmyCounts, value: number) {
    setTroops((current) => ({
      ...current,
      [type]: Math.min(army[type], 500, Math.max(0, value)),
    }));
  }

  function renderActionResult(message: string) {
    setResult(message);
  }

  return (
    <section className="pointer-events-auto w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-amber-100/20 bg-[#171b19]/95 text-amber-50 shadow-2xl shadow-black/50 backdrop-blur-xl">
      <header className="flex items-start justify-between gap-3 border-b border-white/10 bg-gradient-to-r from-[#685034]/50 to-transparent p-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300/75">
            {resource ? "Khu tài nguyên · Prototype" : "Trại lưu khấu · Prototype"}
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
              <Info label="Chủ sở hữu" value={resourceOwner ?? "Chưa chiếm"} />
            </div>
            <p className="rounded-lg border border-amber-300/15 bg-amber-200/5 px-3 py-2 text-xs text-amber-100/70">
              Yêu cầu chiến lực {object.requiredPower.toLocaleString("vi-VN")}. Trữ lượng tái tạo hiện là dữ liệu mô phỏng.
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
              {object.tier === "ELITE" ? "Khu vực tinh anh — nguy hiểm cao." : `Mối đe dọa cấp ${object.level}.`}
            </p>
          </>
        )}

        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-white/75">Điều quân thử nghiệm</p>
            <p className="text-[10px] text-white/45">Chiến lực chọn: {troopPower}</p>
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

        {result && (
          <p role="status" className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs text-emerald-100">
            {result}
          </p>
        )}
        <p className="text-[10px] leading-4 text-white/40">
          Mock ở trình duyệt: không điều quân thật, không trao vật phẩm và không đồng bộ sang máy chủ.
        </p>

        {resource ? (
          <div className="flex gap-2">
            {resourceOwner === "Bạn" ? (
              <button
                type="button"
                disabled={depleted}
                onClick={() => renderActionResult(onGather(Math.min(remaining, object.yieldPerMinute * 5)))}
                className="flex-1 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {depleted ? "Đã cạn" : "Gom tài nguyên · 5 phút"}
              </button>
            ) : (
              <button
                type="button"
                disabled={depleted || allocated === 0 || troopPower < object.requiredPower}
                onClick={() => renderActionResult(onOccupy(troops))}
                className="flex-1 rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {depleted ? "Đã cạn" : resourceOwner ? "Tranh chấp khu vực" : "Điều quân chiếm đóng"}
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            disabled={allocated === 0}
            onClick={() => renderActionResult(onAttack(troops))}
            className="w-full rounded-lg bg-rose-700 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Điều quân tấn công
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
