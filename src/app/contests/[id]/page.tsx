import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { RegisterContestButton } from "@/components/RegisterContestButton";
import { ContestNavigation } from "@/components/ContestNavigation";
import { ContestCountdownBadge } from "@/components/ContestCountdownBadge";
import { RejudgeButton } from "@/components/RejudgeButton";
import { ContestPasswordForm } from "@/components/ContestPasswordForm";
import { hasContestAccess } from "@/lib/auth";

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

  const isOrganizer = user && (user.role === "ADMIN" || user.id === contest.authorId);
  const passwordUnlocked = isOrganizer || await hasContestAccess(contest.id, contest.passwordHash);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--teal)]">Contest</p>
          <h1 className="text-2xl font-semibold text-[var(--navy)]">{contest.title}</h1>
        </div>
        <ContestCountdownBadge startAt={contest.startAt} endAt={contest.endAt} />
      </div>
      <ContestNavigation slug={contest.slug} active="overview" />
      <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">{contest.description}</p>
      <p className="mt-2 text-xs text-[var(--muted)]">
        {contest.startAt.toLocaleString("vi-VN")} → {contest.endAt.toLocaleString("vi-VN")}
      </p>
      <p className="mt-2 inline-flex rounded-md border border-[var(--line)] bg-[var(--paper)] px-2.5 py-1 text-xs text-[var(--muted)]">
        Chế độ chấm: {contest.scoringMode === "VNOI" ? "VNOI · điểm từng test" : "ICPC · AC và penalty"}
      </p>

      {contest.passwordHash && !passwordUnlocked && (
        <ContestPasswordForm contestId={contest.id} />
      )}

      {isOrganizer && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-[var(--teal)]/30 bg-[var(--teal)]/10 p-3">
          <span className="text-xs font-semibold uppercase text-[var(--teal)]">
            Dành cho Giáo viên:
          </span>
          <Link
            href={`/contests/${contest.slug}/edit`}
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--surface-strong)] px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:opacity-90 transition-opacity"
          >
            ✏️ Chỉnh sửa kỳ thi
          </Link>
          <a
            href={`/api/admin/contests/${contest.id}/export-themis`}
            download
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--teal)] px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:opacity-90 transition-opacity"
          >
            📥 Tải bài nộp Themis (.zip)
          </a>
          <span className="text-xs text-[var(--muted)]">
            {contest.testLimit > 0
              ? `Pretest: ${contest.testLimit} test đầu`
              : "Pretest: tất cả test"}
          </span>
          <RejudgeButton contestId={contest.id} />
        </div>
      )}

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
        {new Date() < contest.startAt && !isOrganizer ? (
          <p className="mt-2 text-sm text-[var(--muted)]">
            Đề bài sẽ mở lúc {contest.startAt.toLocaleString("vi-VN")}.
          </p>
        ) : !passwordUnlocked ? (
          <p className="mt-2 text-sm text-[var(--muted)]">Nhập mật khẩu contest để mở đề bài.</p>
        ) : (
          <p className="mt-2 text-sm text-[var(--muted)]">
            Mở mục <Link href={`/contests/${contest.slug}/problems`} className="text-[var(--teal)] hover:underline">Đề bài</Link> để xem các bài và bắt đầu nộp lời giải.
          </p>
        )}
      </div>
    </div>
  );
}
