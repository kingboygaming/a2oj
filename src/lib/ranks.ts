import { prisma } from "@/lib/prisma";
import { RANK_NAME_COLORS, ACHIEVEMENT_COLOR_CLASSES } from "@/lib/rank-colors";
import type { Achievement } from "@prisma/client";

export const RANKS = [
  { name: "Newbie", min: 0, color: RANK_NAME_COLORS.Newbie, badge: "⚪" },
  { name: "Pupil", min: 100, color: RANK_NAME_COLORS.Pupil, badge: "🟢" },
  { name: "Specialist", min: 200, color: RANK_NAME_COLORS.Specialist, badge: "🔵" },
  { name: "Expert", min: 500, color: RANK_NAME_COLORS.Expert, badge: "🟣" },
  { name: "Candidate Master", min: 1000, color: RANK_NAME_COLORS["Candidate Master"], badge: "🟠" },
  { name: "Master", min: 2500, color: RANK_NAME_COLORS.Master, badge: "🔴" },
  { name: "Grandmaster", min: 5000, color: RANK_NAME_COLORS.Grandmaster, badge: "🔴" },
  { name: "Legend", min: 10000, color: RANK_NAME_COLORS.Legend, badge: "💠" },
] as const;

export type RankBadge = {
  key: string;
  title: string;
  description: string;
  icon: string;
  rarity: string;
  earned: boolean;
  achievementId?: string;
  nameColorEnabled?: boolean;
  nameColor?: string | null;
};

export async function recordNewAchievementUnlocks(userId: string, badges: RankBadge[]) {
  const earnedBadges = badges.filter((badge) => badge.earned);

  return prisma.$transaction(async (transaction) => {
    const user = await transaction.user.findUniqueOrThrow({
      where: { id: userId },
      select: { achievementNotificationsInitialized: true },
    });
    const firstVisit = !user.achievementNotificationsInitialized;
    // Updating this row serializes concurrent page requests for the same user
    // before checking and inserting one-time unlock records.
    await transaction.user.update({
      where: { id: userId },
      data: { achievementNotificationsInitialized: true },
    });
    if (!earnedBadges.length) return [] as RankBadge[];
    const existing = await transaction.achievementUnlock.findMany({
      where: { userId, achievementKey: { in: earnedBadges.map((badge) => badge.key) } },
      select: { achievementKey: true },
    });
    const existingKeys = new Set(existing.map((item) => item.achievementKey));
    const newlyEarned: RankBadge[] = [];
    for (const badge of earnedBadges) {
      if (existingKeys.has(badge.key)) continue;
      try {
        await transaction.achievementUnlock.create({ data: { userId, achievementKey: badge.key } });
        if (!firstVisit) newlyEarned.push(badge);
      } catch (error) {
        if (!(typeof error === "object" && error !== null && "code" in error && error.code === "P2002")) throw error;
      }
    }
    return newlyEarned;
  });
}

type AchievementProgress = {
  solvedCount: number;
  solvedSlugs: Set<string>;
  contestCount: number;
  podiumCount: number;
  winCount: number;
  waCount: number;
  ceStreak: number;
  points: number;
  cePenalty: number;
  heuristicScores: Map<string, number>;
};

const MAX_CE_PENALTY = 1_000_000_000;

function cePenaltyForStreak(streak: number) {
  return Math.min(MAX_CE_PENALTY, 10 * 2 ** Math.min(streak - 1, 26));
}

export function getRankFromPoints(points: number) {
  for (let i = RANKS.length - 1; i >= 0; i -= 1) {
    if (points >= RANKS[i].min) return { rank: RANKS[i], rankIndex: i, nextRank: RANKS[i + 1] };
  }
  return { rank: RANKS[0], rankIndex: 0, nextRank: RANKS[1] };
}

