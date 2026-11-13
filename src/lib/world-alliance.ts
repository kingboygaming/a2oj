import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  calculateWorldProgress,
  WORLD_RESOURCE_CAP_PER_WAREHOUSE_LEVEL,
} from "@/lib/world";

export const WORLD_ALLIANCE_MEMBER_LIMIT = 20;

type AllianceAction =
  | { action: "create"; name: string; tag: string; description: string }
  | { action: "join"; allianceId: string }
  | { action: "leave" }
  | { action: "kick"; targetUserId: string }
  | { action: "transfer"; targetUserId: string }
  | { action: "challenge"; defenderAllianceId: string; territoryId: string }
  | { action: "attackWar"; warId: string; infantry: number; archers: number; cavalry: number };

const ALLIANCE_WAR_DURATION_MS = 24 * 60 * 60 * 1000;
const ALLIANCE_WAR_ATTACK_COOLDOWN_MS = 60 * 1000;
const MAX_TROOPS_PER_WAR_ATTACK = 500;
const WAR_TROOP_DAMAGE = { INFANTRY: 10, ARCHERS: 15, CAVALRY: 20 } as const;
const TERRITORY_REWARD_INTERVAL_MS = 24 * 60 * 60 * 1000;
const WORLD_TERRITORIES = [
  { id: "ironwood", name: "Rừng Thiết Mộc", description: "Vùng rừng chiến lược ở phía bắc.", dailyWood: 180, dailyStone: 20 },
  { id: "granite-pass", name: "Ải Đá Xám", description: "Cửa ải hiểm yếu nối liền các vùng đất.", dailyWood: 80, dailyStone: 120 },
  { id: "emerald-valley", name: "Thung lũng Lục Bảo", description: "Thung lũng màu mỡ giữa bản đồ.", dailyWood: 120, dailyStone: 80 },
  { id: "sun-coast", name: "Bờ biển Ánh Dương", description: "Dải bờ biển có vị trí giao thương quan trọng.", dailyWood: 100, dailyStone: 100 },
  { id: "frost-peak", name: "Đỉnh Băng Giá", description: "Cao địa khó tiếp cận nhưng giàu giá trị chiến lược.", dailyWood: 60, dailyStone: 140 },
] as const;

export class WorldAllianceActionError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "WorldAllianceActionError";
  }
}

export function isWorldAllianceActionError(error: unknown): error is WorldAllianceActionError {
  return error instanceof WorldAllianceActionError;
}

export function isWorldAllianceUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function ensureWorldTerritories() {
  for (const territory of WORLD_TERRITORIES) {
    await prisma.worldTerritory.upsert({
      where: { id: territory.id },
      create: territory,
      update: {},
    });
  }
}

