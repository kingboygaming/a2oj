import { Prisma } from "@prisma/client";
import { randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  WORLD_BUILDING_DEFINITIONS,
  WORLD_BUILDING_PLOT_COUNT,
  WORLD_TRAINING_BUILDINGS,
  isWorldBuildingType,
  worldBuildingMaxLevel,
  worldScoutCampLevel,
  worldViewRadiusMeters,
  type WorldBuildingType,
  type WorldBuildingView,
} from "@/lib/world-buildings";
import {
  MAX_RESOURCE_NODE_OCCUPANCY,
  RESOURCE_NODE_OCCUPATION_MS,
  RESOURCE_NODE_RESPAWN_MS,
  ROGUE_CAMP_RESPAWN_MS,
  ROGUE_CAMPS,
  RESOURCE_NODES,
  WORLD_MAP_MARCH_TROOP_LIMIT,
  WORLD_MAP_TROOP_RETURN_MS,
  worldMapTravelMilliseconds,
  type WorldMapObject,
} from "@/lib/world-map-objects";
import {
  WORLD_RESEARCH_DEFINITIONS,
  isWorldResearchKey,
  worldMilitaryTierName,
  type WorldResearchKey,
} from "@/lib/world-research";
import { getVisibleChunksAroundPosition } from "@/lib/world-coordinates";
import {
  DEFAULT_WORLD_SEED,
  generateChunkObjects,
  resolveWorldMapObject,
} from "@/lib/world-generation";
import { queueWorldRealtimeChanges } from "@/lib/world-realtime-server";
import { WORLD_ENTITY_MAX_OBJECTS, type WorldRealtimeChange } from "@/lib/world-realtime";

export const WORLD_OFFLINE_CAP_MS = 48 * 60 * 60 * 1000;
export const WORLD_RESOURCE_CAP_PER_WAREHOUSE_LEVEL = 2_000;
export const WORLD_MIN_TERRITORY_DISTANCE_METERS = 10_000;
/** Max other-player bases returned in one snapshot/entity response. */
export const WORLD_NEARBY_BASE_LIMIT = 20;
const MAX_BUILDING_LEVEL = 20;
const INITIAL_COORDINATE_EXTENT_METERS = 100_000;
const MAX_COORDINATE_EXTENT_METERS = 1_000_000_000;
const MAX_BASE_ATTACK_TROOPS = 500;
const BASE_ATTACK_SECONDS_PER_10KM = 5 * 60;
const BASE_ATTACK_LOOT_RATE = 0.2;
const BASE_ATTACK_SHIELD_MS = 24 * 60 * 60 * 1000;
const BASE_OCCUPATION_DURATION_MS = 24 * 60 * 60 * 1000;
const JOB_LOCK_TIMEOUT_MS = 15 * 60 * 1000;
const MAX_JOB_ATTEMPTS = 5;
const MAX_TROOPS_PER_TYPE = 5_000;
const MAX_TROOPS_PER_MARCH = 500;
const TROOP_STATS = {
  INFANTRY: { costWood: 10, costStone: 5, trainingSeconds: 5, damage: 10, label: "Bộ binh" },
  ARCHERS: { costWood: 15, costStone: 5, trainingSeconds: 7, damage: 15, label: "Cung thủ" },
  CAVALRY: { costWood: 20, costStone: 10, trainingSeconds: 10, damage: 20, label: "Kỵ binh" },
} as const;

type WorldBaseState = {
  id: string;
  userId: string;
  wood: number;
  woodRemainder: number;
  stone: number;
  stoneRemainder: number;
  iron: number;
  food: number;
  foodRemainder: number;
  rare: number;
  experience: number;
  factoryLevel: number;
  warehouseLevel: number;
  castleLevel: number;
  castlePendingLevel: number | null;
  castleUpgradeCompletesAt: Date | null;
  activeResearchKey: string | null;
  activeResearchLevel: number | null;
  researchCompletesAt: Date | null;
  upgradeType: string | null;
  upgradeCompletesAt: Date | null;
  infantry: number;
  archers: number;
  cavalry: number;
  trainingType: string | null;
  trainingCount: number;
  trainingCompletesAt: Date | null;
  marchActive: boolean;
  activePvpAttackId: string | null;
  coordinateX: number | null;
  coordinateZ: number | null;
  pvpShieldUntil: Date | null;
  lastSimulatedAt: Date;
  version: number;
};

type WorldProgress = {
  wood: number;
  woodRemainder: number;
  stone: number;
  stoneRemainder: number;
  food: number;
  foodRemainder: number;
  factoryLevel: number;
  warehouseLevel: number;
  castleLevel: number;
  castlePendingLevel: number | null;
  castleUpgradeCompletesAt: Date | null;
  upgradeType: string | null;
  upgradeCompletesAt: Date | null;
  lastSimulatedAt: Date;
  elapsedSeconds: number;
  producedWood: number;
  producedStone: number;
  producedFood: number;
  cappedOfflineTime: boolean;
};

export type WorldMapObjectState =
  | {
      id: string;
      kind: "RESOURCE";
      /** Monotonic row version; 0 when no DB row exists yet. */
      version: number;
      ownerUserId: string | null;
      ownerName: string | null;
      remaining: number;
      status: "AVAILABLE" | "OCCUPIED" | "DEPLETED";
      occupiedUntil: string | null;
      respawnsAt: string | null;
    }
  | {
      id: string;
      kind: "ROGUE_CAMP";
      /** Monotonic row version; 0 when no DB row exists yet. */
      version: number;
      availableAt: string | null;
      status: "AVAILABLE" | "COOLDOWN";
    };

export type WorldMapMissionView = {
  id: string;
  targetId: string;
  targetKind: "RESOURCE" | "ROGUE_CAMP";
  actionType: string;
  status: string;
  infantry: number;
  archers: number;
  cavalry: number;
  troopTier: number;
  arrivesAt: string;
  returnsAt: string | null;
  completedAt: string | null;
  report: string | null;
  rewardWood: number;
  rewardStone: number;
  rewardIron: number;
  rewardFood: number;
  rewardRare: number;
  rewardExperience: number;
  rewardItemKey: string | null;
  rewardItemCount: number;
};

export interface WorldScoutReport {
  targetUserId: string;
  targetName: string;
  targetX: number;
  targetZ: number;
  scoutLevel: number;
  scoutedAt: string;
  distanceMeters: number;
  travelDurationSeconds?: number;
  castleLevel: number;
  pvpShieldUntil: string | null;
  approximateWood: number;
  approximateStone: number;
  estimatedTotalTroops: string;
  exactInfantry?: number;
  exactArchers?: number;
  exactCavalry?: number;
  food?: number;
  warehouseLevel?: number;
  factoryLevel?: number;
  militaryTier?: number;
  militaryTierName?: string;
  productionEfficiencyTier?: number;
  marchActive?: boolean;
  trainingActive?: boolean;
  buildings?: Array<{
    type: string;
    name: string;
    level: number;
  }>;
}

export type WorldSnapshot = {
  userId: string;
  now: string;
  buildings: WorldBuildingView[];
  research: Array<{ key: WorldResearchKey; level: number }>;
  mapObjects: WorldMapObjectState[];
  mapObjectDefinitions: WorldMapObject[];
  mapMissions: WorldMapMissionView[];
  base: {
    playerName: string;
    castleLevel: number;
    castlePendingLevel: number | null;
    castleUpgradeCompletesAt: string | null;
    activeResearch: null | {
      key: WorldResearchKey;
      level: number;
      completesAt: string;
    };
    militaryTier: number;
    militaryTierName: string;
    productionResearchLevel: number;
    researchSpeedLevel: number;
    coordinateX: number;
    coordinateZ: number;
    activePvpAttackId: string | null;
    pvpShieldUntil: string | null;
    wood: number;
    stone: number;
    iron: number;
    food: number;
    rare: number;
    experience: number;
    items: Array<{ itemKey: string; quantity: number }>;
    factoryLevel: number;
    warehouseLevel: number;
    upgradeType: string | null;
    upgradeCompletesAt: string | null;
    lastSimulatedAt: string;
    capacity: number;
    woodPerHour: number;
    stonePerHour: number;
    foodPerHour: number;
    army: {
      infantry: number;
      archers: number;
      cavalry: number;
      trainingType: string | null;
      trainingCount: number;
      trainingCompletesAt: string | null;
      marchActive: boolean;
    };
  };
  offline: {
    elapsedSeconds: number;
    producedWood: number;
    producedStone: number;
    producedFood: number;
    cappedOfflineTime: boolean;
  };
  events: Array<{
    id: string;
    title: string;
    description: string;
    startsAt: string;
    endsAt: string;
    status: "SCHEDULED" | "ACTIVE" | "COMPLETED" | "PROCESSING" | "CANCELED";
    participantCount: number;
    participantLimit: number;
    minFactoryLevel: number;
    contributionWoodCost: number;
    contributionCooldownSeconds: number;
    rewards: Array<{ wood: number; stone: number }>;
    eventType: "RESOURCE_RUSH" | "WORLD_BOSS";
    bossHp: number;
    bossHpRemaining: number;
    marchTravelSeconds: number;
    activeMarch: null | {
      id: string;
      eventId: string;
      eventTitle: string;
      status: string;
      arrivesAt: string;
      returnsAt: string | null;
      damage: number;
      infantry: number;
      archers: number;
      cavalry: number;
      casualties: number;
    };
    joined: boolean;
    score: number;
    rank: number | null;
    leaderboard: Array<{ name: string; score: number }>;
  }>;
  nearbyBases: Array<{
    userId: string;
    username: string;
    displayName: string;
    coordinateX: number;
    coordinateZ: number;
    distanceMeters: number;
    castleLevel: number;
    pvpShieldUntil: string | null;
    activeAttack: boolean;
    /** Monotonic `WorldBase.version`, used to reject stale merges. */
    version: number;
  }>;
  baseAttacks: Array<{
    id: string;
    status: string;
    attackerUserId: string;
    defenderUserId: string;
    attackerName: string;
    defenderName: string;
    distanceMeters: number;
    infantry: number;
    archers: number;
    cavalry: number;
    arrivesAt: string;
    resolvedAt: string | null;
    winnerUserId: string | null;
    stolenWood: number;
    stolenStone: number;
    attackerCasualties: number;
    defenderCasualties: number;
  }>;
  occupations: Array<{
    id: string;
    controllerUserId: string;
    formerOwnerUserId: string;
    controllerName: string;
    formerOwnerName: string;
    coordinateX: number;
    coordinateZ: number;
    endsAt: string;
    status: string;
  }>;
  pendingRewards: Array<{
    eventId: string;
    title: string;
    wood: number;
    stone: number;
  }>;
};

export class WorldActionError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "WorldActionError";
  }
}

type WorldResourceNodeRow = {
  version: number;
  ownerUserId: string | null;
  remaining: number;
  occupiedUntil: Date | null;
  respawnsAt: Date | null;
  owner?: { username: string; displayName: string | null } | null;
};

type WorldRogueCampRow = {
  version: number;
  availableAt: Date | null;
};

/**
 * Build the public state of one map object. Shared by the full snapshot and the
 * incremental `/api/world/entities` endpoint so both always agree.
 */
export function buildWorldMapObjectState(
  definition: WorldMapObject,
  node: WorldResourceNodeRow | null | undefined,
  camp: WorldRogueCampRow | null | undefined,
  now: Date,
): WorldMapObjectState {
  if (definition.kind === "RESOURCE") {
    return {
      id: definition.id,
      kind: "RESOURCE" as const,
      version: node?.version ?? 0,
      ownerUserId: node?.ownerUserId ?? null,
      ownerName: node?.owner ? node.owner.displayName || node.owner.username : null,
      remaining: node?.remaining ?? definition.amount,
      status:
        !node || node.remaining > 0
          ? node?.ownerUserId && node.occupiedUntil && node.occupiedUntil > now
            ? ("OCCUPIED" as const)
            : ("AVAILABLE" as const)
          : ("DEPLETED" as const),
      occupiedUntil: node?.occupiedUntil?.toISOString() ?? null,
      respawnsAt: node?.respawnsAt?.toISOString() ?? null,
    };
  }
  const availableAt = camp?.availableAt ?? null;
  return {
    id: definition.id,
    kind: "ROGUE_CAMP" as const,
    version: camp?.version ?? 0,
    availableAt: availableAt?.toISOString() ?? null,
    status: availableAt && availableAt > now ? ("COOLDOWN" as const) : ("AVAILABLE" as const),
  };
}

type WorldNearbyBaseRow = {
  userId: string;
  coordinateX: number | null;
  coordinateZ: number | null;
  castleLevel: number;
  pvpShieldUntil: Date | null;
  activePvpAttackId: string | null;
  version: number;
  user: { username: string; displayName: string | null };
};

/** Public projection of another player's base, relative to the viewer. */
export function buildNearbyBaseState(
  row: WorldNearbyBaseRow,
  originX: number,
  originZ: number,
): WorldSnapshot["nearbyBases"][number] | null {
  if (row.coordinateX === null || row.coordinateZ === null) return null;
  return {
    userId: row.userId,
    username: row.user.username,
    displayName: row.user.displayName || row.user.username,
    coordinateX: row.coordinateX,
    coordinateZ: row.coordinateZ,
    distanceMeters: Math.round(Math.hypot(row.coordinateX - originX, row.coordinateZ - originZ)),
    castleLevel: row.castleLevel,
    pvpShieldUntil: row.pvpShieldUntil?.toISOString() ?? null,
    activeAttack: row.activePvpAttackId !== null,
    version: row.version,
  };
}

function requireWorldCoordinates(
  coordinates: readonly [number, number] | null,
  attackId: string,
): readonly [number, number] {
  if (!coordinates) throw new Error(`Could not allocate a new base location for attack ${attackId}.`);
  return coordinates;
}

function productionFor(factoryLevel: number, resource: "wood" | "stone") {
  return factoryLevel * (resource === "wood" ? 20 : 10);
}

type WorldBuildingState = {
  buildingType: string;
  level: number;
  pendingLevel: number | null;
  completedAt: Date | null;
  completesAt: Date;
};

function buildingLevelSumAt(
  buildings: WorldBuildingState[],
  buildingType: string,
  timestamp: number,
) {
  return buildings.reduce(
    (total, building) =>
      total + (building.buildingType === buildingType
        ? activeBuildingLevelAt(building, timestamp)
        : 0),
    0,
  );
}

function worldResourceCapacity(
  warehouseLevel: number,
  buildings: WorldBuildingState[],
  timestamp: number,
) {
  return (
    warehouseLevel + buildingLevelSumAt(buildings, "WAREHOUSE", timestamp)
  ) * WORLD_RESOURCE_CAP_PER_WAREHOUSE_LEVEL;
}

function activeBuildingLevelAt(
  building: WorldBuildingState,
  timestamp: number,
) {
  if (building.pendingLevel !== null && timestamp >= building.completesAt.getTime()) {
    return building.pendingLevel;
  }
  if (building.completedAt && timestamp >= building.completedAt.getTime()) {
    return building.level;
  }
  return 0;
}

function buildingProductionAt(
  buildings: WorldBuildingState[],
  timestamp: number,
  resource: "wood" | "stone" | "food",
) {
  const buildingType = resource === "wood"
    ? "LUMBER_MILL"
    : resource === "stone"
      ? "STONE_QUARRY"
      : "FARM";
  const ratePerLevel = resource === "wood" ? 20 : resource === "stone" ? 10 : 20;
  return buildings.reduce(
    (total, building) =>
      total + (building.buildingType === buildingType
        ? activeBuildingLevelAt(building, timestamp) * ratePerLevel
        : 0),
    0,
  );
}

