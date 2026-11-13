/**
 * A2 Kingdom — Deterministic Procedural World Generation
 * 
 * Implements deterministic generation for:
 * - Terrain noise & Biomes per chunk
 * - Resource node distribution by biome
 * - NPC / Rogue camps tiered by distance from world center
 * - Stable IDs: same (worldSeed, chunkX, chunkZ) always yields exact same layout
 */

import { CHUNK_SIZE, chunkToWorldOrigin, chunkToWorldCenter } from "./world-coordinates";
import { getBiomeAtWorld, type BiomeType } from "@/components/world3d/terrain/BiomeManager";
import { WORLD_MAP_OBJECTS, type WorldMapObject, type ResourceNodeKind } from "./world-map-objects";

export const DEFAULT_WORLD_SEED = 20261113;

/* Distance thresholds are expressed in METRES. They were originally authored
   in render units (1 unit = 200 m) and scaled by METERS_PER_RENDER_UNIT so the
   difficulty gradient stays the same now that the world is generated in metres. */
const NODE_LEVEL_DISTANCE_METERS = 30_000;
const CAMP_TIER_2_DISTANCE_METERS = 24_000;
const CAMP_TIER_3_DISTANCE_METERS = 50_000;
const CAMP_ELITE_DISTANCE_METERS = 80_000;

/**
 * 32-bit integer hash combining worldSeed, chunkX, chunkZ
 */
