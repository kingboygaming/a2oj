import { prisma } from "@/lib/prisma";
import type { SkillCategory } from "@/components/SkillDistribution";

export const TOPIC_DEFINITIONS = [
  {
    key: "dp",
    name: "Quy hoạch động (DP)",
    icon: "⚡",
    keywords: ["dp", "dynamic-programming", "knapsack", "qhd"],
    color: "bg-purple-500",
    bgGradient: "bg-gradient-to-r from-purple-500 to-indigo-500",
  },
  {
    key: "graph",
    name: "Đồ thị & Cây",
    icon: "🌐",
    keywords: ["graph", "graphs", "tree", "trees", "bfs", "dfs", "dijkstra", "shortest-path", "do-thi"],
    color: "bg-sky-500",
    bgGradient: "bg-gradient-to-r from-sky-500 to-cyan-500",
  },
  {
    key: "data_structures",
    name: "Cấu trúc dữ liệu",
    icon: "📊",
    keywords: ["data-structures", "ds", "segment-tree", "fenwick", "dsu", "stack", "queue", "heap"],
    color: "bg-emerald-500",
    bgGradient: "bg-gradient-to-r from-emerald-500 to-teal-500",
  },
  {
    key: "math",
    name: "Toán & Số học",
    icon: "🔢",
    keywords: ["math", "number-theory", "geometry", "combinatorics", "prime", "modulo", "toan"],
    color: "bg-amber-500",
    bgGradient: "bg-gradient-to-r from-amber-500 to-orange-500",
  },
  {
    key: "search_sort",
    name: "Tìm kiếm & Sắp xếp",
    icon: "🔍",
    keywords: ["binary-search", "search", "sorting", "sort", "two-pointers", "tim-kiem"],
    color: "bg-rose-500",
    bgGradient: "bg-gradient-to-r from-rose-500 to-pink-500",
  },
  {
    key: "greedy",
    name: "Tham lam & Ad-hoc",
    icon: "💡",
    keywords: ["greedy", "ad-hoc", "implementation", "constructive", "tham-lam"],
    color: "bg-yellow-500",
    bgGradient: "bg-gradient-to-r from-yellow-500 to-amber-500",
  },
  {
    key: "string",
    name: "Xử lý chuỗi",
    icon: "🔤",
    keywords: ["string", "strings", "kmp", "trie", "hashing", "xau-ky-tu"],
    color: "bg-teal-500",
    bgGradient: "bg-gradient-to-r from-teal-500 to-emerald-400",
  },
];

export async function getUserPersonalStatistics(userId: string) {
  const oneYearAgo = new Date();
  oneYearAgo.setDate(oneYearAgo.getDate() - 365);
  oneYearAgo.setHours(0, 0, 0, 0);

  const [submissions, allProblems, userRecord] = await Promise.all([
    prisma.submission.findMany({
      where: { userId },
      select: {
        createdAt: true,
        verdict: true,
        problemId: true,
        problem: {
          select: {
            slug: true,
            difficulty: true,
            tags: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.problem.findMany({
      where: { published: true, contestOnly: false },
      select: {
        id: true,
        tags: { select: { name: true } },
      },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { gachaTickets: true, a2Coins: true },
    }),
  ]);

  const dailyMap: Record<string, { count: number; acCount: number }> = {};
  let totalSubmissionsInYear = 0;
  const uniqueSolvedProblemIds = new Set<string>();
  const activeDaysSet = new Set<string>();

  for (const sub of submissions) {
    const dateStr = sub.createdAt.toISOString().split("T")[0];
    if (sub.createdAt >= oneYearAgo) {
      if (!dailyMap[dateStr]) {
        dailyMap[dateStr] = { count: 0, acCount: 0 };
      }
      dailyMap[dateStr].count++;
      if (sub.verdict === "AC") {
        dailyMap[dateStr].acCount++;
      }
      totalSubmissionsInYear++;
    }

    activeDaysSet.add(dateStr);
    if (sub.verdict === "AC") {
      uniqueSolvedProblemIds.add(sub.problemId);
    }
  }

  const sortedDates = [...activeDaysSet].sort();
  let longestStreak = 0;
  let tempStreak = 0;
  let prevDate: Date | null = null;

  for (const dateStr of sortedDates) {
    const curr = new Date(dateStr);
    if (!prevDate) {
      tempStreak = 1;
    } else {
      const diffDays = Math.round((curr.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
      tempStreak = diffDays === 1 ? tempStreak + 1 : 1;
    }
    if (tempStreak > longestStreak) longestStreak = tempStreak;
    prevDate = curr;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split("T")[0];
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  let currentStreak = 0;
  if (activeDaysSet.has(todayStr) || activeDaysSet.has(yesterdayStr)) {
    let checkDate = activeDaysSet.has(todayStr) ? new Date(today) : new Date(yesterday);
    while (activeDaysSet.has(checkDate.toISOString().split("T")[0])) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }
  }

  const topicTotalAvailable = new Map<string, number>();
  for (const p of allProblems) {
    const pTagNames = p.tags.map((t) => t.name.toLowerCase());
    for (const def of TOPIC_DEFINITIONS) {
      if (pTagNames.some((t) => def.keywords.some((kw) => t.includes(kw)))) {
        topicTotalAvailable.set(def.key, (topicTotalAvailable.get(def.key) ?? 0) + 1);
      }
    }
  }

  const solvedProblemTags = new Map<string, string[]>();
  for (const sub of submissions) {
    if (sub.verdict === "AC" && !solvedProblemTags.has(sub.problemId)) {
      solvedProblemTags.set(
        sub.problemId,
        sub.problem.tags.map((t) => t.name.toLowerCase())
      );
    }
  }

  const topicSolvedCounts = new Map<string, number>();
  for (const tags of solvedProblemTags.values()) {
    for (const def of TOPIC_DEFINITIONS) {
      if (tags.some((t) => def.keywords.some((kw) => t.includes(kw)))) {
        topicSolvedCounts.set(def.key, (topicSolvedCounts.get(def.key) ?? 0) + 1);
      }
    }
  }

  const skillCategories: SkillCategory[] = TOPIC_DEFINITIONS.map((def) => {
    const solved = topicSolvedCounts.get(def.key) ?? 0;
    const available = Math.max(solved, topicTotalAvailable.get(def.key) ?? 5);
    return {
      key: def.key,
      name: def.name,
      icon: def.icon,
      solvedCount: solved,
      totalAvailable: available,
      color: def.color,
      bgGradient: def.bgGradient,
    };
  });

  return {
    dailyActivity: dailyMap,
    totalSubmissions: submissions.length,
    totalSubmissionsInYear,
    totalSolved: uniqueSolvedProblemIds.size,
    currentStreak,
    longestStreak,
    activityPoints: userRecord?.gachaTickets ?? 0,
    a2Coins: userRecord?.a2Coins ?? 0,
    skillCategories,
  };
}