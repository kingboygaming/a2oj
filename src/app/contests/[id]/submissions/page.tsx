import Link from "next/link";
import { notFound } from "next/navigation";
import { ContestNavigation } from "@/components/ContestNavigation";
import { VerdictBadge } from "@/components/VerdictBadge";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 50;

export default async function ContestSubmissionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const [{ id }, { page: pageParam }] = await Promise.all([params, searchParams]);
  const contest = await prisma.contest.findFirst({
    where: { OR: [{ slug: id }, { id }] },
    include: { problems: { select: { problemId: true, letter: true, customTitle: true, problem: { select: { slug: true, title: true } } } } },
  });
  if (!contest) notFound();

  const total = await prisma.submission.count({ where: { contestId: contest.id } });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const parsedPage = Number(pageParam ?? "1");
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0
    ? Math.min(parsedPage, totalPages)
    : 1;
  const submissions = await prisma.submission.findMany({
    where: { contestId: contest.id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: {
      user: { select: { username: true, displayName: true } },
      problem: { select: { slug: true, title: true } },
    },
  });
  const contestProblems = new Map(contest.problems.map((item) => [item.problemId, item]));

  return (
    <div>
      <p className="text-sm text-[var(--teal)]">Contest</p>
      <h1 className="text-2xl font-semibold text-[var(--navy)]">{contest.title}</h1>
      <ContestNavigation slug={contest.slug} active="submissions" />
      <h2 className="mt-5 text-xl font-semibold text-[var(--navy)]">Lịch sử bài nộp</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">{total} lượt nộp · trang {page}/{totalPages}</p>
      <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--paper)]">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="bg-[var(--surface-strong)] text-[var(--cream)]">
            <tr>
              <th className="px-3 py-2">Thời gian</th>
              <th className="px-3 py-2">Thí sinh</th>
              <th className="px-3 py-2">Bài</th>
              <th className="px-3 py-2">Ngôn ngữ</th>
              <th className="px-3 py-2">Kết quả</th>
              <th className="px-3 py-2 text-right">Điểm</th>
              <th className="px-3 py-2 text-right">Thời gian chạy</th>
            </tr>
          </thead>
          <tbody>
            {submissions.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-[var(--muted)]">Chưa có bài nộp trong contest.</td></tr>
            ) : submissions.map((submission) => {
              const contestProblem = contestProblems.get(submission.problemId);
              return (
                <tr key={submission.id} className="border-t border-[var(--line)]">
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-[var(--muted)]">{submission.createdAt.toLocaleString("vi-VN")}</td>
                  <td className="whitespace-nowrap px-3 py-2"><Link href={`/users/${encodeURIComponent(submission.user.username)}`} className="hover:text-[var(--teal)] hover:underline">{submission.user.displayName}</Link></td>
                  <td className="px-3 py-2"><Link href={`/problems/${submission.problem.slug}`} className="font-medium text-[var(--teal)] hover:underline">{contestProblem?.letter}. {contestProblem?.customTitle || submission.problem.title}</Link></td>
                  <td className="whitespace-nowrap px-3 py-2">{submission.language === "CPP" ? "C++17" : "Python 3"}</td>
                  <td className="px-3 py-2"><Link href={`/submissions/${submission.id}`}><VerdictBadge verdict={submission.verdict} /></Link></td>
                  <td className="px-3 py-2 text-right tabular-nums">{submission.score}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{submission.timeMs === null ? "—" : `${submission.timeMs} ms`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && <nav className="mt-4 flex justify-between text-sm" aria-label="Phân trang bài nộp contest">
        {page > 1 ? <Link href={`?page=${page - 1}`} className="text-[var(--teal)] hover:underline">← Trang trước</Link> : <span />}
        <span className="text-[var(--muted)]">{page}/{totalPages}</span>
        {page < totalPages ? <Link href={`?page=${page + 1}`} className="text-[var(--teal)] hover:underline">Trang sau →</Link> : <span />}
      </nav>}
    </div>
  );
}
