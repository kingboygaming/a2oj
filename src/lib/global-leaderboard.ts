import { prisma } from "@/lib/prisma";

const WRONG_VERDICTS = new Set(["WA", "TLE", "RTE", "CE", "MLE"]);
const ACM_WRONG_ATTEMPT_PENALTY = 20;

export async function getGlobalAcmLeaderboard() {
  const submissions = await prisma.submission.findMany({
    where: { contestId: null, verdict: { notIn: ["QUEUED", "RUNNING"] } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      userId: true,
      problemId: true,
      verdict: true,
      user: { select: { username: true, displayName: true, avatarMimeType: true } },
    },
  });

  type Standing = {
    userId: string;
    username: string;
    displayName: string;
    hasAvatar: boolean;
    solved: number;
    penalty: number;
  };
  type ProblemAttempts = { accepted: boolean; wrongAttempts: number };

  const standings = new Map<string, Standing>();
  const attempts = new Map<string, ProblemAttempts>();

  for (const submission of submissions) {
    const standing = standings.get(submission.userId) ?? {
      userId: submission.userId,
      username: submission.user.username,
      displayName: submission.user.displayName,
      hasAvatar: Boolean(submission.user.avatarMimeType),
      solved: 0,
      penalty: 0,
    };
    const key = `${submission.userId}:${submission.problemId}`;
    const problemAttempts = attempts.get(key) ?? { accepted: false, wrongAttempts: 0 };

    if (!problemAttempts.accepted) {
      if (submission.verdict === "AC") {
        problemAttempts.accepted = true;
        standing.solved += 1;
        standing.penalty +=
          problemAttempts.wrongAttempts * ACM_WRONG_ATTEMPT_PENALTY;
      } else if (WRONG_VERDICTS.has(submission.verdict)) {
        problemAttempts.wrongAttempts += 1;
      }
    }

    attempts.set(key, problemAttempts);
    standings.set(submission.userId, standing);
  }

  return [...standings.values()].sort(
    (left, right) =>
      right.solved - left.solved ||
      left.penalty - right.penalty ||
      left.username.localeCompare(right.username),
  );
}