export function hashChunkSeed(worldSeed: number, chunkX: number, chunkZ: number): number {
  let h = (worldSeed ^ (chunkX * 73856093)) ^ (chunkZ * 19349663);
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * Deterministic pseudo-random number generator (Mulberry32)
 */
export function createRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Pick resource types appropriate for a biome
 */
function getResourceKindsForBiome(biomeType: BiomeType): ResourceNodeKind[] {
  switch (biomeType) {
    case "FOREST":
      return ["FOREST", "FOREST", "FOOD_LAND"];
    case "MOUNTAIN":
      return ["IRON_MINE", "STONE_DEPOSIT", "RARE_RESOURCE"];
    case "DESERT":
      return ["STONE_DEPOSIT", "RARE_RESOURCE"];
    case "RIVER":
    case "LAKE":
    case "COAST":
      return ["FOOD_LAND", "STONE_DEPOSIT", "RARE_RESOURCE"];
    case "GRASSLAND":
    default:
      return ["FOOD_LAND", "FOREST", "STONE_DEPOSIT"];
  }
}

function resourceNodeName(kind: ResourceNodeKind, level: number): string {
  const prefix = level >= 4 ? "Đại " : level >= 3 ? "Thượng phẩm " : "";
  switch (kind) {
    case "FOREST":
      return `${prefix}Rừng Cây Cổ`;
    case "IRON_MINE":
      return `${prefix}Mỏ Quặng Sắt`;
    case "STONE_DEPOSIT":
      return `${prefix}Bãi Đá Thạch Anh`;
    case "FOOD_LAND":
      return `${prefix}Cánh Đồng Màu Mỡ`;
    case "RARE_RESOURCE":
      return `${prefix}Mạch Khoáng Tinh Thể`;
  }
}

function resourceNodeStats(kind: ResourceNodeKind, level: number) {
  const baseAmount = kind === "RARE_RESOURCE" ? 300 : 1200;
  const baseYield = kind === "RARE_RESOURCE" ? 5 : 24;
  const basePower = kind === "RARE_RESOURCE" ? 250 : 70;

  return {
    amount: baseAmount * level,
    yieldPerMinute: Math.round(baseYield * (1 + (level - 1) * 0.4)),
    requiredPower: basePower * level,
  };
}

/**
 * Generate all deterministic objects (Resource Nodes, Rogue Camps) for a chunk.
 */
export function generateChunkObjects(
  chunkX: number,
  chunkZ: number,
  worldSeed = DEFAULT_WORLD_SEED,
): WorldMapObject[] {
  // If this is chunk (0,0), preserve a peaceful zone around the center if needed,
  // or generate standard layout.
  const seed = hashChunkSeed(worldSeed, chunkX, chunkZ);
  const rand = createRng(seed);

  const origin = chunkToWorldOrigin(chunkX, chunkZ);
  const center = chunkToWorldCenter(chunkX, chunkZ);
  const biome = getBiomeAtWorld(center.x, center.z);
  const distFromCenter = Math.hypot(center.x, center.z);

  const objects: WorldMapObject[] = [];

  // Determine number of resource nodes in this chunk (1 to 2 nodes per chunk)
  const nodeCount = 1 + Math.floor(rand() * 2);
  const availableKinds = getResourceKindsForBiome(biome.type);

  for (let i = 0; i < nodeCount; i++) {
    const kind = availableKinds[Math.floor(rand() * availableKinds.length)];
    // Node level based on distance from center + randomness
    const baseLevel = Math.min(5, Math.max(1, 1 + Math.floor(distFromCenter / NODE_LEVEL_DISTANCE_METERS) + Math.floor(rand() * 2)));
    const stats = resourceNodeStats(kind, baseLevel);

    // Position within chunk with margin
    const localX = 15 + Math.floor(rand() * (CHUNK_SIZE - 30));
    const localZ = 15 + Math.floor(rand() * (CHUNK_SIZE - 30));
    const worldX = origin.x + localX;
    const worldZ = origin.z + localZ;

    objects.push({
      id: `gen_res_${chunkX}_${chunkZ}_${i}`,
      kind: "RESOURCE",
      name: resourceNodeName(kind, baseLevel),
      resource: kind,
      level: baseLevel,
      amount: stats.amount,
      yieldPerMinute: stats.yieldPerMinute,
      requiredPower: stats.requiredPower,
      x: worldX,
      z: worldZ,
    });
  }

  // Determine if this chunk has a rogue camp (~40% of chunks have a camp)
  const hasCamp = rand() < 0.45;
  if (hasCamp) {
    let tier: "LEVEL_1" | "LEVEL_2" | "LEVEL_3" | "ELITE";
    let monsterType: string;
    let level: number;
    let troopCount: number;
    let combatPower: number;
    let reward: string;
    let rewardItemKey: string;

    if (distFromCenter < CAMP_TIER_2_DISTANCE_METERS) {
      tier = "LEVEL_1";
      monsterType = "Goblin";
      level = 1;
      troopCount = 20 + Math.floor(rand() * 15);
      combatPower = 80 + Math.floor(rand() * 30);
      reward = "Gỗ, đá và kinh nghiệm";
      rewardItemKey = "GOBLIN_FANG";
    } else if (distFromCenter < CAMP_TIER_3_DISTANCE_METERS) {
      tier = "LEVEL_2";
      monsterType = "Sói hoang";
      level = 2;
      troopCount = 40 + Math.floor(rand() * 20);
      combatPower = 160 + Math.floor(rand() * 50);
      reward = "Gỗ, đá và nguyên liệu";
      rewardItemKey = "WOLF_PELT";
    } else if (distFromCenter < CAMP_ELITE_DISTANCE_METERS) {
      tier = "LEVEL_3";
      monsterType = "Lưu khấu";
      level = 3;
      troopCount = 80 + Math.floor(rand() * 30);
      combatPower = 300 + Math.floor(rand() * 80);
      reward = "Tài nguyên và vật phẩm nâng cấp";
      rewardItemKey = "BANDIT_TOKEN";
    } else {
      tier = "ELITE";
      monsterType = "Quái tinh anh";
      level = 5;
      troopCount = 130 + Math.floor(rand() * 40);
      combatPower = 500 + Math.floor(rand() * 120);
      reward = "Vật phẩm hiếm và nguyên liệu chế tạo";
      rewardItemKey = "ELITE_CORE";
    }

    const localX = 20 + Math.floor(rand() * (CHUNK_SIZE - 40));
    const localZ = 20 + Math.floor(rand() * (CHUNK_SIZE - 40));
    const worldX = origin.x + localX;
    const worldZ = origin.z + localZ;

    objects.push({
      id: `gen_camp_${chunkX}_${chunkZ}`,
      kind: "ROGUE_CAMP",
      name: `Trại ${monsterType} Cấp ${level}`,
      monsterType,
      tier,
      level,
      troopCount,
      combatPower,
      reward,
      rewardItemKey,
      x: worldX,
      z: worldZ,
    });
  }

  return objects;
}

/**
 * Resolve any map object by ID — static or procedural.
 * If targetId starts with gen_res_ or gen_camp_, deterministically reconstructs it.
 */
export function resolveWorldMapObject(
  targetId: string,
  worldSeed = DEFAULT_WORLD_SEED,
): WorldMapObject | null {
  const staticObj = WORLD_MAP_OBJECTS.find((o) => o.id === targetId);
  if (staticObj) return staticObj;

  const resMatch = /^gen_res_(-?\d+)_(-?\d+)_(\d+)$/.exec(targetId);
  if (resMatch) {
    const chunkX = parseInt(resMatch[1], 10);
    const chunkZ = parseInt(resMatch[2], 10);
    const chunkObjects = generateChunkObjects(chunkX, chunkZ, worldSeed);
    return chunkObjects.find((o) => o.id === targetId) ?? null;
  }

  const campMatch = /^gen_camp_(-?\d+)_(-?\d+)$/.exec(targetId);
  if (campMatch) {
    const chunkX = parseInt(campMatch[1], 10);
    const chunkZ = parseInt(campMatch[2], 10);
    const chunkObjects = generateChunkObjects(chunkX, chunkZ, worldSeed);
    return chunkObjects.find((o) => o.id === targetId) ?? null;
  }

  return null;
}