export function calculateWorldProgress(
  base: WorldBaseState,
  now: Date,
  buildings: WorldBuildingState[] = [],
  productionResearchLevel = 0,
  pendingProductionResearch: { level: number; completesAt: Date } | null = null,
): WorldProgress {
  const rawElapsedMs = Math.max(0, now.getTime() - base.lastSimulatedAt.getTime());
  const elapsedMs = Math.min(rawElapsedMs, WORLD_OFFLINE_CAP_MS);
  const accrualStart = new Date(now.getTime() - elapsedMs);
  const upgradeFinished =
    base.upgradeType !== null &&
    base.upgradeCompletesAt !== null &&
    base.upgradeCompletesAt <= now;
  const nextFactoryLevel =
    upgradeFinished && base.upgradeType === "FACTORY" ? base.factoryLevel + 1 : base.factoryLevel;
  const nextWarehouseLevel =
    upgradeFinished && base.upgradeType === "WAREHOUSE"
      ? base.warehouseLevel + 1
      : base.warehouseLevel;
  const castleUpgradeFinished =
    base.castlePendingLevel !== null &&
    base.castleUpgradeCompletesAt !== null &&
    base.castleUpgradeCompletesAt <= now;
  const nextCastleLevel = castleUpgradeFinished
    ? base.castlePendingLevel ?? base.castleLevel
    : base.castleLevel;
  const upgradeAt = base.upgradeCompletesAt?.getTime();
  const boundaries = new Set<number>([accrualStart.getTime(), now.getTime()]);
  if (upgradeAt !== undefined && upgradeAt > accrualStart.getTime() && upgradeAt < now.getTime()) {
    boundaries.add(upgradeAt);
  }
  for (const building of buildings) {
    for (const date of [building.completedAt, building.completesAt]) {
      const timestamp = date?.getTime();
      if (timestamp !== undefined && timestamp > accrualStart.getTime() && timestamp < now.getTime()) {
        boundaries.add(timestamp);
      }
    }
  }
  if (
    pendingProductionResearch &&
    pendingProductionResearch.completesAt.getTime() > accrualStart.getTime() &&
    pendingProductionResearch.completesAt.getTime() < now.getTime()
  ) {
    boundaries.add(pendingProductionResearch.completesAt.getTime());
  }
  const timeline = [...boundaries].sort((left, right) => left - right);
  let wood = base.wood;
  let stone = base.stone;
  let food = base.food;
  let woodRemainder = base.woodRemainder;
  let stoneRemainder = base.stoneRemainder;
  let foodRemainder = base.foodRemainder;

  for (let index = 0; index < timeline.length - 1; index++) {
    const start = timeline[index];
    const end = timeline[index + 1];
    const midpoint = start + (end - start) / 2;
    const factoryLevel = base.factoryLevel +
      (base.upgradeType === "FACTORY" && upgradeAt !== undefined && midpoint >= upgradeAt ? 1 : 0);
    const warehouseLevel = base.warehouseLevel +
      (base.upgradeType === "WAREHOUSE" && upgradeAt !== undefined && midpoint >= upgradeAt ? 1 : 0) +
      buildingLevelSumAt(buildings, "WAREHOUSE", midpoint);
    const activeProductionLevel = pendingProductionResearch && midpoint >= pendingProductionResearch.completesAt.getTime()
      ? pendingProductionResearch.level
      : productionResearchLevel;
    const productionMultiplier = 1 + activeProductionLevel * 0.1;
    const capacity = warehouseLevel * WORLD_RESOURCE_CAP_PER_WAREHOUSE_LEVEL;
    wood = Math.min(wood, capacity);
    stone = Math.min(stone, capacity);
    food = Math.min(food, capacity);
    const hours = (end - start) / 3_600_000;
    const woodRate = (productionFor(factoryLevel, "wood") + buildingProductionAt(buildings, midpoint, "wood")) * productionMultiplier;
    const stoneRate = (productionFor(factoryLevel, "stone") + buildingProductionAt(buildings, midpoint, "stone")) * productionMultiplier;
    const foodRate = buildingProductionAt(buildings, midpoint, "food") * productionMultiplier;
    if (wood < capacity) {
      const total = woodRemainder + hours * woodRate;
      wood += Math.floor(total);
      woodRemainder = total - Math.floor(total);
    }
    if (stone < capacity) {
      const total = stoneRemainder + hours * stoneRate;
      stone += Math.floor(total);
      stoneRemainder = total - Math.floor(total);
    }
    if (food < capacity) {
      const total = foodRemainder + hours * foodRate;
      food += Math.floor(total);
      foodRemainder = total - Math.floor(total);
    }
    wood = Math.min(wood, capacity);
    stone = Math.min(stone, capacity);
    food = Math.min(food, capacity);
    if (wood >= capacity) woodRemainder = 0;
    if (stone >= capacity) stoneRemainder = 0;
    if (food >= capacity) foodRemainder = 0;
  }

  const finalCapacity = worldResourceCapacity(nextWarehouseLevel, buildings, now.getTime());
  const finalWood = Math.floor(Math.min(finalCapacity, wood));
  const finalStone = Math.floor(Math.min(finalCapacity, stone));
  const finalFood = Math.floor(Math.min(finalCapacity, food));
  woodRemainder = finalWood >= finalCapacity ? 0 : Math.min(0.999_999_999, wood - finalWood);
  stoneRemainder = finalStone >= finalCapacity ? 0 : Math.min(0.999_999_999, stone - finalStone);
  foodRemainder = finalFood >= finalCapacity ? 0 : Math.min(0.999_999_999, food - finalFood);

  return {
    wood: finalWood,
    woodRemainder,
    stone: finalStone,
    stoneRemainder,
    food: finalFood,
    foodRemainder,
    factoryLevel: nextFactoryLevel,
    warehouseLevel: nextWarehouseLevel,
    castleLevel: nextCastleLevel,
    castlePendingLevel: castleUpgradeFinished ? null : base.castlePendingLevel,
    castleUpgradeCompletesAt: castleUpgradeFinished ? null : base.castleUpgradeCompletesAt,
    upgradeType: upgradeFinished ? null : base.upgradeType,
    upgradeCompletesAt: upgradeFinished ? null : base.upgradeCompletesAt,
    lastSimulatedAt: now,
    elapsedSeconds: Math.floor(elapsedMs / 1000),
    producedWood: finalWood - base.wood,
    producedStone: finalStone - base.stone,
    producedFood: finalFood - base.food,
    cappedOfflineTime: rawElapsedMs > WORLD_OFFLINE_CAP_MS,
  };
}

async function ensureBase(userId: string, now: Date) {
  const current = await prisma.worldBase.findUnique({ where: { userId } });
  if (current && current.coordinateX !== null && current.coordinateZ !== null) return current;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const base = await tx.worldBase.findUnique({ where: { userId } });
        if (base && base.coordinateX !== null && base.coordinateZ !== null) return base;

        const [coordinateX, coordinateZ] = await reserveRandomWorldCoordinates(tx, now);

        if (!base) {
          return tx.worldBase.create({
            data: { userId, lastSimulatedAt: now, coordinateX, coordinateZ },
          });
        }

        const assigned = await tx.worldBase.updateMany({
          where: { id: base.id, OR: [{ coordinateX: null }, { coordinateZ: null }] },
          data: { coordinateX, coordinateZ },
        });
        if (!assigned.count) return tx.worldBase.findUniqueOrThrow({ where: { userId } });
        return tx.worldBase.findUniqueOrThrow({ where: { userId } });
      });
    } catch (error) {
      const retryable =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2002" || error.code === "P2034");
      if (!retryable || attempt === 4) throw error;
    }
  }
  throw new Error(`Could not assign world coordinates to user ${userId}.`);
}

function findRandomAvailableCoordinates(
  occupied: Array<{ coordinateX: number | null; coordinateZ: number | null }>,
) {
  let extent = INITIAL_COORDINATE_EXTENT_METERS;
  for (let expansion = 0; expansion < 25; expansion += 1) {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const coordinateX = randomInt(-extent, extent + 1);
      const coordinateZ = randomInt(-extent, extent + 1);
      const spacedFromEveryBase = occupied.every((base) => {
        if (base.coordinateX === null || base.coordinateZ === null) return true;
        const dx = coordinateX - base.coordinateX;
        const dz = coordinateZ - base.coordinateZ;
        return Math.hypot(dx, dz) >= WORLD_MIN_TERRITORY_DISTANCE_METERS;
      });
      if (spacedFromEveryBase) return [coordinateX, coordinateZ] as const;
    }
    if (extent >= MAX_COORDINATE_EXTENT_METERS) break;
    extent = Math.min(MAX_COORDINATE_EXTENT_METERS, extent * 2);
  }
  throw new Error("Unable to find an unoccupied world coordinate at least 10 km from every other base.");
}

async function worldResearchLevel(
  client: Pick<Prisma.TransactionClient, "worldResearch">,
  baseId: string,
  researchKey: WorldResearchKey,
) {
  const research = await client.worldResearch.findUnique({
    where: { baseId_researchKey: { baseId, researchKey } },
    select: { level: true },
  });
  return research?.level ?? 0;
}

function pendingProductionResearch(
  base: Pick<WorldBaseState, "activeResearchKey" | "activeResearchLevel" | "researchCompletesAt">,
) {
  return base.activeResearchKey === "PRODUCTION_EFFICIENCY" &&
    base.activeResearchLevel !== null &&
    base.researchCompletesAt
    ? { level: base.activeResearchLevel, completesAt: base.researchCompletesAt }
    : null;
}

async function advanceWorld(userId: string, now: Date) {
  await ensureBase(userId, now);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const base = await prisma.worldBase.findUniqueOrThrow({ where: { userId } });
    const buildings = await prisma.worldBuilding.findMany({
      where: { baseId: base.id },
      select: {
        buildingType: true,
        level: true,
        pendingLevel: true,
        completedAt: true,
        completesAt: true,
      },
    });
    const productionResearchLevel = await worldResearchLevel(prisma, base.id, "PRODUCTION_EFFICIENCY");
    const progress = calculateWorldProgress(
      base,
      now,
      buildings,
      productionResearchLevel,
      pendingProductionResearch(base),
    );
    const updated = await prisma.worldBase.updateMany({
      where: { id: base.id, version: base.version },
      data: {
        wood: progress.wood,
        woodRemainder: progress.woodRemainder,
        stone: progress.stone,
        stoneRemainder: progress.stoneRemainder,
        food: progress.food,
        foodRemainder: progress.foodRemainder,
        factoryLevel: progress.factoryLevel,
        warehouseLevel: progress.warehouseLevel,
        castleLevel: progress.castleLevel,
        castlePendingLevel: progress.castlePendingLevel,
        castleUpgradeCompletesAt: progress.castleUpgradeCompletesAt,
        upgradeType: progress.upgradeType,
        upgradeCompletesAt: progress.upgradeCompletesAt,
        lastSimulatedAt: now,
        version: { increment: 1 },
      },
    });
    if (updated.count === 1) return { ...progress, version: base.version + 1 };
  }

  throw new Error(`Could not advance world state for user ${userId} after concurrent updates.`);
}

function utcDayStart(now: Date, offsetDays: number) {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() + offsetDays);
  return start;
}

async function ensureDailyWorldEvents(now: Date) {
  await prisma.$transaction(async (tx) => {
    for (const offset of [-1, 0, 1]) {
      const startsAt = utcDayStart(now, offset);
      const endsAt = new Date(startsAt.getTime() + 24 * 60 * 60 * 1000);
      const day = startsAt.toISOString().slice(0, 10);
      const slug = `resource-rush-${day}`;
      const event = await tx.worldEvent.upsert({
        where: { slug },
        create: {
          slug,
          title: "Ngày hội thu thập tài nguyên",
          description: "Góp 10 gỗ mỗi lượt để tăng điểm. Ba vị trí đầu nhận thưởng tài nguyên.",
          startsAt,
          endsAt,
        },
        update: {},
        select: { id: true, endsAt: true },
      });
      await tx.worldJob.upsert({
        where: { uniqueKey: `settle:${slug}` },
        create: {
          uniqueKey: `settle:${slug}`,
          eventId: event.id,
          runAt: event.endsAt,
        },
        update: {},
      });
    }
  });
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 1_000) : "Unknown world job error";
}

async function processWorldTraining(now: Date) {
  const completedQueues = await prisma.worldBase.findMany({
    where: {
      trainingCompletesAt: { lte: now },
      trainingType: { not: null },
      activePvpAttackId: null,
    },
    take: 100,
    select: {
      id: true,
      trainingType: true,
      trainingCount: true,
      trainingCompletesAt: true,
    },
  });
  let completed = 0;

  for (const queue of completedQueues) {
    const troopField =
      queue.trainingType === "INFANTRY"
        ? "infantry"
        : queue.trainingType === "ARCHERS"
          ? "archers"
          : queue.trainingType === "CAVALRY"
            ? "cavalry"
            : null;
    if (!troopField || !queue.trainingCompletesAt) {
      console.error("World training queue has an invalid troop type.", {
        baseId: queue.id,
        trainingType: queue.trainingType,
      });
      continue;
    }

    const result = await prisma.worldBase.updateMany({
      where: {
        id: queue.id,
        trainingType: queue.trainingType,
        trainingCompletesAt: queue.trainingCompletesAt,
        activePvpAttackId: null,
      },
      data: {
        [troopField]: { increment: queue.trainingCount },
        trainingType: null,
        trainingCount: 0,
        trainingCompletesAt: null,
        version: { increment: 1 },
      },
    });
    completed += result.count;
  }
  return completed;
}

function calculateCasualties(infantry: number, archers: number, cavalry: number) {
  return calculateCasualtiesAtRate(infantry, archers, cavalry, 0.1);
}

function calculateCasualtiesAtRate(
  infantry: number,
  archers: number,
  cavalry: number,
  rate: number,
) {
  const total = infantry + archers + cavalry;
  if (!total) return { infantry: 0, archers: 0, cavalry: 0, total: 0 };
  const types = [
    { key: "infantry" as const, count: infantry },
    { key: "archers" as const, count: archers },
    { key: "cavalry" as const, count: cavalry },
  ];
  const casualties = { infantry: 0, archers: 0, cavalry: 0 };
  const fractions = types.map(({ key, count }) => {
    const exact = count * rate;
    casualties[key] = Math.floor(exact);
    return { key, fraction: exact % 1, count };
  });
  let remaining = Math.ceil(total * rate) - casualties.infantry - casualties.archers - casualties.cavalry;
  fractions.sort((left, right) => right.fraction - left.fraction || right.count - left.count);
  for (const entry of fractions) {
    if (!remaining) break;
    if (casualties[entry.key] < entry.count) {
      casualties[entry.key] += 1;
      remaining -= 1;
    }
  }
  return { ...casualties, total: casualties.infantry + casualties.archers + casualties.cavalry };
}

type ArmyComposition = { infantry: number; archers: number; cavalry: number };
type TroopType = keyof ArmyComposition;

const TROOP_COUNTERS: Record<TroopType, TroopType> = {
  infantry: "cavalry",
  cavalry: "archers",
  archers: "infantry",
};
const TROOP_POWER: Record<TroopType, number> = {
  infantry: TROOP_STATS.INFANTRY.damage,
  archers: TROOP_STATS.ARCHERS.damage,
  cavalry: TROOP_STATS.CAVALRY.damage,
};

function calculateCounterPower(army: ArmyComposition, opposingArmy: ArmyComposition) {
  const opposingTotal = opposingArmy.infantry + opposingArmy.archers + opposingArmy.cavalry;
  return Math.round(
    (["infantry", "archers", "cavalry"] as const).reduce((total, type) => {
      const count = army[type];
      if (!count) return total;
      const matchupMultiplier =
        opposingTotal === 0
          ? 1
          : (["infantry", "archers", "cavalry"] as const).reduce((multiplier, opposingType) => {
              const relation =
                TROOP_COUNTERS[type] === opposingType
                  ? 1.5
                  : TROOP_COUNTERS[opposingType] === type
                    ? 0.75
                    : 1;
              return multiplier + opposingArmy[opposingType] * relation / opposingTotal;
            }, 0);
      return total + count * TROOP_POWER[type] * matchupMultiplier;
    }, 0),
  );
}

async function reserveRandomWorldCoordinates(transaction: Prisma.TransactionClient, now: Date) {
  await transaction.worldMapAllocator.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: { revision: { increment: 1 } },
  });
  const [occupiedBases, occupiedTerritories] = await Promise.all([
    transaction.worldBase.findMany({
      where: { coordinateX: { not: null }, coordinateZ: { not: null } },
      select: { coordinateX: true, coordinateZ: true },
    }),
    transaction.worldBaseOccupation.findMany({
      where: { status: "ACTIVE", endsAt: { gt: now } },
      select: { coordinateX: true, coordinateZ: true },
    }),
  ]);
  return findRandomAvailableCoordinates([...occupiedBases, ...occupiedTerritories]);
}

