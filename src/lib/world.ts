import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const WORLD_OFFLINE_CAP_MS = 48 * 60 * 60 * 1000;
const RESOURCE_CAP_PER_WAREHOUSE_LEVEL = 2_000;
const MAX_BUILDING_LEVEL = 20;
const JOB_LOCK_TIMEOUT_MS = 15 * 60 * 1000;
const MAX_JOB_ATTEMPTS = 5;
const CONTRIBUTION_COOLDOWN_MS = 5_000;
const CONTRIBUTION_WOOD_COST = 10;

type WorldBaseState = {
  id: string;
  userId: string;
  wood: number;
  woodRemainder: number;
  stone: number;
  stoneRemainder: number;
  factoryLevel: number;
  warehouseLevel: number;
  upgradeType: string | null;
  upgradeCompletesAt: Date | null;
  lastSimulatedAt: Date;
  version: number;
};

type WorldProgress = {
  wood: number;
  woodRemainder: number;
  stone: number;
  stoneRemainder: number;
  factoryLevel: number;
  warehouseLevel: number;
  upgradeType: string | null;
  upgradeCompletesAt: Date | null;
  lastSimulatedAt: Date;
  elapsedSeconds: number;
  producedWood: number;
  producedStone: number;
  cappedOfflineTime: boolean;
};

export type WorldSnapshot = {
  now: string;
  base: {
    wood: number;
    stone: number;
    factoryLevel: number;
    warehouseLevel: number;
    upgradeType: string | null;
    upgradeCompletesAt: string | null;
    lastSimulatedAt: string;
    capacity: number;
    woodPerHour: number;
    stonePerHour: number;
  };
  offline: {
    elapsedSeconds: number;
    producedWood: number;
    producedStone: number;
    cappedOfflineTime: boolean;
  };
  events: Array<{
    id: string;
    title: string;
    description: string;
    startsAt: string;
    endsAt: string;
    status: "SCHEDULED" | "ACTIVE" | "COMPLETED" | "PROCESSING";
    participantCount: number;
    participantLimit: number;
    joined: boolean;
    score: number;
    rank: number | null;
    leaderboard: Array<{ name: string; score: number }>;
  }>;
  pendingRewards: Array<{
    eventId: string;
    title: string;
    wood: number;
    stone: number;
  }>;
};

export class WorldActionError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "WorldActionError";
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function productionFor(factoryLevel: number, resource: "wood" | "stone") {
  return factoryLevel * (resource === "wood" ? 20 : 10);
}

