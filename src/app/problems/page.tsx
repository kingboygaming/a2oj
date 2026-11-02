import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { EmptyState } from "@/components/EmptyState";

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
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--navy)]">Danh sách bài tập</h1>
          <p className="text-sm text-[var(--muted)]">
            {totalProblems} đề
            {user && ` · ${problems.filter((problem) => problem.submissions.length > 0).length} bài đã giải trên trang này`}
          </p>
        </div>
        <form className="flex flex-wrap gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Tìm slug hoặc tiêu đề"
            className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm"
          />
          <select
            name="difficulty"
            defaultValue={difficulty ?? ""}
            aria-label="Lọc theo độ khó"
            className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm"
          >
            <option value="">Mọi độ khó</option>
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
            className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm"
          >
            <option value="">Mọi tag</option>
            {tags.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
          </select>
          {user && (
            <select
              name="solved"
              defaultValue={solvedFilter ?? ""}
              aria-label="Lọc theo trạng thái giải"
              className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm"
            >
              <option value="">Mọi trạng thái</option>
              <option value="solved">Đã giải</option>
              <option value="unsolved">Chưa giải</option>
            </select>
          )}
          <button className="rounded-md bg-[var(--surface-strong)] px-3 py-2 text-sm text-white">Tìm</button>
        </form>
      </div>

      {problems.length === 0 ? (
        <div className="mt-6 rounded-xl border border-[var(--line)] bg-[var(--paper)]">
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
        </div>
      ) : (
        <>
          <div className="mt-6 overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--paper)]">
            <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-[var(--surface-strong)] text-[var(--cream)]">
              <tr>
                <th className="px-3 py-2 font-medium">Mã</th>
                <th className="px-3 py-2 font-medium">Tiêu đề</th>
                <th className="px-3 py-2 font-medium">Độ khó</th>
                {user && <th className="px-3 py-2 font-medium">Trạng thái</th>}
                <th className="px-3 py-2 font-medium">Nộp</th>
              </tr>
            </thead>
            <tbody>
              {problems.map((p) => (
                <tr key={p.id} className="border-t border-[var(--line)] transition hover:bg-[var(--background)]">
                  <td className="px-3 py-2 font-mono text-xs">{p.slug}</td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/problems/${p.slug}`}
                      prefetch={true}
                      className="font-medium text-[var(--teal)] hover:underline"
                    >
                      {p.title}
                    </Link>
                    {p.tags.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {p.tags.map((item) => <Link key={item.id} href={`/problems?tag=${encodeURIComponent(item.name)}`} className="rounded-full bg-[var(--teal)]/10 px-2 py-0.5 text-[11px] text-[var(--teal)] hover:bg-[var(--teal)]/20">{item.name}</Link>)}
                      </div>
                    )}
                    {p.ioMode === "FILE" && (
                      <span className="ml-2 inline-flex items-center rounded bg-amber-500/10 px-1.5 py-0.5 font-mono text-[11px] text-amber-700 dark:text-amber-400">
                        📁 {p.inputFile || `${p.slug.toUpperCase()}.INP`}
                      </span>
                    )}
                    {p.judgeType === "HEURISTIC" && (
                      <span className="ml-2 inline-flex items-center rounded bg-purple-500/10 px-1.5 py-0.5 text-[11px] font-medium text-purple-700 dark:text-purple-400">
                        🎯 Heuristic
                      </span>
                    )}
                    <span className="ml-2 inline-flex items-center rounded bg-sky-500/10 px-1.5 py-0.5 text-[11px] font-medium text-sky-700 dark:text-sky-400">
                      {p.scoringMode === "VNOI" ? "VNOI" : "ICPC"}
                    </span>
                    {!p.published && (
                      <>
                        <span className="ml-2 text-xs text-amber-800">chờ duyệt</span>
                        {(staff || p.authorId === user?.id) && (
                          <Link
                            href={`/problems/${p.slug}/edit`}
                            className="ml-2 text-xs font-medium text-[var(--teal)] hover:underline"
                          >
                            [Chỉnh sửa]
                          </Link>
                        )}
                      </>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <DifficultyBadge difficulty={p.difficulty} />
                  </td>
                  {user && (
                    <td className="px-3 py-2">
                      {p.submissions.length > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-400 ring-1 ring-inset ring-emerald-500/30">
                          ✓ Đã giải
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md bg-slate-500/10 px-2 py-0.5 text-xs text-slate-400 ring-1 ring-inset ring-slate-500/20">
                          Chưa giải
                        </span>
                      )}
                    </td>
                  )}
                  <td className="px-3 py-2">{p._count.submissions}</td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <nav aria-label="Phân trang bài tập" className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {currentPage > 1 ? (
                <Link href={pageHref(currentPage - 1)} className="rounded-md border border-[var(--line)] px-3 py-2 text-sm text-[var(--teal)] hover:bg-[var(--paper)]">
                  ← Trang trước
                </Link>
              ) : (
                <span className="rounded-md border border-[var(--line)] px-3 py-2 text-sm text-[var(--muted)] opacity-50">
                  ← Trang trước
                </span>
              )}
              <span className="px-2 text-sm text-[var(--muted)]" aria-live="polite">
                Trang {currentPage}/{totalPages}
              </span>
              {currentPage < totalPages ? (
                <Link href={pageHref(currentPage + 1)} className="rounded-md border border-[var(--line)] px-3 py-2 text-sm text-[var(--teal)] hover:bg-[var(--paper)]">
                  Trang sau →
                </Link>
              ) : (
                <span className="rounded-md border border-[var(--line)] px-3 py-2 text-sm text-[var(--muted)] opacity-50">
                  Trang sau →
                </span>
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  if (difficulty === "EASY")
    return (
      <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400 ring-1 ring-inset ring-emerald-500/30">
        Dễ
      </span>
    );
  if (difficulty === "MEDIUM")
    return (
      <span className="inline-flex items-center rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-400 ring-1 ring-inset ring-amber-500/30">
        Trung bình
      </span>
    );
  return (
    <span className="inline-flex items-center rounded-md bg-rose-500/10 px-2 py-0.5 text-xs font-semibold text-rose-400 ring-1 ring-inset ring-rose-500/30">
      Khó
    </span>
  );
}
