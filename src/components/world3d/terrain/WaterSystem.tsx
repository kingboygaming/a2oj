"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useGraphicsStore } from "../engine/useGraphicsStore";
import { heightAtRender, WATER_LEVEL } from "./BiomeManager";
import { TERRAIN_SIZE_UNITS } from "@/lib/world-coordinates";

/**
 * Water surface built from the same continuous height field as the terrain.
 * Every grid cell whose average height is below WATER_LEVEL contributes a
 * quad, so rivers and lakes line up with the carved terrain instead of being
 * guessed from biome labels. The result is a single merged mesh (one draw
 * call) instead of hundreds of patch meshes.
 */
function buildWaterGeometry(
  segments: number,
  worldOffsetX: number,
  worldOffsetZ: number,
): THREE.BufferGeometry | null {
  const step = TERRAIN_SIZE_UNITS / segments;
  const half = TERRAIN_SIZE_UNITS / 2;
  const positions: number[] = [];
  const indices: number[] = [];

  const gridSize = segments + 1;
  const heights = new Float32Array(gridSize * gridSize);
  for (let iz = 0; iz < gridSize; iz += 1) {
    const z = -half + iz * step;
    for (let ix = 0; ix < gridSize; ix += 1) {
      heights[iz * gridSize + ix] = heightAtRender(
        -half + ix * step,
        z,
        worldOffsetX,
        worldOffsetZ,
      );
    }
  }

  for (let iz = 0; iz < segments; iz += 1) {
    const z0 = -half + iz * step;
    const z1 = z0 + step;
    for (let ix = 0; ix < segments; ix += 1) {
      const x0 = -half + ix * step;
      const x1 = x0 + step;

      const average = (
        heights[iz * gridSize + ix] +
        heights[iz * gridSize + ix + 1] +
        heights[(iz + 1) * gridSize + ix] +
        heights[(iz + 1) * gridSize + ix + 1]
      ) / 4;
      if (average >= WATER_LEVEL - 0.02) continue;

      const base = positions.length / 3;
      positions.push(
        x0, WATER_LEVEL, z0,
        x1, WATER_LEVEL, z0,
        x1, WATER_LEVEL, z1,
        x0, WATER_LEVEL, z1,
      );
      indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
    }
  }

  if (indices.length === 0) return null;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

interface WaterSystemProps {
  worldOffsetX?: number;
  worldOffsetZ?: number;
}

export function WaterSystem({ worldOffsetX = 0, worldOffsetZ = 0 }: WaterSystemProps) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const settings = useGraphicsStore((s) => s.settings);

  const geometry = useMemo(
    () =>
      buildWaterGeometry(
        Math.min(Math.max(settings.terrainSegments, 32), 128),
        worldOffsetX,
        worldOffsetZ,
      ),
    [settings.terrainSegments, worldOffsetX, worldOffsetZ],
  );

  /* Animate via material time uniform instead of moving vertices */
  useFrame(({ clock }) => {
    if (matRef.current) {
      // Slight emissive pulse to simulate water shimmer
      const t = clock.elapsedTime;
      const shimmer = 0.05 + Math.sin(t * 1.5) * 0.03;
      matRef.current.emissiveIntensity = shimmer;
    }
  });

  if (!geometry) return null;

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial
        ref={matRef}
        color="#2389da"
        transparent
        opacity={0.72}
        roughness={0.12}
        metalness={0.35}
        emissive="#2389da"
        emissiveIntensity={0.05}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
