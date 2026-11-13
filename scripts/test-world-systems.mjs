/**
 * Sanity tests for the A2 Kingdom coordinate contract and deterministic
 * procedural world generation.
 *
 * Contract under test:
 *   - Stored world coordinates are METRES.
 *   - 200 m = 1 Three.js render unit.
 *   - 40 m = 1 procedural noise unit.
 *
 * Run with: npx tsx scripts/test-world-systems.mjs
 */

import assert from "node:assert";
import {
  CHUNK_SIZE,
  METERS_PER_RENDER_UNIT,
  METERS_PER_NOISE_UNIT,
  TERRAIN_SIZE_UNITS,
  VIEW_RADIUS_UNITS,
  VIEW_RADIUS_METERS,
  CITY_PAD_INNER_UNITS,
  CITY_PAD_OUTER_UNITS,
  worldToChunk,
  chunkToWorldOrigin,
  worldToLocal,
  metersToRenderUnits,
  renderUnitsToMeters,
  worldToRender,
  renderToWorld,
  worldDistance,
  getSurroundingChunks,
  getVisibleChunksAroundPosition,
} from "../src/lib/world-coordinates.js";

import {
  hashChunkSeed,
  createRng,
  generateChunkObjects,
  DEFAULT_WORLD_SEED,
} from "../src/lib/world-generation.js";

import {
  RESOURCE_NODES,
  ROGUE_CAMPS,
  worldMapTravelMilliseconds,
} from "../src/lib/world-map-objects.js";

import {
  getHeightAtWorld,
  heightAtRender,
  getBiomeAtWorld,
  getBiomeColorWorld,
  WATER_LEVEL,
} from "../src/components/world3d/terrain/BiomeManager.js";

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}
const close = (actual, expected, epsilon = 1e-9) =>
  assert(Math.abs(actual - expected) <= epsilon, `expected ${expected}, got ${actual}`);

console.log("=== A2 KINGDOM WORLD SYSTEM TESTS ===");

console.log("\n[1] Constants");
check("chunk is 20 km, view radius is 44 km", () => {
  assert.strictEqual(CHUNK_SIZE, 20_000);
  assert.strictEqual(METERS_PER_RENDER_UNIT, 200);
  assert.strictEqual(METERS_PER_NOISE_UNIT, 40);
  assert.strictEqual(VIEW_RADIUS_UNITS, 220);
  assert.strictEqual(VIEW_RADIUS_METERS, 44_000);
  assert.strictEqual(TERRAIN_SIZE_UNITS, 480);
  assert(TERRAIN_SIZE_UNITS / 2 > VIEW_RADIUS_UNITS, "terrain must cover the view radius");
  assert(CITY_PAD_OUTER_UNITS > CITY_PAD_INNER_UNITS);
});

console.log("\n[2] World → chunk (metres)");
check("positive, boundary and negative coordinates", () => {
  assert.deepStrictEqual(worldToChunk(0, 0), { chunkX: 0, chunkZ: 0 });
  assert.deepStrictEqual(worldToChunk(19_999, 19_999), { chunkX: 0, chunkZ: 0 });
  assert.deepStrictEqual(worldToChunk(20_000, 20_000), { chunkX: 1, chunkZ: 1 });
  assert.deepStrictEqual(worldToChunk(-1, -1), { chunkX: -1, chunkZ: -1 });
  assert.deepStrictEqual(worldToChunk(-20_000, -20_000), { chunkX: -1, chunkZ: -1 });
  assert.deepStrictEqual(worldToChunk(-20_001, -20_001), { chunkX: -2, chunkZ: -2 });
});

console.log("\n[3] Chunk origin / centre / local round-trip");
check("origin + local always reconstructs the world point", () => {
  const points = [
    { x: 0, z: 0 },
    { x: 12_345, z: 6_789 },
    { x: -45_000, z: -70_000 },
    { x: 99_999, z: -100_000 },
    { x: -1, z: 20_000 },
  ];
  for (const pt of points) {
    const { chunkX, chunkZ } = worldToChunk(pt.x, pt.z);
    const origin = chunkToWorldOrigin(chunkX, chunkZ);
    const local = worldToLocal(pt.x, pt.z);
    assert.strictEqual(origin.x + local.x, pt.x);
    assert.strictEqual(origin.z + local.z, pt.z);
    assert(local.x >= 0 && local.x < CHUNK_SIZE);
    assert(local.z >= 0 && local.z < CHUNK_SIZE);
  }
});

console.log("\n[4] Metres ↔ render units");
check("200 m becomes 1 render unit and back", () => {
  assert.strictEqual(metersToRenderUnits(200), 1);
  assert.strictEqual(metersToRenderUnits(-44_000), -220);
  assert.strictEqual(renderUnitsToMeters(1), 200);
  close(renderUnitsToMeters(metersToRenderUnits(12_345)), 12_345);
});