async function awardTerritoryResources(
  transaction: Prisma.TransactionClient,
  userId: string,
  woodReward: number,
  stoneReward: number,
  now: Date,
) {
  let base = await transaction.worldBase.findUnique({ where: { userId } });
  if (!base) {
    base = await transaction.worldBase.upsert({
      where: { userId },
      create: { userId, lastSimulatedAt: now },
      update: {},
    });
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const buildings = await transaction.worldBuilding.findMany({
      where: { baseId: base.id },
      select: {
        buildingType: true,
        level: true,
        pendingLevel: true,
        completedAt: true,
        completesAt: true,
      },
    });
    const productionResearch = await transaction.worldResearch.findUnique({
      where: { baseId_researchKey: { baseId: base.id, researchKey: "PRODUCTION_EFFICIENCY" } },
      select: { level: true },
    });
    const pendingProductionResearch = base.activeResearchKey === "PRODUCTION_EFFICIENCY" &&
      base.activeResearchLevel !== null &&
      base.researchCompletesAt
      ? { level: base.activeResearchLevel, completesAt: base.researchCompletesAt }
      : null;
    const progress = calculateWorldProgress(
      base,
      now,
      buildings,
      productionResearch?.level ?? 0,
      pendingProductionResearch,
    );
    const capacity = progress.warehouseLevel * WORLD_RESOURCE_CAP_PER_WAREHOUSE_LEVEL;
    const wood = Math.min(capacity, progress.wood + woodReward);
    const stone = Math.min(capacity, progress.stone + stoneReward);
    const food = Math.min(capacity, progress.food);
    const updated = await transaction.worldBase.updateMany({
      where: { id: base.id, version: base.version },
      data: {
        wood,
        woodRemainder: wood >= capacity ? 0 : progress.woodRemainder,
        stone,
        stoneRemainder: stone >= capacity ? 0 : progress.stoneRemainder,
        food,
        foodRemainder: food >= capacity ? 0 : progress.foodRemainder,
        factoryLevel: progress.factoryLevel,
        warehouseLevel: progress.warehouseLevel,
        upgradeType: progress.upgradeType,
        upgradeCompletesAt: progress.upgradeCompletesAt,
        lastSimulatedAt: now,
        version: { increment: 1 },
      },
    });
    if (updated.count) return;
    base = await transaction.worldBase.findUniqueOrThrow({ where: { userId } });
  }
  throw new Error(`Could not award territory resources to user ${userId} after concurrent updates.`);
}

async function processWorldTerritoryRewards(now: Date) {
  const dueTerritories = await prisma.worldTerritory.findMany({
    where: { controllerAllianceId: { not: null }, nextRewardAt: { lte: now } },
    orderBy: { nextRewardAt: "asc" },
    take: 100,
    select: {
      id: true,
      controllerAllianceId: true,
      nextRewardAt: true,
      dailyWood: true,
      dailyStone: true,
    },
  });
  let rewarded = 0;
  for (const territory of dueTerritories) {
    if (!territory.controllerAllianceId || !territory.nextRewardAt) continue;
    const rewardPeriods =
      Math.floor((now.getTime() - territory.nextRewardAt.getTime()) / TERRITORY_REWARD_INTERVAL_MS) + 1;
    const nextRewardAt = new Date(
      territory.nextRewardAt.getTime() + rewardPeriods * TERRITORY_REWARD_INTERVAL_MS,
    );
    const paid = await prisma.$transaction(async (tx) => {
      const claimed = await tx.worldTerritory.updateMany({
        where: {
          id: territory.id,
          controllerAllianceId: territory.controllerAllianceId,
          nextRewardAt: territory.nextRewardAt,
        },
        data: {
          nextRewardAt,
        },
      });
      if (!claimed.count) return false;

      const members = await tx.worldAllianceMember.findMany({
        where: { allianceId: territory.controllerAllianceId! },
        select: { userId: true },
      });
      for (const member of members) {
        await awardTerritoryResources(
          tx,
          member.userId,
          territory.dailyWood * rewardPeriods,
          territory.dailyStone * rewardPeriods,
          now,
        );
      }
      return true;
    });
    if (paid) rewarded += 1;
  }
  return rewarded;
}

