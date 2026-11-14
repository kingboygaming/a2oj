"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WorldAlliancePanel } from "@/components/WorldAlliancePanel";
import { worldScoutCampLevel } from "@/lib/world-buildings";
import type { WorldScoutReport, WorldSnapshot } from "@/lib/world";

type ActionRequest =
  | { type: "join"; eventId: string }
  | { type: "contribute"; eventId: string }
  | { type: "claim"; eventId: string }
  | { type: "upgrade"; building: "FACTORY" | "WAREHOUSE" }
  | { type: "train"; troopType: "INFANTRY" | "ARCHERS" | "CAVALRY"; count: number }
  | { type: "dispatch"; eventId: string; infantry: number; archers: number; cavalry: number }
  | { type: "attackBase"; targetUserId: string; infantry: number; archers: number; cavalry: number }
  | { type: "scoutBase"; targetUserId: string };

function utcLabel(value: string) {
  return `${value.slice(0, 16).replace("T", " ")} UTC`;
}

function formatElapsed(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours} giờ ${minutes} phút` : `${minutes} phút`;
}

export function WorldPageClient({ initialSnapshot }: { initialSnapshot: WorldSnapshot }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [trainingCount, setTrainingCount] = useState(10);
  const [marchArmy, setMarchArmy] = useState({ infantry: 0, archers: 0, cavalry: 0 });
  const [attackArmy, setAttackArmy] = useState({ infantry: 0, archers: 0, cavalry: 0 });
  const [attackTargetId, setAttackTargetId] = useState("");
  const [scoutReports, setScoutReports] = useState<Record<string, WorldScoutReport>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const saved = localStorage.getItem(`world_scout_reports_${initialSnapshot.userId}`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [activeScout, setActiveScout] = useState<{
    targetUserId: string;
    targetName: string;
    targetX: number;
    targetZ: number;
    distanceMeters: number;
    startedAt: number;
    completesAt: number;
    totalDurationSeconds: number;
    report: WorldScoutReport;
  } | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const saved = localStorage.getItem(`world_active_scout_${initialSnapshot.userId}`);
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      if (parsed.completesAt && Date.now() < parsed.completesAt) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  });
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const lastSyncedServerTimeRef = useRef(Date.now());
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Process completed scout mission
  useEffect(() => {
    if (!activeScout) return;
    if (nowMs >= activeScout.completesAt) {
      setScoutReports((prev) => {
        const next = {
          ...prev,
          [activeScout.targetUserId]: activeScout.report,
        };
        try {
          localStorage.setItem(`world_scout_reports_${snapshot.userId}`, JSON.stringify(next));
        } catch {}
        return next;
      });
      setMessage(`🎉 Đoàn trinh sát đã trở về an toàn! Báo cáo tình báo từ căn cứ "${activeScout.targetName}" đã sẵn sàng.`);
      setIsError(false);
      setActiveScout(null);
      try {
        localStorage.removeItem(`world_active_scout_${snapshot.userId}`);
      } catch {}
    }
  }, [nowMs, activeScout, snapshot.userId]);

  const elapsedHours = Math.max(0, nowMs - lastSyncedServerTimeRef.current) / 3_600_000;
  const displayWood = Math.min(
    snapshot.base.capacity,
    Math.floor(snapshot.base.wood + elapsedHours * snapshot.base.woodPerHour),
  );
  const displayStone = Math.min(
    snapshot.base.capacity,
    Math.floor(snapshot.base.stone + elapsedHours * snapshot.base.stonePerHour),
  );
  const displayFood = Math.min(
    snapshot.base.capacity,
    Math.floor(snapshot.base.food + elapsedHours * snapshot.base.foodPerHour),
  );

  const refreshInFlight = useRef<Promise<void> | null>(null);

  const scoutCampLevel = useMemo(
    () => worldScoutCampLevel(snapshot.buildings),
    [snapshot.buildings],
  );

  const refresh = useCallback(async () => {
    if (refreshInFlight.current) return refreshInFlight.current;
    const task = (async () => {
      const response = await fetch("/api/world", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Không thể tải trạng thái thế giới.");
      lastSyncedServerTimeRef.current = Date.now();
      const nextSnapshot = result as WorldSnapshot;
      setSnapshot(nextSnapshot);
      setAttackArmy((current) => ({
        infantry: Math.min(current.infantry, nextSnapshot.base.army.infantry, 500),
        archers: Math.min(current.archers, nextSnapshot.base.army.archers, 500),
        cavalry: Math.min(current.cavalry, nextSnapshot.base.army.cavalry, 500),
      }));
      setAttackTargetId((current) =>
        nextSnapshot.nearbyBases.some((base) => base.userId === current) ? current : "",
      );
    })();
    refreshInFlight.current = task;
    try {
      await task;
    } finally {
      refreshInFlight.current = null;
    }
  }, []);

  // Periodic 12-second auto-sync when tab is visible
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        void refresh().catch(() => {});
      }
    }, 12_000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Auto-refresh when troop training or any other timer finishes
  useEffect(() => {
    const timestamps: number[] = [];

    if (snapshot.base.army.trainingType && snapshot.base.army.trainingCompletesAt) {
      timestamps.push(new Date(snapshot.base.army.trainingCompletesAt).getTime());
    }
    if (snapshot.base.castlePendingLevel !== null && snapshot.base.castleUpgradeCompletesAt) {
      timestamps.push(new Date(snapshot.base.castleUpgradeCompletesAt).getTime());
    }
    if (snapshot.base.upgradeType !== null && snapshot.base.upgradeCompletesAt) {
      timestamps.push(new Date(snapshot.base.upgradeCompletesAt).getTime());
    }
    if (snapshot.base.activeResearch?.completesAt) {
      timestamps.push(new Date(snapshot.base.activeResearch.completesAt).getTime());
    }

    if (timestamps.length === 0) return;

    const currentTime = Date.now();
    const nextTimestamp = Math.min(...timestamps);
    const delay = Math.max(500, nextTimestamp - currentTime + 600);

    const timer = setTimeout(() => {
      void refresh().catch(() => {});
    }, delay);

    return () => clearTimeout(timer);
  }, [
    snapshot.base.army.trainingType,
    snapshot.base.army.trainingCompletesAt,
    snapshot.base.castlePendingLevel,
    snapshot.base.castleUpgradeCompletesAt,
    snapshot.base.upgradeType,
    snapshot.base.upgradeCompletesAt,
    snapshot.base.activeResearch?.completesAt,
    refresh,
  ]);

  async function act(key: string, action: ActionRequest) {
    setBusy(key);
    setMessage("");
    setIsError(false);
    try {
      const response = await fetch("/api/world/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Không thể thực hiện thao tác.");
      setMessage(result.message);
      if (result.scoutReport) {
        if (result.travelDurationSeconds && result.travelDurationSeconds > 0) {
          const mission = {
            targetUserId: result.scoutReport.targetUserId,
            targetName: result.scoutReport.targetName,
            targetX: result.scoutReport.targetX,
            targetZ: result.scoutReport.targetZ,
            distanceMeters: result.scoutReport.distanceMeters,
            startedAt: Date.now(),
            completesAt: Date.now() + result.travelDurationSeconds * 1000,
            totalDurationSeconds: result.travelDurationSeconds,
            report: result.scoutReport,
          };
          setActiveScout(mission);
          try {
            localStorage.setItem(`world_active_scout_${snapshot.userId}`, JSON.stringify(mission));
          } catch {}
        } else {
          setScoutReports((prev) => {
            const next = {
              ...prev,
              [result.scoutReport.targetUserId]: result.scoutReport,
            };
            try {
              localStorage.setItem(`world_scout_reports_${snapshot.userId}`, JSON.stringify(next));
            } catch {}
            return next;
          });
        }
      }
      await refresh();
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "Đã xảy ra lỗi không xác định.");
    } finally {
      setBusy("");
    }
  }

  const factoryCost = {
    wood: (snapshot.base.factoryLevel + 1) * 100,
    stone: (snapshot.base.factoryLevel + 1) * 50,
  };
  const warehouseCost = {
    wood: (snapshot.base.warehouseLevel + 1) * 150,
    stone: (snapshot.base.warehouseLevel + 1) * 100,
  };
  const upgrading = snapshot.base.upgradeType !== null;
  const activeMarch = snapshot.events.find((event) => event.activeMarch)?.activeMarch ?? null;

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--teal)]">A2OJ · Giải trí</p>
          <h1 className="mt-1 text-3xl font-bold text-[var(--navy)]">Thế giới</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            Căn cứ vẫn sản xuất khi bạn offline. Tiến độ được tính từ timestamp phía máy chủ, tối đa 48 giờ mỗi lần cập nhật.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh().catch((error: unknown) => {
            setIsError(true);
            setMessage(error instanceof Error ? error.message : "Không thể làm mới thế giới.");
          })}
          className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm font-semibold text-[var(--navy)] hover:bg-[var(--paper)]"
        >
          Làm mới
        </button>
      </header>

      {message && (
        <p role={isError ? "alert" : "status"} className={`mb-4 rounded-lg border p-3 text-sm ${isError ? "border-rose-400/40 bg-rose-400/10 text-rose-700" : "border-emerald-500/30 bg-emerald-500/10 text-[var(--navy)]"}`}>
          {message}
        </p>
      )}

      {(snapshot.offline.elapsedSeconds > 60 || snapshot.offline.cappedOfflineTime) && (
        <section className="mb-5 rounded-xl border border-[var(--teal)]/30 bg-[var(--teal)]/5 p-4 text-sm text-[var(--navy)]">
          <h2 className="font-bold">Báo cáo hoạt động offline</h2>
          <p className="mt-1 text-[var(--muted)]">
            Đã tính {formatElapsed(snapshot.offline.elapsedSeconds)}: +{snapshot.offline.producedWood} gỗ, +{snapshot.offline.producedStone} đá.
            {snapshot.offline.cappedOfflineTime && " Thời gian vượt giới hạn 48 giờ không được tích trữ."}
          </p>
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-2xl border border-amber-500/20 bg-[var(--paper)] p-5">
          <p className="text-sm font-semibold text-[var(--muted)]">🪵 Gỗ</p>
          <p className="mt-1 text-3xl font-black text-[var(--navy)]">{displayWood.toLocaleString("vi-VN")}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">+{snapshot.base.woodPerHour}/giờ · kho tối đa {snapshot.base.capacity.toLocaleString("vi-VN")}</p>
        </article>
        <article className="rounded-2xl border border-slate-400/30 bg-[var(--paper)] p-5">
          <p className="text-sm font-semibold text-[var(--muted)]">🪨 Đá</p>
          <p className="mt-1 text-3xl font-black text-[var(--navy)]">{displayStone.toLocaleString("vi-VN")}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">+{snapshot.base.stonePerHour}/giờ · kho tối đa {snapshot.base.capacity.toLocaleString("vi-VN")}</p>
        </article>
        <article className="rounded-2xl border border-lime-500/30 bg-[var(--paper)] p-5">
          <p className="text-sm font-semibold text-[var(--muted)]">🌾 Lương thực</p>
          <p className="mt-1 text-3xl font-black text-[var(--navy)]">{displayFood.toLocaleString("vi-VN")}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">+{snapshot.base.foodPerHour}/giờ · kho tối đa {snapshot.base.capacity.toLocaleString("vi-VN")}</p>
        </article>
      </section>

      <section className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--paper)] px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--teal)]">Tọa độ căn cứ · X/Z</p>
        <p className="mt-1 font-mono text-sm font-semibold text-[var(--navy)]">
          X: {(snapshot.base.coordinateX / 1_000).toFixed(3)} km · Z: {(snapshot.base.coordinateZ / 1_000).toFixed(3)} km
        </p>
        <p className="mt-1 text-xs text-[var(--muted)]">Vị trí được cấp ngẫu nhiên; tâm mỗi căn cứ cách căn cứ khác tối thiểu 10 km.</p>
      </section>

      <section className="mt-5 rounded-2xl border border-rose-500/20 bg-[var(--paper)] p-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-rose-600">PvP · Chiến tranh căn cứ</p>
          <h2 className="mt-1 text-lg font-bold text-[var(--navy)]">Tấn công căn cứ người chơi</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Bộ binh khắc kỵ binh, kỵ binh khắc cung thủ, cung thủ khắc bộ binh. Hành quân mất 5 phút mỗi 10 km; thắng sẽ cướp tối đa 20% tài nguyên và chiếm vị trí cũ trong 24 giờ.
          </p>
        </div>
        {snapshot.base.activePvpAttackId && (
          <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-[var(--navy)]">
            Căn cứ đang tham gia trận đánh; thao tác huấn luyện, nâng cấp và đánh tiếp tạm khóa.
          </p>
        )}
        {snapshot.base.pvpShieldUntil && new Date(snapshot.base.pvpShieldUntil) > new Date(snapshot.now) && (
          <p className="mt-2 text-sm text-emerald-700">Khiên căn cứ bảo vệ đến {utcLabel(snapshot.base.pvpShieldUntil)}.</p>
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-[var(--muted)]">
            Căn cứ mục tiêu
            <select
              value={attackTargetId}
              onChange={(event) => setAttackTargetId(event.target.value)}
              className="mt-1 block w-full rounded-md border border-[var(--line)] bg-[var(--background)] px-2.5 py-2 text-sm text-[var(--ink)]"
            >
              <option value="">Chọn căn cứ</option>
              {snapshot.nearbyBases.map((base) => (
                <option
                  key={base.userId}
                  value={base.userId}
                  disabled={
                    base.activeAttack ||
                    Boolean(base.pvpShieldUntil && new Date(base.pvpShieldUntil) > new Date(snapshot.now))
                  }
                >
                  {base.displayName} · {base.distanceMeters.toLocaleString("vi-VN")} m
                  {base.pvpShieldUntil && new Date(base.pvpShieldUntil) > new Date(snapshot.now) ? " · Có khiên" : ""}
                  {base.activeAttack ? " · Đang chiến đấu" : ""}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {([
              ["infantry", "Bộ binh"],
              ["archers", "Cung thủ"],
              ["cavalry", "Kỵ binh"],
            ] as const).map(([field, label]) => (
              <label key={field} className="text-xs text-[var(--muted)]">
                {label} (có {snapshot.base.army[field]})
                <input
                  type="number"
                  min={0}
                  max={Math.min(500, snapshot.base.army[field])}
                  value={attackArmy[field]}
                  onChange={(event) => setAttackArmy((current) => ({
                    ...current,
                    [field]: Math.max(0, Math.min(500, snapshot.base.army[field], Number(event.target.value) || 0)),
                  }))}
                  className="mt-1 w-full rounded-md border border-[var(--line)] bg-[var(--background)] px-2 py-2 text-sm text-[var(--ink)]"
                />
              </label>
            ))}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={
              Boolean(busy) ||
              !attackTargetId ||
              Boolean(snapshot.base.activePvpAttackId) ||
              Boolean(snapshot.base.army.trainingType) ||
              snapshot.base.army.marchActive ||
              Object.values(attackArmy).reduce((sum, count) => sum + count, 0) < 1 ||
              Object.values(attackArmy).reduce((sum, count) => sum + count, 0) > 500
            }
            onClick={() => void act("attack-base", {
              type: "attackBase",
              targetUserId: attackTargetId,
              ...attackArmy,
            })}
            className="flex-1 rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === "attack-base" ? "Đang điều quân…" : "Tấn công căn cứ"}
          </button>
          {activeScout?.targetUserId === attackTargetId ? (() => {
            const remSec = Math.max(0, Math.ceil((activeScout.completesAt - nowMs) / 1000));
            return (
              <span className="rounded-lg border border-[var(--teal)] bg-[var(--teal)]/10 px-4 py-2 text-sm font-bold text-[var(--teal)]">
                🔭 Đang thám thính ({remSec}s)...
              </span>
            );
          })() : (
            <button
              type="button"
              disabled={Boolean(busy) || Boolean(activeScout) || !attackTargetId || scoutCampLevel === 0 || displayWood < 30 || displayFood < 20}
              onClick={() => void act("scout-base", { type: "scoutBase", targetUserId: attackTargetId })}
              className="rounded-lg border border-[var(--teal)] bg-[var(--teal)]/10 px-4 py-2 text-sm font-bold text-[var(--teal)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === "scout-base" ? "Đang do thám…" : activeScout ? "Đang có đoàn trinh sát..." : "🔭 Do thám (30🪵 20🌾)"}
            </button>
          )}
        </div>
        {activeScout && (
          <div className="mt-3 rounded-lg border border-sky-400/30 bg-sky-50 dark:bg-sky-950/40 p-3 text-xs text-sky-900 dark:text-sky-100 space-y-1.5">
            <div className="flex items-center justify-between font-bold">
              <span>🔭 Nhiệm vụ trinh sát đang di chuyển: {activeScout.targetName}</span>
              <span className="font-mono text-amber-600 dark:text-amber-300 font-bold">
                {Math.max(0, Math.ceil((activeScout.completesAt - nowMs) / 1000))}s còn lại
              </span>
            </div>
            <p className="text-[11px] text-sky-700 dark:text-sky-300">
              Khoảng cách {(activeScout.distanceMeters / 1000).toFixed(1)} km · Toạ độ ({Math.round(activeScout.targetX / 1000)}k, {Math.round(activeScout.targetZ / 1000)}k)
            </p>
          </div>
        )}
        {scoutCampLevel === 0 && (
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
            ⚠️ Bạn cần xây dựng <strong>Trại trinh sát</strong> trước khi có thể cử trinh sát do thám căn cứ đối phương.
          </p>
        )}
        {attackTargetId && scoutReports[attackTargetId] && (() => {
          const rep = scoutReports[attackTargetId];
          return (
            <div className="mt-3 rounded-lg border border-sky-400/40 bg-sky-50 dark:bg-sky-950/30 p-3 text-xs text-sky-900 dark:text-sky-100 space-y-1.5">
              <div className="flex items-center justify-between font-bold border-b border-sky-200 dark:border-sky-800 pb-1">
                <span>📜 Báo cáo trinh sát (Cấp {rep.scoutLevel}/3)</span>
                <span>{new Date(rep.scoutedAt).toLocaleTimeString("vi-VN")}</span>
              </div>
              <p>Thành trì: Cấp {rep.castleLevel} · Khoảng cách: {(rep.distanceMeters / 1000).toFixed(1)} km</p>
              <p>Tài nguyên ước tính: ~{rep.approximateWood} gỗ, ~{rep.approximateStone} đá{rep.food !== undefined ? `, ${rep.food} lương thực` : ""}</p>
              <p>Quân lực phòng thủ: {rep.scoutLevel === 1 ? rep.estimatedTotalTroops : `🛡️ ${rep.exactInfantry} bộ, 🏹 ${rep.exactArchers} cung, 🐎 ${rep.exactCavalry} kỵ`}</p>
              {rep.scoutLevel >= 3 && (
                <p>Quân sự: {rep.militaryTierName} · {rep.marchActive ? "Quân đang hành quân ngoài" : "Quân phòng thủ tại thành"}</p>
              )}
            </div>
          );
        })()}
        {snapshot.baseAttacks.length > 0 && (
          <div className="mt-4 border-t border-[var(--line)] pt-3">
            <h3 className="text-sm font-bold text-[var(--navy)]">Trận đánh gần đây</h3>
            <ul className="mt-2 space-y-2">
              {snapshot.baseAttacks.map((attack) => {
                const isAttacker = attack.attackerUserId === snapshot.userId;
                const outcome = attack.status === "RESOLVED"
                  ? attack.winnerUserId === attack.attackerUserId ? "Bên công thắng" : "Bên thủ thắng"
                  : attack.status === "IN_TRANSIT" || attack.status === "RESOLVING"
                    ? `Đang hành quân · đến ${utcLabel(attack.arrivesAt)}`
                    : attack.status;
                return (
                  <li key={attack.id} className="rounded-lg bg-[var(--background)] px-3 py-2 text-sm text-[var(--navy)]">
                    <span className="font-semibold">{attack.attackerName} → {attack.defenderName}</span>
                    <span className="text-[var(--muted)]"> · {outcome}</span>
                    {attack.status === "RESOLVED" && (
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {isAttacker ? "Quân ta" : "Quân đối phương"} tổn thất {attack.attackerCasualties} ·
                        {" "}{isAttacker ? "Quân đối phương" : "Quân ta"} tổn thất {attack.defenderCasualties}
                        {attack.winnerUserId === attack.attackerUserId && ` · Cướp ${attack.stolenWood} gỗ, ${attack.stolenStone} đá`}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {snapshot.occupations.length > 0 && (
          <div className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-[var(--navy)]">
            <p className="font-bold">Chiếm đóng</p>
            {snapshot.occupations.map((occupation) => (
              <p key={occupation.id} className="mt-1">
                {occupation.controllerName} kiểm soát vị trí X:{(occupation.coordinateX / 1_000).toFixed(2)} km, Z:{(occupation.coordinateZ / 1_000).toFixed(2)} km đến {utcLabel(occupation.endsAt)}.
              </p>
            ))}
          </div>
        )}
      </section>

      <section className="mt-5 grid gap-3 sm:grid-cols-2">
        <article className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--teal)]">Nhà máy cấp {snapshot.base.factoryLevel}</p>
              <h2 className="mt-1 text-lg font-bold text-[var(--navy)]">Sản xuất gỗ và đá</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">Nâng cấp tăng sản lượng mỗi giờ.</p>
            </div>
            <span className="text-2xl" aria-hidden="true">🏭</span>
          </div>
          <button
            type="button"
            disabled={Boolean(busy) || upgrading || snapshot.base.factoryLevel >= 20}
            onClick={() => void act("factory", { type: "upgrade", building: "FACTORY" })}
            className="mt-4 w-full rounded-lg bg-[var(--teal)] px-3 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === "factory" ? "Đang xử lý…" : `Nâng cấp · ${factoryCost.wood} gỗ + ${factoryCost.stone} đá`}
          </button>
        </article>

        <article className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--teal)]">Kho cấp {snapshot.base.warehouseLevel}</p>
              <h2 className="mt-1 text-lg font-bold text-[var(--navy)]">Sức chứa tài nguyên</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">Mỗi cấp tăng 2.000 sức chứa cho từng tài nguyên.</p>
            </div>
            <span className="text-2xl" aria-hidden="true">🏗️</span>
          </div>
          <button
            type="button"
            disabled={Boolean(busy) || upgrading || snapshot.base.warehouseLevel >= 20}
            onClick={() => void act("warehouse", { type: "upgrade", building: "WAREHOUSE" })}
            className="mt-4 w-full rounded-lg border border-[var(--teal)] px-3 py-2 text-sm font-bold text-[var(--teal)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === "warehouse" ? "Đang xử lý…" : `Nâng cấp · ${warehouseCost.wood} gỗ + ${warehouseCost.stone} đá`}
          </button>
        </article>
      </section>

      {upgrading && snapshot.base.upgradeCompletesAt && (
        <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-[var(--navy)]">
          Công trình đang nâng cấp; dự kiến hoàn tất lúc {utcLabel(snapshot.base.upgradeCompletesAt)}. Tiến độ vẫn chạy khi bạn offline.
        </p>
      )}

      <section className="mt-5 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--teal)]">Quân đội</p>
            <h2 className="mt-1 text-lg font-bold text-[var(--navy)]">Huấn luyện binh sĩ</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Một hàng đợi huấn luyện tại một thời điểm. Quân hoàn thành theo giờ máy chủ.</p>
          </div>
          <label className="text-xs text-[var(--muted)]">
            Số lượng mỗi đợt
            <input
              type="number"
              min={1}
              max={100}
              value={trainingCount}
              onChange={(event) => setTrainingCount(Math.min(100, Math.max(1, Number(event.target.value) || 1)))}
              className="mt-1 block w-28 rounded-md border border-[var(--line)] bg-[var(--background)] px-2.5 py-2 text-sm text-[var(--ink)]"
            />
          </label>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {([
            { type: "INFANTRY", label: "Bộ binh", icon: "🛡️", count: snapshot.base.army.infantry, cost: "10 gỗ · 5 đá", damage: 10 },
            { type: "ARCHERS", label: "Cung thủ", icon: "🏹", count: snapshot.base.army.archers, cost: "15 gỗ · 5 đá", damage: 15 },
            { type: "CAVALRY", label: "Kỵ binh", icon: "🐎", count: snapshot.base.army.cavalry, cost: "20 gỗ · 10 đá", damage: 20 },
          ] as const).map((troop) => (
            <article key={troop.type} className="rounded-xl border border-[var(--line)] p-4">
              <p className="text-sm font-bold text-[var(--navy)]">{troop.icon} {troop.label}</p>
              <p className="mt-1 text-lg font-black text-[var(--navy)]">{troop.count.toLocaleString("vi-VN")} quân</p>
              <p className="text-xs text-[var(--muted)]">{troop.cost}/lính · {troop.damage} sát thương/lính</p>
              <button
                type="button"
                disabled={Boolean(busy) || Boolean(snapshot.base.army.trainingType)}
                onClick={() => void act(`train-${troop.type}`, {
                  type: "train",
                  troopType: troop.type,
                  count: trainingCount,
                })}
                className="mt-3 w-full rounded-lg border border-[var(--teal)] px-3 py-2 text-sm font-bold text-[var(--teal)] disabled:opacity-50"
              >
                {busy === `train-${troop.type}` ? "Đang xếp hàng…" : `Huấn luyện ${trainingCount}`}
              </button>
            </article>
          ))}
        </div>
        {snapshot.base.army.trainingType && snapshot.base.army.trainingCompletesAt && (() => {
          const targetMs = new Date(snapshot.base.army.trainingCompletesAt).getTime();
          const remSec = Math.max(0, Math.ceil((targetMs - nowMs) / 1000));
          const min = Math.floor(remSec / 60);
          const sec = remSec % 60;
          const countdownStr = remSec > 0 ? `${min}:${sec.toString().padStart(2, "0")}` : "Đang hoàn tất…";

          const type = snapshot.base.army.trainingType;
          const secPerUnit = type === "INFANTRY" ? 5 : type === "ARCHERS" ? 7 : 10;
          const totalSec = Math.max(1, snapshot.base.army.trainingCount * secPerUnit);
          const percent = Math.min(100, Math.max(0, Math.round(((totalSec - remSec) / totalSec) * 100)));
          const troopLabel = type === "INFANTRY" ? "bộ binh" : type === "ARCHERS" ? "cung thủ" : "kỵ binh";

          return (
            <div className="mt-3 rounded-lg bg-[var(--teal)]/10 border border-[var(--teal)]/20 p-3 text-sm text-[var(--navy)] space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">
                    ⏳ Đang huấn luyện {snapshot.base.army.trainingCount} {troopLabel}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    Hoàn tất lúc {new Date(targetMs).toLocaleTimeString("vi-VN")} (còn {remSec > 60 ? `${min}p ${sec}s` : `${remSec}s`})
                  </p>
                </div>
                <span className="font-mono text-sm font-bold text-[var(--teal)] bg-white/70 dark:bg-black/40 px-2.5 py-1 rounded border border-[var(--teal)]/30">
                  {countdownStr}
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-[var(--muted)] font-semibold">
                  <span>Tiến độ huấn luyện</span>
                  <span>{percent}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                  <div
                    className="h-full bg-gradient-to-r from-[var(--teal)] to-emerald-400 transition-all duration-300"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })()}
        {activeMarch && (
          <p className="mt-3 rounded-lg bg-rose-400/5 px-3 py-2 text-sm text-[var(--navy)]">
            {activeMarch.status === "RETURNING" ? "Quân đang trở về từ" : "Quân đang hành quân tới"} {activeMarch.eventTitle}.
            {activeMarch.status === "RETURNING" && ` Sát thương ${activeMarch.damage.toLocaleString("vi-VN")}, tổn thất ${activeMarch.casualties} quân.`}
            {" "}{activeMarch.status === "RETURNING" && activeMarch.returnsAt
              ? `Dự kiến về lúc ${utcLabel(activeMarch.returnsAt)}.`
              : `Dự kiến tới lúc ${utcLabel(activeMarch.arrivesAt)}.`}
          </p>
        )}
      </section>

      <WorldAlliancePanel />

      {snapshot.pendingRewards.length > 0 && (
        <section className="mt-7">
          <h2 className="mb-3 text-xl font-bold text-[var(--navy)]">🎁 Thưởng chưa nhận</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {snapshot.pendingRewards.map((reward) => (
              <article key={reward.eventId} className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                <h3 className="font-bold text-[var(--navy)]">{reward.title}</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">{reward.wood} gỗ · {reward.stone} đá</p>
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => void act(`claim-${reward.eventId}`, { type: "claim", eventId: reward.eventId })}
                  className="mt-3 rounded-lg bg-amber-500 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
                >
                  {busy === `claim-${reward.eventId}` ? "Đang nhận…" : "Nhận thưởng"}
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="mt-7">
        <div className="mb-3">
          <h2 className="text-xl font-bold text-[var(--navy)]">📅 Sự kiện thế giới</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Sự kiện có lịch, điều kiện tham gia và phần thưởng theo thứ hạng.</p>
        </div>
        <div className="space-y-4">
          {snapshot.events.map((event) => (
            <article key={event.id} className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-[var(--teal)]">
                    {event.status === "ACTIVE" ? "Đang diễn ra" : event.status === "SCHEDULED" ? "Sắp diễn ra" : event.status === "PROCESSING" ? "Đang tổng kết" : event.status === "CANCELED" ? "Đã hủy" : "Đã kết thúc"}
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-[var(--navy)]">{event.title}</h3>
                  <p className="mt-1 text-sm text-[var(--muted)]">{event.description}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {utcLabel(event.startsAt)} – {utcLabel(event.endsAt)} · {event.participantCount}/{event.participantLimit} người
                    {event.joined && ` · Điểm của bạn: ${event.score}${event.rank ? ` · Hạng ${event.rank}` : ""}`}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Điều kiện: Thành chính cấp {event.minFactoryLevel}+ · đóng góp {event.contributionWoodCost} gỗ/lượt · cooldown {event.contributionCooldownSeconds}s
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Thưởng: {event.rewards.map((reward, index) => `H${index + 1} ${reward.wood} gỗ/${reward.stone} đá`).join(" · ")}
                  </p>
                  {event.eventType === "WORLD_BOSS" && (
                    <div className="mt-3 max-w-xl">
                      <div className="flex justify-between gap-2 text-xs font-semibold text-[var(--navy)]">
                        <span>🐲 Boss toàn server</span>
                        <span>{event.bossHpRemaining.toLocaleString("vi-VN")} / {event.bossHp.toLocaleString("vi-VN")} HP</span>
                      </div>
                      <div
                        role="progressbar"
                        aria-label="Máu boss"
                        aria-valuemin={0}
                        aria-valuemax={event.bossHp}
                        aria-valuenow={event.bossHpRemaining}
                        className="mt-1 h-3 overflow-hidden rounded-full bg-rose-950/20"
                      >
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-rose-600 to-orange-400 transition-[width]"
                          style={{ width: `${event.bossHp > 0 ? Math.max(0, Math.min(100, event.bossHpRemaining / event.bossHp * 100)) : 0}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
                {event.status === "ACTIVE" && (
                  <div className="flex gap-2">
                    {!event.joined && (
                      <button
                        type="button"
                        disabled={Boolean(busy) || event.participantCount >= event.participantLimit || snapshot.base.castleLevel < event.minFactoryLevel}
                        onClick={() => void act(`join-${event.id}`, { type: "join", eventId: event.id })}
                        className="rounded-lg border border-[var(--teal)] px-3 py-2 text-sm font-bold text-[var(--teal)] disabled:opacity-50"
                      >
                        {busy === `join-${event.id}` ? "Đang vào…" : snapshot.base.castleLevel < event.minFactoryLevel ? `Cần Thành chính cấp ${event.minFactoryLevel}` : "Tham gia"}
                      </button>
                    )}
                    {event.joined && event.eventType === "RESOURCE_RUSH" && (
                      <button
                        type="button"
                        disabled={Boolean(busy)}
                        onClick={() => void act(`contribute-${event.id}`, { type: "contribute", eventId: event.id })}
                        className="rounded-lg bg-[var(--teal)] px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
                      >
                        {busy === `contribute-${event.id}` ? "Đang gửi…" : `Đóng góp ${event.contributionWoodCost} gỗ`}
                      </button>
                    )}
                  </div>
                )}
              </div>
              {event.status === "ACTIVE" && event.joined && event.eventType === "WORLD_BOSS" && (
                <div className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/5 p-4">
                  {event.activeMarch ? (
                    <div className="text-sm text-[var(--navy)]">
                      <p className="font-bold">
                        {event.activeMarch.status === "RETURNING" ? "Đạo quân đang trở về căn cứ" : "Đạo quân đang hành quân"}
                      </p>
                      <p className="mt-1 text-[var(--muted)]">
                        {event.activeMarch.infantry} bộ binh · {event.activeMarch.archers} cung thủ · {event.activeMarch.cavalry} kỵ binh
                        {event.activeMarch.status === "RETURNING" && ` · Gây ${event.activeMarch.damage.toLocaleString("vi-VN")} sát thương · Mất ${event.activeMarch.casualties} quân`}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {event.activeMarch.status === "RETURNING" && event.activeMarch.returnsAt
                          ? `Dự kiến về lúc ${utcLabel(event.activeMarch.returnsAt)}`
                          : `Dự kiến tới lúc ${utcLabel(event.activeMarch.arrivesAt)}`}
                      </p>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm font-bold text-[var(--navy)]">Điều quân đánh boss</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        Tối đa 500 quân mỗi đạo. Sát thương được tính khi đến nơi; 10% quân số hy sinh và phần còn lại quay về.
                      </p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        {([
                          ["infantry", "Bộ binh", snapshot.base.army.infantry],
                          ["archers", "Cung thủ", snapshot.base.army.archers],
                          ["cavalry", "Kỵ binh", snapshot.base.army.cavalry],
                        ] as const).map(([field, label, available]) => (
                          <label key={field} className="text-xs text-[var(--muted)]">
                            {label} · có {available}
                            <input
                              type="number"
                              min={0}
                              max={available}
                              value={marchArmy[field]}
                              onChange={(inputEvent) => setMarchArmy((current) => ({
                                ...current,
                                [field]: Math.max(0, Math.min(available, Number(inputEvent.target.value) || 0)),
                              }))}
                              className="mt-1 w-full rounded-md border border-[var(--line)] bg-[var(--background)] px-2.5 py-2 text-sm text-[var(--ink)]"
                            />
                          </label>
                        ))}
                      </div>
                      <button
                        type="button"
                        disabled={Boolean(busy) || snapshot.base.army.trainingType !== null || Object.values(marchArmy).reduce((sum, count) => sum + count, 0) === 0 || Object.values(marchArmy).reduce((sum, count) => sum + count, 0) > 500}
                        onClick={() => void act(`march-${event.id}`, {
                          type: "dispatch",
                          eventId: event.id,
                          ...marchArmy,
                        })}
                        className="mt-3 rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {busy === `march-${event.id}` ? "Đang điều quân…" : "Cử quân đi đánh"}
                      </button>
                    </>
                  )}
                </div>
              )}
              {event.leaderboard.length > 0 && (
                <ol className="mt-4 grid gap-1 border-t border-[var(--line)] pt-3 sm:grid-cols-2">
                  {event.leaderboard.slice(0, 10).map((player, index) => (
                    <li key={`${event.id}-${index}`} className="flex items-center justify-between gap-3 rounded-md px-2 py-1 text-sm text-[var(--navy)]">
                      <span className="truncate">{index + 1}. {player.name}</span>
                      <span className="shrink-0 font-bold">
                        {player.score.toLocaleString("vi-VN")} {event.eventType === "WORLD_BOSS" ? "sát thương" : "điểm"}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
              {event.status === "COMPLETED" && event.joined && event.rank && event.rank <= 3 && (
                <p className="mt-3 text-sm font-semibold text-amber-700">Bạn đạt hạng thưởng. Phần thưởng được lưu trong mục “Thưởng chưa nhận”.</p>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
