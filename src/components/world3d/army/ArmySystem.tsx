"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useGraphicsStore } from "../engine/useGraphicsStore";
import { getHeightAt } from "../terrain/BiomeManager";
import { createInfantry, createCavalry, createArcher, createSiege } from "./UnitModels";
import { getFormationForTroop } from "./FormationManager";

interface ArmyData {
  infantry: number;
  archers: number;
  cavalry: number;
}

interface ArmySystemProps {
  position: [number, number, number];
  army: ArmyData;
  marchActive?: boolean;
}

/* Limit displayed units for performance */
function displayCount(actual: number, maxNPCs: number): number {
  if (actual <= 0) return 0;
  const ratio = Math.min(1, maxNPCs / 200);
  return Math.max(1, Math.min(actual, Math.ceil(actual * ratio * 0.1)));
}

interface TroopGroupProps {
  type: "infantry" | "archers" | "cavalry" | "siege";
  count: number;
  basePosition: [number, number, number];
  offset: [number, number, number];
  animOffset?: number;
}

function TroopGroup({ type, count, basePosition, offset, animOffset = 0 }: TroopGroupProps) {
  const groupRef = useRef<THREE.Group>(null);

  const template = useMemo(() => {
    switch (type) {
      case "infantry": return createInfantry();
      case "cavalry": return createCavalry();
      case "archers": return createArcher();
      case "siege": return createSiege();
    }
  }, [type]);

  const formation = useMemo(
    () => getFormationForTroop(type, count),
    [type, count]
  );

  // Idle bobbing animation
  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.elapsedTime;
    // Gentle idle bob
    groupRef.current.position.y = Math.sin(t * 1.5 + animOffset) * 0.04;
    // Slow patrol rotation
    if (type !== "siege") {
      groupRef.current.rotation.y = Math.sin(t * 0.3 + animOffset) * 0.08;
    }
  });

  if (count === 0) return null;

  const [bx, , bz] = basePosition;
  const [ox, , oz] = offset;

  return (
    <group ref={groupRef} position={[bx + ox, 0, bz + oz]}>
      {formation.map((slot, i) => {
        const worldX = bx + ox + slot.x;
        const worldZ = bz + oz + slot.z;
        const y = getHeightAt(worldX, worldZ) + 0.01;
        return (
          <group key={`${type}-${i}`} position={[slot.x, y, slot.z]}>
            <primitive object={template.clone()} />
          </group>
        );
      })}
    </group>
  );
}

export function ArmySystem({ position, army, marchActive }: ArmySystemProps) {
  const settings = useGraphicsStore((s) => s.settings);
  const maxNPCs = settings.maxNPCs;

  const infantryCount = displayCount(army.infantry, maxNPCs);
  const archerCount = displayCount(army.archers, maxNPCs);
  const cavalryCount = displayCount(army.cavalry, maxNPCs);

  if (marchActive) {
    // When marching, don't show troops at base
    return null;
  }

  return (
    <group>
      {/* Infantry formation — south of castle */}
      <TroopGroup
        type="infantry"
        count={infantryCount}
        basePosition={position}
        offset={[3, 0, 14]}
        animOffset={0}
      />

      {/* Archers — southeast */}
      <TroopGroup
        type="archers"
        count={archerCount}
        basePosition={position}
        offset={[8, 0, 12]}
        animOffset={1.2}
      />

      {/* Cavalry — southwest */}
      <TroopGroup
        type="cavalry"
        count={cavalryCount}
        basePosition={position}
        offset={[-5, 0, 14]}
        animOffset={2.4}
      />
    </group>
  );
}
