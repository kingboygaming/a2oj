import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { judgeSubmission } from "@/lib/judge";
import { serializeJudgeResults } from "@/lib/submission-results";

// Rejudge có thể mất nhiều thời gian với nhiều bài/thí sinh
export const maxDuration = 60;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Cần đăng nhập." }, { status: 401 });
  }

  // Lấy thông tin contest kèm problems và testcases
  const contest = await prisma.contest.findUnique({
    where: { id },
    include: {
      problems: {
        include: {
          problem: {
            include: {
              testCases: { orderBy: { order: "asc" } },
            },
          },
        },
      },
    },
  });

  if (!contest) {
    return NextResponse.json({ error: "Không tìm thấy kỳ thi." }, { status: 404 });
  }

  // Chỉ tổ chức (authorId) hoặc ADMIN mới được rejudge
  const isOrganizer = user.role === "ADMIN" || user.id === contest.authorId;
  if (!isOrganizer) {
    return NextResponse.json({ error: "Bạn không có quyền thực hiện thao tác này." }, { status: 403 });
  }

  let rejudged = 0;
  const errors: string[] = [];

  // Với từng bài trong contest
  for (const cp of contest.problems) {
    const problem = cp.problem;

    // Lấy tất cả submissions của bài này trong contest
    const allSubs = await prisma.submission.findMany({
      where: {
        contestId: contest.id,
        problemId: problem.id,
        verdict: { not: "RUNNING" },
      },
      orderBy: [{ score: "desc" }, { createdAt: "asc" }],
    });

    if (allSubs.length === 0) continue;

    // Nhóm theo userId, chọn bài nộp tốt nhất (score cao nhất, nếu bằng → sớm hơn)
    const bestByUser = new Map<string, (typeof allSubs)[0]>();
    for (const sub of allSubs) {
      const current = bestByUser.get(sub.userId);
      if (!current) {
        bestByUser.set(sub.userId, sub);
      } else if (sub.score > current.score) {
        bestByUser.set(sub.userId, sub);
      }
      // nếu score bằng nhau, giữ bài cũ hơn (orderBy createdAt asc đã xử lý)
    }

    // Xác định ioMode, inputFile, outputFile, judgeType cho bài này trong contest
    const effectiveIoMode = cp.ioMode || problem.ioMode || "STDIO";
    const effectiveInputFile =
      effectiveIoMode === "FILE"
        ? cp.inputFile || problem.inputFile || `${problem.slug.toUpperCase()}.INP`
        : null;
    const effectiveOutputFile =
      effectiveIoMode === "FILE"
        ? cp.outputFile || problem.outputFile || `${problem.slug.toUpperCase()}.OUT`
        : null;
    const effectiveJudgeType = cp.judgeType || problem.judgeType || "STANDARD";

    // Chấm lại với TOÀN BỘ testcases (không giới hạn testLimit)
    const allTests = problem.testCases;
    const gradingSet = allTests.map((t) => ({
      ...t,
      points:
        t.points > 0
          ? t.points
          : Math.max(10, Math.floor(100 / Math.max(allTests.length, 1))),
    }));

    // Rejudge từng bài nộp tốt nhất
    for (const [, sub] of bestByUser) {
      try {
        const result = await judgeSubmission(
          sub.language,
          sub.source,
          gradingSet,
          problem.timeLimitMs,
          effectiveInputFile,
          effectiveOutputFile,
          effectiveJudgeType,
          problem.heuristicTolerancePercent,
          problem.interactorSource,
        );

        await prisma.submission.update({
          where: { id: sub.id },
          data: {
            verdict: result.verdict,
            score: result.score,
            timeMs: result.timeMs,
            log: serializeJudgeResults(result, gradingSet.length),
          },
        });

        rejudged++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Sub ${sub.id} (${problem.slug}): ${msg}`);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    rejudged,
    errors,
    message: `Đã chấm lại ${rejudged} bài nộp.${errors.length > 0 ? ` (${errors.length} lỗi)` : ""}`,
  });
}