async function processWorldBaseAttacks(now: Date) {
  await prisma.worldBaseOccupation.updateMany({
    where: { status: "ACTIVE", endsAt: { lte: now } },
    data: { status: "EXPIRED" },
  });
  const dueAttacks = await prisma.worldBaseAttack.findMany({
    where: { status: "IN_TRANSIT", arrivesAt: { lte: now } },
    orderBy: { arrivesAt: "asc" },
    take: 100,
    select: { id: true, attackerUserId: true, defenderUserId: true },
  });
  let resolved = 0;
  let failed = 0;
  const changedUserIds = new Set<string>();

  for (const { id, attackerUserId, defenderUserId } of dueAttacks) {
    try {
      const didResolve = await prisma.$transaction(async (tx) => {
        const claimed = await tx.worldBaseAttack.updateMany({
          where: { id, status: "IN_TRANSIT", arrivesAt: { lte: now } },
          data: { status: "RESOLVING" },
        });
        if (!claimed.count) return false;

        const attack = await tx.worldBaseAttack.findUniqueOrThrow({ where: { id } });
        const [attackerBase, defenderBase, attackerBuildings, defenderBuildings] = await Promise.all([
          tx.worldBase.findUnique({ where: { userId: attack.attackerUserId } }),
          tx.worldBase.findUnique({ where: { userId: attack.defenderUserId } }),
          tx.worldBuilding.findMany({
            where: { base: { userId: attack.attackerUserId } },
            select: {
              buildingType: true,
              level: true,
              pendingLevel: true,
              completedAt: true,
              completesAt: true,
            },
          }),
          tx.worldBuilding.findMany({
            where: { base: { userId: attack.defenderUserId } },
            select: {
              buildingType: true,
              level: true,
              pendingLevel: true,
              completedAt: true,
              completesAt: true,
            },
          }),
        ]);
        if (!attackerBase || !defenderBase) {
          throw new Error(`Base attack ${id} references a missing player base.`);
        }
        const [attackerProductionLevel, defenderProductionLevel] = await Promise.all([
          worldResearchLevel(tx, attackerBase.id, "PRODUCTION_EFFICIENCY"),
          worldResearchLevel(tx, defenderBase.id, "PRODUCTION_EFFICIENCY"),
        ]);
        if (
          defenderBase.coordinateX === null ||
          defenderBase.coordinateZ === null ||
          attackerBase.activePvpAttackId !== id ||
          defenderBase.activePvpAttackId !== id
        ) {
          throw new Error(`Base attack ${id} lost its coordinate or combat lock.`);
        }

        const attackingArmy = {
          infantry: attack.infantry,
          archers: attack.archers,
          cavalry: attack.cavalry,
        };
        const defendingArmy = {
          infantry: defenderBase.infantry,
          archers: defenderBase.archers,
          cavalry: defenderBase.cavalry,
        };
        const attackerPower = Math.floor(
          calculateCounterPower(attackingArmy, defendingArmy) * (1 + attack.attackerTroopTier * 0.25),
        );
        const defenderPower = Math.floor(
          calculateCounterPower(defendingArmy, attackingArmy) * (1 + attack.defenderTroopTier * 0.25),
        );
        const attackerWins = attackerPower > defenderPower;
        const attackerLosses = calculateCasualtiesAtRate(
          attack.infantry,
          attack.archers,
          attack.cavalry,
          attackerWins ? 0.1 : 0.5,
        );
        const defenderLosses = attackerWins
          ? {
              infantry: defenderBase.infantry,
              archers: defenderBase.archers,
              cavalry: defenderBase.cavalry,
              total: defenderBase.infantry + defenderBase.archers + defenderBase.cavalry,
            }
          : calculateCasualtiesAtRate(
              defenderBase.infantry,
              defenderBase.archers,
              defenderBase.cavalry,
              0.1,
            );
        const attackerProgress = calculateWorldProgress(
          attackerBase,
          now,
          attackerBuildings,
          attackerProductionLevel,
          pendingProductionResearch(attackerBase),
        );
        const defenderProgress = calculateWorldProgress(
          defenderBase,
          now,
          defenderBuildings,
          defenderProductionLevel,
          pendingProductionResearch(defenderBase),
        );
        const attackerCapacity = worldResourceCapacity(
          attackerProgress.warehouseLevel,
          attackerBuildings,
          now.getTime(),
        );
        const stolenWood = attackerWins
          ? Math.min(
              Math.floor(defenderProgress.wood * BASE_ATTACK_LOOT_RATE),
              Math.max(0, attackerCapacity - attackerProgress.wood),
            )
          : 0;
        const stolenStone = attackerWins
          ? Math.min(
              Math.floor(defenderProgress.stone * BASE_ATTACK_LOOT_RATE),
              Math.max(0, attackerCapacity - attackerProgress.stone),
            )
          : 0;
        let newDefenderCoordinates: readonly [number, number] | null = null;

        if (attackerWins) {
          await tx.worldBuilding.deleteMany({ where: { baseId: defenderBase.id } });
          await tx.worldResearch.deleteMany({ where: { baseId: defenderBase.id } });
          await tx.worldMarch.updateMany({
            where: {
              userId: attack.defenderUserId,
              status: { in: ["IN_TRANSIT", "RESOLVING", "RETURNING"] },
            },
            data: { status: "CANCELED", returnsAt: null },
          });
          await tx.worldBaseOccupation.create({
            data: {
              attackId: id,
              controllerUserId: attack.attackerUserId,
              formerOwnerUserId: attack.defenderUserId,
              coordinateX: defenderBase.coordinateX,
              coordinateZ: defenderBase.coordinateZ,
              startsAt: now,
              endsAt: new Date(now.getTime() + BASE_OCCUPATION_DURATION_MS),
            },
          });
          newDefenderCoordinates = requireWorldCoordinates(
            await reserveRandomWorldCoordinates(tx, now),
            id,
          );
        }
        const replacementCoordinates = attackerWins
          ? requireWorldCoordinates(newDefenderCoordinates, id)
          : ([defenderBase.coordinateX, defenderBase.coordinateZ] as const);

        const attackerTroopsAfterReturn = {
          infantry: Math.min(
            MAX_TROOPS_PER_TYPE,
            attackerBase.infantry + attack.infantry - attackerLosses.infantry,
          ),
          archers: Math.min(
            MAX_TROOPS_PER_TYPE,
            attackerBase.archers + attack.archers - attackerLosses.archers,
          ),
          cavalry: Math.min(
            MAX_TROOPS_PER_TYPE,
            attackerBase.cavalry + attack.cavalry - attackerLosses.cavalry,
          ),
        };
        const attackerUpdated = await tx.worldBase.updateMany({
          where: { id: attackerBase.id, version: attackerBase.version, activePvpAttackId: id },
          data: {
            wood: Math.min(attackerCapacity, attackerProgress.wood + stolenWood),
            woodRemainder:
              attackerProgress.wood + stolenWood >= attackerCapacity ? 0 : attackerProgress.woodRemainder,
            stone: Math.min(attackerCapacity, attackerProgress.stone + stolenStone),
            stoneRemainder:
              attackerProgress.stone + stolenStone >= attackerCapacity ? 0 : attackerProgress.stoneRemainder,
            food: attackerProgress.food,
            foodRemainder: attackerProgress.foodRemainder,
            factoryLevel: attackerProgress.factoryLevel,
            warehouseLevel: attackerProgress.warehouseLevel,
            castleLevel: attackerProgress.castleLevel,
            castlePendingLevel: attackerProgress.castlePendingLevel,
            castleUpgradeCompletesAt: attackerProgress.castleUpgradeCompletesAt,
            upgradeType: attackerProgress.upgradeType,
            upgradeCompletesAt: attackerProgress.upgradeCompletesAt,
            infantry: attackerTroopsAfterReturn.infantry,
            archers: attackerTroopsAfterReturn.archers,
            cavalry: attackerTroopsAfterReturn.cavalry,
            activePvpAttackId: null,
            lastSimulatedAt: now,
            version: { increment: 1 },
          },
        });
        if (!attackerUpdated.count) throw new Error(`Could not settle attacking base for attack ${id}.`);

        const defenderData = attackerWins
          ? {
              wood: 350,
              woodRemainder: 0,
              stone: 250,
              stoneRemainder: 0,
              food: 0,
              foodRemainder: 0,
              factoryLevel: 0,
              warehouseLevel: 1,
              castleLevel: 1,
              castlePendingLevel: null,
              castleUpgradeCompletesAt: null,
              activeResearchKey: null,
              activeResearchLevel: null,
              researchCompletesAt: null,
              upgradeType: null,
              upgradeCompletesAt: null,
              infantry: 0,
              archers: 0,
              cavalry: 0,
              trainingType: null,
              trainingCount: 0,
              trainingCompletesAt: null,
              marchActive: false,
              coordinateX: replacementCoordinates[0],
              coordinateZ: replacementCoordinates[1],
            }
          : {
              wood: defenderProgress.wood,
              woodRemainder: defenderProgress.woodRemainder,
              stone: defenderProgress.stone,
              stoneRemainder: defenderProgress.stoneRemainder,
              food: defenderProgress.food,
              foodRemainder: defenderProgress.foodRemainder,
              factoryLevel: defenderProgress.factoryLevel,
              warehouseLevel: defenderProgress.warehouseLevel,
              castleLevel: defenderProgress.castleLevel,
              castlePendingLevel: defenderProgress.castlePendingLevel,
              castleUpgradeCompletesAt: defenderProgress.castleUpgradeCompletesAt,
              upgradeType: defenderProgress.upgradeType,
              upgradeCompletesAt: defenderProgress.upgradeCompletesAt,
              infantry: defenderBase.infantry - defenderLosses.infantry,
              archers: defenderBase.archers - defenderLosses.archers,
              cavalry: defenderBase.cavalry - defenderLosses.cavalry,
              marchActive: defenderBase.marchActive,
            };
        const defenderUpdated = await tx.worldBase.updateMany({
          where: { id: defenderBase.id, version: defenderBase.version, activePvpAttackId: id },
          data: {
            ...defenderData,
            activePvpAttackId: null,
            pvpShieldUntil: new Date(now.getTime() + BASE_ATTACK_SHIELD_MS),
            lastSimulatedAt: now,
            version: { increment: 1 },
          },
        });
        if (!defenderUpdated.count) throw new Error(`Could not settle defending base for attack ${id}.`);

        const completed = await tx.worldBaseAttack.updateMany({
          where: { id, status: "RESOLVING" },
          data: {
            status: "RESOLVED",
            attackerPower,
            defenderPower,
            winnerUserId: attackerWins ? attack.attackerUserId : attack.defenderUserId,
            stolenWood,
            stolenStone,
            attackerCasualties: attackerLosses.total,
            defenderCasualties: defenderLosses.total,
            resolvedAt: now,
          },
        });
        if (!completed.count) throw new Error(`Could not complete base attack ${id}.`);
        return true;
      });
      if (didResolve) {
        resolved += 1;
        // Both sides change publicly (activeAttack, shield, castle level).
        changedUserIds.add(attackerUserId);
        changedUserIds.add(defenderUserId);
      }
    } catch (error) {
      failed += 1;
      console.error("World base attack resolution failed.", {
        attackId: id,
        error: errorText(error),
      });
    }
  }
  return { resolved, failed, changedUserIds: [...changedUserIds] };
}

async function processWorldMarches(now: Date) {
  const arriving = await prisma.worldMarch.findMany({
    where: { status: "IN_TRANSIT", arrivesAt: { lte: now } },
    orderBy: { arrivesAt: "asc" },
    take: 100,
    select: { id: true },
  });
  let impacted = 0;

  for (const { id } of arriving) {
    const didImpact = await prisma.$transaction(async (tx) => {
      const march = await tx.worldMarch.findUnique({ where: { id } });
      if (!march || march.status !== "IN_TRANSIT" || march.arrivesAt > now) return false;
      const claimed = await tx.worldMarch.updateMany({
        where: { id, status: "IN_TRANSIT", arrivesAt: { lte: now } },
        data: { status: "RESOLVING" },
      });
      if (!claimed.count) return false;

      const event = await tx.worldEvent.findUnique({ where: { id: march.eventId } });
      if (!event) throw new Error(`March ${id} references a missing world event.`);
      let damage = 0;
      let casualties = { infantry: 0, archers: 0, cavalry: 0, total: 0 };
      if (
        event.eventType === "WORLD_BOSS" &&
        event.status !== "CANCELED" &&
        event.status !== "COMPLETED" &&
        event.endsAt > now &&
        event.bossHpRemaining > 0
      ) {
        const potentialDamage = Math.floor(
          (
            march.infantry * TROOP_STATS.INFANTRY.damage +
            march.archers * TROOP_STATS.ARCHERS.damage +
            march.cavalry * TROOP_STATS.CAVALRY.damage
          ) * (1 + march.troopTier * 0.25),
        );
        const attemptedDamage = Math.min(event.bossHpRemaining, potentialDamage);
        const boss = await tx.worldEvent.updateMany({
          where: {
            id: event.id,
            bossHpRemaining: event.bossHpRemaining,
            status: { notIn: ["CANCELED", "COMPLETED"] },
          },
          data: { bossHpRemaining: { decrement: attemptedDamage } },
        });
        if (boss.count) {
          damage = attemptedDamage;
          casualties = calculateCasualties(march.infantry, march.archers, march.cavalry);
        }
        if (damage > 0) {
          await tx.worldEventParticipation.updateMany({
            where: { eventId: event.id, userId: march.userId },
            data: { score: { increment: damage } },
          });
        }
      }

      const returnsAt = new Date(now.getTime() + event.marchTravelSeconds * 1000);
      await tx.worldMarch.update({
        where: { id },
        data: {
          status: "RETURNING",
          damage,
          casualties: casualties.total,
          infantry: march.infantry - casualties.infantry,
          archers: march.archers - casualties.archers,
          cavalry: march.cavalry - casualties.cavalry,
          returnsAt,
        },
      });

      if (event.eventType === "WORLD_BOSS" && damage > 0) {
        const remaining = await tx.worldEvent.findUniqueOrThrow({
          where: { id: event.id },
          select: { bossHpRemaining: true },
        });
        if (remaining.bossHpRemaining <= 0) {
          await tx.worldEvent.updateMany({
            where: { id: event.id, status: { not: "CANCELED" } },
            data: { bossHpRemaining: 0, status: "COMPLETED" },
          });
          await tx.worldJob.updateMany({
            where: { eventId: event.id, status: "PENDING" },
            data: { runAt: now },
          });
        }
      }
      return true;
    });
    if (didImpact) impacted += 1;
  }

  const returning = await prisma.worldMarch.findMany({
    where: { status: "RETURNING", returnsAt: { lte: now } },
    orderBy: { returnsAt: "asc" },
    take: 100,
    select: { id: true, userId: true, infantry: true, archers: true, cavalry: true },
  });
  let returned = 0;
  for (const march of returning) {
    const didReturn = await prisma.$transaction(async (tx) => {
      const claimed = await tx.worldMarch.updateMany({
        where: { id: march.id, status: "RETURNING", returnsAt: { lte: now } },
        data: { status: "RETURNED" },
      });
      if (!claimed.count) return false;
      const base = await tx.worldBase.updateMany({
        where: { userId: march.userId, marchActive: true },
        data: {
          infantry: { increment: march.infantry },
          archers: { increment: march.archers },
          cavalry: { increment: march.cavalry },
          marchActive: false,
          version: { increment: 1 },
        },
      });
      if (!base.count) throw new Error(`Could not return troops for march ${march.id}.`);
      return true;
    });
    if (didReturn) returned += 1;
  }
  return { impacted, returned };
}

type WorldMapTroops = { infantry: number; archers: number; cavalry: number };
type WorldInventoryField = "wood" | "stone" | "iron" | "food" | "rare";

function mapTroopPower(troops: WorldMapTroops, tier = 0) {
  const basePower = troops.infantry * 10 + troops.archers * 15 + troops.cavalry * 20;
  return Math.floor(basePower * (1 + tier * 0.25));
}

function mapTroopTotal(troops: WorldMapTroops) {
  return troops.infantry + troops.archers + troops.cavalry;
}

function calculateTroopLosses(troops: WorldMapTroops, lossRate: number): WorldMapTroops {
  const losses = {
    infantry: Math.min(troops.infantry, Math.floor(troops.infantry * lossRate)),
    archers: Math.min(troops.archers, Math.floor(troops.archers * lossRate)),
    cavalry: Math.min(troops.cavalry, Math.floor(troops.cavalry * lossRate)),
  };
  if (lossRate > 0 && mapTroopTotal(losses) === 0 && mapTroopTotal(troops) > 0) {
    const largest = (Object.keys(troops) as Array<keyof WorldMapTroops>)
      .sort((left, right) => troops[right] - troops[left])[0];
    losses[largest] = 1;
  }
  return losses;
}

function survivingTroops(troops: WorldMapTroops, losses: WorldMapTroops): WorldMapTroops {
  return {
    infantry: troops.infantry - losses.infantry,
    archers: troops.archers - losses.archers,
    cavalry: troops.cavalry - losses.cavalry,
  };
}

async function returnWorldMapTroops(
  tx: Prisma.TransactionClient,
  userId: string,
  troops: WorldMapTroops,
) {
  if (mapTroopTotal(troops) === 0) return;
  const base = await tx.worldBase.findUniqueOrThrow({ where: { userId } });
  const returned = await tx.worldBase.updateMany({
    where: { id: base.id, version: base.version },
    data: {
      infantry: { increment: troops.infantry },
      archers: { increment: troops.archers },
      cavalry: { increment: troops.cavalry },
      version: { increment: 1 },
    },
  });
  if (!returned.count) throw new Error(`Could not return map troops to ${userId}.`);
}

async function hasActiveWorldMapMarch(tx: Prisma.TransactionClient, userId: string) {
  return Boolean(await tx.worldMapMarch.findFirst({
    where: { userId, status: { in: ["IN_TRANSIT", "RESOLVING", "RETURNING"] } },
    select: { id: true },
  }));
}

async function committedWorldMapTroops(
  tx: Pick<Prisma.TransactionClient, "worldResourceNode" | "worldMapMarch">,
  userId: string,
): Promise<WorldMapTroops> {
  const [garrisons, marches] = await Promise.all([
    tx.worldResourceNode.findMany({
      where: { ownerUserId: userId },
      select: { garrisonInfantry: true, garrisonArchers: true, garrisonCavalry: true },
    }),
    tx.worldMapMarch.findMany({
      where: { userId, status: { in: ["IN_TRANSIT", "RESOLVING", "RETURNING"] } },
      select: { infantry: true, archers: true, cavalry: true },
    }),
  ]);
  const total = { infantry: 0, archers: 0, cavalry: 0 };
  for (const garrison of garrisons) {
    total.infantry += garrison.garrisonInfantry;
    total.archers += garrison.garrisonArchers;
    total.cavalry += garrison.garrisonCavalry;
  }
  for (const march of marches) {
    total.infantry += march.infantry;
    total.archers += march.archers;
    total.cavalry += march.cavalry;
  }
  return total;
}

function inventoryFieldFor(resourceType: string): WorldInventoryField {
  switch (resourceType) {
    case "FOREST": return "wood";
    case "STONE_DEPOSIT": return "stone";
    case "IRON_MINE": return "iron";
    case "FOOD_LAND": return "food";
    case "RARE_RESOURCE": return "rare";
    default: throw new Error(`Unknown world resource type ${resourceType}.`);
  }
}

async function ensureWorldMapObjects() {
  await Promise.all([
    ...RESOURCE_NODES.map((node) =>
      prisma.worldResourceNode.upsert({
        where: { id: node.id },
        create: {
          id: node.id,
          resourceType: node.resource,
          level: node.level,
          maxAmount: node.amount,
          remaining: node.amount,
          yieldPerMinute: node.yieldPerMinute,
          requiredPower: node.requiredPower,
          x: node.x,
          z: node.z,
        },
        update: {},
      }),
    ),
    ...ROGUE_CAMPS.map((camp) =>
      prisma.worldRogueCamp.upsert({
        where: { id: camp.id },
        create: {
          id: camp.id,
          monsterType: camp.monsterType,
          tier: camp.tier,
          level: camp.level,
          troopCount: camp.troopCount,
          combatPower: camp.combatPower,
          x: camp.x,
          z: camp.z,
        },
        update: {},
      }),
    ),
  ]);
}

async function resourceCapacityForBase(
  tx: Prisma.TransactionClient,
  base: { warehouseLevel: number; id: string },
  now: Date,
) {
  const buildings = await tx.worldBuilding.findMany({
    where: { baseId: base.id },
    select: { buildingType: true, level: true, pendingLevel: true, completedAt: true, completesAt: true },
  });
  return worldResourceCapacity(base.warehouseLevel, buildings, now.getTime());
}

async function collectResourceNode(
  tx: Prisma.TransactionClient,
  node: {
    id: string;
    resourceType: string;
    remaining: number;
    yieldPerMinute: number;
    ownerUserId: string | null;
    occupiedAt: Date | null;
    occupiedUntil: Date | null;
    lastCollectedAt: Date | null;
    respawnsAt: Date | null;
    garrisonInfantry: number;
    garrisonArchers: number;
    garrisonCavalry: number;
    garrisonTier: number;
    version: number;
  },
  base: Awaited<ReturnType<typeof prisma.worldBase.findUniqueOrThrow>>,
  now: Date,
  harvestUntil: Date,
  releaseGarrison: boolean,
) {
  if (!node.ownerUserId) throw new WorldActionError("Khu tài nguyên hiện không có chủ sở hữu.", 409);
  const startedAt = node.lastCollectedAt ?? node.occupiedAt ?? harvestUntil;
  const elapsedMs = Math.max(0, harvestUntil.getTime() - startedAt.getTime());
  const generated = Math.min(node.remaining, Math.floor(elapsedMs / 60_000 * node.yieldPerMinute));
  const field = inventoryFieldFor(node.resourceType);
  const capacity = await resourceCapacityForBase(tx, base, now);
  const granted = Math.min(generated, Math.max(0, capacity - base[field]));
  const remaining = node.remaining - generated;
  const depleted = remaining === 0;
  const shouldRelease = releaseGarrison || depleted;
  const updateNode = await tx.worldResourceNode.updateMany({
    where: { id: node.id, version: node.version, ownerUserId: node.ownerUserId },
    data: {
      remaining,
      lastCollectedAt: shouldRelease || generated > 0 ? harvestUntil : startedAt,
      ownerUserId: shouldRelease ? null : node.ownerUserId,
      occupiedAt: shouldRelease ? null : node.occupiedAt,
      occupiedUntil: shouldRelease ? null : node.occupiedUntil,
      garrisonInfantry: shouldRelease ? 0 : node.garrisonInfantry,
      garrisonArchers: shouldRelease ? 0 : node.garrisonArchers,
      garrisonCavalry: shouldRelease ? 0 : node.garrisonCavalry,
      garrisonTier: shouldRelease ? 0 : node.garrisonTier,
      respawnsAt: depleted ? new Date(harvestUntil.getTime() + RESOURCE_NODE_RESPAWN_MS) : node.respawnsAt,
      version: { increment: 1 },
    },
  });
  if (!updateNode.count) throw new WorldActionError("Khu tài nguyên vừa thay đổi; hãy tải lại.", 409);

  const returnTroops = shouldRelease
    ? {
        infantry: node.garrisonInfantry,
        archers: node.garrisonArchers,
        cavalry: node.garrisonCavalry,
      }
    : { infantry: 0, archers: 0, cavalry: 0 };
  if (granted > 0 || mapTroopTotal(returnTroops) > 0) {
    const inventoryUpdate = {
      [field]: { increment: granted },
    } satisfies Prisma.WorldBaseUpdateManyMutationInput;
    const updateBase = await tx.worldBase.updateMany({
      where: { id: base.id, version: base.version },
      data: {
        ...(granted > 0 ? inventoryUpdate : {}),
        infantry: { increment: returnTroops.infantry },
        archers: { increment: returnTroops.archers },
        cavalry: { increment: returnTroops.cavalry },
        version: { increment: 1 },
      },
    });
    if (!updateBase.count) throw new Error(`Could not collect resource node ${node.id} for user ${node.ownerUserId}.`);
  }
  if (shouldRelease) {
    await tx.worldMapMarch.updateMany({
      where: { userId: node.ownerUserId, targetId: node.id, status: "GARRISONED" },
      data: {
        status: "COMPLETED",
        completedAt: now,
        report: depleted
          ? "Khu tài nguyên đã cạn; quân đồn trú trở về căn cứ."
          : "Thời hạn chiếm đóng kết thúc; quân đồn trú trở về căn cứ.",
      },
    });
  }

  return { generated, granted, remaining, released: shouldRelease, resourceName: field };
}

