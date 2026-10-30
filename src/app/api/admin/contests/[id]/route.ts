import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Bạn không có quyền quản trị." }, { status: 403 });
  }

  const { id } = await context.params;
  const contest = await prisma.contest.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!contest) {
    return NextResponse.json({ error: "Không tìm thấy contest." }, { status: 404 });
  }

  await prisma.$transaction(async (transaction) => {
    const privateProblems = await transaction.contestProblem.findMany({
      where: { contestId: contest.id, problem: { contestOnly: true } },
      select: {
        problemId: true,
        problem: { select: { contestLinks: { select: { contestId: true } } } },
      },
    });
    const orphanedPrivateProblemIds = privateProblems
      .filter(({ problem }) => problem.contestLinks.length === 1)
      .map(({ problemId }) => problemId);

    await transaction.submission.deleteMany({ where: { contestId: contest.id } });
    await transaction.contestRegistration.deleteMany({ where: { contestId: contest.id } });
    await transaction.contestProblem.deleteMany({ where: { contestId: contest.id } });
    await transaction.contest.delete({ where: { id: contest.id } });

    if (orphanedPrivateProblemIds.length > 0) {
      await transaction.submission.deleteMany({
        where: { problemId: { in: orphanedPrivateProblemIds } },
      });
      await transaction.problem.deleteMany({
        where: { id: { in: orphanedPrivateProblemIds } },
      });
    }
  });

  return NextResponse.json({ success: true });
}
