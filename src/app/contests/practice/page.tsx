import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/components/EmptyState";

export const dynamic = "force-dynamic";

export default async function PracticeContestsPage() {
  const now = new Date();
  const [user, contests] = await Promise.all([
    getCurrentUser(),
    prisma.contest.findMany({
      where: { endAt: { lte: now } },
      orderBy: { endAt: "desc" },
      include: {
        author: { select: { displayName: true, username: true } },
        _count: { select: { problems: true } },
      },
    }),
  ]);

  return (
    <div>
      <Link href="/contests" className="text-sm font-medium text-[var(--teal)] hover:underline">
        ← Contest
      </Link>
      <div className="mt-4">
        <p className="text-sm font-medium text-[var(--teal)]">Luyện tập theo đề cũ</p>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--navy)]">Practice Contest</h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
          Làm lại các contest đã kết thúc theo nhịp độ của bạn. Bài nộp luyện tập được chấm độc lập, không ảnh hưởng bảng xếp hạng contest.
        </p>
      </div>

      <div className="mt-6 space-y-3">
        {contests.map((contest) => (
          <Link
            key={contest.id}
            href={`/contests/${contest.slug}?practice=1`}
            className="block rounded-xl border border-[var(--line)] bg-[var(--paper)] p-5 transition hover:border-[var(--teal)]/50 hover:shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-[var(--navy)]">{contest.title}</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {contest.description || "Luyện tập lại các bài trong contest này."}
                </p>
              </div>
              <span className="rounded-full bg-[var(--teal)]/10 px-3 py-1 text-xs font-medium text-[var(--teal)]">
                {contest._count.problems} bài · {contest.passwordHash ? "Cần mật khẩu" : "Mở"}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
              <span>Kết thúc: {contest.endAt.toLocaleString("vi-VN")}</span>
              <span>Tạo bởi: {contest.author.displayName} (@{contest.author.username})</span>
              <span>{contest.scoringMode === "VNOI" ? "Chấm VNOI" : "Chấm ICPC"}</span>
            </div>
            {contest.passwordHash && !user && (
              <p className="mt-3 text-xs text-amber-700">Đăng nhập và nhập mật khẩu contest để mở đề.</p>
            )}
          </Link>
        ))}
        {contests.length === 0 && (
          <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)]">
            <EmptyState
              type="no-contests"
              title="Chưa có contest để luyện tập"
              description="Các contest đã kết thúc sẽ xuất hiện tại đây."
              action={{ label: "Xem danh sách contest", href: "/contests" }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
