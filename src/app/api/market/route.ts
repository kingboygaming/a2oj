import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/market - List active market listings with filters
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim().toLowerCase();
  const rarity = searchParams.get("rarity");
  const minPrice = Number(searchParams.get("minPrice") || "0");
  const maxPrice = Number(searchParams.get("maxPrice") || "9999999");
  const sort = searchParams.get("sort") || "newest"; // newest, price_asc, price_desc

  const listings = await prisma.cardMarketListing.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        { priceCoins: { gte: minPrice, lte: maxPrice } },
        { pricePoints: { gte: minPrice, lte: maxPrice } },
      ],
      ...(rarity && rarity !== "ALL" ? { card: { rarity } } : {}),
      ...(q
        ? {
            card: {
              OR: [
                { name: { contains: q } },
                { slug: { contains: q } },
                { element: { contains: q } },
              ],
            },
          }
        : {}),
    },
    include: {
      seller: {
        select: {
          id: true,
          username: true,
          displayName: true,
          role: true,
        },
      },
      card: {
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          rarity: true,
          category: true,
          battleType: true,
          attack: true,
          defense: true,
          manaCost: true,
          level: true,
          element: true,
          icon: true,
          imageMimeType: true,
        },
      },
      _count: {
        select: { tradeOffers: { where: { status: "PENDING" } } },
      },
    },
    orderBy:
      sort === "price_asc"
        ? [{ priceCoins: "asc" }, { pricePoints: "asc" }]
        : sort === "price_desc"
        ? [{ priceCoins: "desc" }, { pricePoints: "desc" }]
        : { createdAt: "desc" },
    take: 100,
  });

  const formatted = listings.map(({ card, ...listing }) => {
    const { imageMimeType, ...cardData } = card;
    const effectiveCoins = listing.priceCoins > 0 ? listing.priceCoins : listing.pricePoints * 10;
    return {
      ...listing,
      priceCoins: effectiveCoins,
      card: {
        ...cardData,
        imageUrl: imageMimeType ? `/api/gacha/cards/${card.id}/image` : null,
      },
    };
  });

  return NextResponse.json({ listings: formatted });
}

const createListingSchema = z.object({
  cardId: z.string().min(1),
  priceCoins: z.number().int().min(1).max(1_000_000).optional(),
  pricePoints: z.number().int().min(1).max(100_000).optional(),
  notes: z.string().max(200).optional(),
});

// POST /api/market - List a card on the marketplace
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createListingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu đăng bán không hợp lệ." }, { status: 400 });
  }

  const { cardId, priceCoins, pricePoints, notes = "" } = parsed.data;
  const finalCoins = priceCoins ?? (pricePoints ? pricePoints * 10 : 50);

  // Use a transaction to safely deduct card count and create listing
  const result = await prisma.$transaction(async (tx) => {
    const userCard = await tx.userGachaCard.findUnique({
      where: { userId_cardId: { userId: user.id, cardId } },
      include: { card: true },
    });

    if (!userCard || userCard.count < 1) {
      return { error: "Bạn không sở hữu thẻ bài này để đăng bán." };
    }

    // Decrement user's card count (or delete if 1)
    if (userCard.count === 1) {
      await tx.userGachaCard.delete({
        where: { userId_cardId: { userId: user.id, cardId } },
      });
    } else {
      await tx.userGachaCard.update({
        where: { userId_cardId: { userId: user.id, cardId } },
        data: { count: { decrement: 1 } },
      });
    }

    const listing = await tx.cardMarketListing.create({
      data: {
        sellerId: user.id,
        cardId,
        priceCoins: finalCoins,
        pricePoints: Math.round(finalCoins / 10),
        notes,
        status: "ACTIVE",
      },
      include: {
        card: true,
      },
    });

    return { listing };
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true, listing: result.listing });
}