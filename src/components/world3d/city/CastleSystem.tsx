"use client";

import { useMemo } from "react";
import {
  Castle,
  WatchTower,
  Gate,
  House,
  Factory,
  Warehouse,
  Barracks,
  ResearchLab,
  WallSegment,
} from "./BuildingFactory";
import { getHeightAt } from "../terrain/BiomeManager";
import { SmokeParticles, TorchFlame } from "../atmosphere/ParticleSystem";
import { AnimatedFlag } from "./AnimatedFlag";

interface CastleSystemProps {
  position: [number, number, number];
  baseData: {
    factoryLevel: number;
    warehouseLevel: number;
  };
}

export function CastleSystem({ position, baseData }: CastleSystemProps) {
  const [cx, _cy, cz] = position;

  const layout = useMemo(() => {
    const groundY = getHeightAt(cx, cz);
    const maxLevel = Math.max(baseData.factoryLevel, baseData.warehouseLevel, 1);
    const CITY_RADIUS = 10;

    // Wall octagon
    const walls: Array<{ pos: [number, number, number]; rot: number; len: number }> = [];
    const wallCount = 8;
    for (let i = 0; i < wallCount; i++) {
      // Skip position 4 (south) for gate
      if (i === 4) continue;
      const angle = (i / wallCount) * Math.PI * 2;
      const wx = Math.cos(angle) * CITY_RADIUS;
      const wz = Math.sin(angle) * CITY_RADIUS;
      const wy = getHeightAt(cx + wx, cz + wz);
      walls.push({
        pos: [cx + wx, wy, cz + wz],
        rot: -angle + Math.PI / 2,
        len: 2 * CITY_RADIUS * Math.sin(Math.PI / wallCount),
      });
    }

    // Watch tower positions (4 cardinal)
    const towers: [number, number, number][] = [];
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + Math.PI / 8;
      const tx = cx + Math.cos(angle) * CITY_RADIUS;
      const tz = cz + Math.sin(angle) * CITY_RADIUS;
      const ty = getHeightAt(tx, tz);
      towers.push([tx, ty, tz]);
    }

    // Gate position (south)
    const gateAngle = (4 / wallCount) * Math.PI * 2;
    const gatePos: [number, number, number] = [
      cx + Math.cos(gateAngle) * CITY_RADIUS,
      getHeightAt(cx + Math.cos(gateAngle) * CITY_RADIUS, cz + Math.sin(gateAngle) * CITY_RADIUS),
      cz + Math.sin(gateAngle) * CITY_RADIUS,
    ];

    // Building positions inside walls
    const buildings = {
      castle: [cx, groundY, cz] as [number, number, number],
      factory: [cx + 4, getHeightAt(cx + 4, cz + 3), cz + 3] as [number, number, number],
      warehouse: [cx - 4, getHeightAt(cx - 4, cz + 3), cz + 3] as [number, number, number],
      barracks: [cx + 5, getHeightAt(cx + 5, cz - 3), cz - 3] as [number, number, number],
      lab: [cx - 4, getHeightAt(cx - 4, cz - 4), cz - 4] as [number, number, number],
      houses: [
        [cx + 2, getHeightAt(cx + 2, cz - 5), cz - 5] as [number, number, number],
        [cx - 2, getHeightAt(cx - 2, cz - 5.5), cz - 5.5] as [number, number, number],
        [cx + 6, getHeightAt(cx + 6, cz), cz] as [number, number, number],
        [cx - 6, getHeightAt(cx - 6, cz), cz] as [number, number, number],
        [cx + 3, getHeightAt(cx + 3, cz + 6), cz + 6] as [number, number, number],
        [cx - 3, getHeightAt(cx - 3, cz + 6), cz + 6] as [number, number, number],
      ],
    };

    return { walls, towers, gatePos, gateAngle, buildings, maxLevel };
  }, [cx, cz, baseData.factoryLevel, baseData.warehouseLevel]);

  return (
    <group>
      {/* Central Castle */}
      <Castle position={layout.buildings.castle} level={layout.maxLevel} />

      {/* Animated flag on top of castle tower */}
      <AnimatedFlag
        position={[
          layout.buildings.castle[0],
          layout.buildings.castle[1] + 14 + layout.maxLevel * 0.3,
          layout.buildings.castle[2],
        ]}
        color={0xcc2222}
        width={1.2}
        height={0.75}
      />

      {/* Walls */}
      {layout.walls.map((wall, i) => (
        <WallSegment key={`wall-${i}`} position={wall.pos} rotation={wall.rot} length={wall.len} />
      ))}

      {/* Watch Towers */}
      {layout.towers.map((pos, i) => (
        <WatchTower key={`tower-${i}`} position={pos} />
      ))}

      {/* Gate */}
      <Gate position={layout.gatePos} rotation={-layout.gateAngle + Math.PI / 2} />

      {/* Factory */}
      <Factory position={layout.buildings.factory} level={baseData.factoryLevel} rotation={0.5} />
      {/* Factory chimney smoke */}
      <SmokeParticles
        position={[
          layout.buildings.factory[0] + 1.2,
          layout.buildings.factory[1] + 5.0,
          layout.buildings.factory[2] - 0.8,
        ]}
      />

      {/* Warehouse */}
      <Warehouse position={layout.buildings.warehouse} level={baseData.warehouseLevel} rotation={-0.3} />

      {/* Barracks */}
      <Barracks position={layout.buildings.barracks} rotation={0.8} />

      {/* Research Lab */}
      <ResearchLab position={layout.buildings.lab} />

      {/* Houses */}
      {layout.buildings.houses.map((pos, i) => (
        <House key={`house-${i}`} position={pos} variant={i} rotation={i * 0.7} />
      ))}

      {/* Gate torches */}
      <TorchFlame position={[layout.gatePos[0] - 1.2, layout.gatePos[1] + 2.5, layout.gatePos[2]]} />
      <TorchFlame position={[layout.gatePos[0] + 1.2, layout.gatePos[1] + 2.5, layout.gatePos[2]]} />
    </group>
  );
}