export function calculateWorldProgress(base: WorldBaseState, now: Date): WorldProgress {
  const rawElapsedMs = Math.max(0, now.getTime() - base.lastSimulatedAt.getTime());
  const elapsedMs = Math.min(rawElapsedMs, WORLD_OFFLINE_CAP_MS);
  const accrualStart = new Date(now.getTime() - elapsedMs);
  const upgradeFinished =
    base.upgradeType !== null &&
    base.upgradeCompletesAt !== null &&
    base.upgradeCompletesAt <= now;
  const nextFactoryLevel =
    upgradeFinished && base.upgradeType === "FACTORY" ? base.factoryLevel + 1 : base.factoryLevel;
  const nextWarehouseLevel =
    upgradeFinished && base.upgradeType === "WAREHOUSE"
      ? base.warehouseLevel + 1
      : base.warehouseLevel;
  const upgradeAt = base.upgradeCompletesAt?.getTime();

  function earned(resource: "wood" | "stone") {
    if (!elapsedMs) return 0;
    if (upgradeAt === undefined || !upgradeFinished || base.upgradeType !== "FACTORY") {
      return (elapsedMs / 3_600_000) * productionFor(base.factoryLevel, resource);
    }

    const boundary = clamp(upgradeAt, accrualStart.getTime(), now.getTime());
    const beforeMs = boundary - accrualStart.getTime();
    const afterMs = now.getTime() - boundary;
    return (
      (beforeMs / 3_600_000) * productionFor(base.factoryLevel, resource) +
      (afterMs / 3_600_000) * productionFor(nextFactoryLevel, resource)
    );
  }

  let wood = base.wood;
  let stone = base.stone;
  let woodRemainder = base.woodRemainder;
  let stoneRemainder = base.stoneRemainder;
  const warehouseUpgradeInInterval =
    upgradeFinished &&
    base.upgradeType === "WAREHOUSE" &&
    upgradeAt !== undefined &&
    upgradeAt > accrualStart.getTime();

  if (warehouseUpgradeInInterval && upgradeAt !== undefined) {
    const beforeHours = (upgradeAt - accrualStart.getTime()) / 3_600_000;
    const afterHours = (now.getTime() - upgradeAt) / 3_600_000;
    wood = Math.min(
      base.warehouseLevel * RESOURCE_CAP_PER_WAREHOUSE_LEVEL,
      wood + woodRemainder + beforeHours * productionFor(base.factoryLevel, "wood"),
    );
    stone = Math.min(
      base.warehouseLevel * RESOURCE_CAP_PER_WAREHOUSE_LEVEL,
      stone + stoneRemainder + beforeHours * productionFor(base.factoryLevel, "stone"),
    );
    wood = Math.min(
      nextWarehouseLevel * RESOURCE_CAP_PER_WAREHOUSE_LEVEL,
      wood + afterHours * productionFor(base.factoryLevel, "wood"),
    );
    stone = Math.min(
      nextWarehouseLevel * RESOURCE_CAP_PER_WAREHOUSE_LEVEL,
      stone + afterHours * productionFor(base.factoryLevel, "stone"),
    );
  } else {
    const capacity = nextWarehouseLevel * RESOURCE_CAP_PER_WAREHOUSE_LEVEL;
    wood = Math.min(capacity, wood + woodRemainder + earned("wood"));
    stone = Math.min(capacity, stone + stoneRemainder + earned("stone"));
  }

  const capacity = nextWarehouseLevel * RESOURCE_CAP_PER_WAREHOUSE_LEVEL;
  const finalWood = Math.floor(Math.min(capacity, wood));
  const finalStone = Math.floor(Math.min(capacity, stone));
  woodRemainder = finalWood >= capacity ? 0 : Math.min(0.999_999_999, wood - finalWood);
  stoneRemainder = finalStone >= capacity ? 0 : Math.min(0.999_999_999, stone - finalStone);

  return {
    wood: finalWood,
    woodRemainder,
    stone: finalStone,
    stoneRemainder,
    factoryLevel: nextFactoryLevel,
    warehouseLevel: nextWarehouseLevel,
    upgradeType: upgradeFinished ? null : base.upgradeType,
    upgradeCompletesAt: upgradeFinished ? null : base.upgradeCompletesAt,
    lastSimulatedAt: now,
    elapsedSeconds: Math.floor(elapsedMs / 1000),
    producedWood: finalWood - base.wood,
    producedStone: finalStone - base.stone,
    cappedOfflineTime: rawElapsedMs > WORLD_OFFLINE_CAP_MS,
  };
}

async function ensureBase(userId: string, now: Date) {
  return prisma.worldBase.upsert({
    where: { userId },
    create: { userId, lastSimulatedAt: now },
    update: {},
  });
}

async function advanceWorld(userId: string, now: Date) {
  await ensureBase(userId, now);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const base = await prisma.worldBase.findUniqueOrThrow({ where: { userId } });
    const progress = calculateWorldProgress(base, now);
    const updated = await prisma.worldBase.updateMany({
      where: { id: base.id, version: base.version },
      data: {
        wood: progress.wood,
        woodRemainder: progress.woodRemainder,
        stone: progress.stone,
        stoneRemainder: progress.stoneRemainder,
        factoryLevel: progress.factoryLevel,
        warehouseLevel: progress.warehouseLevel,
        upgradeType: progress.upgradeType,
        upgradeCompletesAt: progress.upgradeCompletesAt,
        lastSimulatedAt: now,
        version: { increment: 1 },
      },
    });
    if (updated.count === 1) return { ...progress, version: base.version + 1 };
  }

  throw new Error(`Could not advance world state for user ${userId} after concurrent updates.`);
}

