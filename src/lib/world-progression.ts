import {
  WORLD_BUILDING_DEFINITIONS,
  WORLD_BUILDING_PLOT_COUNT,
  type WorldBuildingType,
} from "./world-buildings";

/**
 * A2 Kingdom — progression configuration.
 *
 * Every long-running timer, slot unlock, wall stat, completion reward and
 * castle requirement lives here so balance changes never need a code hunt.
 * The module is isomorphic: the server enforces these numbers and the client
 * only displays them.
 */

/** Hard level cap kept from the original world implementation. */
export const WORLD_MAX_BUILDING_LEVEL = 20;

/** Storage added by one warehouse level (legacy formula, unchanged). */
export const WORLD_RESOURCE_CAP_PER_WAREHOUSE_LEVEL = 2_000;

/** Shared warehouse capacity formula used by the snapshot and redeem rewards. */
export function worldStorageCapacity(
  warehouseLevel: number,
  completedWarehouseBuildingLevels = 0,
): number {
  return (
    Math.max(0, warehouseLevel) + Math.max(0, completedWarehouseBuildingLevels)
  ) * WORLD_RESOURCE_CAP_PER_WAREHOUSE_LEVEL;
}

/** Castle levels with an explicit duration in the design table. */
export const WORLD_CASTLE_UPGRADE_SECONDS: Readonly<Record<number, number>> = {
  2: 10 * 60,
  3: 60 * 60,
  4: 3 * 60 * 60,
  5: 8 * 60 * 60,
  6: 16 * 60 * 60,
  7: 24 * 60 * 60,
  8: 36 * 60 * 60,
  9: 48 * 60 * 60,
  10: 72 * 60 * 60,
};

/**
 * Castle upgrade duration for a target level. Levels above the table grow
 * linearly (72 h + 24 h per extra level) so the data-driven cap can be raised
 * later without touching this function's callers.
 */
export function worldCastleUpgradeSeconds(nextLevel: number): number {
  const level = Math.max(2, Math.trunc(nextLevel));
  return WORLD_CASTLE_UPGRADE_SECONDS[level] ?? 72 * 60 * 60 + (level - 10) * 24 * 60 * 60;
}

/** Castle upgrade cost. Kept identical to the pre-expansion formula. */
export function worldCastleUpgradeCost(nextLevel: number): { wood: number; stone: number } {
  const level = Math.max(2, Math.trunc(nextLevel));
  return { wood: 250 * level, stone: 150 * level };
}

/**
 * Usable city plots per castle level. The prompt's table (4/6/9/12/16) is
 * capped by the number of plots the current City View actually renders; the
 * extra level-5 slot becomes available automatically once the plot layout is
 * extended.
 */
const CASTLE_SLOT_TABLE = [4, 6, 9, 12, 16] as const;

export function worldCastleSlotCount(castleLevel: number): number {
  const level = Math.max(1, Math.trunc(castleLevel));
  const proposed = CASTLE_SLOT_TABLE[Math.min(level, CASTLE_SLOT_TABLE.length) - 1] ?? 16;
  return Math.min(WORLD_BUILDING_PLOT_COUNT, proposed);
}

/** True when a plot index is unlocked for the given castle level. */
export function isWorldPlotUnlocked(plotIndex: number, castleLevel: number): boolean {
  return Number.isInteger(plotIndex) && plotIndex >= 0 && plotIndex < worldCastleSlotCount(castleLevel);
}

/** Number of plots that can be under construction/upgrade at the same time. */
export const WORLD_BUILD_QUEUE_LIMIT = 1;

/**
 * Upgrade duration multiplier by target level. Building level 1 uses the
 * definition's `constructionSeconds`; upgrading to level N multiplies it.
 */
const BUILDING_TIME_FACTORS = [1, 1.5, 2.2, 3.2, 4.5, 6, 8, 10, 13, 16, 20] as const;

function buildingTimeFactor(nextLevel: number): number {
  const level = Math.max(1, Math.trunc(nextLevel));
  const explicit = BUILDING_TIME_FACTORS[Math.min(level, BUILDING_TIME_FACTORS.length) - 1];
  if (level <= BUILDING_TIME_FACTORS.length) return explicit;
  return 20 + (level - BUILDING_TIME_FACTORS.length) * 5;
}

