import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getUserRankSummary } from "@/lib/ranks";
import { RankSummary } from "@/components/RankSummary";

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
        select: { id: true, name: true, rarity: true, description: true },
      },
    },
  });
  if (!user) notFound();
  const rankSummary = await getUserRankSummary(user.id);
  const nameColor = rankSummary.nameColor;

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/problems" className="text-sm font-medium text-[var(--teal)] hover:underline">
        ← Danh sách bài tập
      </Link>
      <section className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-6">
        <div className="flex items-center gap-4">
          {user.avatarMimeType ? (
            <Image
              src={`/api/users/${encodeURIComponent(user.username)}/avatar`}
              alt={`Ảnh đại diện của ${user.displayName}`}
              width={80}
              height={80}
              unoptimized
              className="size-20 rounded-full border border-[var(--line)] bg-white object-cover"
            />
          ) : (
            <span className="flex size-20 items-center justify-center rounded-full bg-[var(--amber)] text-2xl font-semibold text-[var(--navy)]">
              {user.displayName.trim().charAt(0).toUpperCase() || "?"}
            </span>
          )}
          <div className="min-w-0">
            <h1 className={`truncate text-2xl font-semibold ${nameColor}`}>
              {user.displayName}
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)]">@{user.username}</p>
            <span className="mt-2 inline-flex rounded-full bg-[var(--teal)]/10 px-2.5 py-1 text-xs font-medium text-[var(--teal)]">
              {ROLE_LABELS[user.role]}
            </span>
          </div>
        </div>
        {user.school && (
          <p className="mt-5 text-sm">
            <span className="font-medium text-[var(--navy)]">Trường học:</span> {user.school}
          </p>
        )}
        {user.bio ? (
          <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-[var(--ink)]">{user.bio}</p>
        ) : (
          <p className="mt-4 text-sm text-[var(--muted)]">Chưa có tiểu sử.</p>
        )}
        <p className="mt-5 text-xs text-[var(--muted)]">
          Tham gia từ {user.createdAt.toLocaleDateString("vi-VN")}
        </p>
      </section>
      {user.featuredGachaCard && (
        <section className="mt-5 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-5">
          <h2 className="mb-3 text-lg font-semibold text-[var(--navy)]">Thẻ nổi bật</h2>
          <div className="flex items-center gap-4">
            <Image
              src={`/api/gacha/cards/${user.featuredGachaCard.id}/image`}
              alt={user.featuredGachaCard.name}
              width={112}
              height={144}
              unoptimized
              className="h-36 w-28 rounded-lg border border-[var(--line)] object-cover"
            />
            <div>
              <p className="font-semibold text-[var(--navy)]">{user.featuredGachaCard.name}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[var(--teal)]">{user.featuredGachaCard.rarity}</p>
              {user.featuredGachaCard.description && <p className="mt-2 text-sm text-[var(--muted)]">{user.featuredGachaCard.description}</p>}
            </div>
          </div>
        </section>
      )}
      <div className="mt-5"><RankSummary summary={rankSummary} /></div>
    </div>
  );
}