async function processWorldResourceNodeTimers(now: Date) {
  const expiredNodes = await prisma.worldResourceNode.findMany({
    where: { ownerUserId: { not: null }, occupiedUntil: { lte: now } },
    orderBy: { occupiedUntil: "asc" },
    take: 100,
  });
  let expired = 0;
  let failed = 0;
  const changedNodeIds = new Set<string>();
  for (const candidate of expiredNodes) {
    try {
      if (candidate.ownerUserId) await advanceWorld(candidate.ownerUserId, now);
      const didExpire = await prisma.$transaction(async (tx) => {
        const node = await tx.worldResourceNode.findUnique({ where: { id: candidate.id } });
        if (!node?.ownerUserId || !node.occupiedUntil || node.occupiedUntil > now) return false;
        const base = await tx.worldBase.findUniqueOrThrow({ where: { userId: node.ownerUserId } });
        await collectResourceNode(tx, node, base, now, node.occupiedUntil, true);
        return true;
      });
      if (didExpire) {
        expired += 1;
        changedNodeIds.add(candidate.id);
      }
    } catch (error) {
      failed += 1;
      console.error("World resource node expiry failed.", { nodeId: candidate.id, error: errorText(error) });
    }
  }

  const depletedNodes = await prisma.worldResourceNode.findMany({
    where: { ownerUserId: null, remaining: 0, respawnsAt: { lte: now } },
    take: 100,
  });
  let respawned = 0;
  for (const node of depletedNodes) {
    try {
      const result = await prisma.worldResourceNode.updateMany({
        where: { id: node.id, ownerUserId: null, remaining: 0, version: node.version, respawnsAt: { lte: now } },
        data: { remaining: node.maxAmount, respawnsAt: null, lastCollectedAt: null, version: { increment: 1 } },
      });
      if (result.count) {
        respawned += 1;
        changedNodeIds.add(node.id);
      }
    } catch (error) {
      failed += 1;
      console.error("World resource node respawn failed.", { nodeId: node.id, error: errorText(error) });
    }
  }
  return { expired, respawned, failed, changedNodeIds: [...changedNodeIds] };
}

function campReward(camp: Extract<WorldMapObject, { kind: "ROGUE_CAMP" }>) {
  const elite = camp.tier === "ELITE";
  return {
    wood: camp.level * 25,
    stone: camp.level * 15,
    iron: elite ? camp.level * 2 : camp.level,
    food: camp.level * 30,
    rare: elite ? 2 : 0,
    experience: camp.level * 100,
    itemKey: camp.rewardItemKey,
    itemCount: elite ? 2 : 1,
  };
}

async function grantCampReward(
  tx: Prisma.TransactionClient,
  base: Awaited<ReturnType<typeof prisma.worldBase.findUniqueOrThrow>>,
  camp: Extract<WorldMapObject, { kind: "ROGUE_CAMP" }>,
  now: Date,
) {
  const capacity = await resourceCapacityForBase(tx, base, now);
  const requested = campReward(camp);
  const reward = {
    wood: Math.min(requested.wood, Math.max(0, capacity - base.wood)),
    stone: Math.min(requested.stone, Math.max(0, capacity - base.stone)),
    iron: Math.min(requested.iron, Math.max(0, capacity - base.iron)),
    food: Math.min(requested.food, Math.max(0, capacity - base.food)),
    rare: Math.min(requested.rare, Math.max(0, capacity - base.rare)),
    experience: requested.experience,
    itemKey: requested.itemKey,
    itemCount: requested.itemCount,
  };
  const granted = await tx.worldBase.updateMany({
    where: { id: base.id, version: base.version },
    data: {
      wood: base.wood + reward.wood,
      stone: base.stone + reward.stone,
      iron: base.iron + reward.iron,
      food: base.food + reward.food,
      rare: base.rare + reward.rare,
      experience: { increment: reward.experience },
      version: { increment: 1 },
    },
  });
  if (!granted.count) throw new Error(`Could not grant rogue camp rewards to ${base.userId}.`);
  await tx.worldItemStack.upsert({
    where: { userId_itemKey: { userId: base.userId, itemKey: reward.itemKey } },
    create: { userId: base.userId, itemKey: reward.itemKey, quantity: reward.itemCount },
    update: { quantity: { increment: reward.itemCount } },
  });
  return reward;
}

async function processWorldMapMarches(now: Date) {
  const arriving = await prisma.worldMapMarch.findMany({
    where: { status: "IN_TRANSIT", arrivesAt: { lte: now } },
    orderBy: { arrivesAt: "asc" },
    take: 100,
    select: { id: true, userId: true, targetId: true, targetKind: true },
  });
  let resolved = 0;
  let failed = 0;
  const changedNodeIds = new Set<string>();

  for (const candidate of arriving) {
    try {
      await advanceWorld(candidate.userId, now);
      if (candidate.targetKind === "RESOURCE") {
        const currentNode = await prisma.worldResourceNode.findUnique({
          where: { id: candidate.targetId },
          select: { ownerUserId: true },
        });
        if (currentNode?.ownerUserId && currentNode.ownerUserId !== candidate.userId) {
          await advanceWorld(currentNode.ownerUserId, now);
        }
      }

      const didResolve = await prisma.$transaction(async (tx) => {
        const claimed = await tx.worldMapMarch.updateMany({
          where: { id: candidate.id, status: "IN_TRANSIT", arrivesAt: { lte: now } },
          data: { status: "RESOLVING" },
        });
        if (!claimed.count) return false;
        const march = await tx.worldMapMarch.findUniqueOrThrow({ where: { id: candidate.id } });
        const troops = {
          infantry: march.infantry,
          archers: march.archers,
          cavalry: march.cavalry,
        };
        const returnAt = new Date(now.getTime() + WORLD_MAP_TROOP_RETURN_MS);
        const setReturning = async (report: string, losses = { infantry: 0, archers: 0, cavalry: 0 }) => {
          const survivors = survivingTroops(troops, losses);
          await tx.worldMapMarch.update({
            where: { id: march.id },
            data: {
              status: "RETURNING",
              infantry: survivors.infantry,
              archers: survivors.archers,
              cavalry: survivors.cavalry,
              casualtiesInfantry: losses.infantry,
              casualtiesArchers: losses.archers,
              casualtiesCavalry: losses.cavalry,
              returnsAt: returnAt,
              report,
            },
          });
        };

        if (march.targetKind === "RESOURCE") {
          let node = await tx.worldResourceNode.findUnique({ where: { id: march.targetId } });
          if (node?.ownerUserId && node.ownerUserId !== march.userId) {
            const defenderBase = await tx.worldBase.findUniqueOrThrow({ where: { userId: node.ownerUserId } });
            await collectResourceNode(tx, node, defenderBase, now, now, false);
            node = await tx.worldResourceNode.findUnique({ where: { id: march.targetId } });
          }
          if (!node || node.remaining <= 0) {
            await setReturning("Khu tài nguyên đã cạn hoặc không còn tồn tại; quân đang trở về.");
            return true;
          }
          if (node.ownerUserId === march.userId) {
            await setReturning("Khu vực đã thuộc quyền kiểm soát của bạn; đạo quân trở về.");
            return true;
          }
          const count = await tx.worldResourceNode.count({
            where: { ownerUserId: march.userId, occupiedUntil: { gt: now } },
          });
          const contesting = node.ownerUserId !== null;
          if (!contesting && count >= MAX_RESOURCE_NODE_OCCUPANCY) {
            await setReturning(`Bạn đã đạt giới hạn ${MAX_RESOURCE_NODE_OCCUPANCY} khu tài nguyên; đạo quân trở về.`);
            return true;
          }

          const attackerPower = mapTroopPower(troops, march.troopTier);
          if (!contesting && attackerPower < node.requiredPower) {
            const losses = calculateTroopLosses(troops, 0.25);
            await setReturning(
              `Thất bại: cần chiến lực ${node.requiredPower}, đội quân có ${attackerPower}.`,
              losses,
            );
            return true;
          }

          let defenderSurvivors: WorldMapTroops | null = null;
          let defenderUserId: string | null = null;
          let attackerLosses = { infantry: 0, archers: 0, cavalry: 0 };
          let defenderLosses = { infantry: 0, archers: 0, cavalry: 0 };
          let attackerWins = true;
          if (contesting) {
            const defenders = {
              infantry: node.garrisonInfantry,
              archers: node.garrisonArchers,
              cavalry: node.garrisonCavalry,
            };
            const defenderPower = mapTroopPower(defenders, node.garrisonTier) + node.requiredPower;
            attackerWins = attackerPower >= defenderPower;
            const attackerLossRate = attackerWins
              ? Math.min(0.35, 0.1 + defenderPower / Math.max(1, attackerPower) * 0.15)
              : 0.4;
            const defenderLossRate = attackerWins
              ? 0.5
              : Math.min(0.3, attackerPower / Math.max(1, defenderPower) * 0.2);
            attackerLosses = calculateTroopLosses(troops, attackerLossRate);
            defenderLosses = calculateTroopLosses(defenders, defenderLossRate);
            defenderSurvivors = survivingTroops(defenders, defenderLosses);
            defenderUserId = node.ownerUserId;
            if (!attackerWins) {
              const defended = await tx.worldResourceNode.updateMany({
                where: { id: node.id, version: node.version, ownerUserId: defenderUserId },
                data: {
                  garrisonInfantry: defenderSurvivors.infantry,
                  garrisonArchers: defenderSurvivors.archers,
                  garrisonCavalry: defenderSurvivors.cavalry,
                  version: { increment: 1 },
                },
              });
              if (!defended.count) throw new Error(`Could not update garrison for resource node ${node.id}.`);
              if (defenderUserId) {
                await tx.worldMapMarch.create({
                  data: {
                    userId: defenderUserId,
                    targetId: node.id,
                    targetKind: "RESOURCE",
                    actionType: "DEFEND",
                    infantry: defenders.infantry,
                    archers: defenders.archers,
                    cavalry: defenders.cavalry,
                    casualtiesInfantry: defenderLosses.infantry,
                    casualtiesArchers: defenderLosses.archers,
                    casualtiesCavalry: defenderLosses.cavalry,
                    dispatchedAt: now,
                    arrivesAt: now,
                    completedAt: now,
                    status: "COMPLETED",
                    report: `Đã phòng thủ thành công khu tài nguyên. Quân địch có chiến lực ${attackerPower}; tổn thất của bạn: ${mapTroopTotal(defenderLosses)}.`,
                  },
                });
              }
              await setReturning(
                `Phòng thủ thất bại; đối thủ giữ khu vực. Quân còn sống đang trở về.`,
                attackerLosses,
              );
              return true;
            }
          }

                      const currentOwnerCount = count + (contesting ? 0 : 1);
          if (currentOwnerCount > MAX_RESOURCE_NODE_OCCUPANCY) {
            await setReturning("Không còn chỗ trong giới hạn chiếm đóng; đạo quân trở về.");
            return true;
          }
          const survivors = survivingTroops(troops, attackerLosses);
          const occupied = await tx.worldResourceNode.updateMany({
            where: { id: node.id, version: node.version },
            data: {
              ownerUserId: march.userId,
              occupiedAt: now,
              occupiedUntil: new Date(now.getTime() + RESOURCE_NODE_OCCUPATION_MS),
              lastCollectedAt: now,
              garrisonInfantry: survivors.infantry,
              garrisonArchers: survivors.archers,
              garrisonCavalry: survivors.cavalry,
              garrisonTier: march.troopTier,
              version: { increment: 1 },
            },
          });
          if (!occupied.count) throw new Error(`Could not occupy resource node ${node.id}.`);
          if (contesting && defenderUserId && defenderSurvivors) {
            await tx.worldMapMarch.updateMany({
              where: {
                userId: defenderUserId,
                targetId: node.id,
                status: "GARRISONED",
              },
              data: {
                status: "COMPLETED",
                completedAt: now,
                report: "Khu tài nguyên đã bị chiếm; quân đồn trú trở về căn cứ.",
              },
            });
            await returnWorldMapTroops(tx, defenderUserId, defenderSurvivors);
            await tx.worldMapMarch.create({
              data: {
                userId: defenderUserId,
                targetId: node.id,
                targetKind: "RESOURCE",
                actionType: "DEFEND",
                infantry: node.garrisonInfantry,
                archers: node.garrisonArchers,
                cavalry: node.garrisonCavalry,
                casualtiesInfantry: defenderLosses.infantry,
                casualtiesArchers: defenderLosses.archers,
                casualtiesCavalry: defenderLosses.cavalry,
                dispatchedAt: now,
                arrivesAt: now,
                completedAt: now,
                status: "COMPLETED",
                report: `Khu tài nguyên bị chiếm. Quân phòng thủ sống sót đã được điều về căn cứ; tổn thất ${mapTroopTotal(defenderLosses)}.`,
              },
            });
          }
          await tx.worldMapMarch.update({
            where: { id: march.id },
            data: {
              status: "GARRISONED",
              infantry: survivors.infantry,
              archers: survivors.archers,
              cavalry: survivors.cavalry,
              casualtiesInfantry: attackerLosses.infantry,
              casualtiesArchers: attackerLosses.archers,
              casualtiesCavalry: attackerLosses.cavalry,
              completedAt: now,
              report: `${contesting ? "Chiến thắng, bạn đã chiếm quyền kiểm soát." : "Chiếm đóng thành công."} Quân đồn trú tại đây trong tối đa 24 giờ.`,
            },
          });
          return true;
        }

        if (march.targetKind !== "ROGUE_CAMP") throw new Error(`Unknown map target kind ${march.targetKind}.`);
        const campState = await tx.worldRogueCamp.findUnique({ where: { id: march.targetId } });
        const campDefinition = resolveWorldMapObject(march.targetId);
        if (!campState || campDefinition?.kind !== "ROGUE_CAMP") {
          await setReturning("Không tìm thấy trại quái; đạo quân đang trở về.");
          return true;
        }
        if (campState.availableAt && campState.availableAt > now) {
          await setReturning(`Trại quái đã bị đánh bại; đạo quân trở về. Mở lại lúc ${campState.availableAt.toISOString()}.`);
          return true;
        }
        const attackerPower = mapTroopPower(troops, march.troopTier);
        const won = attackerPower >= campState.combatPower;
        const losses = calculateTroopLosses(troops, won ? 0.12 : 0.4);
        const survivors = survivingTroops(troops, losses);
        const respawnDelay = campDefinition.tier === "ELITE"
          ? ROGUE_CAMP_RESPAWN_MS.ELITE
          : ROGUE_CAMP_RESPAWN_MS.DEFAULT;
        const cooldown = await tx.worldRogueCamp.updateMany({
          where: {
            id: campState.id,
            version: campState.version,
            OR: [{ availableAt: null }, { availableAt: { lte: now } }],
          },
          data: {
            availableAt: new Date(now.getTime() + (won ? respawnDelay : 15 * 60_000)),
            lastDefeatedAt: won ? now : campState.lastDefeatedAt,
            version: { increment: 1 },
          },
        });
        if (!cooldown.count) {
          await setReturning("Một đạo quân khác đã giao chiến trước; kết quả không được lặp lại.");
          return true;
        }

        let reward: Awaited<ReturnType<typeof campReward>> | null = null;
        if (won) {
          const base = await tx.worldBase.findUniqueOrThrow({ where: { userId: march.userId } });
          reward = await grantCampReward(tx, base, campDefinition, now);
        }
        const rewardText = reward
          ? ` Thưởng máy chủ: ${reward.wood} gỗ, ${reward.stone} đá, ${reward.iron} sắt, ${reward.food} lương thực, ${reward.rare} hiếm, ${reward.experience} EXP và ${reward.itemCount} ${reward.itemKey}.`
          : "";
        await tx.worldMapMarch.update({
          where: { id: march.id },
          data: {
            status: "RETURNING",
            infantry: survivors.infantry,
            archers: survivors.archers,
            cavalry: survivors.cavalry,
            casualtiesInfantry: losses.infantry,
            casualtiesArchers: losses.archers,
            casualtiesCavalry: losses.cavalry,
            returnsAt: returnAt,
            report: `${won ? "Chiến thắng" : "Thất bại"} với chiến lực ${attackerPower}/${campState.combatPower}; mất ${mapTroopTotal(losses)} quân.${rewardText}`,
            ...(reward
              ? {
                  rewardWood: reward.wood,
                  rewardStone: reward.stone,
                  rewardIron: reward.iron,
                  rewardFood: reward.food,
                  rewardRare: reward.rare,
                  rewardExperience: reward.experience,
                  rewardItemKey: reward.itemKey,
                  rewardItemCount: reward.itemCount,
                }
              : {}),
          },
        });
        return true;
      });
      if (didResolve) {
        resolved += 1;
        // Both RESOURCE and ROGUE_CAMP targets are public map objects.
        changedNodeIds.add(candidate.targetId);
      }
    } catch (error) {
      failed += 1;
      console.error("World map march resolution failed.", {
        marchId: candidate.id,
        targetId: candidate.targetId,
        error: errorText(error),
      });
    }
  }
  return { resolved, failed, changedNodeIds: [...changedNodeIds] };
}

