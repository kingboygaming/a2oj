"use client";

import { useMemo } from "react";
import * as THREE from "three";
import {
  EXPLORATION_REGION_METERS,
  isRegionOnFrontier,
  regionCenter,
  regionDistanceMeters,
  regionKey,
} from "@/lib/world-exploration";
import { METERS_PER_RENDER_UNIT, worldToRender } from "@/lib/world-coordinates";
import type { WorldExplorationRegionView } from "@/lib/world";
import { heightAtRender } from "./terrain/BiomeManager";

interface FogOfWarSystemProps {
  anchorWorldX: number;
  anchorWorldZ: number;
  viewRadiusMeters: number;
  explorationRegions: WorldExplorationRegionView[];
}

const CELL_UNITS = EXPLORATION_REGION_METERS / METERS_PER_RENDER_UNIT;

/**
 * Draws dark "unexplored" tiles on the frontier cells around the revealed
 * territory. The server already filters objects and remote bases inside fog,
 * so this is purely the visual boundary of the known world.
 */
export function FogOfWarSystem({
  anchorWorldX,
  anchorWorldZ,
  viewRadiusMeters,
  explorationRegions,
}: FogOfWarSystemProps) {
  const tiles = useMemo(() => {
    const revealed = new Set(
      explorationRegions.map((region) => regionKey(region.regionX, region.regionZ)),
    );
    const candidates = new Map<string, { regionX: number; regionZ: number }>();
    for (const region of explorationRegions) {
      for (let dx = -1; dx <= 1; dx += 1) {
        for (let dz = -1; dz <= 1; dz += 1) {
          if (dx === 0 && dz === 0) continue;
          const regionX = region.regionX + dx;
          const regionZ = region.regionZ + dz;
          const key = regionKey(regionX, regionZ);
          if (revealed.has(key)) continue;
          candidates.set(key, { regionX, regionZ });
        }
      }
    }

    return [...candidates.values()]
      .filter((region) => isRegionOnFrontier(region.regionX, region.regionZ, revealed))
      .filter(
        (region) =>
          regionDistanceMeters(anchorWorldX, anchorWorldZ, region.regionX, region.regionZ) <=
          viewRadiusMeters,
      )
      .map((region) => {
        const center = regionCenter(region.regionX, region.regionZ);
        const render = worldToRender(center.x, center.z, anchorWorldX, anchorWorldZ);
        return {
          key: regionKey(region.regionX, region.regionZ),
          x: render.x,
          z: render.z,
          y: heightAtRender(render.x, render.z, anchorWorldX, anchorWorldZ) + 0.6,
        };
      });
  }, [anchorWorldX, anchorWorldZ, viewRadiusMeters, explorationRegions]);

  if (tiles.length === 0) return null;

  return (
    <group renderOrder={1}>
      {tiles.map((tile) => (
        <mesh
          key={tile.key}
          position={[tile.x, tile.y, tile.z]}
          rotation={[-Math.PI / 2, 0, 0]}
          renderOrder={1}
        >
          <planeGeometry args={[CELL_UNITS * 0.98, CELL_UNITS * 0.98]} />
          <meshBasicMaterial
            color={new THREE.Color("#0b1224")}
            transparent
            opacity={0.52}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}