function utcDayStart(now: Date, offsetDays: number) {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() + offsetDays);
  return start;
}

async function ensureDailyWorldEvents(now: Date) {
  await prisma.$transaction(async (tx) => {
    for (const offset of [-1, 0, 1]) {
      const startsAt = utcDayStart(now, offset);
      const endsAt = new Date(startsAt.getTime() + 24 * 60 * 60 * 1000);
      const day = startsAt.toISOString().slice(0, 10);
      const slug = `resource-rush-${day}`;
      const event = await tx.worldEvent.upsert({
        where: { slug },
        create: {
          slug,
          title: "Ngày hội thu thập tài nguyên",
          description: "Góp 10 gỗ mỗi lượt để tăng điểm. Ba vị trí đầu nhận thưởng tài nguyên.",
          startsAt,
          endsAt,
        },
        update: {},
        select: { id: true, endsAt: true },
      });
      await tx.worldJob.upsert({
        where: { uniqueKey: `settle:${slug}` },
        create: {
          uniqueKey: `settle:${slug}`,
          eventId: event.id,
          runAt: event.endsAt,
        },
        update: {},
      });
    }
  });
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 1_000) : "Unknown world job error";
}

export async function processScheduledWorldJobs(now = new Date()) {
  await ensureDailyWorldEvents(now);
  const staleBefore = new Date(now.getTime() - JOB_LOCK_TIMEOUT_MS);
  const dueJobs = await prisma.worldJob.findMany({
    where: {
      runAt: { lte: now },
      OR: [
        { status: "PENDING" },
        { status: "RUNNING", lockedAt: { lt: staleBefore } },
      ],
    },
    orderBy: { runAt: "asc" },
    take: 20,
    select: { id: true, eventId: true, attempts: true },
  });

  let processed = 0;
  let retried = 0;
  let failed = 0;

  for (const candidate of dueJobs) {
    const claim = await prisma.worldJob.updateMany({
      where: {
        id: candidate.id,
        runAt: { lte: now },
        OR: [
          { status: "PENDING" },
          { status: "RUNNING", lockedAt: { lt: staleBefore } },
        ],
      },
      data: {
        status: "RUNNING",
        lockedAt: now,
        attempts: { increment: 1 },
        lastError: null,
      },
    });
    if (claim.count !== 1) continue;

    try {
      await prisma.$transaction(async (tx) => {
        const [job, event] = await Promise.all([
          tx.worldJob.findUniqueOrThrow({ where: { id: candidate.id } }),
          tx.worldEvent.findUniqueOrThrow({ where: { id: candidate.eventId } }),
        ]);
        if (job.status === "COMPLETED" || event.status === "COMPLETED") {
          await tx.worldJob.update({
            where: { id: candidate.id },
            data: { status: "COMPLETED", completedAt: now, lockedAt: null },
          });
          return;
        }
        if (event.endsAt > now) throw new Error("Event settlement ran before its end time.");

        const participants = await tx.worldEventParticipation.findMany({
          where: { eventId: event.id },
          orderBy: [{ score: "desc" }, { joinedAt: "asc" }, { id: "asc" }],
          select: { id: true, score: true },
        });
        const rewards = [
          { wood: 500, stone: 250 },
          { wood: 300, stone: 150 },
          { wood: 150, stone: 75 },
        ];
        for (const [index, participant] of participants.filter((entry) => entry.score > 0).slice(0, 3).entries()) {
          await tx.worldEventParticipation.update({
            where: { id: participant.id },
            data: { rewardWood: rewards[index].wood, rewardStone: rewards[index].stone },
          });
        }
        await tx.worldEvent.update({
          where: { id: event.id },
          data: { status: "COMPLETED" },
        });
        await tx.worldJob.update({
          where: { id: candidate.id },
          data: { status: "COMPLETED", completedAt: now, lockedAt: null, lastError: null },
        });
      });
      processed += 1;
    } catch (error) {
      const attempts = candidate.attempts + 1;
      const permanentlyFailed = attempts >= MAX_JOB_ATTEMPTS;
      const nextRunAt = new Date(now.getTime() + Math.min(60 * 60_000, 30_000 * 2 ** (attempts - 1)));
      const message = errorText(error);
      await prisma.worldJob.updateMany({
        where: { id: candidate.id, status: "RUNNING" },
        data: {
          status: permanentlyFailed ? "FAILED" : "PENDING",
          runAt: permanentlyFailed ? now : nextRunAt,
          lockedAt: null,
          lastError: message,
        },
      });
      console.error("World event job failed.", {
        jobId: candidate.id,
        eventId: candidate.eventId,
        attempts,
        permanentlyFailed,
        error: message,
      });
      if (permanentlyFailed) failed += 1;
      else retried += 1;
    }
  }

  return { processed, retried, failed };
}

