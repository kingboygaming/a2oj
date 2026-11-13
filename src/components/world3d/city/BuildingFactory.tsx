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
} from "./BuildingModels";

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
