/**
 * Tests for the A2 Kingdom hybrid realtime contract.
 *
 * Covers:
 *   - region subscription math (a visible object is always in a subscribed region)
 *   - strict validation of untrusted broadcast payloads
 *   - duplicate-event dedupe + bounded LRU
 *   - fallback backoff schedule
 *   - merge/version guard (stale payloads never overwrite newer rows)
 *
 * Run with: npx tsx scripts/test-world-realtime.mjs
 */

import assert from "node:assert";
import {
  WORLD_REALTIME_BATCH_MS,
  WORLD_REALTIME_POLL_MS,
  WORLD_REALTIME_RESYNC_MS,
  createWorldRealtimeDedupe,
  parseWorldRealtimeMessage,
  worldRealtimeBackoffDelay,
  worldRealtimeTopic,
  worldRegionKey,
  worldRegionsForView,
} from "../src/lib/world-realtime.js";
import { VIEW_RADIUS_METERS } from "../src/lib/world-coordinates.js";
import { mergeWorldEntities, mergeWorldSnapshot } from "../src/lib/world-merge.js";
import { createTokenBucketLimiter } from "../src/lib/rate-limit.js";

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

function section(title) {
  console.log(`\n${title}`);
}

/** Deterministic pseudo-random generator for repeatable sampling. */
function createRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

section("[1] Contract constants");
check("polling stays inside the 10-15s requirement", () => {
  assert(WORLD_REALTIME_POLL_MS >= 10_000 && WORLD_REALTIME_POLL_MS <= 15_000);
});
check("batch window and resync are sane", () => {
  assert(WORLD_REALTIME_BATCH_MS > 0 && WORLD_REALTIME_BATCH_MS < 1_000);
  assert(WORLD_REALTIME_RESYNC_MS >= 60_000);
});
check("topic format is namespaced by region", () => {
  assert.equal(worldRealtimeTopic("0:0"), "world:region:0:0");
  assert.equal(worldRealtimeTopic("-2:3"), "world:region:-2:3");
});

section("[2] Region math");
check("regions are 5 chunks (100 km) and negative-safe", () => {
  assert.equal(worldRegionKey(0, 0), "0:0");
  assert.equal(worldRegionKey(99_999, 99_999), "0:0");
  assert.equal(worldRegionKey(100_000, 0), "1:0");
  assert.equal(worldRegionKey(-1, -1), "-1:-1");
  assert.equal(worldRegionKey(-100_000, 0), "-1:0");
});
check("a 44 km view touches at most 4 regions", () => {
  for (const [x, z] of [[0, 0], [49_999, 49_999], [-123_456, 987_654], [1e9, -1e9]]) {
    const regions = worldRegionsForView(x, z);
    assert(regions.length >= 1 && regions.length <= 4, `got ${regions.length} regions`);
  }
});
check("every object inside the view radius is covered by a subscription", () => {
  const random = createRng(20261114);
  for (let i = 0; i < 3_000; i += 1) {
    const x = (random() - 0.5) * 2_000_000;
    const z = (random() - 0.5) * 2_000_000;
    const angle = random() * Math.PI * 2;
    const distance = Math.sqrt(random()) * VIEW_RADIUS_METERS;
    const objectX = x + Math.cos(angle) * distance;
    const objectZ = z + Math.sin(angle) * distance;
    const subscribed = new Set(worldRegionsForView(x, z));
    assert(
      subscribed.has(worldRegionKey(objectX, objectZ)),
      `object at ${objectX},${objectZ} missed by view at ${x},${z}`,
    );
  }
});

