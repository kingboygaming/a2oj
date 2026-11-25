"use client";

import { useMemo, useState } from "react";
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
import { BuildingFloatingTimer } from "./BuildingFloatingTimer";
import { HealingVFX } from "./HealingVFX";
import {
  WORLD_BUILDING_DEFINITIONS,
  WORLD_PLOT_LIMIT,
  worldPlotPosition,
  type WorldBuildingType,
  type WorldBuildingView,
} from "@/lib/world-buildings";

interface CastleSystemProps {
  position: [number, number, number];
  /** Player's stored world coordinates in metres; anchors terrain sampling. */
  anchorWorldX: number;
  anchorWorldZ: number;
  castleLevel: number;
  /** Base wall level; higher levels render taller stone walls. */
  wallLevel?: number;
  playerName: string;
  buildings: WorldBuildingView[];
  cityView: boolean;
  selectedPlotIndex: number | null;
  placementType: WorldBuildingType | null;
  /** Busy or otherwise unable to start another construction. */
  placementDisabled?: boolean;
  /** Direct placement: a green box click builds `type` at that plot. */
  onPlacePlot?: (plotIndex: number, type: WorldBuildingType) => void;
  castleUpgradeCompletesAt?: string | null;
  armyTraining?: {
    trainingType: string | null;
    trainingCount: number;
    trainingCompletesAt: string | null;
  } | null;
  activeScout?: { completesAt: number; targetName: string } | null;
  activeResearch?: { key: string; name?: string; completesAt: string | null } | null;
  healing?: {
    healingType: string | null;
    healingCount: number;
    healingCompletesAt: string | null;
  } | null;
  onActivityComplete?: () => void;
  onSelectCastle: () => void;
  onSelectBuilding: (plotIndex: number) => void;
}

