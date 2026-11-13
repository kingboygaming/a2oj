# A2 Kingdom 3D Handoff

## Current implementation

- The existing Next.js App Router and React Three Fiber scene remain in use. World Map and City View are separate views in `WorldScene`; camera state and controls remain in the existing camera store/controller.
- World Map contains ten selectable resource landmarks and four rogue camps. The models reuse the existing procedural trees, rocks, houses, flags, and troop models.
- Map nodes, camps, ownership, remaining reserves, cooldowns, marches, combat reports, and item stacks are persisted in the database. Static map definitions seed database records idempotently; later requests do not reset their dynamic state.
- The authenticated `/api/world/map/actions` endpoint accepts only a target ID and troop counts. The server validates available troops and ownership/cooldowns, reserves troops, resolves marches through scheduled world processing, handles contests and camp battles, returns survivors, and grants capped resources/experience/items.
- Resource production and node expiry, camp cooldowns, march resolution, and troop returns are processed idempotently by the existing world cron and when the world snapshot is loaded. Failed map jobs are logged and left retryable.
- Map interaction panels display server-owned resource amounts, ownership, cooldowns, active reports, and rewards. Owned nodes are marked with a colored flag; depleted and cooling-down locations are visually dimmed.
- Combat outcomes are server-authoritative but use a deterministic prototype power/loss formula rather than a full combat simulator. Map geometry, locations, enemy definitions, costs, yields, and rewards are currently static game data.
- City View keeps the central Main Castle, walls, gate, and watchtowers. The twelve surrounding plots start empty; existing building models/assets are retained.
- Players can select a plot, preview a building model, and submit build, upgrade, or demolition actions. These actions are authenticated and persisted by `/api/world/buildings`; costs, plot uniqueness, castle requirements, construction times, upgrade times, and demolition refunds are checked server-side.
- Castle level and its pending upgrade are persisted. Castle upgrades and building construction complete from timestamps when the world state is next loaded.
- New bases start with 350 wood, 250 stone, and no legacy factory production. Existing players' resource amounts and factory levels are not rewritten by the migration. New production comes from completed Lumber Mills (+20 wood/hour/level), Stone Quarries (+10 stone/hour/level), and Farms (+20 food/hour/level). Offline production is timestamp-based and capped by the shared Warehouse capacity; each Warehouse building adds 2,000 storage.
- The server stores food, iron, rare resources, experience, and item stacks. Food earned from Farms, resource nodes, and camp rewards is visible in the client snapshot and obeys the same warehouse capacity as wood and stone. The migration adds only zero-default fields and does not reset existing inventories.
- Infantry, archers, and cavalry training now requires a completed Barracks, Archery Range, or Stable, respectively. Training prerequisites are checked on both the client and server.
- Research is server-authoritative through `/api/world/research`, with one active queue per base and timestamp-based completion. Army quality progresses from the baseline Stone tier to Iron, Gold, and Diamond; completed tiers increase combat power without treating Gold as currency. Production Efficiency improves wood, stone, and food output, while Research Speed shortens subsequent research times.
- Farms produce food during online and offline progression, and food from map actions is stored server-side. Iron Mine building production is not yet implemented; iron currently comes from map nodes and camp rewards. Military buildings other than the three training buildings are also placeholders for future systems.

## Placement and gameplay boundaries

- Building plots are fixed, server-validated slots around the castle. A selected valid plot shows a green ghost preview; the current prototype does not support free-form dragging or arbitrary terrain placement.
- Map object definitions are a deterministic mix of static sample data and procedurally generated per-chunk objects. Their live quantities, ownership, travel, contesting, depletion/regeneration, combat outcomes, cooldowns, and loot are server-authoritative and multiplayer-synchronized.
- Farm production is integrated with server-side offline progression. Iron Mine building production is not yet implemented; iron currently comes from map nodes and camp rewards.
- Research costs, prerequisites, completion, tier effects, production bonuses, and research-speed bonuses are enforced server-side. Combat tiers are recorded when armies are dispatched, so research does not retroactively alter troops already deployed.
- The new buildings and city layout use procedural Three.js models. No external 3D model/texture asset library was found during the initial audit.
- No player data is reset by the schema migration. Schema defaults affect newly created bases only; the PvP base-loss flow remains a separate game rule.

## Database and validation

- `WorldBuilding` stores each occupied plot and its level/construction timestamps. A unique `(baseId, plotIndex)` constraint prevents overlapping occupancy.
- The checked-in migrations add the building, resource-node, camp, march, inventory, and food-remainder fields. New resource fields use zero defaults; existing rows are not reset.
- Apply the PostgreSQL migration with the repository's `npm run db:migrate:deploy`; local SQLite uses the existing `npm run db:sync:sqlite` workflow.
- The original `A2_KINGDOM_HANDOFF.md` was not present in the repository when this rework began; this file records the current state and remaining boundaries.

