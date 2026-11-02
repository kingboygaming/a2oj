import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { parseJudgeResults } from "@/lib/submission-results";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Cần đăng nhập." }, { status: 401 });
  }

  const { id } = await context.params;
  const submission = await prisma.submission.findUnique({
    where: { id },
    include: { problem: { select: { slug: true, title: true } } },
  });
  if (!submission) {
    return NextResponse.json({ error: "Không tìm thấy bài nộp." }, { status: 404 });
  }

  const staff = user.role === "TEACHER" || user.role === "ADMIN";
  if (submission.userId !== user.id && !staff) {
    return NextResponse.json({ error: "Không có quyền xem." }, { status: 403 });
  }

  const storedResult = parseJudgeResults(submission.log);
  const reward = await prisma.gachaRewardClaim.findFirst({
    where: { submissionId: id },
    include: { card: { select: { name: true, rarity: true } } },
  });
  return NextResponse.json({
    ...submission,
    log: storedResult?.message ?? submission.log,
    gachaReward: reward
      ? { rewardType: reward.rewardType, ticketsAwarded: reward.ticketsAwarded, card: reward.card }
      : null,
  });
}
