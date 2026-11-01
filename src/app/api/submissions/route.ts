import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasContestAccess } from "@/lib/auth";
import { judgeSubmission } from "@/lib/judge";
import { serializeJudgeResults } from "@/lib/submission-results";
import { gradeStoredSubmission } from "@/lib/submission-grading";
import {
  enqueueSubmission,
  isSubmissionQueueConfigured,
} from "@/lib/submission-queue";

export const maxDuration = 60; // Tăng timeout của Vercel Serverless Function lên tối đa
const VERCEL_MAX_TESTS_PER_SUBMISSION = 20;

const schema = z.object({
  problemId: z.string().min(1),
  language: z.enum(["CPP", "PYTHON"]),
  source: z.string().min(1).max(64_000),
  contestId: z.string().optional(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Cần đăng nhập." }, { status: 401 });
  }

  const items = await prisma.submission.findMany({
    where: { userId: user.id, contestId: null },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      problem: { select: { slug: true, title: true } },
    },
  });
  return NextResponse.json(items);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Cần đăng nhập để nộp bài." }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload nộp bài không hợp lệ." }, { status: 400 });
  }

  const problem = await prisma.problem.findUnique({
    where: { id: parsed.data.problemId },
    include: { testCases: { orderBy: { order: "asc" } } },
  });
  if (!problem || !problem.published) {
    return NextResponse.json({ error: "Không nộp được bài này." }, { status: 404 });
  }
  if (problem.contestOnly && !parsed.data.contestId) {
    return NextResponse.json(
      { error: "Bài này chỉ được nộp trong contest." },
      { status: 400 },
    );
  }

  let contestConfig: {
    testLimit: number;
    ioMode?: string | null;
    inputFile?: string | null;
    outputFile?: string | null;
    judgeType?: string | null;
  } | null = null;
  if (parsed.data.contestId) {
    const contest = await prisma.contest.findUnique({
      where: { id: parsed.data.contestId },
      include: {
        problems: {
          where: { problemId: problem.id },
          select: { problemId: true, ioMode: true, inputFile: true, outputFile: true, judgeType: true },
        },
        registrations: { where: { userId: user.id }, select: { userId: true } },
      },
    });
    const now = new Date();
    if (!contest || !contest.problems.length) {
      return NextResponse.json(
        { error: "Bài này không thuộc contest đã chọn." },
        { status: 400 },
      );
    }
    if (!(await hasContestAccess(contest.id, contest.passwordHash))) {
      return NextResponse.json(
        { error: "Bạn cần nhập mật khẩu contest trước khi nộp bài." },
        { status: 403 },
      );
    }
    if (!contest.registrations.length) {
      return NextResponse.json(
        { error: "Bạn cần đăng ký contest trước khi nộp bài." },
        { status: 403 },
      );
    }
    if (now < contest.startAt || now > contest.endAt) {
      return NextResponse.json(
        { error: "Contest chưa bắt đầu hoặc đã kết thúc." },
        { status: 400 },
      );
    }
    const cp = contest.problems[0];
    contestConfig = {
      testLimit: contest.testLimit,
      ioMode: cp.ioMode,
      inputFile: cp.inputFile,
      outputFile: cp.outputFile,
      judgeType: cp.judgeType,
    };
  }

  if (process.env.VERCEL === "1" && isSubmissionQueueConfigured()) {
    const queued = await prisma.submission.create({
      data: {
        userId: user.id,
        problemId: problem.id,
        contestId: parsed.data.contestId,
        language: parsed.data.language,
        source: parsed.data.source,
        verdict: "QUEUED",
      },
      include: { problem: { select: { slug: true, title: true } } },
    });

    try {
      const message = await enqueueSubmission(queued.id);
      return NextResponse.json(
        { ...queued, queueMessageId: message.messageId, log: "Bài nộp đã vào hàng đợi chấm." },
        { status: 202 },
      );
    } catch (queueError) {
      console.warn("QStash could not accept the submission; grading synchronously:", queueError);
      await prisma.submission.update({
        where: { id: queued.id },
        data: { verdict: "RUNNING", judgeStartedAt: new Date() },
      });

      try {
        const { result, totalTests } = await gradeStoredSubmission(queued.id);
        const updated = await prisma.submission.update({
          where: { id: queued.id },
          data: {
            verdict: result.verdict,
            score: result.score,
            timeMs: result.timeMs,
            log: serializeJudgeResults(result, totalTests),
            judgeStartedAt: null,
          },
          include: { problem: { select: { slug: true, title: true } } },
        });
        return NextResponse.json(
          { ...updated, log: result.log, queueFallback: true },
          { status: 201 },
        );
      } catch (gradingError) {
        const message = gradingError instanceof Error ? gradingError.message : String(gradingError);
        const result = {
          verdict: "RTE" as const,
          score: 0,
          timeMs: 0,
          log: `QStash không nhận được bài và máy chấm trực tiếp gặp lỗi: ${message}`.slice(0, 4000),
          testResults: [],
        };
        const updated = await prisma.submission.update({
          where: { id: queued.id },
          data: {
            verdict: result.verdict,
            score: result.score,
            timeMs: result.timeMs,
            log: serializeJudgeResults(result, 0),
            judgeStartedAt: null,
          },
          include: { problem: { select: { slug: true, title: true } } },
        });
        return NextResponse.json(
          { ...updated, log: result.log, queueFallback: true },
          { status: 201 },
        );
      }
    }
  }

  // Chấm test:
  // Nếu nộp trong contest:
  // - Lấy danh sách testcase theo thứ tự order
  // - Áp dụng testLimit của contest (mặc định 5 test, 0 = không giới hạn / toàn bộ test)
  let gradingCandidates: typeof problem.testCases;
  if (contestConfig) {
    const limit = contestConfig.testLimit;
    if (limit > 0) {
      gradingCandidates = problem.testCases.slice(0, limit);
    } else {
      gradingCandidates = problem.testCases;
    }
  } else {
    const hiddenTests = problem.testCases.filter((t) => !t.isSample);
    const baseTests = hiddenTests.length > 0 ? hiddenTests : problem.testCases;
    // Judge0 CE hiện cho phép tối đa 20 mục trong một batch.
    // Giữ cùng giới hạn trên Vercel để request không vượt trần batch của dịch vụ chấm.
    gradingCandidates =
      process.env.VERCEL === "1"
        ? baseTests.slice(0, VERCEL_MAX_TESTS_PER_SUBMISSION)
        : baseTests;
  }

  // Đảm bảo testcase có điểm (> 0) để người qua pretest được ghi nhận điểm > 0
  const gradingSet = gradingCandidates.map((t) => ({
    ...t,
    points:
      t.points > 0
        ? t.points
        : Math.max(10, Math.floor(100 / Math.max(gradingCandidates.length, 1))),
  }));

  const queued = await prisma.submission.create({
    data: {
      userId: user.id,
      problemId: problem.id,
      contestId: parsed.data.contestId,
      language: parsed.data.language,
      source: parsed.data.source,
      verdict: "RUNNING",
    },
  });

  const effectiveIoMode = contestConfig?.ioMode || problem.ioMode || "STDIO";
  const effectiveInputFile =
    effectiveIoMode === "FILE"
      ? contestConfig?.inputFile || problem.inputFile || `${problem.slug.toUpperCase()}.INP`
      : null;
  const effectiveOutputFile =
    effectiveIoMode === "FILE"
      ? contestConfig?.outputFile || problem.outputFile || `${problem.slug.toUpperCase()}.OUT`
      : null;

  const effectiveJudgeType = contestConfig?.judgeType || problem.judgeType || "STANDARD";

  const result = await judgeSubmission(
    parsed.data.language,
    parsed.data.source,
    gradingSet,
    problem.timeLimitMs,
    effectiveInputFile,
    effectiveOutputFile,
    effectiveJudgeType,
    problem.heuristicTolerancePercent,
  );

  const updated = await prisma.submission.update({
    where: { id: queued.id },
    data: {
      verdict: result.verdict,
      score: result.score,
      timeMs: result.timeMs,
      log: serializeJudgeResults(result, gradingSet.length),
    },
    include: { problem: { select: { slug: true, title: true } } },
  });

  return NextResponse.json(
    { ...updated, log: result.log, testResults: result.testResults },
    { status: 201 },
  );
}
