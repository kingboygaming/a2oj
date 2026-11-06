import Link from "next/link";
import { notFound } from "next/navigation";
import { ContestNavigation } from "@/components/ContestNavigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PublishContestProblemButton } from "@/components/PublishContestProblemButton";
import { ContestPasswordForm } from "@/components/ContestPasswordForm";
import { hasContestAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ContestProblemsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ practice?: string }>;
}) {
  const [{ id }, { practice: practiceParam }, user] = await Promise.all([params, searchParams, getCurrentUser()]);
  const practice = practiceParam === "1";
  const contest = await prisma.contest.findFirst({
    where: { OR: [{ slug: id }, { id }] },
    include: {
      problems: {
        include: {
          problem: {
            select: {
              id: true,
              slug: true,
              title: true,
              difficulty: true,
              judgeType: true,
              ioMode: true,
              inputFile: true,
              outputFile: true,
              contestOnly: true,
            },
          },
        },
        orderBy: { letter: "asc" },
      },
    },
  });
  if (!contest) notFound();
  if (practice && contest.endAt > new Date()) notFound();

  const isOrganizer = user?.role === "ADMIN" || user?.id === contest.authorId;
  const passwordUnlocked = isOrganizer || await hasContestAccess(contest.id, contest.passwordHash);
  const beforeStart = !practice && new Date() < contest.startAt;
  if ((!passwordUnlocked || beforeStart) && !isOrganizer) {
    return (
      <div>
        <p className="text-sm text-[var(--teal)]">Contest</p>
        <h1 className="text-2xl font-semibold text-[var(--navy)]">{contest.title}</h1>
        <ContestNavigation slug={contest.slug} active="problems" practice={practice} />
        {contest.passwordHash && !passwordUnlocked && <ContestPasswordForm contestId={contest.id} />}
        {beforeStart && (
          <p className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-5 text-sm text-[var(--muted)]">
            Đề bài sẽ mở lúc {contest.startAt.toLocaleString("vi-VN")}.
          </p>
        )}
      </div>
    );
  }

  const acceptedProblemIds = user
    ? new Set(
        (
          await prisma.submission.findMany({
            where: { userId: user.id, contestId: contest.id, verdict: "AC" },
            select: { problemId: true },
          })
        ).map((submission) => submission.problemId),
      )
    : new Set<string>();

  return (
    <div>
      <p className="text-sm text-[var(--teal)]">Contest</p>
      <h1 className="text-2xl font-semibold text-[var(--navy)]">{contest.title}</h1>
      <ContestNavigation slug={contest.slug} active="problems" practice={practice} />
      {practice && (
        <p className="mt-4 rounded-lg border border-[var(--teal)]/30 bg-[var(--teal)]/10 p-3 text-sm text-[var(--teal)]">
          Chế độ Practice · bài nộp được chấm độc lập, không ảnh hưởng bảng xếp hạng.
        </p>
      )}
      {user && !practice && (
        <p className="mt-4 text-sm text-[var(--muted)]">
          Đã AC {acceptedProblemIds.size}/{contest.problems.length} bài trong contest này.
        </p>
      )}
      {user?.role === "ADMIN" && contest.endAt <= new Date() && (
        <p className="mt-2 text-sm text-[var(--muted)]">
          Contest đã kết thúc. Có thể đưa từng bài vào kho đề công khai bên dưới.
        </p>
      )}
      <div className="mt-5 overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--paper)]">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-[var(--surface-strong)] text-[var(--cream)]">
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Bài</th>
              <th className="px-3 py-2">Độ khó</th>
              <th className="px-3 py-2">Điểm</th>
              {user && !practice && <th className="px-3 py-2">Trạng thái</th>}
            </tr>
          </thead>
          <tbody>
            {contest.problems.map((contestProblem) => {
              const accepted = acceptedProblemIds.has(contestProblem.problem.id);
              const displayName = contestProblem.customTitle || contestProblem.problem.title;
              const effectiveJudgeType =
                contestProblem.judgeType || contestProblem.problem.judgeType || "STANDARD";
              const effectiveIoMode =
                contestProblem.ioMode || contestProblem.problem.ioMode || "STDIO";
              const effectiveInputFile =
                effectiveIoMode === "FILE"
                  ? contestProblem.inputFile ||
                    contestProblem.problem.inputFile ||
                    `${contestProblem.problem.slug.toUpperCase()}.INP`
                  : null;
              const effectiveOutputFile =
                effectiveIoMode === "FILE"
                  ? contestProblem.outputFile ||
                    contestProblem.problem.outputFile ||
                    `${contestProblem.problem.slug.toUpperCase()}.OUT`
                  : null;
              return (
                <tr key={contestProblem.problemId} className="border-t border-[var(--line)] transition hover:bg-[var(--background)]">
                  <td className="px-3 py-3 font-semibold">{contestProblem.letter}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/problems/${contestProblem.problem.slug}?contest=${contest.id}${practice ? "&practice=1" : ""}`}
                        className="font-medium text-[var(--teal)] hover:underline"
                      >
                        {displayName}
                      </Link>
                      {effectiveIoMode === "FILE" ? (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 font-mono text-[11px] text-amber-700 dark:text-amber-300">
                          📁 {effectiveInputFile} / {effectiveOutputFile}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded bg-slate-500/10 px-1.5 py-0.5 font-mono text-[11px] text-slate-500">
                          stdin/stdout
                        </span>
                      )}
                      {effectiveJudgeType === "HEURISTIC" && (
                        <span className="inline-flex items-center rounded bg-purple-500/10 px-1.5 py-0.5 text-[11px] font-medium text-purple-700 dark:text-purple-300">
                          🎯 Heuristic
                        </span>
                      )}
                      {user?.role === "ADMIN" && contest.endAt <= new Date() && contestProblem.problem.contestOnly && (
                        <PublishContestProblemButton
                          contestId={contest.id}
                          problemId={contestProblem.problem.id}
                        />
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <DifficultyBadge difficulty={contestProblem.problem.difficulty} />
                  </td>
                  <td className="px-3 py-3">{contestProblem.points}</td>
                  {user && !practice && (
                    <td className="px-3 py-3">
                      {accepted ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-400 ring-1 ring-inset ring-emerald-500/30">✓ AC</span>
                        ) : (
                          <span className="inline-flex items-center rounded-md bg-slate-500/10 px-2 py-0.5 text-xs text-slate-400 ring-1 ring-inset ring-slate-500/20">Chưa AC</span>
                        )}
                    </td>
                  )}
                </tr>
              );
            })}
            {contest.problems.length === 0 && (
              <tr>
                <td
                  colSpan={user && !practice ? 5 : 4}
                  className="px-3 py-8 text-center text-sm text-[var(--muted)]"
                >
                  Contest chưa có đề bài.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  if (difficulty === "EASY")
    return (
      <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400 ring-1 ring-inset ring-emerald-500/30">
        Dễ
      </span>
    );
  if (difficulty === "MEDIUM")
    return (
      <span className="inline-flex items-center rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-400 ring-1 ring-inset ring-amber-500/30">
        Trung bình
      </span>
    );
  return (
    <span className="inline-flex items-center rounded-md bg-rose-500/10 px-2 py-0.5 text-xs font-semibold text-rose-400 ring-1 ring-inset ring-rose-500/30">
      Khó
    </span>
  );
}
