import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

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
  searchParams: Promise<{ q?: string; difficulty?: string; solved?: string }>;
}) {
  const { q, difficulty: difficultyParam, solved: solvedParam } = await searchParams;
  const user = await getCurrentUser();
  const staff = user?.role === "TEACHER" || user?.role === "ADMIN";
  const difficulty = DIFFICULTIES.find((value) => value === difficultyParam);
  const solvedFilter =
    user && (solvedParam === "solved" || solvedParam === "unsolved")
      ? solvedParam
      : undefined;
  const userAcSubmission = user
    ? { userId: user.id, verdict: "AC" as const, contestId: null }
    : undefined;

  const problems = await prisma.problem.findMany({
    where: {
      AND: [
        q
          ? { OR: [{ title: { contains: q } }, { slug: { contains: q } }] }
          : {},
        difficulty ? { difficulty } : {},
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
    },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { submissions: { where: { contestId: null } } } },
      submissions: userAcSubmission
        ? { where: userAcSubmission, select: { id: true }, take: 1 }
        : false,
    },
  });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--navy)]">Danh sách bài tập</h1>
          <p className="text-sm text-[var(--muted)]">
            {problems.length} đề
            {user && ` · ${problems.filter((problem) => problem.submissions.length > 0).length} bài đã giải`}
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
            {problems.length === 0 && (
              <tr>
                <td
                  colSpan={user ? 5 : 4}
                  className="px-3 py-8 text-center text-sm text-[var(--muted)]"
                >
                  Không tìm thấy bài tập phù hợp.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
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
