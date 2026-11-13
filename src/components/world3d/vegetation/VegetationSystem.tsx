"use client";

import { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import { useGraphicsStore } from "../engine/useGraphicsStore";
import { getBiomeAtWorld, heightAtRender } from "../terrain/BiomeManager";
import { METERS_PER_RENDER_UNIT } from "@/lib/world-coordinates";
import {
  createPineTree,
  createOakTree,
  createBush,
  createRock,
  createFlower,
} from "./TreeModels";

/* Deterministic pseudo-random from seed */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

interface VegetationItem {
  type: "pine" | "oak" | "bush" | "rock" | "flower";
  x: number;
  y: number;
  z: number;
  scale: number;
  rotation: number;
  variant: number;
}

const WORLD_HALF = 120;
const CITY_EXCLUSION_RADIUS = 28;

function hashSeed(x: number, z: number): number {
  let h = (Math.floor(x) * 374761393 + Math.floor(z) * 668265263) | 0;
  h = ((h ^ (h >> 13)) * 1274126177) | 0;
  return ((h ^ (h >> 16)) >>> 0) || 42;
}

interface VegetationSystemProps {
  cityPosition?: [number, number, number];
  worldOffsetX?: number;
  worldOffsetZ?: number;
}

export function VegetationSystem({
  cityPosition,
  worldOffsetX = 0,
  worldOffsetZ = 0,
}: VegetationSystemProps) {
  const settings = useGraphicsStore((s) => s.settings);
  const density = settings.vegetationDensity;

  const items = useMemo(() => {
    const result: VegetationItem[] = [];
    const seed = hashSeed(worldOffsetX, worldOffsetZ);
    const rand = seededRandom(seed);
    const step = 4 / density;
    const cx = cityPosition?.[0] ?? 0;
    const cz = cityPosition?.[2] ?? 0;

    for (let x = -WORLD_HALF; x < WORLD_HALF; x += step) {
      for (let z = -WORLD_HALF; z < WORLD_HALF; z += step) {
        const jitterX = x + (rand() - 0.5) * step * 1.5;
        const jitterZ = z + (rand() - 0.5) * step * 1.5;

        // Skip near city
        const distToCity = Math.hypot(jitterX - cx, jitterZ - cz);
        if (distToCity < CITY_EXCLUSION_RADIUS) continue;

        const worldX = worldOffsetX + jitterX * METERS_PER_RENDER_UNIT;
        const worldZ = worldOffsetZ + jitterZ * METERS_PER_RENDER_UNIT;

        const biome = getBiomeAtWorld(worldX, worldZ);
        if (biome.type === "RIVER" || biome.type === "LAKE") continue;

        const roll = rand();
        if (roll > biome.vegetationDensity * density) continue;

        const height = heightAtRender(jitterX, jitterZ, worldOffsetX, worldOffsetZ);
        if (height < -0.3) continue;

        const typeRoll = rand();
        let type: VegetationItem["type"];

        if (biome.type === "FOREST") {
          type = typeRoll < 0.4 ? "pine" : typeRoll < 0.7 ? "oak" : typeRoll < 0.85 ? "bush" : "flower";
        } else if (biome.type === "MOUNTAIN") {
          type = typeRoll < 0.6 ? "rock" : typeRoll < 0.85 ? "pine" : "bush";
        } else if (biome.type === "DESERT") {
          type = typeRoll < 0.7 ? "rock" : "bush";
        } else if (biome.type === "COAST") {
          type = typeRoll < 0.4 ? "rock" : typeRoll < 0.7 ? "bush" : "flower";
        } else {
          // GRASSLAND
          type = typeRoll < 0.2 ? "oak" : typeRoll < 0.35 ? "pine" : typeRoll < 0.55 ? "bush" : typeRoll < 0.75 ? "flower" : "rock";
        }

        const scale = 0.6 + rand() * 0.8;

        result.push({
          type,
          x: jitterX,
          y: height,
          z: jitterZ,
          scale,
          rotation: rand() * Math.PI * 2,
          variant: Math.floor(rand() * 3),
        });
      }
    }

    return result;
  }, [density, cityPosition, worldOffsetX, worldOffsetZ]);

  // Group by type for efficient rendering
  const grouped = useMemo(() => {
    const groups: Record<string, VegetationItem[]> = {
      pine: [], oak: [], bush: [], rock: [], flower: [],
    };
    for (const item of items) {
      groups[item.type].push(item);
    }
    return groups;
  }, [items]);

  return (
    <group>
      <InstancedVegetation items={grouped.pine} generator={() => createPineTree(1)} />
      <InstancedVegetation items={grouped.oak} generator={() => createOakTree(1)} />
      <InstancedVegetation items={grouped.bush} generator={() => createBush(1)} />
      <InstancedVegetation items={grouped.rock} generator={() => createRock(1)} />
      {/* Flowers — fewer, use simple mesh */}
      {grouped.flower.slice(0, Math.floor(grouped.flower.length * density)).map((item, i) => (
        <group key={`flower-${i}`} position={[item.x, item.y, item.z]} rotation={[0, item.rotation, 0]} scale={item.scale}>
          <FlowerMesh variant={item.variant} />
        </group>
      ))}
    </group>
  );
}

/* ── Instanced rendering for vegetation type ── */
function InstancedVegetation({
  items,
  generator,
}: {
  items: VegetationItem[];
  generator: () => THREE.Group;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const { geometry, material } = useMemo(() => {
    const template = generator();
    let geo: THREE.BufferGeometry | null = null;
    let mat: THREE.Material | null = null;

    template.traverse((child) => {
      if (!geo && child instanceof THREE.Mesh) {
        geo = child.geometry;
        mat = child.material as THREE.Material;
      }
    });

    return {
      geometry: geo ?? new THREE.BoxGeometry(0.5, 1, 0.5),
      material: mat ?? new THREE.MeshStandardMaterial({ color: 0x228b22 }),
    };
  }, [generator]);

  // Apply instance matrices after mount
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      dummy.position.set(item.x, item.y, item.z);
      dummy.rotation.set(0, item.rotation, 0);
      dummy.scale.setScalar(item.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [items]);

  if (items.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, items.length]}
      castShadow
      receiveShadow
    />
  );
}

/* ── Simple flower component ── */
function FlowerMesh({ variant }: { variant: number }) {
  const model = useMemo(() => createFlower(variant), [variant]);
  return <primitive object={model} />;
}
