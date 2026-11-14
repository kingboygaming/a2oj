/**
 * Verification test for requirement 9:
 * Cho phép huấn luyện quân khi đang điều quân (Parallel Army Training)
 *
 * All 9 mandatory test scenarios:
 * 1. Có toàn bộ quân ở căn cứ → Train thành công.
 * 2. Một phần quân đang hành quân → vẫn Train được.
 * 3. Toàn bộ quân đang hành quân → vẫn Train được.
 * 4. Quân đang tấn công NPC → vẫn Train được.
 * 5. Quân đang trinh sát → vẫn Train được.
 * 6. Train hoàn thành khi quân chưa trở về → quân mới vẫn được cộng vào kho dự trữ.
 * 7. Thiếu tài nguyên → không được Train.
 * 8. Gửi hai yêu cầu Train đồng thời → không bị trừ tài nguyên hoặc tạo lính hai lần.
 * 9. Reload trang hoặc offline → tiến trình vẫn chính xác.
 *
 * Run with: npx tsx scripts/test-parallel-training.ts
 */

import assert from "node:assert";
import { prisma } from "../src/lib/prisma.js";
import {
  performWorldAction,
  loadWorldSnapshot,
  advanceWorld,
} from "../src/lib/world.js";

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

async function setupTestUser(username: string) {
  const user = await prisma.user.upsert({
    where: { username },
    update: {},
    create: {
      username,
      displayName: `Tester ${username}`,
      passwordHash: "mock_hash",
    },
  });

  const now = new Date();
  await loadWorldSnapshot(user.id, now);

  const base = await prisma.worldBase.findUniqueOrThrow({ where: { userId: user.id } });

  // Ensure barracks, archery range, and stable are built
  const buildingsToEnsure = ["BARRACKS", "ARCHERY_RANGE", "STABLE"] as const;
  for (let i = 0; i < buildingsToEnsure.length; i++) {
    const bType = buildingsToEnsure[i];
    const existing = await prisma.worldBuilding.findFirst({
      where: { baseId: base.id, buildingType: bType },
    });
    if (!existing) {
      await prisma.worldBuilding.create({
        data: {
          baseId: base.id,
          plotIndex: 10 + i,
          buildingType: bType,
          level: 1,
          completesAt: new Date(now.getTime() - 60_000),
          completedAt: new Date(now.getTime() - 60_000),
        },
      });
    } else if (existing.level < 1) {
      await prisma.worldBuilding.update({
        where: { id: existing.id },
        data: { level: 1, completesAt: new Date(now.getTime() - 60_000), completedAt: new Date(now.getTime() - 60_000) },
      });
    }
  }

  // Reset base resources and state
  await prisma.worldBase.update({
    where: { id: base.id },
    data: {
      wood: 50_000,
      stone: 50_000,
      food: 50_000,
      infantry: 100,
      archers: 100,
      cavalry: 100,
      trainingType: null,
      trainingCount: 0,
      trainingCompletesAt: null,
      marchActive: false,
      activePvpAttackId: null,
    },
  });

  // Clean up any lingering marches
  await prisma.worldMapMarch.deleteMany({ where: { userId: user.id } });
  await prisma.worldMarch.deleteMany({ where: { userId: user.id } });
  await prisma.worldBaseAttack.deleteMany({
    where: { OR: [{ attackerUserId: user.id }, { defenderUserId: user.id }] },
  });

  return user;
}

