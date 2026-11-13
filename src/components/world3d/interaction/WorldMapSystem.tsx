"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { AnimatedFlag } from "../city/AnimatedFlag";
import { createInfantry } from "../army/UnitModels";
import { createOakTree, createPineTree, createRock } from "../vegetation/TreeModels";
import { createHouse } from "../city/BuildingModels";
import { getHeightAt } from "../terrain/BiomeManager";
import { ROGUE_CAMPS, RESOURCE_NODES, type WorldMapObject } from "./worldObjects";

function ResourceLandmark({
  object,
  selected,
  onSelect,
}: {
  object: Extract<WorldMapObject, { kind: "RESOURCE" }>;
  selected: boolean;
  onSelect: (object: Extract<WorldMapObject, { kind: "RESOURCE" }>) => void;
}) {
  const y = getHeightAt(object.x, object.z);
  const model = useMemo(() => {
    const group = new THREE.Group();
    if (object.resource === "FOREST") {
      for (let i = 0; i < 7; i++) {
        const tree = i % 2 ? createOakTree(0.8) : createPineTree(0.9);
        const angle = i * Math.PI * 2 / 7;
        tree.position.set(Math.cos(angle) * 3, 0, Math.sin(angle) * 3);
        group.add(tree);
      }
    } else if (object.resource === "IRON_MINE" || object.resource === "STONE_DEPOSIT") {
      for (let i = 0; i < 5; i++) {
        const rock = createRock(object.resource === "IRON_MINE" ? 1.1 : 1.35);
        rock.position.set(Math.cos(i * 1.25) * 2, 0, Math.sin(i * 1.25) * 2);
        if (object.resource === "IRON_MINE") {
          rock.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.material = new THREE.MeshStandardMaterial({
                color: i % 2 ? 0x75463a : 0x494447,
                roughness: 0.68,
                metalness: 0.35,
              });
            }
          });
        }
        group.add(rock);
      }
    } else if (object.resource === "FOOD_LAND") {
      const soil = new THREE.Mesh(
        new THREE.CylinderGeometry(4.6, 4.6, 0.24, 8),
        new THREE.MeshStandardMaterial({ color: 0x80613b, roughness: 1 }),
      );
      soil.position.y = 0.12;
      group.add(soil);
      const cropMaterial = new THREE.MeshStandardMaterial({ color: 0x9b9d36, roughness: 0.9 });
      for (let row = -2; row <= 2; row++) {
        for (let column = -2; column <= 2; column++) {
          const crop = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.25, 4), cropMaterial);
          crop.position.set(column * 1.35, 0.72, row * 1.35);
          crop.rotation.z = column % 2 ? -0.15 : 0.15;
          group.add(crop);
        }
      }
    } else {
      const crystalMaterial = new THREE.MeshStandardMaterial({
        color: 0x52d5e5,
        emissive: 0x124b67,
        emissiveIntensity: 1.1,
        metalness: 0.3,
        roughness: 0.18,
      });
      for (let i = 0; i < 5; i++) {
        const crystal = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.7 + (i % 3) * 0.22, 1),
          crystalMaterial,
        );
        crystal.position.set(Math.cos(i * 1.26) * 1.1, 0.7 + (i % 2) * 0.45, Math.sin(i * 1.26) * 1.1);
        crystal.scale.y = 1.8;
        group.add(crystal);
      }
      const glow = new THREE.PointLight(0x49cde2, 1.5, 9);
      glow.position.y = 2.4;
      group.add(glow);
    }
    return group;
  }, [object.resource]);

  const select = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    onSelect(object);
  };

  return (
    <group position={[object.x, y, object.z]} onClick={select}>
      <primitive object={model} />
      <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]} onClick={select}>
        <ringGeometry args={[5.2, 5.55, 32]} />
        <meshBasicMaterial color={selected ? "#facc15" : "#7dd3fc"} transparent opacity={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.2, 0]} onClick={select}>
        <cylinderGeometry args={[5.1, 5.1, 0.12, 24]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {selected && <pointLight position={[0, 4, 0]} color="#facc15" intensity={2} distance={14} />}
    </group>
  );
}

function RogueCamp({
  object,
  selected,
  onSelect,
}: {
  object: Extract<WorldMapObject, { kind: "ROGUE_CAMP" }>;
  selected: boolean;
  onSelect: (object: Extract<WorldMapObject, { kind: "ROGUE_CAMP" }>) => void;
}) {
  const y = getHeightAt(object.x, object.z);
  const enemyModels = useMemo(
    () => Array.from({ length: 3 }, () => createInfantry()),
    [],
  );
  const tent = useMemo(() => createHouse(1), []);
  const select = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    onSelect(object);
  };

  return (
    <group position={[object.x, y, object.z]} onClick={select}>
      <primitive object={tent} position={[-1.4, 0, 0]} scale={0.8} />
      <mesh position={[1.5, 0.45, 0]}>
        <cylinderGeometry args={[0.35, 0.5, 0.9, 7]} />
        <meshStandardMaterial color="#cf5424" emissive="#a32911" emissiveIntensity={1.5} />
      </mesh>
      {enemyModels.map((model, index) => {
        const angle = index * Math.PI * 2 / enemyModels.length;
        return (
          <primitive
            key={index}
            object={model}
            position={[Math.cos(angle) * 3, 0, Math.sin(angle) * 3]}
            scale={0.75}
          />
        );
      })}
      <mesh position={[0, 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]} onClick={select}>
        <ringGeometry args={[4.5, 4.85, 32]} />
        <meshBasicMaterial color={selected ? "#facc15" : "#fb7185"} transparent opacity={0.95} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.18, 0]} onClick={select}>
        <cylinderGeometry args={[4.4, 4.4, 0.12, 24]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <AnimatedFlag position={[0, 5.4, 0]} color={0x8c1d18} width={0.9} height={0.55} />
      {selected && <pointLight position={[0, 3, 0]} color="#fb7185" intensity={1.5} distance={12} />}
    </group>
  );
}

export function WorldMapSystem({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (object: WorldMapObject) => void;
}) {
  return (
    <group>
      {RESOURCE_NODES.map((object) => (
        <ResourceLandmark
          key={object.id}
          object={object}
          selected={selectedId === object.id}
          onSelect={(selected) => onSelect(selected)}
        />
      ))}
      {ROGUE_CAMPS.map((object) => (
        <RogueCamp
          key={object.id}
          object={object}
          selected={selectedId === object.id}
          onSelect={(selected) => onSelect(selected)}
        />
      ))}
    </group>
  );
}