console.log("\n[5] worldToRender / renderToWorld");
check("conversion is anchored to the player's base and reversible", () => {
  const anchor = { x: 120_000, z: -85_000 };
  const other = { x: 120_300, z: -84_865 };
  const render = worldToRender(other.x, other.z, anchor.x, anchor.z);
  close(render.x, 1.5);
  close(render.z, 0.675);
  const back = renderToWorld(render.x, render.z, anchor.x, anchor.z);
  close(back.x, other.x, 1e-6);
  close(back.z, other.z, 1e-6);
  assert.strictEqual(worldDistance(anchor.x, anchor.z, other.x, other.z), Math.hypot(300, 135));
});

console.log("\n[6] Chunk visibility queries");
check("3×3 neighbourhood and 44 km circle around a base", () => {
  assert.strictEqual(getSurroundingChunks(0, 0, 1).length, 9);

  const visible = getVisibleChunksAroundPosition(0, 0, VIEW_RADIUS_METERS);
  // x/z from -44 km to +44 km → chunk indices -3..2 on each axis.
  assert.strictEqual(visible.length, 6 * 6);
  assert(visible.some((c) => c.chunkX === -3 && c.chunkZ === -3));
  assert(visible.some((c) => c.chunkX === 2 && c.chunkZ === 2));

  const far = getVisibleChunksAroundPosition(500_000, 500_000, VIEW_RADIUS_METERS);
  assert(far.every((c) => c.chunkX >= 22 && c.chunkX <= 27));
});

console.log("\n[7] Deterministic procedural generation");
check("same chunk + seed reloads identically, different chunks differ", () => {
  const a = generateChunkObjects(1, 0, DEFAULT_WORLD_SEED);
  const b = generateChunkObjects(1, 0, DEFAULT_WORLD_SEED);
  assert.deepStrictEqual(a, b);

  const c = generateChunkObjects(3, 2, DEFAULT_WORLD_SEED);
  assert.notDeepStrictEqual(a, c);

  const otherSeed = generateChunkObjects(1, 0, DEFAULT_WORLD_SEED + 1);
  assert.notDeepStrictEqual(a, otherSeed);

  assert.strictEqual(hashChunkSeed(DEFAULT_WORLD_SEED, 1, 0), hashChunkSeed(DEFAULT_WORLD_SEED, 1, 0));
  const rng = createRng(42);
  const first = [rng(), rng(), rng()];
  const rng2 = createRng(42);
  assert.deepStrictEqual(first, [rng2(), rng2(), rng2()]);
});

console.log("\n[8] Generated objects stay inside their chunk");
check("ids encode chunk coords and positions are metres", () => {
  const objects = generateChunkObjects(1, 0, DEFAULT_WORLD_SEED);
  assert(objects.length > 0);
  for (const obj of objects) {
    assert(obj.id.includes("1_0"), `Object ID ${obj.id} must encode chunk coordinates`);
    assert(Number.isFinite(obj.x) && Number.isFinite(obj.z));
    assert(obj.x >= 20_000 && obj.x <= 40_000, `${obj.id} x=${obj.x} outside chunk 1`);
    assert(obj.z >= 0 && obj.z <= 20_000, `${obj.id} z=${obj.z} outside chunk 0`);
  }
});

console.log("\n[9] Static map objects keep their on-screen offsets");
check("legacy render-unit offsets are preserved as metres / 200", () => {
  const forest = RESOURCE_NODES.find((node) => node.id === "forest-01");
  assert(forest);
  // Original authoring values were x=-54, z=-35 render units.
  close(worldToRender(forest.x, forest.z, 0, 0).x, -54);
  close(worldToRender(forest.x, forest.z, 0, 0).z, -35);

  const camp = ROGUE_CAMPS.find((node) => node.id === "camp-01");
  assert(camp);
  close(worldToRender(camp.x, camp.z, 0, 0).x, 28);
  close(worldToRender(camp.x, camp.z, 0, 0).z, 34);

  // Every static object must be reachable within the view radius from origin.
  for (const object of [...RESOURCE_NODES, ...ROGUE_CAMPS]) {
    const render = worldToRender(object.x, object.z, 0, 0);
    assert(Math.hypot(render.x, render.z) <= VIEW_RADIUS_UNITS, `${object.id} outside view radius`);
  }
});

console.log("\n[10] Travel time parity for static objects");
check("travel time depends on metres and matches the legacy value", () => {
  const forest = RESOURCE_NODES.find((node) => node.id === "forest-01");
  assert(forest);
  const expected = Math.min(
    2 * 60 * 60 * 1000,
    Math.max(30_000, Math.ceil((Math.hypot(54, 35) * 200) / 10_000 * 5 * 60_000)),
  );
  assert.strictEqual(worldMapTravelMilliseconds(forest.x, forest.z), expected);
  assert.strictEqual(worldMapTravelMilliseconds(0, 0), 30_000);
  assert.strictEqual(worldMapTravelMilliseconds(1_000_000, 0), 2 * 60 * 60 * 1000);
});