async function processWorldMapReturns(now: Date) {
  const returning = await prisma.worldMapMarch.findMany({
    where: { status: "RETURNING", returnsAt: { lte: now } },
    orderBy: { returnsAt: "asc" },
    take: 100,
  });
  let completed = 0;
  let failed = 0;
  for (const march of returning) {
    try {
      await advanceWorld(march.userId, now);
      const didComplete = await prisma.$transaction(async (tx) => {
        const claimed = await tx.worldMapMarch.updateMany({
          where: { id: march.id, status: "RETURNING", returnsAt: { lte: now } },
          data: { status: "COMPLETED", completedAt: now },
        });
        if (!claimed.count) return false;
        await returnWorldMapTroops(tx, march.userId, {
          infantry: march.infantry,
          archers: march.archers,
          cavalry: march.cavalry,
        });
        return true;
      });
      if (didComplete) completed += 1;
    } catch (error) {
      failed += 1;
      console.error("World map march return failed.", { marchId: march.id, error: errorText(error) });
    }
  }
  return { completed, failed };
}

async function processWorldMapOperations(now: Date) {
  await ensureWorldMapObjects();
  const timers = await processWorldResourceNodeTimers(now);
  const marches = await processWorldMapMarches(now);
  const returns = await processWorldMapReturns(now);
  return {
    ...timers,
    ...marches,
    ...returns,
    failed: timers.failed + marches.failed + returns.failed,
    changedNodeIds: [...new Set([...timers.changedNodeIds, ...marches.changedNodeIds])],
  };
}

async function processWorldResearch(now: Date) {
  const dueResearch = await prisma.worldBase.findMany({
    where: {
      activeResearchKey: { not: null },
      activeResearchLevel: { not: null },
      researchCompletesAt: { lte: now },
    },
    orderBy: { researchCompletesAt: "asc" },
    take: 100,
    select: {
      id: true,
      userId: true,
      activeResearchKey: true,
      activeResearchLevel: true,
      researchCompletesAt: true,
    },
  });
  let completed = 0;
  let failed = 0;

  for (const candidate of dueResearch) {
    try {
      if (!candidate.researchCompletesAt) {
        throw new Error(`Missing completion time for active research on base ${candidate.id}.`);
      }
      await advanceWorld(candidate.userId, now);
      const didComplete = await prisma.$transaction(async (tx) => {
        if (
          !candidate.activeResearchKey ||
          candidate.activeResearchLevel === null ||
          !isWorldResearchKey(candidate.activeResearchKey)
        ) {
          throw new Error(`Invalid active research state for base ${candidate.id}.`);
        }
        const base = await tx.worldBase.findUniqueOrThrow({ where: { id: candidate.id } });
        if (
          base.activeResearchKey !== candidate.activeResearchKey ||
          base.activeResearchLevel !== candidate.activeResearchLevel ||
          !base.researchCompletesAt ||
          base.researchCompletesAt > now
        ) {
          return false;
        }
        const cleared = await tx.worldBase.updateMany({
          where: {
            id: candidate.id,
            version: base.version,
            activeResearchKey: candidate.activeResearchKey,
            activeResearchLevel: candidate.activeResearchLevel,
            researchCompletesAt: { lte: now },
          },
          data: {
            activeResearchKey: null,
            activeResearchLevel: null,
            researchCompletesAt: null,
            version: { increment: 1 },
          },
        });
        if (!cleared.count) return false;
        await tx.worldResearch.upsert({
          where: {
            baseId_researchKey: {
              baseId: candidate.id,
              researchKey: candidate.activeResearchKey,
            },
          },
          create: {
            baseId: candidate.id,
            researchKey: candidate.activeResearchKey,
            level: candidate.activeResearchLevel,
          },
          update: { level: candidate.activeResearchLevel },
        });
        return true;
      });
      if (didComplete) completed += 1;
    } catch (error) {
      failed += 1;
      console.error("World research completion failed.", {
        baseId: candidate.id,
        researchKey: candidate.activeResearchKey,
        error: errorText(error),
      });
    }
  }
  return { completed, failed };
}

export async function processScheduledWorldJobs(now = new Date()) {
  await ensureDailyWorldEvents(now);
  const research = await processWorldResearch(now);
  const mapOperations = await processWorldMapOperations(now);
  const trained = await processWorldTraining(now);
  const marches = await processWorldMarches(now);
  const baseAttacks = await processWorldBaseAttacks(now);
  const staleBefore = new Date(now.getTime() - JOB_LOCK_TIMEOUT_MS);
  const dueJobs = await prisma.worldJob.findMany({
    where: {
      runAt: { lte: now },
      OR: [
        { status: "PENDING" },
        { status: "RUNNING", lockedAt: { lt: staleBefore } },
      ],
    },
    orderBy: { runAt: "asc" },
    take: 20,
    select: { id: true, eventId: true, attempts: true },
  });

  let processed = 0;
  let retried = 0;
  let failed = research.failed + mapOperations.failed;

  for (const candidate of dueJobs) {
    const claim = await prisma.worldJob.updateMany({
      where: {
        id: candidate.id,
        runAt: { lte: now },
        OR: [
          { status: "PENDING" },
          { status: "RUNNING", lockedAt: { lt: staleBefore } },
        ],
      },
      data: {
        status: "RUNNING",
        lockedAt: now,
        attempts: { increment: 1 },
        lastError: null,
      },
    });
    if (claim.count !== 1) continue;

    try {
      await prisma.$transaction(async (tx) => {
        const [job, event] = await Promise.all([
          tx.worldJob.findUniqueOrThrow({ where: { id: candidate.id } }),
          tx.worldEvent.findUniqueOrThrow({ where: { id: candidate.eventId } }),
        ]);
        if (job.status === "CANCELED" || event.status === "CANCELED") {
          await tx.worldJob.update({
            where: { id: candidate.id },
            data: { status: "CANCELED", lockedAt: null },
          });
          return;
        }
        if (job.status === "COMPLETED") {
          await tx.worldJob.update({
            where: { id: candidate.id },
            data: { status: "COMPLETED", completedAt: now, lockedAt: null },
          });
          return;
        }
        const bossDefeated = event.eventType === "WORLD_BOSS" && event.bossHpRemaining <= 0;
        if (event.endsAt > now && !bossDefeated) {
          throw new Error("Event settlement ran before its end time.");
        }

        const participants = await tx.worldEventParticipation.findMany({
          where: { eventId: event.id },
          orderBy: [{ score: "desc" }, { joinedAt: "asc" }, { id: "asc" }],
          select: { id: true, score: true },
        });
        const rewards = [
          { wood: event.firstRewardWood, stone: event.firstRewardStone },
          { wood: event.secondRewardWood, stone: event.secondRewardStone },
          { wood: event.thirdRewardWood, stone: event.thirdRewardStone },
        ];
        for (const [index, participant] of participants.filter((entry) => entry.score > 0).slice(0, 3).entries()) {
          await tx.worldEventParticipation.update({
            where: { id: participant.id },
            data: { rewardWood: rewards[index].wood, rewardStone: rewards[index].stone },
          });
        }
        await tx.worldEvent.update({
          where: { id: event.id },
          data: { status: "COMPLETED" },
        });
        await tx.worldJob.update({
          where: { id: candidate.id },
          data: { status: "COMPLETED", completedAt: now, lockedAt: null, lastError: null },
        });
      });
      processed += 1;
    } catch (error) {
      const attempts = candidate.attempts + 1;
      const permanentlyFailed = attempts >= MAX_JOB_ATTEMPTS;
      const nextRunAt = new Date(now.getTime() + Math.min(60 * 60_000, 30_000 * 2 ** (attempts - 1)));
      const message = errorText(error);
      await prisma.worldJob.updateMany({
        where: { id: candidate.id, status: "RUNNING" },
        data: {
          status: permanentlyFailed ? "FAILED" : "PENDING",
          runAt: permanentlyFailed ? now : nextRunAt,
          lockedAt: null,
          lastError: message,
        },
      });
      console.error("World event job failed.", {
        jobId: candidate.id,
        eventId: candidate.eventId,
        attempts,
        permanentlyFailed,
        error: message,
      });
      if (permanentlyFailed) failed += 1;
      else retried += 1;
    }
  }

  // Scheduled work runs for every player, so remote clients need hints for the
  // public rows it touched. Private-only completions (training, research, troop
  // returns) are picked up by the owner's own snapshot.
  const changes: WorldRealtimeChange[] = [
    ...[...new Set(mapOperations.changedNodeIds)].map((id) => ({ kind: "MAP_OBJECT" as const, id })),
    ...[...new Set(baseAttacks.changedUserIds)].map((id) => ({ kind: "BASE" as const, id })),
  ];
  await queueWorldRealtimeChanges(changes);

  return { processed, retried, failed, trained, marches, baseAttacks, mapOperations, research, changes };
}
/**
 * Effective scout camp level from raw WorldBuilding rows.
 *
 * Mirrors the completion rule used by `loadWorldSnapshot` (a row whose
 * `completesAt` has passed exposes `pendingLevel`) so the lightweight entity
 * endpoint can derive the same view radius without running scheduled jobs.
 */
function scoutCampLevelFromRows(
  buildings: ReadonlyArray<{
    buildingType: string;
    level: number;
    pendingLevel: number | null;
    completesAt: Date;
  }>,
  now: Date,
): number {
  return worldScoutCampLevel(
    buildings.map((building) => ({
      type: building.buildingType,
      level: building.completesAt <= now
        ? building.pendingLevel ?? building.level
        : building.level,
    })),
  );
}

export async function loadWorldSnapshot(userId: string, now = new Date()): Promise<WorldSnapshot> {
  await ensureDailyWorldEvents(now);
  await processScheduledWorldJobs(now);
  const world = await advanceWorld(userId, now);
  const base = await prisma.worldBase.findUniqueOrThrow({ where: { userId } });
  const [player, baseBuildings] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { username: true, displayName: true },
    }),
    prisma.worldBuilding.findMany({
      where: { baseId: base.id },
      orderBy: { plotIndex: "asc" },
    }),
  ]);
  if (base.coordinateX === null || base.coordinateZ === null) {
    throw new Error(`World base for user ${userId} is missing coordinates after initialization.`);
  }
  // A completed scout camp widens what this player can see (and attack).
  const viewRadiusMeters = worldViewRadiusMeters(scoutCampLevelFromRows(baseBuildings, now));
  const [events, pending, activeMarch, otherBases, baseAttacks, occupations, mapNodes, mapCamps, mapMissions, items, researchRows] = await Promise.all([
    prisma.worldEvent.findMany({
      where: { endsAt: { gte: new Date(now.getTime() - 48 * 60 * 60 * 1000) } },
      orderBy: { startsAt: "desc" },
      take: 4,
      include: {
        participants: {
          orderBy: [{ score: "desc" }, { joinedAt: "asc" }, { id: "asc" }],
          select: {
            userId: true,
            score: true,
            joinedAt: true,
            user: { select: { displayName: true, username: true } },
          },
        },
      },
    }),
    prisma.worldEventParticipation.findMany({
      where: {
        userId,
        rewardClaimedAt: null,
        OR: [{ rewardWood: { gt: 0 } }, { rewardStone: { gt: 0 } }],
        event: { status: "COMPLETED" },
      },
      include: { event: { select: { id: true, title: true } } },
      orderBy: { joinedAt: "desc" },
    }),
    prisma.worldMarch.findFirst({
      where: { userId, status: { in: ["IN_TRANSIT", "RETURNING"] } },
      orderBy: { dispatchedAt: "desc" },
      include: { event: { select: { id: true, title: true } } },
    }),
    prisma.worldBase.findMany({
      where: {
        userId: { not: userId },
        // Bounding box query keeps the result set proportional to the rendered
        // area instead of loading every base in the world.
        coordinateX: {
          not: null,
          gte: base.coordinateX - viewRadiusMeters,
          lte: base.coordinateX + viewRadiusMeters,
        },
        coordinateZ: {
          not: null,
          gte: base.coordinateZ - viewRadiusMeters,
          lte: base.coordinateZ + viewRadiusMeters,
        },
      },
      select: {
        userId: true,
        coordinateX: true,
        coordinateZ: true,
        castleLevel: true,
        activePvpAttackId: true,
        pvpShieldUntil: true,
        version: true,
        user: { select: { username: true, displayName: true } },
      },
    }),
    prisma.worldBaseAttack.findMany({
      where: { OR: [{ attackerUserId: userId }, { defenderUserId: userId }] },
      orderBy: { dispatchedAt: "desc" },
      take: 10,
      include: {
        attacker: { select: { username: true, displayName: true } },
        defender: { select: { username: true, displayName: true } },
      },
    }),
    prisma.worldBaseOccupation.findMany({
      where: {
        status: "ACTIVE",
        OR: [{ controllerUserId: userId }, { formerOwnerUserId: userId }],
      },
      orderBy: { endsAt: "asc" },
      include: {
        controller: { select: { username: true, displayName: true } },
        formerOwner: { select: { username: true, displayName: true } },
      },
    }),
    prisma.worldResourceNode.findMany({
      include: { owner: { select: { username: true, displayName: true } } },
    }),
    prisma.worldRogueCamp.findMany(),
    prisma.worldMapMarch.findMany({
      where: { userId },
      orderBy: { dispatchedAt: "desc" },
      take: 20,
    }),
    prisma.worldItemStack.findMany({
      where: { userId, quantity: { gt: 0 } },
      orderBy: { itemKey: "asc" },
      select: { itemKey: true, quantity: true },
    }),
    prisma.worldResearch.findMany({
      where: { baseId: base.id },
      select: { researchKey: true, level: true },
    }),
  ]);
  const mapNodeById = new Map(mapNodes.map((node) => [node.id, node]));
  const mapCampById = new Map(mapCamps.map((camp) => [camp.id, camp]));
  const research = researchRows.map((entry) => {
    if (!isWorldResearchKey(entry.researchKey)) {
      throw new Error(`Unknown world research key ${entry.researchKey}.`);
    }
    return { key: entry.researchKey, level: entry.level };
  });
  const researchByKey = new Map(research.map((entry) => [entry.key, entry.level]));
  const militaryTier = researchByKey.get("MILITARY_TIER") ?? 0;
  const productionResearchLevel = researchByKey.get("PRODUCTION_EFFICIENCY") ?? 0;
  let activeResearch: { key: WorldResearchKey; level: number; completesAt: Date } | null = null;
  if (base.activeResearchKey !== null) {
    const key = base.activeResearchKey;
    const level = base.activeResearchLevel;
    const completesAt = base.researchCompletesAt;
    if (!isWorldResearchKey(key) || level === null || !completesAt) {
      throw new Error(`Invalid active research state for base ${base.id}.`);
    }
    activeResearch = { key, level, completesAt };
  }
  const effectiveProductionLevel =
    activeResearch?.key === "PRODUCTION_EFFICIENCY" && activeResearch.completesAt <= now
      ? activeResearch.level
      : productionResearchLevel;
  const productionMultiplier = 1 + effectiveProductionLevel * 0.1;

  const nearbyBases = otherBases
    .map((otherBase) => buildNearbyBaseState(otherBase, base.coordinateX!, base.coordinateZ!))
    .filter((otherBase): otherBase is NonNullable<typeof otherBase> => otherBase !== null)
    // The bounding box includes the square's corners; drop bases outside the
    // circular render/view radius before ranking them.
    .filter((otherBase) => otherBase.distanceMeters <= viewRadiusMeters)
    .sort((left, right) => left.distanceMeters - right.distanceMeters)
    .slice(0, WORLD_NEARBY_BASE_LIMIT);

  // Generate procedural map objects for every chunk the client can render.
  const visibleChunks = getVisibleChunksAroundPosition(
    base.coordinateX,
    base.coordinateZ,
    viewRadiusMeters,
  );
  const proceduralObjects = visibleChunks.flatMap((c) =>
    generateChunkObjects(c.chunkX, c.chunkZ, DEFAULT_WORLD_SEED)
  );

  // Merge static definitions and procedural definitions (avoiding duplicate IDs)
  const allDefinitionsMap = new Map<string, WorldMapObject>();
  for (const def of RESOURCE_NODES) allDefinitionsMap.set(def.id, def);
  for (const def of ROGUE_CAMPS) allDefinitionsMap.set(def.id, def);
  for (const def of proceduralObjects) allDefinitionsMap.set(def.id, def);
  const allMapObjectDefinitions = Array.from(allDefinitionsMap.values());

  const mapObjectStates: WorldMapObjectState[] = allMapObjectDefinitions.map((definition) =>
    buildWorldMapObjectState(
      definition,
      mapNodeById.get(definition.id),
      mapCampById.get(definition.id),
      now,
    ),
  );

  return {
    userId,
    now: now.toISOString(),
    buildings: baseBuildings.map((building) => {
      const complete = building.completesAt <= now;
      const currentLevel = complete
        ? building.pendingLevel ?? building.level
        : building.level;
      if (!isWorldBuildingType(building.buildingType)) {
        throw new Error(`Unknown world building type ${building.buildingType}.`);
      }
      const status = complete
        ? "COMPLETED"
        : building.status === "UPGRADING"
          ? "UPGRADING"
          : building.status === "CONSTRUCTING"
            ? "CONSTRUCTING"
            : null;
      if (!status) throw new Error(`Unknown world building status ${building.status}.`);
      return {
        id: building.id,
        type: building.buildingType,
        plotIndex: building.plotIndex,
        level: currentLevel,
        pendingLevel: complete ? null : building.pendingLevel,
        status,
        startedAt: building.startedAt.toISOString(),
        completedAt: complete ? building.completesAt.toISOString() : building.completedAt?.toISOString() ?? null,
        completesAt: building.completesAt.toISOString(),
      };
    }),
    research,
    mapObjects: mapObjectStates,
    mapObjectDefinitions: allMapObjectDefinitions,
    mapMissions: mapMissions.map((march) => ({
      id: march.id,
      targetId: march.targetId,
      targetKind: march.targetKind === "RESOURCE" ? "RESOURCE" as const : "ROGUE_CAMP" as const,
      actionType: march.actionType,
      status: march.status,
      infantry: march.infantry,
      archers: march.archers,
      cavalry: march.cavalry,
      troopTier: march.troopTier,
      arrivesAt: march.arrivesAt.toISOString(),
      returnsAt: march.returnsAt?.toISOString() ?? null,
      completedAt: march.completedAt?.toISOString() ?? null,
      report: march.report,
      rewardWood: march.rewardWood,
      rewardStone: march.rewardStone,
      rewardIron: march.rewardIron,
      rewardFood: march.rewardFood,
      rewardRare: march.rewardRare,
      rewardExperience: march.rewardExperience,
      rewardItemKey: march.rewardItemKey,
      rewardItemCount: march.rewardItemCount,
    })),
    base: {
      playerName: player.displayName || player.username,
      castleLevel: base.castleLevel,
      castlePendingLevel: base.castlePendingLevel,
      castleUpgradeCompletesAt: base.castleUpgradeCompletesAt?.toISOString() ?? null,
      activeResearch: activeResearch
        ? {
            key: activeResearch.key,
            level: activeResearch.level,
            completesAt: activeResearch.completesAt.toISOString(),
          }
        : null,
      militaryTier,
      militaryTierName: worldMilitaryTierName(militaryTier),
      productionResearchLevel,
      researchSpeedLevel: researchByKey.get("RESEARCH_SPEED") ?? 0,
      coordinateX: base.coordinateX,
      coordinateZ: base.coordinateZ,
      activePvpAttackId: base.activePvpAttackId,
      pvpShieldUntil: base.pvpShieldUntil?.toISOString() ?? null,
      wood: base.wood,
      stone: base.stone,
      iron: base.iron,
      food: base.food,
      rare: base.rare,
      experience: base.experience,
      items,
      factoryLevel: base.factoryLevel,
      warehouseLevel: base.warehouseLevel,
      upgradeType: base.upgradeType,
      upgradeCompletesAt: base.upgradeCompletesAt?.toISOString() ?? null,
      lastSimulatedAt: base.lastSimulatedAt.toISOString(),
      capacity: worldResourceCapacity(base.warehouseLevel, baseBuildings, now.getTime()),
      woodPerHour:
        (productionFor(base.factoryLevel, "wood") +
        buildingLevelSumAt(baseBuildings, "LUMBER_MILL", now.getTime()) * 20) * productionMultiplier,
      stonePerHour:
        (productionFor(base.factoryLevel, "stone") +
        buildingLevelSumAt(baseBuildings, "STONE_QUARRY", now.getTime()) * 10) * productionMultiplier,
      foodPerHour:
        buildingLevelSumAt(baseBuildings, "FARM", now.getTime()) * 20 * productionMultiplier,
      army: {
        infantry: base.infantry,
        archers: base.archers,
        cavalry: base.cavalry,
        trainingType: base.trainingType,
        trainingCount: base.trainingCount,
        trainingCompletesAt: base.trainingCompletesAt?.toISOString() ?? null,
        marchActive: base.marchActive,
      },
    },
    offline: {
      elapsedSeconds: world.elapsedSeconds,
      producedWood: world.producedWood,
      producedStone: world.producedStone,
      producedFood: world.producedFood,
      cappedOfflineTime: world.cappedOfflineTime,
    },
    events: events.map((event) => {
      const participantIndex = event.participants.findIndex((entry) => entry.userId === userId);
      const joined = participantIndex >= 0;
      const status: WorldSnapshot["events"][number]["status"] =
        event.status === "CANCELED"
          ? "CANCELED"
          : event.status === "COMPLETED"
            ? "COMPLETED"
          : now < event.startsAt
          ? "SCHEDULED"
          : now < event.endsAt
            ? "ACTIVE"
            : "PROCESSING";
      return {
        id: event.id,
        title: event.title,
        description: event.description,
        startsAt: event.startsAt.toISOString(),
        endsAt: event.endsAt.toISOString(),
        status,
        participantCount: event.participantCount,
        participantLimit: event.participantLimit,
        minFactoryLevel: event.minFactoryLevel,
        contributionWoodCost: event.contributionWoodCost,
        contributionCooldownSeconds: event.contributionCooldownSeconds,
        rewards: [
          { wood: event.firstRewardWood, stone: event.firstRewardStone },
          { wood: event.secondRewardWood, stone: event.secondRewardStone },
          { wood: event.thirdRewardWood, stone: event.thirdRewardStone },
        ],
        eventType: event.eventType === "WORLD_BOSS" ? "WORLD_BOSS" : "RESOURCE_RUSH",
        bossHp: event.bossHp,
        bossHpRemaining: event.bossHpRemaining,
        marchTravelSeconds: event.marchTravelSeconds,
        activeMarch:
          activeMarch?.eventId === event.id
            ? {
                id: activeMarch.id,
                eventId: event.id,
                eventTitle: event.title,
                status: activeMarch.status,
                arrivesAt: activeMarch.arrivesAt.toISOString(),
                returnsAt: activeMarch.returnsAt?.toISOString() ?? null,
                damage: activeMarch.damage,
                infantry: activeMarch.infantry,
                archers: activeMarch.archers,
                cavalry: activeMarch.cavalry,
                casualties: activeMarch.casualties,
              }
            : null,
        joined,
        score: joined ? event.participants[participantIndex].score : 0,
        rank: joined ? participantIndex + 1 : null,
        leaderboard: event.participants.map((entry) => ({
          name: entry.user.displayName || entry.user.username,
          score: entry.score,
        })),
      };
    }),
    nearbyBases,
    baseAttacks: baseAttacks.map((attack) => ({
      id: attack.id,
      status: attack.status,
      attackerUserId: attack.attackerUserId,
      defenderUserId: attack.defenderUserId,
      attackerName: attack.attacker.displayName || attack.attacker.username,
      defenderName: attack.defender.displayName || attack.defender.username,
      distanceMeters: attack.distanceMeters,
      infantry: attack.infantry,
      archers: attack.archers,
      cavalry: attack.cavalry,
      arrivesAt: attack.arrivesAt.toISOString(),
      resolvedAt: attack.resolvedAt?.toISOString() ?? null,
      winnerUserId: attack.winnerUserId,
      stolenWood: attack.stolenWood,
      stolenStone: attack.stolenStone,
      attackerCasualties: attack.attackerCasualties,
      defenderCasualties: attack.defenderCasualties,
    })),
    occupations: occupations.map((occupation) => ({
      id: occupation.id,
      controllerUserId: occupation.controllerUserId,
      formerOwnerUserId: occupation.formerOwnerUserId,
      controllerName: occupation.controller.displayName || occupation.controller.username,
      formerOwnerName: occupation.formerOwner.displayName || occupation.formerOwner.username,
      coordinateX: occupation.coordinateX,
      coordinateZ: occupation.coordinateZ,
      endsAt: occupation.endsAt.toISOString(),
      status: occupation.status,
    })),
    pendingRewards: pending.map((reward) => ({
      eventId: reward.eventId,
      title: reward.event.title,
      wood: reward.rewardWood,
      stone: reward.rewardStone,
    })),
  };
}

