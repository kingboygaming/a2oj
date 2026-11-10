import { prisma } from "@/lib/prisma";
import { judgeSubmission, type JudgeResult } from "@/lib/judge";

const VERCEL_MAX_TESTS_PER_SUBMISSION = 20;

export async function gradeStoredSubmission(submissionId: string): Promise<{
  result: JudgeResult;
  totalTests: number;
}> {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { problem: { include: { testCases: { orderBy: { order: "asc" } } } } },
  });
  if (!submission) throw new Error("Không tìm thấy bài nộp cần chấm.");

  const [contest, contestProblem] = submission.contestId
    ? await Promise.all([
        prisma.contest.findUnique({
          where: { id: submission.contestId },
          select: { testLimit: true, scoringMode: true },
        }),
        prisma.contestProblem.findUnique({
          where: {
            contestId_problemId: {
              contestId: submission.contestId,
              problemId: submission.problemId,
            },
          },
          select: { ioMode: true, inputFile: true, outputFile: true, judgeType: true },
        }),
      ])
    : [null, null];

  let gradingCandidates = submission.problem.testCases;
  if (contest) {
    if (contest.testLimit > 0) {
      gradingCandidates = gradingCandidates.slice(0, contest.testLimit);
    }
  } else {
    const hiddenTests = gradingCandidates.filter((test) => !test.isSample);
    if (hiddenTests.length > 0) gradingCandidates = hiddenTests;
    if (process.env.VERCEL === "1" || process.env.JUDGE_WORKER === "1") {
      gradingCandidates = gradingCandidates.slice(0, VERCEL_MAX_TESTS_PER_SUBMISSION);
    }
  }

  const gradingSet = gradingCandidates.map((test) => ({
    ...test,
    points:
      test.points > 0
        ? test.points
        : Math.max(10, Math.floor(100 / Math.max(gradingCandidates.length, 1))),
  }));
  const problem = submission.problem;
  const ioMode = contestProblem?.ioMode || problem.ioMode || "STDIO";
  const inputFile = ioMode === "FILE"
    ? contestProblem?.inputFile || problem.inputFile || `${problem.slug.toUpperCase()}.INP`
    : null;
  const outputFile = ioMode === "FILE"
    ? contestProblem?.outputFile || problem.outputFile || `${problem.slug.toUpperCase()}.OUT`
    : null;
  const judgeType = contestProblem?.judgeType || problem.judgeType || "STANDARD";

  const result = await judgeSubmission(
    submission.language,
    submission.source,
    gradingSet,
    problem.timeLimitMs,
    inputFile,
    outputFile,
    judgeType,
    problem.heuristicTolerancePercent,
    problem.interactorSource,
  );

  if (
    result.verdict === "RTE" &&
    result.testResults.length === 0 &&
    (result.log.startsWith("Máy chủ chấm cloud gặp sự cố kết nối:") ||
      result.log.startsWith("Interactive judge runner failed:"))
  ) {
    throw new Error(result.log);
  }

  return { result, totalTests: gradingSet.length };
}
