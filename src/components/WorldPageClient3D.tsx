"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { WorldAlliancePanel } from "@/components/WorldAlliancePanel";
import { useGraphicsStore } from "@/components/world3d/engine/useGraphicsStore";
import { useCameraStore } from "@/components/world3d/engine/useCameraStore";
import type { GraphicsQuality } from "@/components/world3d/engine/GraphicsSettings";
import type { WorldSnapshot } from "@/lib/world";
import { Minimap } from "@/components/Minimap";
import { FPSCounter } from "@/components/FPSCounter";

/* Lazy-load the heavy 3D engine — no SSR */
const WorldEngine = dynamic(
  () => import("@/components/world3d/engine/WorldEngine").then((m) => ({ default: m.WorldEngine })),
  { ssr: false }
);
const WorldScene = dynamic(
  () => import("@/components/world3d/WorldScene").then((m) => ({ default: m.WorldScene })),
  { ssr: false }
);

type ActionRequest =
  | { type: "join"; eventId: string }
  | { type: "contribute"; eventId: string }
  | { type: "claim"; eventId: string }
  | { type: "upgrade"; building: "FACTORY" | "WAREHOUSE" }
  | { type: "train"; troopType: "INFANTRY" | "ARCHERS" | "CAVALRY"; count: number }
  | { type: "dispatch"; eventId: string; infantry: number; archers: number; cavalry: number };

function utcLabel(value: string) {
  return `${value.slice(0, 16).replace("T", " ")} UTC`;
}

