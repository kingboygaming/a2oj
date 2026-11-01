import { prisma } from "@/lib/prisma";

export const RANKS = [
  { name: "Newbie", min: 0, color: "text-slate-500", badge: "⚪" },
  { name: "Pupil", min: 100, color: "text-emerald-600", badge: "🟢" },
  { name: "Specialist", min: 200, color: "text-cyan-600", badge: "🔵" },
  { name: "Expert", min: 500, color: "text-violet-600", badge: "🟣" },
  { name: "Candidate Master", min: 1000, color: "text-amber-600", badge: "🟠" },
  { name: "Master", min: 2500, color: "text-orange-600", badge: "🔴" },
  { name: "Grandmaster", min: 5000, color: "text-rose-600", badge: "🔴" },
  { name: "Legend", min: 10000, color: "text-fuchsia-600", badge: "💠" },
] as const;

export type RankBadge = { key: string; title: string; description: string; icon: string; earned: boolean };

export async function getUserRankSummary(userId: string) {
  const accepted = await prisma.submission.findMany({
    where: { userId, verdict: "AC" },
    orderBy: { createdAt: "asc" },
    select: { problemId: true, contestId: true, problem: { select: { difficulty: true } } },
  });
  const firstSolveByProblem = new Map<string, (typeof accepted)[number]>();
  for (const submission of accepted) {
    if (!firstSolveByProblem.has(submission.problemId)) firstSolveByProblem.set(submission.problemId, submission);
  }
  const solvedCount = firstSolveByProblem.size;
  let problemPoints = 0;
  for (const submission of firstSolveByProblem.values()) {
    problemPoints += submission.problem.difficulty === "EASY" ? 3 : submission.problem.difficulty === "MEDIUM" ? 8 : 15;
  }

  const completedContests = await prisma.contest.findMany({
    where: { endAt: { lte: new Date() }, submissions: { some: { userId } } },
    include: {
      problems: { select: { problemId: true, points: true } },
      submissions: { orderBy: { createdAt: "asc" }, select: { userId: true, problemId: true, verdict: true, createdAt: true } },
    },
  });

  let contestPoints = 0;
  let podiumCount = 0;
  let wins = 0;
  for (const contest of completedContests) {
    if (!contest.rankPointsEnabled) continue;
    type Row = { solved: number; penalty: number; cells: Map<string, { accepted: boolean; attempts: number }> };
    const standings = new Map<string, Row>();
    for (const submission of contest.submissions) {
      const row = standings.get(submission.userId) ?? { solved: 0, penalty: 0, cells: new Map() };
      const cell = row.cells.get(submission.problemId) ?? { accepted: false, attempts: 0 };
      if (!cell.accepted) {
        cell.attempts += 1;
        if (submission.verdict === "AC") {
          cell.accepted = true;
          row.solved += 1;
          row.penalty += Math.max(0, Math.floor((submission.createdAt.getTime() - contest.startAt.getTime()) / 60000)) + (cell.attempts - 1) * 20;
        }
      }
      row.cells.set(submission.problemId, cell);
      standings.set(submission.userId, row);
    }
    const rows = [...standings.entries()].sort(([, a], [, b]) => b.solved - a.solved || a.penalty - b.penalty);
    const ownRow = rows.find(([id]) => id === userId)?.[1];
    if (!ownRow || ownRow.solved === 0) continue;
    const place = 1 + rows.filter(([, row]) => row.solved > ownRow.solved || (row.solved === ownRow.solved && row.penalty < ownRow.penalty)).length;
    if (place === 1) { contestPoints += 100; wins += 1; podiumCount += 1; }
    else if (place === 2) { contestPoints += 70; podiumCount += 1; }
    else if (place === 3) { contestPoints += 50; podiumCount += 1; }
  }

  const points = problemPoints + contestPoints;
  let rankIndex = RANKS.length - 1;
  for (let i = RANKS.length - 1; i >= 0; i -= 1) {
    if (points >= RANKS[i].min) { rankIndex = i; break; }
  }
  const rank = RANKS[rankIndex];
  const nextRank = RANKS[rankIndex + 1];
  const badges: RankBadge[] = [
    { key: "first-ac", title: "AC đầu tiên", description: "Giải bài tập đầu tiên.", icon: "🎯", earned: solvedCount >= 1 },
    { key: "solver-10", title: "Thợ giải bài", description: "Giải 10 bài khác nhau.", icon: "🧩", earned: solvedCount >= 10 },
    { key: "solver-50", title: "Bền bỉ", description: "Giải 50 bài khác nhau.", icon: "🔥", earned: solvedCount >= 50 },
    { key: "solver-100", title: "Bách chiến", description: "Giải 100 bài khác nhau.", icon: "💯", earned: solvedCount >= 100 },
    { key: "contest-first", title: "Vào cuộc", description: "Nộp bài trong một contest đã kết thúc.", icon: "🏁", earned: completedContests.length > 0 },
    { key: "contest-5", title: "Thí sinh chăm chỉ", description: "Tham gia 5 contest đã kết thúc.", icon: "🎟️", earned: completedContests.length >= 5 },
    { key: "contest-podium", title: "Lên bục", description: "Đạt top 3 ở một contest.", icon: "🏆", earned: podiumCount > 0 },
    { key: "contest-podium-3", title: "Sưu tập huy chương", description: "Đạt top 3 ở 3 contest được tính rank.", icon: "🏅", earned: podiumCount >= 3 },
    { key: "contest-champion", title: "Quán quân", description: "Đứng đầu một contest.", icon: "🥇", earned: wins > 0 },
  ];

  const heuristicSubmissions = await prisma.submission.findMany({
    where: { userId, verdict: { notIn: ["QUEUED", "RUNNING"] }, problem: { judgeType: "HEURISTIC", achievementBadgeTitle: { not: null } } },
    orderBy: { score: "desc" },
    distinct: ["problemId"],
    select: { problemId: true, score: true, problem: { select: { achievementBadgeTitle: true, achievementBadgeDescription: true, achievementScoreThreshold: true } } },
  });
  for (const submission of heuristicSubmissions) {
    const threshold = submission.problem.achievementScoreThreshold ?? 90;
    badges.push({
      key: `heuristic-${submission.problemId}`,
      title: submission.problem.achievementBadgeTitle ?? "Điểm heuristic cao",
      description: submission.problem.achievementBadgeDescription || `Đạt ít nhất ${threshold} điểm ở bài heuristic này.`,
      icon: "🎯",
      earned: submission.score >= threshold,
    });
  }

  return { points, problemPoints, contestPoints, solvedCount, contestCount: completedContests.length, rank, rankIndex, nextRank, badges };
}