## Recommended next work

1. Add production from Iron Mine buildings and balance node yields, travel times, losses, reward caps, and occupancy durations.
2. Replace fixed plot-only placement with a server-validated spatial placement model if free-form placement is desired.
3. Add focused integration tests for concurrent map claims, camp reward idempotency, troop returns, node expiry/respawn, food offline production/capacity, research timing and effects, building costs/refunds, and timed completion.

## Phase 1 — Coordinate System (implemented)

### Contract

- Stored world coordinates (`WorldBase.coordinateX/Z`, map object `x/z`) are **metres**. Existing rows keep their meaning; no migration was applied.
- Render space uses **200 m = 1 Three.js unit**; noise space uses **40 m = 1 noise unit**.
- `CHUNK_SIZE = 20,000 m`, `TERRAIN_SIZE_UNITS = 480`, `VIEW_RADIUS_UNITS = 220` (= 44,000 m), city pad inner/outer `26/45` units.
- Conversions live in one module: `src/lib/world-coordinates.ts` (`worldToRender`, `renderToWorld`, `getVisibleChunksAroundPosition`, `worldToChunk`, …).

### Files changed (Phase 1)

Client / rendering:
- `src/lib/world-coordinates.ts` (new): canonical metres ↔ render ↔ noise conversions, chunk math, view constants.
- `src/components/world3d/terrain/BiomeManager.ts`: removed `WORLD_COORD_SCALE`/4-arg `getHeightAt`; added `WATER_LEVEL`, `noiseHeight`, `getHeightAtWorld`, `heightAtRender` (city pad), `getBiomeAtWorld`, `getBiomeColorWorld`.
- `src/components/world3d/terrain/TerrainSystem.tsx`: 480-unit terrain, vertex heights/colours sampled in world metres through the shared mapping.
- `src/components/world3d/terrain/WaterSystem.tsx`: shared mapping + `WATER_LEVEL`.
- `src/components/world3d/terrain/GroundDecals.tsx`: anchor props + `heightAtRender`.
- `src/components/world3d/vegetation/VegetationSystem.tsx`: world-anchored sampling, city exclusion 28 units.
- `src/components/world3d/city/CastleSystem.tsx`: anchor props + `heightAtRender` for walls/towers/plots/gate.
- `src/components/world3d/city/ResourceNodes.tsx` (unused component): migrated to `getBiomeAtWorld`/`heightAtRender`.
- `src/components/world3d/army/ArmySystem.tsx`: anchor props threaded through `TroopGroup` + `heightAtRender`.
- `src/components/world3d/WorldScene.tsx`: single `cityY` from `heightAtRender`, anchor props passed to castle/army/decals.
- `src/components/world3d/interaction/WorldMapSystem.tsx`: `worldToRender` + `heightAtRender`, culling by `VIEW_RADIUS_UNITS`.
- `src/components/world3d/interaction/RemoteCastlesSystem.tsx` (new): `worldToRender` + `heightAtRender`, default cull `VIEW_RADIUS_UNITS`.
- `src/components/Minimap.tsx`: biome sampling via `getBiomeAtWorld`, markers via `worldToRender`, range = `VIEW_RADIUS_METERS`.
- `src/components/WorldPageClient3D.tsx`: passes `cityX/cityZ/nearbyBases` to `<Minimap />`.

Server:
- `src/lib/world-map-objects.ts`: static `x/z` rescaled ×200 (legacy render units → stored metres); `worldMapTravelMilliseconds` now takes metre offsets relative to the base and no longer multiplies by 200.
- `src/lib/world-generation.ts`: 20,000 m chunks, `getBiomeAtWorld`, distance thresholds in metres, fixed `chunkCenter.y` bug.
- `src/lib/world.ts`: reverted the draft unit reinterpretation (`INITIAL_COORDINATE_EXTENT 350`, `WORLD_MIN_BASE_DISTANCE 60`, `×200` in `nearbyBases.distanceMeters` and base-attack distance) back to the original metres contract; generates procedural objects for every chunk intersecting `VIEW_RADIUS_METERS`; map travel time uses base-relative metres; camp resolution at arrival now uses `resolveWorldMapObject` so procedural camps resolve and reward correctly.

Tests:
- `scripts/test-world-systems.mjs` (new): 12 checks covering constants, chunk math (positive/negative), metres ↔ render units, `worldToRender`/`renderToWorld` round-trip, chunk visibility counts, deterministic generation, chunk bounds, static-object on-screen offsets, travel-time parity, terrain height anchoring/city pad, and biome determinism.

