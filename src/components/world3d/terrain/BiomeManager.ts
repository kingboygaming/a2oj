/* ── Biome definitions and procedural noise for A2 Kingdom terrain ── */
/* Stored world coordinates are metres. They are divided by
   METERS_PER_NOISE_UNIT before being used as noise inputs, so biome regions
   are a few render units wide (≈3–6 units at 200 m/unit). */
import {
  CITY_PAD_INNER_UNITS,
  CITY_PAD_OUTER_UNITS,
  METERS_PER_NOISE_UNIT,
  METERS_PER_RENDER_UNIT,
} from "@/lib/world-coordinates";

export type BiomeType =
  | "GRASSLAND"
  | "FOREST"
  | "MOUNTAIN"
  | "DESERT"
  | "RIVER"
  | "LAKE"
  | "COAST";

export interface BiomeInfo {
  type: BiomeType;
  color: [number, number, number];
  accent: [number, number, number];
  heightRange: [number, number];
  vegetationDensity: number;
}

const BIOME_DEFS: Record<BiomeType, BiomeInfo> = {
  GRASSLAND: {
    type: "GRASSLAND",
    color: [0.36, 0.56, 0.24],
    accent: [0.42, 0.62, 0.28],
    // Informational only: terrain height is a continuous field, not per-biome.
    heightRange: [0, 9],
    vegetationDensity: 0.5,
  },
  FOREST: {
    type: "FOREST",
    color: [0.18, 0.38, 0.14],
    accent: [0.14, 0.32, 0.1],
    heightRange: [1, 12],
    vegetationDensity: 1.0,
  },
  MOUNTAIN: {
    type: "MOUNTAIN",
    color: [0.45, 0.42, 0.38],
    accent: [0.6, 0.58, 0.55],
    heightRange: [14, 38],
    vegetationDensity: 0.1,
  },
  DESERT: {
    type: "DESERT",
    color: [0.76, 0.65, 0.42],
    accent: [0.82, 0.72, 0.5],
    heightRange: [0, 6],
    vegetationDensity: 0.05,
  },
  RIVER: {
    type: "RIVER",
    color: [0.22, 0.42, 0.32],
    accent: [0.18, 0.36, 0.28],
    heightRange: [-2.5, 0.3],
    vegetationDensity: 0.3,
  },
  LAKE: {
    type: "LAKE",
    color: [0.2, 0.38, 0.3],
    accent: [0.16, 0.34, 0.26],
    heightRange: [-2.5, 0.3],
    vegetationDensity: 0.1,
  },
  COAST: {
    type: "COAST",
    color: [0.72, 0.68, 0.52],
    accent: [0.65, 0.6, 0.45],
    heightRange: [-0.5, 2.5],
    vegetationDensity: 0.2,
  },
};

/* ── Simple hash-based 2D noise (no external library) ── */

