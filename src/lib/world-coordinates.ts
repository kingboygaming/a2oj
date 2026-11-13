/**
 * A2 Kingdom — Coordinate System Architecture
 *
 * Single source of truth for every coordinate conversion in the game.
 *
 * Canonical units:
 * - World Coordinates (W_x, W_z): METERS, persisted in the database
 *   (WorldBase.coordinateX/Z). Never reinterpret stored values.
 * - Chunk Coordinates (C_x, C_z): discrete chunk indices, CHUNK_SIZE meters.
 * - Render Coordinates (R_x, R_z): Three.js scene units, player castle at (0, 0).
 * - Noise Coordinates (N_x, N_z): inputs to the procedural biome/height noise.
 *
 * Conversion chain:
 *   world (m) --/METERS_PER_RENDER_UNIT--> render (units)
 *   world (m) --/METERS_PER_NOISE_UNIT--> noise
 */

/** Metres per chunk edge. One chunk holds 1–2 resource nodes / a camp. */
export const CHUNK_SIZE = 20_000;

/** Metres represented by one Three.js render unit. */
export const METERS_PER_RENDER_UNIT = 200;

/** Metres per procedural noise unit (biome + height frequency). */
export const METERS_PER_NOISE_UNIT = 40;

/** Terrain mesh size in render units. Must cover the view radius. */
export const TERRAIN_SIZE_UNITS = 480;

/** Objects beyond this radius (render units) are not rendered. */
export const VIEW_RADIUS_UNITS = 220;

/** Same radius expressed in metres, used by server queries and validation. */
export const VIEW_RADIUS_METERS = VIEW_RADIUS_UNITS * METERS_PER_RENDER_UNIT;

/** City pad: terrain is flattened inside INNER and blends out by OUTER. */
export const CITY_PAD_INNER_UNITS = 26;
export const CITY_PAD_OUTER_UNITS = 45;

export interface WorldCoord {
  x: number;
  z: number;
}

export interface ChunkCoord {
  chunkX: number;
  chunkZ: number;
}

/** Convert world metres to chunk indices (negative-safe). */
export function worldToChunk(x: number, z: number): ChunkCoord {
  return {
    chunkX: Math.floor(x / CHUNK_SIZE),
    chunkZ: Math.floor(z / CHUNK_SIZE),
  };
}

/** Bottom-left (minimum) corner of a chunk, in world metres. */
export function chunkToWorldOrigin(chunkX: number, chunkZ: number): WorldCoord {
  return {
    x: chunkX * CHUNK_SIZE,
    z: chunkZ * CHUNK_SIZE,
  };
}

/** Centre of a chunk, in world metres. */
export function chunkToWorldCenter(chunkX: number, chunkZ: number): WorldCoord {
  return {
    x: chunkX * CHUNK_SIZE + CHUNK_SIZE / 2,
    z: chunkZ * CHUNK_SIZE + CHUNK_SIZE / 2,
  };
}

/** World metres to local coordinates inside the containing chunk [0, CHUNK_SIZE). */
export function worldToLocal(x: number, z: number): WorldCoord {
  const localX = x % CHUNK_SIZE;
  const localZ = z % CHUNK_SIZE;
  return {
    x: localX < 0 ? localX + CHUNK_SIZE : localX,
    z: localZ < 0 ? localZ + CHUNK_SIZE : localZ,
  };
}

/** Metres → render units. */
export function metersToRenderUnits(meters: number): number {
  return meters / METERS_PER_RENDER_UNIT;
}

/** Render units → metres. */
export function renderUnitsToMeters(units: number): number {
  return units * METERS_PER_RENDER_UNIT;
}

/**
 * Convert a world position (metres) to render coordinates (scene units)
 * relative to an anchor position (usually the player's base, in metres).
 */
export function worldToRender(
  worldX: number,
  worldZ: number,
  anchorWorldX: number,
  anchorWorldZ: number,
): WorldCoord {
  return {
    x: metersToRenderUnits(worldX - anchorWorldX),
    z: metersToRenderUnits(worldZ - anchorWorldZ),
  };
}

/** Convert render coordinates back to world metres. */
export function renderToWorld(
  renderX: number,
  renderZ: number,
  anchorWorldX: number,
  anchorWorldZ: number,
): WorldCoord {
  return {
    x: anchorWorldX + renderUnitsToMeters(renderX),
    z: anchorWorldZ + renderUnitsToMeters(renderZ),
  };
}

/** Unique string key for a chunk coordinate. */
export function chunkKey(chunkX: number, chunkZ: number): string {
  return `${chunkX},${chunkZ}`;
}

/** Parse a chunk key back into ChunkCoord. */
export function parseChunkKey(key: string): ChunkCoord {
  const [cx, cz] = key.split(",").map(Number);
  return { chunkX: cx, chunkZ: cz };
}

/** Distance in world metres between two world positions. */
export function worldDistance(x1: number, z1: number, x2: number, z2: number): number {
  return Math.hypot(x2 - x1, z2 - z1);
}

/** All chunks within `radius` chunks of a centre chunk. */
export function getSurroundingChunks(
  centerChunkX: number,
  centerChunkZ: number,
  radius = 1,
): ChunkCoord[] {
  const chunks: ChunkCoord[] = [];
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      chunks.push({
        chunkX: centerChunkX + dx,
        chunkZ: centerChunkZ + dz,
      });
    }
  }
  return chunks;
}

/**
 * Chunks intersecting a circle of `radiusMeters` around a world position.
 * Used by the server to generate the same region the client can render.
 */
export function getVisibleChunksAroundPosition(
  worldX: number,
  worldZ: number,
  radiusMeters = VIEW_RADIUS_METERS,
): ChunkCoord[] {
  const minChunkX = Math.floor((worldX - radiusMeters) / CHUNK_SIZE);
  const maxChunkX = Math.floor((worldX + radiusMeters) / CHUNK_SIZE);
  const minChunkZ = Math.floor((worldZ - radiusMeters) / CHUNK_SIZE);
  const maxChunkZ = Math.floor((worldZ + radiusMeters) / CHUNK_SIZE);

  const chunks: ChunkCoord[] = [];
  for (let cx = minChunkX; cx <= maxChunkX; cx++) {
    for (let cz = minChunkZ; cz <= maxChunkZ; cz++) {
      chunks.push({ chunkX: cx, chunkZ: cz });
    }
  }
  return chunks;
}