async function runAllTests() {
  console.log("=== KIỂM THỬ: PARALLEL ARMY TRAINING (REQUIREMENT 9) ===\n");

  const testUser = await setupTestUser("test_parallel_army_user");
  const userId = testUser.id;

  // ─────────────────────────────────────────────────────────────
  // 1. Có toàn bộ quân ở căn cứ → Train thành công.
  // ─────────────────────────────────────────────────────────────
  await testCase("Có toàn bộ quân ở căn cứ → Train thành công", async () => {
    const baseBefore = await prisma.worldBase.findUniqueOrThrow({ where: { userId } });
    assert.strictEqual(baseBefore.marchActive, false);
    assert.strictEqual(baseBefore.trainingType, null);

    const result = await performWorldAction(userId, {
      type: "train",
      troopType: "INFANTRY",
      count: 10,
    });
    assert(result.message.includes("Đã bắt đầu huấn luyện 10"));

    const baseAfter = await prisma.worldBase.findUniqueOrThrow({ where: { userId } });
    assert.strictEqual(baseAfter.trainingType, "INFANTRY");
    assert.strictEqual(baseAfter.trainingCount, 10);
    assert(baseAfter.trainingCompletesAt !== null);
    assert(baseAfter.wood < baseBefore.wood);
    assert(baseAfter.stone < baseBefore.stone);

    // Reset training queue for next test
    await prisma.worldBase.update({
      where: { userId },
      data: { trainingType: null, trainingCount: 0, trainingCompletesAt: null },
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 2. Một phần quân đang hành quân → vẫn Train được.
  // ─────────────────────────────────────────────────────────────
  await testCase("Một phần quân đang hành quân → vẫn Train được", async () => {
    const now = new Date();
    // Simulate 40 infantry dispatched on a world map march
    await prisma.worldMapMarch.create({
      data: {
        userId,
        targetKind: "RESOURCE",
        targetId: "test_node_partial",
        actionType: "OCCUPY",
        infantry: 40,
        archers: 0,
        cavalry: 0,
        dispatchedAt: now,
        arrivesAt: new Date(now.getTime() + 60_000),
        status: "IN_TRANSIT",
      },
    });
    await prisma.worldBase.update({
      where: { userId },
      data: { infantry: 60, marchActive: false },
    });

    // Train should succeed even though 40 infantry are marching!
    const result = await performWorldAction(userId, {
      type: "train",
      troopType: "INFANTRY",
      count: 15,
    });
    assert(result.message.includes("Đã bắt đầu huấn luyện 15"));

    const baseAfter = await prisma.worldBase.findUniqueOrThrow({ where: { userId } });
    assert.strictEqual(baseAfter.trainingType, "INFANTRY");
    assert.strictEqual(baseAfter.trainingCount, 15);

    // Cleanup
    await prisma.worldMapMarch.deleteMany({ where: { userId } });
    await prisma.worldBase.update({
      where: { userId },
      data: { trainingType: null, trainingCount: 0, trainingCompletesAt: null, infantry: 100 },
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 3. Toàn bộ quân đang hành quân → vẫn Train được.
  // ─────────────────────────────────────────────────────────────
  await testCase("Toàn bộ quân đang hành quân → vẫn Train được", async () => {
    const now = new Date();
    // Simulate all 100 infantry marching
    await prisma.worldMapMarch.create({
      data: {
        userId,
        targetKind: "RESOURCE",
        targetId: "test_node_all",
        actionType: "OCCUPY",
        infantry: 100,
        archers: 0,
        cavalry: 0,
        dispatchedAt: now,
        arrivesAt: new Date(now.getTime() + 120_000),
        status: "IN_TRANSIT",
      },
    });
    // Base has 0 infantry left
    await prisma.worldBase.update({
      where: { userId },
      data: { infantry: 0, marchActive: false },
    });

    // Train should succeed even though ALL infantry are on the march!
    const result = await performWorldAction(userId, {
      type: "train",
      troopType: "INFANTRY",
      count: 20,
    });
    assert(result.message.includes("Đã bắt đầu huấn luyện 20"));

    const baseAfter = await prisma.worldBase.findUniqueOrThrow({ where: { userId } });
    assert.strictEqual(baseAfter.trainingType, "INFANTRY");
    assert.strictEqual(baseAfter.trainingCount, 20);

    // Cleanup
    await prisma.worldMapMarch.deleteMany({ where: { userId } });
    await prisma.worldBase.update({
      where: { userId },
      data: { trainingType: null, trainingCount: 0, trainingCompletesAt: null, infantry: 100 },
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 4. Quân đang tấn công NPC → vẫn Train được.
  // ─────────────────────────────────────────────────────────────
  await testCase("Quân đang tấn công NPC → vẫn Train được", async () => {
    const now = new Date();
    // Simulate march attacking a rogue camp
    await prisma.worldMapMarch.create({
      data: {
        userId,
        targetKind: "ROGUE_CAMP",
        targetId: "camp_npc_test",
        actionType: "ATTACK",
        infantry: 50,
        archers: 50,
        cavalry: 0,
        dispatchedAt: now,
        arrivesAt: new Date(now.getTime() + 90_000),
        status: "IN_TRANSIT",
      },
    });

    const result = await performWorldAction(userId, {
      type: "train",
      troopType: "ARCHERS",
      count: 10,
    });
    assert(result.message.includes("Đã bắt đầu huấn luyện 10 Cung thủ"));

    const baseAfter = await prisma.worldBase.findUniqueOrThrow({ where: { userId } });
    assert.strictEqual(baseAfter.trainingType, "ARCHERS");
    assert.strictEqual(baseAfter.trainingCount, 10);

    // Cleanup
    await prisma.worldMapMarch.deleteMany({ where: { userId } });
    await prisma.worldBase.update({
      where: { userId },
      data: { trainingType: null, trainingCount: 0, trainingCompletesAt: null },
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 5. Quân đang trinh sát / tấn công căn cứ → vẫn Train được.
  // ─────────────────────────────────────────────────────────────
  await testCase("Quân đang trinh sát / tham gia PvP attack → vẫn Train được", async () => {
    const now = new Date();
    // Create opponent
    const opponent = await prisma.user.upsert({
      where: { username: "test_pvp_target" },
      update: {},
      create: { username: "test_pvp_target", displayName: "Target", passwordHash: "mock" },
    });
    await loadWorldSnapshot(opponent.id, now);

    // Simulate an active base attack
    const attack = await prisma.worldBaseAttack.create({
      data: {
        attackerUserId: userId,
        defenderUserId: opponent.id,
        distanceMeters: 5000,
        infantry: 30,
        archers: 30,
        cavalry: 30,
        dispatchedAt: now,
        arrivesAt: new Date(now.getTime() + 60_000),
        status: "IN_TRANSIT",
      },
    });
    await prisma.worldBase.update({
      where: { userId },
      data: { activePvpAttackId: attack.id },
    });

    // Train should succeed even with activePvpAttackId set!
    const result = await performWorldAction(userId, {
      type: "train",
      troopType: "CAVALRY",
      count: 5,
    });
    assert(result.message.includes("Đã bắt đầu huấn luyện 5 Kỵ binh"));

    const baseAfter = await prisma.worldBase.findUniqueOrThrow({ where: { userId } });
    assert.strictEqual(baseAfter.trainingType, "CAVALRY");
    assert.strictEqual(baseAfter.trainingCount, 5);

    // Cleanup
    await prisma.worldBaseAttack.deleteMany({ where: { id: attack.id } });
    await prisma.worldBase.update({
      where: { userId },
      data: { activePvpAttackId: null, trainingType: null, trainingCount: 0, trainingCompletesAt: null },
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 6. Train hoàn thành khi quân chưa trở về → quân mới vẫn được cộng vào kho dự trữ.
  // ─────────────────────────────────────────────────────────────
  await testCase("Train hoàn thành khi quân chưa trở về → quân mới vẫn được cộng vào kho dự trữ", async () => {
    const now = new Date();
    const initialInfantryAtBase = 50;
    const marchingInfantry = 50;
    const trainingCount = 20;

    // Set base infantry to 50
    await prisma.worldBase.update({
      where: { userId },
      data: {
        infantry: initialInfantryAtBase,
        trainingType: null,
        trainingCount: 0,
        trainingCompletesAt: null,
      },
    });

    // Create a march returning in 10 minutes
    const march = await prisma.worldMapMarch.create({
      data: {
        userId,
        targetKind: "RESOURCE",
        targetId: "node_far_away",
        actionType: "OCCUPY",
        infantry: marchingInfantry,
        archers: 0,
        cavalry: 0,
        dispatchedAt: now,
        arrivesAt: new Date(now.getTime() + 300_000),
        returnsAt: new Date(now.getTime() + 600_000),
        status: "RETURNING",
      },
    });

    // Start training 20 infantry (e.g. finishes in 60s)
    await performWorldAction(userId, {
      type: "train",
      troopType: "INFANTRY",
      count: trainingCount,
    });

    // Simulate time advancing 120s: training completes, but march has NOT returned yet (returns in 600s)
    const simulatedNow = new Date(now.getTime() + 120_000);
    const snap = await loadWorldSnapshot(userId, simulatedNow);

    // Training should be finished!
    assert.strictEqual(snap.base.army.trainingType, null);
    // Reserve at base should now be initial (50) + trained (20) = 70!
    assert.strictEqual(snap.base.army.infantry, initialInfantryAtBase + trainingCount);

    // Now advance time to 700s when march finally returns
    const futureNow = new Date(now.getTime() + 700_000);
    const snapAfterReturn = await loadWorldSnapshot(userId, futureNow);

    // Total infantry should now be 50 + 20 + 50 = 120!
    assert.strictEqual(
      snapAfterReturn.base.army.infantry,
      initialInfantryAtBase + trainingCount + marchingInfantry,
    );

    // Cleanup
    await prisma.worldMapMarch.deleteMany({ where: { id: march.id } });
  });

  // ─────────────────────────────────────────────────────────────
  // 7. Thiếu tài nguyên → không được Train.
  // ─────────────────────────────────────────────────────────────
  await testCase("Thiếu tài nguyên → không được Train", async () => {
    // Set resources to 0
    await prisma.worldBase.update({
      where: { userId },
      data: { wood: 0, stone: 0, trainingType: null, trainingCount: 0, trainingCompletesAt: null },
    });

    let thrownError: any = null;
    try {
      await performWorldAction(userId, {
        type: "train",
        troopType: "INFANTRY",
        count: 10,
      });
    } catch (err: any) {
      thrownError = err;
    }

    assert(thrownError !== null, "Phải ném lỗi khi thiếu tài nguyên");
    assert(
      thrownError.message.includes("gỗ") || thrownError.message.includes("đá"),
      `Thông báo lỗi: ${thrownError.message}`,
    );

    // Restore resources
    await prisma.worldBase.update({
      where: { userId },
      data: { wood: 50_000, stone: 50_000 },
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 8. Gửi hai yêu cầu Train đồng thời → không bị trừ tài nguyên hoặc tạo lính hai lần.
  // ─────────────────────────────────────────────────────────────
  await testCase("Gửi hai yêu cầu Train đồng thời → không bị trừ tài nguyên hoặc tạo lính hai lần", async () => {
    const now = new Date();
    await prisma.worldBase.update({
      where: { userId },
      data: {
        wood: 1500,
        stone: 1500,
        trainingType: null,
        trainingCount: 0,
        trainingCompletesAt: null,
        lastSimulatedAt: now,
      },
    });

    const woodBefore = 1500;
    // Send two concurrent train requests
    const [res1, res2] = await Promise.allSettled([
      performWorldAction(userId, { type: "train", troopType: "INFANTRY", count: 10 }, now),
      performWorldAction(userId, { type: "train", troopType: "INFANTRY", count: 10 }, now),
    ]);

    const successes = [res1, res2].filter((r) => r.status === "fulfilled");
    const rejections = [res1, res2].filter((r) => r.status === "rejected");

    assert.strictEqual(successes.length, 1, "Chỉ duy nhất 1 yêu cầu train được thành công");
    assert.strictEqual(rejections.length, 1, "Yêu cầu thứ hai phải bị từ chối");

    const baseAfter = await prisma.worldBase.findUniqueOrThrow({ where: { userId } });
    assert.strictEqual(baseAfter.trainingType, "INFANTRY");
    assert.strictEqual(baseAfter.trainingCount, 10);
    // Cost of 10 infantry is 100 wood (10 * 10). Should only be deducted once!
    assert.strictEqual(baseAfter.wood, woodBefore - 100);

    // Cleanup
    await prisma.worldBase.update({
      where: { userId },
      data: { trainingType: null, trainingCount: 0, trainingCompletesAt: null },
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 9. Reload trang hoặc offline → tiến trình vẫn chính xác.
  // ─────────────────────────────────────────────────────────────
  await testCase("Reload trang hoặc offline → tiến trình vẫn chính xác", async () => {
    const now = new Date();
    const count = 12;
    const initialInfantry = 100;
    await prisma.worldBase.update({
      where: { userId },
      data: {
        infantry: initialInfantry,
        trainingType: null,
        trainingCount: 0,
        trainingCompletesAt: null,
      },
    });

    // Start training
    await performWorldAction(userId, { type: "train", troopType: "INFANTRY", count });

    // Step 9a: Reloading while training in progress retains remaining countdown
    const reloadWhileInProgress = await loadWorldSnapshot(userId, now);
    assert.strictEqual(reloadWhileInProgress.base.army.trainingType, "INFANTRY");
    assert.strictEqual(reloadWhileInProgress.base.army.trainingCount, count);
    assert(reloadWhileInProgress.base.army.trainingCompletesAt !== null);

    // Step 9b: Player goes offline and logs in after completion time
    const offlineNow = new Date(now.getTime() + 180_000); // 3 minutes later
    const reloadAfterOffline = await loadWorldSnapshot(userId, offlineNow);

    // Training completed while offline, queue cleared, troops added to base!
    assert.strictEqual(reloadAfterOffline.base.army.trainingType, null);
    assert.strictEqual(reloadAfterOffline.base.army.trainingCount, 0);
    assert.strictEqual(reloadAfterOffline.base.army.trainingCompletesAt, null);
    assert.strictEqual(reloadAfterOffline.base.army.infantry, initialInfantry + count);
  });

  console.log(`\n======================================================`);
  console.log(`TẤT CẢ 9/9 KIỂM THỬ BẮT BUỘC ĐÃ VƯỢT QUA THÀNH CÔNG! ✓`);
  console.log(`======================================================\n`);
}

runAllTests()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
