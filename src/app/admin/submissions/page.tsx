import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminDeleteButton } from "@/components/AdminDeleteButton";
import { VerdictBadge } from "@/components/VerdictBadge";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 50;

export default async function AdminSubmissionsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") notFound();
  const { page: pageParam } = await searchParams;
  const requestedPage = Number(pageParam ?? 1);
  const total = await prisma.submission.count();
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, totalPages) : 1;
  const submissions = await prisma.submission.findMany({
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      verdict: true,
      score: true,
      language: true,
      createdAt: true,
      user: { select: { username: true, displayName: true } },
      problem: {
        select: { slug: true, title: true, scoringMode: true, judgeType: true },
      },
      contest: { select: { title: true, scoringMode: true } },
    },
  });

  return <div>
    <Link href="/admin" className="text-sm font-medium text-[var(--teal)] hover:underline">← Quay lại quản trị</Link>
    <header className="mb-6 mt-4">
      <p className="text-sm font-medium uppercase tracking-wide text-[var(--teal)]">Quản trị bài nộp</p>
      <h1 className="mt-1 text-3xl font-semibold text-[var(--navy)]">Lịch sử bài nộp</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">{total} lượt nộp, bao gồm cả bài trong contest. Xóa bài nộp sẽ cập nhật lại các thống kê liên quan.</p>
    </header>

    {submissions.length === 0 ? <p className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-5 text-sm text-[var(--muted)]">Chưa có bài nộp nào.</p> : <>
      <div className="overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--paper)]">
        <table className="w-full min-w-[850px] text-left text-sm">
          <thead className="bg-[var(--surface-strong)] text-[var(--cream)]"><tr>
            <th className="px-3 py-2 font-medium">Thời gian</th><th className="px-3 py-2 font-medium">Người nộp</th><th className="px-3 py-2 font-medium">Bài tập / contest</th><th className="px-3 py-2 font-medium">Ngôn ngữ</th><th className="px-3 py-2 font-medium">Kết quả</th><th className="px-3 py-2 text-right font-medium">Điểm</th><th className="px-3 py-2 text-right font-medium">Thao tác</th>
          </tr></thead>
          <tbody>{submissions.map((submission) => <tr key={submission.id} className="border-t border-[var(--line)]">
            <td className="whitespace-nowrap px-3 py-2 text-xs text-[var(--muted)]">{submission.createdAt.toLocaleString("vi-VN")}</td>
            <td className="px-3 py-2"><Link href={`/users/${encodeURIComponent(submission.user.username)}`} className="font-medium text-[var(--teal)] hover:underline">{submission.user.displayName}</Link><p className="text-xs text-[var(--muted)]">@{submission.user.username}</p></td>
            <td className="px-3 py-2"><Link href={`/submissions/${submission.id}`} className="font-medium text-[var(--teal)] hover:underline">{submission.problem.slug} · {submission.problem.title}</Link>{submission.contest && <p className="text-xs text-[var(--muted)]">Contest: {submission.contest.title}</p>}</td>
            <td className="whitespace-nowrap px-3 py-2">{submission.language === "CPP" ? "C++17" : "Python 3"}</td>
            <td className="px-3 py-2"><VerdictBadge verdict={submission.verdict} /></td>
            <td className="px-3 py-2 text-right tabular-nums">{(submission.contest?.scoringMode ?? submission.problem.scoringMode) === "VNOI" || submission.problem.judgeType === "HEURISTIC" ? submission.score : "—"}</td>
            <td className="px-3 py-2"><AdminDeleteButton endpoint={`/api/admin/submissions/${submission.id}`} confirmation={`Xóa bài nộp ${submission.problem.slug} của @${submission.user.username}? Thao tác này không thể hoàn tác.`} /></td>
          </tr>)}</tbody>
        </table>
      </div>
      <nav aria-label="Phân trang bài nộp" className="mt-4 flex items-center justify-between">
        {page > 1 ? <Link href={pageHref(page - 1)} className="rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm hover:border-[var(--navy)]/40">← Trang trước</Link> : <span />}
        <span className="text-sm text-[var(--muted)]">{page} / {totalPages}</span>
        {page < totalPages ? <Link href={pageHref(page + 1)} className="rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm hover:border-[var(--navy)]/40">Trang sau →</Link> : <span />}
      </nav>
    </>}
  </div>;
}

function pageHref(page: number) {
  return page > 1 ? `/admin/submissions?page=${page}` : "/admin/submissions";
}
