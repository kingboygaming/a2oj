import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getUserRankSummary } from "@/lib/ranks";
import { getUserPersonalStatistics } from "@/lib/user-stats";
import { RankSummary } from "@/components/RankSummary";
import { ActivityHeatmap } from "@/components/ActivityHeatmap";
import { ProfileOverviewStats } from "@/components/ProfileOverviewStats";
import { SkillDistribution } from "@/components/SkillDistribution";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";

export const dynamic = "force-dynamic";

const ROLE_LABELS = {
  STUDENT: "Học sinh",
  TEACHER: "Giáo viên",
  ADMIN: "Quản trị viên",
} as const;

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
      bio: true,
      school: true,
      createdAt: true,
      avatarMimeType: true,
      featuredGachaCard: {
        select: { id: true, name: true, rarity: true, description: true, attack: true, defense: true, element: true },
      },
    },
  });
  if (!user) notFound();

  const [rankSummary, stats] = await Promise.all([
    getUserRankSummary(user.id),
    getUserPersonalStatistics(user.id),
  ]);
  const nameColor = rankSummary.nameColor;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/problems" className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--teal)] hover:underline">
          <span aria-hidden="true">←</span> Danh sách bài tập
        </Link>
        <Badge variant="teal" size="sm">
          Hồ sơ thành viên
        </Badge>
      </div>

      <Card variant="glass" className="p-6 sm:p-7">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            {user.avatarMimeType ? (
              <Image
                src={`/api/users/${encodeURIComponent(user.username)}/avatar`}
                alt={`Ảnh đại diện của ${user.displayName}`}
                width={84}
                height={84}
                unoptimized
                className="size-20 sm:size-24 rounded-2xl border-2 border-[var(--teal)]/30 object-cover shadow-lg shadow-[var(--teal)]/10"
              />
            ) : (
              <span className="flex size-20 sm:size-24 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--teal)] to-[var(--amber)] text-3xl font-extrabold text-white shadow-lg">
                {user.displayName.trim().charAt(0).toUpperCase() || "?"}
              </span>
            )}
            <div className="min-w-0">
              <h1 className={`truncate text-2xl sm:text-3xl font-extrabold tracking-tight ${nameColor}`}>
                {user.displayName}
              </h1>
              <p className="mt-0.5 text-sm font-mono text-[var(--muted)]">@{user.username}</p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <Badge variant="teal" size="sm">
                  {ROLE_LABELS[user.role]}
                </Badge>
                <Badge variant="default" size="sm">
                  Gia nhập {user.createdAt.toLocaleDateString("vi-VN")}
                </Badge>
              </div>
            </div>
          </div>

          {user.featuredGachaCard && (
            <div className="flex items-center gap-3.5 rounded-xl border border-[var(--line)] bg-[var(--background)]/60 p-3 sm:max-w-xs">
              <Image
                src={`/api/gacha/cards/${user.featuredGachaCard.id}/image`}
                alt={user.featuredGachaCard.name}
                width={70}
                height={90}
                unoptimized
                className="h-20 w-16 shrink-0 rounded-lg border border-[var(--line)] object-cover shadow-md"
              />
              <div className="min-w-0 text-xs">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                  Thẻ đại diện
                </span>
                <p className="truncate font-bold text-sm text-[var(--navy)]">
                  {user.featuredGachaCard.name}
                </p>
                <span className="mt-1 inline-block font-semibold uppercase text-[10px] text-[var(--teal)]">
                  {user.featuredGachaCard.rarity} · ATK {user.featuredGachaCard.attack}
                </span>
              </div>
            </div>
          )}
        </div>

        {(user.school || user.bio) && (
          <div className="mt-6 border-t border-[var(--line)]/50 pt-4 text-sm">
            {user.school && (
              <p className="text-[var(--muted)]">
                🏫 <strong className="text-[var(--navy)]">{user.school}</strong>
              </p>
            )}
            {user.bio && (
              <p className="mt-2 whitespace-pre-wrap leading-relaxed text-[var(--ink)]">
                {user.bio}
              </p>
            )}
          </div>
        )}
      </Card>

      <ProfileOverviewStats
        totalSolved={stats.totalSolved}
        totalSubmissions={stats.totalSubmissions}
        currentStreak={stats.currentStreak}
        activityPoints={stats.activityPoints}
        a2Coins={stats.a2Coins}
      />

      <ActivityHeatmap
        data={stats.dailyActivity}
        totalSubmissionsInYear={stats.totalSubmissionsInYear}
        currentStreak={stats.currentStreak}
        longestStreak={stats.longestStreak}
      />

      <SkillDistribution
        categories={stats.skillCategories}
        totalSolved={stats.totalSolved}
      />

      <RankSummary summary={rankSummary} />
    </div>
  );
}
