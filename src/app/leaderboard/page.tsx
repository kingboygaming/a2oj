import Link from "next/link";
import { getGlobalAcmLeaderboard } from "@/lib/global-leaderboard";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/components/EmptyState";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bảng xếp hạng — A2OJ",
  description: "Bảng xếp hạng ACM toàn hệ thống A2OJ — xếp theo số bài AC và penalty.",
};

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

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const RANK_MEDAL: Record<number, { emoji: string; cls: string }> = {
  1: { emoji: "🥇", cls: "bg-amber-400/15 text-amber-400 ring-amber-400/30" },
  2: { emoji: "🥈", cls: "bg-slate-400/15 text-slate-300 ring-slate-400/30" },
  3: { emoji: "🥉", cls: "bg-orange-500/15 text-orange-400 ring-orange-500/30" },
};

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q = "", page: pageStr = "1" } = await searchParams;
  const PAGE_SIZE = 25;
  const page = Math.max(1, Number(pageStr) || 1);

  const [standings, totalProblems, totalSubmissions] = await Promise.all([
    getGlobalAcmLeaderboard(),
    prisma.problem.count({ where: { published: true, contestOnly: false } }),
    prisma.submission.count({ where: { verdict: "AC" } }),
  ]);

  // Filter by search query
  const query = q.trim().toLowerCase();
  const filtered = query
    ? standings.filter(
        (s) =>
          s.username.toLowerCase().includes(query) ||
          s.displayName.toLowerCase().includes(query),
      )
    : standings;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const slice = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Compute global rank (position in original full standings, unfiltered)
  const rankMap = new Map(standings.map((s, i) => [s.userId, i + 1]));

  // Stats
  const maxSolved = standings[0]?.solved ?? 0;

  function buildHref(p: number, newQ?: string) {
    const params = new URLSearchParams();
    const qVal = newQ !== undefined ? newQ : q;
    if (qVal) params.set("q", qVal);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `/leaderboard${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--teal)]">
            Sân chơi toàn hệ thống
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-[var(--navy)]">
            Bảng xếp hạng ACM
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Xếp theo số bài AC giảm dần · penalty tăng dần.{" "}
            <span className="tabular-nums">
              {standings.length.toLocaleString("vi-VN")} thí sinh
            </span>
          </p>
        </div>

        {/* Stats pills */}
        <div className="flex flex-wrap gap-2">
          <StatPill label="Thí sinh" value={standings.length} color="text-sky-400" bg="bg-sky-500/10" />
          <StatPill label="Bài AC" value={totalSubmissions} color="text-emerald-400" bg="bg-emerald-500/10" />
          <StatPill label="Đề đã có" value={totalProblems} color="text-violet-400" bg="bg-violet-500/10" />
        </div>
      </div>

      {/* Top 3 podium */}
      {!query && page === 1 && standings.length >= 1 && (
        <PodiumSection standings={standings.slice(0, 3)} maxSolved={maxSolved} />
      )}

      {/* Search bar */}
      <SearchBar defaultValue={q} buildHref={buildHref} />

      {/* Table */}
      <section
        aria-label="Bảng xếp hạng"
        className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--paper)]"
      >
        {/* Table header info bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--surface-strong)] px-5 py-3">
          <p className="text-sm font-medium text-[var(--cream)]">
            {query
              ? `${filtered.length.toLocaleString("vi-VN")} kết quả cho "${q}"`
              : `Trang ${safePage} / ${totalPages}`}
          </p>
          <p className="text-xs text-[var(--muted)]">
            Mỗi đề chỉ tính AC đầu tiên · mỗi lần nộp sai +20 phút penalty
          </p>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            type="no-results"
            title="Không tìm thấy thí sinh nào"
            description={
              query
                ? `Không có kết quả phù hợp với từ khóa "${q}".`
                : "Chưa có dữ liệu xếp hạng."
            }
            action={{
              label: "Xem toàn bộ bảng xếp hạng",
              href: "/leaderboard",
            }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <caption className="sr-only">Bảng xếp hạng ACM toàn hệ thống A2OJ</caption>
              <thead className="bg-[var(--background)] text-xs text-[var(--muted)]">
                <tr>
                  <th scope="col" className="w-14 px-5 py-3 font-medium">
                    Hạng
                  </th>
                  <th scope="col" className="px-3 py-3 font-medium">
                    Thí sinh
                  </th>
                  <th scope="col" className="px-3 py-3 text-right font-medium">
                    Đã giải
                  </th>
                  <th scope="col" className="px-3 py-3 font-medium">
                    <span className="sr-only">Tiến độ</span>
                  </th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">
                    Penalty (phút)
                  </th>
                </tr>
              </thead>
              <tbody>
                {slice.map((standing) => {
                  const rank = rankMap.get(standing.userId) ?? 0;
                  const color = avatarColor(standing.username);
                  const medal = RANK_MEDAL[rank];
                  const pct = maxSolved > 0 ? Math.round((standing.solved / maxSolved) * 100) : 0;

                  return (
                    <tr
                      key={standing.userId}
                      className="border-t border-[var(--line)] transition-colors hover:bg-[var(--background)]"
                    >
                      {/* Rank */}
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex size-7 items-center justify-center rounded-full font-mono text-xs font-bold ring-1 ring-inset ${
                            medal
                              ? medal.cls
                              : "text-[var(--muted)] ring-transparent"
                          }`}
                        >
                          {rank}
                        </span>
                      </td>

                      {/* User */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-1 ring-inset ring-white/10 ${color}`}
                          >
                            {getInitials(standing.displayName)}
                          </span>
                          <div className="min-w-0">
                            <Link
                              href={`/users/${encodeURIComponent(standing.username)}`}
                              className="block font-medium text-[var(--navy)] hover:text-[var(--teal)] hover:underline"
                            >
                              {standing.displayName}
                              {medal && (
                                <span className="ml-1.5 text-base leading-none" aria-hidden="true">
                                  {medal.emoji}
                                </span>
                              )}
                            </Link>
                            <p className="text-[11px] text-[var(--muted)]">
                              @{standing.username}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Solved count */}
                      <td className="px-3 py-3 text-right">
                        <span className="font-mono font-semibold tabular-nums text-emerald-400">
                          {standing.solved}
                        </span>
                        <span className="ml-1 text-xs text-[var(--muted)]">AC</span>
                      </td>

                      {/* Progress bar */}
                      <td className="w-32 px-3 py-3">
                        <div
                          className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--line)]"
                          title={`${pct}% so với người dẫn đầu`}
                        >
                          <div
                            className="h-full rounded-full bg-emerald-500/60 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </td>

                      {/* Penalty */}
                      <td className="px-5 py-3 text-right font-mono text-xs tabular-nums text-[var(--muted)]">
                        {standing.penalty > 0
                          ? standing.penalty.toLocaleString("vi-VN")
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && !query && (
          <div className="flex items-center justify-center gap-1 border-t border-[var(--line)] bg-[var(--background)] px-5 py-3">
            <PaginationLink
              href={buildHref(safePage - 1)}
              disabled={safePage <= 1}
              label="← Trước"
            />
            {getPaginationRange(safePage, totalPages).map((item, i) =>
              item === "…" ? (
                <span key={`ellipsis-${i}`} className="px-2 text-[var(--muted)]">
                  …
                </span>
              ) : (
                <PaginationLink
                  key={item}
                  href={buildHref(item as number)}
                  active={item === safePage}
                  label={String(item)}
                />
              ),
            )}
            <PaginationLink
              href={buildHref(safePage + 1)}
              disabled={safePage >= totalPages}
              label="Sau →"
            />
          </div>
        )}
      </section>

      {/* Legend */}
      <p className="text-center text-xs text-[var(--muted)]">
        Không tính thời gian giải do không có mốc contest chung.
        Penalty chỉ tính khi bài được AC ít nhất một lần.
      </p>
    </div>
  );
}

/* ─── Sub-components ──────────────────────────────────────────── */

function StatPill({
  label,
  value,
  color,
  bg,
}: {
  label: string;
  value: number;
  color: string;
  bg: string;
}) {
  return (
    <span
      className={`flex items-center gap-1.5 rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-medium ${bg}`}
    >
      <span className={`font-mono font-bold tabular-nums ${color}`}>
        {value.toLocaleString("vi-VN")}
      </span>
      <span className="text-[var(--muted)]">{label}</span>
    </span>
  );
}

function PodiumSection({
  standings,
  maxSolved,
}: {
  standings: { userId: string; username: string; displayName: string; solved: number; penalty: number }[];
  maxSolved: number;
}) {
  // Reorder: 2nd, 1st, 3rd for podium visual effect
  const order = [standings[1], standings[0], standings[2]].filter(Boolean);
  const podiumHeights = ["h-24", "h-32", "h-16"];
  const ranks = [2, 1, 3];
  const podiumColors = [
    "bg-slate-400/15 border-slate-400/30 text-slate-300",
    "bg-amber-400/15 border-amber-400/30 text-amber-400",
    "bg-orange-500/15 border-orange-500/30 text-orange-400",
  ];

  return (
    <section
      aria-label="Top 3 thí sinh"
      className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--paper)] px-4 pb-0 pt-6"
    >
      <p className="mb-4 text-center text-xs font-semibold uppercase tracking-wider text-[var(--teal)]">
        Bục vinh danh
      </p>
      <div className="flex items-end justify-center gap-3">
        {order.map((s, i) => {
          if (!s) return null;
          const rank = ranks[i];
          const color = avatarColor(s.username);
          const pct = maxSolved > 0 ? Math.round((s.solved / maxSolved) * 100) : 0;
          return (
            <div key={s.userId} className="flex flex-col items-center gap-2">
              {/* Avatar + name */}
              <div className="flex flex-col items-center gap-1">
                <span
                  className={`inline-flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ring-2 ring-inset ring-white/10 ${color}`}
                >
                  {getInitials(s.displayName)}
                </span>
                <Link
                  href={`/users/${encodeURIComponent(s.username)}`}
                  className="max-w-[96px] truncate text-center text-xs font-medium text-[var(--navy)] hover:text-[var(--teal)] hover:underline"
                >
                  {s.displayName}
                </Link>
                <p className="text-[10px] text-[var(--muted)]">
                  {s.solved} AC · {s.penalty} phút
                </p>
              </div>
              {/* Podium block */}
              <div
                className={`flex w-24 flex-col items-center justify-start rounded-t-lg border border-b-0 pt-2 ${podiumHeights[i]} ${podiumColors[i]}`}
              >
                <span className="text-xl font-bold">
                  {rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉"}
                </span>
                <span className="mt-1 text-lg font-bold tabular-nums">
                  {rank}
                </span>
                <div
                  className="mt-1 h-1 w-10 rounded-full opacity-50"
                  style={{
                    background:
                      rank === 1
                        ? "#f59e0b"
                        : rank === 2
                          ? "#94a3b8"
                          : "#f97316",
                    width: `${pct}%`,
                    maxWidth: "80%",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SearchBar({
  defaultValue,
  buildHref,
}: {
  defaultValue: string;
  buildHref: (page: number, q?: string) => string;
}) {
  return (
    <form
      method="get"
      action="/leaderboard"
      className="flex gap-2"
      role="search"
      aria-label="Tìm kiếm thí sinh"
    >
      <div className="relative flex-1">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[var(--muted)]"
        >
          🔍
        </span>
        <input
          type="search"
          name="q"
          defaultValue={defaultValue}
          placeholder="Tìm theo tên hoặc username…"
          autoComplete="off"
          className="w-full rounded-lg border border-[var(--line)] bg-[var(--paper)] py-2 pl-9 pr-3 text-sm text-[var(--navy)] placeholder:text-[var(--muted)] focus:border-[var(--teal)] focus:outline-none"
        />
      </div>
      <button
        type="submit"
        className="rounded-lg border border-[var(--line)] bg-[var(--paper)] px-4 py-2 text-sm font-medium text-[var(--navy)] transition hover:border-[var(--teal)] hover:text-[var(--teal)]"
      >
        Tìm
      </button>
      {defaultValue && (
        <a
          href="/leaderboard"
          className="rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--teal)] hover:text-[var(--teal)]"
          aria-label="Xóa tìm kiếm"
        >
          ✕
        </a>
      )}
    </form>
  );
}

function PaginationLink({
  href,
  label,
  active = false,
  disabled = false,
}: {
  href: string;
  label: string;
  active?: boolean;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <span className="rounded-md px-3 py-1.5 text-xs text-[var(--muted)] opacity-40">
        {label}
      </span>
    );
  }
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
        active
          ? "bg-[var(--teal)] text-[var(--background)] shadow"
          : "text-[var(--navy)] hover:bg-[var(--line)] hover:text-[var(--teal)]"
      }`}
    >
      {label}
    </Link>
  );
}

function getPaginationRange(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "…")[] = [];
  const delta = 2;
  const left = current - delta;
  const right = current + delta;

  pages.push(1);
  if (left > 2) pages.push("…");
  for (let i = Math.max(2, left); i <= Math.min(total - 1, right); i++) {
    pages.push(i);
  }
  if (right < total - 1) pages.push("…");
  pages.push(total);
  return pages;
}
