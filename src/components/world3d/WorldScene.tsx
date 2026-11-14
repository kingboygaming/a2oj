"use client";

import { Suspense } from "react";
import { CameraController } from "./engine/CameraController";
import { LightingSystem } from "./atmosphere/LightingSystem";
import { AtmosphereSystem } from "./atmosphere/AtmosphereSystem";
import { TerrainSystem } from "./terrain/TerrainSystem";
import { WaterSystem } from "./terrain/WaterSystem";
import { CastleSystem } from "./city/CastleSystem";
import { VegetationSystem } from "./vegetation/VegetationSystem";
import { ArmySystem } from "./army/ArmySystem";
import { GroundDecals } from "./terrain/GroundDecals";
import { heightAtRender } from "./terrain/BiomeManager";
import { WorldMapSystem } from "./interaction/WorldMapSystem";
import { RemoteCastlesSystem, type RemoteBaseInfo } from "./interaction/RemoteCastlesSystem";
import type { WorldMapObject } from "@/lib/world-map-objects";
import type { WorldBuildingType, WorldBuildingView } from "@/lib/world-buildings";
import type { WorldMapObjectState } from "@/lib/world";
import { useCameraStore } from "./engine/useCameraStore";
import { useViewStore } from "./engine/useViewStore";
import { METERS_PER_RENDER_UNIT } from "@/lib/world-coordinates";

interface WorldSceneProps {
  baseData: {
    factoryLevel: number;
    warehouseLevel: number;
    castleLevel: number;
    playerName: string;
    coordinateX: number;
    coordinateZ: number;
    buildings: WorldBuildingView[];
    castleUpgradeCompletesAt?: string | null;
    training?: {
      trainingType: string | null;
      trainingCount: number;
      trainingCompletesAt: string | null;
    } | null;
    activeScout?: { completesAt: number; targetName: string } | null;
    activeResearch?: { key: string; name?: string; completesAt: string | null } | null;
    hospital?: {
      healingType: string | null;
      healingCount: number;
      healingCompletesAt: string | null;
    } | null;
    onActivityComplete?: () => void;
    army: {
      infantry: number;
      archers: number;
      cavalry: number;
      marchActive: boolean;
    };
  };
  selectedWorldObjectId: string | null;
  mapObjectStates: WorldMapObjectState[];
  mapObjects?: WorldMapObject[];
  nearbyBases?: RemoteBaseInfo[];
  selectedBaseUserId?: string | null;
  currentUserId: string;
  selectedPlotIndex: number | null;
  placementType: WorldBuildingType | null;
  onSelectWorldObject: (object: WorldMapObject) => void;
  onSelectBase?: (base: RemoteBaseInfo) => void;
  onSelectPlot: (plotIndex: number) => void;
  onSelectCastle: () => void;
  onSelectBuilding: (plotIndex: number) => void;
}

function LoadingFallback() {
  return (
    <mesh position={[0, 1, 0]}>
      <boxGeometry args={[2, 2, 2]} />
      <meshStandardMaterial color="#38bdf8" wireframe />
    </mesh>
  );
}

export function WorldScene({
  baseData,
  selectedWorldObjectId,
  mapObjectStates,
  mapObjects,
  nearbyBases = [],
  selectedBaseUserId = null,
  currentUserId,
  selectedPlotIndex,
  placementType,
  onSelectWorldObject,
  onSelectBase = () => {},
  onSelectPlot,
  onSelectCastle,
  onSelectBuilding,
}: WorldSceneProps) {
  const viewMode = useCameraStore((state) => state.viewMode);
  const viewRadiusMeters = useViewStore((state) => state.viewRadiusMeters);
  const viewRadiusUnits = viewRadiusMeters / METERS_PER_RENDER_UNIT;

  // In render space, player's own city is anchored at (0, 0).
  // Terrain height is anchored to the base's stored world coordinates (metres).
  const cityX = 0;
  const cityZ = 0;
  const cityY = heightAtRender(cityX, cityZ, baseData.coordinateX, baseData.coordinateZ);
  const cityPosition: [number, number, number] = [cityX, cityY, cityZ];

  return (
    <>
      {/* Camera */}
      <CameraController />

      {/* Lighting & Atmosphere */}
      <LightingSystem />
      <AtmosphereSystem />

      {/* Terrain & Water (sample noise at player world coordinates) */}
      <Suspense fallback={<LoadingFallback />}>
        <TerrainSystem
          worldOffsetX={baseData.coordinateX}
          worldOffsetZ={baseData.coordinateZ}
        />
        <WaterSystem
          worldOffsetX={baseData.coordinateX}
          worldOffsetZ={baseData.coordinateZ}
        />
      </Suspense>

      {/* Player's City */}
      <Suspense fallback={<LoadingFallback />}>
        <CastleSystem
          position={cityPosition}
          anchorWorldX={baseData.coordinateX}
          anchorWorldZ={baseData.coordinateZ}
          castleLevel={baseData.castleLevel}
          playerName={baseData.playerName}
          buildings={baseData.buildings}
          cityView={viewMode === "city"}
          selectedPlotIndex={selectedPlotIndex}
          placementType={placementType}
          castleUpgradeCompletesAt={baseData.castleUpgradeCompletesAt}
          armyTraining={baseData.training}
          activeScout={baseData.activeScout}
          activeResearch={baseData.activeResearch}
          healing={baseData.hospital}
          onActivityComplete={baseData.onActivityComplete}
          onSelectPlot={onSelectPlot}
          onSelectCastle={onSelectCastle}
          onSelectBuilding={onSelectBuilding}
        />
      </Suspense>

      {viewMode === "world" ? (
        <>
          <Suspense fallback={null}>
            <VegetationSystem
              cityPosition={cityPosition}
              worldOffsetX={baseData.coordinateX}
              worldOffsetZ={baseData.coordinateZ}
            />
            <ArmySystem
              position={cityPosition}
              anchorWorldX={baseData.coordinateX}
              anchorWorldZ={baseData.coordinateZ}
              army={{
                infantry: baseData.army.infantry,
                archers: baseData.army.archers,
                cavalry: baseData.army.cavalry,
              }}
              marchActive={baseData.army.marchActive}
            />
            {/* Other players' castles rendered in shared world */}
            <RemoteCastlesSystem
              playerCoordinateX={baseData.coordinateX}
              playerCoordinateZ={baseData.coordinateZ}
              nearbyBases={nearbyBases}
              selectedBaseUserId={selectedBaseUserId}
              onSelectBase={onSelectBase}
              maxRenderDistance={viewRadiusUnits}
            />
            {/* Resource nodes and rogue camps */}
            <WorldMapSystem
              selectedId={selectedWorldObjectId}
              objectStates={mapObjectStates}
              mapObjects={mapObjects}
              playerCoordinateX={baseData.coordinateX}
              playerCoordinateZ={baseData.coordinateZ}
              maxRenderDistance={viewRadiusUnits}
              currentUserId={currentUserId}
              onSelect={onSelectWorldObject}
            />
          </Suspense>
          <GroundDecals
            cityPosition={cityPosition}
            anchorWorldX={baseData.coordinateX}
            anchorWorldZ={baseData.coordinateZ}
          />
        </>
      ) : null}
    </>
  );
}
