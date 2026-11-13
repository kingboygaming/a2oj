import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const WORLD_ALLIANCE_MEMBER_LIMIT = 20;

type AllianceAction =
  | { action: "create"; name: string; tag: string; description: string }
  | { action: "join"; allianceId: string }
  | { action: "leave" }
  | { action: "kick"; targetUserId: string }
  | { action: "transfer"; targetUserId: string };

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
      memberCount: { lt: WORLD_ALLIANCE_MEMBER_LIMIT },
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
      leader: { select: { displayName: true, username: true } },
    },
  });

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
      leaderName: alliance.leader.displayName || alliance.leader.username,
    })),
    memberLimit: WORLD_ALLIANCE_MEMBER_LIMIT,
  };
}

export async function performWorldAllianceAction(userId: string, action: AllianceAction) {
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