export function achievementIsEarned(achievement: Pick<Achievement, "triggerType" | "threshold" | "problemSlug">, progress: AchievementProgress) {
  switch (achievement.triggerType) {
    case "SOLVED_PROBLEMS": return progress.solvedCount >= achievement.threshold;
    case "CONTESTS": return progress.contestCount >= achievement.threshold;
    case "CONTEST_PODIUMS": return progress.podiumCount >= achievement.threshold;
    case "CONTEST_WINS": return progress.winCount >= achievement.threshold;
    case "RANK_POINTS": return progress.points >= achievement.threshold;
    case "WRONG_ANSWERS": return progress.waCount >= achievement.threshold;
    case "CE_STREAK": return progress.ceStreak >= achievement.threshold;
    case "PROBLEM_AC": return Boolean(achievement.problemSlug && progress.solvedSlugs.has(achievement.problemSlug));
    case "HEURISTIC_SCORE": {
      const score = achievement.problemSlug
        ? progress.heuristicScores.get(achievement.problemSlug) ?? 0
        : Math.max(0, ...progress.heuristicScores.values());
      return score >= achievement.threshold;
    }
    default: return false;
  }
}

async function getHeuristicTotalPoints(problemIds: string[]) {
  const ids = [...new Set(problemIds)];
  if (!ids.length) return new Map<string, number>();
  const totals = await prisma.testCase.groupBy({
    by: ["problemId"],
    where: { problemId: { in: ids } },
    _sum: { points: true },
  });
  return new Map(totals.map((item) => [item.problemId, item._sum.points ?? 0]));
}

