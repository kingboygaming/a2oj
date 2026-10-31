import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ContributeForm } from "@/components/ContributeForm";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function EditProblemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  const { id } = await params;
  const problem = await prisma.problem.findUnique({
    where: { id },
    include: { testCases: { orderBy: { order: "asc" } } },
  });
  if (!problem) notFound();

  if (user?.role !== "ADMIN") {
    if (user && problem.authorId === user.id && !problem.published) {
      redirect(`/problems/${problem.slug}/edit`);
    }
    notFound();
  }

  return (
    <div className="max-w-3xl">
      <Link
        href="/admin/problems"
        className="text-sm font-medium text-[var(--teal)] hover:underline"
      >
        ← Quay lại danh sách bài tập
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-[var(--navy)]">
        Chỉnh sửa bài tập
      </h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Cập nhật nội dung, giới hạn và test case. Trạng thái xuất bản của đề sẽ được giữ nguyên.
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
          ioMode: problem.ioMode,
          inputFile: problem.inputFile,
          outputFile: problem.outputFile,
          testCases: problem.testCases.map(({ input, output, isSample, points }) => ({
            input,
            output,
            isSample,
            points,
          })),
        }}
        returnUrl="/admin/problems"
      />
    </div>
  );
}