export async function settleWorldAllianceWars(now = new Date()) {
  const dueWars = await prisma.worldAllianceWar.findMany({
    where: { status: "ACTIVE", endsAt: { lte: now } },
    orderBy: { endsAt: "asc" },
    take: 100,
    select: { id: true },
  });
  let settled = 0;
  for (const { id } of dueWars) {
    const didSettle = await prisma.$transaction(async (tx) => {
      const claimed = await tx.worldAllianceWar.updateMany({
        where: { id, status: "ACTIVE", endsAt: { lte: now } },
        data: { status: "SETTLING" },
      });
      if (!claimed.count) return false;
      const war = await tx.worldAllianceWar.findUniqueOrThrow({ where: { id } });
      const winnerAllianceId =
        war.challengerScore === war.defenderScore
          ? null
          : war.challengerScore > war.defenderScore
            ? war.challengerAllianceId
            : war.defenderAllianceId;
      if (winnerAllianceId && war.territoryId) {
        const territory = await tx.worldTerritory.findUniqueOrThrow({
          where: { id: war.territoryId },
          select: { controllerAllianceId: true },
        });
        if (territory.controllerAllianceId !== winnerAllianceId) {
          await tx.worldTerritory.update({
            where: { id: war.territoryId },
            data: {
              controllerAllianceId: winnerAllianceId,
              capturedAt: now,
              nextRewardAt: new Date(now.getTime() + TERRITORY_REWARD_INTERVAL_MS),
            },
          });
        }
      }
      const completed = await tx.worldAllianceWar.updateMany({
        where: { id, status: "SETTLING" },
        data: { status: "COMPLETED", completedAt: now, winnerAllianceId },
      });
      if (!completed.count) return false;
      await tx.worldAllianceWarLock.deleteMany({ where: { warId: id } });
      await tx.worldTerritoryWarLock.deleteMany({ where: { warId: id } });
      return true;
    });
    if (didSettle) settled += 1;
  }
  const territoryRewards = await processWorldTerritoryRewards(now);
  return { settled, territoryRewards };
}

async function assertAllianceWarUnlocked(
  transaction: Prisma.TransactionClient,
  allianceId: string,
) {
  const lock = await transaction.worldAllianceWarLock.findUnique({
    where: { allianceId },
    select: { warId: true },
  });
  if (lock) {
    throw new WorldAllianceActionError("Không thể thay đổi thành viên khi liên minh đang tham gia chiến tranh.", 409);
  }
}

async function serializeAllianceMembershipChanges(
  transaction: Prisma.TransactionClient,
  allianceId: string,
) {
  const touched = await transaction.worldAlliance.updateMany({
    where: { id: allianceId },
    data: { memberCount: { increment: 0 } },
  });
  if (!touched.count) throw new WorldAllianceActionError("Không tìm thấy liên minh.", 404);
}

export async function prepareWorldAllianceForUserDeletion(
  transaction: Prisma.TransactionClient,
  userId: string,
) {
  const membership = await transaction.worldAllianceMember.findUnique({
    where: { userId },
    include: {
      alliance: { select: { id: true, leaderUserId: true } },
    },
  });
  if (!membership) return;

  if (membership.alliance.leaderUserId === userId) {
    const successor = await transaction.worldAllianceMember.findFirst({
      where: { allianceId: membership.allianceId, userId: { not: userId } },
      orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
      select: { id: true, userId: true },
    });
    if (!successor) {
      await transaction.worldAlliance.delete({ where: { id: membership.allianceId } });
      return;
    }

    await transaction.worldAlliance.update({
      where: { id: membership.allianceId },
      data: { leaderUserId: successor.userId, memberCount: { decrement: 1 } },
    });
    await transaction.worldAllianceMember.update({
      where: { id: successor.id },
      data: { role: "LEADER" },
    });
  } else {
    await transaction.worldAlliance.update({
      where: { id: membership.allianceId },
      data: { memberCount: { decrement: 1 } },
    });
  }
  await transaction.worldAllianceMember.delete({ where: { id: membership.id } });
}

