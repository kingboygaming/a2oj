import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canManageContests } from "@/lib/auth";
import { ContestCountdownBadge } from "@/components/ContestCountdownBadge";
import { EmptyState } from "@/components/EmptyState";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";

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
    <div className="space-y-6">
      {/* Enhanced Header */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-gradient-to-br from-[var(--paper)] via-[var(--background)] to-[var(--paper)] p-8">
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--teal)]/5 via-transparent to-[var(--amber)]/5" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl" aria-hidden="true">🏆</span>
              <h1 className="text-3xl font-bold text-[var(--navy)]">Contest</h1>
            </div>
            <p className="text-sm text-[var(--muted)]">
              Kỳ thi nội bộ và bảng xếp hạng · <span className="font-semibold text-[var(--teal)]">{contests.length}</span> kỳ thi
            </p>
          </div>
          {canCreate && (
            <Button href="/contests/new" variant="primary" icon="+" iconPosition="left">
              Tạo kỳ thi mới
            </Button>
          )}
        </div>
      </div>

      {/* Practice Contest Banner */}
      <Link
        href="/contests/practice"
        className="group block overflow-hidden rounded-xl border-2 border-[var(--teal)]/30 bg-gradient-to-r from-[var(--teal)]/10 via-[var(--teal)]/5 to-transparent p-6 transition-all hover:border-[var(--teal)]/50 hover:shadow-lg hover:shadow-[var(--teal)]/20"
      >
        <div className="flex items-center gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-[var(--teal)]/20 text-2xl font-bold text-[var(--teal)] transition-transform group-hover:scale-110">
            ⌁
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold text-[var(--navy)] group-hover:text-[var(--teal)] transition-colors">
              Practice Contest
            </h3>
            <p className="text-sm text-[var(--muted)]">
              Luyện lại các contest đã kết thúc để nâng cao kỹ năng
            </p>
          </div>
          <span className="text-2xl text-[var(--teal)] transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
        </div>
      </Link>

      {/* Contest List */}
      <div className="grid gap-5">
        {contests.map((c) => {
          const now = Date.now();
          const isUpcoming = now < c.startAt.getTime();
          const isOngoing = now >= c.startAt.getTime() && now <= c.endAt.getTime();
          const isEnded = now > c.endAt.getTime();

          return (
            <Card key={c.id} hover className="group">
              <Link href={`/contests/${c.slug}`} className="block p-6">
                {/* Header */}
                <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {isOngoing && (
                        <Badge variant="success" icon="●" pulse>
                          ĐANG DIỄN RA
                        </Badge>
                      )}
                      {isUpcoming && (
                        <Badge variant="info" icon="📅">
                          SẮP DIỄN RA
                        </Badge>
                      )}
                      {isEnded && (
                        <Badge variant="default" icon="✓">
                          ĐÃ KẾT THÚC
                        </Badge>
                      )}
                      <Badge variant={c.scoringMode === "VNOI" ? "teal" : "purple"} size="sm">
                        {c.scoringMode === "VNOI" ? "VNOI" : "ICPC"}
                      </Badge>
                    </div>
                    <h2 className="text-xl font-bold text-[var(--navy)] group-hover:text-[var(--teal)] transition-colors mb-2">
                      {c.title}
                    </h2>
                    {c.description && (
                      <p className="text-sm text-[var(--muted)] line-clamp-2">{c.description}</p>
                    )}
                  </div>
                  <ContestCountdownBadge startAt={c.startAt} endAt={c.endAt} />
                </div>

                {/* Info Grid */}
                <div className="grid gap-4 rounded-lg border border-[var(--line)]/50 bg-[var(--background)]/50 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
                      <span aria-hidden="true">🎯</span>
                      Số bài
                    </div>
                    <div className="text-lg font-bold text-[var(--navy)]">{c._count.problems}</div>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
                      <span aria-hidden="true">👥</span>
                      Người đăng ký
                    </div>
                    <div className="text-lg font-bold text-[var(--navy)]">{c._count.registrations}</div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
                      <span aria-hidden="true">📅</span>
                      Bắt đầu
                    </div>
                    <div className="font-mono text-xs text-[var(--navy)]">{formatDateTime(c.startAt)}</div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
                      <span aria-hidden="true">🏁</span>
                      Kết thúc
                    </div>
                    <div className="font-mono text-xs text-[var(--navy)]">{formatDateTime(c.endAt)}</div>
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-4 flex items-center justify-between border-t border-[var(--line)]/30 pt-4">
                  <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                    <span>GV:</span>
                    <span className="font-semibold text-[var(--navy)]">{c.author.displayName}</span>
                    <span className="text-[var(--muted)]">@{c.author.username}</span>
                  </div>
                  <span className="text-[var(--teal)] transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
                </div>
              </Link>
            </Card>
          );
        })}

        {contests.length === 0 && (
          <Card>
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
          </Card>
        )}
      </div>
    </div>
  );
}
