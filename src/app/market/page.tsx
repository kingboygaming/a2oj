import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MarketplaceClient } from "@/components/MarketplaceClient";
import type { MarketListingView, OwnedCardView } from "@/components/MarketplaceClient";

export const dynamic = "force-dynamic";

export default async function MarketPage() {
  const user = await getCurrentUser();

  const [rawListings, account, rawOwnedCards] = await Promise.all([
    prisma.cardMarketListing.findMany({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      include: {
        seller: {
          select: { id: true, username: true, displayName: true },
        },
        card: {
          select: {
            id: true,
            name: true,
            description: true,
            rarity: true,
            battleType: true,
            attack: true,
            defense: true,
            element: true,
            icon: true,
            imageMimeType: true,
          },
        },
        _count: {
          select: { tradeOffers: { where: { status: "PENDING" } } },
        },
      },
    }),
    user
      ? prisma.user.findUnique({
          where: { id: user.id },
          select: { gachaTickets: true },
        })
      : null,
    user
      ? prisma.userGachaCard.findMany({
          where: { userId: user.id },
          orderBy: { card: { rarity: "desc" } },
          include: {
            card: {
              select: {
                id: true,
                name: true,
                description: true,
                rarity: true,
                battleType: true,
                attack: true,
                defense: true,
                element: true,
                icon: true,
                imageMimeType: true,
              },
            },
          },
        })
      : [],
  ]);

  const initialListings: MarketListingView[] = rawListings.map(({ card, createdAt, ...l }) => {
    const { imageMimeType, ...cardData } = card;
    return {
      ...l,
      createdAt: createdAt.toISOString(),
      card: {
        ...cardData,
        imageUrl: imageMimeType ? `/api/gacha/cards/${card.id}/image` : null,
      },
    };
  });

  const ownedCards: OwnedCardView[] = rawOwnedCards.map(({ card, count }) => {
    const { imageMimeType, ...cardData } = card;
    return {
      count,
      card: {
        ...cardData,
        imageUrl: imageMimeType ? `/api/gacha/cards/${card.id}/image` : null,
      },
    };
  });

  return (
    <div className="mx-auto max-w-7xl">
      <MarketplaceClient
        initialListings={initialListings}
        userBalance={account?.gachaTickets ?? 0}
        ownedCards={ownedCards}
        currentUserId={user?.id ?? null}
      />
    </div>
  );
}