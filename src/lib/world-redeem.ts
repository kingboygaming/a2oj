import { createHash, randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { worldStorageCapacity } from "@/lib/world-progression";
import { advanceWorld } from "@/lib/world";

/**
 * A2 Kingdom — redeem ("gift") codes.
 *
 * Codes are never stored in plain text: only the SHA-256 hash of the
 * normalised code plus a masked preview for the admin list. Redemption is
 * transactional and guarded by `usedCount`/`perUserLimit` so a code can never
 * be over-spent, even under concurrent requests.
 */

export class WorldRedeemError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "WorldRedeemError";
    this.status = status;
  }
}

export function isWorldRedeemError(error: unknown): error is WorldRedeemError {
  return error instanceof WorldRedeemError;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Uppercase and strip separators so "a2-king dom" == "A2KINGDOM". */
export function normalizeWorldRedeemCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function hashWorldRedeemCode(normalized: string): string {
  return createHash("sha256").update(normalized).digest("hex");
}

/** Masked label kept for admins; never enough to reconstruct the code. */
export function maskWorldRedeemCode(normalized: string): string {
  if (normalized.length <= 6) {
    return `${normalized.slice(0, 1)}${"•".repeat(Math.max(1, normalized.length - 2))}${normalized.slice(-1)}`;
  }
  return `${normalized.slice(0, 3)}${"•".repeat(Math.min(6, normalized.length - 5))}${normalized.slice(-2)}`;
}

export function generateWorldRedeemCode(): string {
  let code = "";
  for (let index = 0; index < 12; index += 1) {
    code += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
  }
  return code;
}

function normalizeDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new WorldRedeemError("Thời gian không hợp lệ.", 400);
  }
  return parsed;
}

export type WorldRedeemCodeInput = {
  code?: string | null;
  campaign: string;
  rewardWood: number;
  rewardStone: number;
  rewardFood: number;
  rewardIron: number;
  rewardA2Coin: number;
  maxUses: number;
  perUserLimit: number;
  startsAt?: string | null;
  expiresAt?: string | null;
  enabled?: boolean;
};

function assertRewardShape(input: WorldRedeemCodeInput) {
  if (!Number.isInteger(input.maxUses) || input.maxUses < 0) {
    throw new WorldRedeemError("Số lượt dùng tối đa không hợp lệ.", 400);
  }
  if (!Number.isInteger(input.perUserLimit) || input.perUserLimit < 1) {
    throw new WorldRedeemError("Giới hạn mỗi người phải từ 1 trở lên.", 400);
  }
  if (input.maxUses > 0 && input.perUserLimit > input.maxUses) {
    throw new WorldRedeemError("Giới hạn mỗi người không thể lớn hơn tổng số lượt.", 400);
  }
  const totalReward =
    input.rewardWood + input.rewardStone + input.rewardFood + input.rewardIron + input.rewardA2Coin;
  if (totalReward <= 0) {
    throw new WorldRedeemError("Mã cần ít nhất một phần thưởng.", 400);
  }
}

export async function createWorldRedeemCode(
  adminUserId: string,
  input: WorldRedeemCodeInput,
) {
  assertRewardShape(input);
  const normalized = normalizeWorldRedeemCode(input.code || generateWorldRedeemCode());
  if (normalized.length < 4) {
    throw new WorldRedeemError("Mã cần ít nhất 4 ký tự.", 400);
  }
  const startsAt = normalizeDate(input.startsAt);
  const expiresAt = normalizeDate(input.expiresAt);
  if (startsAt && expiresAt && expiresAt <= startsAt) {
    throw new WorldRedeemError("Thời điểm hết hạn phải sau thời điểm bắt đầu.", 400);
  }

  const codeHash = hashWorldRedeemCode(normalized);
  const codePreview = maskWorldRedeemCode(normalized);

  try {
    const record = await prisma.$transaction(async (tx) => {
      const created = await tx.worldRedeemCode.create({
        data: {
          codeHash,
          codePreview,
          campaign: input.campaign,
          rewardWood: input.rewardWood,
          rewardStone: input.rewardStone,
          rewardFood: input.rewardFood,
          rewardIron: input.rewardIron,
          rewardA2Coin: input.rewardA2Coin,
          maxUses: input.maxUses,
          perUserLimit: input.perUserLimit,
          startsAt,
          expiresAt,
          enabled: input.enabled ?? true,
          createdById: adminUserId,
        },
      });
      await tx.worldAdminAuditLog.create({
        data: {
          adminUserId,
          action: "CREATE_REDEEM_CODE",
          targetType: "WorldRedeemCode",
          targetId: created.id,
          detail: `${created.campaign} (${created.codePreview})`,
        },
      });
      return created;
    });
    // The raw code is returned exactly once so the admin can publish it.
    return { code: normalized, record };
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      throw new WorldRedeemError("Mã này đã tồn tại.", 409);
    }
    throw error;
  }
}

