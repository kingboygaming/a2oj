import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ContestNavigation } from "@/components/ContestNavigation";

export const dynamic = "force-dynamic";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const AVATAR_COLORS = [
  "bg-sky-500/20 text-sky-400",
  "bg-violet-500/20 text-violet-400",
  "bg-emerald-500/20 text-emerald-400",
  "bg-amber-500/20 text-amber-400",
  "bg-rose-500/20 text-rose-400",
  "bg-teal-500/20 text-teal-400",
  "bg-orange-500/20 text-orange-400",
  "bg-pink-500/20 text-pink-400",
];

function avatarColor(username: string) {
  let hash = 0;
  for (const c of username) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

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

  const RANK_STYLES = [
    "bg-amber-400/15 text-amber-400 ring-amber-400/30",
    "bg-slate-400/15 text-slate-300 ring-slate-400/30",
    "bg-orange-500/15 text-orange-400 ring-orange-500/30",
  ];

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
              <th className="px-3 py-2.5">#</th>
              <th className="px-3 py-2.5">Thí sinh</th>
              {contest.problems.map((p) => (
                <th key={p.problemId} className="px-3 py-2.5 text-center font-mono">
                  {p.letter}
                </th>
              ))}
              <th className="px-3 py-2.5 text-center">AC</th>
              <th className="px-3 py-2.5 text-center">Penalty</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-center text-[var(--muted)]" colSpan={contest.problems.length + 4}>
                  Chưa có bài nộp trong contest.
                </td>
              </tr>
            )}
            {rows.map((row, i) => {
              const rank = i + 1;
              const rankStyle = RANK_STYLES[i] ?? "text-[var(--muted)]";
              const color = avatarColor(row.username);
              return (
                <tr
                  key={row.username}
                  className="border-t border-[var(--line)] transition hover:bg-[var(--background)]"
                >
                  {/* Rank */}
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex size-7 items-center justify-center rounded-full text-xs font-bold ring-1 ring-inset ${
                        i < 3 ? rankStyle : "text-[var(--muted)]"
                      }`}
                    >
                      {rank}
                    </span>
                  </td>

                  {/* Avatar + name */}
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-1 ring-inset ring-white/10 ${color}`}
                      >
                        {getInitials(row.name)}
                      </span>
                      <div className="min-w-0">
                        <Link
                          href={`/users/${encodeURIComponent(row.username)}`}
                          className="block font-medium text-[var(--navy)] hover:text-[var(--teal)] hover:underline"
                        >
                          {row.name}
                        </Link>
                        <p className="text-[11px] text-[var(--muted)]">@{row.username}</p>
                      </div>
                    </div>
                  </td>

                  {/* Problem cells */}
                  {contest.problems.map((p) => {
                    const cell = row.cells[p.problemId];
                    if (!cell) {
                      return (
                        <td key={p.problemId} className="px-3 py-3 text-center font-mono text-xs text-[var(--muted)]">
                          –
                        </td>
                      );
                    }
                    return cell.accepted ? (
                      <td key={p.problemId} className="px-3 py-3 text-center">
                        <span className="inline-flex items-center justify-center rounded-md bg-emerald-500/10 px-2 py-0.5 font-mono text-xs font-semibold text-emerald-400 ring-1 ring-inset ring-emerald-500/30">
                          +{cell.attempts}
                        </span>
                      </td>
                    ) : (
                      <td key={p.problemId} className="px-3 py-3 text-center">
                        <span className="inline-flex items-center justify-center rounded-md bg-rose-500/10 px-2 py-0.5 font-mono text-xs font-semibold text-rose-400 ring-1 ring-inset ring-rose-500/30">
                          -{cell.attempts}
                        </span>
                      </td>
                    );
                  })}

                  {/* AC count */}
                  <td className="px-3 py-3 text-center">
                    <span className="font-mono font-semibold tabular-nums text-emerald-400">
                      {row.solved}
                    </span>
                  </td>

                  {/* Penalty */}
                  <td className="px-3 py-3 text-center font-mono text-xs tabular-nums text-[var(--muted)]">
                    {row.penalty}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
