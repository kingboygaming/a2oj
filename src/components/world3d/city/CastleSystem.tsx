"use client";

import { useMemo } from "react";
import { Text } from "@react-three/drei";
import {
  Castle,
  Gate,
  WallSegment,
  WatchTower,
  WorldBuildingModel,
} from "./BuildingFactory";
import { heightAtRender } from "../terrain/BiomeManager";
import { AnimatedFlag } from "./AnimatedFlag";
import {
  WORLD_BUILDING_PLOT_COUNT,
  type WorldBuildingType,
  type WorldBuildingView,
} from "@/lib/world-buildings";

export const BUILDING_PLOT_POSITIONS: Array<[number, number]> = [
  [-12, -12], [-5, -12], [5, -12], [12, -12],
  [-12, -5], [12, -5],
  [-12, 5], [12, 5],
  [-12, 12], [-5, 12], [5, 12], [12, 12],
];

interface CastleSystemProps {
  position: [number, number, number];
  /** Player's stored world coordinates in metres; anchors terrain sampling. */
  anchorWorldX: number;
  anchorWorldZ: number;
  castleLevel: number;
  playerName: string;
  buildings: WorldBuildingView[];
  cityView: boolean;
  selectedPlotIndex: number | null;
  placementType: WorldBuildingType | null;
  onSelectPlot: (plotIndex: number) => void;
  onSelectCastle: () => void;
  onSelectBuilding: (plotIndex: number) => void;
}

export function CastleSystem({
  position,
  anchorWorldX,
  anchorWorldZ,
  castleLevel,
  playerName,
  buildings,
  cityView,
  selectedPlotIndex,
  placementType,
  onSelectPlot,
  onSelectCastle,
  onSelectBuilding,
}: CastleSystemProps) {
  const [cx, , cz] = position;
  const layout = useMemo(() => {
    const radius = 23;
    const walls: Array<{ pos: [number, number, number]; rot: number; len: number }> = [];
    for (let index = 0; index < 8; index++) {
      if (index === 4) continue;
      const angle = index * Math.PI / 4;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      walls.push({
        pos: [cx + x, heightAtRender(cx + x, cz + z, anchorWorldX, anchorWorldZ), cz + z],
        rot: -angle + Math.PI / 2,
        len: 2 * radius * Math.sin(Math.PI / 8),
      });
    }

    const towers = Array.from({ length: 4 }, (_, index) => {
      const angle = index * Math.PI / 2 + Math.PI / 8;
      const x = cx + Math.cos(angle) * radius;
      const z = cz + Math.sin(angle) * radius;
      return [x, heightAtRender(x, z, anchorWorldX, anchorWorldZ), z] as [number, number, number];
    });

    const gateAngle = Math.PI;
    const gateX = cx + Math.cos(gateAngle) * radius;
    const gateZ = cz + Math.sin(gateAngle) * radius;
    return {
      walls,
      towers,
      gateAngle,
      gatePosition: [
        gateX,
        heightAtRender(gateX, gateZ, anchorWorldX, anchorWorldZ),
        gateZ,
      ] as [number, number, number],
    };
  }, [cx, cz, anchorWorldX, anchorWorldZ]);

  const plotBuildings = new Map(buildings.map((building) => [building.plotIndex, building]));

  return (
    <group>
      <group onClick={(event) => {
        event.stopPropagation();
        onSelectCastle();
      }}>
        <Castle position={position} level={castleLevel} />
        <mesh position={[cx, position[1] + 8, cz]}>
          <cylinderGeometry args={[4.2, 4.2, 17, 16]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>

      <AnimatedFlag
        position={[cx, position[1] + 14 + castleLevel * 0.3, cz]}
        color={0xcc2222}
        width={1.2}
        height={0.75}
      />

      {layout.walls.map((wall, index) => (
        <WallSegment key={`wall-${index}`} position={wall.pos} rotation={wall.rot} length={wall.len} />
      ))}
      {layout.towers.map((tower, index) => (
        <WatchTower key={`tower-${index}`} position={tower} />
      ))}
      <Gate position={layout.gatePosition} rotation={-layout.gateAngle + Math.PI / 2} />

      {cityView && BUILDING_PLOT_POSITIONS.slice(0, WORLD_BUILDING_PLOT_COUNT).map(([offsetX, offsetZ], index) => {
        const x = cx + offsetX;
        const z = cz + offsetZ;
        const groundY = heightAtRender(x, z, anchorWorldX, anchorWorldZ);
        const building = plotBuildings.get(index);
        const isSelected = selectedPlotIndex === index;
        const isAvailable = !building;
        const color = isSelected
          ? placementType && isAvailable ? "#34d399" : "#facc15"
          : isAvailable ? "#77ad81" : "#967a51";

        return (
          <group key={`plot-${index}`} position={[x, groundY + 0.08, z]}>
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              onClick={(event) => {
                event.stopPropagation();
                if (isAvailable) onSelectPlot(index);
                else onSelectBuilding(index);
              }}
            >
              <circleGeometry args={[2.8, 24]} />
              <meshBasicMaterial color={color} transparent opacity={isSelected ? 0.2 : 0.09} side={2} depthWrite={false} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[2.8, 3.05, 24]} />
              <meshBasicMaterial color={color} transparent opacity={0.82} side={2} />
            </mesh>
            {building ? (
              <group
                position={[0, -0.08, 0]}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectBuilding(index);
                }}
              >
                <WorldBuildingModel
                  type={building.type}
                  level={building.pendingLevel ?? building.level}
                  position={[0, 0, 0]}
                  ghost={building.status !== "COMPLETED"}
                />
              </group>
            ) : placementType && isSelected ? (
              <WorldBuildingModel type={placementType} level={1} position={[0, -0.08, 0]} ghost />
            ) : null}
          </group>
        );
      })}

      <group position={[cx, position[1], cz]}>
        <mesh position={[0, 0.05, 0]}>
          <ringGeometry args={[6.3, 6.5, 48]} />
          <meshBasicMaterial color="#d7b36a" transparent opacity={0.7} side={2} />
        </mesh>
      </group>

      {cityView && (
        <Text
          position={[cx, position[1] + 20, cz - 6]}
          fontSize={0.9}
          color="#f4e3b2"
          outlineColor="#211a12"
          outlineWidth={0.06}
          anchorX="center"
          anchorY="middle"
        >
          {playerName} · Thành chính cấp {castleLevel}
        </Text>
      )}
    </group>
  );
}