export async function loadWorldAllianceSnapshot(userId: string) {
  await ensureWorldTerritories();
  await settleWorldAllianceWars();
  const membership = await prisma.worldAllianceMember.findUnique({
    where: { userId },
    include: {
      alliance: {
        include: {
          members: {
            orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
            select: {
              userId: true,
              role: true,
              joinedAt: true,
              user: { select: { displayName: true, username: true } },
            },
          },
        },
      },
    },
  });
  const alliances = await prisma.worldAlliance.findMany({
    where: {
      ...(membership ? { id: { not: membership.allianceId } } : {}),
    },
    orderBy: [{ memberCount: "desc" }, { createdAt: "asc" }],
    take: 20,
    select: {
      id: true,
      name: true,
      tag: true,
      description: true,
      memberCount: true,
      leaderUserId: true,
      leader: { select: { displayName: true, username: true } },
    },
  });
  const [wars, territories, base, activeWarLock] = await Promise.all([
    membership
      ? prisma.worldAllianceWar.findMany({
          where: {
            OR: [
              { challengerAllianceId: membership.allianceId },
              { defenderAllianceId: membership.allianceId },
            ],
          },
          orderBy: { createdAt: "desc" },
          take: 10,
          include: {
            challenger: { select: { id: true, name: true, tag: true } },
            defender: { select: { id: true, name: true, tag: true } },
            territory: { select: { id: true, name: true } },
            scores: {
              orderBy: [{ score: "desc" }, { id: "asc" }],
              take: 20,
              select: {
                allianceId: true,
                score: true,
                user: { select: { displayName: true, username: true } },
              },
            },
          },
        })
      : Promise.resolve([]),
    prisma.worldTerritory.findMany({
      orderBy: { name: "asc" },
      include: {
        controller: { select: { id: true, name: true, tag: true } },
        warLock: { select: { warId: true, war: { select: { endsAt: true } } } },
      },
    }),
    prisma.worldBase.findUnique({
      where: { userId },
      select: {
        infantry: true,
        archers: true,
        cavalry: true,
        trainingType: true,
        marchActive: true,
      },
    }),
    membership
      ? prisma.worldAllianceWarLock.findUnique({
          where: { allianceId: membership.allianceId },
          select: { warId: true },
        })
      : Promise.resolve(null),
  ]);

  return {
    alliance: membership
      ? {
          id: membership.alliance.id,
          name: membership.alliance.name,
          tag: membership.alliance.tag,
          description: membership.alliance.description,
          memberCount: membership.alliance.memberCount,
          leaderUserId: membership.alliance.leaderUserId,
          role: membership.role,
          members: membership.alliance.members.map((member) => ({
            userId: member.userId,
            name: member.user.displayName || member.user.username,
            username: member.user.username,
            role: member.role,
            joinedAt: member.joinedAt.toISOString(),
          })),
        }
      : null,
    directory: alliances.map((alliance) => ({
      id: alliance.id,
      name: alliance.name,
      tag: alliance.tag,
      description: alliance.description,
      memberCount: alliance.memberCount,
      leaderUserId: alliance.leaderUserId,
      leaderName: alliance.leader.displayName || alliance.leader.username,
    })),
    memberLimit: WORLD_ALLIANCE_MEMBER_LIMIT,
    hasActiveWar: activeWarLock !== null,
    territories: territories.map((territory) => ({
      id: territory.id,
      name: territory.name,
      description: territory.description,
      controllerAllianceId: territory.controllerAllianceId,
      controller: territory.controller,
      dailyWood: territory.dailyWood,
      dailyStone: territory.dailyStone,
      capturedAt: territory.capturedAt?.toISOString() ?? null,
      nextRewardAt: territory.nextRewardAt?.toISOString() ?? null,
      activeWarId: territory.warLock?.warId ?? null,
      activeWarEndsAt: territory.warLock?.war.endsAt?.toISOString() ?? null,
    })),
    wars: wars.map((war) => ({
      id: war.id,
      status: war.status,
      challengerAllianceId: war.challengerAllianceId,
      defenderAllianceId: war.defenderAllianceId,
      challenger: war.challenger,
      defender: war.defender,
      territory: war.territory,
      challengerScore: war.challengerScore,
      defenderScore: war.defenderScore,
      createdAt: war.createdAt.toISOString(),
      startedAt: war.startedAt.toISOString(),
      endsAt: war.endsAt?.toISOString() ?? null,
      completedAt: war.completedAt?.toISOString() ?? null,
      winnerAllianceId: war.winnerAllianceId,
      leaderboard: war.scores.map((entry) => ({
        allianceId: entry.allianceId,
        name: entry.user.displayName || entry.user.username,
        score: entry.score,
      })),
    })),
    army: base
      ? {
          infantry: base.infantry,
          archers: base.archers,
          cavalry: base.cavalry,
          training: base.trainingType !== null,
          marching: base.marchActive,
        }
      : null,
  };
}

