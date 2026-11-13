import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateContestStandings } from "@/lib/contest-standings";
import { getContestScoringProblems } from "@/lib/scoring";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const contest = await prisma.contest.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    include: {
      problems: {
        orderBy: { letter: "asc" },
        include: {
          problem: {
            select: {
              scoringMode: true,
              testCases: {
                orderBy: { order: "asc" },
                select: { points: true },
              },
            },
          },
        },
      },
    },
  });
  if (!contest) {
    return NextResponse.json({ error: "Không tìm thấy contest." }, { status: 404 });
  }

  const subs = await prisma.submission.findMany({
    where: { contestId: contest.id },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: { user: { select: { id: true, displayName: true, username: true } } },
  });

  const scoringMode = contest.scoringMode === "VNOI" ? "VNOI" : "ICPC";
  const standings = calculateContestStandings(
    {
      startAt: contest.startAt,
      scoringMode,
      problems: getContestScoringProblems(contest.problems, contest.testLimit),
    },
    subs,
  );
  const { problems, ...contestSummary } = contest;

  return NextResponse.json({
    contest: {
      ...contestSummary,
      problems: problems.map((contestProblem) => ({
        contestId: contestProblem.contestId,
        problemId: contestProblem.problemId,
        letter: contestProblem.letter,
        customTitle: contestProblem.customTitle,
        judgeType: contestProblem.judgeType,
        ioMode: contestProblem.ioMode,
        inputFile: contestProblem.inputFile,
        outputFile: contestProblem.outputFile,
        points: contestProblem.points,
      })),
    },
    standings,
  });
}
