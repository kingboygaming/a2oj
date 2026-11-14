"use client";

import { useMemo } from "react";
import * as THREE from "three";
import {
  createCastle,
  createWatchTower,
  createGate,
  createHouse,
  createFactory,
  createWarehouse,
  createBarracks,
  createResearchLab,
  createWallSegment,
  createArcheryRange,
  createFarm,
  createIronMine,
  createSiegeWorkshop,
  createStable,
  createScoutCamp,
} from "./BuildingModels";
import type { WorldBuildingType } from "@/lib/world-buildings";

interface BuildingProps {
  position: [number, number, number];
  rotation?: number;
}

function BuildingWrapper({
  generator,
  position,
  rotation = 0,
}: BuildingProps & { generator: () => THREE.Group }) {
  const model = useMemo(() => generator(), [generator]);
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <primitive object={model} />
    </group>
  );
}

export function Castle({ position, rotation, level = 1 }: BuildingProps & { level?: number }) {
  const gen = useMemo(() => () => createCastle(level), [level]);
  return <BuildingWrapper generator={gen} position={position} rotation={rotation} />;
}

export function WatchTower({ position, rotation }: BuildingProps) {
  const gen = useMemo(() => () => createWatchTower(), []);
  return <BuildingWrapper generator={gen} position={position} rotation={rotation} />;
}

export function Gate({ position, rotation }: BuildingProps) {
  const gen = useMemo(() => () => createGate(), []);
  return <BuildingWrapper generator={gen} position={position} rotation={rotation} />;
}

export function House({ position, rotation, variant = 0 }: BuildingProps & { variant?: number }) {
  const gen = useMemo(() => () => createHouse(variant), [variant]);
  return <BuildingWrapper generator={gen} position={position} rotation={rotation} />;
}

export function Factory({ position, rotation, level = 1 }: BuildingProps & { level?: number }) {
  const gen = useMemo(() => () => createFactory(level), [level]);
  return <BuildingWrapper generator={gen} position={position} rotation={rotation} />;
}

export function Warehouse({ position, rotation, level = 1 }: BuildingProps & { level?: number }) {
  const gen = useMemo(() => () => createWarehouse(level), [level]);
  return <BuildingWrapper generator={gen} position={position} rotation={rotation} />;
}

export function Barracks({ position, rotation }: BuildingProps) {
  const gen = useMemo(() => () => createBarracks(), []);
  return <BuildingWrapper generator={gen} position={position} rotation={rotation} />;
}

export function ResearchLab({ position, rotation }: BuildingProps) {
  const gen = useMemo(() => () => createResearchLab(), []);
  return <BuildingWrapper generator={gen} position={position} rotation={rotation} />;
}

export function WallSegment({ position, rotation, length = 6 }: BuildingProps & { length?: number }) {
  const gen = useMemo(() => () => createWallSegment(length), [length]);
  return <BuildingWrapper generator={gen} position={position} rotation={rotation} />;
}

export function ScoutCamp({ position, rotation, level = 1 }: BuildingProps & { level?: number }) {
  const gen = useMemo(() => () => createScoutCamp(level), [level]);
  return <BuildingWrapper generator={gen} position={position} rotation={rotation} />;
}

export function WorldBuildingModel({
  type,
  level,
  position,
  ghost = false,
}: {
  type: WorldBuildingType;
  level: number;
  position: [number, number, number];
  ghost?: boolean;
}) {
  const model = useMemo(() => {
    const building =
      type === "BARRACKS" ? createBarracks()
        : type === "ARCHERY_RANGE" ? createArcheryRange()
          : type === "STABLE" ? createStable()
            : type === "SIEGE_WORKSHOP" ? createSiegeWorkshop()
              : type === "MILITARY_ACADEMY" ? createResearchLab()
                : type === "SCOUT_CAMP" ? createScoutCamp(level)
                : type === "LUMBER_MILL" ? createFactory(level)
                  : type === "IRON_MINE" ? createIronMine()
                    : type === "STONE_QUARRY" ? createRockQuarry()
                      : type === "FARM" ? createFarm()
                        : createWarehouse(level);
    if (ghost) {
      building.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material = new THREE.MeshStandardMaterial({
            color: 0x55e6a5,
            transparent: true,
            opacity: 0.48,
            depthWrite: false,
          });
        }
      });
    }
    return building;
  }, [ghost, level, type]);

  return (
    <group position={position}>
      <primitive object={model} />
    </group>
  );
}

function createRockQuarry() {
  const group = new THREE.Group();
  for (let index = 0; index < 5; index++) {
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.9 + (index % 2) * 0.35, 0),
      new THREE.MeshStandardMaterial({ color: 0x85817c, roughness: 0.88 }),
    );
    rock.position.set(Math.cos(index * 1.25) * 1.8, 0.5, Math.sin(index * 1.25) * 1.8);
    rock.castShadow = true;
    group.add(rock);
  }
  return group;
}