function hash2d(ix: number, iy: number): number {
  // Unsigned shifts keep the full 32-bit range; the previous version used
  // arithmetic shifts and could only ever return values below 0.5, which made
  // every biome threshold above 0.5 unreachable.
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function valueNoise2d(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smoothstep(x - ix);
  const fy = smoothstep(y - iy);

  const a = hash2d(ix, iy);
  const b = hash2d(ix + 1, iy);
  const c = hash2d(ix, iy + 1);
  const d = hash2d(ix + 1, iy + 1);

  return lerp(lerp(a, b, fx), lerp(c, d, fx), fy);
}

function fbm(x: number, y: number, octaves: number, lacunarity = 2.0, gain = 0.5): number {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxAmplitude = 0;

  for (let i = 0; i < octaves; i++) {
    value += valueNoise2d(x * frequency, y * frequency) * amplitude;
    maxAmplitude += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }

  return value / maxAmplitude;
}

/* ── Public API ── */

const WORLD_SCALE = 0.012;
const BIOME_SCALE = 0.008;
const RIDGE_SCALE = 0.02;

/** Water plane height in render units. */
export const WATER_LEVEL = 0.3;

/* Continuous height model. Elevation is a smooth 0..1 field; height is a
   smooth function of it, so two neighbouring biomes can never produce a
   vertical cliff at their boundary. */
const BASE_HEIGHT = -0.4;
const PLAINS_HEIGHT = 4.2;
const PEAK_HEIGHT = 20;
const RIDGE_HEIGHT = 4;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** Smoothstep between two edges (0 below edge0, 1 above edge1). */
function smoothstepRange(edge0: number, edge1: number, value: number): number {
  return smoothstep(clamp01((value - edge0) / (edge1 - edge0)));
}

interface TerrainFields {
  temperature: number;
  moisture: number;
  elevation: number;
  riverNoise: number;
  /** 1 at the centre of a river, fading to 0 at the banks. */
  riverMask: number;
  /** 1 at the centre of a lake, fading to 0 at the shore. */
  lakeMask: number;
}

function sampleFields(nx: number, nz: number): TerrainFields {
  const temperature = fbm(nx * BIOME_SCALE + 300, nz * BIOME_SCALE + 300, 3);
  const moisture = fbm(nx * BIOME_SCALE + 500, nz * BIOME_SCALE + 500, 3);
  const elevation = fbm(nx * BIOME_SCALE, nz * BIOME_SCALE, 4);

  const riverNoise = fbm(nx * 0.005 + 200, nz * 0.005 + 200, 2);
  // Wide, smooth valley profile. The carve depth is capped in noiseHeight, so
  // a river crossing a mountain becomes a shallow valley instead of a canyon.
  const riverMask = 1 - smoothstepRange(0.02, 0.16, Math.abs(riverNoise - 0.5));

  const lakeNoise = fbm(nx * 0.006 + 400, nz * 0.006 + 400, 2);
  const lakeMask =
    (1 - smoothstepRange(0.1, 0.3, lakeNoise)) *
    (1 - smoothstepRange(0.3, 0.5, elevation));

  return { temperature, moisture, elevation, riverNoise, riverMask, lakeMask };
}

type BiomeWeights = Record<BiomeType, number>;

/** Fixed order makes dominant-biome tie-breaking deterministic. */
const BIOME_WEIGHT_ORDER: BiomeType[] = [
  "MOUNTAIN",
  "DESERT",
  "FOREST",
  "COAST",
  "GRASSLAND",
  "RIVER",
  "LAKE",
];

/**
 * Normalised LAND biome weights. Assigned sequentially from the remaining
 * weight so the sum is always 1 and colours can be blended without banding.
 * Water is decided from the carved height, not from this distribution.
 */
function computeLandWeights(fields: TerrainFields): BiomeWeights {
  const { temperature, moisture, elevation } = fields;

  let remaining = 1;
  const mountain = remaining * smoothstepRange(0.6, 0.82, elevation);
  remaining -= mountain;
  const desert = remaining *
    smoothstepRange(0.58, 0.72, temperature) *
    (1 - smoothstepRange(0.3, 0.5, moisture));
  remaining -= desert;
  const forest = remaining * smoothstepRange(0.45, 0.65, moisture);
  remaining -= forest;
  const coast = remaining * (1 - smoothstepRange(0.26, 0.42, elevation));
  remaining -= coast;
  const grassland = remaining;

  return {
    MOUNTAIN: mountain,
    DESERT: desert,
    FOREST: forest,
    COAST: coast,
    GRASSLAND: grassland,
    RIVER: 0,
    LAKE: 0,
  };
}

function waterBiomeType(fields: TerrainFields): BiomeType {
  return fields.riverMask >= fields.lakeMask ? "RIVER" : "LAKE";
}

function dominantBiome(weights: BiomeWeights): BiomeType {
  let best: BiomeType = "GRASSLAND";
  let bestWeight = -1;
  for (const type of BIOME_WEIGHT_ORDER) {
    if (weights[type] > bestWeight) {
      bestWeight = weights[type];
      best = type;
    }
  }
  return best;
}

/** Height in render units for a point already expressed in noise space. */
function noiseHeight(fields: TerrainFields, nx: number, nz: number): number {
  const elevation = fields.elevation;

  const detail = fbm(nx * WORLD_SCALE * 3 + 50, nz * WORLD_SCALE * 3 + 50, 3);
  const ridgeNoise = fbm(nx * RIDGE_SCALE + 700, nz * RIDGE_SCALE + 700, 4);
  const ridge = 1 - Math.abs(ridgeNoise * 2 - 1);
  const mountainInfluence = smoothstepRange(0.62, 0.85, elevation);

  let height =
    BASE_HEIGHT +
    smoothstep(elevation) * PLAINS_HEIGHT +
    elevation ** 3 * PEAK_HEIGHT +
    ridge * mountainInfluence * RIDGE_HEIGHT +
    (detail - 0.5) * 0.6;

  // Carve rivers and lakes smoothly. The bed never drops more than a few units
  // below the surrounding terrain, which keeps banks walkable and cliff-free.
  const riverBed = Math.max(WATER_LEVEL - 1, height - 3);
  height = lerp(height, riverBed, fields.riverMask);
  const lakeBed = Math.max(WATER_LEVEL - 1.4, height - 3.5);
  height = lerp(height, lakeBed, fields.lakeMask);

  return height;
}

/** Terrain height (render units) at a world position in metres. */
export function getHeightAtWorld(worldXMeters: number, worldZMeters: number): number {
  const nx = worldXMeters / METERS_PER_NOISE_UNIT;
  const nz = worldZMeters / METERS_PER_NOISE_UNIT;
  return noiseHeight(sampleFields(nx, nz), nx, nz);
}

/**
 * Terrain height at a render-space position, anchored to the player's base.
 * Includes a smooth "city pad" so the castle and building plots sit on a
 * level platform instead of straddling a slope.
 */
export function heightAtRender(
  renderX: number,
  renderZ: number,
  anchorWorldX: number,
  anchorWorldZ: number,
): number {
  const worldX = anchorWorldX + renderX * METERS_PER_RENDER_UNIT;
  const worldZ = anchorWorldZ + renderZ * METERS_PER_RENDER_UNIT;
  const height = getHeightAtWorld(worldX, worldZ);

  const distance = Math.hypot(renderX, renderZ);
  if (distance >= CITY_PAD_OUTER_UNITS) return height;

  const raw = (CITY_PAD_OUTER_UNITS - distance) /
    (CITY_PAD_OUTER_UNITS - CITY_PAD_INNER_UNITS);
  const blend = smoothstep(clamp01(raw));
  const anchorHeight = getHeightAtWorld(anchorWorldX, anchorWorldZ);
  return height + (anchorHeight - height) * blend;
}

export function getBiomeAt(x: number, z: number): BiomeInfo {
  const fields = sampleFields(x, z);
  const height = noiseHeight(fields, x, z);
  if (height < WATER_LEVEL) return BIOME_DEFS[waterBiomeType(fields)];
  return BIOME_DEFS[dominantBiome(computeLandWeights(fields))];
}

export function getBiomeColor(
  x: number,
  z: number,
): [number, number, number] {
  const weights = computeLandWeights(sampleFields(x, z));
  const variation = valueNoise2d(x * 0.05, z * 0.05);

  let red = 0;
  let green = 0;
  let blue = 0;
  for (const type of BIOME_WEIGHT_ORDER) {
    const weight = weights[type];
    if (weight <= 0) continue;
    const biome = BIOME_DEFS[type];
    red += weight * lerp(biome.color[0], biome.accent[0], variation);
    green += weight * lerp(biome.color[1], biome.accent[1], variation);
    blue += weight * lerp(biome.color[2], biome.accent[2], variation);
  }
  return [red, green, blue];
}

/** Biome at a world position in metres (server + client share this). */
export function getBiomeAtWorld(worldXMeters: number, worldZMeters: number): BiomeInfo {
  return getBiomeAt(
    worldXMeters / METERS_PER_NOISE_UNIT,
    worldZMeters / METERS_PER_NOISE_UNIT,
  );
}

/** Biome colour at a world position in metres. */
export function getBiomeColorWorld(
  worldXMeters: number,
  worldZMeters: number,
): [number, number, number] {
  return getBiomeColor(
    worldXMeters / METERS_PER_NOISE_UNIT,
    worldZMeters / METERS_PER_NOISE_UNIT,
  );
}
