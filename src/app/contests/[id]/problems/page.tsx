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
          problem: { select: { id: true, slug: true, title: true, difficulty: true } },
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
              return (
                <tr key={contestProblem.problemId} className="border-t border-[var(--line)]">
                  <td className="px-3 py-3 font-semibold">{contestProblem.letter}</td>
                  <td className="px-3 py-3">
                    <Link
                      href={`/problems/${contestProblem.problem.slug}?contest=${contest.id}`}
                      className="font-medium text-[var(--teal)] hover:underline"
                    >
                      {displayName}
                    </Link>

                  </td>
                  <td className="px-3 py-3">
                    {contestProblem.problem.difficulty === "EASY"
                      ? "Dễ"
                      : contestProblem.problem.difficulty === "MEDIUM"
                        ? "Trung bình"
                        : "Khó"}
                  </td>
                  <td className="px-3 py-3">{contestProblem.points}</td>
                  {user && (
                    <td className="px-3 py-3">
                      {accepted ? (
                        <span className="font-medium text-emerald-700">✓ Đã AC</span>
                      ) : (
                        <span className="text-[var(--muted)]">Chưa AC</span>
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
