import { prisma } from "@/lib/prisma";

export const PROBLEM_SUBMISSIONS_PAGE_SIZE = 50;

export async function getProblemSubmissionPage(
  problemId: string,
  requestedPage: number,
  pageSize = PROBLEM_SUBMISSIONS_PAGE_SIZE,
  contestId: string | null = null,
) {
  const where = { problemId, contestId };
  const total = await prisma.submission.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? Math.min(requestedPage, totalPages)
      : 1;
  const items = await prisma.submission.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: {
      id: true,
      language: true,
      verdict: true,
      score: true,
      timeMs: true,
      createdAt: true,
      user: { select: { id: true, displayName: true } },
    },
  });

  return { items, page, totalPages, total };
}
