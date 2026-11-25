"use client";

import { useMemo, useRef } from "react";
import { Billboard, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { regionCenter } from "@/lib/world-exploration";
import { worldToRender } from "@/lib/world-coordinates";
import type { WorldScoutMissionView } from "@/lib/world";
import { heightAtRender } from "./terrain/BiomeManager";

interface ScoutMissionMarkersProps {
  anchorWorldX: number;
  anchorWorldZ: number;
  missions: WorldScoutMissionView[];
}

function ScoutBeacon({
  position,
  label,
}: {
  position: [number, number, number];
  label: string;
}) {
  const ringRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!ringRef.current) return;
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 2.4) * 0.12;
    ringRef.current.scale.setScalar(pulse);
  });

  return (
    <group position={position}>
      <group ref={ringRef}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.4, 0]}>
          <ringGeometry args={[3.2, 4.2, 40]} />
          <meshBasicMaterial
            color="#38bdf8"
            transparent
            opacity={0.8}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh position={[0, 0.35, 0]}>
          <cylinderGeometry args={[1.8, 2.6, 16, 18, 1, true]} />
          <meshBasicMaterial
            color="#0ea5e9"
            transparent
            opacity={0.14}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
      <Billboard position={[0, 5, 0]}>
        <Text fontSize={1.4} color="#bae6fd" outlineColor="#082f49" outlineWidth={0.05}>
          {label}
        </Text>
      </Billboard>
    </group>
  );
}

/** Pulsing beacons on the map for every in-flight region scout mission. */
export function ScoutMissionMarkers({
  anchorWorldX,
  anchorWorldZ,
  missions,
}: ScoutMissionMarkersProps) {
  const markers = useMemo(
    () =>
      missions
        .filter((mission) => mission.status !== "COMPLETED" && mission.status !== "FAILED")
        .map((mission) => {
          const center = regionCenter(mission.targetRegionX, mission.targetRegionZ);
          const render = worldToRender(center.x, center.z, anchorWorldX, anchorWorldZ);
          return {
            id: mission.id,
            label: `(${mission.targetRegionX}, ${mission.targetRegionZ})`,
            position: [
              render.x,
              heightAtRender(render.x, render.z, anchorWorldX, anchorWorldZ),
              render.z,
            ] as [number, number, number],
          };
        }),
    [anchorWorldX, anchorWorldZ, missions],
  );

  if (markers.length === 0) return null;

  return (
    <group>
      {markers.map((marker) => (
        <ScoutBeacon key={marker.id} position={marker.position} label={marker.label} />
      ))}
    </group>
  );
}
