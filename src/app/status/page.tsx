import Link from "next/link";
import { VerdictBadge } from "@/components/VerdictBadge";
import { SubmissionScopeToggle } from "@/components/SubmissionScopeToggle";
import { EmptyState } from "@/components/EmptyState";
import { getCurrentUser } from "@/lib/auth";
import {
  getPublicSubmissionPage,
  PUBLIC_SUBMISSIONS_PAGE_SIZE,
} from "@/lib/public-submissions";
import { getRankColorClasses } from "@/lib/ranks";

export const dynamic = "force-dynamic";

export default async function PublicStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; myself?: string }>;
}) {
  const { page: pageParam, myself: myselfParam } = await searchParams;
  const mine = myselfParam === "1";
  const user = await getCurrentUser();
  if (mine && !user) return <LoginRequired />;

  const requestedPage = Number(pageParam ?? "1");
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const { items: submissions, total, totalPages, page: currentPage } =
    await getPublicSubmissionPage(page, mine ? user?.id : undefined);
  const rankColors = await getRankColorClasses(submissions.map((submission) => submission.user.id));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-[var(--teal)]">
            {mine ? `Bài nộp của ${user?.displayName ?? ""}` : "Toàn hệ thống"}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-[var(--navy)]">
            {mine ? "Lịch sử bài nộp" : "Bài nộp công khai"}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {total} bài nộp · {PUBLIC_SUBMISSIONS_PAGE_SIZE} bài/trang · trang{" "}
            {currentPage}/{totalPages}.
            {!mine && " Mã nguồn và log chấm không hiển thị công khai."}
          </p>
        </div>
        <SubmissionScopeToggle mine={mine} loggedIn={Boolean(user)} />
      </div>

      {submissions.length === 0 ? (
        <div className="mt-6 rounded-xl border border-[var(--line)] bg-[var(--paper)]">
          <EmptyState
            type="no-submissions"
            title={mine ? "Bạn chưa nộp bài nào" : "Chưa có bài nộp nào"}
            description={
              mine
                ? "Bắt đầu làm bài để ghi nhận điểm số và lịch sử nộp bài của bạn."
                : "Hệ thống chưa có lượt nộp bài nào gần đây."
            }
            action={{
              label: "Chọn bài để luyện tập",
              href: "/problems",
            }}
          />
        </div>
      ) : (
        <>
          <div className="mt-6 overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--paper)]">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-[var(--surface-strong)] text-[var(--cream)]">
                <tr>
                  <th className="px-3 py-2 font-medium">Thời gian</th>
                  <th className="px-3 py-2 font-medium">Thí sinh</th>
                  <th className="px-3 py-2 font-medium">Bài tập</th>
                  <th className="px-3 py-2 font-medium">Ngôn ngữ</th>
                  <th className="px-3 py-2 font-medium">Kết quả</th>
                  <th className="px-3 py-2 text-right font-medium">Điểm</th>
                  <th className="px-3 py-2 text-right font-medium">Thời gian chạy</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((submission) => (
                  <tr key={submission.id} className="border-t border-[var(--line)]">
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-[var(--muted)]">
                      {submission.createdAt.toLocaleString("vi-VN")}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <Link
                        href={`/users/${encodeURIComponent(submission.user.username)}`}
                        className={`${rankColors[submission.user.id] ?? "text-slate-600 dark:text-slate-300"} hover:underline`}
                      >
                        {submission.user.displayName}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/problems/${submission.problem.slug}`}
                        className="font-medium text-[var(--teal)] hover:underline"
                      >
                        <span className="font-mono text-xs">
                          {submission.problem.slug}
                        </span>
                      </Link>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <nav
            aria-label="Phân trang bài nộp"
            className="mt-4 flex items-center justify-between"
          >
            {currentPage > 1 ? (
              <Link
                href={statusPageHref(currentPage - 1, mine)}
                className="rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm hover:border-[var(--navy)]/40"
              >
                ← Trang trước
              </Link>
            ) : (
              <span />
            )}
            <span className="text-sm text-[var(--muted)]">
              {currentPage} / {totalPages}
            </span>
            {currentPage < totalPages ? (
              <Link
                href={statusPageHref(currentPage + 1, mine)}
                className="rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm hover:border-[var(--navy)]/40"
              >
                Trang sau →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        </>
      )}
    </div>
  );
}

function statusPageHref(page: number, mine: boolean) {
  const params = new URLSearchParams({ page: String(page) });
  if (mine) params.set("myself", "1");
  return `/status?${params}`;
}

function LoginRequired() {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)]">
      <EmptyState
        type="login-required"
        title="Yêu cầu đăng nhập"
        description="Đăng nhập để xem toàn bộ lịch sử các bài nộp và mã nguồn của bạn."
        action={{
          label: "Đăng nhập ngay",
          href: "/login",
        }}
        secondaryAction={{
          label: "Chưa có tài khoản? Đăng ký tại đây",
          href: "/register",
        }}
      />
    </div>
  );
}
