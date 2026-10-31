import Link from "next/link";
import { notFound } from "next/navigation";
import { ContestNavigation } from "@/components/ContestNavigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ContestProblemsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, user] = await Promise.all([params, getCurrentUser()]);
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
              ioMode: true,
              inputFile: true,
              outputFile: true,
            },
          },
        },
        orderBy: { letter: "asc" },
      },
    },
  });
  if (!contest) notFound();

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
      <ContestNavigation slug={contest.slug} active="problems" />
      {user && (
        <p className="mt-4 text-sm text-[var(--muted)]">
          Đã AC {acceptedProblemIds.size}/{contest.problems.length} bài trong contest này.
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
              {user && <th className="px-3 py-2">Trạng thái</th>}
            </tr>
          </thead>
          <tbody>
            {contest.problems.map((contestProblem) => {
              const accepted = acceptedProblemIds.has(contestProblem.problem.id);
              const displayName = contestProblem.customTitle || contestProblem.problem.title;
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
                        href={`/problems/${contestProblem.problem.slug}?contest=${contest.id}`}
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
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <DifficultyBadge difficulty={contestProblem.problem.difficulty} />
                  </td>
                  <td className="px-3 py-3">{contestProblem.points}</td>
                  {user && (
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
                  colSpan={user ? 5 : 4}
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