export function worldBuildingUpgradeCost(
  type: WorldBuildingType,
  nextLevel: number,
): { wood: number; stone: number } {
  const definition = WORLD_BUILDING_DEFINITIONS[type];
  const level = Math.max(2, Math.trunc(nextLevel));
  return { wood: definition.woodCost * level, stone: definition.stoneCost * level };
}

export function worldBuildingUpgradeSeconds(type: WorldBuildingType, nextLevel: number): number {
  const definition = WORLD_BUILDING_DEFINITIONS[type];
  return Math.round(definition.constructionSeconds * buildingTimeFactor(nextLevel));
}

/**
 * Completion reward per building level. Rewards are granted by the server the
 * moment a completion is observed (never at construction start) and are capped
 * by warehouse capacity.
 */
const COMPLETION_REWARD_PER_LEVEL: Record<
  WorldBuildingType,
  { wood: number; stone: number; food: number; iron: number }
> = {
  BARRACKS: { wood: 20, stone: 10, food: 5, iron: 0 },
  ARCHERY_RANGE: { wood: 22, stone: 12, food: 5, iron: 0 },
  STABLE: { wood: 25, stone: 14, food: 6, iron: 0 },
  SIEGE_WORKSHOP: { wood: 30, stone: 20, food: 0, iron: 2 },
  MILITARY_ACADEMY: { wood: 40, stone: 30, food: 0, iron: 4 },
  HOSPITAL: { wood: 15, stone: 8, food: 15, iron: 0 },
  SCOUT_CAMP: { wood: 18, stone: 10, food: 10, iron: 0 },
  WATCHTOWER: { wood: 18, stone: 14, food: 0, iron: 0 },
  GATEHOUSE: { wood: 20, stone: 16, food: 0, iron: 0 },
  LUMBER_MILL: { wood: 30, stone: 6, food: 0, iron: 0 },
  IRON_MINE: { wood: 12, stone: 10, food: 0, iron: 3 },
  STONE_QUARRY: { wood: 10, stone: 30, food: 0, iron: 0 },
  FARM: { wood: 8, stone: 4, food: 30, iron: 0 },
  WAREHOUSE: { wood: 14, stone: 18, food: 0, iron: 0 },
};

export function worldBuildingCompletionReward(
  type: WorldBuildingType,
  level: number,
): { wood: number; stone: number; food: number; iron: number } {
  const perLevel = COMPLETION_REWARD_PER_LEVEL[type];
  const safeLevel = Math.max(1, Math.min(WORLD_MAX_BUILDING_LEVEL, Math.trunc(level)));
  return {
    wood: perLevel.wood * safeLevel,
    stone: perLevel.stone * safeLevel,
    food: perLevel.food * safeLevel,
    iron: perLevel.iron * safeLevel,
  };
}

/* ------------------------------------------------------------------ */
/* Wall, gate and defensive buildings                                  */
/* ------------------------------------------------------------------ */

export const WORLD_WALL_MAX_LEVEL = 10;
export const WORLD_WALL_BASE_LEVEL = 1;

export function worldWallUpgradeCost(nextLevel: number): { wood: number; stone: number } {
  const level = Math.max(2, Math.trunc(nextLevel));
  return { wood: 150 * level, stone: 200 * level };
}

const WALL_UPGRADE_SECONDS: Readonly<Record<number, number>> = {
  2: 3 * 60,
  3: 10 * 60,
  4: 30 * 60,
  5: 60 * 60,
  6: 2 * 60 * 60,
  7: 4 * 60 * 60,
  8: 6 * 60 * 60,
  9: 8 * 60 * 60,
  10: 12 * 60 * 60,
};

export function worldWallUpgradeSeconds(nextLevel: number): number {
  const level = Math.max(2, Math.trunc(nextLevel));
  return WALL_UPGRADE_SECONDS[level] ?? 12 * 60 * 60 + (level - 10) * 6 * 60 * 60;
}

/** Nominal wall hit points, shown in the UI and used by battle reports. */
export function worldWallHitPoints(wallLevel: number): number {
  return 4_000 + Math.max(0, Math.trunc(wallLevel)) * 2_000;
}