### Verification

- `npx tsc --noEmit` → **0 errors**.
- `npx tsx scripts/test-world-systems.mjs` → **ALL TESTS PASSED (12 checks)**.
- `npx eslint` on every touched file → **0 errors** (only pre-existing repo-wide lint errors elsewhere remain).
- `npm run build` → **compiled successfully** (Next 16.4.3), `/world` and `/api/world*` routes generated.

### Regression / data safety

- No schema change, no migration, no data reset.
- Existing bases keep their stored metre coordinates; render distance is now consistently `metres / 200`.
- Static map objects keep their original on-screen offsets (`-54, -35` render units → `-10,800, -7,000` m) and travel times are identical (`hypot(54,35) × 200` m).
- New missions use distance **from the player's base**, fixing the previous behaviour where travel time was computed from the world origin (stored missions are untouched).

### Known issues / follow-ups

- `WorldResourceNode.x/z` and `WorldRogueCamp.x/z` columns are write-only today. Rows seeded before this change may still contain legacy render-unit numbers; new rows store metres. A one-off data fix would make the columns uniform but is not needed for gameplay and was intentionally not run.
- Procedural chunks add ~50–70 map landmarks inside the 44 km view; each currently uses the full detailed model. LOD/culling for map objects is planned in Phase 3.
- Static sample nodes remain clustered near the world origin (pre-existing design); players far from origin rely on procedural objects.
- `nearbyBases` still loads all bases before sorting and slicing to 20; Phase 3 replaces this with a bounding-box query.

## Phase 2 - Terrain Diversity (implemented)

### What changed

The old terrain sampled a *discrete* biome first and then picked a height inside that biome's
`heightRange`. Two neighbouring biomes with different ranges therefore produced vertical walls at
their border, and the biome test itself was broken: `hash2d` used arithmetic right shifts
(`h >> 13`), so the noise output was always `< 0.5`. Every threshold above `0.5`
(`MOUNTAIN`, `DESERT`, …) was unreachable, which is why the world looked like one endless
grass plain.

Phase 2 replaces that with a single continuous field:

- **Root-cause fix:** `hash2d` now uses unsigned shifts (`>>>`) and `Math.imul`, so noise covers the
  full `0..1` range.
- **Continuous elevation:** `noiseHeight` is a smooth function of one `elevation` field
  (`BASE_HEIGHT = -0.4`, `PLAINS_HEIGHT = 4.2`, `PEAK_HEIGHT = 20`, ridged detail `RIDGE_HEIGHT = 4`).
  No biome-specific height ranges are used for geometry; `heightRange` on `BiomeInfo` is now
  informational only.
- **Smooth water carving:** rivers and lakes are carved with a mask and a *depth cap*
  (`height - 3` / `height - 3.5`), so a river crossing a mountain is a shallow valley, not a canyon.
- **Biome from the field:** land-biome weights (`MOUNTAIN`, `DESERT`, `FOREST`, `COAST`,
  `GRASSLAND`) are normalised sequentially; water is decided from the carved height
  (`< WATER_LEVEL` → `RIVER`/`LAKE`, chosen by the stronger mask).
- **Blended colours:** `getBiomeColor` mixes all land-biome colours by weight, removing hard colour
  borders.
- **Water mesh:** `WaterSystem` now builds one merged mesh (single draw call) from the same height
  grid the terrain uses, emitting a quad wherever a cell's average height is below `WATER_LEVEL`
  (segments clamped 32–128).

### Files changed (Phase 2)

- `src/components/world3d/terrain/BiomeManager.ts`: fixed `hash2d`; added `sampleFields`,
  `computeLandWeights`, `waterBiomeType`, `dominantBiome`; rewrote `noiseHeight`, `getBiomeAt`,
  `getBiomeColor`; updated `heightRange` metadata.
- `src/components/world3d/terrain/WaterSystem.tsx`: rewritten as a single merged water mesh sampled
  from the shared height grid (precomputed grid, no per-quad re-sampling).
- `scripts/test-world-systems.mjs`: 4 new checks (13–16).

### Verification

- `npx tsc --noEmit` → **0 errors**.
- `npx tsx scripts/test-world-systems.mjs` → **ALL TESTS PASSED (16 checks)**.
- `npx eslint` on touched files → **0 errors**.
- `npm run build` → **compiled successfully**.

### Measured terrain characteristics

- All **7 biomes** present in every sampled 44 km view (5 anchors, 1,517 samples each).
- Water (river + lake) covers **~13–16 %** of a view.
- Global height range **−1.10 … 26.80** render units.
- Adjacent 200 m height delta: p50 `0.26`, p90 `0.93`, p99 `2.15`, max `5.11` (no cliffs).
- Adjacent 200 m colour delta max `0.11` (smooth blending).
- `RIVER`/`LAKE` samples are never above `WATER_LEVEL` (0 violations).

