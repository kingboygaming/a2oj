import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { VerdictBadge } from "@/components/VerdictBadge";
import Link from "next/link";
import { SubmissionTestResults } from "@/components/SubmissionTestResults";
import { SubmissionStatusRefresh } from "@/components/SubmissionStatusRefresh";
import { getRankColorClasses } from "@/lib/ranks";
import { getTotalTestPoints, getVnoiProblemScore } from "@/lib/scoring";

export const dynamic = "force-dynamic";

export default async function SubmissionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  const { id } = await params;
  const sub = await prisma.submission.findUnique({
    where: { id },
    include: {
      problem: {
        select: {
          slug: true,
          title: true,
          published: true,
          authorId: true,
          scoringMode: true,
          judgeType: true,
          testCases: {
            orderBy: { order: "asc" },
            select: { isSample: true, points: true },
          },
        },
      },
      contest: { select: { scoringMode: true, testLimit: true } },
      user: { select: { id: true, displayName: true } },
    },
  });
  if (!sub) notFound();
  const rankColors = await getRankColorClasses([sub.user.id]);
  const staff = user?.role === "TEACHER" || user?.role === "ADMIN";
  const canViewPrivateDetails = staff || user?.id === sub.userId;
  const showScore =
    (sub.contest?.scoringMode ?? sub.problem.scoringMode) === "VNOI" ||
    sub.problem.judgeType === "HEURISTIC";
  const contestProblem =
    sub.contest?.scoringMode === "VNOI" && sub.contestId
      ? await prisma.contestProblem.findUnique({
          where: {
            contestId_problemId: {
              contestId: sub.contestId,
              problemId: sub.problemId,
            },
          },
          select: { points: true },
        })
      : null;
  const scoreText =
    sub.contest?.scoringMode === "VNOI" && contestProblem
      ? `${getVnoiProblemScore(
          sub.score,
          getTotalTestPoints(sub.problem.testCases, sub.contest.testLimit),
          contestProblem.points,
        )}/${contestProblem.points} điểm`
      : `${sub.score} điểm`;
  if (!sub.problem.published && !staff && user?.id !== sub.userId && user?.id !== sub.problem.authorId) {
    notFound();
  }

  return (
    <div className="max-w-3xl">
      <Link href={`/problems/${sub.problem.slug}`} className="text-sm text-[var(--teal)]">
        ← {sub.problem.title}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-[var(--navy)]">
        Chi tiết bài nộp
      </h1>
      <div className="mt-3 flex flex-wrap gap-3 text-sm">
        <VerdictBadge verdict={sub.verdict} />
        <span>{sub.language === "CPP" ? "C++17" : "Python 3"}</span>
        {showScore && <span>{scoreText}</span>}
        <span>{sub.timeMs ?? 0} ms</span>
        <span className={rankColors[sub.user.id] ?? "text-slate-600 dark:text-slate-300"}>{sub.user.displayName}</span>
      </div>
      <SubmissionStatusRefresh verdict={sub.verdict} />
      {canViewPrivateDetails ? (
        <>
          {sub.verdict !== "QUEUED" && sub.verdict !== "RUNNING" && (
            <SubmissionTestResults
              log={sub.log}
              currentTestCount={
                sub.problem.testCases.filter((test) => !test.isSample).length ||
                sub.problem.testCases.length
              }
            />
          )}
          <pre className="mt-4 overflow-auto rounded-xl bg-[#0b1220] p-4 text-xs text-[var(--cream)]">
            {sub.source}
          </pre>
        </>
      ) : (
        <p className="mt-6 rounded-lg border border-[var(--line)] bg-[var(--paper)] p-4 text-sm text-[var(--muted)]">
          Đây là thông tin công khai của bài nộp. Kết quả từng test và mã nguồn
          chỉ chủ bài nộp, giáo viên hoặc quản trị viên mới xem được.
        </p>
      )}
    </div>
  );
}
