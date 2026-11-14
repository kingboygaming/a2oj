import { prisma } from "@/lib/prisma";
import {
  WORLD_REALTIME_EVENT,
  worldRealtimeTopic,
  worldRegionKey,
  type WorldRealtimeChange,
  type WorldRealtimeMessage,
} from "@/lib/world-realtime";
import { resolveWorldMapObject } from "@/lib/world-generation";

/**
 * Server -> Supabase Broadcast bridge.
 *
 * Vercel cannot host a persistent WebSocket server, so every mutation publishes
 * a tiny hint through Supabase's REST broadcast endpoint. Hints only contain
 * `{ kind, id, version }`; clients always re-fetch authoritative rows from
 * `/api/world/entities`.
 *
 * Failure here must never fail the user action: broadcasts are best effort and
 * clients fall back to polling.
 */

const BROADCAST_TIMEOUT_MS = 2_500;

function supabaseUrl() {
  return process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
}

function serviceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? null;
}

/** True when realtime hints can be published from this deployment. */
export function isWorldRealtimeBroadcastConfigured() {
  return Boolean(supabaseUrl() && serviceRoleKey());
}

function newEventId() {
  return globalThis.crypto.randomUUID();
}

async function publishChanges(regionKey: string, changes: WorldRealtimeChange[]) {
  const url = supabaseUrl();
  const key = serviceRoleKey();
  if (!url || !key || changes.length === 0) return;

  const message: WorldRealtimeMessage = {
    v: 1,
    eventId: newEventId(),
    at: new Date().toISOString(),
    changes,
  };

  try {
    const response = await fetch(`${url.replace(/\/+$/, "")}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            topic: worldRealtimeTopic(regionKey),
            event: WORLD_REALTIME_EVENT,
            payload: message,
            private: false,
          },
        ],
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(BROADCAST_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.warn(
        `[world-realtime] broadcast failed (${response.status}) for ${regionKey}`,
      );
    }
  } catch (error) {
    // Network/timeout errors are expected during local dev without Supabase.
    console.warn(
      `[world-realtime] broadcast error for ${regionKey}:`,
      error instanceof Error ? error.message : error,
    );
  }
}

/**
 * Publish one map-object hint to the region that contains the object. A client
 * only renders objects inside its own view radius, and its subscriptions cover
 * every region that view touches, so the object's own region is enough.
 */
export async function broadcastMapObjectChange(targetId: string): Promise<void> {
  await broadcastWorldChanges([{ kind: "MAP_OBJECT", id: targetId }]);
}

/** Publish base hints (attacker + defender) grouped by their region. */
export async function broadcastBaseChanges(userIds: string[]): Promise<void> {
  await broadcastWorldChanges(userIds.map((id) => ({ kind: "BASE" as const, id })));
}

/**
 * Resolve mixed hints to the regions that contain them and publish one message
 * per region. Every hint is best effort: failures are logged and swallowed so a
 * Supabase outage never fails the underlying action.
 */
export async function broadcastWorldChanges(changes: WorldRealtimeChange[]): Promise<void> {
  if (!isWorldRealtimeBroadcastConfigured() || changes.length === 0) return;

  const byRegion = new Map<string, WorldRealtimeChange[]>();
  const add = (regionKey: string, change: WorldRealtimeChange) => {
    const list = byRegion.get(regionKey) ?? [];
    list.push(change);
    byRegion.set(regionKey, list);
  };

  const userIds = new Set<string>();
  const mapObjectIds = new Set<string>();
  try {
    for (const change of changes) {
      if (change.kind === "MAP_OBJECT") mapObjectIds.add(change.id);
      else if (change.kind === "BASE") userIds.add(change.id);
    }
    for (const id of mapObjectIds) {
      const definition = resolveWorldMapObject(id);
      if (definition) add(worldRegionKey(definition.x, definition.z), { kind: "MAP_OBJECT", id: definition.id });
    }
  } catch (error) {
    console.warn("[world-realtime] map object hint skipped:", error instanceof Error ? error.message : error);
  }

  if (userIds.size > 0) {
    try {
      const bases = await prisma.worldBase.findMany({
        where: { userId: { in: [...userIds] } },
        select: { userId: true, coordinateX: true, coordinateZ: true, version: true },
      });
      for (const base of bases) {
        if (base.coordinateX === null || base.coordinateZ === null) continue;
        add(worldRegionKey(base.coordinateX, base.coordinateZ), {
          kind: "BASE",
          id: base.userId,
          version: base.version,
        });
      }
    } catch (error) {
      console.warn("[world-realtime] base hint skipped:", error instanceof Error ? error.message : error);
    }
  }

  await Promise.all(
    [...byRegion.entries()].map(([regionKey, regionChanges]) => publishChanges(regionKey, regionChanges)),
  );
}

/**
 * Publish hints after the current response is flushed.
 *
 * Scheduled world jobs run inside a request (page render, action handler), so
 * `after()` keeps the broadcast off the response's critical path while still
 * letting Vercel finish it. Outside a Next request (scripts, tests) `after()`
 * throws and we fall back to awaiting the publish directly.
 *
 * `next/server` is imported lazily: importing it from a module that the Pages
 * Router bundle also reaches fails at runtime, and this helper only ever runs
 * inside App Router requests.
 */
export async function queueWorldRealtimeChanges(changes: WorldRealtimeChange[]): Promise<void> {
  if (!isWorldRealtimeBroadcastConfigured() || changes.length === 0) return;
  const unique = new Map<string, WorldRealtimeChange>();
  for (const change of changes.slice(0, 50)) {
    unique.set(`${change.kind}:${change.id}`, change);
  }
  const publish = () => broadcastWorldChanges([...unique.values()]);
  try {
    const { after } = await import("next/server");
    after(publish);
    return;
  } catch {
    // Not inside a request scope (scripts, tests): publish inline instead.
  }
  await publish();
}
