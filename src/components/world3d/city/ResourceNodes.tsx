"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { getBiomeAtWorld, heightAtRender } from "../terrain/BiomeManager";
import { METERS_PER_RENDER_UNIT } from "@/lib/world-coordinates";

/* Deterministic pseudo-random */
function seededRnd(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/* ── Wood resource pile ── */
function WoodPile({ position }: { position: [number, number, number] }) {
  const geo = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.18, 0.2, 0.9, 6);
    return g;
  }, []);
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0x8b5e3c, roughness: 0.9, metalness: 0 }),
    []
  );

  return (
    <group position={position}>
      {/* 3 logs stacked */}
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          geometry={geo}
          material={mat}
          position={[Math.sin(i * 2.1) * 0.3, i * 0.25, Math.cos(i * 2.1) * 0.3]}
          rotation={[Math.PI / 2, i * 0.6, 0]}
          castShadow
        />
      ))}
      {/* Yellow glint indicator */}
      <mesh position={[0, 0.9, 0]}>
        <sphereGeometry args={[0.12, 6, 6]} />
        <meshStandardMaterial color="#f5c842" emissive="#f5c842" emissiveIntensity={0.4} roughness={0.3} />
      </mesh>
    </group>
  );
}

/* ── Stone deposit ── */
function StoneDeposit({ position }: { position: [number, number, number] }) {
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0x888080, roughness: 0.95, metalness: 0.05 }),
    []
  );
  return (
    <group position={position}>
      {[0, 1, 2, 3].map((i) => {
        const angle = (i / 4) * Math.PI * 2;
        const r = 0.3 + (i % 2) * 0.15;
        const scale = 0.4 + (i % 3) * 0.2;
        return (
          <mesh
            key={i}
            material={mat}
            position={[Math.cos(angle) * r, scale * 0.3, Math.sin(angle) * r]}
            castShadow
            receiveShadow
          >
            <dodecahedronGeometry args={[scale * 0.4, 0]} />
          </mesh>
        );
      })}
      {/* Blue indicator */}
      <mesh position={[0, 1.0, 0]}>
        <sphereGeometry args={[0.1, 6, 6]} />
        <meshStandardMaterial color="#60a0d0" emissive="#60a0d0" emissiveIntensity={0.5} roughness={0.2} />
      </mesh>
    </group>
  );
}

/* ── Ambient villager ── */
function Villager({ position, rotation }: { position: [number, number, number]; rotation: number }) {
  const bodyMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.8 }),
    []
  );
  const headMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0xd4a574, roughness: 0.7 }),
    []
  );
  const hatMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.9 }),
    []
  );
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Body */}
      <mesh material={bodyMat} position={[0, 0.45, 0]} castShadow>
        <boxGeometry args={[0.3, 0.6, 0.2]} />
      </mesh>
      {/* Head */}
      <mesh material={headMat} position={[0, 0.9, 0]} castShadow>
        <boxGeometry args={[0.22, 0.22, 0.22]} />
      </mesh>
      {/* Hat */}
      <mesh material={hatMat} position={[0, 1.08, 0]} castShadow>
        <coneGeometry args={[0.14, 0.2, 6]} />
      </mesh>
      {/* Legs */}
      {[-0.08, 0.08].map((xOff, i) => (
        <mesh key={i} material={bodyMat} position={[xOff, 0.1, 0]} castShadow>
          <boxGeometry args={[0.11, 0.3, 0.15]} />
        </mesh>
      ))}
    </group>
  );
}

interface ResourceNodesProps {
  cityPosition: [number, number, number];
  /** Player's stored world coordinates in metres; anchors terrain sampling. */
  anchorWorldX?: number;
  anchorWorldZ?: number;
}

export function ResourceNodes({
  cityPosition,
  anchorWorldX = 0,
  anchorWorldZ = 0,
}: ResourceNodesProps) {
  const nodes = useMemo(() => {
    const rnd = seededRnd(99);
    const wood: [number, number, number][] = [];
    const stone: [number, number, number][] = [];
    const villagers: Array<{ pos: [number, number, number]; rot: number }> = [];

    const [cx, , cz] = cityPosition;
    const biomeAt = (x: number, z: number) =>
      getBiomeAtWorld(
        anchorWorldX + x * METERS_PER_RENDER_UNIT,
        anchorWorldZ + z * METERS_PER_RENDER_UNIT,
      );

    // Wood piles near forest areas
    for (let i = 0; i < 8; i++) {
      const angle = rnd() * Math.PI * 2;
      const dist = 20 + rnd() * 50;
      const x = cx + Math.cos(angle) * dist;
      const z = cz + Math.sin(angle) * dist;
      const biome = biomeAt(x, z);
      if (biome.type === "FOREST" || biome.type === "GRASSLAND") {
        const y = heightAtRender(x, z, anchorWorldX, anchorWorldZ);
        wood.push([x, y, z]);
      }
    }

    // Stone deposits on mountain/hill edges
    for (let i = 0; i < 6; i++) {
      const angle = rnd() * Math.PI * 2;
      const dist = 25 + rnd() * 55;
      const x = cx + Math.cos(angle) * dist;
      const z = cz + Math.sin(angle) * dist;
      const biome = biomeAt(x, z);
      if (biome.type === "MOUNTAIN" || biome.type === "GRASSLAND") {
        const y = heightAtRender(x, z, anchorWorldX, anchorWorldZ);
        stone.push([x, y, z]);
      }
    }

    // Ambient villagers inside city walls
    for (let i = 0; i < 6; i++) {
      const angle = rnd() * Math.PI * 2;
      const dist = 2 + rnd() * 8;
      const x = cx + Math.cos(angle) * dist;
      const z = cz + Math.sin(angle) * dist;
      const y = heightAtRender(x, z, anchorWorldX, anchorWorldZ);
      villagers.push({ pos: [x, y, z], rot: rnd() * Math.PI * 2 });
    }

    return { wood, stone, villagers };
  }, [cityPosition, anchorWorldX, anchorWorldZ]);

  return (
    <group>
      {nodes.wood.map((pos, i) => (
        <WoodPile key={`wood-${i}`} position={pos} />
      ))}
      {nodes.stone.map((pos, i) => (
        <StoneDeposit key={`stone-${i}`} position={pos} />
      ))}
      {nodes.villagers.map((v, i) => (
        <Villager key={`villager-${i}`} position={v.pos} rotation={v.rot} />
      ))}
    </group>
  );
}
