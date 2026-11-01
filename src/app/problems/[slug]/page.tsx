import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasContestAccess } from "@/lib/auth";
import { Markdown } from "@/components/Markdown";
import { SubmitPanel } from "@/components/SubmitPanel";
import { PreviousPageButton } from "@/components/PreviousPageButton";
import Link from "next/link";
import { getProblemSubmissionPage } from "@/lib/problem-submissions";
import { ProblemSubmissionsList } from "@/components/ProblemSubmissionsList";
import { ContestPasswordForm } from "@/components/ContestPasswordForm";

export const dynamic = "force-dynamic";

export default async function ProblemDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ contest?: string }>;
}) {
  const { slug } = await params;
  const { contest } = await searchParams;
  const user = await getCurrentUser();
  const problem = await prisma.problem.findUnique({
    where: { slug },
    include: {
      // Chỉ tải test mẫu (sample) để hiển thị, không tải toàn bộ test ẩn nặng nề
      testCases: { where: { isSample: true }, orderBy: { order: "asc" } },
      tags: { orderBy: { name: "asc" } },
      author: { select: { displayName: true } },
      contestLinks: {
        select: {
          contest: {
            select: {
              id: true,
              slug: true,
              title: true,
              authorId: true,
              startAt: true,
              passwordHash: true,
            },
          },
        },
      },
    },
  });
  if (!problem) notFound();

  const staff = user?.role === "TEACHER" || user?.role === "ADMIN";
  if (!problem.published && !staff && user?.id !== problem.authorId) notFound();
  const contestContext = contest
    ? await prisma.contest.findFirst({
        where: {
          OR: [{ id: contest }, { slug: contest }],
          problems: { some: { problemId: problem.id } },
        },
        select: {
          id: true,
          slug: true,
          title: true,
          authorId: true,
          startAt: true,
          passwordHash: true,
          problems: {
            where: { problemId: problem.id },
            select: {
              letter: true,
              customTitle: true,
              judgeType: true,
              ioMode: true,
              inputFile: true,
              outputFile: true,
            },
          },
        },
      })
    : null;
  if ((contest && !contestContext) || (problem.contestOnly && !contestContext && !staff)) {
    notFound();
  }

  const accessContests = contestContext
    ? [contestContext]
    : problem.contestLinks.map(({ contest: linkedContest }) => linkedContest);
  let blockedContest: (typeof accessContests)[number] | null = null;
  for (const linkedContest of accessContests) {
    const organizer = user?.role === "ADMIN" || user?.id === linkedContest.authorId;
    const unlocked = organizer || await hasContestAccess(linkedContest.id, linkedContest.passwordHash);
    if (!organizer && (!unlocked || new Date() < linkedContest.startAt)) {
      blockedContest = linkedContest;
      break;
    }
  }
  if (blockedContest) {
    return (
      <div className="max-w-3xl">
        <Link
          href={`/contests/${blockedContest.slug}/problems`}
          className="mb-4 inline-block text-sm font-medium text-[var(--teal)] hover:underline"
        >
          ← {blockedContest.title}
        </Link>
        <h1 className="text-2xl font-semibold text-[var(--navy)]">Đề bài đang được khóa</h1>
        {blockedContest.passwordHash && (
          <ContestPasswordForm contestId={blockedContest.id} />
        )}
        {new Date() < blockedContest.startAt && (
          <p className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-5 text-sm text-[var(--muted)]">
            Nội dung đề sẽ mở lúc {blockedContest.startAt.toLocaleString("vi-VN")}.
          </p>
        )}
      </div>
    );
  }

  const samples = problem.testCases.filter((t) => t.isSample);
  const { items: recentSubmissions, total, page, totalPages } =
    await getProblemSubmissionPage(problem.id, 1, 10, contestContext?.id ?? null);

  const currentContestProblem = contestContext?.problems?.[0];
  const problemDisplayName = currentContestProblem?.customTitle || problem.title;
  const effectiveJudgeType = currentContestProblem?.judgeType || problem.judgeType || "STANDARD";
  const effectiveIoMode = currentContestProblem?.ioMode || problem.ioMode || "STDIO";
  const effectiveInputFile =
    effectiveIoMode === "FILE"
      ? currentContestProblem?.inputFile || problem.inputFile || `${problem.slug.toUpperCase()}.INP`
      : null;
  const effectiveOutputFile =
    effectiveIoMode === "FILE"
      ? currentContestProblem?.outputFile || problem.outputFile || `${problem.slug.toUpperCase()}.OUT`
      : null;

  return (
    <div>
      {contestContext && (
        <Link
          href={`/contests/${contestContext.slug}/problems`}
          className="mb-4 inline-block text-sm font-medium text-[var(--teal)] hover:underline"
        >
          ← {contestContext.title}
        </Link>
      )}
      {user?.role === "ADMIN" && (
        <PreviousPageButton fallbackHref="/admin" />
      )}
      {!problem.published && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold uppercase text-amber-900">
                Chờ duyệt
              </span>
              <span className="text-sm font-semibold">Bài tập này chưa được phê duyệt</span>
            </div>
            <p className="mt-1 text-xs text-amber-800">
              Bài tập chưa được xuất bản công khai. Tác giả có quyền chỉnh sửa nội dung và bộ test trước khi quản trị viên phê duyệt.
            </p>
          </div>
          {(user?.role === "ADMIN" || user?.id === problem.authorId) && (
            <Link
              href={`/problems/${problem.slug}/edit`}
              className="rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-amber-700"
            >
              Chỉnh sửa bài tập
            </Link>
          )}
        </div>
      )}
      {problem.published && user?.role === "ADMIN" && (
        <div className="mb-4 flex justify-end">
          <Link
            href={`/admin/problems/${problem.id}/edit`}
            className="inline-flex items-center rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 text-xs font-medium text-[var(--navy)] hover:border-[var(--teal)] hover:text-[var(--teal)]"
          >
            Chỉnh sửa bài tập
          </Link>
        </div>
      )}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <article className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--paper)] shadow-sm">
          <div className="border-b border-[var(--line)] bg-[var(--surface-strong)] px-5 py-5 text-white sm:px-7">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {currentContestProblem && (
                <span className="rounded-md bg-[var(--teal)] px-2.5 py-1 font-bold text-white">
                  Bài {currentContestProblem.letter}
                </span>
              )}
              <span className="rounded-md border border-white/15 bg-white/5 px-2 py-1 font-mono text-sky-200">
                {problem.slug}
              </span>
              <span className="rounded-md bg-white/10 px-2 py-1 text-white/75">
                {problem.difficulty === "EASY"
                  ? "Dễ"
                  : problem.difficulty === "MEDIUM"
                    ? "Trung bình"
                    : "Khó"}
              </span>
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              {problemDisplayName}
            </h1>
            {problem.tags.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{problem.tags.map((tag) => <Link key={tag.id} href={`/problems?tag=${encodeURIComponent(tag.name)}`} className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-xs text-sky-100 hover:bg-white/20">{tag.name}</Link>)}</div>}
            {problem.achievementBadgeTitle && <p className="mt-3 inline-flex rounded-md border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-xs text-amber-100">🏅 Huy hiệu riêng: {problem.achievementBadgeTitle} · đạt từ {problem.achievementScoreThreshold ?? 90} điểm</p>}
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
              <span className="rounded-md border border-white/10 px-2.5 py-1.5">
                ⏱ {problem.timeLimitMs} ms
              </span>
              <span className="rounded-md border border-white/10 px-2.5 py-1.5">
                ◈ {problem.memoryLimitMb} MB
              </span>
              <span className="rounded-md border border-white/10 px-2.5 py-1.5">
                {effectiveIoMode === "FILE" ? (
                  <>
                    📁 Tệp vào/ra: <span className="font-mono font-semibold text-amber-300">{effectiveInputFile}</span> / <span className="font-mono font-semibold text-amber-300">{effectiveOutputFile}</span>
                  </>
                ) : (
                  <>
                    📥 Vào/ra: <span className="font-mono text-sky-200">stdin / stdout</span>
                  </>
                )}
              </span>
              <span className="rounded-md border border-white/10 px-2.5 py-1.5">
                Tác giả: {problem.author.displayName}
              </span>
              {effectiveJudgeType === "HEURISTIC" && (
                <span className="rounded-md border border-purple-400/30 bg-purple-500/20 px-2.5 py-1.5 font-medium text-purple-200">
                  🎯 Chấm xấp xỉ (Heuristic)
                </span>
              )}
            </div>
          </div>
          <div className="p-5 sm:p-7">
            <Markdown source={problem.statement} />
            {samples.length > 0 && (
              <div className="mt-8 border-t border-[var(--line)] pt-6">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-[var(--teal)]">
                      Ví dụ
                    </p>
                    <h2 className="mt-1 text-lg font-semibold text-[var(--navy)]">
                      Sample test
                    </h2>
                  </div>
                  <span className="rounded-full bg-[var(--background)] px-2.5 py-1 text-xs text-[var(--muted)]">
                    {samples.length} mẫu
                  </span>
                </div>
                <div className="space-y-3">
                  {samples.map((s, index) => (
                    <div
                      key={s.id}
                      className="overflow-hidden rounded-lg border border-[var(--line)]"
                    >
                      <div className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--background)] px-3 py-2">
                        <span className="font-mono text-xs font-medium text-[var(--muted)]">
                          Sample {index + 1}
                        </span>
                        <span className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                          Input / Output
                        </span>
                      </div>
                      <div className="grid sm:grid-cols-2">
                        <div className="min-w-0 p-3 sm:border-r sm:border-[var(--line)]">
                          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--teal)]">
                            Input
                          </p>
                          <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs leading-5 text-[var(--navy)]">
                            {s.input || "(Rỗng)"}
                          </pre>
                        </div>
                        <div className="min-w-0 border-t border-[var(--line)] p-3 sm:border-t-0">
                          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--teal)]">
                            Output
                          </p>
                          <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs leading-5 text-[var(--navy)]">
                            {s.output || "(Rỗng)"}
                          </pre>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </article>
        <SubmitPanel
          problemId={problem.id}
          userId={user?.id ?? ""}
          loggedIn={Boolean(user)}
          contestId={contestContext?.id}
          judgeType={effectiveJudgeType}
          ioMode={effectiveIoMode}
          inputFile={effectiveInputFile}
          outputFile={effectiveOutputFile}
          samples={samples.map((sample, index) => ({
            id: sample.id,
            label: `Sample ${index + 1}`,
            input: sample.input,
            output: sample.output,
          }))}
        />
      </div>
      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--teal)]">
              Lịch sử
            </p>
            <h2 className="text-xl font-semibold text-[var(--navy)]">
              Bài nộp gần đây
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {total} bài nộp cho đề này
            </p>
          </div>
          {total > 10 && (
            <Link
              href={`/problems/${problem.slug}/submissions${contestContext ? `?contest=${contestContext.slug}` : ""}`}
              className="text-sm font-medium text-[var(--teal)] hover:underline"
            >
              Xem tất cả →
            </Link>
          )}
        </div>
        <ProblemSubmissionsList
          submissions={recentSubmissions}
          problemSlug={problem.slug}
          currentPage={page}
          totalPages={totalPages}
          showPagination={false}
        />
      </section>
    </div>
  );
}