### Regression / data safety

- Client-side only: no schema change, no migration, no server data touched.
- The `hash2d` fix changes the procedural biome layout. Any procedural map objects already written to
  the database keep their IDs and dynamic state; only the biome *label* used when generating new
  definitions differs (dev-only mismatch, no stored coordinate change).

### Known issues / follow-ups

- Rivers are wide-ish valleys by design (mask fades over ~0.5 km of noise); narrower rivers would
  need a higher-frequency mask and a finer water grid.
- `COAST` is a low-elevation land blend, not a separate shoreline ring; it is intentionally subtle.
- Water mesh resolution is tied to `settings.terrainSegments` (capped at 128), so very small lakes can
  be missed at the lowest quality setting.

## Phase 3 - Multiplayer Rendering (implemented)

### What changed

Other players' bases were already rendered, but the snapshot loaded **every base in the world**
before sorting, every remote castle used the full detailed model, the remote castle level was
hard-coded to 2, and the 15 s poll could overlap with itself and kept running in hidden tabs.

- **Bounded snapshot query.** `nearbyBases` now uses a bounding box
  (`coordinateX/Z` within `VIEW_RADIUS_METERS` = 44 km) before the precise circular filter and
  `slice(0, 20)`. The query can use the existing `@@unique([coordinateX, coordinateZ])` index, so no
  migration is required.
- **Real castle level.** `nearbyBases` now selects `castleLevel`; `WorldSnapshot` and
  `RemoteBaseInfo` carry it, and remote castles render at the owner's actual level instead of 2.
- **LOD for remote castles** via `LodWrapper` (`Detailed`): full generated castle + flag + nameplate +
  shield dome inside 70 units (14 km), a blocky simplified castle + flag between 70 and 140 units
  (14–28 km), and a single keep silhouette from 140 units up to the 220-unit view edge. Selection
  rings and the click target stay at every distance.
- **Polling hardening.** Snapshot fetches are de-duplicated through a shared in-flight promise, the
  interval skips hidden tabs, and a `visibilitychange` listener refreshes immediately when the tab
  becomes visible again.
- **Minimap sync.** The minimap still receives the same `nearbyBases` array from the snapshot; shielded
  bases are now drawn in blue (`#38bdf8`) instead of orange.

### Files changed (Phase 3)

- `src/lib/world.ts`: `nearbyBases` bbox query + `castleLevel` select; circular distance filter before
  sorting/slicing; `WorldSnapshot.nearbyBases` type gains `castleLevel`.
- `src/components/world3d/interaction/RemoteCastlesSystem.tsx`: LOD tiers (`SimplifiedCastle`,
  `DistantCastle`), real castle level, distance/level nameplate, shield rendering kept at close range.
- `src/components/WorldPageClient3D.tsx`: `useCallback` refresh with in-flight de-duplication,
  visibility-aware polling, shield state forwarded to the minimap.
- `src/components/Minimap.tsx`: optional `pvpShieldUntil` per base and shield colouring.

### Verification

- `npx tsc --noEmit` → **0 errors**.
- `npx tsx scripts/test-world-systems.mjs` → **ALL TESTS PASSED (16 checks)** (coordinate, generation,
  terrain and water contracts unchanged).
- `npx eslint` on every touched file → **0 errors**.
- `npm run build` → **compiled successfully** (Next.js, `/world` and `/api/world*` generated).

### Regression / data safety

- No schema change, no migration, no stored-data change.
- Only in-view bases are returned now. This does not remove any UI capability: remote castles were
  already culled at `VIEW_RADIUS_UNITS` and the attack panel is only reachable by selecting one, so
  bases outside the view were never selectable.
- LOD only changes what is drawn, not positions, ownership, shields or attack resolution.
- Polling behaviour changes are client-side only.

### Known issues / follow-ups

- LOD keeps all three tiers mounted (`Detailed` toggles visibility); geometry/memory for the full
  castle is still created per base. A `DistanceCull`/lazy-mount variant would reduce that further.
- Other players' marches, remote occupancy effects and websocket push updates are still not rendered
  (the 15 s poll is the only sync mechanism).
- Map landmarks (~50–70 procedural objects in view) still use full models; the same LOD approach can be
  applied there next.
- The bbox query is index-friendly only on `coordinateX` (leading column of the composite unique
  index); a dedicated `(coordinateX, coordinateZ)` btree index would make large worlds faster but
  requires a migration, which is intentionally out of scope.