export async function loadWorldSnapshot(userId: string, now = new Date()): Promise<WorldSnapshot> {
  await ensureDailyWorldEvents(now);
  await processScheduledWorldJobs(now);
  const world = await advanceWorld(userId, now);
  const base = await prisma.worldBase.findUniqueOrThrow({ where: { userId } });
  const [events, pending] = await Promise.all([
    prisma.worldEvent.findMany({
      where: { endsAt: { gte: new Date(now.getTime() - 48 * 60 * 60 * 1000) } },
      orderBy: { startsAt: "desc" },
      take: 4,
      include: {
        participants: {
          orderBy: [{ score: "desc" }, { joinedAt: "asc" }, { id: "asc" }],
          select: {
            userId: true,
            score: true,
            joinedAt: true,
            user: { select: { displayName: true, username: true } },
          },
        },
      },
    }),
    prisma.worldEventParticipation.findMany({
      where: {
        userId,
        rewardClaimedAt: null,
        OR: [{ rewardWood: { gt: 0 } }, { rewardStone: { gt: 0 } }],
        event: { status: "COMPLETED" },
      },
      include: { event: { select: { id: true, title: true } } },
      orderBy: { joinedAt: "desc" },
    }),
  ]);

  return {
    now: now.toISOString(),
    base: {
      wood: base.wood,
      stone: base.stone,
      factoryLevel: base.factoryLevel,
      warehouseLevel: base.warehouseLevel,
      upgradeType: base.upgradeType,
      upgradeCompletesAt: base.upgradeCompletesAt?.toISOString() ?? null,
      lastSimulatedAt: base.lastSimulatedAt.toISOString(),
      capacity: base.warehouseLevel * RESOURCE_CAP_PER_WAREHOUSE_LEVEL,
      woodPerHour: productionFor(base.factoryLevel, "wood"),
      stonePerHour: productionFor(base.factoryLevel, "stone"),
    },
    offline: {
      elapsedSeconds: world.elapsedSeconds,
      producedWood: world.producedWood,
      producedStone: world.producedStone,
      cappedOfflineTime: world.cappedOfflineTime,
    },
    events: events.map((event) => {
      const participantIndex = event.participants.findIndex((entry) => entry.userId === userId);
      const joined = participantIndex >= 0;
      const status: WorldSnapshot["events"][number]["status"] =
        now < event.startsAt
          ? "SCHEDULED"
          : now < event.endsAt
            ? "ACTIVE"
            : event.status === "COMPLETED"
              ? "COMPLETED"
              : "PROCESSING";
      return {
        id: event.id,
        title: event.title,
        description: event.description,
        startsAt: event.startsAt.toISOString(),
        endsAt: event.endsAt.toISOString(),
        status,
        participantCount: event.participantCount,
        participantLimit: event.participantLimit,
        joined,
        score: joined ? event.participants[participantIndex].score : 0,
        rank: joined ? participantIndex + 1 : null,
        leaderboard: event.participants.map((entry) => ({
          name: entry.user.displayName || entry.user.username,
          score: entry.score,
        })),
      };
    }),
    pendingRewards: pending.map((reward) => ({
      eventId: reward.eventId,
      title: reward.event.title,
      wood: reward.rewardWood,
      stone: reward.rewardStone,
    })),
  };
}