console.log("\n[11] Terrain height anchoring");
check("heightAtRender is consistent with world metres and stable", () => {
  const anchor = { x: 37_000, z: -82_000 };
  const renderX = 60;
  const renderZ = -40;
  const viaRender = heightAtRender(renderX, renderZ, anchor.x, anchor.z);
  const viaWorld = getHeightAtWorld(
    anchor.x + renderX * METERS_PER_RENDER_UNIT,
    anchor.z + renderZ * METERS_PER_RENDER_UNIT,
  );
  close(viaRender, viaWorld, 1e-9);
  assert.strictEqual(heightAtRender(renderX, renderZ, anchor.x, anchor.z), viaRender);

  // City pad is flat at the anchor, untouched beyond the outer radius.
  close(heightAtRender(0, 0, anchor.x, anchor.z), getHeightAtWorld(anchor.x, anchor.z), 1e-9);
  const outside = CITY_PAD_OUTER_UNITS + 5;
  close(
    heightAtRender(outside, 0, anchor.x, anchor.z),
    getHeightAtWorld(anchor.x + outside * METERS_PER_RENDER_UNIT, anchor.z),
    1e-9,
  );
  assert(Number.isFinite(WATER_LEVEL));
});

console.log("\n[12] Biome sampling is world-space and deterministic");
check("same world point always yields the same biome", () => {
  const a = getBiomeAtWorld(-123_456, 98_765);
  const b = getBiomeAtWorld(-123_456, 98_765);
  assert.strictEqual(a.type, b.type);
  assert(a.heightRange[0] <= a.heightRange[1]);
  assert(Number.isFinite(a.vegetationDensity));
});

console.log("\n[13] Terrain height is continuous (no biome cliffs)");
check("adjacent 200 m samples never jump like a wall", () => {
  const deltas = [];
  for (let line = 0; line < 25; line += 1) {
    const z = -120_000 + line * 10_000;
    for (let i = 0; i < 400; i += 1) {
      const x = -80_000 + i * 200;
      deltas.push(Math.abs(getHeightAtWorld(x + 200, z) - getHeightAtWorld(x, z)));
    }
  }
  deltas.sort((left, right) => left - right);
  const p99 = deltas[Math.floor(deltas.length * 0.99)];
  const max = deltas[deltas.length - 1];
  assert(p99 < 3, `p99 height delta ${p99} suggests a cliff`);
  assert(max < 6, `max height delta ${max} suggests a cliff`);
});

console.log("\n[14] Biome diversity inside the 44 km view radius");
check("every view contains at least five biomes and some water", () => {
  const anchors = [
    [0, 0],
    [37_000, -82_000],
    [-120_000, 90_000],
    [95_000, 140_000],
    [-150_000, -60_000],
  ];
  for (const [cx, cz] of anchors) {
    const counts = new Map();
    let total = 0;
    for (let dx = -44_000; dx <= 44_000; dx += 2_000) {
      for (let dz = -44_000; dz <= 44_000; dz += 2_000) {
        if (dx * dx + dz * dz > VIEW_RADIUS_METERS ** 2) continue;
        const type = getBiomeAtWorld(cx + dx, cz + dz).type;
        counts.set(type, (counts.get(type) ?? 0) + 1);
        total += 1;
      }
    }
    assert(counts.size >= 5, `only ${counts.size} biomes around ${cx},${cz}`);
    const water = ((counts.get("RIVER") ?? 0) + (counts.get("LAKE") ?? 0)) / total;
    assert(water > 0.02 && water < 0.3, `water fraction ${water} around ${cx},${cz}`);
  }
});

console.log("\n[15] Water biomes sit below the water plane");
check("RIVER/LAKE implies a carved height under WATER_LEVEL", () => {
  let sampled = 0;
  for (let x = -200_000; x <= 200_000; x += 4_000) {
    for (let z = -200_000; z <= 200_000; z += 4_000) {
      const type = getBiomeAtWorld(x, z).type;
      if (type !== "RIVER" && type !== "LAKE") continue;
      sampled += 1;
      assert(
        getHeightAtWorld(x, z) <= WATER_LEVEL + 1e-6,
        `${type} at ${x},${z} is above the water plane`,
      );
    }
  }
  assert(sampled > 0, "no water was sampled");
});

console.log("\n[16] Biome colour blending is smooth and in range");
check("adjacent colours change gradually", () => {
  let maxDelta = 0;
  for (let i = 0; i < 500; i += 1) {
    const x = -100_000 + i * 400;
    const z = 12_345;
    const first = getBiomeColorWorld(x, z);
    const second = getBiomeColorWorld(x + 200, z);
    for (const channel of [...first, ...second]) {
      assert(channel >= 0 && channel <= 1, `colour channel ${channel} out of range`);
    }
    const delta = Math.hypot(
      second[0] - first[0],
      second[1] - first[1],
      second[2] - first[2],
    );
    if (delta > maxDelta) maxDelta = delta;
  }
  assert(maxDelta < 0.3, `colour jump ${maxDelta} suggests hard biome borders`);
});

console.log(`\nALL TESTS PASSED (${passed} checks).`);
