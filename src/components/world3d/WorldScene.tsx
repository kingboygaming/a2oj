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
import { ResourceNodes } from "./city/ResourceNodes";
import { GroundDecals } from "./terrain/GroundDecals";
import { getHeightAt } from "./terrain/BiomeManager";

interface WorldSceneProps {
  baseData: {
    factoryLevel: number;
    warehouseLevel: number;
    coordinateX: number;
    coordinateZ: number;
    army: {
      infantry: number;
      archers: number;
      cavalry: number;
      marchActive: boolean;
    };
  };
}

function LoadingFallback() {
  return (
    <mesh position={[0, 1, 0]}>
      <boxGeometry args={[2, 2, 2]} />
      <meshStandardMaterial color="#38bdf8" wireframe />
    </mesh>
  );
}

export function WorldScene({ baseData }: WorldSceneProps) {
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
          baseData={{
            factoryLevel: baseData.factoryLevel,
            warehouseLevel: baseData.warehouseLevel,
          }}
        />
      </Suspense>

      {/* Vegetation */}
      <Suspense fallback={null}>
        <VegetationSystem cityPosition={cityPosition} />
      </Suspense>

      {/* Army */}
      <Suspense fallback={null}>
        <ArmySystem
          position={cityPosition}
          army={{
            infantry: baseData.army.infantry,
            archers: baseData.army.archers,
            cavalry: baseData.army.cavalry,
          }}
          marchActive={baseData.army.marchActive}
        />
      </Suspense>

      {/* Resource nodes + ambient NPCs */}
      <Suspense fallback={null}>
        <ResourceNodes cityPosition={cityPosition} />
      </Suspense>

      {/* Ground decals: cobblestone paths, dirt roads */}
      <GroundDecals cityPosition={cityPosition} />
    </>
  );
}
