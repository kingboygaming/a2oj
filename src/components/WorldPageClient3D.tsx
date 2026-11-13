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
import { WorldObjectPanel } from "@/components/world3d/interaction/WorldObjectPanel";
import type { WorldMapObject } from "@/components/world3d/interaction/worldObjects";
import { CityBuildingPanel } from "@/components/world3d/city/CityBuildingPanel";
import {
  WORLD_BUILDING_DEFINITIONS,
  WORLD_TRAINING_BUILDINGS,
  type WorldBuildingType,
} from "@/lib/world-buildings";

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
  const [activeTab, setActiveTab] = useState<"base" | "army" | "events" | "alliance" | "build">("base");
  const [selectedWorldObject, setSelectedWorldObject] = useState<WorldMapObject | null>(null);
  const [resourceStates, setResourceStates] = useState<Record<string, { ownerName: string | null; remaining: number }>>({});
  const [selectedPlotIndex, setSelectedPlotIndex] = useState<number | null>(null);
  const [placementType, setPlacementType] = useState<WorldBuildingType | null>(null);

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

  function occupyResource(object: Extract<WorldMapObject, { kind: "RESOURCE" }>, troops: { infantry: number; archers: number; cavalry: number }) {
    setResourceStates((current) => {
      const previous = current[object.id];
      return {
        ...current,
        [object.id]: {
          ownerName: "Bạn",
          remaining: previous?.remaining ?? object.amount,
        },
      };
    });
    const power = troops.infantry * 10 + troops.archers * 15 + troops.cavalry * 20;
    return `Chiếm đóng thành công trong prototype (chiến lực ${power}). Máy chủ chưa ghi nhận đạo quân hoặc quyền sở hữu.`;
  }

  function gatherResource(amount: number) {
    if (!selectedWorldObject || selectedWorldObject.kind !== "RESOURCE") return "Không tìm thấy khu tài nguyên.";
    const currentRemaining = resourceStates[selectedWorldObject.id]?.remaining ?? selectedWorldObject.amount;
    const gathered = Math.min(amount, currentRemaining);
    setResourceStates((current) => ({
      ...current,
      [selectedWorldObject.id]: {
        ownerName: "Bạn",
        remaining: Math.max(0, currentRemaining - gathered),
      },
    }));
    return gathered > 0
      ? `Prototype: khai thác ${gathered.toLocaleString("vi-VN")} ${selectedWorldObject.resource.toLowerCase()}. Chưa cộng tài nguyên vào tài khoản.`
      : "Khu vực đã cạn; hãy chờ tái tạo trong gameplay backend.";
  }

  function attackRogueCamp(
    object: Extract<WorldMapObject, { kind: "ROGUE_CAMP" }>,
    troops: { infantry: number; archers: number; cavalry: number },
  ) {
    const power = troops.infantry * 10 + troops.archers * 15 + troops.cavalry * 20;
    return power >= object.combatPower
      ? `Mock victory · chiến lực ${power} / ${object.combatPower}. Phần thưởng dự kiến: ${object.reward}; chưa được máy chủ cấp.`
      : `Mock defeat · chiến lực ${power} / ${object.combatPower}. Hãy huấn luyện thêm quân; không có tổn thất thật.`;
  }

  const castleBuilding = selectedPlotIndex === null
    ? null
    : snapshot.buildings.find((building) => building.plotIndex === selectedPlotIndex) ?? null;
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
            selectedPlotIndex={selectedPlotIndex}
            placementType={placementType}
            onSelectWorldObject={(object) => {
              setSelectedWorldObject(object);
              setShowPanel(false);
            }}
            onSelectPlot={(plotIndex) => {
              setSelectedWorldObject(null);
              setSelectedPlotIndex(plotIndex);
              setPlacementType(null);
              setActiveTab("build");
              setShowPanel(true);
            }}
            onSelectCastle={() => {
              setSelectedPlotIndex(null);
              setPlacementType(null);
              setActiveTab("base");
              setShowPanel(true);
            }}
            onSelectBuilding={(plotIndex) => {
              setSelectedWorldObject(null);
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
          <WorldObjectPanel
            key={selectedWorldObject.id}
            object={selectedWorldObject}
            army={snapshot.base.army}
            ownerName={
              selectedWorldObject.kind === "RESOURCE"
                ? resourceStates[selectedWorldObject.id]?.ownerName ?? null
                : null
            }
            remaining={
              selectedWorldObject.kind === "RESOURCE"
                ? resourceStates[selectedWorldObject.id]?.remaining ?? selectedWorldObject.amount
                : 0
            }
            onOccupy={(troops) =>
              selectedWorldObject.kind === "RESOURCE"
                ? occupyResource(selectedWorldObject, troops)
                : "Đối tượng không thể chiếm đóng."
            }
            onGather={gatherResource}
            onAttack={(troops) =>
              selectedWorldObject.kind === "ROGUE_CAMP"
                ? attackRogueCamp(selectedWorldObject, troops)
                : "Đối tượng không thể tấn công."
            }
            onClose={() => setSelectedWorldObject(null)}
          />
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
            {(["base", "army", "events", "alliance", "build"] as const).map((tab) => (
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
                {tab === "base" ? "🏰 Căn cứ" : tab === "army" ? "⚔️ Quân" : tab === "events" ? "📅 Sự kiện" : tab === "alliance" ? "🤝 Liên minh" : "🏗️ Xây"}
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