section("[3] Broadcast payload validation");
check("valid message parses", () => {
  const message = parseWorldRealtimeMessage({
    v: 1,
    eventId: "evt_abc-123",
    at: new Date().toISOString(),
    changes: [{ kind: "BASE", id: "user_1", version: 4 }],
  });
  assert(message);
  assert.equal(message.changes.length, 1);
  assert.equal(message.changes[0].version, 4);
});
check("wrong version / missing fields are rejected", () => {
  assert.equal(parseWorldRealtimeMessage(null), null);
  assert.equal(parseWorldRealtimeMessage({}), null);
  assert.equal(
    parseWorldRealtimeMessage({ v: 2, eventId: "a", at: "x", changes: [{ kind: "BASE", id: "a" }] }),
    null,
  );
  assert.equal(
    parseWorldRealtimeMessage({ v: 1, at: "x", changes: [{ kind: "BASE", id: "a" }] }),
    null,
  );
  assert.equal(
    parseWorldRealtimeMessage({ v: 1, eventId: "a", at: "x", changes: [] }),
    null,
  );
});
check("unsafe ids are dropped, not trusted", () => {
  const message = parseWorldRealtimeMessage({
    v: 1,
    eventId: "evt",
    at: "x",
    changes: [
      { kind: "BASE", id: "ok_id-1" },
      { kind: "BASE", id: "bad id with spaces" },
      { kind: "UNKNOWN", id: "ok_2" },
      { kind: "MAP_OBJECT", id: "../../etc/passwd" },
      { kind: "MAP_OBJECT", id: "gen_res_0_0_0", version: Number.NaN },
    ],
  });
  assert(message);
  assert.deepEqual(message.changes.map((change) => change.id), ["ok_id-1", "gen_res_0_0_0"]);
  assert.equal(message.changes[1].version, undefined);
});
check("huge payloads are capped at 50 changes", () => {
  const changes = Array.from({ length: 120 }, (_, index) => ({
    kind: "MAP_OBJECT",
    id: `gen_res_0_0_${index}`,
  }));
  const message = parseWorldRealtimeMessage({ v: 1, eventId: "evt", at: "x", changes });
  assert(message);
  assert.equal(message.changes.length, 50);
});

section("[4] Duplicate delivery handling");
check("duplicate event ids are ignored", () => {
  const dedupe = createWorldRealtimeDedupe(10);
  assert.equal(dedupe.isDuplicate("a"), false);
  assert.equal(dedupe.isDuplicate("a"), true);
  assert.equal(dedupe.isDuplicate("b"), false);
});
check("dedupe memory is bounded (old ids are evicted)", () => {
  const dedupe = createWorldRealtimeDedupe(2);
  dedupe.isDuplicate("a");
  dedupe.isDuplicate("b");
  dedupe.isDuplicate("c");
  assert.equal(dedupe.isDuplicate("a"), false, "evicted id should be treated as new");
  assert.equal(dedupe.isDuplicate("c"), true);
});

section("[5] Fallback backoff");
check("exponential backoff is capped at 60s", () => {
  assert.equal(worldRealtimeBackoffDelay(0), 12_000);
  assert.equal(worldRealtimeBackoffDelay(1), 24_000);
  assert.equal(worldRealtimeBackoffDelay(2), 48_000);
  assert.equal(worldRealtimeBackoffDelay(3), 60_000);
  assert.equal(worldRealtimeBackoffDelay(99), 60_000);
});

section("[6] Merge and version guard");

function baseState(overrides) {
  return {
    userId: "base-a",
    username: "a",
    displayName: "A",
    coordinateX: 0,
    coordinateZ: 0,
    distanceMeters: 100,
    castleLevel: 1,
    pvpShieldUntil: null,
    activeAttack: false,
    version: 1,
    ...overrides,
  };
}

function resourceState(overrides) {
  return {
    id: "gen_res_0_0_0",
    kind: "RESOURCE",
    version: 1,
    ownerUserId: null,
    ownerName: null,
    remaining: 500,
    status: "AVAILABLE",
    occupiedUntil: null,
    respawnsAt: null,
    ...overrides,
  };
}

function campState(overrides) {
  return {
    id: "camp-01",
    kind: "ROGUE_CAMP",
    version: 1,
    availableAt: null,
    status: "AVAILABLE",
    ...overrides,
  };
}

const resourceDefinition = {
  id: "gen_res_0_0_0",
  kind: "RESOURCE",
  name: "Test node",
  resource: "FOREST",
  level: 1,
  amount: 500,
  yieldPerMinute: 10,
  requiredPower: 1,
  x: 0,
  z: 0,
};
const campDefinition = {
  id: "camp-01",
  kind: "ROGUE_CAMP",
  name: "Test camp",
  monsterType: "Goblin",
  tier: "LEVEL_1",
  level: 1,
  troopCount: 10,
  combatPower: 10,
  reward: "none",
  rewardItemKey: "NONE",
  x: 100,
  z: 100,
};

