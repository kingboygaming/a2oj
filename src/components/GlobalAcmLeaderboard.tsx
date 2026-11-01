"use client";

import { useState } from "react";
import Link from "next/link";

type Standing = {
  userId: string;
  username: string;
  displayName: string;
  hasAvatar: boolean;
  solved: number;
  penalty: number;
  rankColorClass?: string;
};

export function GlobalAcmLeaderboard({ standings }: { standings: Standing[] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--paper)]">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--teal)]">
            Sân chơi toàn hệ thống
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--navy)]">
            Bảng xếp hạng ACM
          </h2>
        </div>
        <span className="rounded-full bg-[var(--background)] px-2.5 py-1 text-xs text-[var(--muted)]">
          {standings.length} thí sinh
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[400px] text-left text-sm">
          <thead className="bg-[var(--background)] text-xs text-[var(--muted)]">
            <tr>
              <th className="w-14 px-5 py-3 font-medium">Hạng</th>
              <th className="px-3 py-3 font-medium">Thí sinh</th>
              <th className="px-3 py-3 text-right font-medium">AC</th>
              <th className="px-5 py-3 text-right font-medium">Penalty (phút)</th>
            </tr>
          </thead>
          <tbody>
            {standings.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-sm text-[var(--muted)]">
                  Chưa có thí sinh nào được xếp hạng.
                </td>
              </tr>
            ) : (
              standings.slice(0, 5).map((standing, index) => (
                <StandingRow
                  key={standing.userId}
                  standing={standing}
                  rank={index + 1}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <div
        id="global-acm-full"
        className={`grid transition-[grid-template-rows,opacity] duration-500 ease-in-out ${
          expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
        aria-hidden={!expanded}
        inert={!expanded}
      >
        <div className="min-h-0 overflow-hidden">
          {standings.length > 5 && (
            <div className="max-h-[28rem] overflow-auto border-t border-[var(--line)]">
              <table className="w-full min-w-[400px] text-left text-sm">
                <caption className="sr-only">Bảng xếp hạng ACM toàn hệ thống</caption>
                <tbody>
                  {standings.slice(5).map((standing, index) => (
                    <StandingRow
                      key={standing.userId}
                      standing={standing}
                      rank={index + 6}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-[var(--line)] bg-[var(--background)] px-5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            disabled={standings.length <= 5}
            aria-expanded={expanded}
            aria-controls="global-acm-full"
            onClick={() => setExpanded((current) => !current)}
            className="flex items-center gap-2 text-left text-sm font-medium text-[var(--teal)] hover:underline disabled:cursor-default disabled:no-underline disabled:opacity-70"
          >
            <span>
              {standings.length <= 5
                ? "Đang hiển thị toàn bộ bảng xếp hạng"
                : expanded
                  ? "Thu gọn bảng xếp hạng"
                  : "Xem thêm"}
            </span>
            <span
              aria-hidden="true"
              className={`transition-transform duration-400 ${expanded ? "rotate-180" : ""}`}
            >
              ↓
            </span>
          </button>
          <Link
            href="/leaderboard"
            className="text-sm font-medium text-[var(--teal)] hover:underline"
          >
            Bảng xếp hạng đầy đủ →
          </Link>
        </div>
        <p className="mt-1 text-[11px] text-[var(--muted)]">
          Mỗi đề chỉ tính AC đầu tiên; mỗi lần nộp sai trước AC cộng 20 phút penalty. Không tính thời gian giải do không có mốc contest chung.
        </p>
      </div>
    </section>
  );
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

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function StandingRow({ standing, rank }: { standing: Standing; rank: number }) {
  const color = avatarColor(standing.username);
  return (
    <tr className="border-t border-[var(--line)] transition hover:bg-[var(--background)]">
      <td className="px-5 py-3">
        <span
          className={`inline-flex size-7 items-center justify-center rounded-full font-mono text-xs font-bold ring-1 ring-inset ${
            rank === 1
              ? "bg-amber-400/15 text-amber-400 ring-amber-400/30"
              : rank === 2
                ? "bg-slate-400/15 text-slate-300 ring-slate-400/30"
                : rank === 3
                  ? "bg-orange-500/15 text-orange-400 ring-orange-500/30"
                  : "text-[var(--muted)] ring-transparent"
          }`}
        >
          {rank}
        </span>
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-2.5">
          {standing.hasAvatar ? (
            <img
              src={`/api/users/${encodeURIComponent(standing.username)}/avatar`}
              alt=""
              className="size-8 shrink-0 rounded-full object-cover ring-1 ring-inset ring-white/10"
            />
          ) : (
            <span className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-1 ring-inset ring-white/10 ${color}`}>
              {getInitials(standing.displayName)}
            </span>
          )}
          <div className="min-w-0">
            <Link
              href={`/users/${encodeURIComponent(standing.username)}`}
              className={`block font-medium ${standing.rankColorClass ?? "text-slate-600 dark:text-slate-300"} hover:underline`}
            >
              {standing.displayName}
            </Link>
            <p className="text-[11px] text-[var(--muted)]">@{standing.username}</p>
          </div>
        </div>
      </td>
      <td className="px-3 py-3 text-right font-mono font-semibold tabular-nums text-emerald-400">
        {standing.solved}
      </td>
      <td className="px-5 py-3 text-right font-mono text-xs tabular-nums text-[var(--muted)]">
        {standing.penalty}
      </td>
    </tr>
  );
}
