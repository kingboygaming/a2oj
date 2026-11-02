import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canManageContests } from "@/lib/auth";
import { ContestCountdownBadge } from "@/components/ContestCountdownBadge";
import { EmptyState } from "@/components/EmptyState";

export const dynamic = "force-dynamic";

function formatDateTime(d: Date): string {
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const seconds = String(d.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export default async function ContestsPage() {
  const user = await getCurrentUser();
  const contests = await prisma.contest.findMany({
    orderBy: { startAt: "desc" },
    include: {
      author: { select: { displayName: true, username: true } },
      _count: { select: { problems: true, registrations: true } },
    },
  });

  const canCreate = user && canManageContests(user.role);

  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--navy)]">Contest</h1>
          <p className="text-sm text-[var(--muted)]">Kỳ thi nội bộ và bảng xếp hạng</p>
        </div>
        {canCreate && (
          <Link
            href="/contests/new"
            className="rounded-md bg-[var(--surface-strong)] px-3 py-2 text-sm text-white"
          >
            Tạo kỳ thi
          </Link>
        )}
      </div>

      <div className="mt-6 space-y-4">
        {contests.map((c) => (
          <Link
            key={c.id}
            href={`/contests/${c.slug}`}
            className="block rounded-xl border border-[var(--line)] bg-[var(--paper)] p-5 transition-all hover:border-[var(--navy)]/40 hover:shadow-sm"
          >
            {/* Header: Title & Timer Countdown Badge */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-[var(--navy)]">{c.title}</h2>
              <ContestCountdownBadge startAt={c.startAt} endAt={c.endAt} />
            </div>

            {/* Author / GV */}
            <p className="mt-1.5 text-xs text-[var(--muted)]">
              GV: <span className="font-medium text-[var(--navy)]">{c.author.displayName}</span>
              {c.description && <span className="ml-2 font-normal text-[var(--muted)]">· {c.description}</span>}
            </p>

            {/* Table-style Info Bar */}
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[var(--line)]/70 pt-3 text-xs sm:grid-cols-5">
              <div>
                <span className="block font-medium text-[var(--muted)]">Bắt đầu</span>
                <span className="font-mono text-slate-700">{formatDateTime(c.startAt)}</span>
              </div>
              <div>
                <span className="block font-medium text-[var(--muted)]">Kết thúc</span>
                <span className="font-mono text-slate-700">{formatDateTime(c.endAt)}</span>
              </div>
              <div>
                <span className="block font-medium text-[var(--muted)]">Loại kỳ thi</span>
                <span className="text-slate-700">Kỳ thi nội bộ ({c._count.problems} bài)</span>
              </div>
              <div>
                <span className="block font-medium text-[var(--muted)]">Cách tính điểm</span>
                <span className="text-slate-700">
                  {c.scoringMode === "VNOI"
                    ? "VNOI (Tổng điểm cao nhất)"
                    : "ICPC (AC + penalty)"}
                </span>
              </div>
              <div>
                <span className="block font-medium text-[var(--muted)]">Người tạo</span>
                <span className="font-mono text-slate-700">@{c.author.username}</span>
              </div>
            </div>
          </Link>
        ))}

        {contests.length === 0 && (
          <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)]">
            <EmptyState
              type="no-contests"
              title="Chưa có kỳ thi nào"
              description="Hiện tại chưa có kỳ thi hoặc lớp học nào diễn ra."
              action={
                canCreate
                  ? {
                      label: "Tạo kỳ thi mới",
                      href: "/contests/new",
                    }
                  : {
                      label: "Khám phá bài tập",
                      href: "/problems",
                    }
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}
