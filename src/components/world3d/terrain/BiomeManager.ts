/* ── Biome definitions and procedural noise for A2 Kingdom terrain ── */

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
    heightRange: [0, 3],
    vegetationDensity: 0.5,
  },
  FOREST: {
    type: "FOREST",
    color: [0.18, 0.38, 0.14],
    accent: [0.14, 0.32, 0.1],
    heightRange: [1, 6],
    vegetationDensity: 1.0,
  },
  MOUNTAIN: {
    type: "MOUNTAIN",
    color: [0.45, 0.42, 0.38],
    accent: [0.6, 0.58, 0.55],
    heightRange: [12, 30],
    vegetationDensity: 0.1,
  },
  DESERT: {
    type: "DESERT",
    color: [0.76, 0.65, 0.42],
    accent: [0.82, 0.72, 0.5],
    heightRange: [0, 2],
    vegetationDensity: 0.05,
  },
  RIVER: {
    type: "RIVER",
    color: [0.22, 0.42, 0.32],
    accent: [0.18, 0.36, 0.28],
    heightRange: [-1, 0],
    vegetationDensity: 0.3,
  },
  LAKE: {
    type: "LAKE",
    color: [0.2, 0.38, 0.3],
    accent: [0.16, 0.34, 0.26],
    heightRange: [-2, -0.5],
    vegetationDensity: 0.1,
  },
  COAST: {
    type: "COAST",
    color: [0.72, 0.68, 0.52],
    accent: [0.65, 0.6, 0.45],
    heightRange: [0, 1],
    vegetationDensity: 0.2,
  },
};

/* ── Simple hash-based 2D noise (no external library) ── */

function hash2d(ix: number, iy: number): number {
  let h = ix * 374761393 + iy * 668265263;
  h = ((h ^ (h >> 13)) * 1274126177) | 0;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
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

export function getHeightAt(x: number, z: number): number {
  const biome = getBiomeAt(x, z);
  const [minH, maxH] = biome.heightRange;

  const base = fbm(x * WORLD_SCALE + 100, z * WORLD_SCALE + 100, 6);
  const detail = fbm(x * WORLD_SCALE * 3 + 50, z * WORLD_SCALE * 3 + 50, 3) * 0.3;
  const combined = base + detail;

  let height = minH + combined * (maxH - minH);

  // River carving
  const riverNoise = fbm(x * 0.005 + 200, z * 0.005 + 200, 2);
  const riverWidth = 0.05;
  if (Math.abs(riverNoise - 0.5) < riverWidth && biome.type !== "MOUNTAIN") {
    height = Math.min(height, -0.5);
  }

  return height;
}

export function getBiomeAt(x: number, z: number): BiomeInfo {
  const temperature = fbm(x * BIOME_SCALE + 300, z * BIOME_SCALE + 300, 3);
  const moisture = fbm(x * BIOME_SCALE + 500, z * BIOME_SCALE + 500, 3);
  const elevation = fbm(x * BIOME_SCALE * 1.5, z * BIOME_SCALE * 1.5, 4);

  // River detection
  const riverNoise = fbm(x * 0.005 + 200, z * 0.005 + 200, 2);
  if (Math.abs(riverNoise - 0.5) < 0.04) return BIOME_DEFS.RIVER;

  // Lake detection
  const lakeNoise = fbm(x * 0.006 + 400, z * 0.006 + 400, 2);
  if (lakeNoise < 0.25 && elevation < 0.35) return BIOME_DEFS.LAKE;

  // Elevation-based biomes
  if (elevation > 0.7) return BIOME_DEFS.MOUNTAIN;
  if (elevation > 0.6) {
    // Mountain foothills blend
    return temperature > 0.5 ? BIOME_DEFS.MOUNTAIN : BIOME_DEFS.FOREST;
  }

  // Temperature and moisture
  if (temperature > 0.65 && moisture < 0.35) return BIOME_DEFS.DESERT;
  if (moisture > 0.55) return BIOME_DEFS.FOREST;

  // Coast near water
  if (elevation < 0.25 && lakeNoise < 0.35) return BIOME_DEFS.COAST;

  return BIOME_DEFS.GRASSLAND;
}

export function getBiomeColor(
  x: number,
  z: number
): [number, number, number] {
  const biome = getBiomeAt(x, z);
  const variation = valueNoise2d(x * 0.05, z * 0.05);
  return [
    lerp(biome.color[0], biome.accent[0], variation),
    lerp(biome.color[1], biome.accent[1], variation),
    lerp(biome.color[2], biome.accent[2], variation),
  ];
}
