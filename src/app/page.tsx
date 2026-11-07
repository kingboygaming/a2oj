import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { VerdictBadge } from "@/components/VerdictBadge";
import { GlobalAcmLeaderboard } from "@/components/GlobalAcmLeaderboard";
import { HomeRefreshButton } from "@/components/HomeRefreshButton";
import { getGlobalAcmLeaderboard } from "@/lib/global-leaderboard";
import { Markdown } from "@/components/Markdown";
import { getRankColorClasses } from "@/lib/ranks";
import { StatCard } from "@/components/StatCard";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [
    user,
    news,
    problemCount,
    contestCount,
    submissionCount,
    recentSubmissions,
    standings,
    activeCoders,
    newProblems,
    recentContests,
  ] = await Promise.all([
    getCurrentUser(),
    prisma.news.findMany({
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      include: { author: { select: { displayName: true } } },
      take: 5,
    }),
    prisma.problem.count({ where: { published: true, contestOnly: false } }),
    prisma.contest.count(),
    prisma.submission.count({ where: { contestId: null } }),
    prisma.submission.findMany({
      where: { contestId: null },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        user: { select: { id: true, displayName: true, username: true } },
        problem: { select: { slug: true, scoringMode: true, judgeType: true } },
      },
    }),
    getGlobalAcmLeaderboard(),
    getActiveCoders(),
    prisma.problem.findMany({
      where: { published: true, contestOnly: false },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { slug: true, title: true, createdAt: true },
    }),
    prisma.contest.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { slug: true, title: true, startAt: true, endAt: true },
    }),
  ]);
  const now = new Date();
  const rankColors = await getRankColorClasses(standings.map((standing) => standing.userId));
  const recentSubmissionRankColors = await getRankColorClasses(recentSubmissions.map((submission) => submission.user.id));
  const standingsWithRankColors = standings.map((standing) => ({ ...standing, rankColorClass: rankColors[standing.userId] }));
  const weekday = new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(now);
  const date = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(now);

  return (
    <div className="space-y-5">
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <section
          aria-labelledby="announcements-heading"
          className="overflow-hidden rounded-lg border border-[var(--line)] shadow-sm"
          style={{ backgroundColor: "var(--paper, #111827)" }}
        >
          <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3 sm:px-5">
            <h1
              id="announcements-heading"
              className="text-lg font-semibold text-[var(--navy)]"
            >
              Thông báo
            </h1>
            <HomeRefreshButton />
          </div>
          {news.length > 0 ? (
            <div className="px-4 sm:px-7">
              {news.map((item) => (
                <article key={item.id} className="border-b border-[var(--line)] last:border-b-0">
                  <details className="group">
                    <summary className="grid cursor-pointer list-none gap-1 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--teal)] sm:grid-cols-[minmax(0,1fr)_165px_110px_20px] sm:items-center sm:gap-3">
                      <h2 className="min-w-0 text-sm font-medium leading-5 text-[var(--navy)]">
                        {item.pinned && (
                          <span className="mr-2 inline-flex rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-500">
                            GHIM
                          </span>
                        )}
                        {item.title}
                      </h2>
                      <time
                        dateTime={item.createdAt.toISOString()}
                        className="text-xs tabular-nums text-[var(--muted)]"
                      >
                        {item.createdAt.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}
                      </time>
                      <span className="truncate text-xs text-[var(--muted)]">
                        Bởi {item.author.displayName}
                      </span>
                      <span
                        aria-hidden="true"
                        className="hidden text-center text-[var(--muted)] transition-transform group-open:rotate-180 sm:block"
                      >
                        ▾
                      </span>
                    </summary>
                    <div className="border-t border-[var(--line)] py-3 text-sm text-[var(--muted)]">
                      <Markdown source={item.body} />
                    </div>
                  </details>
                </article>
              ))}
            </div>
          ) : (
            <p className="px-5 py-10 text-center text-sm text-[var(--muted)]">
              Chưa có thông báo mới.
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] bg-[var(--background)] px-4 py-3 text-xs text-[var(--muted)] sm:px-5">
            <span>{user ? `Xin chào ${user.displayName}` : "Cộng đồng A2OJ"}</span>
            <span>{news.length} thông báo mới nhất</span>
          </div>
        </section>

        <aside className="space-y-4">
          <section
            className="overflow-hidden rounded-lg border border-[var(--line)] shadow-sm"
            style={{ backgroundColor: "var(--paper, #111827)" }}
          >
            <div className="flex items-center gap-2 border-b border-[var(--line)] px-4 py-3">
              <span className="flex size-8 items-center justify-center rounded-lg bg-blue-500/15 text-blue-400">
                ▦
              </span>
              <h2 className="font-semibold text-[var(--navy)]">Lịch A2OJ</h2>
            </div>
            <div className="px-4 py-4 text-center">
              <p className="text-sm capitalize text-[var(--muted)]">Hôm nay là</p>
              <p className="mt-2 text-lg font-semibold capitalize text-[var(--navy)]">
                {weekday}
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--navy)]">
                {date}
              </p>
              <p className="mt-3 text-sm leading-5 text-[var(--muted)]">
                Mỗi bài tập là một bước tiến trên hành trình chinh phục thuật toán.
              </p>
              <Link
                href="/problems"
                className="mt-4 inline-flex w-full items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-500 transition hover:bg-emerald-500/15"
              >
                Khám phá bài tập
              </Link>
            </div>
          </section>

          <section
            className="rounded-lg border border-[var(--line)] p-4 shadow-sm"
            style={{ backgroundColor: "var(--paper, #111827)" }}
          >
            <h2 className="font-semibold text-[var(--navy)]">Truy cập nhanh</h2>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <QuickLink href="/problems" label="Bài tập" />
              <QuickLink href="/contests" label="Kỳ thi" />
              <QuickLink href="/status" label="Bài nộp" />
              <QuickLink href="/problems/new" label="Đóng góp đề" />
            </div>
          </section>
        </aside>
      </div>

      <section aria-label="Thống kê A2OJ" className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Bài tập có sẵn" value={problemCount} href="/problems" icon="{}" accent="text-sky-400" />
        <StatCard label="Kỳ thi / Contest" value={contestCount} href="/contests" icon="⌁" accent="text-violet-400" />
        <StatCard label="Lượt bài nộp" value={submissionCount} href="/status" icon="↗" accent="text-emerald-400" />
        <StatCard label="Thí sinh tham gia" value={standings.length} href="/leaderboard" icon="♙" accent="text-amber-400" />
      </section>

      <section aria-labelledby="highlights-heading">
        <div className="mb-3 flex items-center gap-2">
          <span aria-hidden="true" className="text-amber-400">✦</span>
          <h2 id="highlights-heading" className="text-lg font-semibold text-[var(--navy)]">
            Bảng thành tích &amp; hoạt động nổi bật
          </h2>
        </div>
        <div className="grid items-start gap-4 xl:grid-cols-3">
          <div className="xl:col-span-3">
            <GlobalAcmLeaderboard standings={standingsWithRankColors} />
          </div>

          <DataCard
            title="Coder tích cực"
            subtitle="Xếp theo số bài đã giải"
            icon="↗"
            href="/status"
            linkLabel="Xem bài nộp"
          >
            {activeCoders.length > 0 ? (
              <ol className="divide-y divide-[var(--line)]">
                {activeCoders.map((coder, index) => (
                  <li key={coder.userId} className="flex items-center justify-between gap-3 py-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="w-5 shrink-0 text-xs text-[var(--muted)]">{index + 1}.</span>
                      <Link
                        href={`/users/${encodeURIComponent(coder.username)}`}
                        className="truncate text-sm font-medium text-[var(--teal)] hover:underline"
                      >
                        {coder.displayName}
                      </Link>
                    </span>
                    <span className="shrink-0 text-xs text-[var(--muted)]">
                      {coder.submissions.toLocaleString("vi-VN")} bài đã giải
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyList message="Chưa có hoạt động bài nộp." />
            )}
          </DataCard>

          <DataCard
            title="Bài tập mới"
            subtitle={`${problemCount.toLocaleString("vi-VN")} đề đã xuất bản`}
            icon="▣"
            href="/problems"
            linkLabel="Tất cả bài tập"
          >
            {newProblems.length > 0 ? (
              <ul className="divide-y divide-[var(--line)]">
                {newProblems.slice(0, 7).map((problem) => (
                  <li key={problem.slug} className="py-2">
                    <Link
                      href={`/problems/${problem.slug}`}
                      className="block truncate text-sm font-medium text-[var(--navy)] hover:text-[var(--teal)]"
                    >
                      <span className="mr-2 font-mono text-xs text-[var(--teal)]">
                        {problem.slug}
                      </span>
                      {problem.title}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyList message="Chưa có bài tập." />
            )}
          </DataCard>

          <DataCard
            title="Lớp học / Kỳ thi mới"
            subtitle="Các contest gần đây"
            icon="♟"
            href="/contests"
            linkLabel="Tất cả kỳ thi"
          >
            {recentContests.length > 0 ? (
              <ul className="divide-y divide-[var(--line)]">
                {recentContests.slice(0, 7).map((contest) => (
                  <li key={contest.slug} className="py-2">
                    <Link
                      href={`/contests/${contest.slug}`}
                      className="block truncate text-sm font-medium text-[var(--navy)] hover:text-[var(--teal)]"
                    >
                      {contest.title}
                    </Link>
                    <p className="mt-1 text-[11px] text-[var(--muted)]">
                      {getContestStatus(contest.startAt, contest.endAt)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyList message="Chưa có kỳ thi nào." />
            )}
          </DataCard>
        </div>
      </section>

      <section
        className="overflow-hidden rounded-lg border border-[var(--line)] shadow-sm"
        style={{ backgroundColor: "var(--paper, #111827)" }}
      >
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--line)] px-4 py-3 sm:px-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--teal)]">
              Hoạt động trực tiếp
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--navy)]">Bài nộp gần đây</h2>
          </div>
          <Link href="/status" className="text-sm font-medium text-[var(--teal)] hover:underline">
            Xem tất cả →
          </Link>
        </div>
        {recentSubmissions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead className="bg-[var(--background)] text-xs text-[var(--muted)]">
                <tr>
                  <th className="px-5 py-3 font-medium">Thí sinh</th>
                  <th className="px-3 py-3 font-medium">Bài tập</th>
                  <th className="px-3 py-3 font-medium">Ngôn ngữ</th>
                  <th className="px-3 py-3 font-medium">Kết quả</th>
                  <th className="px-5 py-3 text-right font-medium">Điểm</th>
                </tr>
              </thead>
              <tbody>
                {recentSubmissions.map((submission) => (
                  <tr key={submission.id} className="border-t border-[var(--line)] transition hover:bg-[var(--background)]">
                    <td className="whitespace-nowrap px-5 py-3">
                      <Link
                        href={`/users/${encodeURIComponent(submission.user.username)}`}
                        className={`font-medium ${recentSubmissionRankColors[submission.user.id] ?? "text-slate-600 dark:text-slate-300"} hover:underline`}
                      >
                        {submission.user.displayName}
                      </Link>
                      <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                        {submission.createdAt.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <Link
                        href={`/problems/${submission.problem.slug}`}
                        className="font-mono text-xs font-medium text-[var(--teal)] hover:underline"
                      >
                        {submission.problem.slug}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-[var(--muted)]">
                      {submission.language === "CPP" ? "C++17" : "Python 3"}
                    </td>
                    <td className="px-3 py-3">
                      <VerdictBadge verdict={submission.verdict} />
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-xs tabular-nums text-[var(--navy)]">
                      {submission.problem.scoringMode === "VNOI" ||
                      submission.problem.judgeType === "HEURISTIC"
                        ? submission.score
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-5 py-10 text-center">
            <p className="font-medium text-[var(--navy)]">Chưa có bài nộp nào</p>
            <Link href="/problems" className="mt-2 inline-block text-sm text-[var(--teal)] hover:underline">
              Tìm bài tập →
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}

async function getActiveCoders() {
  const groups = await prisma.submission.groupBy({
    by: ["userId", "problemId"],
    where: { verdict: "AC", contestId: null },
  });
  if (groups.length === 0) return [];

  const solvedByUser = new Map<string, number>();
  for (const group of groups) {
    solvedByUser.set(group.userId, (solvedByUser.get(group.userId) ?? 0) + 1);
  }
  const top = [...solvedByUser.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const users = await prisma.user.findMany({
    where: { id: { in: top.map(([userId]) => userId) } },
    select: { id: true, username: true, displayName: true },
  });
  const byId = new Map(users.map((item) => [item.id, item]));

  return top.flatMap(([userId, submissions]) => {
    const user = byId.get(userId);
    return user
      ? [{ ...user, userId: user.id, submissions }]
      : [];
  });
}

function getContestStatus(startAt: Date, endAt: Date) {
  const now = Date.now();
  if (now < startAt.getTime()) return `Sắp diễn ra · ${startAt.toLocaleDateString("vi-VN")}`;
  if (now > endAt.getTime()) return "Đã kết thúc";
  return "Đang diễn ra";
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-md border border-[var(--line)] px-2.5 py-2 text-center text-xs font-medium text-[var(--navy)] transition hover:border-[var(--teal)] hover:text-[var(--teal)]"
      style={{ backgroundColor: "var(--background, #0f172a)" }}
    >
      {label}
    </Link>
  );
}

function Stat({
  label,
  value,
  href,
  icon,
  accent,
}: {
  label: string;
  value: number;
  href: string;
  icon: string;
  accent: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] px-4 py-3 transition hover:border-[var(--teal)]/50"
      style={{ backgroundColor: "var(--paper, #111827)" }}
    >
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-[var(--muted)]">{label}</p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--navy)]">
          {value.toLocaleString("vi-VN")}
        </p>
      </div>
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--background)] font-mono text-sm font-bold ${accent}`}>
        {icon}
      </span>
    </Link>
  );
}

function DataCard({
  title,
  subtitle,
  icon,
  href,
  linkLabel,
  children,
}: {
  title: string;
  subtitle: string;
  icon: string;
  href: string;
  linkLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="flex h-full min-w-0 flex-col overflow-hidden rounded-lg border border-[var(--line)] shadow-sm"
      style={{ backgroundColor: "var(--paper, #111827)" }}
    >
      <div className="flex items-center gap-2 border-b border-[var(--line)] px-4 py-3">
        <span aria-hidden="true" className="text-sm text-[var(--teal)]">{icon}</span>
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-[var(--navy)]">{title}</h3>
          <p className="mt-0.5 text-[11px] text-[var(--muted)]">{subtitle}</p>
        </div>
      </div>
      <div className="flex-1 px-4 py-1">{children}</div>
      <Link
        href={href}
        className="border-t border-[var(--line)] px-4 py-2.5 text-xs font-medium text-[var(--teal)] hover:bg-[var(--background)]"
      >
        {linkLabel} →
      </Link>
    </section>
  );
}

function EmptyList({ message }: { message: string }) {
  return <p className="py-6 text-center text-sm text-[var(--muted)]">{message}</p>;
}
