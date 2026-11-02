import { getVnoiProblemScore, type ScoringMode } from "@/lib/scoring";

type ContestProblemScore = {
  problemId: string;
  points: number;
  maxTestPoints: number;
};

type ContestSubmission<User> = {
  id: string;
  userId: string;
  problemId: string;
  verdict: string;
  score: number;
  createdAt: Date;
  user?: User;
};

export type ContestStanding<User = never> = {
  userId: string;
  user?: User;
  cells: Record<
    string,
    { accepted: boolean; attempts: number; score: number; maxScore: number }
  >;
  solved: number;
  penalty: number;
  totalScore: number;
  scoreAchievedAt: Date | null;
};

export function compareContestStandings<User>(
  left: ContestStanding<User>,
  right: ContestStanding<User>,
  scoringMode: ScoringMode,
) {
  if (scoringMode === "VNOI") {
    if (left.totalScore !== right.totalScore) {
      return right.totalScore - left.totalScore;
    }
    if (left.scoreAchievedAt && right.scoreAchievedAt) {
      return left.scoreAchievedAt.getTime() - right.scoreAchievedAt.getTime();
    }
    if (left.scoreAchievedAt) return -1;
    if (right.scoreAchievedAt) return 1;
    return 0;
  }

  if (left.solved !== right.solved) return right.solved - left.solved;
  return left.penalty - right.penalty;
}

export function getContestPlace<User>(
  standings: ContestStanding<User>[],
  userId: string,
  scoringMode: ScoringMode,
) {
  const own = standings.find((row) => row.userId === userId);
  if (!own) return null;
  return (
    1 +
    standings.filter(
      (row) => compareContestStandings(row, own, scoringMode) < 0,
    ).length
  );
}

export function calculateContestStandings<User>(
  contest: {
    startAt: Date;
    scoringMode: ScoringMode;
    problems: ContestProblemScore[];
  },
  submissions: ContestSubmission<User>[],
) {
  const problemScores = new Map(
    contest.problems.map((problem) => [problem.problemId, problem]),
  );
  const standings = new Map<string, ContestStanding<User>>();

  for (const submission of [...submissions].sort(
    (left, right) =>
      left.createdAt.getTime() - right.createdAt.getTime() ||
      left.id.localeCompare(right.id),
  )) {
    let row = standings.get(submission.userId);
    if (!row) {
      row = {
        userId: submission.userId,
        ...(submission.user === undefined ? {} : { user: submission.user }),
        cells: {},
        solved: 0,
        penalty: 0,
        totalScore: 0,
        scoreAchievedAt: null,
      };
      standings.set(submission.userId, row);
    }

    const problem = problemScores.get(submission.problemId);
    const cell = row.cells[submission.problemId] ?? {
      accepted: false,
      attempts: 0,
      score: 0,
      maxScore: problem?.points ?? 100,
    };

    const alreadyAccepted = cell.accepted;
    if (!alreadyAccepted) {
      cell.attempts += 1;
      if (submission.verdict === "AC") {
        cell.accepted = true;
        row.solved += 1;
        row.penalty +=
          Math.max(
            0,
            Math.floor(
              (submission.createdAt.getTime() - contest.startAt.getTime()) /
                60000,
            ),
          ) +
          (cell.attempts - 1) * 20;
      }
    }

    if (contest.scoringMode === "VNOI" && problem && !alreadyAccepted) {
      const score =
        submission.verdict === "AC"
          ? problem.points
          : getVnoiProblemScore(
              submission.score,
              problem.maxTestPoints,
              problem.points,
            );
      if (score > cell.score) {
        row.totalScore += score - cell.score;
        cell.score = score;
        row.scoreAchievedAt = submission.createdAt;
      }
    }

    row.cells[submission.problemId] = cell;
  }

  return [...standings.values()].sort((left, right) =>
    compareContestStandings(left, right, contest.scoringMode),
  );
}
