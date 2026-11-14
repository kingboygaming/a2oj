"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { WorldAlliancePanel } from "@/components/WorldAlliancePanel";
import { useGraphicsStore } from "@/components/world3d/engine/useGraphicsStore";
import { useCameraStore } from "@/components/world3d/engine/useCameraStore";
import { useHeaderHeight } from "@/components/world3d/engine/useHeaderHeight";
import { useWorldRealtime } from "@/components/world3d/realtime/useWorldRealtime";
import type { GraphicsQuality } from "@/components/world3d/engine/GraphicsSettings";
import type { WorldSnapshot } from "@/lib/world";
import type { WorldEntityPayload } from "@/lib/world-realtime";
import { mergeWorldEntities, mergeWorldSnapshot } from "@/lib/world-merge";
import { Minimap } from "@/components/Minimap";
import { FPSCounter } from "@/components/FPSCounter";
import { WorldObjectPanel } from "@/components/world3d/interaction/WorldObjectPanel";
import type { WorldMapObject } from "@/lib/world-map-objects";
import { CityBuildingPanel } from "@/components/world3d/city/CityBuildingPanel";
import { WorldResearchPanel } from "@/components/world3d/city/WorldResearchPanel";
import {
  WORLD_BUILDING_DEFINITIONS,
  WORLD_TRAINING_BUILDINGS,
  type WorldBuildingType,
} from "@/lib/world-buildings";
import type { WorldResearchKey } from "@/lib/world-research";

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
  | { type: "train"; troopType: "INFANTRY" | "ARCHERS" | "CAVALRY"; count: number }
  | { type: "dispatch"; eventId: string; infantry: number; archers: number; cavalry: number }
  | { type: "attackBase"; targetUserId: string; infantry: number; archers: number; cavalry: number };