export async function performWorldAllianceAction(
  userId: string,
  action: AllianceAction,
  now = new Date(),
) {
  await settleWorldAllianceWars(now);

  if (action.action === "challenge") {
    await ensureWorldTerritories();
    await prisma.$transaction(async (tx) => {
      const challenger = await tx.worldAlliance.findFirst({
        where: { leaderUserId: userId },
        select: { id: true },
      });
      if (!challenger) throw new WorldAllianceActionError("Chỉ thủ lĩnh mới có thể tuyên chiến.", 403);
      if (challenger.id === action.defenderAllianceId) {
        throw new WorldAllianceActionError("Không thể tuyên chiến với chính liên minh của mình.", 400);
      }
      const defender = await tx.worldAlliance.findUnique({
        where: { id: action.defenderAllianceId },
        select: { id: true, memberCount: true },
      });
      if (!defender || defender.memberCount < 1) {
        throw new WorldAllianceActionError("Không tìm thấy liên minh đối thủ.", 404);
      }
      const territory = await tx.worldTerritory.findUnique({
        where: { id: action.territoryId },
        select: { id: true, name: true, controllerAllianceId: true },
      });
      if (!territory) throw new WorldAllianceActionError("Không tìm thấy lãnh thổ.", 404);
      if (territory.controllerAllianceId === challenger.id) {
        throw new WorldAllianceActionError("Không thể khiêu chiến lãnh thổ do liên minh của bạn kiểm soát.", 409);
      }
      if (territory.controllerAllianceId && territory.controllerAllianceId !== defender.id) {
        throw new WorldAllianceActionError("Chỉ có thể khiêu chiến liên minh đang kiểm soát lãnh thổ này.", 409);
      }
      const territoryLock = await tx.worldTerritoryWarLock.findUnique({
        where: { territoryId: territory.id },
        select: { warId: true },
      });
      if (territoryLock) throw new WorldAllianceActionError("Lãnh thổ này đang có chiến tranh.", 409);
      for (const allianceId of [challenger.id, defender.id].sort()) {
        await serializeAllianceMembershipChanges(tx, allianceId);
        await assertAllianceWarUnlocked(tx, allianceId);
      }

      const war = await tx.worldAllianceWar.create({
        data: {
          challengerAllianceId: challenger.id,
          defenderAllianceId: defender.id,
          territoryId: territory.id,
          status: "ACTIVE",
          startedAt: now,
          endsAt: new Date(now.getTime() + ALLIANCE_WAR_DURATION_MS),
        },
        select: { id: true },
      });
      await tx.worldAllianceWarLock.createMany({
        data: [
          { allianceId: challenger.id, warId: war.id },
          { allianceId: defender.id, warId: war.id },
        ],
      });
      await tx.worldTerritoryWarLock.create({
        data: { territoryId: territory.id, warId: war.id },
      });
    });
    return { message: "Đã gửi thông báo khiêu chiến lãnh thổ. Trận bắt đầu ngay và kéo dài 24 giờ; liên minh thắng sẽ kiểm soát lãnh thổ." };
  }

  if (action.action === "attackWar") {
    const troopCount = action.infantry + action.archers + action.cavalry;
    if (troopCount < 1 || troopCount > MAX_TROOPS_PER_WAR_ATTACK) {
      throw new WorldAllianceActionError(`Mỗi đợt tấn công cần 1–${MAX_TROOPS_PER_WAR_ATTACK} quân.`, 400);
    }

    const potentialDamage =
      action.infantry * WAR_TROOP_DAMAGE.INFANTRY +
      action.archers * WAR_TROOP_DAMAGE.ARCHERS +
      action.cavalry * WAR_TROOP_DAMAGE.CAVALRY;
    const casualtiesTotal = Math.ceil(troopCount / 10);
    const casualtyTypes = [
      { key: "infantry" as const, count: action.infantry },
      { key: "archers" as const, count: action.archers },
      { key: "cavalry" as const, count: action.cavalry },
    ];
    const casualties = { infantry: 0, archers: 0, cavalry: 0 };
    const remainders = casualtyTypes.map(({ key, count }) => {
      casualties[key] = Math.floor(count / 10);
      return { key, count, fraction: (count / 10) % 1 };
    });
    let remainingCasualties = casualtiesTotal - casualties.infantry - casualties.archers - casualties.cavalry;
    remainders.sort((left, right) => right.fraction - left.fraction || right.count - left.count);
    for (const { key, count } of remainders) {
      if (remainingCasualties <= 0) break;
      if (casualties[key] < count) {
        casualties[key] += 1;
        remainingCasualties -= 1;
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const [war, membership, base] = await Promise.all([
        tx.worldAllianceWar.findUnique({ where: { id: action.warId } }),
        tx.worldAllianceMember.findUnique({ where: { userId }, select: { allianceId: true } }),
        tx.worldBase.findUnique({ where: { userId } }),
      ]);
      if (!war || war.status !== "ACTIVE" || !war.endsAt || war.endsAt <= now) {
        throw new WorldAllianceActionError("Chiến tranh này không còn nhận đợt tấn công.", 409);
      }
      if (
        !membership ||
        (membership.allianceId !== war.challengerAllianceId && membership.allianceId !== war.defenderAllianceId)
      ) {
        throw new WorldAllianceActionError("Bạn không thuộc liên minh đang tham chiến.", 403);
      }
      if (!base) throw new WorldAllianceActionError("Căn cứ chưa được khởi tạo.", 409);
      if (base.trainingType || base.marchActive) {
        throw new WorldAllianceActionError("Hoàn tất huấn luyện và chờ đạo quân hiện tại trở về trước.", 409);
      }

      const priorScore = await tx.worldAllianceWarScore.findUnique({
        where: { warId_userId: { warId: war.id, userId } },
      });
      const cooldownCutoff = new Date(now.getTime() - ALLIANCE_WAR_ATTACK_COOLDOWN_MS);
      if (priorScore?.lastAttackAt && priorScore.lastAttackAt > cooldownCutoff) {
        const seconds = Math.ceil(
          (ALLIANCE_WAR_ATTACK_COOLDOWN_MS - (now.getTime() - priorScore.lastAttackAt.getTime())) / 1000,
        );
        throw new WorldAllianceActionError(`Đợi thêm ${seconds} giây trước đợt tấn công tiếp theo.`, 429);
      }
      if (!priorScore) {
        await tx.worldAllianceWarScore.create({
          data: { warId: war.id, allianceId: membership.allianceId, userId },
        });
      }

      const reserved = await tx.worldBase.updateMany({
        where: {
          id: base.id,
          trainingType: null,
          marchActive: false,
          infantry: { gte: casualties.infantry },
          archers: { gte: casualties.archers },
          cavalry: { gte: casualties.cavalry },
        },
        data: {
          infantry: { decrement: casualties.infantry },
          archers: { decrement: casualties.archers },
          cavalry: { decrement: casualties.cavalry },
          version: { increment: 1 },
        },
      });
      if (!reserved.count) {
        throw new WorldAllianceActionError("Không đủ quân hoặc căn cứ vừa thay đổi.", 409);
      }

      const scored = await tx.worldAllianceWarScore.updateMany({
        where: {
          warId: war.id,
          userId,
          lastAttackAt: priorScore?.lastAttackAt ?? null,
        },
        data: { score: { increment: potentialDamage }, lastAttackAt: now },
      });
      if (!scored.count) throw new WorldAllianceActionError("Đợt tấn công vừa được ghi nhận. Hãy tải lại.", 409);

      const scoreField =
        membership.allianceId === war.challengerAllianceId ? "challengerScore" : "defenderScore";
      const scoredWar = await tx.worldAllianceWar.updateMany({
        where: { id: war.id, status: "ACTIVE", endsAt: { gt: now } },
        data: { [scoreField]: { increment: potentialDamage } },
      });
      if (!scoredWar.count) throw new WorldAllianceActionError("Chiến tranh vừa kết thúc.", 409);
      return { damage: potentialDamage, casualties: casualtiesTotal };
    });
    return {
      message: `Đợt tấn công gây ${result.damage.toLocaleString("vi-VN")} điểm sức mạnh; tổn thất ${result.casualties} quân.`,
    };
  }

  if (action.action === "create") {
    const tag = action.tag.trim().toUpperCase();
    const name = action.name.trim();
    const description = action.description.trim();
    if (name.length < 3 || name.length > 32) {
      throw new WorldAllianceActionError("Tên liên minh phải dài từ 3 đến 32 ký tự.", 400);
    }
    if (!/^[A-Z0-9]{2,5}$/.test(tag)) {
      throw new WorldAllianceActionError("Tag liên minh cần 2–5 chữ cái hoặc chữ số.", 400);
    }
    if (description.length > 240) {
      throw new WorldAllianceActionError("Mô tả không được dài quá 240 ký tự.", 400);
    }

    await prisma.$transaction(async (tx) => {
      const membership = await tx.worldAllianceMember.findUnique({ where: { userId }, select: { id: true } });
      if (membership) throw new WorldAllianceActionError("Bạn đã thuộc một liên minh.", 409);

      const alliance = await tx.worldAlliance.create({
        data: { name, tag, description, leaderUserId: userId },
        select: { id: true },
      });
      await tx.worldAllianceMember.create({
        data: { allianceId: alliance.id, userId, role: "LEADER" },
      });
    });
    return { message: `Đã thành lập liên minh [${tag}] ${name}.` };
  }

  if (action.action === "join") {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.worldAllianceMember.findUnique({ where: { userId }, select: { id: true } });
      if (existing) throw new WorldAllianceActionError("Bạn đã thuộc một liên minh. Hãy rời liên minh hiện tại trước.", 409);

      const alliance = await tx.worldAlliance.findUnique({ where: { id: action.allianceId }, select: { id: true } });
      if (!alliance) throw new WorldAllianceActionError("Không tìm thấy liên minh.", 404);
      await serializeAllianceMembershipChanges(tx, alliance.id);
      await assertAllianceWarUnlocked(tx, alliance.id);
      const reserved = await tx.worldAlliance.updateMany({
        where: { id: alliance.id, memberCount: { lt: WORLD_ALLIANCE_MEMBER_LIMIT } },
        data: { memberCount: { increment: 1 } },
      });
      if (!reserved.count) throw new WorldAllianceActionError("Liên minh đã đủ thành viên.", 409);
      await tx.worldAllianceMember.create({
        data: { allianceId: alliance.id, userId, role: "MEMBER" },
      });
    });
    return { message: "Bạn đã gia nhập liên minh." };
  }

  if (action.action === "leave") {
    await prisma.$transaction(async (tx) => {
      const membership = await tx.worldAllianceMember.findUnique({
        where: { userId },
        include: { alliance: { select: { id: true, leaderUserId: true, memberCount: true } } },
      });
      if (!membership) throw new WorldAllianceActionError("Bạn chưa thuộc liên minh nào.", 409);
      await serializeAllianceMembershipChanges(tx, membership.allianceId);
      await assertAllianceWarUnlocked(tx, membership.allianceId);

      if (membership.alliance.leaderUserId === userId) {
        if (membership.alliance.memberCount > 1) {
          throw new WorldAllianceActionError("Thủ lĩnh cần chuyển quyền lãnh đạo trước khi rời liên minh.", 409);
        }
        const deleted = await tx.worldAlliance.deleteMany({
          where: { id: membership.allianceId, leaderUserId: userId, memberCount: 1 },
        });
        if (!deleted.count) throw new WorldAllianceActionError("Liên minh vừa thay đổi. Hãy tải lại.", 409);
        return;
      }

      const removed = await tx.worldAllianceMember.deleteMany({
        where: { id: membership.id, allianceId: membership.allianceId },
      });
      if (!removed.count) throw new WorldAllianceActionError("Thành viên vừa thay đổi. Hãy tải lại.", 409);
      const decremented = await tx.worldAlliance.updateMany({
        where: { id: membership.allianceId, memberCount: { gt: 1 } },
        data: { memberCount: { decrement: 1 } },
      });
      if (!decremented.count) throw new WorldAllianceActionError("Không thể cập nhật số thành viên.", 409);
    });
    return { message: "Bạn đã rời liên minh." };
  }

  if (action.action === "kick") {
    await prisma.$transaction(async (tx) => {
      const alliance = await tx.worldAlliance.findFirst({
        where: { leaderUserId: userId },
        select: { id: true },
      });
      if (!alliance) throw new WorldAllianceActionError("Chỉ thủ lĩnh mới có thể quản lý thành viên.", 403);
      await serializeAllianceMembershipChanges(tx, alliance.id);
      await assertAllianceWarUnlocked(tx, alliance.id);
      if (action.targetUserId === userId) {
        throw new WorldAllianceActionError("Không thể tự loại mình khỏi liên minh.", 400);
      }
      const removed = await tx.worldAllianceMember.deleteMany({
        where: {
          allianceId: alliance.id,
          userId: action.targetUserId,
          role: "MEMBER",
        },
      });
      if (!removed.count) throw new WorldAllianceActionError("Không tìm thấy thành viên có thể loại.", 404);
      const decremented = await tx.worldAlliance.updateMany({
        where: { id: alliance.id, leaderUserId: userId, memberCount: { gt: 1 } },
        data: { memberCount: { decrement: 1 } },
      });
      if (!decremented.count) throw new WorldAllianceActionError("Liên minh vừa thay đổi. Hãy tải lại.", 409);
    });
    return { message: "Đã loại thành viên khỏi liên minh." };
  }

  await prisma.$transaction(async (tx) => {
    const alliance = await tx.worldAlliance.findFirst({
      where: { leaderUserId: userId },
      select: { id: true },
    });
    if (!alliance) throw new WorldAllianceActionError("Chỉ thủ lĩnh mới có thể chuyển quyền lãnh đạo.", 403);
    await serializeAllianceMembershipChanges(tx, alliance.id);
    await assertAllianceWarUnlocked(tx, alliance.id);
    const target = await tx.worldAllianceMember.findFirst({
      where: { allianceId: alliance.id, userId: action.targetUserId, role: "MEMBER" },
      select: { id: true },
    });
    if (!target) throw new WorldAllianceActionError("Không tìm thấy thành viên có thể chuyển quyền.", 404);

    const transferred = await tx.worldAlliance.updateMany({
      where: { id: alliance.id, leaderUserId: userId },
      data: { leaderUserId: action.targetUserId },
    });
    if (!transferred.count) throw new WorldAllianceActionError("Quyền lãnh đạo vừa thay đổi.", 409);
    await tx.worldAllianceMember.update({
      where: { id: target.id },
      data: { role: "LEADER" },
    });
    const demoted = await tx.worldAllianceMember.updateMany({
      where: { allianceId: alliance.id, userId, role: "LEADER" },
      data: { role: "MEMBER" },
    });
    if (!demoted.count) throw new WorldAllianceActionError("Không thể cập nhật vai trò thủ lĩnh.", 409);
  });
  return { message: "Đã chuyển quyền thủ lĩnh." };
}