function formatElapsed(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours} giờ ${minutes} phút` : `${minutes} phút`;
}

export function WorldPageClient3D({ initialSnapshot }: { initialSnapshot: WorldSnapshot }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [trainingCount, setTrainingCount] = useState(10);
  const [marchArmy, setMarchArmy] = useState({ infantry: 0, archers: 0, cavalry: 0 });
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [showPanel, setShowPanel] = useState(true);
  const [activeTab, setActiveTab] = useState<"base" | "army" | "events" | "alliance">("base");

  const quality = useGraphicsStore((s) => s.quality);
  const setQuality = useGraphicsStore((s) => s.setQuality);
  const { viewMode, setViewMode } = useCameraStore();

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === "v" || e.key === "V") setViewMode(viewMode === "world" ? "city" : "world");
      if (e.key === "Escape") setShowPanel(false);
      if (e.key === "m" || e.key === "M") setShowPanel((p) => !p);
      if (e.key === "1") setQuality("LOW");
      if (e.key === "2") setQuality("MEDIUM");
      if (e.key === "3") setQuality("HIGH");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewMode, setViewMode, setQuality]);

  async function refresh() {
    const response = await fetch("/api/world", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Không thể tải trạng thái thế giới.");
    setSnapshot(result as WorldSnapshot);
  }

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
    <div className="relative h-[calc(100vh-64px)] w-full overflow-hidden">
      {/* ── 3D Viewport ── */}
      <div className="absolute inset-0">
        <WorldEngine className="h-full w-full">
          <WorldScene
            baseData={{
              factoryLevel: snapshot.base.factoryLevel,
              warehouseLevel: snapshot.base.warehouseLevel,
              coordinateX: snapshot.base.coordinateX,
              coordinateZ: snapshot.base.coordinateZ,
              army: {
                infantry: snapshot.base.army.infantry,
                archers: snapshot.base.army.archers,
                cavalry: snapshot.base.army.cavalry,
                marchActive: snapshot.base.army.marchActive,
              },
            }}
          />
        </WorldEngine>
      </div>

      {/* ── Top bar overlay ── */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-3">
        {/* Resource bar — left */}
        <div className="pointer-events-auto flex flex-col gap-1.5">
          {/* Wood */}
          <div className="flex items-center gap-2 rounded-xl border border-amber-500/25 bg-black/65 px-3 py-1.5 backdrop-blur-md">
            <span className="text-base">🪵</span>
            <div>
              <p className="text-xs font-bold leading-none text-white">{snapshot.base.wood.toLocaleString("vi-VN")}</p>
              <p className="mt-0.5 text-[10px] leading-none text-amber-300/60">+{snapshot.base.woodPerHour}/h</p>
            </div>
          </div>
          {/* Stone */}
          <div className="flex items-center gap-2 rounded-xl border border-slate-400/25 bg-black/65 px-3 py-1.5 backdrop-blur-md">
            <span className="text-base">🪨</span>
            <div>
              <p className="text-xs font-bold leading-none text-white">{snapshot.base.stone.toLocaleString("vi-VN")}</p>
              <p className="mt-0.5 text-[10px] leading-none text-slate-400/60">+{snapshot.base.stonePerHour}/h</p>
            </div>
          </div>
          {/* Army quick stats */}
          <div className="flex items-center gap-2 rounded-xl border border-teal-500/20 bg-black/65 px-3 py-1.5 backdrop-blur-md">
            <span className="text-base">⚔️</span>
            <div className="flex gap-2 text-[10px] text-white/70">
              <span>🛡{snapshot.base.army.infantry.toLocaleString("vi-VN")}</span>
              <span>🏹{snapshot.base.army.archers.toLocaleString("vi-VN")}</span>
              <span>🐎{snapshot.base.army.cavalry.toLocaleString("vi-VN")}</span>
            </div>
          </div>
        </div>

        {/* Controls — right */}
        <div className="pointer-events-auto flex flex-col items-end gap-1.5">
          <div className="flex gap-1.5">
            {/* View toggle */}
            <button
              type="button"
              onClick={() => setViewMode(viewMode === "world" ? "city" : "world")}
              className="rounded-xl border border-white/15 bg-black/65 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-md transition hover:bg-black/80 active:scale-95"
            >
              {viewMode === "world" ? "🏰 Thành phố" : "🗺️ Thế giới"}
            </button>

            {/* Graphics quality */}
            <select
              value={quality}
              onChange={(e) => setQuality(e.target.value as GraphicsQuality)}
              className="rounded-xl border border-white/15 bg-black/65 px-2 py-1.5 text-xs font-bold text-white backdrop-blur-md"
            >
              <option value="LOW">⚡ Low</option>
              <option value="MEDIUM">✨ Med</option>
              <option value="HIGH">🌟 High</option>
            </select>

            {/* Refresh */}
            <button
              type="button"
              onClick={() => void refresh().catch((error: unknown) => {
                setIsError(true);
                setMessage(error instanceof Error ? error.message : "Không thể làm mới.");
              })}
              className="rounded-xl border border-white/15 bg-black/65 px-2.5 py-1.5 text-xs font-bold text-white backdrop-blur-md transition hover:bg-black/80 active:scale-95"
            >
              🔄
            </button>
          </div>

          {/* Toggle panel */}
          <button
            type="button"
            onClick={() => setShowPanel(!showPanel)}
            className="rounded-xl border border-white/15 bg-black/65 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-md transition hover:bg-black/80 active:scale-95"
          >
            {showPanel ? "✕ Đóng" : "☰ Bảng điều khiển"}
          </button>
        </div>
      </div>

      {/* ── Side panel overlay ── */}
      {showPanel && (
        <div className="absolute right-0 top-12 bottom-0 z-10 w-full max-w-sm overflow-y-auto border-l border-white/10 bg-black/70 p-4 backdrop-blur-md sm:max-w-md">
          {/* Message */}
          {message && (
            <p className={`mb-3 rounded-lg border p-2.5 text-xs ${isError ? "border-rose-400/40 bg-rose-400/10 text-rose-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"}`}>
              {message}
            </p>
          )}

          {/* Offline report */}
          {(snapshot.offline.elapsedSeconds > 60 || snapshot.offline.cappedOfflineTime) && (
            <div className="mb-3 rounded-lg border border-teal-400/20 bg-teal-400/5 p-2.5 text-xs text-teal-200">
              ⏱ Offline {formatElapsed(snapshot.offline.elapsedSeconds)}: +{snapshot.offline.producedWood} gỗ, +{snapshot.offline.producedStone} đá
              {snapshot.offline.cappedOfflineTime && " (giới hạn 48h)"}
            </div>
          )}

          {/* Tabs */}
          <div className="mb-3 flex gap-1">
            {(["base", "army", "events", "alliance"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`flex-1 rounded-md px-2 py-1.5 text-xs font-bold transition ${
                  activeTab === tab
                    ? "bg-[var(--teal)] text-white"
                    : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                }`}
              >
                {tab === "base" ? "🏗️ Căn cứ" : tab === "army" ? "⚔️ Quân" : tab === "events" ? "📅 Sự kiện" : "🤝 Liên minh"}
              </button>
            ))}
          </div>

          {/* ── Tab: Base ── */}
          {activeTab === "base" && (
            <div className="space-y-3">
              {/* Coordinates */}
              <div className="rounded-lg bg-white/5 p-3">
                <p className="text-xs font-bold text-teal-400">📍 Tọa độ</p>
                <p className="mt-1 font-mono text-xs text-white/80">
                  X: {(snapshot.base.coordinateX / 1_000).toFixed(1)} km · Z: {(snapshot.base.coordinateZ / 1_000).toFixed(1)} km
                </p>
              </div>

              {/* Factory */}
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-teal-400">🏭 Nhà máy cấp {snapshot.base.factoryLevel}</p>
                    <p className="mt-0.5 text-xs text-white/50">Sản xuất gỗ và đá</p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={Boolean(busy) || upgrading || snapshot.base.factoryLevel >= 20}
                  onClick={() => void act("factory", { type: "upgrade", building: "FACTORY" })}
                  className="mt-2 w-full rounded-md bg-teal-600 px-2 py-1.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busy === "factory" ? "…" : `Nâng cấp · ${factoryCost.wood} gỗ + ${factoryCost.stone} đá`}
                </button>
              </div>

              {/* Warehouse */}
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-teal-400">🏗️ Kho cấp {snapshot.base.warehouseLevel}</p>
                    <p className="mt-0.5 text-xs text-white/50">Sức chứa: {snapshot.base.capacity.toLocaleString("vi-VN")}</p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={Boolean(busy) || upgrading || snapshot.base.warehouseLevel >= 20}
                  onClick={() => void act("warehouse", { type: "upgrade", building: "WAREHOUSE" })}
                  className="mt-2 w-full rounded-md border border-teal-500 px-2 py-1.5 text-xs font-bold text-teal-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busy === "warehouse" ? "…" : `Nâng cấp · ${warehouseCost.wood} gỗ + ${warehouseCost.stone} đá`}
                </button>
              </div>

              {upgrading && snapshot.base.upgradeCompletesAt && (
                <p className="rounded-md bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-300">
                  ⏳ Đang nâng cấp; hoàn tất lúc {utcLabel(snapshot.base.upgradeCompletesAt)}
                </p>
              )}
            </div>
          )}

          {/* ── Tab: Army ── */}
          {activeTab === "army" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-teal-400">Huấn luyện binh sĩ</p>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={trainingCount}
                  onChange={(e) => setTrainingCount(Math.min(100, Math.max(1, Number(e.target.value) || 1)))}
                  className="w-16 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-white"
                />
              </div>
              {([
                { type: "INFANTRY" as const, label: "🛡️ Bộ binh", count: snapshot.base.army.infantry, cost: "10 gỗ · 5 đá", dmg: 10 },
                { type: "ARCHERS" as const, label: "🏹 Cung thủ", count: snapshot.base.army.archers, cost: "15 gỗ · 5 đá", dmg: 15 },
                { type: "CAVALRY" as const, label: "🐎 Kỵ binh", count: snapshot.base.army.cavalry, cost: "20 gỗ · 10 đá", dmg: 20 },
              ]).map((troop) => (
                <div key={troop.type} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3">
                  <div>
                    <p className="text-sm font-bold text-white">{troop.label}</p>
                    <p className="text-xs text-white/50">{troop.count.toLocaleString("vi-VN")} quân · {troop.cost}/lính</p>
                  </div>
                  <button
                    type="button"
                    disabled={Boolean(busy) || Boolean(snapshot.base.army.trainingType)}
                    onClick={() => void act(`train-${troop.type}`, { type: "train", troopType: troop.type, count: trainingCount })}
                    className="rounded-md border border-teal-500 px-2.5 py-1 text-xs font-bold text-teal-400 disabled:opacity-40"
                  >
                    {busy === `train-${troop.type}` ? "…" : `+${trainingCount}`}
                  </button>
                </div>
              ))}
              {snapshot.base.army.trainingType && snapshot.base.army.trainingCompletesAt && (
                <p className="rounded-md bg-teal-500/10 px-2.5 py-1.5 text-xs text-teal-300">
                  ⏳ Đang huấn luyện {snapshot.base.army.trainingCount} {snapshot.base.army.trainingType === "INFANTRY" ? "bộ binh" : snapshot.base.army.trainingType === "ARCHERS" ? "cung thủ" : "kỵ binh"} · {utcLabel(snapshot.base.army.trainingCompletesAt)}
                </p>
              )}
              {activeMarch && (
                <p className="rounded-md bg-rose-400/10 px-2.5 py-1.5 text-xs text-rose-300">
                  ⚔️ {activeMarch.status === "RETURNING" ? "Quân đang trở về" : "Quân đang hành quân"} · {activeMarch.eventTitle}
                </p>
              )}
            </div>
          )}

          {/* ── Tab: Events ── */}
          {activeTab === "events" && (
            <div className="space-y-3">
              {/* Pending rewards */}
              {snapshot.pendingRewards.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-amber-400">🎁 Thưởng chưa nhận</p>
                  {snapshot.pendingRewards.map((reward) => (
                    <div key={reward.eventId} className="flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5">
                      <div>
                        <p className="text-xs font-bold text-white">{reward.title}</p>
                        <p className="text-xs text-white/50">{reward.wood} gỗ · {reward.stone} đá</p>
                      </div>
                      <button
                        type="button"
                        disabled={Boolean(busy)}
                        onClick={() => void act(`claim-${reward.eventId}`, { type: "claim", eventId: reward.eventId })}
                        className="rounded-md bg-amber-500 px-2 py-1 text-xs font-bold text-white disabled:opacity-40"
                      >
                        Nhận
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Events list */}
              {snapshot.events.map((event) => (
                <div key={event.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-teal-400">
                        {event.status === "ACTIVE" ? "🟢 Đang diễn ra" : event.status === "SCHEDULED" ? "🔵 Sắp tới" : event.status === "COMPLETED" ? "✅ Hoàn thành" : event.status}
                      </p>
                      <p className="mt-0.5 text-sm font-bold text-white">{event.title}</p>
                      <p className="mt-0.5 text-xs text-white/40">{event.participantCount}/{event.participantLimit} người</p>
                    </div>
                    {event.status === "ACTIVE" && !event.joined && (
                      <button
                        type="button"
                        disabled={Boolean(busy)}
                        onClick={() => void act(`join-${event.id}`, { type: "join", eventId: event.id })}
                        className="shrink-0 rounded-md border border-teal-500 px-2 py-1 text-xs font-bold text-teal-400 disabled:opacity-40"
                      >
                        Tham gia
                      </button>
                    )}
                    {event.status === "ACTIVE" && event.joined && event.eventType === "RESOURCE_RUSH" && (
                      <button
                        type="button"
                        disabled={Boolean(busy)}
                        onClick={() => void act(`contribute-${event.id}`, { type: "contribute", eventId: event.id })}
                        className="shrink-0 rounded-md bg-teal-600 px-2 py-1 text-xs font-bold text-white disabled:opacity-40"
                      >
                        Đóng góp
                      </button>
                    )}
                  </div>

                  {/* Boss HP bar */}
                  {event.eventType === "WORLD_BOSS" && (
                    <div className="mt-2">
                      <div className="flex justify-between text-xs text-white/50">
                        <span>🐲 Boss</span>
                        <span>{event.bossHpRemaining.toLocaleString("vi-VN")} / {event.bossHp.toLocaleString("vi-VN")}</span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-rose-600 to-orange-400"
                          style={{ width: `${event.bossHp > 0 ? Math.max(0, (event.bossHpRemaining / event.bossHp) * 100) : 0}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* World Boss dispatch */}
                  {event.status === "ACTIVE" && event.joined && event.eventType === "WORLD_BOSS" && !event.activeMarch && (
                    <div className="mt-2 border-t border-white/10 pt-2">
                      <p className="text-xs font-bold text-white/70">Điều quân đánh boss</p>
                      <div className="mt-1 flex gap-1.5">
                        {([
                          ["infantry", "BB", snapshot.base.army.infantry],
                          ["archers", "CT", snapshot.base.army.archers],
                          ["cavalry", "KB", snapshot.base.army.cavalry],
                        ] as const).map(([field, label, available]) => (
                          <label key={field} className="flex-1 text-xs text-white/40">
                            {label} ({available})
                            <input
                              type="number"
                              min={0}
                              max={available}
                              value={marchArmy[field]}
                              onChange={(e) => setMarchArmy((c) => ({
                                ...c,
                                [field]: Math.max(0, Math.min(available, Number(e.target.value) || 0)),
                              }))}
                              className="mt-0.5 w-full rounded border border-white/10 bg-white/5 px-1.5 py-1 text-xs text-white"
                            />
                          </label>
                        ))}
                      </div>
                      <button
                        type="button"
                        disabled={Boolean(busy) || Boolean(snapshot.base.army.trainingType) || Object.values(marchArmy).reduce((s, c) => s + c, 0) === 0}
                        onClick={() => void act(`march-${event.id}`, { type: "dispatch", eventId: event.id, ...marchArmy })}
                        className="mt-2 w-full rounded-md bg-rose-600 px-2 py-1.5 text-xs font-bold text-white disabled:opacity-40"
                      >
                        Cử quân đi đánh
                      </button>
                    </div>
                  )}

                  {/* Leaderboard */}
                  {event.leaderboard.length > 0 && (
                    <div className="mt-2 border-t border-white/10 pt-2">
                      {event.leaderboard.slice(0, 5).map((player, idx) => (
                        <div key={`${event.id}-${idx}`} className="flex justify-between py-0.5 text-xs text-white/50">
                          <span>{idx + 1}. {player.name}</span>
                          <span className="font-bold text-white/70">{player.score.toLocaleString("vi-VN")}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Tab: Alliance ── */}
          {activeTab === "alliance" && (
            <WorldAlliancePanel />
          )}
        </div>
      )}

      {/* ── Bottom info bar ── */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-3 p-3">
        <div className="flex items-end gap-3">
          {/* Minimap */}
          <div className="pointer-events-auto">
            <Minimap />
          </div>
          <div className="pointer-events-auto flex flex-col gap-1">
            <div className="rounded-lg bg-black/50 px-3 py-1 text-xs text-white/50 backdrop-blur-sm">
              <FPSCounter /> · {quality} · {viewMode === "city" ? "City View" : "World Map"}
            </div>
            <div className="rounded-lg bg-black/50 px-3 py-1 text-[10px] text-white/30 backdrop-blur-sm">
              LMB: Xoay · RMB: Di chuyển · Scroll: Zoom · V: Đổi góc · M: Menu · 1/2/3: Quality
            </div>
          </div>
        </div>
        <div className="pointer-events-auto rounded-lg bg-black/50 px-3 py-1 text-[10px] text-white/30 backdrop-blur-sm text-right">
          A2 Kingdom 3D<br />
          <span className="text-white/20">v2.0 — Three.js</span>
        </div>
      </div>
    </div>
  );
}
