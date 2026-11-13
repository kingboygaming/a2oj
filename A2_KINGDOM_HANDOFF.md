# A2 Kingdom 3D Handoff

## Current implementation

- The existing Next.js App Router and React Three Fiber scene remain in use. World Map and City View are separate views in `WorldScene`; camera state and controls remain in the existing camera store/controller.
- World Map contains ten selectable resource landmarks and four rogue camps. The models reuse the existing procedural trees, rocks, houses, flags, and troop models.
- Clicking a landmark opens its interaction panel with type, level, quantity or threat, owner, rewards, and troop selection.
- Resource occupation, gathering, camp combat, battle results, and rewards are **browser-only prototype state**. They do not dispatch real marches, persist ownership, alter inventory, or award items.
- City View keeps the central Main Castle, walls, gate, and watchtowers. The twelve surrounding plots start empty; existing building models/assets are retained.
- Players can select a plot, preview a building model, and submit build, upgrade, or demolition actions. These actions are authenticated and persisted by `/api/world/buildings`; costs, plot uniqueness, castle requirements, construction times, upgrade times, and demolition refunds are checked server-side.
- Castle level and its pending upgrade are persisted. Castle upgrades and building construction complete from timestamps when the world state is next loaded.
- New bases start with 350 wood, 250 stone, and no legacy factory production. Existing players' resource amounts and factory levels are not rewritten by the migration. New production comes from completed Lumber Mills (+20 wood/hour/level) and Stone Quarries (+10 stone/hour/level); each Warehouse building adds 2,000 storage.
- Infantry, archers, and cavalry training now requires a completed Barracks, Archery Range, or Stable, respectively. Training prerequisites are checked on both the client and server.
- Iron Mine and Farm have distinct 3D models and construction data, but iron and food inventories/production are not yet integrated. Military buildings other than the three training buildings are also placeholders for future systems.

## Placement and gameplay boundaries

- Building plots are fixed, server-validated slots around the castle. A selected valid plot shows a green ghost preview; the current prototype does not support free-form dragging or arbitrary terrain placement.
- World-map node and camp definitions are static sample data. Their quantities, ownership, combat outcomes, travel, contesting, depletion/regeneration, and loot are not authoritative or multiplayer-synchronized.
- The new buildings and city layout use procedural Three.js models. No external 3D model/texture asset library was found during the initial audit.
- No player data is reset by the schema migration. Schema defaults affect newly created bases only; the PvP base-loss flow remains a separate game rule.

## Database and validation

- `WorldBuilding` stores each occupied plot and its level/construction timestamps. A unique `(baseId, plotIndex)` constraint prevents overlapping occupancy.
- The checked-in migration adds the building table and new castle fields, and changes defaults for newly created bases without updating existing resource rows.
- Apply the PostgreSQL migration with the repository's `npm run db:migrate:deploy`; local SQLite uses the existing `npm run db:sync:sqlite` workflow.
- The original `A2_KINGDOM_HANDOFF.md` was not present in the repository when this rework began; this file records the current state and remaining boundaries.

## Recommended next work

1. Move resource nodes and rogue camps to persistent database records, with server-owned reservations, marches, combat resolution, rewards, and idempotent jobs.
2. Add iron and food to the server economy and connect their production/building levels to offline progression and resource caps.
3. Replace fixed plot-only placement with a server-validated spatial placement model if free-form placement is desired.
4. Add focused integration tests for concurrent plot placement, costs/refunds, timed completion, offline production, castle upgrades, and troop-building prerequisites.
