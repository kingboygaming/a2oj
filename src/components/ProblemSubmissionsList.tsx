import Link from "next/link";
import { VerdictBadge } from "@/components/VerdictBadge";
import type { getProblemSubmissionPage } from "@/lib/problem-submissions";

type SubmissionPage = Awaited<ReturnType<typeof getProblemSubmissionPage>>;

export function ProblemSubmissionsList({
  submissions,
  problemSlug,
  currentPage,
  totalPages,
  showPagination = true,
}: {
  submissions: SubmissionPage["items"];
  problemSlug: string;
  currentPage: number;
  totalPages: number;
  showPagination?: boolean;
}) {
  if (submissions.length === 0) {
    return (
      <div className="mt-4 rounded-lg border border-[var(--line)] bg-[var(--paper)] p-5 text-center text-sm text-[var(--muted)]">
        Bài tập này chưa có bài nộp nào.
      </div>
    );
  }

  return (
    <>
      <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--paper)]">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="bg-[var(--surface-strong)] text-[var(--cream)]">
            <tr>
              <th className="px-3 py-2 font-medium">Thời gian</th>
              <th className="px-3 py-2 font-medium">Thí sinh</th>
              <th className="px-3 py-2 font-medium">Ngôn ngữ</th>
              <th className="px-3 py-2 font-medium">Kết quả</th>
              <th className="px-3 py-2 text-right font-medium">Điểm</th>
              <th className="px-3 py-2 text-right font-medium">Thời gian chạy</th>
              <th className="px-3 py-2 text-right font-medium">Chi tiết</th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((submission) => (
              <tr key={submission.id} className="border-t border-[var(--line)]">
                <td className="whitespace-nowrap px-3 py-2 text-xs text-[var(--muted)]">
                  {submission.createdAt.toLocaleString("vi-VN")}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  {submission.user.displayName}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  {submission.language === "CPP" ? "C++17" : "Python 3"}
                </td>
                <td className="px-3 py-2">
                  <VerdictBadge verdict={submission.verdict} />
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {submission.score}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {submission.timeMs === null ? "—" : `${submission.timeMs} ms`}
                </td>
                <td className="px-3 py-2 text-right">
                  <Link
                    href={`/submissions/${submission.id}`}
                    className="font-medium text-[var(--teal)] hover:underline"
                  >
                    Xem
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showPagination && totalPages > 1 && (
        <nav
          aria-label="Phân trang bài nộp của bài tập"
          className="mt-4 flex items-center justify-between"
        >
          {currentPage > 1 ? (
            <Link
              href={`/problems/${problemSlug}/submissions?page=${currentPage - 1}`}
              className="rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm hover:border-[var(--navy)]/40"
            >
              ← Trang trước
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm text-[var(--muted)]">
            Trang {currentPage} / {totalPages}
          </span>
          {currentPage < totalPages ? (
            <Link
              href={`/problems/${problemSlug}/submissions?page=${currentPage + 1}`}
              className="rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm hover:border-[var(--navy)]/40"
            >
              Trang sau →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}
