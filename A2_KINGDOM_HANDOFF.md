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
- Map object definitions remain static sample data; their live quantities, ownership, travel, contesting, depletion/regeneration, combat outcomes, cooldowns, and loot are server-authoritative and multiplayer-synchronized.
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
