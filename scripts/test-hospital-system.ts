import assert from "node:assert";
import { prisma } from "../src/lib/prisma.js";
import {
  performWorldAction,
  loadWorldSnapshot,
  advanceWorld,
  performWorldBuildingAction,
} from "../src/lib/world.js";
import {
  worldHospitalCapacity,
  worldHospitalLevel,
} from "../src/lib/world-buildings.js";

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
  if (existing) {
    await prisma.user.delete({ where: { id: existing.id } });
  }
}

async function createTestUser(username: string) {
  await cleanupUser(username);
  const user = await prisma.user.create({
    data: {
      username,
      displayName: `Tester ${username}`,
      passwordHash: "hash",
    },
  });
  return user;
}

async function run() {
  console.log("\n=== TESTING HOSPITAL, CASUALTY & HEALING SYSTEM ===\n");

  const user = await createTestUser("test_hospital_hero");
  let currentTime = new Date();

  // Test 1: Base initialization has 0 wounded and null healing
  await testCase("Initial base has 0 wounded and null healing", async () => {
    const snapshot = await loadWorldSnapshot(user.id, currentTime);
    assert.strictEqual(snapshot.base.hospital.level, 0);
    assert.strictEqual(snapshot.base.hospital.capacity, 0);
    assert.strictEqual(snapshot.base.hospital.woundedInfantry, 0);
    assert.strictEqual(snapshot.base.hospital.woundedArchers, 0);
    assert.strictEqual(snapshot.base.hospital.woundedCavalry, 0);
    assert.strictEqual(snapshot.base.hospital.totalWounded, 0);
    assert.strictEqual(snapshot.base.hospital.healingType, null);
  });

  // Test 2: Build Hospital on plot 1
  await testCase("Constructing Hospital increases level and capacity", async () => {
    // Give resources and set castleLevel to 2 (Hospital requires Castle level 2)
    await prisma.worldBase.update({
      where: { userId: user.id },
      data: { wood: 2000, stone: 2000, castleLevel: 2 },
    });

    // Build Hospital on plot 1
    await performWorldBuildingAction(user.id, {
      type: "BUILD",
      plotIndex: 1,
      buildingType: "HOSPITAL",
    }, currentTime);

    // Fast-forward construction completion
    currentTime = new Date(currentTime.getTime() + 120_000);
    await advanceWorld(user.id, currentTime);

    const snapshot = await loadWorldSnapshot(user.id, currentTime);
    assert.strictEqual(snapshot.base.hospital.level, 1);
    assert.strictEqual(snapshot.base.hospital.capacity, 150);
    assert.strictEqual(snapshot.base.hospital.availableSpace, 150);
  });

  // Test 3: Upgrade Hospital to level 2 increases capacity to 300
  await testCase("Upgrading Hospital to level 2 increases capacity to 300", async () => {
    await performWorldBuildingAction(user.id, {
      type: "UPGRADE",
      plotIndex: 1,
    }, currentTime);

    currentTime = new Date(currentTime.getTime() + 180_000);
    await advanceWorld(user.id, currentTime);

    const snapshot = await loadWorldSnapshot(user.id, currentTime);
    assert.strictEqual(snapshot.base.hospital.level, 2);
    assert.strictEqual(snapshot.base.hospital.capacity, 300);
  });

  // Test 4: Wounded troops injection & capacity verification
  await testCase("Hospital accurately reports wounded troops and available space", async () => {
    await prisma.worldBase.update({
      where: { userId: user.id },
      data: {
        woundedInfantry: 50,
        woundedArchers: 30,
        woundedCavalry: 20,
      },
    });

    const snapshot = await loadWorldSnapshot(user.id, currentTime);
    assert.strictEqual(snapshot.base.hospital.totalWounded, 100);
    assert.strictEqual(snapshot.base.hospital.availableSpace, 200); // 300 - 100
  });

  // Test 5: Healing troops deducts resources, decrements wounded, and starts server countdown
  await testCase("Starting healing deducts wounded, takes 30% resources, and sets timer", async () => {
    // 20 infantry: costWood = 3 * 20 = 60, costStone = 2 * 20 = 40, seconds = 2 * 20 = 40s
    await prisma.worldBase.update({
      where: { userId: user.id },
      data: { wood: 500, stone: 500 },
    });

    await performWorldAction(user.id, {
      type: "heal",
      troopType: "INFANTRY",
      count: 20,
    }, currentTime);

    const base = await prisma.worldBase.findUniqueOrThrow({ where: { userId: user.id } });
    assert.strictEqual(base.woundedInfantry, 30); // 50 - 20
    assert.strictEqual(base.healingType, "INFANTRY");
    assert.strictEqual(base.healingCount, 20);
    assert(base.healingCompletesAt !== null);
    assert.strictEqual(base.wood, 500 - 60);
    assert.strictEqual(base.stone, 500 - 40);
  });

  // Test 6: Cannot start a second concurrent healing while one is active
  await testCase("Cannot start concurrent healing while another is in progress", async () => {
    await assert.rejects(
      async () => {
        await performWorldAction(user.id, {
          type: "heal",
          troopType: "ARCHERS",
          count: 10,
        }, currentTime);
      },
      (err: any) => err.message.includes("đang điều trị"),
    );
  });

  // Test 7: Offline progression completes healing and returns healed troops to army
  await testCase("Offline completion restores healed troops to army ready pool", async () => {
    const futureTime = new Date(currentTime.getTime() + 600_000); // 10 mins in future, healing duration was 40s
    const prevBase = await prisma.worldBase.findUniqueOrThrow({ where: { userId: user.id } });
    const prevInfantry = prevBase.infantry;

    await advanceWorld(user.id, futureTime);

    const snapshot = await loadWorldSnapshot(user.id, futureTime);
    assert.strictEqual(snapshot.base.army.infantry, prevInfantry + 20);
    assert.strictEqual(snapshot.base.hospital.healingType, null);
    assert.strictEqual(snapshot.base.hospital.healingCount, 0);
    assert.strictEqual(snapshot.base.hospital.healingCompletesAt, null);
  });

  // Test 8: Combat map return casualties conversion to wounded
  await testCase("Returning march with casualties converts 60% to wounded within capacity", async () => {
    // Reset wounded to 0
    await prisma.worldBase.update({
      where: { userId: user.id },
      data: {
        woundedInfantry: 0,
        woundedArchers: 0,
        woundedCavalry: 0,
      },
    });

    const returnTime = new Date(currentTime.getTime() + 700_000);
    // Create a returning march with 50 infantry casualties, 20 archer casualties
    const march = await prisma.worldMapMarch.create({
      data: {
        userId: user.id,
        targetId: "node-test-1",
        targetKind: "RESOURCE",
        actionType: "OCCUPY",
        infantry: 10,
        archers: 10,
        cavalry: 0,
        casualtiesInfantry: 50,
        casualtiesArchers: 20,
        casualtiesCavalry: 0,
        dispatchedAt: currentTime,
        arrivesAt: returnTime,
        returnsAt: returnTime,
        status: "RETURNING",
      },
    });

    // Advance world to return time
    await advanceWorld(user.id, returnTime);
    // Call processScheduledWorldJobs which runs processWorldMapReturns
    const { processScheduledWorldJobs } = await import("../src/lib/world.js");
    await processScheduledWorldJobs(returnTime);

    const snapshot = await loadWorldSnapshot(user.id, returnTime);
    // 50 infantry casualties * 0.6 = 30 wounded infantry
    // 20 archers casualties * 0.6 = 12 wounded archers
    assert.strictEqual(snapshot.base.hospital.woundedInfantry, 30);
    assert.strictEqual(snapshot.base.hospital.woundedArchers, 12);
    assert.strictEqual(snapshot.base.hospital.totalWounded, 42);
  });

  // Test 9: User without Hospital receives 0 wounded (100% killed)
  await testCase("User without hospital has all casualties treated as killed (0 wounded admitted)", async () => {
    const noHospitalUser = await createTestUser("test_no_hospital_user");
    const returnTime = new Date(currentTime.getTime() + 800_000);

    await prisma.worldMapMarch.create({
      data: {
        userId: noHospitalUser.id,
        targetId: "node-test-2",
        targetKind: "RESOURCE",
        actionType: "OCCUPY",
        infantry: 5,
        archers: 5,
        cavalry: 0,
        casualtiesInfantry: 40,
        casualtiesArchers: 20,
        casualtiesCavalry: 0,
        dispatchedAt: currentTime,
        arrivesAt: returnTime,
        returnsAt: returnTime,
        status: "RETURNING",
      },
    });

    const { processScheduledWorldJobs } = await import("../src/lib/world.js");
    await processScheduledWorldJobs(returnTime);

    const snapshot = await loadWorldSnapshot(noHospitalUser.id, returnTime);
    assert.strictEqual(snapshot.base.hospital.totalWounded, 0);
    assert.strictEqual(snapshot.base.hospital.capacity, 0);

    await cleanupUser("test_no_hospital_user");
  });

  // Test 10: Field Medicine Research increases Hospital capacity (+50 per level)
  await testCase("Field Medicine research expands hospital capacity (+50 per level)", async () => {
    // Current user has Hospital level 2 (base capacity 300)
    // Add FIELD_MEDICINE level 2 research
    const userBase = await prisma.worldBase.findUniqueOrThrow({ where: { userId: user.id } });
    await prisma.worldResearch.upsert({
      where: {
        baseId_researchKey: {
          baseId: userBase.id,
          researchKey: "FIELD_MEDICINE",
        },
      },
      create: {
        baseId: userBase.id,
        researchKey: "FIELD_MEDICINE",
        level: 2,
      },
      update: { level: 2 },
    });

    const snapshot = await loadWorldSnapshot(user.id, currentTime);
    assert.strictEqual(snapshot.base.hospital.level, 2);
    // Capacity should now be 300 + 2 * 50 = 400
    assert.strictEqual(snapshot.base.hospital.capacity, 400);
  });

  // Test 11: Field Medicine Research accelerates healing time
  await testCase("Field Medicine research accelerates healing duration", async () => {
    // Cavalry base trainingSeconds = 10.
    // Base healing = round(10 * 0.4) = 4s per unit.
    // With FIELD_MEDICINE level 2 (speedMultiplier = 1 - 0.2 = 0.8):
    // secondsPerUnit = round(10 * 0.4 * 0.8) = round(3.2) = 3s per unit.
    // For 10 cavalry, total seconds = 30s instead of 40s.
    await prisma.worldBase.update({
      where: { userId: user.id },
      data: {
        wood: 1000,
        stone: 1000,
        woundedCavalry: 10,
        healingType: null,
        healingCount: 0,
        healingCompletesAt: null,
      },
    });

    await performWorldAction(user.id, {
      type: "heal",
      troopType: "CAVALRY",
      count: 10,
    }, currentTime);

    const base = await prisma.worldBase.findUniqueOrThrow({ where: { userId: user.id } });
    assert.strictEqual(base.healingType, "CAVALRY");
    assert.strictEqual(base.healingCount, 10);
    assert(base.healingCompletesAt !== null);

    const durationSeconds = Math.round((base.healingCompletesAt.getTime() - currentTime.getTime()) / 1000);
    assert.strictEqual(durationSeconds, 30); // 3s * 10 = 30s (accelerated from 40s)
  });

  // Cleanup
  await cleanupUser("test_hospital_hero");

  console.log(`\nAll ${passed} tests passed successfully!\n`);
}

run().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
