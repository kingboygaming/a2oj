"use client";

import { useState } from "react";
import Link from "next/link";

type Standing = {
  userId: string;
  username: string;
  displayName: string;
  solved: number;
  penalty: number;
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
        <button
          type="button"
          disabled={standings.length <= 5}
          aria-expanded={expanded}
          aria-controls="global-acm-full"
          onClick={() => setExpanded((current) => !current)}
          className="flex w-full items-center justify-between gap-3 text-left text-sm font-medium text-[var(--teal)] hover:underline disabled:cursor-default disabled:no-underline disabled:opacity-70"
        >
          <span>
            {standings.length <= 5
              ? "Đang hiển thị toàn bộ bảng xếp hạng"
              : expanded
                ? "Thu gọn bảng xếp hạng"
                : "Xem bảng xếp hạng toàn server"}
          </span>
          <span
            aria-hidden="true"
            className={`transition-transform duration-400 ${expanded ? "rotate-180" : ""}`}
          >
            ↓
          </span>
        </button>
        <p className="mt-1 text-[11px] text-[var(--muted)]">
          Mỗi đề chỉ tính AC đầu tiên; mỗi lần nộp sai trước AC cộng 20 phút penalty. Không tính thời gian giải do không có mốc contest chung.
        </p>
      </div>
    </section>
  );
}

function StandingRow({ standing, rank }: { standing: Standing; rank: number }) {
  return (
    <tr className="border-t border-[var(--line)] transition hover:bg-[var(--background)]">
      <td className="px-5 py-3">
        <span
          className={`inline-flex size-7 items-center justify-center rounded-full font-mono text-xs font-bold ${
            rank === 1
              ? "bg-amber-400/15 text-amber-500"
              : rank === 2
                ? "bg-slate-400/15 text-slate-400"
                : rank === 3
                  ? "bg-orange-500/15 text-orange-500"
                  : "text-[var(--muted)]"
          }`}
        >
          {rank}
        </span>
      </td>
      <td className="px-3 py-3">
        <Link
          href={`/users/${encodeURIComponent(standing.username)}`}
          className="font-medium text-[var(--navy)] hover:text-[var(--teal)] hover:underline"
        >
          {standing.displayName}
        </Link>
        <p className="text-[11px] text-[var(--muted)]">@{standing.username}</p>
      </td>
      <td className="px-3 py-3 text-right font-mono font-semibold tabular-nums text-emerald-500">
        {standing.solved}
      </td>
      <td className="px-5 py-3 text-right font-mono text-xs tabular-nums text-[var(--muted)]">
        {standing.penalty}
      </td>
    </tr>
  );
}
