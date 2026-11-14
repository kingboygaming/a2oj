"use client";

import { useEffect, useRef, useState } from "react";
import {
  createClient,
  type RealtimeChannel,
  type SupabaseClient,
} from "@supabase/supabase-js";
import {
  WORLD_REALTIME_BATCH_MS,
  WORLD_REALTIME_EVENT,
  WORLD_REALTIME_POLL_MS,
  WORLD_REALTIME_RESYNC_MS,
  WORLD_ENTITY_MAX_OBJECTS,
  createWorldRealtimeDedupe,
  parseWorldRealtimeMessage,
  worldRealtimeBackoffDelay,
  worldRealtimeTopic,
  worldRegionsForView,
  type WorldEntityPayload,
  type WorldRealtimeChange,
} from "@/lib/world-realtime";
import { VIEW_RADIUS_METERS } from "@/lib/world-coordinates";

export type WorldRealtimeStatus = "connecting" | "live" | "polling" | "offline";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const HAS_REALTIME = Boolean(SUPABASE_URL && SUPABASE_KEY);

/** Remember this many broadcast ids so duplicate deliveries are ignored. */
const MAX_SEEN_EVENTS = 200;
/** Retry cadence while the tab is hidden/offline; no network request is made. */
const IDLE_RECHECK_MS = 5_000;

function entityUrl(ids: string[], all: boolean) {
  const params = new URLSearchParams();
  if (all) params.set("all", "1");
  else if (ids.length > 0) params.set("ids", ids.join(","));
  const query = params.toString();
  return `/api/world/entities${query ? `?${query}` : ""}`;
}

function isEntityPayload(value: unknown): value is WorldEntityPayload {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<WorldEntityPayload>;
  return (
    typeof candidate.now === "string" &&
    Array.isArray(candidate.bases) &&
    Array.isArray(candidate.mapObjects)
  );
}

/**
 * Hybrid realtime sync for the world map.
 *
 * - Supabase Broadcast hints (`{kind, id, version}`) tell us what changed.
 * - `/api/world/entities` is the only source of truth; hints are never trusted.
 * - While realtime is healthy a 5 minute resync covers dropped broadcasts.
 * - While it is unavailable a 12 second poll with exponential backoff takes
 *   over, and stops as soon as the channels subscribe again.
 */
