import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ContributeForm } from "@/components/ContributeForm";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function EditContributedProblemPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { slug } = await params;
  const problem = await prisma.problem.findUnique({
    where: { slug },
    include: { testCases: { orderBy: { order: "asc" } } },
  });

  if (!problem) notFound();

  const canEdit =
    user.role === "ADMIN" ||
    (!problem.published && problem.authorId === user.id);

  if (!canEdit) {
    notFound();
  }

  return (
    <div className="max-w-3xl">
      <Link
        href={`/problems/${problem.slug}`}
        className="text-sm font-medium text-[var(--teal)] hover:underline"
      >
        ← Quay lại bài tập
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-[var(--navy)]">
        {problem.published ? "Chỉnh sửa bài tập" : "Chỉnh sửa bài đóng góp"}
      </h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        {problem.published
          ? "Cập nhật nội dung, giới hạn và test case cho bài tập."
          : "Cập nhật nội dung, giới hạn và test case cho bài tập đang chờ duyệt."}
      </p>
      <ContributeForm
        problem={{
          id: problem.id,
          slug: problem.slug,
          title: problem.title,
          statement: problem.statement,
          difficulty: problem.difficulty,
          timeLimitMs: problem.timeLimitMs,
          memoryLimitMb: problem.memoryLimitMb,
          testCases: problem.testCases.map(({ input, output, isSample, points }) => ({
            input,
            output,
            isSample,
            points,
          })),
        }}
        returnUrl={`/problems/${problem.slug}`}
      />
    </div>
  );
}
