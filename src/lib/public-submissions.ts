import { prisma } from "@/lib/prisma";

export const PUBLIC_SUBMISSIONS_PAGE_SIZE = 50;

export async function getPublicSubmissionPage(
  requestedPage: number,
  userId?: string,
) {
  const where = userId ? { userId, contestId: null } : { contestId: null };
  const total = await prisma.submission.count({ where });
  const totalPages = Math.max(
    1,
    Math.ceil(total / PUBLIC_SUBMISSIONS_PAGE_SIZE),
  );
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? Math.min(requestedPage, totalPages)
      : 1;
  const items = await prisma.submission.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PUBLIC_SUBMISSIONS_PAGE_SIZE,
    take: PUBLIC_SUBMISSIONS_PAGE_SIZE,
    select: {
      id: true,
      language: true,
      verdict: true,
      score: true,
      timeMs: true,
      createdAt: true,
      user: { select: { id: true, displayName: true, username: true } },
      problem: {
        select: { slug: true, title: true, scoringMode: true, judgeType: true },
      },
    },
  });

  return { items, page, totalPages, total };
}
