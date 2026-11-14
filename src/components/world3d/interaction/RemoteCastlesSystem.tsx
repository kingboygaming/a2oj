"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { Text } from "@react-three/drei";
import { Castle } from "../city/BuildingFactory";
import { AnimatedFlag } from "../city/AnimatedFlag";
import { LodWrapper } from "../engine/LodSystem";
import { heightAtRender } from "../terrain/BiomeManager";
import { VIEW_RADIUS_UNITS, worldToRender } from "@/lib/world-coordinates";

/** LOD switch distances in render units (1 unit = 200 m). */
const LOD_MID_DISTANCE = 70;
const LOD_LOW_DISTANCE = 140;

export interface RemoteBaseInfo {
  userId: string;
  username: string;
  displayName: string;
  coordinateX: number;
  coordinateZ: number;
  distanceMeters: number;
  castleLevel: number;
  pvpShieldUntil: string | null;
  activeAttack: boolean;
  /** Mirrors `WorldBase.version`; lets callers reject stale selections. */
  version: number;
}

interface RemoteCastlesSystemProps {
  playerCoordinateX: number;
  playerCoordinateZ: number;
  nearbyBases: RemoteBaseInfo[];
  selectedBaseUserId: string | null;
  onSelectBase: (base: RemoteBaseInfo) => void;
  /** Max distance in render units to display castles (default 220) */
  maxRenderDistance?: number;
}

/** Mid-distance castle: blocky silhouette instead of the full generated model. */
function SimplifiedCastle({ level }: { level: number }) {
  const height = 3 + Math.min(level, 20) * 0.2;
  const towers: Array<[number, number]> = [
    [-3, -3],
    [3, -3],
    [-3, 3],
    [3, 3],
  ];

  return (
    <group>
      <mesh position={[0, height / 2, 0]} castShadow>
        <boxGeometry args={[5, height, 5]} />
        <meshStandardMaterial color="#9ca3af" roughness={0.85} />
      </mesh>
      {towers.map(([x, z]) => (
        <group key={`${x}-${z}`} position={[x, 0, z]}>
          <mesh position={[0, 1.6, 0]} castShadow>
            <cylinderGeometry args={[1, 1.1, 3.2, 6]} />
            <meshStandardMaterial color="#b6bcc4" roughness={0.8} />
          </mesh>
          <mesh position={[0, 3.6, 0]} castShadow>
            <coneGeometry args={[1.3, 1.6, 6]} />
            <meshStandardMaterial color="#7f1d1d" roughness={0.6} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, height + 0.5, 0]} castShadow>
        <coneGeometry args={[3.8, 1.8, 4]} />
        <meshStandardMaterial color="#7f1d1d" roughness={0.6} />
      </mesh>
    </group>
  );
}

/** Far-distance castle: one keep and one roof, cheapest possible silhouette. */
function DistantCastle({ level }: { level: number }) {
  const height = 3 + Math.min(level, 20) * 0.2;
  return (
    <group>
      <mesh position={[0, height / 2, 0]}>
        <boxGeometry args={[5.5, height, 5.5]} />
        <meshStandardMaterial color="#9ca3af" roughness={0.9} />
      </mesh>
      <mesh position={[0, height + 0.7, 0]}>
        <coneGeometry args={[4, 2, 4]} />
        <meshStandardMaterial color="#7f1d1d" roughness={0.7} />
      </mesh>
    </group>
  );
}

function SelectionRing({ color, isSelected }: { color: string; isSelected: boolean }) {
  return (
    <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[6.5, 7.2, 32]} />
      <meshBasicMaterial
        color={isSelected ? "#facc15" : color}
        transparent
        opacity={0.85}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

export function RemoteCastlesSystem({
  playerCoordinateX,
  playerCoordinateZ,
  nearbyBases,
  selectedBaseUserId,
  onSelectBase,
  maxRenderDistance = VIEW_RADIUS_UNITS,
}: RemoteCastlesSystemProps) {
  const visibleBases = useMemo(() => {
    return nearbyBases
      .map((base) => {
        const { x: relX, z: relZ } = worldToRender(
          base.coordinateX,
          base.coordinateZ,
          playerCoordinateX,
          playerCoordinateZ,
        );
        const dist = Math.hypot(relX, relZ);
        const y = heightAtRender(relX, relZ, playerCoordinateX, playerCoordinateZ);
        return {
          base,
          relX,
          relZ,
          y,
          dist,
        };
      })
      .filter((item) => item.dist <= maxRenderDistance);
  }, [nearbyBases, playerCoordinateX, playerCoordinateZ, maxRenderDistance]);

  return (
    <group>
      {visibleBases.map(({ base, relX, relZ, y }) => {
        const isSelected = selectedBaseUserId === base.userId;
        const hasShield = base.pvpShieldUntil && new Date(base.pvpShieldUntil) > new Date();
        const ringColor = hasShield ? "#38bdf8" : "#f97316";

        const handleClick = (e: { stopPropagation: () => void }) => {
          e.stopPropagation();
          onSelectBase(base);
        };

        return (
          <group key={base.userId} position={[relX, y, relZ]} onClick={handleClick}>
            {/* High detail near, simplified mid, silhouette far. */}
            <LodWrapper
              distances={[LOD_MID_DISTANCE, LOD_LOW_DISTANCE, LOD_LOW_DISTANCE]}
              hi={
                <group>
                  <Castle position={[0, 0, 0]} level={base.castleLevel} />
                  <AnimatedFlag
                    position={[0, 7.5, 0]}
                    color={hasShield ? 0x38bdf8 : base.activeAttack ? 0xe11d48 : 0xf97316}
                    width={1.2}
                    height={0.7}
                  />
                  <group position={[0, 9.5, 0]}>
                    <Text
                      fontSize={1.2}
                      color="#ffffff"
                      anchorX="center"
                      anchorY="middle"
                      outlineWidth={0.15}
                      outlineColor="#000000"
                    >
                      {base.displayName || base.username}
                    </Text>
                    <Text
                      position={[0, -1.1, 0]}
                      fontSize={0.8}
                      color={hasShield ? "#7dd3fc" : "#fbbf24"}
                      anchorX="center"
                      anchorY="middle"
                      outlineWidth={0.1}
                      outlineColor="#000000"
                    >
                      {hasShield
                        ? "🛡️ Có khiên"
                        : `Cấp ${base.castleLevel} · ${(base.distanceMeters / 1000).toFixed(1)} km`}
                    </Text>
                  </group>
                  {hasShield && (
                    <mesh position={[0, 3, 0]}>
                      <sphereGeometry args={[7, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
                      <meshStandardMaterial
                        color="#38bdf8"
                        transparent
                        opacity={0.25}
                        roughness={0.1}
                        metalness={0.2}
                        wireframe={false}
                      />
                    </mesh>
                  )}
                </group>
              }
              mid={
                <group>
                  <SimplifiedCastle level={base.castleLevel} />
                  <AnimatedFlag
                    position={[0, 9, 0]}
                    color={hasShield ? 0x38bdf8 : base.activeAttack ? 0xe11d48 : 0xf97316}
                    width={1.2}
                    height={0.7}
                  />
                </group>
              }
              lo={<DistantCastle level={base.castleLevel} />}
            />

            <SelectionRing color={ringColor} isSelected={isSelected} />

            {/* Selection spotlight */}
            {isSelected && (
              <pointLight position={[0, 6, 0]} color="#facc15" intensity={2} distance={15} />
            )}
          </group>
        );
      })}
    </group>
  );
}
