import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminProblemsPage() {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") notFound();

  const problems = await prisma.problem.findMany({
    where: { contestOnly: false },
    orderBy: [{ published: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      difficulty: true,
      published: true,
      createdAt: true,
      judgeType: true,
      ioMode: true,
      inputFile: true,
      outputFile: true,
      author: { select: { displayName: true, username: true } },
      _count: { select: { testCases: true, submissions: true } },
    },
  });

  return (
    <div>
      <Link href="/admin" className="text-sm font-medium text-[var(--teal)] hover:underline">
        ← Quay lại quản trị
      </Link>
      <header className="mt-4">
        <p className="text-sm font-medium uppercase tracking-wide text-[var(--teal)]">
          Quản trị nội dung
        </p>
        <h1 className="mt-1 text-3xl font-semibold text-[var(--navy)]">
          Quản lý bài tập
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Xem và chỉnh sửa các đề đã đóng góp, kể cả đề đang chờ duyệt.
        </p>
      </header>

      {problems.length === 0 ? (
        <p className="mt-6 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-6 text-center text-sm text-[var(--muted)]">
          Chưa có bài tập nào.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--paper)]">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-[var(--surface-strong)] text-[var(--cream)]">
              <tr>
                <th className="px-4 py-3 font-medium">Bài tập</th>
                <th className="px-4 py-3 font-medium">Tác giả</th>
                <th className="px-4 py-3 font-medium">Trạng thái</th>
                <th className="px-4 py-3 font-medium">Test / nộp</th>
                <th className="px-4 py-3 text-right font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {problems.map((problem) => (
                <tr key={problem.id} className="border-t border-[var(--line)]">
                  <td className="px-4 py-3">
                    <Link
                      href={`/problems/${problem.slug}`}
                      className="font-medium text-[var(--teal)] hover:underline"
                    >
                      {problem.title}
                    </Link>
                    <p className="mt-1 font-mono text-xs text-[var(--muted)] flex items-center gap-2">
                      <span>{problem.slug}</span>
                      {problem.ioMode === "FILE" && (
                        <span className="rounded bg-amber-500/10 px-1 py-0.5 text-[10px] text-amber-700 dark:text-amber-300">
                          📁 {problem.inputFile || `${problem.slug.toUpperCase()}.INP`} / {problem.outputFile || `${problem.slug.toUpperCase()}.OUT`}
                        </span>
                      )}
                      {problem.judgeType === "HEURISTIC" && (
                        <span className="rounded bg-purple-500/10 px-1 py-0.5 text-[10px] font-medium text-purple-700 dark:text-purple-300">
                          🎯 Heuristic
                        </span>
                      )}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span>{problem.author.displayName}</span>
                    <span className="ml-1 text-xs text-[var(--muted)]">
                      @{problem.author.username}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        problem.published
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-900"
                      }`}
                    >
                      {problem.published ? "Đã xuất bản" : "Chờ duyệt"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[var(--muted)]">
                    {problem._count.testCases} test · {problem._count.submissions} bài nộp
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/problems/${problem.id}/edit`}
                      className="inline-flex rounded-md border border-[var(--line)] px-3 py-1.5 text-sm font-medium text-[var(--navy)] hover:border-[var(--teal)] hover:text-[var(--teal)]"
                    >
                      Chỉnh sửa
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