async function getLongestCeStreak(userId: string) {
  const attempts = await prisma.submission.findMany({
    where: { userId, verdict: { notIn: ["QUEUED", "RUNNING"] } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { verdict: true },
  });
  let current = 0;
  let longest = 0;
  for (const attempt of attempts) {
    current = attempt.verdict === "CE" ? current + 1 : 0;
    longest = Math.max(longest, current);
  }
  return longest;
}

export async function getRankColorClasses(userIds: string[]) {
  const ids = [...new Set(userIds)];
  if (!ids.length) return {} as Record<string, string>;
  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, role: true, nameColorMode: true, nameColorAchievementId: true } });
  const progress = new Map<string, AchievementProgress>(ids.map((id) => [id, { solvedCount: 0, solvedSlugs: new Set(), contestCount: 0, podiumCount: 0, winCount: 0, waCount: 0, ceStreak: 0, points: 0, cePenalty: 0, heuristicScores: new Map() }]));
  const practiceSubmissions = await prisma.submission.findMany({
    where: { userId: { in: ids }, contestId: null, verdict: { notIn: ["QUEUED", "RUNNING"] } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { userId: true, problemId: true, verdict: true, problem: { select: { slug: true, difficulty: true } } },
  });
  const solved = new Set<string>();
  const ceStreaks = new Map<string, number>();
  for (const sub of practiceSubmissions) {
    const key = `${sub.userId}:${sub.problemId}`;
    const p = progress.get(sub.userId)!;
    if (sub.verdict === "CE") {
      const streak = (ceStreaks.get(key) ?? 0) + 1;
      ceStreaks.set(key, streak);
      p.cePenalty = Math.min(MAX_CE_PENALTY, p.cePenalty + cePenaltyForStreak(streak));
    } else {
      ceStreaks.delete(key);
      if (sub.verdict === "AC" && !solved.has(key)) {
        solved.add(key);
        p.solvedCount += 1;
        p.solvedSlugs.add(sub.problem.slug);
        p.points += sub.problem.difficulty === "EASY" ? 3 : sub.problem.difficulty === "MEDIUM" ? 8 : 15;
      }
    }
  }

  const contests = await prisma.contest.findMany({
    where: { endAt: { lte: new Date() }, submissions: { some: { userId: { in: ids } } } },
    select: { startAt: true, rankPointsEnabled: true, submissions: { orderBy: { createdAt: "asc" }, select: { userId: true, problemId: true, verdict: true, createdAt: true } } },
  });
  for (const contest of contests) {
    type Cell = { accepted: boolean; attempts: number };
    type Row = { solved: number; penalty: number; cells: Map<string, Cell> };
    const standings = new Map<string, Row>();
    for (const sub of contest.submissions) {
      const row = standings.get(sub.userId) ?? { solved: 0, penalty: 0, cells: new Map() };
      const cell = row.cells.get(sub.problemId) ?? { accepted: false, attempts: 0 };
      if (!cell.accepted) {
        cell.attempts += 1;
        if (sub.verdict === "AC") {
          cell.accepted = true;
          row.solved += 1;
          row.penalty += Math.max(0, Math.floor((sub.createdAt.getTime() - contest.startAt.getTime()) / 60000)) + (cell.attempts - 1) * 20;
        }
      }
      row.cells.set(sub.problemId, cell);
      standings.set(sub.userId, row);
    }
    for (const [id, own] of standings) {
      const p = progress.get(id);
      if (!p) continue;
      p.contestCount += 1;
      if (!contest.rankPointsEnabled || own.solved === 0) continue;
      const place = 1 + [...standings.values()].filter((row) => row.solved > own.solved || (row.solved === own.solved && row.penalty < own.penalty)).length;
      const reward = place === 1 ? 100 : place === 2 ? 70 : place === 3 ? 50 : 0;
      if (reward) p.points += reward;
      if (place <= 3) p.podiumCount += 1;
      if (place === 1) p.winCount += 1;
    }
  }

  for (const p of progress.values()) p.points -= p.cePenalty;

  const selectedAchievementIds = users.flatMap((user) => user.nameColorMode === "ACHIEVEMENT" && user.nameColorAchievementId ? [user.nameColorAchievementId] : []);
  const selectedAchievements = selectedAchievementIds.length ? await prisma.achievement.findMany({ where: { id: { in: selectedAchievementIds }, nameColorEnabled: true } }) : [];
  const achievementsById = new Map(selectedAchievements.map((achievement) => [achievement.id, achievement]));
  if (selectedAchievements.some((achievement) => achievement.triggerType === "WRONG_ANSWERS")) {
    const waCounts = await prisma.submission.groupBy({
      by: ["userId"],
      where: { userId: { in: ids }, verdict: "WA" },
      _count: { _all: true },
    });
    for (const item of waCounts) {
      const p = progress.get(item.userId);
      if (p) p.waCount = item._count._all;
    }
  }
  if (selectedAchievements.some((achievement) => achievement.triggerType === "CE_STREAK")) {
    const attempts = await prisma.submission.findMany({
      where: { userId: { in: ids }, verdict: { notIn: ["QUEUED", "RUNNING"] } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { userId: true, verdict: true },
    });
    const streaks = new Map<string, { current: number; max: number }>();
    for (const attempt of attempts) {
      const streak = streaks.get(attempt.userId) ?? { current: 0, max: 0 };
      streak.current = attempt.verdict === "CE" ? streak.current + 1 : 0;
      streak.max = Math.max(streak.max, streak.current);
      streaks.set(attempt.userId, streak);
    }
    for (const [id, streak] of streaks) {
      const p = progress.get(id);
      if (p) p.ceStreak = streak.max;
    }
  }
  if (selectedAchievements.some((achievement) => achievement.triggerType === "HEURISTIC_SCORE")) {
    const heuristicScores = await prisma.submission.findMany({
      where: { userId: { in: ids }, verdict: { notIn: ["QUEUED", "RUNNING"] }, problem: { judgeType: "HEURISTIC" } },
      select: { userId: true, problemId: true, score: true, problem: { select: { slug: true } } },
    });
    const totalPoints = await getHeuristicTotalPoints(heuristicScores.map((submission) => submission.problemId));
    for (const sub of heuristicScores) {
      const p = progress.get(sub.userId)!;
      const total = totalPoints.get(sub.problemId) ?? 0;
      const percentage = total > 0 ? (sub.score / total) * 100 : 0;
      p.heuristicScores.set(sub.problem.slug, Math.max(p.heuristicScores.get(sub.problem.slug) ?? 0, percentage));
    }
  }

  return Object.fromEntries(users.map((user) => {
    const p = progress.get(user.id)!;
    const achievement = user.nameColorAchievementId ? achievementsById.get(user.nameColorAchievementId) : undefined;
    const customColor = achievement && achievementIsEarned(achievement, p) && achievement.nameColor
      ? ACHIEVEMENT_COLOR_CLASSES[achievement.nameColor]
      : undefined;
    return [user.id, customColor || (user.role === "ADMIN" ? RANK_NAME_COLORS.Admin : getRankFromPoints(p.points).rank.color)];
  }));
}

export async function getUserRankSummary(userId: string) {
  const [user, practiceSubmissions] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { role: true, nameColorMode: true, nameColorAchievementId: true } }),
    prisma.submission.findMany({
      where: { userId, contestId: null, verdict: { notIn: ["QUEUED", "RUNNING"] } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { problemId: true, verdict: true, problem: { select: { slug: true, difficulty: true } } },
    }),
  ]);
  const firstSolveByProblem = new Map<string, (typeof practiceSubmissions)[number]>();
  const ceStreaks = new Map<string, number>();
  let cePenalty = 0;
  for (const submission of practiceSubmissions) {
    if (submission.verdict === "CE") {
      const streak = (ceStreaks.get(submission.problemId) ?? 0) + 1;
      ceStreaks.set(submission.problemId, streak);
      cePenalty = Math.min(MAX_CE_PENALTY, cePenalty + cePenaltyForStreak(streak));
    } else {
      ceStreaks.delete(submission.problemId);
      if (submission.verdict === "AC" && !firstSolveByProblem.has(submission.problemId)) {
        firstSolveByProblem.set(submission.problemId, submission);
      }
    }
  }
  const solvedSlugs = new Set([...firstSolveByProblem.values()].map((submission) => submission.problem.slug));
  const solvedCount = firstSolveByProblem.size;
  let problemPoints = 0;
  for (const submission of firstSolveByProblem.values()) problemPoints += submission.problem.difficulty === "EASY" ? 3 : submission.problem.difficulty === "MEDIUM" ? 8 : 15;

  const completedContests = await prisma.contest.findMany({
    where: { endAt: { lte: new Date() }, submissions: { some: { userId } } },
    include: { submissions: { orderBy: { createdAt: "asc" }, select: { userId: true, problemId: true, verdict: true, createdAt: true } } },
  });
  let contestPoints = 0;
  let podiumCount = 0;
  let wins = 0;
  for (const contest of completedContests) {
    if (!contest.rankPointsEnabled) continue;
    type Row = { solved: number; penalty: number; cells: Map<string, { accepted: boolean; attempts: number }> };
    const standings = new Map<string, Row>();
    for (const sub of contest.submissions) {
      const row = standings.get(sub.userId) ?? { solved: 0, penalty: 0, cells: new Map() };
      const cell = row.cells.get(sub.problemId) ?? { accepted: false, attempts: 0 };
      if (!cell.accepted) {
        cell.attempts += 1;
        if (sub.verdict === "AC") {
          cell.accepted = true; row.solved += 1;
          row.penalty += Math.max(0, Math.floor((sub.createdAt.getTime() - contest.startAt.getTime()) / 60000)) + (cell.attempts - 1) * 20;
        }
      }
      row.cells.set(sub.problemId, cell); standings.set(sub.userId, row);
    }
    const own = standings.get(userId);
    if (!own || own.solved === 0) continue;
    const place = 1 + [...standings.values()].filter((row) => row.solved > own.solved || (row.solved === own.solved && row.penalty < own.penalty)).length;
    if (place === 1) { contestPoints += 100; wins += 1; podiumCount += 1; }
    else if (place === 2) { contestPoints += 70; podiumCount += 1; }
    else if (place === 3) { contestPoints += 50; podiumCount += 1; }
  }

  cePenalty = Math.min(MAX_CE_PENALTY, cePenalty);
  const points = problemPoints + contestPoints - cePenalty;
  const { rank, rankIndex, nextRank } = getRankFromPoints(points);
  const badges: RankBadge[] = [
    { key: "first-ac", title: "AC đầu tiên", description: "Giải bài tập đầu tiên.", icon: "🎯", rarity: "COMMON", earned: solvedCount >= 1 },
    { key: "solver-10", title: "Thợ giải bài", description: "Giải 10 bài khác nhau.", icon: "🧩", rarity: "UNCOMMON", earned: solvedCount >= 10 },
    { key: "solver-50", title: "Bền bỉ", description: "Giải 50 bài khác nhau.", icon: "🔥", rarity: "RARE", earned: solvedCount >= 50 },
    { key: "solver-100", title: "Bách chiến", description: "Giải 100 bài khác nhau.", icon: "💯", rarity: "EPIC", earned: solvedCount >= 100 },
    { key: "contest-first", title: "Vào cuộc", description: "Nộp bài trong một contest đã kết thúc.", icon: "🏁", rarity: "COMMON", earned: completedContests.length > 0 },
    { key: "contest-5", title: "Thí sinh chăm chỉ", description: "Tham gia 5 contest đã kết thúc.", icon: "🎟️", rarity: "UNCOMMON", earned: completedContests.length >= 5 },
    { key: "contest-podium", title: "Lên bục", description: "Đạt top 3 ở một contest.", icon: "🏆", rarity: "RARE", earned: podiumCount > 0 },
    { key: "contest-podium-3", title: "Sưu tập huy chương", description: "Đạt top 3 ở 3 contest được tính rank.", icon: "🏅", rarity: "EPIC", earned: podiumCount >= 3 },
    { key: "contest-champion", title: "Quán quân", description: "Đứng đầu một contest.", icon: "🥇", rarity: "LEGENDARY", earned: wins > 0 },
  ];

  const heuristicSubmissions = await prisma.submission.findMany({
    where: { userId, verdict: { notIn: ["QUEUED", "RUNNING"] }, problem: { judgeType: "HEURISTIC", achievementBadgeTitle: { not: null } } },
    orderBy: { score: "desc" }, distinct: ["problemId"],
    select: { problemId: true, score: true, problem: { select: { slug: true, achievementBadgeTitle: true, achievementBadgeDescription: true, achievementScoreThreshold: true } } },
  });
  for (const sub of heuristicSubmissions) {
    const threshold = sub.problem.achievementScoreThreshold ?? 90;
    badges.push({ key: `heuristic-${sub.problemId}`, title: sub.problem.achievementBadgeTitle ?? "Điểm heuristic cao", description: sub.problem.achievementBadgeDescription || `Đạt ít nhất ${threshold} điểm ở bài heuristic này.`, icon: "🎯", rarity: "RARE", earned: sub.score >= threshold });
  }

  const heuristicAll = await prisma.submission.findMany({
    where: { userId, verdict: { notIn: ["QUEUED", "RUNNING"] }, problem: { judgeType: "HEURISTIC" } },
    select: { problemId: true, score: true, problem: { select: { slug: true } } },
  });
  const heuristicTotalPoints = await getHeuristicTotalPoints(heuristicAll.map((submission) => submission.problemId));
  const heuristicScores = new Map<string, number>();
  for (const sub of heuristicAll) {
    const total = heuristicTotalPoints.get(sub.problemId) ?? 0;
    const percentage = total > 0 ? (sub.score / total) * 100 : 0;
    heuristicScores.set(sub.problem.slug, Math.max(heuristicScores.get(sub.problem.slug) ?? 0, percentage));
  }
  const customAchievements = await prisma.achievement.findMany({ orderBy: { createdAt: "desc" } });
  const waCount = customAchievements.some((achievement) => achievement.triggerType === "WRONG_ANSWERS")
    ? await prisma.submission.count({ where: { userId, verdict: "WA" } })
    : 0;
  const ceStreak = customAchievements.some((achievement) => achievement.triggerType === "CE_STREAK")
    ? await getLongestCeStreak(userId)
    : 0;
  const progress: AchievementProgress = { solvedCount, solvedSlugs, contestCount: completedContests.length, podiumCount, winCount: wins, waCount, ceStreak, points, cePenalty, heuristicScores };
  const customBadges = customAchievements.flatMap((achievement) => {
    const earned = achievementIsEarned(achievement, progress);
    if (achievement.secret && !earned) return [];
    return [{ key: `achievement-${achievement.id}`, title: achievement.title, description: achievement.description, icon: achievement.icon, rarity: achievement.rarity, earned, achievementId: achievement.id, nameColorEnabled: achievement.nameColorEnabled, nameColor: achievement.nameColor }];
  });
  badges.push(...customBadges);
  const selectedAchievement = customAchievements.find((achievement) => achievement.id === user.nameColorAchievementId);
  const nameColor = user.nameColorMode === "ACHIEVEMENT" && selectedAchievement && achievementIsEarned(selectedAchievement, progress) && selectedAchievement.nameColorEnabled
    ? ACHIEVEMENT_COLOR_CLASSES[selectedAchievement.nameColor ?? ""]
    : user.role === "ADMIN" ? RANK_NAME_COLORS.Admin : rank.color;

  return {
    points, problemPoints, contestPoints, cePenalty, solvedCount, contestCount: completedContests.length,
    rank, rankIndex, nextRank, badges, nameColorMode: user.nameColorMode,
    nameColorAchievementId: user.nameColorAchievementId, nameColor,
  };
}