export async function updateWorldRedeemCode(
  adminUserId: string,
  codeId: string,
  input: { enabled?: boolean; maxUses?: number; perUserLimit?: number; expiresAt?: string | null },
) {
  const expiresAt =
    input.expiresAt === undefined ? undefined : normalizeDate(input.expiresAt);
  const record = await prisma.$transaction(async (tx) => {
    const current = await tx.worldRedeemCode.findUnique({ where: { id: codeId } });
    if (!current) throw new WorldRedeemError("Không tìm thấy mã.", 404);
    const maxUses = input.maxUses ?? current.maxUses;
    const perUserLimit = input.perUserLimit ?? current.perUserLimit;
    if (!Number.isInteger(maxUses) || maxUses < 0) {
      throw new WorldRedeemError("Số lượt dùng tối đa không hợp lệ.", 400);
    }
    if (!Number.isInteger(perUserLimit) || perUserLimit < 1) {
      throw new WorldRedeemError("Giới hạn mỗi người phải từ 1 trở lên.", 400);
    }
    if (maxUses > 0 && maxUses < current.usedCount) {
      throw new WorldRedeemError("Số lượt tối đa không thể nhỏ hơn số lượt đã dùng.", 400);
    }
    if (maxUses > 0 && perUserLimit > maxUses) {
      throw new WorldRedeemError("Giới hạn mỗi người không thể lớn hơn tổng số lượt.", 400);
    }
    const updated = await tx.worldRedeemCode.update({
      where: { id: codeId },
      data: {
        ...(input.enabled === undefined ? {} : { enabled: input.enabled }),
        maxUses,
        perUserLimit,
        ...(expiresAt === undefined ? {} : { expiresAt }),
      },
    });
    await tx.worldAdminAuditLog.create({
      data: {
        adminUserId,
        action: "UPDATE_REDEEM_CODE",
        targetType: "WorldRedeemCode",
        targetId: codeId,
        detail: JSON.stringify({
          enabled: updated.enabled,
          maxUses: updated.maxUses,
          perUserLimit: updated.perUserLimit,
          expiresAt: updated.expiresAt?.toISOString() ?? null,
        }),
      },
    });
    return updated;
  });
  return record;
}

export async function deleteWorldRedeemCode(adminUserId: string, codeId: string) {
  await prisma.$transaction(async (tx) => {
    const current = await tx.worldRedeemCode.findUnique({
      where: { id: codeId },
      select: { id: true, campaign: true, codePreview: true },
    });
    if (!current) throw new WorldRedeemError("Không tìm thấy mã.", 404);
    await tx.worldRedeemCode.delete({ where: { id: codeId } });
    await tx.worldAdminAuditLog.create({
      data: {
        adminUserId,
        action: "DELETE_REDEEM_CODE",
        targetType: "WorldRedeemCode",
        targetId: codeId,
        detail: `${current.campaign} (${current.codePreview})`,
      },
    });
  });
}

export async function listWorldRedeemCodes() {
  return prisma.worldRedeemCode.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      createdBy: { select: { username: true, displayName: true } },
      _count: { select: { redemptions: true } },
    },
  });
}

/** Effective completed warehouse levels, mirroring the server capacity rule. */
function completedWarehouseLevels(
  buildings: ReadonlyArray<{
    buildingType: string;
    level: number;
    pendingLevel: number | null;
    completesAt: Date;
  }>,
  now: Date,
): number {
  let levels = 0;
  for (const building of buildings) {
    if (building.buildingType !== "WAREHOUSE") continue;
    if (building.completesAt <= now) {
      levels += building.pendingLevel ?? building.level;
    }
  }
  return levels;
}

