import { ContributeForm } from "@/components/ContributeForm";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function NewProblemPage() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <p className="text-sm">
        Cần <Link href="/login" className="text-[var(--teal)] underline">đăng nhập</Link> để đóng góp đề.
      </p>
    );
  }

  const [pendingProblems, specialCards] = await Promise.all([prisma.problem.findMany({
    where: {
      authorId: user.id,
      published: false,
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      difficulty: true,
      createdAt: true,
      _count: { select: { testCases: true } },
    },
  }), prisma.gachaCard.findMany({
    where: { specialOnly: true, category: "DISPLAY" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, rarity: true },
  })]);

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-[var(--navy)]">Tạo / đóng góp bài tập</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Viết đề Markdown (có KaTeX). Giáo viên được đăng luôn; học sinh chờ duyệt.
      </p>

      {pendingProblems.length > 0 && (
        <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-amber-900">
              Bài đóng góp đang chờ duyệt của bạn ({pendingProblems.length})
            </h2>
            <span className="text-xs text-amber-800">
              Bạn có quyền chỉnh sửa trước khi được quản trị viên duyệt
            </span>
          </div>
          <ul className="mt-3 divide-y divide-amber-200">
            {pendingProblems.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm"
              >
                <div className="min-w-0">
                  <Link
                    href={`/problems/${p.slug}`}
                    className="font-medium text-[var(--navy)] hover:text-[var(--teal)] hover:underline"
                  >
                    {p.title}
                  </Link>
                  <p className="mt-0.5 font-mono text-xs text-amber-800">
                    {p.slug} · {p._count.testCases} test · {new Date(p.createdAt).toLocaleDateString("vi-VN")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/problems/${p.slug}/edit`}
                    className="rounded-md border border-amber-300 bg-white px-3 py-1 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-100"
                  >
                    Chỉnh sửa
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ContributeForm specialCards={specialCards} />
    </div>
  );
}
