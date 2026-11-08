import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ContributeForm } from "@/components/ContributeForm";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function EditProblemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ contest?: string }>;
}) {
  const user = await getCurrentUser();
  const [{ id }, { contest }] = await Promise.all([params, searchParams]);
  const problem = await prisma.problem.findUnique({
    where: { id },
    include: { testCases: { orderBy: { order: "asc" } }, tags: true },
  });
  if (!problem) notFound();

  if (user?.role !== "ADMIN") {
    if (user && problem.authorId === user.id && !problem.published) {
      redirect(`/problems/${problem.slug}/edit`);
    }
    notFound();
  }

  const contestContext = contest ? await prisma.contest.findFirst({
    where: {
      OR: [{ id: contest }, { slug: contest }],
      problems: { some: { problemId: problem.id } },
    },
    select: { id: true, slug: true, title: true },
  }) : null;
  const returnUrl = contestContext
    ? `/problems/${problem.slug}?contest=${encodeURIComponent(contestContext.id)}`
    : "/admin/problems";

  return (
    <div className="max-w-3xl">
      <Link
        href={returnUrl}
        className="text-sm font-medium text-[var(--teal)] hover:underline"
      >
        {contestContext ? `← Quay lại ${contestContext.title}` : "← Quay lại danh sách bài tập"}
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
          tags: problem.tags,
          timeLimitMs: problem.timeLimitMs,
          memoryLimitMb: problem.memoryLimitMb,
          judgeType: problem.judgeType,
          scoringMode: problem.scoringMode,
          heuristicTolerancePercent: problem.heuristicTolerancePercent,
          achievementBadgeTitle: problem.achievementBadgeTitle,
          achievementBadgeDescription: problem.achievementBadgeDescription,
          achievementScoreThreshold: problem.achievementScoreThreshold,
          ioMode: problem.ioMode,
          inputFile: problem.inputFile,
          outputFile: problem.outputFile,
          statementPdfPath: problem.statementPdfPath,
          testCases: problem.testCases.map(({ input, output, isSample, points }) => ({
            input,
            output,
            isSample,
            points,
          })),
        }}
        returnUrl={returnUrl}
      />
    </div>
  );
}