function eventIsActive(event: { startsAt: Date; endsAt: Date }, now: Date) {
  return event.startsAt <= now && event.endsAt > now;
}

export async function performWorldAction(
  userId: string,
  action:
    | { type: "join"; eventId: string }
    | { type: "contribute"; eventId: string }
    | { type: "claim"; eventId: string }
    | { type: "upgrade"; building: "FACTORY" | "WAREHOUSE" },
  now = new Date(),
) {
  await ensureDailyWorldEvents(now);

  if (action.type === "upgrade") {
    const current = await advanceWorld(userId, now);
    const base = await prisma.worldBase.findUniqueOrThrow({ where: { userId } });
    if (base.upgradeType) throw new WorldActionError("Một công trình khác đang nâng cấp.", 409);

    const level = action.building === "FACTORY" ? base.factoryLevel : base.warehouseLevel;
    if (level >= MAX_BUILDING_LEVEL) throw new WorldActionError("Công trình đã đạt cấp tối đa.", 409);
    const nextLevel = level + 1;
    const cost =
      action.building === "FACTORY"
        ? { wood: 100 * nextLevel, stone: 50 * nextLevel }
        : { wood: 150 * nextLevel, stone: 100 * nextLevel };
    const upgradeType = action.building;
    const upgradeCompletesAt = new Date(now.getTime() + nextLevel * 60_000);
    const started = await prisma.worldBase.updateMany({
      where: {
        id: base.id,
        version: current.version,
        upgradeType: null,
        wood: { gte: cost.wood },
        stone: { gte: cost.stone },
      },
      data: {
        wood: { decrement: cost.wood },
        stone: { decrement: cost.stone },
        upgradeType,
        upgradeCompletesAt,
        version: { increment: 1 },
      },
    });
    if (!started.count) {
      if (base.wood < cost.wood || base.stone < cost.stone) {
        throw new WorldActionError(`Cần ${cost.wood} gỗ và ${cost.stone} đá để nâng cấp.`, 400);
      }
      throw new WorldActionError("Thế giới vừa được cập nhật. Hãy thử lại.", 409);
    }
    return { message: "Đã bắt đầu nâng cấp công trình." };
  }

  if (action.type === "join") {
    await prisma.$transaction(async (tx) => {
      const event = await tx.worldEvent.findUnique({ where: { id: action.eventId } });
      if (!event || !eventIsActive(event, now)) {
        throw new WorldActionError("Sự kiện hiện không mở.", 409);
      }
      const existing = await tx.worldEventParticipation.findUnique({
        where: { eventId_userId: { eventId: event.id, userId } },
        select: { id: true },
      });
      if (existing) return;

      const reserved = await tx.worldEvent.updateMany({
        where: {
          id: event.id,
          participantCount: { lt: event.participantLimit },
          startsAt: { lte: now },
          endsAt: { gt: now },
        },
        data: { participantCount: { increment: 1 } },
      });
      if (!reserved.count) throw new WorldActionError("Sự kiện đã kết thúc hoặc đủ người tham gia.", 409);
      await tx.worldEventParticipation.create({ data: { eventId: event.id, userId } });
    });
    return { message: "Bạn đã tham gia sự kiện." };
  }

  if (action.type === "contribute") {
    const current = await advanceWorld(userId, now);
    await prisma.$transaction(async (tx) => {
      const event = await tx.worldEvent.findUnique({ where: { id: action.eventId } });
      if (!event || !eventIsActive(event, now)) {
        throw new WorldActionError("Sự kiện hiện không mở.", 409);
      }
      const participation = await tx.worldEventParticipation.findUnique({
        where: { eventId_userId: { eventId: event.id, userId } },
        select: { lastContributionAt: true },
      });
      if (!participation) throw new WorldActionError("Hãy tham gia sự kiện trước.", 400);
      if (
        participation.lastContributionAt &&
        now.getTime() - participation.lastContributionAt.getTime() < CONTRIBUTION_COOLDOWN_MS
      ) {
        throw new WorldActionError("Hãy đợi vài giây trước lượt đóng góp tiếp theo.", 429);
      }
      const spent = await tx.worldBase.updateMany({
        where: {
          userId,
          version: current.version,
          wood: { gte: CONTRIBUTION_WOOD_COST },
        },
        data: {
          wood: { decrement: CONTRIBUTION_WOOD_COST },
          version: { increment: 1 },
        },
      });
      if (!spent.count) throw new WorldActionError("Không đủ 10 gỗ hoặc tài nguyên vừa thay đổi.", 400);

      const cooldownBefore = new Date(now.getTime() - CONTRIBUTION_COOLDOWN_MS);
      const scored = await tx.worldEventParticipation.updateMany({
        where: {
          eventId: event.id,
          userId,
          OR: [
            { lastContributionAt: null },
            { lastContributionAt: { lte: cooldownBefore } },
          ],
        },
        data: {
          score: { increment: 1 },
          lastContributionAt: now,
        },
      });
      if (!scored.count) throw new WorldActionError("Hãy đợi vài giây trước lượt đóng góp tiếp theo.", 429);
    });
    return { message: "Đã đóng góp 10 gỗ và nhận 1 điểm sự kiện." };
  }

  const current = await advanceWorld(userId, now);
  const result = await prisma.$transaction(async (tx) => {
    const participation = await tx.worldEventParticipation.findUnique({
      where: { eventId_userId: { eventId: action.eventId, userId } },
      include: { event: { select: { status: true, title: true } } },
    });
    if (!participation || participation.event.status !== "COMPLETED") {
      throw new WorldActionError("Chưa có phần thưởng để nhận.", 409);
    }
    if (participation.rewardClaimedAt) throw new WorldActionError("Phần thưởng đã được nhận.", 409);
    if (participation.rewardWood + participation.rewardStone === 0) {
      throw new WorldActionError("Sự kiện lần này không có phần thưởng dành cho bạn.", 409);
    }
    const base = await tx.worldBase.findUniqueOrThrow({ where: { userId } });
    const capacity = base.warehouseLevel * RESOURCE_CAP_PER_WAREHOUSE_LEVEL;
    if (
      base.wood + participation.rewardWood > capacity ||
      base.stone + participation.rewardStone > capacity
    ) {
      throw new WorldActionError("Kho cần đủ chỗ cho toàn bộ phần thưởng trước khi nhận.", 409);
    }
    const claimed = await tx.worldEventParticipation.updateMany({
      where: { id: participation.id, rewardClaimedAt: null },
      data: { rewardClaimedAt: now },
    });
    if (!claimed.count) throw new WorldActionError("Phần thưởng vừa được nhận ở nơi khác.", 409);
    const credited = await tx.worldBase.updateMany({
      where: { id: base.id, version: current.version },
      data: {
        wood: { increment: participation.rewardWood },
        stone: { increment: participation.rewardStone },
        version: { increment: 1 },
      },
    });
    if (!credited.count) throw new WorldActionError("Thế giới vừa được cập nhật. Hãy thử nhận lại.", 409);
    return {
      wood: participation.rewardWood,
      stone: participation.rewardStone,
      title: participation.event.title,
    };
  });

  return { message: `Đã nhận thưởng ${result.title}: ${result.wood} gỗ, ${result.stone} đá.` };
}

export function isWorldActionError(error: unknown): error is WorldActionError {
  return error instanceof WorldActionError;
}

export function isWorldUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
