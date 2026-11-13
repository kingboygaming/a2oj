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
import { getHeightAt } from "./terrain/BiomeManager";
import { WorldMapSystem } from "./interaction/WorldMapSystem";
import type { WorldMapObject } from "./interaction/worldObjects";
import type { WorldBuildingType, WorldBuildingView } from "@/lib/world-buildings";
import { useCameraStore } from "./engine/useCameraStore";

interface WorldSceneProps {
  baseData: {
    factoryLevel: number;
    warehouseLevel: number;
    castleLevel: number;
    playerName: string;
    coordinateX: number;
    coordinateZ: number;
    buildings: WorldBuildingView[];
    army: {
      infantry: number;
      archers: number;
      cavalry: number;
      marchActive: boolean;
    };
  };
  selectedWorldObjectId: string | null;
  selectedPlotIndex: number | null;
  placementType: WorldBuildingType | null;
  onSelectWorldObject: (object: WorldMapObject) => void;
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
  selectedPlotIndex,
  placementType,
  onSelectWorldObject,
  onSelectPlot,
  onSelectCastle,
  onSelectBuilding,
}: WorldSceneProps) {
  const viewMode = useCameraStore((state) => state.viewMode);
  // Normalize coordinates to local world space (center around 0,0)
  // The actual coordinates can be very large, so we center the view
  const cityX = 0;
  const cityZ = 0;
  const cityY = getHeightAt(cityX, cityZ);
  const cityPosition: [number, number, number] = [cityX, cityY, cityZ];

  return (
    <>
      {/* Camera */}
      <CameraController />

      {/* Lighting & Atmosphere */}
      <LightingSystem />
      <AtmosphereSystem />

      {/* Terrain */}
      <Suspense fallback={<LoadingFallback />}>
        <TerrainSystem />
        <WaterSystem />
      </Suspense>

      {/* Player's City */}
      <Suspense fallback={<LoadingFallback />}>
        <CastleSystem
          position={cityPosition}
          castleLevel={baseData.castleLevel}
          playerName={baseData.playerName}
          buildings={baseData.buildings}
          cityView={viewMode === "city"}
          selectedPlotIndex={selectedPlotIndex}
          placementType={placementType}
          onSelectPlot={onSelectPlot}
          onSelectCastle={onSelectCastle}
          onSelectBuilding={onSelectBuilding}
        />
      </Suspense>

      {viewMode === "world" ? (
        <>
          <Suspense fallback={null}>
            <VegetationSystem cityPosition={cityPosition} />
            <ArmySystem
              position={cityPosition}
              army={{
                infantry: baseData.army.infantry,
                archers: baseData.army.archers,
                cavalry: baseData.army.cavalry,
              }}
              marchActive={baseData.army.marchActive}
            />
            <WorldMapSystem
              selectedId={selectedWorldObjectId}
              onSelect={onSelectWorldObject}
            />
          </Suspense>
          <GroundDecals cityPosition={cityPosition} />
        </>
      ) : null}
    </>
  );
}
