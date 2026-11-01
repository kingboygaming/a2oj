import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { VerdictBadge } from "@/components/VerdictBadge";
import Image from "next/image";
import { getUserRankSummary } from "@/lib/ranks";
import { RankSummary } from "@/components/RankSummary";

export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<string, string> = {
  STUDENT: "Học sinh",
  TEACHER: "Giáo viên",
  ADMIN: "Quản trị viên",
};

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [profile, submissionCount, solvedProblems, contestAcSubmissions, recentSubmissions, myContributedProblems] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: {
        bio: true,
        school: true,
        avatarMimeType: true,
      },
    }),
    prisma.submission.count({ where: { userId: user.id, contestId: null } }),
    prisma.problem.findMany({
      where: {
        contestOnly: false,
        submissions: { some: { userId: user.id, verdict: "AC", contestId: null } },
      },
      orderBy: { title: "asc" },
      select: { id: true, slug: true, title: true, difficulty: true },
    }),
    prisma.submission.findMany({
      where: { userId: user.id, verdict: "AC", contestId: { not: null } },
      select: { contestId: true, problemId: true },
    }),
    prisma.submission.findMany({
      where: { userId: user.id, contestId: null },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        verdict: true,
        score: true,
        timeMs: true,
        createdAt: true,
        problem: { select: { slug: true, title: true } },
      },
    }),
    prisma.problem.findMany({
      where: { authorId: user.id, contestOnly: false },
      orderBy: { createdAt: "desc" },
      select: { id: true, slug: true, title: true, difficulty: true, published: true },
    }),
  ]);
  const contestSolvedCount = new Set(
    contestAcSubmissions.map((submission) => `${submission.contestId}:${submission.problemId}`),
  ).size;
  const rankSummary = await getUserRankSummary(user.id);
  const nameColor = rankSummary.nameColor;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium uppercase tracking-wide text-[var(--teal)]">
            Hồ sơ
          </p>
          <Link
            href="/settings/profile"
            className="rounded-md border border-[var(--line)] px-3 py-1.5 text-sm font-medium text-[var(--teal)] hover:bg-[var(--navy)]/5"
          >
            Cài đặt trang cá nhân
          </Link>
        </div>
        <div className="mt-3 flex items-center gap-4">
          {profile.avatarMimeType ? (
            <Image
              src={`/api/users/${encodeURIComponent(user.username)}/avatar`}
              alt={`Ảnh đại diện của ${user.displayName}`}
              width={56}
              height={56}
              unoptimized
              className="size-14 shrink-0 rounded-full border border-[var(--line)] bg-white object-cover"
            />
          ) : (
            <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-[var(--amber)] text-xl font-semibold text-[var(--navy)]">
              {user.displayName.trim().charAt(0).toUpperCase() || "?"}
            </span>
          )}
          <div className="min-w-0">
            <h1 className={`truncate text-2xl font-semibold ${nameColor}`}>
              {user.displayName}
            </h1>
            <p className="mt-0.5 text-sm text-[var(--muted)]">@{user.username}</p>
            <span className="mt-2 inline-flex rounded-full bg-[var(--teal)]/10 px-2.5 py-1 text-xs font-medium text-[var(--teal)]">
              {ROLE_LABELS[user.role] ?? user.role}
            </span>
          </div>
        </div>
        <div className="mt-4 space-y-1 text-sm">
          {profile.school && <p><span className="font-medium">Trường học:</span> {profile.school}</p>}
          {profile.bio && <p className="whitespace-pre-wrap text-[var(--muted)]">{profile.bio}</p>}
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Stat label="Bài tập thường đã AC" value={solvedProblems.length} />
          <Stat label="Bài contest đã AC" value={contestSolvedCount} />
          <Stat label="Lần nộp" value={submissionCount} />
        </div>
      </section>

      <RankSummary summary={rankSummary} showColorPreference />

      {myContributedProblems.length > 0 && (
        <section className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold text-[var(--navy)]">Bài tập đã đóng góp</h2>
            <Link href="/problems/new" className="text-sm text-[var(--teal)] hover:underline">
              + Đóng góp đề mới
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-[var(--line)]">
            {myContributedProblems.map((problem) => (
              <li
                key={problem.id}
                className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm"
              >
                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-mono text-xs text-[var(--muted)]">
                    {problem.slug}
                  </span>
                  <Link
                    href={`/problems/${problem.slug}`}
                    className="font-medium hover:text-[var(--teal)] hover:underline"
                  >
                    {problem.title}
                  </Link>
                  <span className="text-xs text-[var(--muted)]">
                    {problem.difficulty === "EASY"
                      ? "Dễ"
                      : problem.difficulty === "MEDIUM"
                        ? "Trung bình"
                        : "Khó"}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      problem.published
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-900"
                    }`}
                  >
                    {problem.published ? "Đã duyệt" : "Chờ duyệt"}
                  </span>
                </div>
                {!problem.published && (
                  <Link
                    href={`/problems/${problem.slug}/edit`}
                    className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100"
                  >
                    Chỉnh sửa
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-[var(--navy)]">Bài đã giải</h2>
          <Link href="/problems" className="text-sm text-[var(--teal)] hover:underline">
            Danh sách bài tập
          </Link>
        </div>
        {solvedProblems.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">
            Chưa có bài nào được chấm AC.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--line)]">
            {solvedProblems.map((problem) => (
              <li key={problem.id} className="py-2.5">
                <Link
                  href={`/problems/${problem.slug}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 hover:text-[var(--teal)]"
                >
                  <span className="font-mono text-xs text-[var(--muted)]">
                    {problem.slug}
                  </span>
                  <span className="text-sm font-medium">{problem.title}</span>
                  <span className="text-xs text-[var(--muted)]">
                    {problem.difficulty === "EASY"
                      ? "Dễ"
                      : problem.difficulty === "MEDIUM"
                        ? "Trung bình"
                        : "Khó"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-[var(--navy)]">Bài nộp gần đây</h2>
          <Link href="/submissions" className="text-sm text-[var(--teal)] hover:underline">
            Xem tất cả
          </Link>
        </div>
        {recentSubmissions.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">Bạn chưa nộp bài nào.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--line)]">
            {recentSubmissions.map((submission) => (
              <li
                key={submission.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
              >
                <Link
                  href={`/submissions/${submission.id}`}
                  className="min-w-0 truncate font-medium text-[var(--teal)] hover:underline"
                >
                  {submission.problem.slug} · {submission.problem.title}
                </Link>
                <div className="flex items-center gap-3">
                  <VerdictBadge verdict={submission.verdict} />
                  <span className="text-xs text-[var(--muted)]">
                    {submission.createdAt.toLocaleDateString("vi-VN")}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-white px-4 py-3">
      <p className="text-2xl font-semibold text-[var(--navy)]">{value}</p>
      <p className="text-xs text-[var(--muted)]">{label}</p>
    </div>
  );
}
