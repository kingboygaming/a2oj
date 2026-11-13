import { Prisma } from "@prisma/client";
import { randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  WORLD_BUILDING_DEFINITIONS,
  WORLD_BUILDING_PLOT_COUNT,
  WORLD_TRAINING_BUILDINGS,
  isWorldBuildingType,
  type WorldBuildingType,
  type WorldBuildingView,
} from "@/lib/world-buildings";

export const WORLD_OFFLINE_CAP_MS = 48 * 60 * 60 * 1000;
export const WORLD_RESOURCE_CAP_PER_WAREHOUSE_LEVEL = 2_000;
export const WORLD_MIN_TERRITORY_DISTANCE_METERS = 10_000;
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
  factoryLevel: number;
  warehouseLevel: number;
  castleLevel: number;
  castlePendingLevel: number | null;
  castleUpgradeCompletesAt: Date | null;
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
  cappedOfflineTime: boolean;
};

export type WorldSnapshot = {
  userId: string;
  now: string;
  buildings: WorldBuildingView[];
  base: {
    playerName: string;
    castleLevel: number;
    castlePendingLevel: number | null;
    castleUpgradeCompletesAt: string | null;
    coordinateX: number;
    coordinateZ: number;
    activePvpAttackId: string | null;
    pvpShieldUntil: string | null;
    wood: number;
    stone: number;
    factoryLevel: number;
    warehouseLevel: number;
    upgradeType: string | null;
    upgradeCompletesAt: string | null;
    lastSimulatedAt: string;
    capacity: number;
    woodPerHour: number;
    stonePerHour: number;
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
    pvpShieldUntil: string | null;
    activeAttack: boolean;
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
  resource: "wood" | "stone",
) {
  const buildingType = resource === "wood" ? "LUMBER_MILL" : "STONE_QUARRY";
  const ratePerLevel = resource === "wood" ? 20 : 10;
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
  const timeline = [...boundaries].sort((left, right) => left - right);
  let wood = base.wood;
  let stone = base.stone;
  let woodRemainder = base.woodRemainder;
  let stoneRemainder = base.stoneRemainder;

  for (let index = 0; index < timeline.length - 1; index++) {
    const start = timeline[index];
    const end = timeline[index + 1];
    const midpoint = start + (end - start) / 2;
    const factoryLevel = base.factoryLevel +
      (base.upgradeType === "FACTORY" && upgradeAt !== undefined && midpoint >= upgradeAt ? 1 : 0);
    const warehouseLevel = base.warehouseLevel +
      (base.upgradeType === "WAREHOUSE" && upgradeAt !== undefined && midpoint >= upgradeAt ? 1 : 0) +
      buildingLevelSumAt(buildings, "WAREHOUSE", midpoint);
    const capacity = warehouseLevel * WORLD_RESOURCE_CAP_PER_WAREHOUSE_LEVEL;
    wood = Math.min(wood, capacity);
    stone = Math.min(stone, capacity);
    const hours = (end - start) / 3_600_000;
    const woodRate = productionFor(factoryLevel, "wood") + buildingProductionAt(buildings, midpoint, "wood");
    const stoneRate = productionFor(factoryLevel, "stone") + buildingProductionAt(buildings, midpoint, "stone");
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
    wood = Math.min(wood, capacity);
    stone = Math.min(stone, capacity);
    if (wood >= capacity) woodRemainder = 0;
    if (stone >= capacity) stoneRemainder = 0;
  }

  const finalCapacity = worldResourceCapacity(nextWarehouseLevel, buildings, now.getTime());
  const finalWood = Math.floor(Math.min(finalCapacity, wood));
  const finalStone = Math.floor(Math.min(finalCapacity, stone));
  woodRemainder = finalWood >= finalCapacity ? 0 : Math.min(0.999_999_999, wood - finalWood);
  stoneRemainder = finalStone >= finalCapacity ? 0 : Math.min(0.999_999_999, stone - finalStone);

  return {
    wood: finalWood,
    woodRemainder,
    stone: finalStone,
    stoneRemainder,
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
    const progress = calculateWorldProgress(base, now, buildings);
    const updated = await prisma.worldBase.updateMany({
      where: { id: base.id, version: base.version },
      data: {
        wood: progress.wood,
        woodRemainder: progress.woodRemainder,
        stone: progress.stone,
        stoneRemainder: progress.stoneRemainder,
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
    select: { id: true },
  });
  let resolved = 0;
  let failed = 0;

  for (const { id } of dueAttacks) {
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
        const attackerPower = calculateCounterPower(attackingArmy, defendingArmy);
        const defenderPower = calculateCounterPower(defendingArmy, attackingArmy);
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
        const attackerProgress = calculateWorldProgress(attackerBase, now, attackerBuildings);
        const defenderProgress = calculateWorldProgress(defenderBase, now, defenderBuildings);
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
              factoryLevel: 0,
              warehouseLevel: 1,
              castleLevel: 1,
              castlePendingLevel: null,
              castleUpgradeCompletesAt: null,
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
      if (didResolve) resolved += 1;
    } catch (error) {
      failed += 1;
      console.error("World base attack resolution failed.", {
        attackId: id,
        error: errorText(error),
      });
    }
  }
  return { resolved, failed };
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
        const potentialDamage =
          march.infantry * TROOP_STATS.INFANTRY.damage +
          march.archers * TROOP_STATS.ARCHERS.damage +
          march.cavalry * TROOP_STATS.CAVALRY.damage;
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

export async function processScheduledWorldJobs(now = new Date()) {
  await ensureDailyWorldEvents(now);
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
  let failed = 0;

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

  return { processed, retried, failed, trained, marches, baseAttacks };
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
  const [events, pending, activeMarch, otherBases, baseAttacks, occupations] = await Promise.all([
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
        coordinateX: { not: null },
        coordinateZ: { not: null },
      },
      select: {
        userId: true,
        coordinateX: true,
        coordinateZ: true,
        activePvpAttackId: true,
        pvpShieldUntil: true,
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
  ]);

  const nearbyBases = otherBases
    .filter((otherBase) => otherBase.coordinateX !== null && otherBase.coordinateZ !== null)
    .map((otherBase) => ({
      userId: otherBase.userId,
      username: otherBase.user.username,
      displayName: otherBase.user.displayName || otherBase.user.username,
      coordinateX: otherBase.coordinateX!,
      coordinateZ: otherBase.coordinateZ!,
      distanceMeters: Math.round(
        Math.hypot(otherBase.coordinateX! - base.coordinateX!, otherBase.coordinateZ! - base.coordinateZ!),
      ),
      pvpShieldUntil: otherBase.pvpShieldUntil?.toISOString() ?? null,
      activeAttack: otherBase.activePvpAttackId !== null,
    }))
    .sort((left, right) => left.distanceMeters - right.distanceMeters)
    .slice(0, 20);

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
    base: {
      playerName: player.displayName || player.username,
      castleLevel: base.castleLevel,
      castlePendingLevel: base.castlePendingLevel,
      castleUpgradeCompletesAt: base.castleUpgradeCompletesAt?.toISOString() ?? null,
      coordinateX: base.coordinateX,
      coordinateZ: base.coordinateZ,
      activePvpAttackId: base.activePvpAttackId,
      pvpShieldUntil: base.pvpShieldUntil?.toISOString() ?? null,
      wood: base.wood,
      stone: base.stone,
      factoryLevel: base.factoryLevel,
      warehouseLevel: base.warehouseLevel,
      upgradeType: base.upgradeType,
      upgradeCompletesAt: base.upgradeCompletesAt?.toISOString() ?? null,
      lastSimulatedAt: base.lastSimulatedAt.toISOString(),
      capacity: worldResourceCapacity(base.warehouseLevel, baseBuildings, now.getTime()),
      woodPerHour:
        productionFor(base.factoryLevel, "wood") +
        buildingLevelSumAt(baseBuildings, "LUMBER_MILL", now.getTime()) * 20,
      stonePerHour:
        productionFor(base.factoryLevel, "stone") +
        buildingLevelSumAt(baseBuildings, "STONE_QUARRY", now.getTime()) * 10,
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

function eventIsActive(event: { startsAt: Date; endsAt: Date; status?: string }, now: Date) {
  return event.status !== "CANCELED" &&
    event.status !== "COMPLETED" &&
    event.startsAt <= now &&
    event.endsAt > now;
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
      if (currentLevel >= MAX_BUILDING_LEVEL) {
        throw new WorldActionError("Công trình đã đạt cấp tối đa.", 409);
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
      const travelMilliseconds =
        Math.ceil(distanceMeters / 10_000 * BASE_ATTACK_SECONDS_PER_10KM) * 1000;
      const arrivesAt = new Date(now.getTime() + travelMilliseconds);
      const created = await tx.worldBaseAttack.create({
        data: {
          attackerUserId: userId,
          defenderUserId: action.targetUserId,
          distanceMeters,
          infantry: action.infantry,
          archers: action.archers,
          cavalry: action.cavalry,
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
    if (base[troopField] + action.count > MAX_TROOPS_PER_TYPE) {
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
        [troopField]: { lte: MAX_TROOPS_PER_TYPE - action.count },
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
      return tx.worldMarch.create({
        data: {
          eventId: event.id,
          userId,
          infantry: action.infantry,
          archers: action.archers,
          cavalry: action.cavalry,
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