type WorldMapActionRequest =
  | { type: "GATHER"; targetId: string }
  | { type: "DISPATCH"; targetId: string; infantry: number; archers: number; cavalry: number };

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
  const [attackArmy, setAttackArmy] = useState({ infantry: 0, archers: 0, cavalry: 0 });
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [showPanel, setShowPanel] = useState(true);
  const [activeTab, setActiveTab] = useState<"base" | "army" | "research" | "events" | "alliance" | "build">("base");
  const [selectedWorldObject, setSelectedWorldObject] = useState<WorldMapObject | null>(null);
  const [selectedRemoteBase, setSelectedRemoteBase] = useState<WorldSnapshot["nearbyBases"][number] | null>(null);
  const [selectedPlotIndex, setSelectedPlotIndex] = useState<number | null>(null);
  const [placementType, setPlacementType] = useState<WorldBuildingType | null>(null);

  const quality = useGraphicsStore((s) => s.quality);
  const setQuality = useGraphicsStore((s) => s.setQuality);
  const hydrateQuality = useGraphicsStore((s) => s.hydrateQuality);
  const { viewMode, setViewMode } = useCameraStore();
  // Keep the game flush with the real header height (not a hardcoded 64px).
  useHeaderHeight();

  // Apply the persisted graphics preset after hydration (see useGraphicsStore).
  useEffect(() => {
    hydrateQuality();
  }, [hydrateQuality]);

  // De-duplicate concurrent snapshot fetches: polling, actions and the manual
  // refresh button all share the same in-flight request.
  const refreshInFlight = useRef<Promise<void> | null>(null);

  const refresh = useCallback(async () => {
    if (refreshInFlight.current) return refreshInFlight.current;
    const task = (async () => {
      const response = await fetch("/api/world", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Không thể tải trạng thái thế giới.");
      // A realtime merge may have applied a newer row while this request was in
      // flight; keep the newer entity versions instead of overwriting them.
      setSnapshot((current) => mergeWorldSnapshot(current, result as WorldSnapshot));
    })();
    refreshInFlight.current = task;
    try {
      await task;
    } finally {
      refreshInFlight.current = null;
    }
  }, []);

  const applyRealtimeEntities = useCallback((payload: WorldEntityPayload) => {
    setSnapshot((current) => mergeWorldEntities(current, payload));
  }, []);

  // A BASE hint means a base changed (attack, shield, resources). The entity
  // endpoint never returns the viewer's own base, so reload the full snapshot.
  const refreshFromBaseHint = useCallback(() => {
    void refresh().catch(() => {
      // The next hint or the 5 minute resync retries this.
    });
  }, [refresh]);

  // Hybrid realtime: broadcast hints + authoritative entity fetches, with a
  // 12s polling fallback that pauses while the tab is hidden.
  const realtime = useWorldRealtime({
    userId: snapshot.userId,
    coordinateX: snapshot.base.coordinateX,
    coordinateZ: snapshot.base.coordinateZ,
    onEntities: applyRealtimeEntities,
    onBaseHint: refreshFromBaseHint,
  });

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === "v" || e.key === "V") setViewMode(viewMode === "world" ? "city" : "world");
      if (e.key === "Escape") {
        setShowPanel(false);
        setSelectedRemoteBase(null);
        setSelectedWorldObject(null);
      }
      if (e.key === "m" || e.key === "M") setShowPanel((p) => !p);
      if (e.key === "1") setQuality("LOW");
      if (e.key === "2") setQuality("MEDIUM");
      if (e.key === "3") setQuality("HIGH");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewMode, setViewMode, setQuality]);

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

  async function buildingAction(
    type: "BUILD" | "UPGRADE" | "DEMOLISH" | "UPGRADE_CASTLE",
    plotIndex?: number,
    buildingType?: WorldBuildingType,
  ) {
    setBusy("building");
    setMessage("");
    setIsError(false);
    try {
      const response = await fetch("/api/world/buildings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          ...(plotIndex === undefined ? {} : { plotIndex }),
          ...(buildingType ? { buildingType } : {}),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Không thể xây dựng công trình.");
      setMessage(result.message);
      setPlacementType(null);
      await refresh();
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "Không thể xây dựng công trình.");
    } finally {
      setBusy("");
    }
  }

  async function researchAction(researchKey: WorldResearchKey) {
    setBusy("research");
    setMessage("");
    setIsError(false);
    try {
      const response = await fetch("/api/world/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ researchKey }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Không thể bắt đầu nghiên cứu.");
      setMessage(result.message);
      await refresh();
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "Không thể bắt đầu nghiên cứu.");
    } finally {
      setBusy("");
    }
  }

  async function worldMapAction(action: WorldMapActionRequest) {
    const response = await fetch("/api/world/map/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Không thể thực hiện thao tác bản đồ.");
    if (typeof result.message !== "string") throw new Error("Máy chủ trả về kết quả thao tác không hợp lệ.");
    await refresh();
    return result.message;
  }

  const selectedWorldObjectState = selectedWorldObject
    ? snapshot.mapObjects.find((entry) => entry.id === selectedWorldObject.id) ?? null
    : null;
  const selectedWorldObjectMission = selectedWorldObject
    ? snapshot.mapMissions.find((entry) => entry.targetId === selectedWorldObject.id) ?? null
    : null;
  const castleBuilding = selectedPlotIndex === null
    ? null
    : snapshot.buildings.find((building) => building.plotIndex === selectedPlotIndex) ?? null;
  const activeMarch = snapshot.events.find((event) => event.activeMarch)?.activeMarch ?? null;

  return (
    <div className="world-fullscreen world-viewport relative w-full overflow-hidden">
      {/* ── 3D Viewport ── */}
      <div className="absolute inset-0">
        <WorldEngine className="h-full w-full">
          <WorldScene
            baseData={{
              factoryLevel: snapshot.base.factoryLevel,
              warehouseLevel: snapshot.base.warehouseLevel,
              castleLevel: snapshot.base.castleLevel,
              playerName: snapshot.base.playerName,
              coordinateX: snapshot.base.coordinateX,
              coordinateZ: snapshot.base.coordinateZ,
              buildings: snapshot.buildings,
              army: {
                infantry: snapshot.base.army.infantry,
                archers: snapshot.base.army.archers,
                cavalry: snapshot.base.army.cavalry,
                marchActive: snapshot.base.army.marchActive,
              },
            }}
            selectedWorldObjectId={selectedWorldObject?.id ?? null}
            mapObjectStates={snapshot.mapObjects}
            mapObjects={snapshot.mapObjectDefinitions}
            nearbyBases={snapshot.nearbyBases}
            selectedBaseUserId={selectedRemoteBase?.userId ?? null}
            currentUserId={snapshot.userId}
            selectedPlotIndex={selectedPlotIndex}
            placementType={placementType}
            onSelectWorldObject={(object) => {
              setSelectedWorldObject(object);
              setSelectedRemoteBase(null);
              setShowPanel(false);
            }}
            onSelectBase={(base) => {
              setSelectedRemoteBase(base);
              setSelectedWorldObject(null);
              setShowPanel(false);
            }}
            onSelectPlot={(plotIndex) => {
              setSelectedWorldObject(null);
              setSelectedRemoteBase(null);
              setSelectedPlotIndex(plotIndex);
              setPlacementType(null);
              setActiveTab("build");
              setShowPanel(true);
            }}
            onSelectCastle={() => {
              setSelectedPlotIndex(null);
              setSelectedRemoteBase(null);
              setPlacementType(null);
              setActiveTab("base");
              setShowPanel(true);
            }}
            onSelectBuilding={(plotIndex) => {
              setSelectedWorldObject(null);
              setSelectedRemoteBase(null);
              setSelectedPlotIndex(plotIndex);
              setPlacementType(null);
              setActiveTab("build");
              setShowPanel(true);
            }}
          />
        </WorldEngine>
      </div>

      {viewMode === "world" && selectedWorldObject && (
        <div className="absolute left-3 top-28 z-20">
          {selectedWorldObjectState && (
            <WorldObjectPanel
              key={selectedWorldObject.id}
              object={selectedWorldObject}
              state={selectedWorldObjectState}
              army={snapshot.base.army}
              militaryTier={snapshot.base.militaryTier}
              isOwner={
                selectedWorldObjectState.kind === "RESOURCE" &&
                selectedWorldObjectState.ownerUserId === snapshot.userId
              }
              mission={selectedWorldObjectMission}
              onDispatch={(troops) =>
                worldMapAction({ type: "DISPATCH", targetId: selectedWorldObject.id, ...troops })
              }
              onGather={() =>
                worldMapAction({ type: "GATHER", targetId: selectedWorldObject.id })
              }
              onClose={() => setSelectedWorldObject(null)}
            />
          )}
        </div>
      )}

      {/* ── Remote Player Castle Panel ── */}
      {viewMode === "world" && selectedRemoteBase && (
        <div className="absolute left-3 top-28 z-20 w-80 rounded-2xl border border-orange-500/30 bg-black/80 p-4 text-white shadow-2xl backdrop-blur-md">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-orange-400">Căn cứ đối thủ</p>
              <h3 className="text-base font-bold text-white">{selectedRemoteBase.displayName || selectedRemoteBase.username}</h3>
              <p className="text-xs text-white/50">
                📍 Tọa độ ({selectedRemoteBase.coordinateX}, {selectedRemoteBase.coordinateZ}) · {(selectedRemoteBase.distanceMeters / 1000).toFixed(1)} km
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedRemoteBase(null)}
              className="rounded-lg p-1 text-white/40 hover:bg-white/10 hover:text-white"
            >
              ✕
            </button>
          </div>

          {selectedRemoteBase.pvpShieldUntil && new Date(selectedRemoteBase.pvpShieldUntil) > new Date() ? (
            <div className="mt-3 rounded-lg border border-sky-400/30 bg-sky-500/10 p-2.5 text-xs text-sky-200">
              🛡️ Căn cứ đang được khiên bảo vệ đến {utcLabel(selectedRemoteBase.pvpShieldUntil)}
            </div>
          ) : (
            <div className="mt-3 space-y-2.5">
              <p className="text-xs font-bold text-amber-300">Cử quân tấn công căn cứ:</p>
              <div className="space-y-1.5">
                {([
                  { key: "infantry" as const, label: "🛡️ Bộ binh", available: snapshot.base.army.infantry },
                  { key: "archers" as const, label: "🏹 Cung thủ", available: snapshot.base.army.archers },
                  { key: "cavalry" as const, label: "🐎 Kỵ binh", available: snapshot.base.army.cavalry },
                ]).map((troop) => (
                  <div key={troop.key} className="flex items-center justify-between text-xs">
                    <span className="text-white/70">{troop.label} (có {troop.available})</span>
                    <input
                      type="number"
                      min={0}
                      max={troop.available}
                      value={attackArmy[troop.key]}
                      onChange={(e) =>
                        setAttackArmy((prev) => ({
                          ...prev,
                          [troop.key]: Math.max(0, Math.min(troop.available, Number(e.target.value) || 0)),
                        }))
                      }
                      className="w-16 rounded border border-white/20 bg-white/10 px-2 py-0.5 text-right font-mono text-xs text-white"
                    />
                  </div>
                ))}
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={
                    Boolean(busy) ||
                    (attackArmy.infantry + attackArmy.archers + attackArmy.cavalry) === 0 ||
                    snapshot.base.army.marchActive
                  }
                  onClick={() =>
                    act("attack-base", {
                      type: "attackBase",
                      targetUserId: selectedRemoteBase.userId,
                      ...attackArmy,
                    })
                  }
                  className="flex-1 rounded-xl bg-gradient-to-r from-rose-600 to-orange-500 py-2 text-center text-xs font-bold text-white shadow-lg transition hover:brightness-110 disabled:opacity-40"
                >
                  {busy === "attack-base" ? "Đang xuất trận..." : "⚔️ Tấn công ngay"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

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
          <div className="flex items-center gap-2 rounded-xl border border-lime-500/25 bg-black/65 px-3 py-1.5 backdrop-blur-md">
            <span className="text-base">🌾</span>
            <div>
              <p className="text-xs font-bold leading-none text-white">
                {snapshot.base.food.toLocaleString("vi-VN")} / {snapshot.base.capacity.toLocaleString("vi-VN")}
              </p>
              <p className="mt-0.5 text-[10px] leading-none text-lime-300/60">+{snapshot.base.foodPerHour}/h · lương thực</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-cyan-500/20 bg-black/65 px-3 py-1.5 text-[10px] font-bold text-white/75 backdrop-blur-md">
            <span>⛓️ {snapshot.base.iron.toLocaleString("vi-VN")} sắt</span>
            <span>💎 {snapshot.base.rare.toLocaleString("vi-VN")} hiếm</span>
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
              ⏱ Offline {formatElapsed(snapshot.offline.elapsedSeconds)}: +{snapshot.offline.producedWood} gỗ, +{snapshot.offline.producedStone} đá, +{snapshot.offline.producedFood} lương thực
              {snapshot.offline.cappedOfflineTime && " (giới hạn 48h)"}
            </div>
          )}

          {/* Tabs */}
          <div className="mb-3 flex gap-1">
            {(["base", "army", "research", "events", "alliance", "build"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`min-w-0 flex-1 rounded-md px-1.5 py-1.5 text-[10px] font-bold transition sm:text-xs ${
                  activeTab === tab
                    ? "bg-[var(--teal)] text-white"
                    : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                }`}
              >
                {tab === "base"
                  ? "🏰 Căn cứ"
                  : tab === "army"
                    ? "⚔️ Quân"
                    : tab === "research"
                      ? "🔬 Nghiên cứu"
                      : tab === "events"
                        ? "📅 Sự kiện"
                        : tab === "alliance"
                          ? "🤝 Liên minh"
                          : "🏗️ Xây"}
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

              <div className="rounded-xl border border-amber-200/10 bg-gradient-to-br from-amber-300/10 to-transparent p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-200/70">Thành chính</p>
                <p className="mt-1 text-lg font-bold text-white">{snapshot.base.playerName}</p>
                <p className="mt-1 text-xs text-white/55">
                  Cấp {snapshot.base.castleLevel} · {snapshot.buildings.length}/12 ô đất đã sử dụng · sức chứa {snapshot.base.capacity.toLocaleString("vi-VN")}
                </p>
                <p className="mt-1 text-xs text-white/55">
                  Chiến lực {(
                    snapshot.base.army.infantry * 10 +
                    snapshot.base.army.archers * 15 +
                    snapshot.base.army.cavalry * 20
                  ).toLocaleString("vi-VN")}
                </p>
                <p className="mt-2 text-[10px] leading-4 text-white/40">
                  Các công trình sản xuất chỉ xuất hiện sau khi bạn tự xây dựng. Dữ liệu tài nguyên hiện có không bị đặt lại.
                </p>
                {snapshot.base.castlePendingLevel ? (
                  <p className="mt-3 rounded-lg bg-amber-200/10 px-3 py-2 text-xs text-amber-100">
                    ⏳ Đang nâng cấp lên cấp {snapshot.base.castlePendingLevel} · {snapshot.base.castleUpgradeCompletesAt ? utcLabel(snapshot.base.castleUpgradeCompletesAt) : ""}
                  </p>
                ) : (
                  <button
                    type="button"
                    disabled={
                      Boolean(busy) ||
                      snapshot.base.castleLevel >= 20 ||
                      snapshot.base.wood < 250 * (snapshot.base.castleLevel + 1) ||
                      snapshot.base.stone < 150 * (snapshot.base.castleLevel + 1)
                    }
                    onClick={() => void buildingAction("UPGRADE_CASTLE")}
                    className="mt-3 w-full rounded-lg border border-amber-200/25 bg-amber-200/10 px-3 py-2 text-xs font-bold text-amber-100 hover:bg-amber-200/15 disabled:opacity-40"
                  >
                    {snapshot.base.castleLevel >= 20
                      ? "Lâu đài đạt cấp tối đa"
                      : `Nâng cấp lâu đài → cấp ${snapshot.base.castleLevel + 1} · ${250 * (snapshot.base.castleLevel + 1)} gỗ + ${150 * (snapshot.base.castleLevel + 1)} đá`}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setViewMode("city");
                    setActiveTab("build");
                    setShowPanel(true);
                  }}
                  className="mt-3 w-full rounded-lg border border-amber-200/25 bg-amber-200/10 px-3 py-2 text-xs font-bold text-amber-100 hover:bg-amber-200/15"
                >
                  🏰 Vào thành phố · xây dựng
                </button>
              </div>
            </div>
          )}

          {activeTab === "build" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-200/80">Quy hoạch thành phố</p>
                  <p className="mt-1 text-[10px] text-white/45">Chọn ô đất trong cảnh 3D để xây hoặc quản lý công trình.</p>
                </div>
                {viewMode !== "city" && (
                  <button
                    type="button"
                    onClick={() => setViewMode("city")}
                    className="shrink-0 rounded-lg bg-amber-600 px-2.5 py-1.5 text-[10px] font-bold text-white"
                  >
                    Mở City View
                  </button>
                )}
              </div>
              <CityBuildingPanel
                plotIndex={selectedPlotIndex}
                building={castleBuilding}
                castleLevel={snapshot.base.castleLevel}
                wood={snapshot.base.wood}
                stone={snapshot.base.stone}
                busy={Boolean(busy)}
                onChoose={(type) => setPlacementType(type)}
                onAction={(type, plotIndex, buildingType) => {
                  if (type === "BUILD" && !buildingType) return;
                  void buildingAction(type, plotIndex, buildingType);
                }}
              />
              {placementType && selectedPlotIndex !== null && !castleBuilding && (
                <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/5 p-3 text-xs text-emerald-100">
                  <p className="font-bold">Ghost preview · {WORLD_BUILDING_DEFINITIONS[placementType].name}</p>
                  <p className="mt-1 text-white/55">Ô đất {selectedPlotIndex + 1}; xác nhận để trừ tài nguyên và lưu công trình trên máy chủ.</p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() => void buildingAction("BUILD", selectedPlotIndex, placementType)}
                      className="flex-1 rounded-lg bg-emerald-700 px-3 py-2 font-bold text-white disabled:opacity-40"
                    >
                      Xác nhận xây · {WORLD_BUILDING_DEFINITIONS[placementType].woodCost}🪵 {WORLD_BUILDING_DEFINITIONS[placementType].stoneCost}🪨
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlacementType(null)}
                      className="rounded-lg border border-white/15 px-3 py-2 text-white/70"
                    >
                      Hủy
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "research" && (
            <WorldResearchPanel
              research={snapshot.research}
              activeResearch={snapshot.base.activeResearch}
              militaryTier={snapshot.base.militaryTier}
              researchSpeedLevel={snapshot.base.researchSpeedLevel}
              castleLevel={snapshot.base.castleLevel}
              resources={{
                wood: snapshot.base.wood,
                stone: snapshot.base.stone,
                iron: snapshot.base.iron,
                food: snapshot.base.food,
                rare: snapshot.base.rare,
              }}
              busy={busy === "research"}
              onStart={(key) => void researchAction(key)}
            />
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
                { type: "INFANTRY" as const, label: "🛡️ Bộ binh", count: snapshot.base.army.infantry, cost: "10 gỗ · 5 đá" },
                { type: "ARCHERS" as const, label: "🏹 Cung thủ", count: snapshot.base.army.archers, cost: "15 gỗ · 5 đá" },
                { type: "CAVALRY" as const, label: "🐎 Kỵ binh", count: snapshot.base.army.cavalry, cost: "20 gỗ · 10 đá" },
              ]).map((troop) => {
                const requiredType = WORLD_TRAINING_BUILDINGS[troop.type];
                const requiredName = WORLD_BUILDING_DEFINITIONS[requiredType].name;
                const hasBuilding = snapshot.buildings.some(
                  (building) => building.type === requiredType && (building.level > 0 || building.status === "COMPLETED"),
                );
                return (
                  <div key={troop.type} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3">
                    <div>
                      <p className="text-sm font-bold text-white">{troop.label}</p>
                      <p className="text-xs text-white/50">{troop.count.toLocaleString("vi-VN")} quân · {troop.cost}/lính</p>
                      <p className="mt-1 text-[10px] text-white/40">{hasBuilding ? requiredName : `Cần xây ${requiredName}`}</p>
                    </div>
                    <button
                      type="button"
                      disabled={Boolean(busy) || Boolean(snapshot.base.army.trainingType) || !hasBuilding}
                      onClick={() => void act(`train-${troop.type}`, { type: "train", troopType: troop.type, count: trainingCount })}
                      className="rounded-md border border-teal-500 px-2.5 py-1 text-xs font-bold text-teal-400 disabled:opacity-40"
                    >
                      {busy === `train-${troop.type}` ? "…" : `+${trainingCount}`}
                    </button>
                  </div>
                );
              })}
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
                      <p className="mt-0.5 text-[10px] text-white/40">Yêu cầu Thành chính cấp {event.minFactoryLevel}+</p>
                    </div>
                    {event.status === "ACTIVE" && !event.joined && (
                      <button
                        type="button"
                        disabled={Boolean(busy) || snapshot.base.castleLevel < event.minFactoryLevel}
                        onClick={() => void act(`join-${event.id}`, { type: "join", eventId: event.id })}
                        className="shrink-0 rounded-md border border-teal-500 px-2 py-1 text-xs font-bold text-teal-400 disabled:opacity-40"
                      >
                        {snapshot.base.castleLevel < event.minFactoryLevel ? `Cần cấp ${event.minFactoryLevel}` : "Tham gia"}
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
            <Minimap
              cityX={snapshot.base.coordinateX}
              cityZ={snapshot.base.coordinateZ}
              nearbyBases={snapshot.nearbyBases.map((base) => ({
                coordinateX: base.coordinateX,
                coordinateZ: base.coordinateZ,
                displayName: base.displayName || base.username,
                pvpShieldUntil: base.pvpShieldUntil,
              }))}
            />
          </div>
          <div className="pointer-events-auto flex flex-col gap-1">
            <div className="rounded-lg bg-black/50 px-3 py-1 text-xs text-white/50 backdrop-blur-sm">
              <FPSCounter /> · {quality} · {viewMode === "city" ? "City View" : "World Map"}
            </div>
            <div className="flex items-center gap-1.5 rounded-lg bg-black/50 px-3 py-1 text-[10px] text-white/40 backdrop-blur-sm">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  realtime.status === "live"
                    ? "bg-emerald-400"
                    : realtime.status === "connecting"
                      ? "animate-pulse bg-amber-300"
                      : realtime.status === "polling"
                        ? "bg-amber-400"
                        : "bg-red-400"
                }`}
              />
              {realtime.status === "live"
                ? "Realtime"
                : realtime.status === "connecting"
                  ? "Đang kết nối"
                  : realtime.status === "polling"
                    ? "Đồng bộ 12s"
                    : "Ngoại tuyến"}
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
