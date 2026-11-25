import assert from "node:assert";
import { prisma } from "../src/lib/prisma.js";
import {
  advanceWorld,
  loadWorldSnapshot,
  performWorldAction,
  performWorldBuildingAction,
  processScheduledWorldJobs,
} from "../src/lib/world.js";
import {
  WORLD_CASTLE_UPGRADE_SECONDS,
  WORLD_WALL_MAX_LEVEL,
  isWorldPlotUnlocked,
  worldBuildCostForCount,
  worldCastleRequirements,
  worldCastleSlotCount,
  worldBuildingCompletionReward,
  worldWallUpgradeCost,
  worldWallUpgradeSeconds,
} from "../src/lib/world-progression.js";
import {
  WORLD_GATEHOUSE_PLOT_INDEX,
  WORLD_PLOT_LIMIT,
  WORLD_WATCHTOWER_PLOT_INDEXES,
  worldPlotPosition,
} from "../src/lib/world-buildings.js";
import {
  initialRegionSet,
  isRegionOnFrontier,
  regionKey,
  scoutRevealRegionSet,
  worldToRegion,
} from "../src/lib/world-exploration.js";
import {
  createWorldRedeemCode,
  hashWorldRedeemCode,
  normalizeWorldRedeemCode,
  redeemWorldCode,
} from "../src/lib/world-redeem.js";

