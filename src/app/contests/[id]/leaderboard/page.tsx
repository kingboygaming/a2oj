import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ContestNavigation } from "@/components/ContestNavigation";
import { getRankColorClasses } from "@/lib/ranks";
import { calculateContestStandings } from "@/lib/contest-standings";
import { getContestScoringProblems } from "@/lib/scoring";

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
    include: {
      problems: {
        orderBy: { letter: "asc" },
        include: {
          problem: {
            select: {
              scoringMode: true,
              testCases: {
                orderBy: { order: "asc" },
                select: { points: true },
              },
            },
          },
        },
      },
    },
  });
  if (!contest) notFound();

  const subs = await prisma.submission.findMany({
    where: { contestId: contest.id },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: { user: { select: { id: true, displayName: true, username: true, avatarMimeType: true } } },
  });

  const scoringMode = contest.scoringMode === "VNOI" ? "VNOI" : "ICPC";
  const rows = calculateContestStandings(
    {
      startAt: contest.startAt,
      scoringMode,
      problems: getContestScoringProblems(contest.problems, contest.testLimit),
    },
    subs,
  ).map((row) => ({
    ...row,
    name: row.user?.displayName ?? row.userId,
    username: row.user?.username ?? "",
    hasAvatar: Boolean(row.user?.avatarMimeType),
  }));
  const rankColors = await getRankColorClasses(rows.map((row) => row.userId));

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
      <p className="mt-1 text-sm text-[var(--muted)]">
        {scoringMode === "VNOI"
          ? "Xếp theo tổng điểm cao nhất; nếu bằng điểm, ưu tiên người đạt điểm đó sớm hơn."
          : "Xếp theo số bài AC, sau đó là penalty."}
      </p>
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
              {scoringMode === "VNOI" ? (
                <th className="px-3 py-2.5 text-center">Tổng điểm</th>
              ) : (
                <>
                  <th className="px-3 py-2.5 text-center">AC</th>
                  <th className="px-3 py-2.5 text-center">Penalty</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-center text-[var(--muted)]" colSpan={contest.problems.length + (scoringMode === "VNOI" ? 3 : 4)}>
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
                  key={row.userId}
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
                      {row.hasAvatar ? (
                        <img
                          src={`/api/users/${encodeURIComponent(row.username)}/avatar`}
                          alt=""
                          className="size-8 shrink-0 rounded-full object-cover ring-1 ring-inset ring-white/10"
                        />
                      ) : (
                        <span className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-1 ring-inset ring-white/10 ${color}`}>
                          {getInitials(row.name)}
                        </span>
                      )}
                      <div className="min-w-0">
                        <Link
                          href={`/users/${encodeURIComponent(row.username)}`}
                          className={`block font-medium ${rankColors[row.userId] ?? "text-slate-600 dark:text-slate-300"} hover:underline`}
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
                    if (scoringMode === "VNOI") {
                      return (
                        <td key={p.problemId} className="px-3 py-3 text-center font-mono text-xs tabular-nums">
                          {cell.score}/{cell.maxScore}
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

                  {scoringMode === "VNOI" ? (
                    <td className="px-3 py-3 text-center font-mono font-semibold tabular-nums text-[var(--navy)]">
                      {row.totalScore}
                    </td>
                  ) : (
                    <>
                      <td className="px-3 py-3 text-center">
                        <span className="font-mono font-semibold tabular-nums text-emerald-400">
                          {row.solved}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center font-mono text-xs tabular-nums text-[var(--muted)]">
                        {row.penalty}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
