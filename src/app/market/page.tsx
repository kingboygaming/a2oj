import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MarketplaceClient } from "@/components/MarketplaceClient";
import type { MarketListingView, OwnedCardView } from "@/components/MarketplaceClient";

export const dynamic = "force-dynamic";

export default async function MarketPage() {
  const user = await getCurrentUser();

  const [rawListings, account, rawOwnedCards, rawTransactions] = await Promise.all([
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
          select: { gachaTickets: true, a2Coins: true },
        })
      : null,
    user
      ? prisma.userGachaCard.findMany({
          where: { userId: user.id },
          orderBy: [{ card: { rarity: "desc" } }, { card: { name: "asc" } }],
          include: {
            card: {
              select: {
                id: true,
                name: true,
                description: true,
                rarity: true,
                category: true,
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
    user
      ? prisma.pointTransaction.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          take: 30,
        })
      : [],
  ]);

  const initialListings: MarketListingView[] = rawListings.map(({ card, createdAt, ...l }) => {
    const { imageMimeType, ...cardData } = card;
    const effectiveCoins = l.priceCoins > 0 ? l.priceCoins : l.pricePoints * 10;
    return {
      ...l,
      priceCoins: effectiveCoins,
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
        userPoints={account?.gachaTickets ?? 0}
        userCoins={account?.a2Coins ?? 0}
        ownedCards={ownedCards}
        currentUserId={user?.id ?? null}
        initialTransactions={rawTransactions.map((t) => ({
          id: t.id,
          amount: t.amount,
          currency: t.currency,
          type: t.type,
          description: t.description,
          createdAt: t.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}