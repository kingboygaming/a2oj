"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useGraphicsStore } from "../engine/useGraphicsStore";
import { getBiomeAt } from "./BiomeManager";

const WATER_LEVEL = 0.3;

/* Collect water patch bounding boxes instead of animating all vertices */
interface WaterPatch {
  cx: number;
  cz: number;
  w: number;
  d: number;
}

function collectWaterPatches(segments: number): WaterPatch[] {
  const patches: WaterPatch[] = [];
  const size = 200;
  const step = size / segments;
  let inPatch = false;
  let patchStartX = 0;

  for (let z = -100; z < 100; z += step * 4) {
    inPatch = false;
    patchStartX = 0;

    for (let x = -100; x < 100; x += step * 2) {
      const biome = getBiomeAt(x, z);
      const isWater = biome.type === "RIVER" || biome.type === "LAKE";

      if (isWater && !inPatch) {
        patchStartX = x;
        inPatch = true;
      } else if (!isWater && inPatch) {
        patches.push({
          cx: (patchStartX + x) / 2,
          cz: z,
          w: x - patchStartX + step,
          d: step * 8,
        });
        inPatch = false;
      }
    }
    if (inPatch) {
      patches.push({
        cx: (patchStartX + 100) / 2,
        cz: z,
        w: 100 - patchStartX + step,
        d: step * 8,
      });
    }
  }

  return patches;
}

export function WaterSystem() {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const settings = useGraphicsStore((s) => s.settings);

  const patches = useMemo(
    () => collectWaterPatches(Math.min(settings.terrainSegments, 32)),
    [settings.terrainSegments]
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

  if (patches.length === 0) return null;

  return (
    <group>
      {patches.map((patch, i) => (
        <mesh
          key={i}
          position={[patch.cx, WATER_LEVEL, patch.cz]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
        >
          <planeGeometry args={[patch.w, patch.d, 1, 1]} />
          <meshStandardMaterial
            ref={i === 0 ? matRef : undefined}
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
      ))}
    </group>
  );
}
