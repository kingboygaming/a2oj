import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent, CardHeader } from "@/components/Card";
import { Badge, DifficultyBadge } from "@/components/Badge";
import { Button } from "@/components/Button";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 10;

const DIFFICULTIES = ["EASY", "MEDIUM", "HARD"] as const;
const DIFFICULTY_LABELS: Record<(typeof DIFFICULTIES)[number], string> = {
  EASY: "Dễ",
  MEDIUM: "Trung bình",
  HARD: "Khó",
};

const DIFF: Record<string, string> = {
  EASY: "Dễ",
  MEDIUM: "TB",
  HARD: "Khó",
};

export default async function ProblemListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; difficulty?: string; solved?: string; page?: string; tag?: string }>;
}) {
  const { q, difficulty: difficultyParam, solved: solvedParam, page: pageParam, tag: tagParam } = await searchParams;
  const user = await getCurrentUser();
  const staff = user?.role === "TEACHER" || user?.role === "ADMIN";
  const difficulty = DIFFICULTIES.find((value) => value === difficultyParam);
  const tags = await prisma.tag.findMany({ orderBy: { name: "asc" }, select: { name: true } });
  const tag = tags.some((item) => item.name === tagParam) ? tagParam : undefined;
  const solvedFilter =
    user && (solvedParam === "solved" || solvedParam === "unsolved")
      ? solvedParam
      : undefined;
  const userAcSubmission = user
    ? { userId: user.id, verdict: "AC" as const, contestId: null }
    : undefined;

  const where = {
      AND: [
        q
          ? { OR: [{ title: { contains: q } }, { slug: { contains: q } }] }
          : {},
        difficulty ? { difficulty } : {},
        tag ? { tags: { some: { name: tag } } } : {},
        solvedFilter === "solved" && userAcSubmission
          ? { submissions: { some: userAcSubmission } }
          : {},
        solvedFilter === "unsolved" && userAcSubmission
          ? { NOT: { submissions: { some: userAcSubmission } } }
          : {},
        { contestOnly: false },
        staff
          ? {}
          : user
            ? { OR: [{ published: true }, { authorId: user.id }] }
            : { published: true },
      ],
    };
  const totalProblems = await prisma.problem.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalProblems / PAGE_SIZE));
  const requestedPage = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);
  const currentPage = Math.min(requestedPage, totalPages);

  const problems = await prisma.problem.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (currentPage - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: {
      _count: { select: { submissions: { where: { contestId: null } } } },
      tags: { orderBy: { name: "asc" } },
      submissions: userAcSubmission
        ? { where: userAcSubmission, select: { id: true }, take: 1 }
        : false,
    },
  });

  function pageHref(page: number) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (difficulty) params.set("difficulty", difficulty);
    if (tag) params.set("tag", tag);
    if (solvedFilter) params.set("solved", solvedFilter);
    params.set("page", String(page));
    return `/problems?${params.toString()}`;
  }

  return (
    <div className="space-y-6">
      {/* Enhanced Header with gradient */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-gradient-to-br from-[var(--paper)] via-[var(--background)] to-[var(--paper)] p-8">
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--teal)]/5 via-transparent to-[var(--amber)]/5" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl" aria-hidden="true">📚</span>
              <h1 className="text-3xl font-bold text-[var(--navy)]">Danh sách bài tập</h1>
            </div>
            <p className="text-sm text-[var(--muted)]">
              <span className="font-semibold text-[var(--teal)]">{totalProblems}</span> bài tập
              {user && ` · ${problems.filter((problem) => problem.submissions.length > 0).length} bài đã giải trên trang này`}
            </p>
          </div>
          {user?.role === "ADMIN" && (
            <Button href="/admin/problems" variant="secondary" icon="⚙️">
              Quản lý đề
            </Button>
          )}
        </div>
      </div>

      {/* Modern Search & Filters */}
      <Card variant="glass">
        <CardContent>
          <form className="space-y-4">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-[var(--muted)]" aria-hidden="true">🔍</span>
              <input
                type="text"
                name="q"
                defaultValue={q}
                placeholder="Tìm kiếm bài tập theo tiêu đề hoặc slug..."
                className="w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-4 py-3.5 pl-12 text-sm text-[var(--navy)] placeholder:text-[var(--muted)] focus:border-[var(--teal)] focus:outline-none focus:ring-2 focus:ring-[var(--teal)]/20 transition-all"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <select
                name="difficulty"
                defaultValue={difficulty ?? ""}
                aria-label="Lọc theo độ khó"
                className="rounded-xl border border-[var(--line)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--navy)] focus:border-[var(--teal)] focus:outline-none focus:ring-2 focus:ring-[var(--teal)]/20 transition-all"
              >
                <option value="">🎯 Mọi độ khó</option>
                {DIFFICULTIES.map((value) => (
                  <option key={value} value={value}>
                    {DIFFICULTY_LABELS[value]}
                  </option>
                ))}
              </select>

              <select
                name="tag"
                defaultValue={tag ?? ""}
                aria-label="Lọc theo tag"
                className="rounded-xl border border-[var(--line)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--navy)] focus:border-[var(--teal)] focus:outline-none focus:ring-2 focus:ring-[var(--teal)]/20 transition-all"
              >
                <option value="">🏷️ Mọi tag</option>
                {tags.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
              </select>

              {user && (
                <select
                  name="solved"
                  defaultValue={solvedFilter ?? ""}
                  aria-label="Lọc theo trạng thái giải"
                  className="rounded-xl border border-[var(--line)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--navy)] focus:border-[var(--teal)] focus:outline-none focus:ring-2 focus:ring-[var(--teal)]/20 transition-all"
                >
                  <option value="">📊 Mọi trạng thái</option>
                  <option value="solved">✓ Đã giải</option>
                  <option value="unsolved">○ Chưa giải</option>
                </select>
              )}

              <Button type="submit" variant="primary" icon="→" iconPosition="right" className="w-full">
                Tìm kiếm
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {problems.length === 0 ? (
        <Card>
          <EmptyState
            type={q || difficulty || tag || solvedFilter ? "no-results" : "no-problems"}
            title={
              q || difficulty || tag || solvedFilter
                ? "Không tìm thấy bài tập phù hợp"
                : "Chưa có bài tập nào"
            }
            description={
              q || difficulty || tag || solvedFilter
                ? "Thử thay đổi từ khóa hoặc đặt lại bộ lọc để tìm kiếm rộng hơn."
                : "Hãy là người đầu tiên tạo bài tập và chia sẻ với cộng đồng!"
            }
            action={
              q || difficulty || solvedFilter
                ? { label: "Xóa bộ lọc", href: "/problems" }
                : { label: "Đóng góp bài tập mới", href: "/problems/new" }
            }
          />
        </Card>
      ) : (
        <>
          {/* Modern Card-based Problem List */}
          <div className="grid gap-4">
            {problems.map((p) => (
              <Card key={p.id} hover className="group">
                <div className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1 space-y-2">
                      {/* Status badges */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-lg bg-[var(--surface-strong)] px-2.5 py-1 font-mono text-xs font-semibold text-[var(--muted)]">
                          {p.slug}
                        </span>
                        {(!p.published || p.contestOnly) && (
                          <>
                            {!p.published && (
                              <Badge variant="warning" size="sm" icon="⚠">
                                CHƯA DUYỆT
                              </Badge>
                            )}
                            {p.contestOnly && (
                              <Badge variant="purple" size="sm" icon="🏆">
                                CHỈ CONTEST
                              </Badge>
                            )}
                          </>
                        )}
                        {p.ioMode === "FILE" && (
                          <Badge variant="info" size="sm" icon="📄">
                            FILE I/O
                          </Badge>
                        )}
                        {p.judgeType === "HEURISTIC" && (
                          <Badge variant="purple" size="sm" icon="🎯">
                            Heuristic
                          </Badge>
                        )}
                        <Badge variant="teal" size="sm">
                          {p.scoringMode === "VNOI" ? "VNOI" : "ICPC"}
                        </Badge>
                      </div>

                      {/* Title */}
                      <Link
                        href={`/problems/${p.slug}`}
                        prefetch={true}
                        className="block text-lg font-semibold text-[var(--navy)] hover:text-[var(--teal)] transition-colors group-hover:text-[var(--teal)]"
                      >
                        {p.title}
                      </Link>

                      {/* Tags */}
                      {p.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {p.tags.slice(0, 5).map((item) => (
                            <Link
                              key={item.id}
                              href={`/problems?tag=${encodeURIComponent(item.name)}`}
                              className="inline-flex items-center rounded-full bg-purple-500/10 px-2.5 py-1 text-xs font-medium text-purple-400 ring-1 ring-inset ring-purple-500/20 hover:bg-purple-500/20 transition-colors"
                            >
                              #{item.name}
                            </Link>
                          ))}
                          {p.tags.length > 5 && (
                            <span className="inline-flex items-center text-xs text-[var(--muted)]">
                              +{p.tags.length - 5} thêm
                            </span>
                          )}
                        </div>
                      )}

                      {/* Metadata */}
                      <div className="flex items-center gap-4 text-xs text-[var(--muted)]">
                        <span className="flex items-center gap-1.5">
                          <span aria-hidden="true">📊</span>
                          {p._count.submissions} bài nộp
                        </span>
                        {(staff || p.authorId === user?.id) && (
                          <Link
                            href={`/problems/${p.slug}/edit`}
                            className="flex items-center gap-1 font-medium text-[var(--teal)] hover:underline"
                          >
                            <span aria-hidden="true">✏️</span>
                            Chỉnh sửa
                          </Link>
                        )}
                      </div>
                    </div>

                    {/* Right side: Difficulty & Status */}
                    <div className="flex flex-col items-end gap-2.5 shrink-0">
                      <DifficultyBadge difficulty={p.difficulty as "EASY" | "MEDIUM" | "HARD"} />
                      {user && (
                        p.submissions.length > 0 ? (
                          <Badge variant="success" icon="✓" size="md">
                            Đã giải
                          </Badge>
                        ) : (
                          <Badge variant="default" size="md">
                            Chưa giải
                          </Badge>
                        )
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          {totalPages > 1 && (
            <nav aria-label="Phân trang bài tập" className="flex flex-wrap items-center justify-center gap-3">
              {currentPage > 1 ? (
                <Link 
                  href={pageHref(currentPage - 1)} 
                  className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--paper)] px-4 py-2.5 text-sm font-medium text-[var(--teal)] transition-all hover:border-[var(--teal)] hover:shadow-lg hover:shadow-[var(--teal)]/20"
                >
                  <span aria-hidden="true">←</span>
                  Trang trước
                </Link>
              ) : (
                <span className="flex items-center gap-2 rounded-lg border border-[var(--line)] px-4 py-2.5 text-sm text-[var(--muted)] opacity-50">
                  <span aria-hidden="true">←</span>
                  Trang trước
                </span>
              )}
              
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-[var(--teal)] px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-[var(--teal)]/30" aria-live="polite">
                  {currentPage}
                </span>
                <span className="text-sm text-[var(--muted)]">/</span>
                <span className="text-sm font-medium text-[var(--navy)]">{totalPages}</span>
              </div>

              {currentPage < totalPages ? (
                <Link 
                  href={pageHref(currentPage + 1)} 
                  className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--paper)] px-4 py-2.5 text-sm font-medium text-[var(--teal)] transition-all hover:border-[var(--teal)] hover:shadow-lg hover:shadow-[var(--teal)]/20"
                >
                  Trang sau
                  <span aria-hidden="true">→</span>
                </Link>
              ) : (
                <span className="flex items-center gap-2 rounded-lg border border-[var(--line)] px-4 py-2.5 text-sm text-[var(--muted)] opacity-50">
                  Trang sau
                  <span aria-hidden="true">→</span>
                </span>
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
