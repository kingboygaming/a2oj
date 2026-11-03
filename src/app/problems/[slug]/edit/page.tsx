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
    include: { testCases: { orderBy: { order: "asc" } }, tags: true },
  });

  if (!problem) notFound();

  const canEdit =
    user.role === "ADMIN" ||
    (!problem.published && problem.authorId === user.id);

  if (!canEdit) {
    notFound();
  }
  const specialCards = await prisma.gachaCard.findMany({
    where: { specialOnly: true, category: "DISPLAY" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, rarity: true },
  });

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
          tags: problem.tags,
          timeLimitMs: problem.timeLimitMs,
          memoryLimitMb: problem.memoryLimitMb,
          judgeType: problem.judgeType,
          scoringMode: problem.scoringMode,
          gachaAcRewardMin: problem.gachaAcRewardMin,
          gachaAcRewardMax: problem.gachaAcRewardMax,
          gachaPacRewardMin: problem.gachaPacRewardMin,
          gachaPacRewardMax: problem.gachaPacRewardMax,
          specialGachaCardId: problem.specialGachaCardId,
          specialGachaDropRate: problem.specialGachaDropRate,
          heuristicTolerancePercent: problem.heuristicTolerancePercent,
          achievementBadgeTitle: problem.achievementBadgeTitle,
          achievementBadgeDescription: problem.achievementBadgeDescription,
          achievementScoreThreshold: problem.achievementScoreThreshold,
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
        specialCards={specialCards}
        returnUrl={`/problems/${problem.slug}`}
      />
    </div>
  );
}