/** Defence bonus (percent) contributed by the wall. */
export function worldWallDefensePercent(wallLevel: number): number {
  return Math.max(0, Math.trunc(wallLevel)) * 4;
}

type DefenseBuildingRow = { type: string; level: number };

function maxLevelOfType(buildings: ReadonlyArray<DefenseBuildingRow>, type: string): number {
  let level = 0;
  for (const building of buildings) {
    if (building.type === type && building.level > level) level = building.level;
  }
  return level;
}

export function worldWatchtowerLevel(buildings: ReadonlyArray<DefenseBuildingRow>): number {
  return maxLevelOfType(buildings, "WATCHTOWER");
}

export function worldGatehouseLevel(buildings: ReadonlyArray<DefenseBuildingRow>): number {
  return maxLevelOfType(buildings, "GATEHOUSE");
}

/**
 * Total defence bonus in percent: wall + watchtower + gatehouse.
 * Applied multiplicatively to the defender's combat power.
 */
export function worldDefenseBonusPercent(
  wallLevel: number,
  buildings: ReadonlyArray<DefenseBuildingRow>,
): number {
  return (
    worldWallDefensePercent(wallLevel) +
    worldWatchtowerLevel(buildings) * 3 +
    worldGatehouseLevel(buildings) * 2
  );
}

/** Share of loot (percent) blocked by fortifications. Capped at 60 %. */
export function worldLootReductionPercent(
  wallLevel: number,
  buildings: ReadonlyArray<DefenseBuildingRow>,
): number {
  const raw = Math.max(0, Math.trunc(wallLevel)) * 2.5 + worldGatehouseLevel(buildings) * 2;
  return Math.min(60, Math.round(raw));
}

/** Extra view radius (metres) granted by completed watchtowers. */
export function worldWatchtowerViewBonusMeters(
  buildings: ReadonlyArray<DefenseBuildingRow>,
): number {
  return worldWatchtowerLevel(buildings) * 2_000;
}

/* ------------------------------------------------------------------ */
/* Castle upgrade requirements                                         */
/* ------------------------------------------------------------------ */

export type WorldCastleRequirement = {
  key: "WALL" | "ECONOMY";
  label: string;
  met: boolean;
  detail: string;
};

const ECONOMIC_BUILDING_TYPES: ReadonlyArray<WorldBuildingType> = [
  "LUMBER_MILL",
  "STONE_QUARRY",
  "FARM",
  "IRON_MINE",
  "WAREHOUSE",
];

/**
 * Requirements for the *next* castle level. The wall requirement mirrors the
 * brief (castle N→N+1 needs wall N); from castle 3 onward at least one economic
 * building must have reached level 2 so the economy keeps pace.
 */
export function worldCastleRequirements(
  currentCastleLevel: number,
  wallLevel: number,
  buildings: ReadonlyArray<{ type: string; level: number }>,
): WorldCastleRequirement[] {
  const nextLevel = Math.max(2, Math.trunc(currentCastleLevel) + 1);
  const requiredWall = nextLevel - 1;
  const economyLevel = Math.max(
    0,
    ...buildings
      .filter((building) => ECONOMIC_BUILDING_TYPES.includes(building.type as WorldBuildingType))
      .map((building) => building.level),
  );
  const requirements: WorldCastleRequirement[] = [
    {
      key: "WALL",
      label: `Tường thành cấp ${requiredWall}`,
      met: wallLevel >= requiredWall,
      detail: `Hiện tại: cấp ${wallLevel}`,
    },
  ];
  if (nextLevel >= 3) {
    requirements.push({
      key: "ECONOMY",
      label: "Một công trình kinh tế đạt cấp 2",
      met: economyLevel >= 2,
      detail: `Cấp kinh tế cao nhất: ${economyLevel}`,
    });
  }
  return requirements;
}

/** Human-readable duration, used by server messages and the UI. */
export function formatWorldDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  const secs = total % 60;
  if (days > 0) return `${days} ngày ${hours} giờ`;
  if (hours > 0) return `${hours} giờ ${minutes} phút`;
  if (minutes > 0) return `${minutes} phút ${secs} giây`;
  return `${secs} giây`;
}