export type WorldEntitiesPayload = {
  now: string;
  bases: WorldSnapshot["nearbyBases"];
  mapObjects: Array<{ definition: WorldMapObject; state: WorldMapObjectState }>;
};

/**
 * Incremental, read-only counterpart to `loadWorldSnapshot`.
 *
 * Realtime hints tell the client *which* objects changed; this endpoint returns
 * only those authoritative rows. `all: true` is used by the fallback poller and
 * the periodic resync to refresh everything currently in view without loading
 * the private snapshot (buildings, army, resources, events).
 */
export async function loadWorldEntities(
  userId: string,
  ids: string[],
  options: { all?: boolean } = {},
  now = new Date(),
): Promise<WorldEntitiesPayload> {
  const viewer = await prisma.worldBase.findUnique({
    where: { userId },
    select: {
      coordinateX: true,
      coordinateZ: true,
      buildings: {
        select: {
          buildingType: true,
          level: true,
          pendingLevel: true,
          completesAt: true,
        },
      },
    },
  });
  if (!viewer || viewer.coordinateX === null || viewer.coordinateZ === null) {
    throw new WorldActionError("Chưa khởi tạo căn cứ.", 404);
  }
  const originX = viewer.coordinateX;
  const originZ = viewer.coordinateZ;
  const viewRadiusMeters = worldViewRadiusMeters(scoutCampLevelFromRows(viewer.buildings, now));
  const inView = (definition: WorldMapObject) =>
    Math.hypot(definition.x - originX, definition.z - originZ) <= viewRadiusMeters;

  let definitions: WorldMapObject[];
  if (options.all) {
    const byId = new Map<string, WorldMapObject>();
    for (const definition of RESOURCE_NODES) byId.set(definition.id, definition);
    for (const definition of ROGUE_CAMPS) byId.set(definition.id, definition);
    for (const chunk of getVisibleChunksAroundPosition(originX, originZ, viewRadiusMeters)) {
      for (const definition of generateChunkObjects(chunk.chunkX, chunk.chunkZ, DEFAULT_WORLD_SEED)) {
        byId.set(definition.id, definition);
      }
    }
    definitions = [...byId.values()].filter(inView);
  } else {
    const uniqueIds = [...new Set(ids)].slice(0, WORLD_ENTITY_MAX_OBJECTS);
    definitions = uniqueIds
      .map((id) => resolveWorldMapObject(id))
      .filter((definition): definition is WorldMapObject => definition !== null)
      // Never leak objects outside the viewer's radius, even if a client asks.
      .filter(inView);
  }

  const objectIds = definitions.map((definition) => definition.id);
  const [nodes, camps, otherBases] = await Promise.all([
    objectIds.length > 0
      ? prisma.worldResourceNode.findMany({
          where: { id: { in: objectIds } },
          include: { owner: { select: { username: true, displayName: true } } },
        })
      : Promise.resolve([]),
    objectIds.length > 0
      ? prisma.worldRogueCamp.findMany({ where: { id: { in: objectIds } } })
      : Promise.resolve([]),
    prisma.worldBase.findMany({
      where: {
        userId: { not: userId },
        coordinateX: {
          not: null,
          gte: originX - viewRadiusMeters,
          lte: originX + viewRadiusMeters,
        },
        coordinateZ: {
          not: null,
          gte: originZ - viewRadiusMeters,
          lte: originZ + viewRadiusMeters,
        },
      },
      select: {
        userId: true,
        coordinateX: true,
        coordinateZ: true,
        castleLevel: true,
        activePvpAttackId: true,
        pvpShieldUntil: true,
        version: true,
        user: { select: { username: true, displayName: true } },
      },
    }),
  ]);

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const campById = new Map(camps.map((camp) => [camp.id, camp]));

  return {
    now: now.toISOString(),
    bases: otherBases
      .map((otherBase) => buildNearbyBaseState(otherBase, originX, originZ))
      .filter((otherBase): otherBase is NonNullable<typeof otherBase> => otherBase !== null)
      .filter((otherBase) => otherBase.distanceMeters <= viewRadiusMeters)
      .sort((left, right) => left.distanceMeters - right.distanceMeters)
      .slice(0, WORLD_NEARBY_BASE_LIMIT),
    mapObjects: definitions.map((definition) => ({
      definition,
      state: buildWorldMapObjectState(
        definition,
        nodeById.get(definition.id),
        campById.get(definition.id),
        now,
      ),
    })),
  };
}

function eventIsActive(event: { startsAt: Date; endsAt: Date; status?: string }, now: Date) {
  return event.status !== "CANCELED" &&
    event.status !== "COMPLETED" &&
    event.startsAt <= now &&
    event.endsAt > now;
}

export async function startWorldResearch(
  userId: string,
  researchKey: WorldResearchKey,
  now = new Date(),
) {
  if (!isWorldResearchKey(researchKey)) {
    throw new WorldActionError("Nhánh nghiên cứu không hợp lệ.", 400);
  }
  await processScheduledWorldJobs(now);
  await advanceWorld(userId, now);

  return prisma.$transaction(async (tx) => {
    const base = await tx.worldBase.findUnique({ where: { userId } });
    if (!base) throw new WorldActionError("Chưa khởi tạo căn cứ.", 404);
    if (base.activePvpAttackId) {
      throw new WorldActionError("Không thể nghiên cứu khi căn cứ đang tham chiến.", 409);
    }
    if (base.activeResearchKey) {
      throw new WorldActionError("Một nghiên cứu khác đang được tiến hành.", 409);
    }

    const currentResearch = await tx.worldResearch.findUnique({
      where: { baseId_researchKey: { baseId: base.id, researchKey } },
      select: { level: true },
    });
    const nextLevel = (currentResearch?.level ?? 0) + 1;
    const definition = WORLD_RESEARCH_DEFINITIONS[researchKey];
    if (nextLevel > definition.maxLevel) {
      throw new WorldActionError("Nhánh nghiên cứu đã đạt cấp tối đa.", 409);
    }
    const step = definition.step(nextLevel);
    if (base.castleLevel < step.castleLevel) {
      throw new WorldActionError(`Cần Thành chính cấp ${step.castleLevel} để nghiên cứu ${step.name}.`, 409);
    }
    if (
      researchKey === "MILITARY_TIER" &&
      (base.marchActive || await hasActiveWorldMapMarch(tx, userId))
    ) {
      throw new WorldActionError("Quân phải trở về trước khi nâng cấp chất lượng quân đội.", 409);
    }

    const speedLevel = await worldResearchLevel(tx, base.id, "RESEARCH_SPEED");
    const durationSeconds = Math.max(
      30,
      Math.ceil(step.durationSeconds * Math.max(0.5, 1 - speedLevel * 0.1)),
    );
    const completesAt = new Date(now.getTime() + durationSeconds * 1000);
    const started = await tx.worldBase.updateMany({
      where: {
        id: base.id,
        version: base.version,
        activeResearchKey: null,
        activePvpAttackId: null,
        wood: { gte: step.cost.wood },
        stone: { gte: step.cost.stone },
        iron: { gte: step.cost.iron },
        food: { gte: step.cost.food },
        rare: { gte: step.cost.rare },
      },
      data: {
        wood: { decrement: step.cost.wood },
        stone: { decrement: step.cost.stone },
        iron: { decrement: step.cost.iron },
        food: { decrement: step.cost.food },
        rare: { decrement: step.cost.rare },
        activeResearchKey: researchKey,
        activeResearchLevel: nextLevel,
        researchCompletesAt: completesAt,
        version: { increment: 1 },
      },
    });
    if (!started.count) {
      const shortfall = (["wood", "stone", "iron", "food", "rare"] as const)
        .find((resource) => base[resource] < step.cost[resource]);
      if (shortfall) {
        const resourceName = {
          wood: "gỗ",
          stone: "đá",
          iron: "sắt",
          food: "lương thực",
          rare: "tài nguyên hiếm",
        }[shortfall];
        throw new WorldActionError(`Không đủ ${resourceName} để bắt đầu nghiên cứu ${step.name}.`, 400);
      }
      throw new WorldActionError("Căn cứ vừa được cập nhật. Hãy tải lại và thử lại.", 409);
    }
    return {
      message: `Đã bắt đầu ${step.name}; hoàn tất lúc ${completesAt.toISOString()}.`,
    };
  });
}

export async function performWorldMapAction(
  userId: string,
  action:
    | { type: "GATHER"; targetId: string }
    | { type: "DISPATCH"; targetId: string; infantry: number; archers: number; cavalry: number },
  now = new Date(),
) {
  await processScheduledWorldJobs(now);
  const target = resolveWorldMapObject(action.targetId);
  if (!target) throw new WorldActionError("Không tìm thấy đối tượng trên bản đồ.", 404);
  await advanceWorld(userId, now);

  if (action.type === "GATHER") {
    if (target.kind !== "RESOURCE") throw new WorldActionError("Chỉ có thể khai thác khu tài nguyên.", 400);
    return prisma.$transaction(async (tx) => {
      let node = await tx.worldResourceNode.findUnique({ where: { id: target.id } });
      if (!node) {
        node = await tx.worldResourceNode.create({
          data: {
            id: target.id,
            resourceType: target.resource,
            level: target.level,
            maxAmount: target.amount,
            remaining: target.amount,
            yieldPerMinute: target.yieldPerMinute,
            requiredPower: target.requiredPower,
            x: target.x,
            z: target.z,
          },
        });
      }
      if (!node || node.ownerUserId !== userId) {
        throw new WorldActionError("Bạn không sở hữu khu tài nguyên này.", 403);
      }
      if (node.remaining <= 0) throw new WorldActionError("Khu tài nguyên đã cạn và đang tái tạo.", 409);
      const base = await tx.worldBase.findUniqueOrThrow({ where: { userId } });
      const result = await collectResourceNode(tx, node, base, now, now, false);
      if (result.released) {
        return {
          message: `Đã khai thác ${result.granted} ${result.resourceName}; mỏ cạn, quân đồn trú đã trở về căn cứ.`,
        };
      }
      if (result.generated === 0) {
        return { message: "Chưa đủ một phút khai thác; tài nguyên tiếp tục tích lũy tại khu vực." };
      }
      return {
        message: `Máy chủ đã cấp ${result.granted} ${result.resourceName}; còn ${result.remaining.toLocaleString("vi-VN")} tại khu vực.`,
      };
    });
  }

  if (action.type !== "DISPATCH") throw new WorldActionError("Thao tác bản đồ không hợp lệ.", 400);
  const troops = {
    infantry: action.infantry,
    archers: action.archers,
    cavalry: action.cavalry,
  };
  const troopCount = mapTroopTotal(troops);
  if (troopCount < 1 || troopCount > WORLD_MAP_MARCH_TROOP_LIMIT) {
    throw new WorldActionError(`Mỗi đạo quân cần 1–${WORLD_MAP_MARCH_TROOP_LIMIT} lính.`, 400);
  }

  return prisma.$transaction(async (tx) => {
    const base = await tx.worldBase.findUniqueOrThrow({ where: { userId } });
    if (base.activePvpAttackId) throw new WorldActionError("Căn cứ đang tham gia trận đánh.", 409);
    if (base.trainingType) throw new WorldActionError("Chờ huấn luyện hoàn tất trước khi điều quân.", 409);
    if (base.marchActive) throw new WorldActionError("Quân khác đang hành quân; hãy chờ họ trở về.", 409);
    if (await hasActiveWorldMapMarch(tx, userId)) {
      throw new WorldActionError("Một đạo quân đang hành quân hoặc trở về.", 409);
    }

    let targetKind: "RESOURCE" | "ROGUE_CAMP";
    let actionType: string;
    if (target.kind === "RESOURCE") {
      let node = await tx.worldResourceNode.findUnique({ where: { id: target.id } });
      if (!node) {
        node = await tx.worldResourceNode.create({
          data: {
            id: target.id,
            resourceType: target.resource,
            level: target.level,
            maxAmount: target.amount,
            remaining: target.amount,
            yieldPerMinute: target.yieldPerMinute,
            requiredPower: target.requiredPower,
            x: target.x,
            z: target.z,
          },
        });
      }
      if (!node || node.remaining <= 0) {
        throw new WorldActionError("Khu tài nguyên đã cạn hoặc đang tái tạo.", 409);
      }
      if (node.ownerUserId === userId) {
        throw new WorldActionError("Bạn đã sở hữu khu vực này; hãy khai thác thay vì điều quân.", 409);
      }
      if (!node.ownerUserId) {
        const ownedCount = await tx.worldResourceNode.count({
          where: { ownerUserId: userId, occupiedUntil: { gt: now } },
        });
        if (ownedCount >= MAX_RESOURCE_NODE_OCCUPANCY) {
          throw new WorldActionError(`Mỗi người chơi được chiếm tối đa ${MAX_RESOURCE_NODE_OCCUPANCY} khu tài nguyên.`, 409);
        }
      }
      targetKind = "RESOURCE";
      actionType = node.ownerUserId ? "CONTEST" : "OCCUPY";
    } else {
      let camp = await tx.worldRogueCamp.findUnique({ where: { id: target.id } });
      if (!camp) {
        camp = await tx.worldRogueCamp.create({
          data: {
            id: target.id,
            monsterType: target.monsterType,
            tier: target.tier,
            level: target.level,
            troopCount: target.troopCount,
            combatPower: target.combatPower,
            x: target.x,
            z: target.z,
          },
        });
      }
      if (camp.availableAt && camp.availableAt > now) {
        throw new WorldActionError(`Trại quái đang hồi phục đến ${camp.availableAt.toISOString()}.`, 409);
      }
      targetKind = "ROGUE_CAMP";
      actionType = "ATTACK";
    }

    const dx = target.x - (base.coordinateX ?? 0);
    const dz = target.z - (base.coordinateZ ?? 0);
    const arrivesAt = new Date(now.getTime() + worldMapTravelMilliseconds(dx, dz));
    const troopTier = await worldResearchLevel(tx, base.id, "MILITARY_TIER");
    const reserved = await tx.worldBase.updateMany({
      where: {
        id: base.id,
        version: base.version,
        activePvpAttackId: null,
        trainingType: null,
        marchActive: false,
        infantry: { gte: troops.infantry },
        archers: { gte: troops.archers },
        cavalry: { gte: troops.cavalry },
      },
      data: {
        infantry: { decrement: troops.infantry },
        archers: { decrement: troops.archers },
        cavalry: { decrement: troops.cavalry },
        version: { increment: 1 },
      },
    });
    if (!reserved.count) {
      throw new WorldActionError("Không đủ quân hoặc căn cứ vừa thay đổi. Hãy tải lại.", 409);
    }
    await tx.worldMapMarch.create({
      data: {
        userId,
        targetId: target.id,
        targetKind,
        actionType,
        ...troops,
        troopTier,
        dispatchedAt: now,
        arrivesAt,
        status: "IN_TRANSIT",
        report: `Đạo quân đang hành quân đến ${target.name}.`,
      },
    });
    return {
      message: `Đã điều ${troopCount} quân đến ${target.name}; dự kiến đến lúc ${arrivesAt.toISOString()}.`,
    };
  });
}

