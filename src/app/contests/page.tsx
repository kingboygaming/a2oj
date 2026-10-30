import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canManageContests } from "@/lib/auth";

export const dynamic = "force-dynamic";

function status(startAt: Date, endAt: Date) {
  const now = Date.now();
  if (now < startAt.getTime()) return "Sắp diễn ra";
  if (now > endAt.getTime()) return "Đã kết thúc";
  return "Đang thi";
}

export default async function ContestsPage() {
  const user = await getCurrentUser();
  const contests = await prisma.contest.findMany({
    orderBy: { startAt: "desc" },
    include: {
      _count: { select: { problems: true, registrations: true } },
    },
  });

  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--navy)]">Contest</h1>
          <p className="text-sm text-[var(--muted)]">Kỳ thi nội bộ và bảng xếp hạng</p>
        </div>
        {user && canManageContests(user.role) && (
          <Link
            href="/contests/new"
            className="rounded-md bg-[var(--surface-strong)] px-3 py-2 text-sm text-white"
          >
            Tạo kỳ thi
          </Link>
        )}
      </div>
      <div className="mt-6 space-y-3">
        {contests.map((c) => (
          <Link
            key={c.id}
            href={`/contests/${c.slug}`}
            className="block rounded-xl border border-[var(--line)] bg-[var(--paper)] p-4 hover:border-[var(--navy)]/40"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold text-[var(--navy)]">{c.title}</h2>
              <span className="text-xs font-medium text-[var(--teal)]">
                {status(c.startAt, c.endAt)}
              </span>
            </div>
            <p className="mt-1 text-sm text-[var(--muted)]">{c.description}</p>
            <p className="mt-2 text-xs text-[var(--muted)]">
              {c._count.problems} bài · {c._count.registrations} thí sinh ·{" "}
              {c.startAt.toLocaleString("vi-VN")} → {c.endAt.toLocaleString("vi-VN")}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