let passed = 0;
async function testCase(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed += 1;
    console.log(`  ✓ Test ${passed}: ${name}`);
  } catch (err) {
    console.error(`  ✗ FAILED: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

async function cleanupUser(username: string) {
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) await prisma.user.delete({ where: { id: existing.id } });
}

async function createTestUser(username: string) {
  await cleanupUser(username);
  return prisma.user.create({
    data: { username, displayName: `Tester ${username}`, passwordHash: "hash" },
  });
}

async function run() {
  console.log("\n=== TESTING A2 KINGDOM EXPANSION ===\n");

  const user = await createTestUser("test_world_expansion");
  const admin = await createTestUser("test_world_expansion_admin");
  let now = new Date("2026-01-01T00:00:00.000Z");

  await testCase("Initial base wall, slots and fog are seeded", async () => {
    const snapshot = await loadWorldSnapshot(user.id, now);
    assert.strictEqual(snapshot.base.wall.level, 1);
    assert.strictEqual(snapshot.base.wall.pendingLevel, null);
    assert.strictEqual(snapshot.base.slots.unlimited, true);
    assert.strictEqual(snapshot.base.slots.unlocked, WORLD_PLOT_LIMIT);
    assert.strictEqual(snapshot.base.slots.total, WORLD_PLOT_LIMIT);
    assert.strictEqual(snapshot.base.buildQueue.unlimited, true);
    assert.strictEqual(snapshot.exploration.regions.length, initialRegionSet(
      snapshot.base.coordinateX,
      snapshot.base.coordinateZ,
    ).length);
    assert.strictEqual(
      snapshot.exploration.revealedInView,
      snapshot.exploration.regions.length,
    );
    assert(snapshot.exploration.percent > 0);
    assert.strictEqual(snapshot.redeemHistory.length, 0);
  });

  await testCase("Pure progression helpers match the design tables", async () => {
    assert.deepEqual(
      [1, 2, 3, 4].map(worldCastleSlotCount),
      [WORLD_PLOT_LIMIT, WORLD_PLOT_LIMIT, WORLD_PLOT_LIMIT, WORLD_PLOT_LIMIT],
    );
    assert.strictEqual(isWorldPlotUnlocked(3, 1), true);
    assert.strictEqual(isWorldPlotUnlocked(4, 1), true);
    assert.strictEqual(isWorldPlotUnlocked(WORLD_PLOT_LIMIT - 1, 1), true);
    assert.strictEqual(isWorldPlotUnlocked(WORLD_PLOT_LIMIT, 1), false);
    // Inner plots keep their original positions; further plots spiral outward.
    assert.deepEqual(worldPlotPosition(0), [-12, -12]);
    assert(Math.hypot(...worldPlotPosition(12)) > 20);
    // Cost grows 10% per already-placed building.
    assert.deepEqual(worldBuildCostForCount("FARM", 0), { wood: 90, stone: 35 });
    assert.deepEqual(worldBuildCostForCount("FARM", 10), { wood: 180, stone: 70 });
    assert.strictEqual(WORLD_CASTLE_UPGRADE_SECONDS[2], 600);
    assert.strictEqual(worldWallUpgradeCost(2).wood, 300);
    assert.strictEqual(worldWallUpgradeSeconds(2), 180);
    assert.strictEqual(WORLD_WALL_MAX_LEVEL, 10);
    const requirements = worldCastleRequirements(3, 3, [
      { type: "FARM", level: 1 },
    ]);
    assert.strictEqual(requirements.find((r) => r.key === "WALL")?.met, true);
    assert.strictEqual(requirements.find((r) => r.key === "ECONOMY")?.met, false);
    const revealed = new Set(initialRegionSet(0, 0).map((r) => regionKey(r.regionX, r.regionZ)));
    const center = worldToRegion(0, 0);
    assert.strictEqual(isRegionOnFrontier(center.regionX + 3, center.regionZ, revealed), true);
    assert.strictEqual(isRegionOnFrontier(center.regionX + 4, center.regionZ, revealed), false);
    assert.strictEqual(scoutRevealRegionSet(0, 0, 2).length, 25);
  });

  await testCase("Building completion pushes an idempotent reward", async () => {
    await prisma.worldBase.update({
      where: { userId: user.id },
      data: { wood: 5000, stone: 5000, food: 5000 },
    });
    await performWorldBuildingAction(
      user.id,
      { type: "BUILD", plotIndex: 0, buildingType: "FARM" },
      now,
    );
    now = new Date(now.getTime() + 70_000);
    await advanceWorld(user.id, now);
    const expected = worldBuildingCompletionReward("FARM", 1);
    const rewards = await prisma.worldBuildingReward.findMany({ where: { baseId: (await prisma.worldBase.findUniqueOrThrow({ where: { userId: user.id } })).id } });
    assert.strictEqual(rewards.length, 1);
    assert.strictEqual(rewards[0].buildingType, "FARM");
    assert.strictEqual(rewards[0].level, 1);
    assert.strictEqual(rewards[0].wood, expected.wood);
    assert.strictEqual(rewards[0].food, expected.food);
    const snapshot = await loadWorldSnapshot(user.id, now);
    assert.strictEqual(snapshot.base.buildingRewards.length, 1);
    // A later sweep must not grant the same level again.
    await advanceWorld(user.id, new Date(now.getTime() + 3_600_000));
    assert.strictEqual(
      await prisma.worldBuildingReward.count({ where: { baseId: (await prisma.worldBase.findUniqueOrThrow({ where: { userId: user.id } })).id } }),
      1,
    );
  });

  await testCase("Wall upgrade completes and persists defensive stats", async () => {
    await prisma.worldBase.update({
      where: { userId: user.id },
      data: { wood: 5000, stone: 5000 },
    });
    await performWorldBuildingAction(user.id, { type: "UPGRADE_WALL" }, now);
    const pending = await prisma.worldBase.findUniqueOrThrow({ where: { userId: user.id } });
    assert.strictEqual(pending.wallPendingLevel, 2);
    now = new Date(pending.wallUpgradeCompletesAt!.getTime() + 1_000);
    await advanceWorld(user.id, now);
    const snapshot = await loadWorldSnapshot(user.id, now);
    assert.strictEqual(snapshot.base.wall.level, 2);
    assert.strictEqual(snapshot.base.wall.pendingLevel, null);
    assert.strictEqual(snapshot.base.wall.upgradeCompletesAt, null);
    assert(snapshot.base.wall.hitPoints > 4_000);
    assert(snapshot.base.defense.bonusPercent > 0);
    assert(snapshot.base.defense.lootReductionPercent > 0);
  });

  await testCase("No queue or plot cap; multiple builds can run at once", async () => {
    await prisma.worldBase.update({
      where: { userId: user.id },
      data: { wood: 20_000, stone: 20_000, castleLevel: 1 },
    });
    await performWorldBuildingAction(
      user.id,
      { type: "BUILD", plotIndex: 1, buildingType: "FARM" },
      now,
    );
    await performWorldBuildingAction(
      user.id,
      { type: "BUILD", plotIndex: 40, buildingType: "STONE_QUARRY" },
      now,
    );
    const snapshot = await loadWorldSnapshot(user.id, now);
    assert(snapshot.base.buildQueue.active.length >= 2);
    assert(snapshot.buildings.some((b) => b.plotIndex === 40));
    assert.strictEqual(snapshot.base.buildQueue.unlimited, true);
  });

  await testCase("Gatehouse and watchtowers only use their reserved wall slots", async () => {
    await prisma.worldBase.update({
      where: { userId: user.id },
      data: { castleLevel: 3, wood: 20_000, stone: 20_000 },
    });
    await assert.rejects(
      performWorldBuildingAction(
        user.id,
        { type: "BUILD", plotIndex: 3, buildingType: "GATEHOUSE" },
        now,
      ),
      /cổng chính/i,
    );
    await assert.rejects(
      performWorldBuildingAction(
        user.id,
        { type: "BUILD", plotIndex: 4, buildingType: "WATCHTOWER" },
        now,
      ),
      /tháp tường/i,
    );
    await assert.rejects(
      performWorldBuildingAction(
        user.id,
        { type: "BUILD", plotIndex: WORLD_GATEHOUSE_PLOT_INDEX, buildingType: "FARM" },
        now,
      ),
      /chỉ dành cho/i,
    );
    await performWorldBuildingAction(
      user.id,
      { type: "BUILD", plotIndex: WORLD_GATEHOUSE_PLOT_INDEX, buildingType: "GATEHOUSE" },
      now,
    );
    await performWorldBuildingAction(
      user.id,
      { type: "BUILD", plotIndex: WORLD_WATCHTOWER_PLOT_INDEXES[0], buildingType: "WATCHTOWER" },
      now,
    );
    const snapshot = await loadWorldSnapshot(user.id, now);
    assert.strictEqual(snapshot.base.defense.gatehouseLevel, 0); // not completed yet
    const activeIndices = snapshot.base.buildQueue.active.map((entry) => entry.plotIndex);
    assert(activeIndices.includes(WORLD_GATEHOUSE_PLOT_INDEX));
    assert(activeIndices.includes(WORLD_WATCHTOWER_PLOT_INDEXES[0]));
  });

  await testCase("Scout mission reserves troops, reveals regions and returns troops", async () => {
    const base = await prisma.worldBase.findUniqueOrThrow({ where: { userId: user.id } });
    await prisma.worldBase.update({
      where: { userId: user.id },
      data: {
        castleLevel: 3,
        wood: 5000,
        stone: 5000,
        food: 5000,
        infantry: 60,
        archers: 30,
        cavalry: 10,
      },
    });
    // Let the earlier buildings finish before starting the scout camp.
    await advanceWorld(user.id, new Date(now.getTime() + 200_000));
    await performWorldBuildingAction(
      user.id,
      { type: "BUILD", plotIndex: 2, buildingType: "SCOUT_CAMP" },
      new Date(now.getTime() + 200_000),
    );
    now = new Date(now.getTime() + 400_000);
    await advanceWorld(user.id, now);

    const center = worldToRegion(base.coordinateX ?? 0, base.coordinateZ ?? 0);
    const target = { regionX: center.regionX + 3, regionZ: center.regionZ };
    const before = await loadWorldSnapshot(user.id, now);
    assert.strictEqual(before.exploration.regions.length, 25);
    assert.strictEqual(before.base.army.infantry, 60);

    const dispatch = await performWorldAction(
      user.id,
      {
        type: "scoutRegion",
        targetRegionX: target.regionX,
        targetRegionZ: target.regionZ,
        infantry: 10,
        archers: 5,
        cavalry: 0,
      },
      now,
    );
    if (!("durationSeconds" in dispatch) || !("completesAt" in dispatch)) {
      throw new Error("Kết quả trinh sát không hợp lệ.");
    }
    assert(dispatch.durationSeconds >= 8);
    const reserved = await prisma.worldBase.findUniqueOrThrow({ where: { userId: user.id } });
    assert.strictEqual(reserved.infantry, 50);
    assert.strictEqual(reserved.archers, 25);

    now = new Date(new Date(dispatch.completesAt).getTime() + 1_000);

    await processScheduledWorldJobs(now);
    const after = await loadWorldSnapshot(user.id, now);
    assert(after.exploration.regions.length > 25);
    assert.strictEqual(after.base.army.infantry, 60);
    assert.strictEqual(after.base.army.archers, 30);
    assert.strictEqual(after.exploration.missions[0]?.status, "COMPLETED");
    assert(after.exploration.missions[0]!.revealedCount > 0);
  });

  await testCase("Scout reports are server-filtered by revealed regions", async () => {
    const snapshot = await loadWorldSnapshot(user.id, now);
    for (const base of snapshot.nearbyBases) {
      const region = worldToRegion(base.coordinateX, base.coordinateZ);
      assert(
        snapshot.exploration.regions.some(
          (r) => r.regionX === region.regionX && r.regionZ === region.regionZ,
        ),
        `Remote base in unrevealed region (${region.regionX}, ${region.regionZ})`,
      );
    }
  });

  await testCase("Redeem codes are hashed, capped and credit A2 Coin once", async () => {
    const code = "A2EXPANSIONTEST";
    // A previous interrupted run may have left the fixed test code behind.
    await prisma.worldRedeemCode.deleteMany({
      where: { codeHash: hashWorldRedeemCode(code) },
    });
    const created = await createWorldRedeemCode(admin.id, {
      code,
      campaign: "Expansion test",
      rewardWood: 100,
      rewardStone: 50,
      rewardFood: 20,
      rewardIron: 0,
      rewardA2Coin: 25,
      maxUses: 1,
      perUserLimit: 1,
    });
    assert.strictEqual(created.code, normalizeWorldRedeemCode(code));
    assert.notStrictEqual(created.record.codeHash, undefined);
    const stored = await prisma.worldRedeemCode.findUniqueOrThrow({ where: { id: created.record.id } });
    assert.strictEqual(stored.codeHash, hashWorldRedeemCode(code));
    assert(!stored.codePreview.includes(code));

    const before = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const result = await redeemWorldCode(user.id, code.toLowerCase(), now);
    assert(result.message.includes("A2 Coin"));
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.strictEqual(after.a2Coins, before.a2Coins + 25);
    await assert.rejects(redeemWorldCode(user.id, code, now), /tối đa|hết lượt/i);
    const snapshot = await loadWorldSnapshot(user.id, now);
    assert.strictEqual(snapshot.redeemHistory.length, 1);
    assert(snapshot.redeemHistory[0].rewardA2Coin === 25);
  });

  await cleanupUser(user.username);
  await cleanupUser(admin.username);
  await prisma.$disconnect();
  console.log(`\nAll ${passed} tests passed successfully!\n`);
}

run().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