export async function performWorldBuildingAction(
  userId: string,
  action:
    | { type: "BUILD"; plotIndex: number; buildingType: WorldBuildingType }
    | { type: "UPGRADE" | "DEMOLISH"; plotIndex: number }
    | { type: "UPGRADE_CASTLE" },
  now = new Date(),
) {
  if (
    action.type !== "UPGRADE_CASTLE" &&
    (!Number.isInteger(action.plotIndex) || action.plotIndex < 0 || action.plotIndex >= WORLD_BUILDING_PLOT_COUNT)
  ) {
    throw new WorldActionError("Ô đất xây dựng không hợp lệ.", 400);
  }
  await processWorldResearch(now);
  await advanceWorld(userId, now);

  return prisma.$transaction(async (tx) => {
    const base = await tx.worldBase.findUnique({ where: { userId } });
    if (!base) throw new WorldActionError("Chưa khởi tạo căn cứ.", 404);
    if (base.activePvpAttackId) throw new WorldActionError("Căn cứ đang tham gia trận đánh.", 409);

    if (action.type === "UPGRADE_CASTLE") {
      if (base.castlePendingLevel !== null) {
        throw new WorldActionError("Lâu đài chính đang được nâng cấp.", 409);
      }
      if (base.castleLevel >= MAX_BUILDING_LEVEL) {
        throw new WorldActionError("Lâu đài chính đã đạt cấp tối đa.", 409);
      }
      const nextLevel = base.castleLevel + 1;
      const woodCost = 250 * nextLevel;
      const stoneCost = 150 * nextLevel;
      const completesAt = new Date(now.getTime() + nextLevel * 5 * 60_000);
      const started = await tx.worldBase.updateMany({
        where: {
          id: base.id,
          version: base.version,
          activePvpAttackId: null,
          castlePendingLevel: null,
          wood: { gte: woodCost },
          stone: { gte: stoneCost },
        },
        data: {
          wood: { decrement: woodCost },
          stone: { decrement: stoneCost },
          castlePendingLevel: nextLevel,
          castleUpgradeCompletesAt: completesAt,
          version: { increment: 1 },
        },
      });
      if (!started.count) {
        if (base.wood < woodCost || base.stone < stoneCost) {
          throw new WorldActionError(`Cần ${woodCost} gỗ và ${stoneCost} đá để nâng cấp lâu đài.`, 400);
        }
        throw new WorldActionError("Căn cứ vừa được cập nhật. Hãy thử lại.", 409);
      }
      return { message: `Đang nâng cấp lâu đài chính lên cấp ${nextLevel}; hoàn tất lúc ${completesAt.toISOString()}.` };
    }

    const existing = await tx.worldBuilding.findUnique({
      where: { baseId_plotIndex: { baseId: base.id, plotIndex: action.plotIndex } },
    });

    if (action.type === "BUILD") {
      if (existing) throw new WorldActionError("Ô đất này đã có công trình.", 409);
      const definition = WORLD_BUILDING_DEFINITIONS[action.buildingType];
      if (base.castleLevel < definition.requiredCastleLevel) {
        throw new WorldActionError(`Cần Thành chính cấp ${definition.requiredCastleLevel} để xây ${definition.name}.`, 409);
      }
      const paid = await tx.worldBase.updateMany({
        where: {
          id: base.id,
          version: base.version,
          activePvpAttackId: null,
          wood: { gte: definition.woodCost },
          stone: { gte: definition.stoneCost },
        },
        data: {
          wood: { decrement: definition.woodCost },
          stone: { decrement: definition.stoneCost },
          version: { increment: 1 },
        },
      });
      if (!paid.count) {
        if (base.wood < definition.woodCost || base.stone < definition.stoneCost) {
          throw new WorldActionError(`Cần ${definition.woodCost} gỗ và ${definition.stoneCost} đá để xây ${definition.name}.`, 400);
        }
        throw new WorldActionError("Căn cứ vừa được cập nhật. Hãy thử lại.", 409);
      }
      const completesAt = new Date(now.getTime() + definition.constructionSeconds * 1000);
      await tx.worldBuilding.create({
        data: {
          baseId: base.id,
          plotIndex: action.plotIndex,
          buildingType: action.buildingType,
          level: 0,
          pendingLevel: 1,
          status: "CONSTRUCTING",
          startedAt: now,
          completesAt,
        },
      });
      return { message: `Đã khởi công ${definition.name}; hoàn tất lúc ${completesAt.toISOString()}.` };
    }

    if (!existing) throw new WorldActionError("Ô đất không có công trình để thao tác.", 404);
    if (!isWorldBuildingType(existing.buildingType)) {
      throw new Error(`Unknown world building type ${existing.buildingType}.`);
    }
    if (existing.completesAt > now) {
      throw new WorldActionError("Chờ công trình hoàn tất trước khi nâng cấp hoặc phá bỏ.", 409);
    }
    const currentLevel = existing.pendingLevel ?? existing.level;
    const definition = WORLD_BUILDING_DEFINITIONS[existing.buildingType];

    if (action.type === "UPGRADE") {
      const maxLevel = worldBuildingMaxLevel(existing.buildingType);
      if (currentLevel >= maxLevel) {
        throw new WorldActionError(
          maxLevel === MAX_BUILDING_LEVEL
            ? "Công trình đã đạt cấp tối đa."
            : `${definition.name} chỉ có thể nâng tới cấp ${maxLevel}.`,
          409,
        );
      }
      const nextLevel = currentLevel + 1;
      const woodCost = definition.woodCost * nextLevel;
      const stoneCost = definition.stoneCost * nextLevel;
      const paid = await tx.worldBase.updateMany({
        where: {
          id: base.id,
          version: base.version,
          activePvpAttackId: null,
          wood: { gte: woodCost },
          stone: { gte: stoneCost },
        },
        data: {
          wood: { decrement: woodCost },
          stone: { decrement: stoneCost },
          version: { increment: 1 },
        },
      });
      if (!paid.count) {
        if (base.wood < woodCost || base.stone < stoneCost) {
          throw new WorldActionError(`Cần ${woodCost} gỗ và ${stoneCost} đá để nâng cấp.`, 400);
        }
        throw new WorldActionError("Căn cứ vừa được cập nhật. Hãy thử lại.", 409);
      }
      const completedAt = existing.pendingLevel !== null
        ? existing.completesAt
        : existing.completedAt;
      const completesAt = new Date(now.getTime() + definition.constructionSeconds * nextLevel * 1000);
      const upgraded = await tx.worldBuilding.updateMany({
        where: { id: existing.id, completesAt: existing.completesAt },
        data: {
          level: currentLevel,
          pendingLevel: nextLevel,
          status: "UPGRADING",
          startedAt: now,
          completedAt,
          completesAt,
        },
      });
      if (!upgraded.count) throw new WorldActionError("Công trình vừa được cập nhật. Hãy tải lại.", 409);
      return { message: `Đang nâng cấp ${definition.name} lên cấp ${nextLevel}.` };
    }

    const refundWood = Math.floor(definition.woodCost * currentLevel * 0.25);
    const refundStone = Math.floor(definition.stoneCost * currentLevel * 0.25);
    const otherBuildings = await tx.worldBuilding.findMany({
      where: { baseId: base.id, id: { not: existing.id } },
      select: {
        buildingType: true,
        level: true,
        pendingLevel: true,
        completedAt: true,
        completesAt: true,
      },
    });
    const capacity = worldResourceCapacity(base.warehouseLevel, otherBuildings, now.getTime());
    const removed = await tx.worldBuilding.deleteMany({
      where: { id: existing.id, completesAt: existing.completesAt },
    });
    if (!removed.count) throw new WorldActionError("Công trình vừa được cập nhật. Hãy tải lại.", 409);
    const refunded = await tx.worldBase.updateMany({
      where: { id: base.id, version: base.version, activePvpAttackId: null },
      data: {
        wood: Math.min(capacity, base.wood + refundWood),
        stone: Math.min(capacity, base.stone + refundStone),
        version: { increment: 1 },
      },
    });
    if (!refunded.count) throw new WorldActionError("Căn cứ vừa được cập nhật. Hãy thử lại.", 409);
    return { message: `Đã phá dỡ ${definition.name}; hoàn lại ${refundWood} gỗ và ${refundStone} đá.` };
  });
}