function makeSnapshot(overrides = {}) {
  return {
    userId: "me",
    now: "2026-01-01T00:00:00.000Z",
    buildings: [],
    research: [],
    mapObjects: [resourceState(), campState()],
    mapObjectDefinitions: [resourceDefinition, campDefinition],
    mapMissions: [],
    base: {
      playerName: "Me",
      castleLevel: 1,
      coordinateX: 0,
      coordinateZ: 0,
      wood: 10,
      stone: 10,
      iron: 0,
      food: 10,
      rare: 0,
      experience: 0,
      items: [],
      army: {},
    },
    offline: {},
    events: [],
    nearbyBases: [baseState(), baseState({ userId: "base-b", username: "b", distanceMeters: 200 })],
    baseAttacks: [],
    occupations: [],
    pendingRewards: [],
    ...overrides,
  };
}

check("unchanged payload returns the same snapshot reference (no re-render)", () => {
  const snapshot = makeSnapshot();
  const merged = mergeWorldEntities(snapshot, {
    now: "2026-01-01T00:00:05.000Z",
    bases: snapshot.nearbyBases,
    mapObjects: [
      { definition: resourceDefinition, state: resourceState() },
      { definition: campDefinition, state: campState() },
    ],
  });
  assert.strictEqual(merged, snapshot);
});
check("newer map-object version is applied", () => {
  const snapshot = makeSnapshot();
  const merged = mergeWorldEntities(snapshot, {
    now: "2026-01-01T00:00:05.000Z",
    bases: snapshot.nearbyBases,
    mapObjects: [
      {
        definition: resourceDefinition,
        state: resourceState({ version: 2, remaining: 200, status: "OCCUPIED" }),
      },
    ],
  });
  assert.notStrictEqual(merged, snapshot);
  const state = merged.mapObjects.find((entry) => entry.id === resourceDefinition.id);
  assert.equal(state.version, 2);
  assert.equal(state.remaining, 200);
  assert.equal(merged.now, "2026-01-01T00:00:05.000Z");
  // State-only updates must not rebuild the definitions array (scene props stay stable).
  assert.strictEqual(merged.mapObjectDefinitions, snapshot.mapObjectDefinitions);
});
check("older map-object version never overwrites newer state", () => {
  const snapshot = makeSnapshot({
    mapObjects: [resourceState({ version: 5, remaining: 100 }), campState()],
  });
  const merged = mergeWorldEntities(snapshot, {
    now: "2026-01-01T00:00:05.000Z",
    bases: snapshot.nearbyBases,
    mapObjects: [
      {
        definition: resourceDefinition,
        state: resourceState({ version: 3, remaining: 999 }),
      },
    ],
  });
  assert.strictEqual(merged, snapshot);
  assert.equal(merged.mapObjects[0].remaining, 100);
});
check("out-of-order deliveries converge to the newest version", () => {
  const snapshot = makeSnapshot();
  const newer = mergeWorldEntities(snapshot, {
    now: "2026-01-01T00:00:05.000Z",
    bases: snapshot.nearbyBases,
    mapObjects: [
      { definition: campDefinition, state: campState({ version: 5, status: "COOLDOWN" }) },
    ],
  });
  const stale = mergeWorldEntities(newer, {
    now: "2026-01-01T00:00:04.000Z",
    bases: newer.nearbyBases,
    mapObjects: [
      { definition: campDefinition, state: campState({ version: 4, status: "AVAILABLE" }) },
    ],
  });
  assert.strictEqual(stale, newer);
  const camp = stale.mapObjects.find((entry) => entry.id === campDefinition.id);
  assert.equal(camp.version, 5);
  assert.equal(camp.status, "COOLDOWN");
});
check("base list is authoritative and removed bases disappear", () => {
  const snapshot = makeSnapshot();
  const merged = mergeWorldEntities(snapshot, {
    now: snapshot.now,
    bases: [baseState()],
    mapObjects: [],
  });
  assert.equal(merged.nearbyBases.length, 1);
  assert.equal(merged.nearbyBases[0].userId, "base-a");
});
check("base version guard blocks stale base payloads", () => {
  const snapshot = makeSnapshot({
    nearbyBases: [baseState({ version: 7, castleLevel: 9 })],
  });
  const merged = mergeWorldEntities(snapshot, {
    now: snapshot.now,
    bases: [baseState({ version: 2, castleLevel: 1 })],
    mapObjects: [],
  });
  assert.strictEqual(merged, snapshot);
  assert.equal(merged.nearbyBases[0].castleLevel, 9);
});
check("newly visible bases are added", () => {
  const snapshot = makeSnapshot();
  const merged = mergeWorldEntities(snapshot, {
    now: snapshot.now,
    bases: [
      ...snapshot.nearbyBases,
      baseState({ userId: "base-c", username: "c", distanceMeters: 50 }),
    ],
    mapObjects: [],
  });
  assert.equal(merged.nearbyBases.length, 3);
  assert.equal(merged.nearbyBases[0].userId, "base-c", "sorted by distance");
});
check("new map-object definitions are appended", () => {
  const snapshot = makeSnapshot();
  const extraDefinition = { ...resourceDefinition, id: "gen_res_0_0_1", x: 200 };
  const merged = mergeWorldEntities(snapshot, {
    now: snapshot.now,
    bases: snapshot.nearbyBases,
    mapObjects: [
      { definition: extraDefinition, state: resourceState({ id: "gen_res_0_0_1" }) },
    ],
  });
  assert(merged.mapObjectDefinitions.some((entry) => entry.id === "gen_res_0_0_1"));
  assert(merged.mapObjects.some((entry) => entry.id === "gen_res_0_0_1"));
});

