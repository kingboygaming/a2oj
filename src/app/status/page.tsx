import Link from "next/link";
import { VerdictBadge } from "@/components/VerdictBadge";
import { SubmissionScopeToggle } from "@/components/SubmissionScopeToggle";
import { EmptyState } from "@/components/EmptyState";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
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
    <div className="space-y-6">
      {/* Enhanced Header */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-gradient-to-br from-[var(--paper)] via-[var(--background)] to-[var(--paper)] p-6 sm:p-8">
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--teal)]/10 via-transparent to-[var(--amber)]/10 pointer-events-none" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl" aria-hidden="true">📊</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--teal)]">
                {mine ? `Bài nộp của ${user?.displayName ?? ""}` : "Thời gian thực"}
              </span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-[var(--navy)]">
              {mine ? "Lịch sử nộp bài" : "Nhật ký chấm bài"}
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Tổng cộng <span className="font-semibold text-[var(--teal)]">{total.toLocaleString("vi-VN")}</span> bài nộp · {PUBLIC_SUBMISSIONS_PAGE_SIZE} bài/trang · Trang {currentPage}/{totalPages}
              {!mine && " · Bài nộp được cập nhật tự động"}
            </p>
          </div>
          <SubmissionScopeToggle mine={mine} loggedIn={Boolean(user)} />
        </div>
      </div>

      {submissions.length === 0 ? (
        <Card variant="glass">
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
        </Card>
      ) : (
        <>
          <Card variant="default" className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--line)] bg-[var(--surface-strong)] text-xs text-[var(--cream)] uppercase tracking-wider">
                    <th className="px-5 py-3.5 font-semibold">Thời gian</th>
                    <th className="px-4 py-3.5 font-semibold">Thí sinh</th>
                    <th className="px-4 py-3.5 font-semibold">Bài tập</th>
                    <th className="px-4 py-3.5 font-semibold">Ngôn ngữ</th>
                    <th className="px-4 py-3.5 font-semibold">Kết quả</th>
                    <th className="px-4 py-3.5 text-right font-semibold">Điểm</th>
                    <th className="px-5 py-3.5 text-right font-semibold">Thời gian chạy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]/50">
                  {submissions.map((submission) => (
                    <tr 
                      key={submission.id} 
                      className="transition-colors hover:bg-[var(--teal)]/5 group"
                    >
                      <td className="whitespace-nowrap px-5 py-3.5 font-mono text-xs text-[var(--muted)]">
                        {submission.createdAt.toLocaleDateString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          day: "2-digit",
                          month: "2-digit",
                        })}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <Link
                          href={`/users/${encodeURIComponent(submission.user.username)}`}
                          className={`font-semibold ${rankColors[submission.user.id] ?? "text-slate-600 dark:text-slate-300"} hover:underline transition-colors`}
                        >
                          {submission.user.displayName}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5">
                        <Link
                          href={`/problems/${submission.problem.slug}`}
                          className="inline-flex items-center gap-1.5 font-medium text-[var(--teal)] hover:underline"
                        >
                          <Badge variant="default" size="sm" className="font-mono font-bold">
                            {submission.problem.slug}
                          </Badge>
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <span className="rounded-md bg-[var(--background)] px-2 py-1 font-mono text-xs font-medium text-[var(--muted)] border border-[var(--line)]/50">
                          {submission.language === "CPP" ? "C++17" : "Python 3"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <VerdictBadge verdict={submission.verdict} />
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-sm font-semibold tabular-nums text-[var(--navy)]">
                        {submission.problem.scoringMode === "VNOI" ||
                        submission.problem.judgeType === "HEURISTIC"
                          ? submission.score
                          : "—"}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-xs tabular-nums text-[var(--muted)]">
                        {submission.timeMs === null ? "—" : `${submission.timeMs} ms`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {totalPages > 1 && (
            <nav
              aria-label="Phân trang bài nộp"
              className="flex flex-wrap items-center justify-center gap-3 pt-2"
            >
              {currentPage > 1 ? (
                <Link
                  href={statusPageHref(currentPage - 1, mine)}
                  className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--paper)] px-4 py-2 text-sm font-medium text-[var(--teal)] transition-all hover:border-[var(--teal)] hover:shadow-lg hover:shadow-[var(--teal)]/10"
                >
                  <span aria-hidden="true">←</span> Trang trước
                </Link>
              ) : (
                <span className="flex items-center gap-2 rounded-xl border border-[var(--line)] px-4 py-2 text-sm text-[var(--muted)] opacity-40 cursor-not-allowed">
                  <span aria-hidden="true">←</span> Trang trước
                </span>
              )}

              <div className="flex items-center gap-2">
                <span className="rounded-xl bg-[var(--teal)] px-3.5 py-1.5 text-sm font-bold text-white shadow-md shadow-[var(--teal)]/30">
                  {currentPage}
                </span>
                <span className="text-sm text-[var(--muted)]">/</span>
                <span className="text-sm font-medium text-[var(--navy)]">{totalPages}</span>
              </div>

              {currentPage < totalPages ? (
                <Link
                  href={statusPageHref(currentPage + 1, mine)}
                  className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--paper)] px-4 py-2 text-sm font-medium text-[var(--teal)] transition-all hover:border-[var(--teal)] hover:shadow-lg hover:shadow-[var(--teal)]/10"
                >
                  Trang sau <span aria-hidden="true">→</span>
                </Link>
              ) : (
                <span className="flex items-center gap-2 rounded-xl border border-[var(--line)] px-4 py-2 text-sm text-[var(--muted)] opacity-40 cursor-not-allowed">
                  Trang sau <span aria-hidden="true">→</span>
                </span>
              )}
            </nav>
          )}
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
    <Card variant="glass">
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
    </Card>
  );
}
