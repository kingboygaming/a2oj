import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { prepareWorldAllianceForUserDeletion } from "@/lib/world-alliance";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const currentUser = await getCurrentUser();
  if (currentUser?.role !== "ADMIN") {
    return NextResponse.json({ error: "Bạn không có quyền quản trị." }, { status: 403 });
  }

  const parsed = z.object({
    gachaTickets: z.number().int().min(0).max(1_000_000),
  }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Số lượt quay phải là số nguyên từ 0 đến 1.000.000." }, { status: 400 });
  }

  const { id } = await context.params;
  const result = await prisma.user.updateMany({
    where: { id },
    data: { gachaTickets: parsed.data.gachaTickets },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Không tìm thấy tài khoản." }, { status: 404 });
  }

  return NextResponse.json({ success: true, gachaTickets: parsed.data.gachaTickets });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const currentUser = await getCurrentUser();
  if (currentUser?.role !== "ADMIN") {
    return NextResponse.json({ error: "Bạn không có quyền quản trị." }, { status: 403 });
  }

  const { id } = await context.params;
  if (id === currentUser.id) {
    return NextResponse.json({ error: "Không thể xóa tài khoản đang đăng nhập." }, { status: 400 });
  }

  const result = await prisma.$transaction(async (transaction) => {
    const targetUser = await transaction.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });
    if (!targetUser) return { error: "Không tìm thấy tài khoản.", status: 404 };
    if (
      targetUser.role === "ADMIN" &&
      (await transaction.user.count({ where: { role: "ADMIN" } })) <= 1
    ) {
      return { error: "Không thể xóa tài khoản admin cuối cùng.", status: 400 };
    }

    await prepareWorldAllianceForUserDeletion(transaction, targetUser.id);

    const [ownedContests, authoredProblems] = await Promise.all([
      transaction.contest.findMany({
        where: { authorId: targetUser.id },
        select: { id: true },
      }),
      transaction.problem.findMany({
        where: { authorId: targetUser.id },
        select: { id: true },
      }),
    ]);
    const contestIds = ownedContests.map((contest) => contest.id);
    const problemIds = authoredProblems.map((problem) => problem.id);

    await transaction.submission.deleteMany({
      where: {
        OR: [
          { userId: targetUser.id },
          ...(contestIds.length > 0 ? [{ contestId: { in: contestIds } }] : []),
          ...(problemIds.length > 0 ? [{ problemId: { in: problemIds } }] : []),
        ],
      },
    });
    await transaction.contestRegistration.deleteMany({
      where: {
        OR: [
          { userId: targetUser.id },
          ...(contestIds.length > 0 ? [{ contestId: { in: contestIds } }] : []),
        ],
      },
    });
    if (problemIds.length > 0) {
      await transaction.contestProblem.deleteMany({
        where: { problemId: { in: problemIds } },
      });
    }
    await transaction.contest.deleteMany({ where: { authorId: targetUser.id } });
    await transaction.problem.deleteMany({ where: { authorId: targetUser.id } });
    await transaction.news.deleteMany({ where: { authorId: targetUser.id } });
    await transaction.user.delete({ where: { id: targetUser.id } });
    return { error: null, status: 200 };
  });
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ success: true });
}