export function useWorldRealtime({
  enabled = true,
  userId,
  coordinateX,
  coordinateZ,
  viewRadiusMeters = VIEW_RADIUS_METERS,
  onEntities,
  onBaseHint,
  onSyncBase,
}: {
  enabled?: boolean;
  userId: string;
  coordinateX: number;
  coordinateZ: number;
  /** View radius in metres; grows with a completed scout camp. */
  viewRadiusMeters?: number;
  onEntities: (payload: WorldEntityPayload) => void;
  /**
   * BASE hints cannot be resolved by the entity endpoint: a player's own base
   * (the one under attack) is not part of the map payload. They request a full
   * snapshot instead, which already carries `baseAttacks`/`nearbyBases`.
   */
  onBaseHint?: (ids: string[]) => void;
  /**
   * Periodic or visibility sync for the player's own base (resources, training, research).
   */
  onSyncBase?: () => Promise<void> | void;
}) {
  const [status, setStatus] = useState<WorldRealtimeStatus>(
    HAS_REALTIME ? "connecting" : "polling",
  );
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const onEntitiesRef = useRef(onEntities);
  const onBaseHintRef = useRef(onBaseHint);
  const onSyncBaseRef = useRef(onSyncBase);

  useEffect(() => {
    onEntitiesRef.current = onEntities;
  }, [onEntities]);

  useEffect(() => {
    onBaseHintRef.current = onBaseHint;
  }, [onBaseHint]);

  useEffect(() => {
    onSyncBaseRef.current = onSyncBase;
  }, [onSyncBase]);

  useEffect(() => {
    if (!enabled) return;

    let disposed = false;
    let online = typeof navigator === "undefined" ? true : navigator.onLine;
    let live = false;
    let inFlight = false;
    let failures = 0;
    let lastSync = 0;
    let supabase: SupabaseClient | null = null;
    let channelCount = 0;

    const channels: RealtimeChannel[] = [];
    const subscribedChannels = new Set<number>();
    const pending = new Map<string, WorldRealtimeChange>();
    const basePending = new Map<string, WorldRealtimeChange>();
    const dedupe = createWorldRealtimeDedupe(MAX_SEEN_EVENTS);

    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    let baseFlushTimer: ReturnType<typeof setTimeout> | null = null;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let resyncTimer: ReturnType<typeof setTimeout> | null = null;

    function setStatusSafe(next: WorldRealtimeStatus) {
      if (!disposed) setStatus(next);
    }

    function clearFlush() {
      if (flushTimer) clearTimeout(flushTimer);
      flushTimer = null;
    }

    function clearBaseFlush() {
      if (baseFlushTimer) clearTimeout(baseFlushTimer);
      baseFlushTimer = null;
    }

    function clearPoll() {
      if (pollTimer) clearTimeout(pollTimer);
      pollTimer = null;
    }

    function clearResync() {
      if (resyncTimer) clearTimeout(resyncTimer);
      resyncTimer = null;
    }

    async function fetchEntities(ids: string[], all: boolean) {
      if (disposed || inFlight) return false;
      if (!online) {
        setStatusSafe("offline");
        return false;
      }
      inFlight = true;
      try {
        const response = await fetch(entityUrl(ids, all), { cache: "no-store" });
        const result: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          const message =
            result && typeof result === "object" && "error" in result
              ? String((result as { error?: unknown }).error ?? "")
              : "";
          throw new Error(message || `Đồng bộ thế giới thất bại (${response.status}).`);
        }
        if (!isEntityPayload(result)) throw new Error("Payload đồng bộ không hợp lệ.");
        if (disposed) return true;
        onEntitiesRef.current(result);
        lastSync = Date.now();
        setLastSyncedAt(lastSync);
        failures = 0;
        return true;
      } catch {
        failures += 1;
        return false;
      } finally {
        inFlight = false;
      }
    }

    function schedulePoll(delay = WORLD_REALTIME_POLL_MS) {
      clearPoll();
      if (disposed) return;
      pollTimer = setTimeout(runPoll, delay);
    }

    async function runPoll() {
      pollTimer = null;
      if (disposed) return;
      if (!online) {
        setStatusSafe("offline");
        schedulePoll(IDLE_RECHECK_MS);
        return;
      }
      if (document.visibilityState !== "visible") {
        schedulePoll(IDLE_RECHECK_MS);
        return;
      }
      const ok = await fetchEntities([], true);
      if (disposed) return;
      if (onSyncBaseRef.current) {
        try {
          await onSyncBaseRef.current();
        } catch {
          // Sync base error is handled gracefully
        }
      }
      if (live) return; // realtime took over while this poll was in flight
      if (ok) {
        // Recover to live mode when the channels are still subscribed and only
        // the authoritative API was failing.
        if (HAS_REALTIME && channelCount > 0 && subscribedChannels.size === channelCount) {
          goLive(false);
          return;
        }
        setStatusSafe("polling");
        schedulePoll(WORLD_REALTIME_POLL_MS);
      } else {
        setStatusSafe(online ? "polling" : "offline");
        schedulePoll(worldRealtimeBackoffDelay(failures));
      }
    }

    function scheduleResync(delay = WORLD_REALTIME_RESYNC_MS) {
      clearResync();
      if (disposed) return;
      resyncTimer = setTimeout(runResync, delay);
    }

    async function runResync() {
      resyncTimer = null;
      if (disposed) return;
      if (!online) {
        setStatusSafe("offline");
        scheduleResync(IDLE_RECHECK_MS);
        return;
      }
      if (document.visibilityState !== "visible") {
        scheduleResync(IDLE_RECHECK_MS);
        return;
      }
      const ok = await fetchEntities([], true);
      if (disposed) return;
      if (onSyncBaseRef.current) {
        try {
          await onSyncBaseRef.current();
        } catch {}
      }
      // Realtime is connected but authoritative reads keep failing: fall back.
      if (!ok && failures >= 2) {
        live = false;
        setStatusSafe("polling");
        schedulePoll(WORLD_REALTIME_POLL_MS);
        return;
      }
      if (!live) return;
      scheduleResync(ok ? WORLD_REALTIME_RESYNC_MS : worldRealtimeBackoffDelay(failures));
    }

    function scheduleFlush(delay = WORLD_REALTIME_BATCH_MS) {
      if (flushTimer) return;
      flushTimer = setTimeout(runFlush, delay);
    }

    async function runFlush() {
      flushTimer = null;
      if (disposed || pending.size === 0) return;
      if (!online) {
        setStatusSafe("offline");
        scheduleFlush(IDLE_RECHECK_MS);
        return;
      }
      if (document.visibilityState !== "visible") {
        // Keep the hints; flush as soon as the tab is visible again.
        scheduleFlush(IDLE_RECHECK_MS);
        return;
      }
      if (inFlight) {
        scheduleFlush(250);
        return;
      }

      const batch = [...pending.entries()].slice(0, WORLD_ENTITY_MAX_OBJECTS);
      for (const [key] of batch) pending.delete(key);
      const ok = await fetchEntities(
        batch.map(([, change]) => change.id),
        false,
      );
      if (!ok && !disposed) {
        for (const [key, change] of batch) {
          if (!pending.has(key)) pending.set(key, change);
        }
        if (live && failures >= 2) goPolling();
      }
      if (pending.size > 0) {
        scheduleFlush(ok ? 50 : worldRealtimeBackoffDelay(failures));
      }
    }

    function scheduleBaseFlush(delay = WORLD_REALTIME_BATCH_MS) {
      if (baseFlushTimer) return;
      baseFlushTimer = setTimeout(runBaseFlush, delay);
    }

    function runBaseFlush() {
      baseFlushTimer = null;
      if (disposed || basePending.size === 0) return;
      if (!online || document.visibilityState !== "visible") {
        // The catch-up sync on reconnect/visibility covers these hints.
        basePending.clear();
        return;
      }
      const ids = [...basePending.keys()];
      basePending.clear();
      onBaseHintRef.current?.(ids);
    }

    function onBroadcast(raw: unknown) {
      const message = parseWorldRealtimeMessage(raw);
      if (!message) return;
      if (dedupe.isDuplicate(message.eventId)) return;

      let queued = false;
      let baseQueued = false;
      for (const change of message.changes) {
        if (change.kind === "BASE") {
          const existing = basePending.get(change.id);
          if (!existing || (change.version ?? 0) >= (existing.version ?? 0)) {
            basePending.set(change.id, change);
            baseQueued = true;
          }
          continue;
        }
        const key = `${change.kind}:${change.id}`;
        const existing = pending.get(key);
        if (!existing || (change.version ?? 0) >= (existing.version ?? 0)) {
          pending.set(key, change);
          queued = true;
        }
      }
      if (queued) scheduleFlush();
      if (baseQueued) scheduleBaseFlush();
    }

    function goLive(sync = true) {
      if (disposed || live) return;
      live = true;
      clearPoll();
      setStatusSafe(online ? "live" : "offline");
      if (!sync) {
        scheduleResync();
        return;
      }
      // Close the gap between the initial snapshot and the subscription.
      void fetchEntities([], true).then((ok) => {
        if (!disposed) scheduleResync(ok ? WORLD_REALTIME_RESYNC_MS : WORLD_REALTIME_POLL_MS);
      });
    }

    function goPolling() {
      if (disposed) return;
      live = false;
      clearResync();
      setStatusSafe(online ? "polling" : "offline");
      schedulePoll(0);
    }

    setStatusSafe(HAS_REALTIME ? "connecting" : "polling");

    if (HAS_REALTIME) {
      supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const topics = worldRegionsForView(coordinateX, coordinateZ, viewRadiusMeters).map(worldRealtimeTopic);
      channelCount = topics.length;
      topics.forEach((topic, index) => {
        const channel = supabase!.channel(topic, {
          config: { broadcast: { self: false } },
        });
        channel.on("broadcast", { event: WORLD_REALTIME_EVENT }, (message) => {
          onBroadcast(message.payload);
        });
        channel.subscribe((state) => {
          if (state === "SUBSCRIBED") {
            subscribedChannels.add(index);
            if (subscribedChannels.size === topics.length) goLive();
          } else if (
            state === "CHANNEL_ERROR" ||
            state === "TIMED_OUT" ||
            state === "CLOSED"
          ) {
            subscribedChannels.delete(index);
            goPolling();
          }
        });
        channels.push(channel);
      });
      // Fallback until every region channel is subscribed.
      schedulePoll(WORLD_REALTIME_POLL_MS);
    } else {
      // No Supabase configuration: polling is the only sync path.
      schedulePoll(WORLD_REALTIME_POLL_MS);
    }

    function onVisibilityChange() {
      if (disposed || document.visibilityState !== "visible" || !online) return;
      if (live) {
        if (Date.now() - lastSync >= WORLD_REALTIME_POLL_MS) {
          void fetchEntities([], true);
          void onSyncBaseRef.current?.();
        }
      } else {
        schedulePoll(0);
      }
    }

    function onOnline() {
      online = true;
      if (disposed) return;
      setStatusSafe(live ? "live" : "polling");
      if (live) {
        void fetchEntities([], true);
        void onSyncBaseRef.current?.();
        scheduleResync();
      } else {
        schedulePoll(0);
      }
    }

    function onOffline() {
      online = false;
      if (disposed) return;
      clearPoll();
      clearResync();
      setStatusSafe("offline");
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      disposed = true;
      clearFlush();
      clearBaseFlush();
      clearPoll();
      clearResync();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      for (const channel of channels) {
        void supabase?.removeChannel(channel);
      }
    };
    // `userId`/coordinates are stable for the lifetime of a base; the callback
    // is read through a ref so identity changes do not resubscribe channels.
    // A scout camp completion changes the view radius and resubscribes once.
  }, [enabled, userId, coordinateX, coordinateZ, viewRadiusMeters]);

  return { status, lastSyncedAt };
}