section("[7] Full-snapshot refresh merge");
check("post-action refresh cannot downgrade a newer realtime row", () => {
  const current = makeSnapshot({
    nearbyBases: [baseState({ version: 5, castleLevel: 6 })],
    mapObjects: [resourceState({ version: 5, remaining: 50 }), campState()],
  });
  const next = makeSnapshot({
    nearbyBases: [baseState({ version: 2, castleLevel: 1 })],
    mapObjects: [resourceState({ version: 2, remaining: 500 }), campState()],
    base: { ...makeSnapshot().base, wood: 999 },
  });
  const merged = mergeWorldSnapshot(current, next);
  assert.equal(merged.nearbyBases[0].version, 5);
  assert.equal(merged.nearbyBases[0].castleLevel, 6);
  assert.equal(merged.mapObjects[0].version, 5);
  assert.equal(merged.mapObjects[0].remaining, 50);
  // Private/other fields still come from the fresh full snapshot.
  assert.equal(merged.base.wood, 999);
});
check("refresh with equal versions accepts fresh data", () => {
  const current = makeSnapshot();
  const next = makeSnapshot({
    nearbyBases: [baseState({ castleLevel: 4 })],
    base: { ...makeSnapshot().base, wood: 1234 },
  });
  const merged = mergeWorldSnapshot(current, next);
  assert.equal(merged.nearbyBases[0].castleLevel, 4);
  assert.equal(merged.base.wood, 1234);
});

section("[8] Entity endpoint rate limit");
check("burst up to capacity is allowed, then rejected with a retry hint", () => {
  const take = createTokenBucketLimiter({ capacity: 5, refillPerSecond: 1 });
  const now = 1_000_000;
  for (let index = 0; index < 5; index += 1) {
    assert.equal(take("user-a", now).allowed, true);
  }
  const denied = take("user-a", now);
  assert.equal(denied.allowed, false);
  assert(denied.retryAfterSeconds >= 1);
});
check("tokens refill over time", () => {
  const take = createTokenBucketLimiter({ capacity: 2, refillPerSecond: 2 });
  const now = 5_000_000;
  take("user-b", now);
  take("user-b", now);
  assert.equal(take("user-b", now).allowed, false);
  // 0.5 s at 2 tokens/s restores exactly one request.
  assert.equal(take("user-b", now + 500).allowed, true);
  assert.equal(take("user-b", now + 500).allowed, false);
});
check("keys are isolated", () => {
  const take = createTokenBucketLimiter({ capacity: 1, refillPerSecond: 1 });
  assert.equal(take("user-c", 10).allowed, true);
  assert.equal(take("user-c", 10).allowed, false);
  assert.equal(take("user-d", 10).allowed, true);
});
check("idle buckets are evicted so memory stays bounded", () => {
  const take = createTokenBucketLimiter({ capacity: 1, refillPerSecond: 1, maxKeys: 10 });
  for (let index = 0; index < 100; index += 1) {
    assert.equal(take(`user-${index}`, 1_000 + index).allowed, true);
  }
  // A fresh key still works after eviction.
  assert.equal(take("user-final", 2_000).allowed, true);
});
check("healthy polling cadence never trips the limit", () => {
  // Production budget: 60 burst / 3 per second.
  const take = createTokenBucketLimiter({ capacity: 60, refillPerSecond: 3 });
  const start = 0;
  for (let second = 0; second < 3_600; second += 1) {
    // One request every 12 s (the fallback poll).
    if (second % 12 === 0) {
      assert.equal(take("player", start + second * 1_000).allowed, true);
    }
  }
});

console.log(`\nALL TESTS PASSED (${passed} checks).`);
