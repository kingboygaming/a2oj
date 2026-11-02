import Link from "next/link";
import { notFound } from "next/navigation";
import { ProblemSubmissionsList } from "@/components/ProblemSubmissionsList";
import { getCurrentUser } from "@/lib/auth";
import { getProblemSubmissionPage } from "@/lib/problem-submissions";
import { prisma } from "@/lib/prisma";
import { getRankColorClasses } from "@/lib/ranks";

export const dynamic = "force-dynamic";

export default async function ProblemSubmissionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; contest?: string }>;
}) {
  const [{ slug }, { page: pageParam, contest: contestParam }, user] = await Promise.all([
    params,
    searchParams,
    getCurrentUser(),
  ]);
  const problem = await prisma.problem.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      published: true,
      contestOnly: true,
      authorId: true,
      scoringMode: true,
      judgeType: true,
    },
  });
  if (!problem) notFound();

  const contestContext = contestParam
    ? await prisma.contest.findFirst({
        where: {
          OR: [{ id: contestParam }, { slug: contestParam }],
          problems: { some: { problemId: problem.id } },
        },
        select: {
          id: true,
          scoringMode: true,
          problems: {
            where: { problemId: problem.id },
            select: { judgeType: true },
          },
        },
      })
    : null;
  if (contestParam && !contestContext) notFound();

  const staff = user?.role === "TEACHER" || user?.role === "ADMIN";
  if (
    (problem.contestOnly && !staff && !contestContext) ||
    (!problem.published && !staff && user?.id !== problem.authorId)
  ) {
    notFound();
  }

  const requestedPage = Number(pageParam ?? "1");
  const { items, total, page, totalPages } = await getProblemSubmissionPage(
    problem.id,
    requestedPage,
    undefined,
    contestContext?.id ?? null,
  );
  const rankColors = await getRankColorClasses(items.map((item) => item.user.id));

  return (
    <div>
      <Link
        href={`/problems/${problem.slug}${contestParam ? `?contest=${contestParam}` : ""}`}
        className="text-sm font-medium text-[var(--teal)] hover:underline"
      >
        ← {problem.title}
      </Link>
      <header className="mt-4">
        <p className="font-mono text-xs text-[var(--muted)]">{problem.slug}</p>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--navy)]">
          Danh sách bài nộp
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {total} bài nộp{contestContext ? " trong contest" : " ngoài contest"} · trang {page}/{totalPages}. Mã nguồn chỉ hiển thị với
          chủ bài nộp và giáo viên/quản trị viên.
        </p>
      </header>
      <ProblemSubmissionsList
        submissions={items}
        rankColors={rankColors}
        problemSlug={problem.slug}
        currentPage={page}
        totalPages={totalPages}
        contestSlug={contestParam}
        showScores={
          contestContext?.scoringMode === "VNOI" ||
          (contestContext?.problems[0]?.judgeType ?? problem.judgeType) === "HEURISTIC" ||
          (!contestContext && problem.scoringMode === "VNOI")
        }
      />
    </div>
  );
}
