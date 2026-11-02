import { GachaPageClient } from "@/components/GachaPageClient";
import { getCurrentUser } from "@/lib/auth";
import { isBannerAvailable } from "@/lib/gacha";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function GachaPage() {
  const user = await getCurrentUser();
  const now = new Date();
  const [banners, account, ownedCards] = await Promise.all([
    prisma.gachaBanner.findMany({
      where: { active: true },
      orderBy: [{ type: "asc" }, { createdAt: "desc" }],
      include: {
        cards: {
          orderBy: { dropRate: "asc" },
          include: { card: { select: { id: true, name: true, rarity: true, description: true } } },
        },
      },
    }),
    user
      ? prisma.user.findUnique({
          where: { id: user.id },
          select: { gachaTickets: true, featuredGachaCardId: true },
        })
      : null,
    user
      ? prisma.userGachaCard.findMany({
          where: { userId: user.id },
          orderBy: { card: { name: "asc" } },
          include: { card: { select: { id: true, name: true, rarity: true, description: true } } },
        })
      : [],
  ]);
  const availableBanners = banners.filter((banner) => isBannerAvailable(banner, now));
  const featuredCardId = account?.featuredGachaCardId ?? null;

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--teal)]">A2OJ Collectibles</p>
        <h1 className="mt-1 text-3xl font-bold text-[var(--navy)]">Gacha</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">Nhận lượt quay khi giải bài, thử vận may ở banner và xây dựng bộ sưu tập thẻ của riêng bạn.</p>
      </header>
      <GachaPageClient
        banners={availableBanners.map((banner) => ({
          id: banner.id,
          title: banner.title,
          description: banner.description,
          type: banner.type,
          startsAt: banner.startsAt?.toISOString() ?? null,
          endsAt: banner.endsAt?.toISOString() ?? null,
          cards: banner.cards.map(({ card, dropRate }) => ({
            card: { ...card, imageUrl: `/api/gacha/cards/${card.id}/image` },
            dropRate,
          })),
        }))}
        initialTickets={account?.gachaTickets ?? 0}
        initialCollection={ownedCards.map(({ card, count }) => ({
          ...card,
          imageUrl: `/api/gacha/cards/${card.id}/image`,
          count,
        }))}
        initialFeaturedCardId={featuredCardId}
        signedIn={Boolean(user)}
      />
    </div>
  );
}
