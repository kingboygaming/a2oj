export const SCORING_MODES = ["ICPC", "VNOI"] as const;
export type ScoringMode = (typeof SCORING_MODES)[number];
export type ContestScoringProblem = {
  problemId: string;
  points: number;
  maxTestPoints: number;
  scoringMode: ScoringMode;
};

export function getTotalTestPoints(
  tests: { points: number }[],
  testLimit = 0,
) {
  const gradedTests = testLimit > 0 ? tests.slice(0, testLimit) : tests;
  return gradedTests.reduce(
    (total, test) =>
      total +
      (test.points > 0
        ? test.points
        : Math.max(10, Math.floor(100 / Math.max(gradedTests.length, 1)))),
    0,
  );
}

export function getVnoiProblemScore(
  score: number,
  maxTestPoints: number,
  problemPoints: number,
) {
  if (maxTestPoints <= 0 || problemPoints <= 0) return 0;
  return Math.round(
    (Math.max(0, Math.min(score, maxTestPoints)) / maxTestPoints) *
      problemPoints,
  );
}

export function getContestScoringProblems<
  T extends {
    problemId: string;
    points: number;
    scoringMode?: string | null;
    problem: { scoringMode?: string | null; testCases: { points: number }[] };
  },
>(problems: T[], testLimit: number): ContestScoringProblem[] {
  return problems.map((contestProblem) => ({
    problemId: contestProblem.problemId,
    points: contestProblem.points,
    scoringMode:
      contestProblem.scoringMode === "VNOI" ||
      (contestProblem.scoringMode == null && contestProblem.problem.scoringMode === "VNOI")
        ? "VNOI"
        : "ICPC",
    maxTestPoints: getTotalTestPoints(
      contestProblem.problem.testCases,
      testLimit,
    ),
  }));
}
