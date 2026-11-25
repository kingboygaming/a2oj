# A2 Kingdom — Expansion Plan (audit → implementation)

> Scope: extend the existing A2 Kingdom in the live Online Judge codebase.
> No rewrite, no OJ auth change, no A2Coin re-definition, no player-data reset.

## 1. Audited architecture

| Layer | Location | Notes |
| --- | --- | --- |
| OJ auth / users | `src/lib/auth.ts`, `prisma.User` | HMAC session cookie, `Role = STUDENT/TEACHER/ADMIN`. Untouched. |
| World state | `src/lib/world.ts` (~4.3k lines) | Authoritative snapshot, lazy offline progression (`advanceWorld`), scheduled sweeps (`processScheduledWorldJobs`), actions (`performWorldAction`, `performWorldBuildingAction`). |
| World config | `src/lib/world-buildings.ts`, `world-research.ts`, `world-map-objects.ts`, `world-generation.ts`, `world-coordinates.ts` | Isomorphic (client + server) game data. |
| Realtime | `src/lib/world-realtime*.ts`, `src/components/world3d/realtime/useWorldRealtime.ts` | Supabase broadcast hints + authoritative reads, 12 s polling fallback. |
| 3D | `src/components/world3d/**` | R3F; procedural models only (no external GLB found). City View + World Map in one `Canvas`. |
| API | `src/app/api/world/**` | `/api/world` (full snapshot), `/api/world/actions`, `/api/world/buildings`, `/api/world/research`, `/api/world/map/actions`, `/api/world/entities`, `/api/world/alliance`, `/api/cron/world`. |
| Admin | `src/app/admin/world` + `/api/admin/world/events` | `ADMIN` role check server-side. |
| DB | `prisma/schema.prisma` (SQLite → Postgres copy generated at build) | Versioned Postgres migrations in `prisma/migrations/*`. Local dev uses `prisma db push`. |

Already implemented (verified by reading the code, not just file names):

- Resources wood/stone/iron/food/rare/A2Coin, warehouse capacity, timestamp-based offline production with a 48 h cap.
- Fixed 12 city plots; build / upgrade / demolish; per-type castle requirements; construction timestamps.
- Castle levels, castle upgrade timestamps, research tree (military tier, production, research speed, field medicine).
- Army training queue, hospital + wounded/dead split, healing queue, field medicine.
- Map resource nodes, rogue camps, marches with travel/return, PvP base attacks, occupation, shields, alliances, world events/boss, battle reports (as attack/march rows).
- Enemy-base scouting **report** (instant intel, rich at scout-camp Lv2/3) and scout-camp view radius.
- Multiplayer rendering, LOD for remote castles, fullscreen layout, hybrid realtime.
- Admin world event management.

Missing / incomplete vs. the target brief:

1. No building-completion reward or reward history.
2. Castle/building upgrade times are hard-coded (`nextLevel * 5 min`, `constructionSeconds * level`); no configurable castle table; no upgrade launch queue limit.
3. All 12 plots are usable at castle level 1 → no castle-driven slot expansion.
4. No wall progression, HP/defence contribution, gatehouse/watchtower defence buildings, or castle→wall prerequisite.
5. No Fog of War, no persisted exploration, no scouting **missions** to regions, no discovery rewards. The whole visible map is sent to every client.
6. No gift/redeem code system or Game Admin UI for it.
7. 3D: no fog, no scout-march marker, no wall-level visual, no building-completion effect.

## 2. Files to change

Server / data:

- `prisma/schema.prisma` (+ new migration `prisma/migrations/2026-11-25T1200_world_expansion/migration.sql`).
- `src/lib/world-buildings.ts` (new groups, wall/watchtower/gatehouse, slot config re-export).
- `src/lib/world-progression.ts` (**new**, data-driven castle/wall/building time, cost, slot, reward, defence config).
- `src/lib/world-exploration.ts` (**new**, isomorphic region math, reveal sets, rewards, percent).
- `src/lib/world-redeem.ts` (**new**, hashing, validation, transactional redemption, admin queries).
- `src/lib/world.ts` (rewards, wall, slots, queue, exploration filtering, scout missions, defence in combat, snapshot fields).
- `src/app/api/world/buildings/route.ts` (`UPGRADE_WALL`, slot max).
- `src/app/api/world/actions/route.ts` (`scoutRegion`).
- `src/app/api/world/redeem/route.ts` (**new**).
- `src/app/api/admin/world/redeem-codes/route.ts`, `[id]/route.ts`, `[id]/redemptions/route.ts` (**new**).
- `src/app/admin/world/page.tsx` (link to code admin), `src/app/admin/world/codes/page.tsx` (**new**).

Client / 3D:

- `src/components/WorldPageClient3D.tsx` (new tabs, scout-region panel, wall card, gift-code tab, reward toasts, timers).
- `src/components/world3d/city/CityBuildingPanel.tsx` (slot state, queue state, reward preview).
- `src/components/world3d/city/CastleSystem.tsx` (wall level/gate visuals, locked slots).
- `src/components/world3d/city/BuildingFactory.tsx` (map `WATCHTOWER`/`GATEHOUSE` to existing towers/gate; wall level).
- `src/components/world3d/terrain/FogOfWarSystem.tsx` (**new**).
- `src/components/world3d/army/ScoutMissionMarkers.tsx` (**new**).
- `src/components/world3d/WorldScene.tsx` (mount fog + markers, pass wall/exploration).
- `src/components/WorldRedeemCodeAdmin.tsx` (**new**).

Tests:

