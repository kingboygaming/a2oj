import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { canManageContests, getCurrentUser } from "@/lib/auth";
import { ContestForm } from "@/components/ContestForm";

export const dynamic = "force-dynamic";

export default async function EditContestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();

  if (!user || !canManageContests(user.role)) {
    return (
      <p className="text-sm">
        Chỉ ban tổ chức mới được chỉnh sửa kỳ thi. <Link href="/login">Đăng nhập</Link>
      </p>
    );
  }

  const contest = await prisma.contest.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    include: {
      problems: {
        orderBy: { letter: "asc" },
        select: { problemId: true, letter: true, customTitle: true },
      },
    },
  });

  if (!contest) notFound();

  if (user.role !== "ADMIN" && contest.authorId !== user.id) {
    return (
      <div className="rounded-xl border border-rose-300 bg-rose-50 p-6 text-center text-sm text-rose-700">
        Bạn không có quyền chỉnh sửa kỳ thi do người khác tạo.
      </div>
    );
  }

  // Get all published non-contest-only problems, plus any problems already in this contest
  const availableProblems = await prisma.problem.findMany({
    where: {
      OR: [
        { published: true, contestOnly: false },
        { id: { in: contest.problems.map((p) => p.problemId) } },
      ],
    },
    orderBy: { title: "asc" },
    select: { id: true, slug: true, title: true, difficulty: true },
  });

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
        <Link href={`/contests/${contest.slug}`} className="hover:underline">
          ← Quay lại {contest.title}
        </Link>
      </div>

      <h1 className="mt-2 text-2xl font-semibold text-[var(--navy)]">Chỉnh sửa kỳ thi</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Cập nhật thời gian, tiêu đề, số lượng test chấm hoặc cấu trúc danh sách bài tập.
      </p>

      <ContestForm
        availableProblems={availableProblems}
        initialData={{
          id: contest.id,
          slug: contest.slug,
          title: contest.title,
          description: contest.description,
          startAt: contest.startAt.toISOString(),
          endAt: contest.endAt.toISOString(),
          testLimit: contest.testLimit,
          problemIds: contest.problems.map((p) => p.problemId),
          problemCustomTitles: Object.fromEntries(
            contest.problems
              .filter((p) => p.customTitle)
              .map((p) => [p.problemId, p.customTitle as string]),
          ),
        }}
      />
    </div>
  );
}