export async function redeemWorldCode(userId: string, rawCode: string, now = new Date()) {
  const normalized = normalizeWorldRedeemCode(rawCode);
  if (normalized.length < 4) {
    throw new WorldRedeemError("Mã quà tặng không hợp lệ.", 400);
  }
  // Make sure the base exists and its resources are up to date before capping.
  await advanceWorld(userId, now);
  const codeHash = hashWorldRedeemCode(normalized);

  return prisma.$transaction(async (tx) => {
    const code = await tx.worldRedeemCode.findUnique({ where: { codeHash } });
    if (!code || !code.enabled) {
      throw new WorldRedeemError("Mã không hợp lệ hoặc đã bị vô hiệu hoá.", 404);
    }
    if (code.startsAt && code.startsAt > now) {
      throw new WorldRedeemError("Mã chưa đến thời gian sử dụng.", 409);
    }
    if (code.expiresAt && code.expiresAt <= now) {
      throw new WorldRedeemError("Mã đã hết hạn.", 409);
    }

    const usedByUser = await tx.worldRedeemRedemption.count({
      where: { codeId: code.id, userId },
    });
    if (usedByUser >= code.perUserLimit) {
      throw new WorldRedeemError(
        `Bạn đã sử dụng mã này tối đa ${code.perUserLimit} lần.`,
        409,
      );
    }

    const guard = await tx.worldRedeemCode.updateMany({
      where: {
        id: code.id,
        enabled: true,
        ...(code.maxUses > 0 ? { usedCount: { lt: code.maxUses } } : {}),
      },
      data: { usedCount: { increment: 1 } },
    });
    if (!guard.count) {
      throw new WorldRedeemError("Mã đã hết lượt sử dụng.", 409);
    }

    const base = await tx.worldBase.findUnique({ where: { userId } });
    if (!base) {
      throw new WorldRedeemError("Chưa khởi tạo căn cứ A2 Kingdom.", 409);
    }
    const buildings = await tx.worldBuilding.findMany({
      where: { baseId: base.id },
      select: {
        buildingType: true,
        level: true,
        pendingLevel: true,
        completesAt: true,
      },
    });
    const capacity = worldStorageCapacity(
      base.warehouseLevel,
      completedWarehouseLevels(buildings, now),
    );

    const redemption = await tx.worldRedeemRedemption.create({
      data: {
        codeId: code.id,
        userId,
        sequence: usedByUser + 1,
        rewardWood: code.rewardWood,
        rewardStone: code.rewardStone,
        rewardFood: code.rewardFood,
        rewardIron: code.rewardIron,
        rewardA2Coin: code.rewardA2Coin,
        redeemedAt: now,
      },
    });

    await tx.worldBase.update({
      where: { id: base.id },
      data: {
        wood: Math.min(capacity, base.wood + code.rewardWood),
        stone: Math.min(capacity, base.stone + code.rewardStone),
        food: Math.min(capacity, base.food + code.rewardFood),
        iron: base.iron + code.rewardIron,
        version: { increment: 1 },
      },
    });

    if (code.rewardA2Coin > 0) {
      await tx.user.update({
        where: { id: userId },
        data: { a2Coins: { increment: code.rewardA2Coin } },
      });
      await tx.pointTransaction.create({
        data: {
          userId,
          amount: code.rewardA2Coin,
          currency: "A2_COIN",
          type: "REDEEM_CODE",
          description: `Nhập mã quà tặng ${code.codePreview} (${code.campaign})`,
          referenceId: redemption.id,
        },
      });
    }

    return {
      message: `Nhập mã thành công: +${code.rewardWood} gỗ, +${code.rewardStone} đá, +${code.rewardFood} lương thực, +${code.rewardIron} sắt, +${code.rewardA2Coin} A2 Coin.`,
      campaign: code.campaign,
      codePreview: code.codePreview,
      rewards: {
        wood: code.rewardWood,
        stone: code.rewardStone,
        food: code.rewardFood,
        iron: code.rewardIron,
        a2Coin: code.rewardA2Coin,
      },
    };
  });
}