- `scripts/test-world-expansion.ts` (**new**): progression math, slots, rewards idempotency, wall prerequisite, exploration math, fog filtering, scout mission, redeem limits/expiry/duplicate/hash, admin permission helper.
- Keeps existing `scripts/test-world-systems.mjs`, `test-world-realtime*.mjs`, `test-hospital-system.ts`, `test-parallel-training.ts` green.

## 3. Database changes (additive only)

New columns on `WorldBase` (all defaulted, no rewrite):

- `wallLevel Int @default(1)`, `wallPendingLevel Int?`, `wallUpgradeCompletesAt DateTime?`.

New tables:

| Table | Purpose | Constraints |
| --- | --- | --- |
| `WorldBuildingReward` | Completion reward ledger + history | `@@unique([buildingId, level])` → exactly-once |
| `WorldExploration` | Persisted revealed regions per base | `@@unique([baseId, regionX, regionZ])` |
| `WorldScoutMission` | Server-authoritative scout mission (troops, timers, rewards) | `@@index([status, completesAt])` |
| `WorldRedeemCode` | Gift code definition (hash only) | `codeHash @unique` |
| `WorldRedeemRedemption` | Redemption ledger | `@@unique([codeId, userId, sequence])` |
| `WorldAdminAuditLog` | Admin action audit trail | `@@index([createdAt])` |

Rollback: drop the new tables and the three columns. No existing column is altered or removed; no data deleted.
Existing players: `wallLevel` defaults to 1; first rewards are granted only for completions observed after deploy
(no retroactive back-pay), and exploration starts with a 25-region reveal around the base.

## 4. Design decisions / dependencies

- **Rewards are pushed, not claimed.** `advanceWorld` (already run on every snapshot/action) grants the reward row
  and credits resources in one transaction, guarded by `(buildingId, level)`. This is idempotent under retries and
  impossible to farm from the client. No new "claim" endpoint exists.
- **Slots** are derived from castle level (`4/6/9/12`, capped by the 12 existing plots). Plot index remains the
  stable location key; no coordinate/plot migration.
- **One construction queue** for city plots (`WORLD_BUILD_QUEUE_LIMIT = 1`), separate from castle, research, training
  and healing queues (those were already independent). Castle time comes from the prompt's table.
- **Wall** is a base-level structure (not a plot), so existing 12-plot layouts never move. Wall level ≥ castle level
  is required for the next castle upgrade. Watchtower/Gatehouse are optional plot buildings that add defence.
- **Fog of War** is region based (5 km cells), persisted per base. Server filters map definitions, states and remote
  bases to revealed cells, which is the security boundary. Reveal only happens through a completed scout mission.
- **Scouting missions** reserve troops at dispatch, reveal a radius of cells at completion, return survivors and pay
  first-discovery rewards once per cell. Lazy processing (cron + snapshot load) keeps Vercel stateless.
- **Redeem codes** store SHA-256(normalized code) and a masked preview. Redemption is transactional with an
  optimistic `usedCount` guard, per-user limit and expiry checks. A2Coin uses the existing `a2Coins` +
  `PointTransaction` path. Admin routes re-check `role === "ADMIN"` server-side and write audit rows.
- **No server process**: all timers are timestamps + lazy sweeps.

Dependency order: schema/config → economy+slots+queue → wall/defence → exploration/scouting → redeem/admin →
3D/UI → tests.

## 5. Risks

| Risk | Mitigation |
| --- | --- |
| Rewards double-granted under concurrent requests | DB unique key + single transaction, retry loop |
| Wall prerequisite blocks existing high-level castles | It gates only the *next* castle upgrade; wall can be upgraded first; documented in UI |
| Exploration filtering "hides" objects existing players saw | 25-cell initial reveal; scouting reveals 25–81 cells; documented as the new fog design |
| 5 km region list growth in snapshot payload | Only regions inside the current view radius are serialised; percent computed server-side |
| Fog shader cost on integrated GPUs | One terrain-shaped mesh + 2 textures, no per-cell meshes; respects Low/Medium/High |
| Redeem brute force / duplicate | Token-bucket rate limit, hashed lookup, transactional guard, audit log |
| Contested SQLite dev DB writes | Same optimistic-version pattern already used; tests run sequentially |

## 6. Test cases (acceptance)

Economy: reward once per `(building, level)`, no reward before completion, capacity cap, offline production unchanged.
Building: slot count per castle level, locked plot rejected server-side, duplicate plot rejected, queue limit, castle
time table, wall requirement.
Defence: wall bonus applied to defender power, loot reduction, wall level persisted, capture resets to 1.
Exploration: percent math, reveal set geometry, no double reward, only frontier cells scouted, out-of-view rejected,
fog filtering excludes unrevealed bases/objects, missions processed once.
Redeem: valid/expired/limit/duplicate/disabled/invalid, per-user limit, concurrency guard, admin-only access,
audit row is written, no A2Coin path change for other flows.
3D: fog mesh count constant, no coordinate change, no camera reset, quality presets still work.

## 7. Implementation status

Tracked in `A2_KINGDOM_HANDOFF.md` (sections “Phase 7+”).

### Post-implementation adjustment (user decision)

The slot cap and one-at-a-time build queue were removed after implementation, per player request:
every plot index is usable from castle level 1 and unlimited builds may run concurrently. A purely
technical `WORLD_PLOT_LIMIT = 10_000` guards malformed indexes. Instead of a count limit, the next
building costs +10 % wood/stone per already-placed building (`worldBuildCostForCount`). The 3D city
keeps the original 12 inner plot positions and generates further plots in outward spiral rings
(`worldPlotPosition`). The acceptance cases about "locked plot rejected" / "queue limit" in §6 were
replaced by `scripts/test-world-expansion.ts` cases asserting unlimited concurrent builds, a high
plot index, and the escalating cost curve.