export function CastleSystem({
  position,
  anchorWorldX,
  anchorWorldZ,
  castleLevel,
  wallLevel = 1,
  playerName,
  buildings,
  cityView,
  selectedPlotIndex,
  placementType,
  placementDisabled = false,
  onPlacePlot,
  castleUpgradeCompletesAt,
  armyTraining,
  activeScout,
  activeResearch,
  healing,
  onActivityComplete,
  onSelectCastle,
  onSelectBuilding,
}: CastleSystemProps) {
  const [cx, , cz] = position;
  const wallHeightScale = 1 + Math.min(20, Math.max(0, wallLevel - 1)) * 0.05;
  const [snapped, setSnapped] = useState<{ index: number; x: number; z: number } | null>(null);
  // Render used plots plus a buffer of fresh cells. Capped only for GPU safety.
  const plotCount = Math.min(
    WORLD_PLOT_LIMIT,
    Math.max(24, ...buildings.map((building) => building.plotIndex + 12)),
  );
  const plots = useMemo<Array<[number, number]>>(
    () => Array.from({ length: plotCount }, (_, index) => worldPlotPosition(index)),
    [plotCount],
  );
  // The wall grows with the city so every placeable cell stays *inside* it.
  const wallRadius = Math.max(
    23,
    ...plots.map(([x, z]) => Math.hypot(x, z) + 7),
  );
  const layout = useMemo(() => {
    const radius = wallRadius;
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
  }, [cx, cz, anchorWorldX, anchorWorldZ, wallRadius]);

  const plotBuildings = new Map(buildings.map((building) => [building.plotIndex, building]));

  /** Snap a render-space XZ point to the closest grid cell inside the wall. */
  function findNearestCell(renderX: number, renderZ: number) {
    let nearest: { index: number; x: number; z: number; distance: number } | null = null;
    for (let index = 0; index < plots.length; index += 1) {
      const [px, pz] = plots[index];
      const distance = Math.hypot(renderX - px, renderZ - pz);
      if (!nearest || distance < nearest.distance) {
        nearest = { index, x: px, z: pz, distance };
      }
    }
    return nearest && nearest.distance <= 4.2 ? nearest : null;
  }

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

      {castleUpgradeCompletesAt && (
        <BuildingFloatingTimer
          position={[cx, position[1] + 16 + castleLevel * 0.3, cz]}
          completesAtMs={new Date(castleUpgradeCompletesAt).getTime()}
          icon="🏰"
          label="Nâng cấp Thành chính"
          detail={`Cấp ${castleLevel} → ${castleLevel + 1}`}
          onComplete={onActivityComplete}
        />
      )}

      {layout.walls.map((wall, index) => (
        <WallSegment
          key={`wall-${index}`}
          position={wall.pos}
          rotation={wall.rot}
          length={wall.len}
          heightScale={wallHeightScale}
        />
      ))}
      {layout.towers.map((tower, index) => (
        <WatchTower key={`tower-${index}`} position={tower} />
      ))}
      <Gate position={layout.gatePosition} rotation={-layout.gateAngle + Math.PI / 2} />

      {cityView && plots.map(([offsetX, offsetZ], index) => {
        const x = cx + offsetX;
        const z = cz + offsetZ;
        const groundY = heightAtRender(x, z, anchorWorldX, anchorWorldZ);
        const building = plotBuildings.get(index);
        const placeable = !building && !placementDisabled;
        const isSnapped = snapped?.index === index;
        const color = placeable
          ? "#34d399"
          : building
            ? "#f87171"
            : "#b91c1c";
        const outline = selectedPlotIndex === index && !placementType ? "#fbbf24" : color;

        return (
          <group key={`plot-${index}`} position={[x, groundY + 0.08, z]}>
            {/* Grid cell marker — a click target is the plane below, not this box. */}
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[5.6, 0.16, 5.6]} />
              <meshBasicMaterial
                color={color}
                transparent
                opacity={isSnapped ? 0.32 : placeable ? 0.14 : 0.1}
                depthWrite={false}
              />
            </mesh>
            <mesh position={[0, 0.02, 0]}>
              <boxGeometry args={[5.9, 0.2, 5.9]} />
              <meshBasicMaterial color={outline} transparent opacity={0.85} wireframe depthWrite={false} />
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
            ) : null}

            {building && (() => {
              // 1. Building constructing/upgrading
              if (building.status !== "COMPLETED") {
                return (
                  <BuildingFloatingTimer
                    heightOffset={6.0}
                    completesAtMs={new Date(building.completesAt).getTime()}
                    startedAtMs={new Date(building.startedAt).getTime()}
                    icon="🏗️"
                    label={building.status === "UPGRADING" ? "Nâng cấp" : "Xây dựng"}
                    detail={WORLD_BUILDING_DEFINITIONS[building.type]?.name}
                    onComplete={onActivityComplete}
                  />
                );
              }

              // 2. Training troops in Barracks / Archery Range / Stable
              if (
                ((building.type === "BARRACKS" && armyTraining?.trainingType === "INFANTRY") ||
                  (building.type === "ARCHERY_RANGE" && armyTraining?.trainingType === "ARCHERS") ||
                  (building.type === "STABLE" && armyTraining?.trainingType === "CAVALRY")) &&
                armyTraining?.trainingCompletesAt
              ) {
                const label =
                  armyTraining.trainingType === "INFANTRY"
                    ? "Bộ binh"
                    : armyTraining.trainingType === "ARCHERS"
                      ? "Cung thủ"
                      : "Kỵ binh";
                const icon =
                  armyTraining.trainingType === "INFANTRY"
                    ? "🛡️"
                    : armyTraining.trainingType === "ARCHERS"
                      ? "🏹"
                      : "🐎";
                return (
                  <BuildingFloatingTimer
                    heightOffset={6.0}
                    completesAtMs={new Date(armyTraining.trainingCompletesAt).getTime()}
                    icon={icon}
                    label="Huấn luyện"
                    detail={`+${armyTraining.trainingCount} ${label}`}
                    onComplete={onActivityComplete}
                  />
                );
              }

              // 3. Scouting mission in Scout Camp
              if (building.type === "SCOUT_CAMP" && activeScout) {
                return (
                  <BuildingFloatingTimer
                    heightOffset={6.0}
                    completesAtMs={activeScout.completesAt}
                    icon="🔭"
                    label="Do thám"
                    detail={activeScout.targetName}
                    onComplete={onActivityComplete}
                  />
                );
              }

              // 4. Research in Military Academy
              if (building.type === "MILITARY_ACADEMY" && activeResearch?.completesAt) {
                return (
                  <BuildingFloatingTimer
                    heightOffset={6.0}
                    completesAtMs={new Date(activeResearch.completesAt).getTime()}
                    icon="🔬"
                    label="Nghiên cứu"
                    detail={activeResearch.name || "Công nghệ"}
                    onComplete={onActivityComplete}
                  />
                );
              }

              // 5. Healing wounded troops in Hospital
              if (building.type === "HOSPITAL" && healing?.healingCompletesAt) {
                const troopLabel =
                  healing.healingType === "INFANTRY"
                    ? "Bộ binh"
                    : healing.healingType === "ARCHERS"
                      ? "Cung thủ"
                      : "Kỵ binh";
                return (
                  <group>
                    <HealingVFX />
                    <BuildingFloatingTimer
                      heightOffset={6.0}
                      completesAtMs={new Date(healing.healingCompletesAt).getTime()}
                      icon="🩹"
                      label="Điều trị"
                      detail={`+${healing.healingCount} ${troopLabel}`}
                      onComplete={onActivityComplete}
                    />
                  </group>
                );
              }

              return null;
            })()}
          </group>
        );
      })}

      {cityView && (
        <>
          {/* Invisible build plane: raycast → nearest grid cell → snap. */}
          <mesh
            position={[cx, position[1] + 0.06, cz]}
            rotation={[-Math.PI / 2, 0, 0]}
            onPointerMove={(event) => {
              event.stopPropagation();
              const cell = findNearestCell(event.point.x, event.point.z);
              setSnapped(cell ? { index: cell.index, x: cell.x, z: cell.z } : null);
            }}
            onPointerOut={() => setSnapped(null)}
            onClick={(event) => {
              event.stopPropagation();
              const cell = findNearestCell(event.point.x, event.point.z);
              if (!cell || !placementType) return;
              if (!plotBuildings.has(cell.index) && onPlacePlot) {
                onPlacePlot(cell.index, placementType);
              } else if (plotBuildings.has(cell.index)) {
                onSelectBuilding(cell.index);
              }
            }}
          >
            <planeGeometry args={[wallRadius * 2.4, wallRadius * 2.4]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} side={2} />
          </mesh>

          {snapped && placementType && (() => {
            const y = heightAtRender(snapped.x, snapped.z, anchorWorldX, anchorWorldZ) + 0.12;
            const occupied = plotBuildings.has(snapped.index);
            const valid = !occupied && !placementDisabled;
            return (
              <group position={[snapped.x, y, snapped.z]}>
                <mesh rotation={[-Math.PI / 2, 0, 0]}>
                  <boxGeometry args={[5.9, 0.22, 5.9]} />
                  <meshBasicMaterial
                    color={valid ? "#34d399" : "#f87171"}
                    transparent
                    opacity={0.55}
                    wireframe
                    depthWrite={false}
                  />
                </mesh>
                <WorldBuildingModel
                  type={placementType}
                  level={1}
                  position={[0, 0, 0]}
                  ghost
                  ghostColor={valid ? "#34d399" : "#f87171"}
                />
              </group>
            );
          })()}

          {snapped && (
            <Text
              position={[
                snapped.x,
                heightAtRender(snapped.x, snapped.z, anchorWorldX, anchorWorldZ) + 7.5,
                snapped.z,
              ]}
              fontSize={1.1}
              color={plotBuildings.has(snapped.index) ? "#fca5a5" : "#6ee7b7"}
              outlineColor="#000000"
              outlineWidth={0.04}
            >
              {plotBuildings.has(snapped.index)
                ? "Đã có công trình"
                : placementType
                  ? "Bấm để xây"
                  : "Chọn công trình trong tab Xây"}
            </Text>
          )}
        </>
      )}

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
