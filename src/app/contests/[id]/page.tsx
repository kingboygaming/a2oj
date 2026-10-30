import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { RegisterContestButton } from "@/components/RegisterContestButton";
import { ContestNavigation } from "@/components/ContestNavigation";

export const dynamic = "force-dynamic";

export default async function ContestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  const contest = await prisma.contest.findFirst({
    where: { OR: [{ slug: id }, { id }] },
    include: {
      problems: {
        include: {
          problem: { select: { id: true, slug: true, title: true, difficulty: true } },
        },
        orderBy: { letter: "asc" },
      },
      registrations: true,
    },
  });
  if (!contest) notFound();

  const joined = user
    ? contest.registrations.some((r) => r.userId === user.id)
    : false;
  const acceptedProblemIds = user
    ? new Set(
        (
          await prisma.submission.findMany({
            where: { userId: user.id, contestId: contest.id, verdict: "AC" },
            select: { problemId: true },
          })
        ).map((submission) => submission.problemId),
      )
    : new Set<string>();

  return (
    <div>
      <p className="text-sm text-[var(--teal)]">Contest</p>
      <h1 className="text-2xl font-semibold text-[var(--navy)]">{contest.title}</h1>
      <ContestNavigation slug={contest.slug} active="overview" />
      <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">{contest.description}</p>
      <p className="mt-2 text-xs text-[var(--muted)]">
        {contest.startAt.toLocaleString("vi-VN")} → {contest.endAt.toLocaleString("vi-VN")}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {user && (
          <RegisterContestButton contestId={contest.id} joined={joined} />
        )}
        <span className="text-sm text-[var(--muted)]">
          {contest.problems.length} bài · {contest.registrations.length} thí sinh
          {user && ` · Đã AC ${acceptedProblemIds.size}/${contest.problems.length} bài`}
        </span>
      </div>
      <div className="mt-6 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-5">
        <h2 className="font-semibold text-[var(--navy)]">Thông tin kỳ thi</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Mở mục <Link href={`/contests/${contest.slug}/problems`} className="text-[var(--teal)] hover:underline">Đề bài</Link> để xem các bài và bắt đầu nộp lời giải.
        </p>
      </div>
    </div>
  );
}
