import { VIEW_RADIUS_METERS, worldToChunk } from "./world-coordinates";
import type { WorldEntitiesPayload } from "./world";

export type { WorldEntitiesPayload } from "./world";

/**
 * A2 Kingdom realtime contract.
 *
 * Realtime is a *hint channel* only: it tells the client which entities changed
 * so it can fetch the authoritative rows from `/api/world/entities`. Nothing in
 * a broadcast is trusted, and private data (resources, army, items) is never
 * published.
 */

/** One realtime region covers 5 chunks (100 km) so a 44 km view radius touches
 * at most 2 regions per axis (usually exactly 1). */
export const WORLD_REALTIME_REGION_CHUNKS = 5;
export const WORLD_REALTIME_CHANNEL_PREFIX = "world:region:";
export const WORLD_REALTIME_EVENT = "world-change";

/** Coalesce bursts of hints into one entity request. */
export const WORLD_REALTIME_BATCH_MS = 400;
/** Max map-object ids a single `/api/world/entities?ids=` request may carry. */
export const WORLD_ENTITY_MAX_OBJECTS = 40;
/** Fallback polling cadence while realtime is unavailable. */
export const WORLD_REALTIME_POLL_MS = 12_000;
/** Safety resync while realtime is healthy (broadcasts are at-most-once). */
export const WORLD_REALTIME_RESYNC_MS = 5 * 60_000;
export const WORLD_REALTIME_MAX_BACKOFF_MS = 60_000;

export type WorldRealtimeKind = "BASE" | "MAP_OBJECT";

export type WorldRealtimeChange = {
  kind: WorldRealtimeKind;
  /** `WorldBase.userId` for BASE, `WorldMapObject.id` for MAP_OBJECT. */
  id: string;
  /** Optional optimistic version used only to coalesce duplicate hints. */
  version?: number;
};

export type WorldRealtimeMessage = {
  v: 1;
  eventId: string;
  at: string;
  changes: WorldRealtimeChange[];
};

export type WorldEntityPayload = WorldEntitiesPayload;

const SAFE_ID = /^[A-Za-z0-9_-]{1,80}$/;

export function worldRegionKey(x: number, z: number) {
  const chunk = worldToChunk(x, z);
  const regionX = Math.floor(chunk.chunkX / WORLD_REALTIME_REGION_CHUNKS);
  const regionZ = Math.floor(chunk.chunkZ / WORLD_REALTIME_REGION_CHUNKS);
  return `${regionX}:${regionZ}`;
}

/** Region topics covering the square view radius around a position. */
export function worldRegionsForView(
  x: number,
  z: number,
  radiusMeters = VIEW_RADIUS_METERS,
): string[] {
  const regions = new Set<string>();
  for (const offsetX of [-radiusMeters, radiusMeters]) {
    for (const offsetZ of [-radiusMeters, radiusMeters]) {
      regions.add(worldRegionKey(x + offsetX, z + offsetZ));
    }
  }
  return [...regions];
}

export function worldRealtimeTopic(regionKey: string) {
  return `${WORLD_REALTIME_CHANNEL_PREFIX}${regionKey}`;
}

/** Exponential fallback backoff: 12s, 24s, 48s, then capped at 60s. */
export function worldRealtimeBackoffDelay(failures: number) {
  return Math.min(
    WORLD_REALTIME_MAX_BACKOFF_MS,
    WORLD_REALTIME_POLL_MS * 2 ** Math.min(Math.max(failures, 0), 4),
  );
}

/** Bounded LRU used to drop duplicate broadcast deliveries. */
export function createWorldRealtimeDedupe(limit = 200) {
  const seen = new Set<string>();
  const order: string[] = [];
  return {
    isDuplicate(eventId: string) {
      if (seen.has(eventId)) return true;
      seen.add(eventId);
      order.push(eventId);
      if (order.length > limit) {
        const oldest = order.shift();
        if (oldest) seen.delete(oldest);
      }
      return false;
    },
  };
}

/** Strict runtime validation: broadcast payloads are untrusted input. */
export function parseWorldRealtimeMessage(payload: unknown): WorldRealtimeMessage | null {
  if (!payload || typeof payload !== "object") return null;
  const candidate = payload as Partial<WorldRealtimeMessage>;
  if (candidate.v !== 1) return null;
  if (typeof candidate.eventId !== "string" || !SAFE_ID.test(candidate.eventId)) return null;
  if (typeof candidate.at !== "string" || candidate.at.length > 40) return null;
  if (!Array.isArray(candidate.changes)) return null;

  const changes: WorldRealtimeChange[] = [];
  for (const entry of candidate.changes.slice(0, 50)) {
    if (!entry || typeof entry !== "object") continue;
    const change = entry as Partial<WorldRealtimeChange>;
    if (change.kind !== "BASE" && change.kind !== "MAP_OBJECT") continue;
    if (typeof change.id !== "string" || !SAFE_ID.test(change.id)) continue;
    changes.push({
      kind: change.kind,
      id: change.id,
      version: typeof change.version === "number" && Number.isFinite(change.version)
        ? change.version
        : undefined,
    });
  }
  if (changes.length === 0) return null;

  return { v: 1, eventId: candidate.eventId, at: candidate.at, changes };
}