export async function performWorldAction(
  userId: string,
  action:
    | { type: "join"; eventId: string }
    | { type: "contribute"; eventId: string }
    | { type: "claim"; eventId: string }
    | { type: "train"; troopType: "INFANTRY" | "ARCHERS" | "CAVALRY"; count: number }
    | {
        type: "dispatch";
        eventId: string;
        infantry: number;
        archers: number;
        cavalry: number;
      }
    | {
        type: "attackBase";
        targetUserId: string;
        infantry: number;
        archers: number;
        cavalry: number;
      }
    | { type: "scoutBase"; targetUserId: string }
    | { type: "upgrade"; building: "FACTORY" | "WAREHOUSE" },
  now = new Date(),
) {
  await processScheduledWorldJobs(now);

  if (action.type === "attackBase") {
    const troopCount = action.infantry + action.archers + action.cavalry;
    if (troopCount < 1 || troopCount > MAX_BASE_ATTACK_TROOPS) {
      throw new WorldActionError(`Mỗi đợt tấn công cần 1–${MAX_BASE_ATTACK_TROOPS} quân.`, 400);
    }
    if (userId === action.targetUserId) {
      throw new WorldActionError("Không thể tấn công căn cứ của chính mình.", 400);
    }
    await advanceWorld(userId, now);
    const attack = await prisma.$transaction(async (tx) => {
      const [attackerBase, defenderBase] = await Promise.all([
        tx.worldBase.findUnique({ where: { userId } }),
        tx.worldBase.findUnique({ where: { userId: action.targetUserId } }),
      ]);
      if (!attackerBase) throw new WorldActionError("Căn cứ tấn công chưa được khởi tạo.", 409);
      if (!defenderBase || defenderBase.coordinateX === null || defenderBase.coordinateZ === null) {
        throw new WorldActionError("Không tìm thấy căn cứ mục tiêu.", 404);
      }
      if (attackerBase.activePvpAttackId || defenderBase.activePvpAttackId) {
        throw new WorldActionError("Một trong hai căn cứ đang tham gia trận đánh khác.", 409);
      }
      if (await hasActiveWorldMapMarch(tx, userId)) {
        throw new WorldActionError("Quân bản đồ cần trở về trước khi tấn công căn cứ.", 409);
      }
      if (defenderBase.pvpShieldUntil && defenderBase.pvpShieldUntil > now) {
        throw new WorldActionError(
          `Căn cứ đang có khiên bảo vệ đến ${defenderBase.pvpShieldUntil.toISOString()}.`,
          409,
        );
      }
      if (attackerBase.trainingType || attackerBase.marchActive) {
        throw new WorldActionError("Hoàn tất huấn luyện và chờ quân đang hành quân trở về.", 409);
      }
      const distanceMeters = Math.round(
        Math.hypot(
          attackerBase.coordinateX! - defenderBase.coordinateX,
          attackerBase.coordinateZ! - defenderBase.coordinateZ,
        ),
      );
      const travelMilliseconds = Math.min(
        2 * 60 * 60 * 1000,
        Math.max(30_000, Math.ceil(distanceMeters / 10_000 * BASE_ATTACK_SECONDS_PER_10KM) * 1000),
      );
      const arrivesAt = new Date(now.getTime() + travelMilliseconds);
      const [attackerTroopTier, defenderTroopTier] = await Promise.all([
        worldResearchLevel(tx, attackerBase.id, "MILITARY_TIER"),
        worldResearchLevel(tx, defenderBase.id, "MILITARY_TIER"),
      ]);
      const created = await tx.worldBaseAttack.create({
        data: {
          attackerUserId: userId,
          defenderUserId: action.targetUserId,
          distanceMeters,
          infantry: action.infantry,
          archers: action.archers,
          cavalry: action.cavalry,
          attackerTroopTier,
          defenderTroopTier,
          dispatchedAt: now,
          arrivesAt,
        },
        select: { id: true, arrivesAt: true },
      });
      const attackerLocked = await tx.worldBase.updateMany({
        where: {
          id: attackerBase.id,
          version: attackerBase.version,
          activePvpAttackId: null,
          trainingType: null,
          marchActive: false,
          infantry: { gte: action.infantry },
          archers: { gte: action.archers },
          cavalry: { gte: action.cavalry },
        },
        data: {
          infantry: { decrement: action.infantry },
          archers: { decrement: action.archers },
          cavalry: { decrement: action.cavalry },
          activePvpAttackId: created.id,
          version: { increment: 1 },
        },
      });
      if (!attackerLocked.count) {
        throw new WorldActionError("Không đủ quân hoặc căn cứ vừa thay đổi. Hãy tải lại.", 409);
      }
      const defenderLocked = await tx.worldBase.updateMany({
        where: {
          id: defenderBase.id,
          activePvpAttackId: null,
          pvpShieldUntil: defenderBase.pvpShieldUntil,
        },
        data: {
          activePvpAttackId: created.id,
          version: { increment: 1 },
        },
      });
      if (!defenderLocked.count) {
        throw new WorldActionError("Căn cứ mục tiêu vừa được bảo vệ hoặc bị tấn công.", 409);
      }
      return created;
    });
    return {
      message: `Đạo quân đang hành quân ${Math.ceil(
        (attack.arrivesAt.getTime() - now.getTime()) / 60_000,
      )} phút; dự kiến tới lúc ${attack.arrivesAt.toISOString()}.`,
    };
  }

  if (action.type === "scoutBase") {
    if (userId === action.targetUserId) {
      throw new WorldActionError("Không thể do thám căn cứ của chính mình.", 400);
    }
    const SCOUT_WOOD_COST = 30;
    const SCOUT_FOOD_COST = 20;

    await advanceWorld(userId, now);
    await advanceWorld(action.targetUserId, now);

    const report = await prisma.$transaction(async (tx) => {
      const [scoutBase, targetBase, scoutBuildings, targetBuildings] = await Promise.all([
        tx.worldBase.findUnique({
          where: { userId },
          include: { user: { select: { username: true, displayName: true } } },
        }),
        tx.worldBase.findUnique({
          where: { userId: action.targetUserId },
          include: { user: { select: { username: true, displayName: true } } },
        }),
        tx.worldBuilding.findMany({
          where: { base: { userId } },
          select: { buildingType: true, level: true, pendingLevel: true, completesAt: true },
        }),
        tx.worldBuilding.findMany({
          where: { base: { userId: action.targetUserId } },
          select: { buildingType: true, level: true, pendingLevel: true, completesAt: true },
        }),
      ]);

      if (!scoutBase) throw new WorldActionError("Căn cứ của bạn chưa được khởi tạo.", 404);
      if (!targetBase || targetBase.coordinateX === null || targetBase.coordinateZ === null) {
        throw new WorldActionError("Không tìm thấy căn cứ mục tiêu.", 404);
      }

      const scoutCampLevel = scoutCampLevelFromRows(scoutBuildings, now);
      if (scoutCampLevel < 1) {
        throw new WorldActionError("Cần xây dựng Trại trinh sát trước khi cử trinh sát do thám.", 400);
      }

      const distanceMeters = Math.round(
        Math.hypot(
          (scoutBase.coordinateX ?? 0) - targetBase.coordinateX,
          (scoutBase.coordinateZ ?? 0) - targetBase.coordinateZ,
        ),
      );
      const maxViewRadius = worldViewRadiusMeters(scoutCampLevel);
      if (distanceMeters > maxViewRadius) {
        throw new WorldActionError(
          `Căn cứ mục tiêu ở cách ${(distanceMeters / 1000).toFixed(1)} km, vượt quá tầm do thám của Trại trinh sát cấp ${scoutCampLevel} (${(maxViewRadius / 1000).toFixed(1)} km). Hãy nâng cấp Trại trinh sát!`,
          400,
        );
      }

      if (scoutBase.wood < SCOUT_WOOD_COST || scoutBase.food < SCOUT_FOOD_COST) {
        throw new WorldActionError(
          `Cần ${SCOUT_WOOD_COST} gỗ và ${SCOUT_FOOD_COST} lương thực để trang bị đoàn trinh sát.`,
          400,
        );
      }

      // Deduct scouting supplies
      const updated = await tx.worldBase.updateMany({
        where: {
          id: scoutBase.id,
          version: scoutBase.version,
          wood: { gte: SCOUT_WOOD_COST },
          food: { gte: SCOUT_FOOD_COST },
        },
        data: {
          wood: { decrement: SCOUT_WOOD_COST },
          food: { decrement: SCOUT_FOOD_COST },
          version: { increment: 1 },
        },
      });
      if (!updated.count) {
        throw new WorldActionError("Tài nguyên không đủ hoặc căn cứ vừa thay đổi.", 409);
      }

      const [targetMilitaryTier, targetProductionLevel] = await Promise.all([
        worldResearchLevel(tx, targetBase.id, "MILITARY_TIER"),
        worldResearchLevel(tx, targetBase.id, "PRODUCTION_EFFICIENCY"),
      ]);

      const targetTotalTroops = targetBase.infantry + targetBase.archers + targetBase.cavalry;
      const targetName = targetBase.user.displayName || targetBase.user.username;

      let estimatedTotalTroops = "0 quân (Không có quân đồn trú)";
      if (targetTotalTroops > 0) {
        if (targetTotalTroops < 20) {
          estimatedTotalTroops = "Dưới 20 quân";
        } else if (targetTotalTroops <= 100) {
          estimatedTotalTroops = `Khoảng ${Math.floor(targetTotalTroops / 10) * 10}–${Math.ceil(targetTotalTroops / 10) * 10} quân`;
        } else {
          estimatedTotalTroops = `Khoảng ~${Math.round(targetTotalTroops / 25) * 25} quân`;
        }
      }

      // Base speed: Lv1 = 120m/s, Lv2 = 180m/s (+50%), Lv3 = 240m/s (+100%)
      const speedMultiplier = scoutCampLevel === 3 ? 2.0 : scoutCampLevel === 2 ? 1.5 : 1.0;
      const speedMetersPerSec = 120 * speedMultiplier;
      const travelDurationSeconds = Math.max(8, Math.min(60, Math.round(distanceMeters / speedMetersPerSec)));
      const completesAt = new Date(now.getTime() + travelDurationSeconds * 1000).toISOString();

      const data: WorldScoutReport = {
        targetUserId: targetBase.userId,
        targetName,
        targetX: targetBase.coordinateX,
        targetZ: targetBase.coordinateZ,
        scoutLevel: scoutCampLevel,
        scoutedAt: now.toISOString(),
        distanceMeters,
        travelDurationSeconds,
        castleLevel: targetBase.castleLevel,
        pvpShieldUntil: targetBase.pvpShieldUntil?.toISOString() ?? null,
        approximateWood: Math.round(targetBase.wood / 50) * 50,
        approximateStone: Math.round(targetBase.stone / 50) * 50,
        estimatedTotalTroops,
      };

      if (scoutCampLevel >= 2) {
        data.exactInfantry = targetBase.infantry;
        data.exactArchers = targetBase.archers;
        data.exactCavalry = targetBase.cavalry;
        data.food = targetBase.food;
        data.warehouseLevel = targetBase.warehouseLevel;
        data.factoryLevel = targetBase.factoryLevel;
      }

      if (scoutCampLevel >= 3) {
        data.militaryTier = targetMilitaryTier;
        data.militaryTierName = worldMilitaryTierName(targetMilitaryTier);
        data.productionEfficiencyTier = targetProductionLevel;
        data.marchActive = targetBase.marchActive;
        data.trainingActive = Boolean(targetBase.trainingType);
        data.buildings = targetBuildings.map((b) => {
          const effectiveLevel = b.completesAt <= now ? b.pendingLevel ?? b.level : b.level;
          return {
            type: b.buildingType,
            name: WORLD_BUILDING_DEFINITIONS[b.buildingType as WorldBuildingType]?.name ?? b.buildingType,
            level: effectiveLevel,
          };
        });
      }

      return data;
    });

    return {
      message: `Đoàn trinh sát đã xuất kích! Dự kiến tiếp cận và gửi báo cáo về sau ${report.travelDurationSeconds ?? 10} giây.`,
      scoutReport: report,
      travelDurationSeconds: report.travelDurationSeconds ?? 10,
      completesAt: new Date(now.getTime() + (report.travelDurationSeconds ?? 10) * 1000).toISOString(),
    };
  }

  if (action.type === "upgrade") {
    const current = await advanceWorld(userId, now);
    const base = await prisma.worldBase.findUniqueOrThrow({ where: { userId } });
    if (base.activePvpAttackId) throw new WorldActionError("Căn cứ đang tham gia trận đánh.", 409);
    if (base.upgradeType) throw new WorldActionError("Một công trình khác đang nâng cấp.", 409);

    const level = action.building === "FACTORY" ? base.factoryLevel : base.warehouseLevel;
    if (level >= MAX_BUILDING_LEVEL) throw new WorldActionError("Công trình đã đạt cấp tối đa.", 409);
    const nextLevel = level + 1;
    const cost =
      action.building === "FACTORY"
        ? { wood: 100 * nextLevel, stone: 50 * nextLevel }
        : { wood: 150 * nextLevel, stone: 100 * nextLevel };
    const upgradeType = action.building;
    const upgradeCompletesAt = new Date(now.getTime() + nextLevel * 60_000);
    const started = await prisma.worldBase.updateMany({
      where: {
        id: base.id,
        version: current.version,
        activePvpAttackId: null,
        upgradeType: null,
        wood: { gte: cost.wood },
        stone: { gte: cost.stone },
      },
      data: {
        wood: { decrement: cost.wood },
        stone: { decrement: cost.stone },
        upgradeType,
        upgradeCompletesAt,
        version: { increment: 1 },
      },
    });
    if (!started.count) {
      if (base.wood < cost.wood || base.stone < cost.stone) {
        throw new WorldActionError(`Cần ${cost.wood} gỗ và ${cost.stone} đá để nâng cấp.`, 400);
      }
      throw new WorldActionError("Thế giới vừa được cập nhật. Hãy thử lại.", 409);
    }
    return { message: "Đã bắt đầu nâng cấp công trình." };
  }

  if (action.type === "train") {
    const current = await advanceWorld(userId, now);
    const base = await prisma.worldBase.findUniqueOrThrow({ where: { userId } });
    const stats = TROOP_STATS[action.troopType];
    if (base.activePvpAttackId) throw new WorldActionError("Căn cứ đang tham gia trận đánh.", 409);
    if (base.marchActive || await hasActiveWorldMapMarch(prisma, userId)) {
      throw new WorldActionError("Quân đang hành quân; hãy chờ họ trở về trước khi huấn luyện.", 409);
    }
    if (base.trainingType) {
      throw new WorldActionError("Hàng đợi đang huấn luyện một đạo quân.", 409);
    }
    const trainingBuilding = await prisma.worldBuilding.findFirst({
      where: {
        baseId: base.id,
        buildingType: WORLD_TRAINING_BUILDINGS[action.troopType],
        OR: [{ level: { gt: 0 } }, { completesAt: { lte: now } }],
      },
      select: { id: true },
    });
    if (!trainingBuilding) {
      const requiredBuilding = WORLD_BUILDING_DEFINITIONS[WORLD_TRAINING_BUILDINGS[action.troopType]];
      throw new WorldActionError(`Cần xây xong ${requiredBuilding.name} trước khi huấn luyện ${stats.label}.`, 409);
    }
    const troopField =
      action.troopType === "INFANTRY"
        ? "infantry"
        : action.troopType === "ARCHERS"
          ? "archers"
          : "cavalry";
    const committed = await committedWorldMapTroops(prisma, userId);
    if (base[troopField] + committed[troopField] + action.count > MAX_TROOPS_PER_TYPE) {
      throw new WorldActionError(`Mỗi loại quân được giới hạn ${MAX_TROOPS_PER_TYPE.toLocaleString("vi-VN")} lính.`, 400);
    }
    const woodCost = stats.costWood * action.count;
    const stoneCost = stats.costStone * action.count;
    const trainingCompletesAt = new Date(now.getTime() + stats.trainingSeconds * action.count * 1000);
    const started = await prisma.worldBase.updateMany({
      where: {
        id: base.id,
        version: current.version,
        activePvpAttackId: null,
        trainingType: null,
        wood: { gte: woodCost },
        stone: { gte: stoneCost },
        [troopField]: { lte: MAX_TROOPS_PER_TYPE - action.count - committed[troopField] },
      },
      data: {
        wood: { decrement: woodCost },
        stone: { decrement: stoneCost },
        trainingType: action.troopType,
        trainingCount: action.count,
        trainingCompletesAt,
        version: { increment: 1 },
      },
    });
    if (!started.count) {
      if (base.wood < woodCost || base.stone < stoneCost) {
        throw new WorldActionError(`Cần ${woodCost} gỗ và ${stoneCost} đá để huấn luyện.`, 400);
      }
      throw new WorldActionError("Căn cứ vừa thay đổi. Hãy tải lại và thử lại.", 409);
    }
    return {
      message: `Đã bắt đầu huấn luyện ${action.count} ${stats.label}; dự kiến hoàn tất sau ${Math.ceil(stats.trainingSeconds * action.count / 60)} phút.`,
    };
  }

  if (action.type === "dispatch") {
    const troopCount = action.infantry + action.archers + action.cavalry;
    if (troopCount <= 0 || troopCount > MAX_TROOPS_PER_MARCH) {
      throw new WorldActionError(`Mỗi lượt điều tối đa ${MAX_TROOPS_PER_MARCH} quân và cần có ít nhất 1 lính.`, 400);
    }
    const current = await advanceWorld(userId, now);
    const base = await prisma.worldBase.findUniqueOrThrow({ where: { userId } });
    const march = await prisma.$transaction(async (tx) => {
      const event = await tx.worldEvent.findUnique({ where: { id: action.eventId } });
      if (
        !event ||
        event.eventType !== "WORLD_BOSS" ||
        event.status === "CANCELED" ||
        event.status === "COMPLETED" ||
        !eventIsActive(event, now) ||
        event.bossHpRemaining <= 0
      ) {
        throw new WorldActionError("Boss không còn nhận quân hành quân.", 409);
      }
      const participation = await tx.worldEventParticipation.findUnique({
        where: { eventId_userId: { eventId: event.id, userId } },
        select: { id: true },
      });
      if (!participation) throw new WorldActionError("Hãy tham gia sự kiện trước khi điều quân.", 400);
      if (base.trainingType) throw new WorldActionError("Chờ huấn luyện hoàn tất trước khi điều quân.", 409);
      if (base.marchActive) throw new WorldActionError("Đạo quân trước vẫn chưa trở về.", 409);
      if (base.activePvpAttackId) throw new WorldActionError("Căn cứ đang tham gia trận đánh.", 409);
      if (await hasActiveWorldMapMarch(tx, userId)) {
        throw new WorldActionError("Quân bản đồ cần trở về trước khi điều quân đến boss.", 409);
      }

      const reserved = await tx.worldBase.updateMany({
        where: {
          id: base.id,
          version: current.version,
          activePvpAttackId: null,
          marchActive: false,
          infantry: { gte: action.infantry },
          archers: { gte: action.archers },
          cavalry: { gte: action.cavalry },
        },
        data: {
          infantry: { decrement: action.infantry },
          archers: { decrement: action.archers },
          cavalry: { decrement: action.cavalry },
          marchActive: true,
          version: { increment: 1 },
        },
      });
      if (!reserved.count) {
        throw new WorldActionError("Không đủ quân hoặc căn cứ vừa thay đổi. Hãy tải lại.", 409);
      }
      const arrivesAt = new Date(now.getTime() + event.marchTravelSeconds * 1000);
      const troopTier = await worldResearchLevel(tx, base.id, "MILITARY_TIER");
      return tx.worldMarch.create({
        data: {
          eventId: event.id,
          userId,
          infantry: action.infantry,
          archers: action.archers,
          cavalry: action.cavalry,
          troopTier,
          dispatchedAt: now,
          arrivesAt,
        },
        select: { arrivesAt: true },
      });
    });
    return { message: `Đạo quân đang hành quân; dự kiến tới boss lúc ${march.arrivesAt.toISOString()}.` };
  }

  if (action.type === "join") {
    const base = await advanceWorld(userId, now);
    await prisma.$transaction(async (tx) => {
      const event = await tx.worldEvent.findUnique({ where: { id: action.eventId } });
      if (!event || event.status === "CANCELED" || !eventIsActive(event, now)) {
        throw new WorldActionError("Sự kiện hiện không mở.", 409);
      }
      if (base.castleLevel < event.minFactoryLevel) {
        throw new WorldActionError(`Cần Thành chính cấp ${event.minFactoryLevel} để tham gia.`, 403);
      }
      const existing = await tx.worldEventParticipation.findUnique({
        where: { eventId_userId: { eventId: event.id, userId } },
        select: { id: true },
      });
      if (existing) return;

      const reserved = await tx.worldEvent.updateMany({
        where: {
          id: event.id,
          participantCount: { lt: event.participantLimit },
          startsAt: { lte: now },
          endsAt: { gt: now },
        },
        data: { participantCount: { increment: 1 } },
      });
      if (!reserved.count) throw new WorldActionError("Sự kiện đã kết thúc hoặc đủ người tham gia.", 409);
      await tx.worldEventParticipation.create({ data: { eventId: event.id, userId } });
    });
    return { message: "Bạn đã tham gia sự kiện." };
  }

  if (action.type === "contribute") {
    const current = await advanceWorld(userId, now);
    await prisma.$transaction(async (tx) => {
      const event = await tx.worldEvent.findUnique({ where: { id: action.eventId } });
      if (!event || event.status === "CANCELED" || !eventIsActive(event, now)) {
        throw new WorldActionError("Sự kiện hiện không mở.", 409);
      }
      if (event.eventType !== "RESOURCE_RUSH") {
        throw new WorldActionError("Boss chỉ nhận sát thương từ các đạo quân hành quân.", 409);
      }
      const participation = await tx.worldEventParticipation.findUnique({
        where: { eventId_userId: { eventId: event.id, userId } },
        select: { lastContributionAt: true },
      });
      if (!participation) throw new WorldActionError("Hãy tham gia sự kiện trước.", 400);
      if (
        participation.lastContributionAt &&
        now.getTime() - participation.lastContributionAt.getTime() <
          event.contributionCooldownSeconds * 1000
      ) {
        throw new WorldActionError(
          `Hãy đợi ${event.contributionCooldownSeconds} giây trước lượt đóng góp tiếp theo.`,
          429,
        );
      }
      const spent = await tx.worldBase.updateMany({
        where: {
          userId,
          version: current.version,
          wood: { gte: event.contributionWoodCost },
        },
        data: {
          wood: { decrement: event.contributionWoodCost },
          version: { increment: 1 },
        },
      });
      if (!spent.count) throw new WorldActionError("Không đủ 10 gỗ hoặc tài nguyên vừa thay đổi.", 400);

      const cooldownBefore = new Date(now.getTime() - event.contributionCooldownSeconds * 1000);
      const scored = await tx.worldEventParticipation.updateMany({
        where: {
          eventId: event.id,
          userId,
          OR: [
            { lastContributionAt: null },
            { lastContributionAt: { lte: cooldownBefore } },
          ],
        },
        data: {
          score: { increment: 1 },
          lastContributionAt: now,
        },
      });
      if (!scored.count) {
        throw new WorldActionError(
          `Hãy đợi ${event.contributionCooldownSeconds} giây trước lượt đóng góp tiếp theo.`,
          429,
        );
      }
    });
    const event = await prisma.worldEvent.findUniqueOrThrow({
      where: { id: action.eventId },
      select: { contributionWoodCost: true },
    });
    return { message: `Đã đóng góp ${event.contributionWoodCost} gỗ và nhận 1 điểm sự kiện.` };
  }

  const current = await advanceWorld(userId, now);
  const result = await prisma.$transaction(async (tx) => {
    const participation = await tx.worldEventParticipation.findUnique({
      where: { eventId_userId: { eventId: action.eventId, userId } },
      include: { event: { select: { status: true, title: true } } },
    });
    if (!participation || participation.event.status !== "COMPLETED") {
      throw new WorldActionError("Chưa có phần thưởng để nhận.", 409);
    }
    if (participation.rewardClaimedAt) throw new WorldActionError("Phần thưởng đã được nhận.", 409);
    if (participation.rewardWood + participation.rewardStone === 0) {
      throw new WorldActionError("Sự kiện lần này không có phần thưởng dành cho bạn.", 409);
    }
    const base = await tx.worldBase.findUniqueOrThrow({ where: { userId } });
    const capacity = base.warehouseLevel * WORLD_RESOURCE_CAP_PER_WAREHOUSE_LEVEL;
    if (
      base.wood + participation.rewardWood > capacity ||
      base.stone + participation.rewardStone > capacity
    ) {
      throw new WorldActionError("Kho cần đủ chỗ cho toàn bộ phần thưởng trước khi nhận.", 409);
    }
    const claimed = await tx.worldEventParticipation.updateMany({
      where: { id: participation.id, rewardClaimedAt: null },
      data: { rewardClaimedAt: now },
    });
    if (!claimed.count) throw new WorldActionError("Phần thưởng vừa được nhận ở nơi khác.", 409);
    const credited = await tx.worldBase.updateMany({
      where: { id: base.id, version: current.version },
      data: {
        wood: { increment: participation.rewardWood },
        stone: { increment: participation.rewardStone },
        version: { increment: 1 },
      },
    });
    if (!credited.count) throw new WorldActionError("Thế giới vừa được cập nhật. Hãy thử nhận lại.", 409);
    return {
      wood: participation.rewardWood,
      stone: participation.rewardStone,
      title: participation.event.title,
    };
  });

  return { message: `Đã nhận thưởng ${result.title}: ${result.wood} gỗ, ${result.stone} đá.` };
}

export function isWorldActionError(error: unknown): error is WorldActionError {
  return error instanceof WorldActionError;
}

export function isWorldUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
