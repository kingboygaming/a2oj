import Link from "next/link";
import { notFound } from "next/navigation";
import { ProblemSubmissionsList } from "@/components/ProblemSubmissionsList";
import { getCurrentUser } from "@/lib/auth";
import { getProblemSubmissionPage } from "@/lib/problem-submissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ProblemSubmissionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const [{ slug }, { page: pageParam }, user] = await Promise.all([
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
    },
  });
  if (!problem) notFound();

  const staff = user?.role === "TEACHER" || user?.role === "ADMIN";
  if (
    (problem.contestOnly && !staff) ||
    (!problem.published && !staff && user?.id !== problem.authorId)
  ) {
    notFound();
  }

  const requestedPage = Number(pageParam ?? "1");
  const { items, total, page, totalPages } = await getProblemSubmissionPage(
    problem.id,
    requestedPage,
  );

  return (
    <div>
      <Link
        href={`/problems/${problem.slug}`}
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
          {total} bài nộp · trang {page}/{totalPages}. Mã nguồn chỉ hiển thị với
          chủ bài nộp và giáo viên/quản trị viên.
        </p>
      </header>
      <ProblemSubmissionsList
        submissions={items}
        problemSlug={problem.slug}
        currentPage={page}
        totalPages={totalPages}
      />
    </div>
  );
}
