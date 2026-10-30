import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ContestNavigation } from "@/components/ContestNavigation";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const contest = await prisma.contest.findFirst({
    where: { OR: [{ slug: id }, { id }] },
    include: { problems: { orderBy: { letter: "asc" } } },
  });
  if (!contest) notFound();

  const subs = await prisma.submission.findMany({
    where: { contestId: contest.id },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { id: true, displayName: true, username: true } } },
  });

  type Cell = { accepted: boolean; attempts: number };
  const byUser = new Map<
    string,
    {
      name: string;
      username: string;
      cells: Record<string, Cell>;
      solved: number;
      penalty: number;
    }
  >();

  for (const sub of subs) {
    const row =
      byUser.get(sub.userId) ??
      {
        name: sub.user.displayName,
        username: sub.user.username,
        cells: {},
        solved: 0,
        penalty: 0,
      };
    const cell = row.cells[sub.problemId] ?? { accepted: false, attempts: 0 };
    if (cell.accepted) {
      byUser.set(sub.userId, row);
      continue;
    }
    cell.attempts += 1;
    if (sub.verdict === "AC") {
      cell.accepted = true;
      row.solved += 1;
      row.penalty +=
        Math.max(0, Math.floor((sub.createdAt.getTime() - contest.startAt.getTime()) / 60000)) +
        (cell.attempts - 1) * 20;
    }
    row.cells[sub.problemId] = cell;
    byUser.set(sub.userId, row);
  }

  const rows = [...byUser.values()].sort((a, b) => {
    if (b.solved !== a.solved) return b.solved - a.solved;
    return a.penalty - b.penalty;
  });

  return (
    <div>
      <p className="text-sm text-[var(--teal)]">Contest</p>
      <h1 className="text-2xl font-semibold text-[var(--navy)]">{contest.title}</h1>
      <ContestNavigation slug={contest.slug} active="standings" />
      <h2 className="mt-5 text-xl font-semibold text-[var(--navy)]">Bảng xếp hạng</h2>
      <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--paper)]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--surface-strong)] text-[var(--cream)]">
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Thí sinh</th>
              {contest.problems.map((p) => (
                <th key={p.problemId} className="px-3 py-2">
                  {p.letter}
                </th>
              ))}
              <th className="px-3 py-2">AC</th>
              <th className="px-3 py-2">Penalty</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-[var(--muted)]" colSpan={contest.problems.length + 4}>
                  Chưa có bài nộp trong contest.
                </td>
              </tr>
            )}
            {rows.map((row, i) => (
              <tr key={row.username} className="border-t border-[var(--line)]">
                <td className="px-3 py-2">{i + 1}</td>
                <td className="px-3 py-2">
                  <Link
                    href={`/users/${encodeURIComponent(row.username)}`}
                    className="hover:text-[var(--teal)] hover:underline"
                  >
                    {row.name}
                  </Link>
                </td>
                {contest.problems.map((p) => {
                  const cell = row.cells[p.problemId];
                  return (
                    <td key={p.problemId} className="px-3 py-2 font-mono text-xs">
                      {cell?.accepted ? `+${cell.attempts}` : cell ? `-${cell.attempts}` : "."}
                    </td>
                  );
                })}
                <td className="px-3 py-2">{row.solved}</td>
                <td className="px-3 py-2">{row.penalty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
