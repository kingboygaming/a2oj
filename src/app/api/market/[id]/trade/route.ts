import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const tradeOfferSchema = z.object({
  offeredCardId: z.string().min(1),
  offeredCoins: z.number().int().min(0).max(1_000_000).default(0),
  offeredPoints: z.number().int().min(0).max(100_000).default(0),
  message: z.string().max(200).optional().default(""),
});

// POST /api/market/[id]/trade - Propose a card trade offer
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  }

  const { id: listingId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = tradeOfferSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu đề nghị đổi không hợp lệ." }, { status: 400 });
  }

  const { offeredCardId, offeredCoins, offeredPoints, message } = parsed.data;
  const coinsToSend = offeredCoins > 0 ? offeredCoins : offeredPoints * 10;

  const result = await prisma.$transaction(async (tx) => {
    const listing = await tx.cardMarketListing.findUnique({
      where: { id: listingId },
    });

    if (!listing || listing.status !== "ACTIVE") {
      return { error: "Mục giao dịch không khả dụng." };
    }

    if (listing.sellerId === user.id) {
      return { error: "Không thể tự đề nghị đổi bài đăng của chính mình." };
    }

    // Verify proposer owns the offered card
    const owned = await tx.userGachaCard.findUnique({
      where: { userId_cardId: { userId: user.id, cardId: offeredCardId } },
    });

    if (!owned || owned.count < 1) {
      return { error: "Bạn không sở hữu thẻ bài này để đem ra trao đổi." };
    }

    // Check if proposer has enough coins if coinsToSend > 0
    if (coinsToSend > 0) {
      const proposerAccount = await tx.user.findUniqueOrThrow({
        where: { id: user.id },
        select: { a2Coins: true, gachaTickets: true },
      });
      if (proposerAccount.a2Coins < coinsToSend) {
        return { error: `Bạn không đủ ${coinsToSend} A2 Coins để đính kèm.` };
      }
    }

    // Create the trade offer
    const offer = await tx.cardTradeOffer.create({
      data: {
        listingId,
        proposerId: user.id,
        offeredCardId,
        offeredCoins: coinsToSend,
        offeredPoints: Math.round(coinsToSend / 10),
        message,
        status: "PENDING",
      },
      include: {
        offeredCard: true,
      },
    });

    return { offer };
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    message: "Đã gửi đề nghị trao đổi thẻ thành công!",
    offer: result.offer,
  });
}

// GET /api/market/[id]/trade - Get all pending trade offers for this listing (only seller can view)
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  }

  const { id: listingId } = await context.params;

  const listing = await prisma.cardMarketListing.findUnique({
    where: { id: listingId },
  });

  if (!listing) {
    return NextResponse.json({ error: "Không tìm thấy bài đăng." }, { status: 404 });
  }

  if (listing.sellerId !== user.id && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Chỉ người đăng bán mới xem được đề nghị." }, { status: 403 });
  }

  const offers = await prisma.cardTradeOffer.findMany({
    where: { listingId, status: "PENDING" },
    include: {
      proposer: {
        select: { id: true, username: true, displayName: true },
      },
      offeredCard: {
        select: {
          id: true,
          name: true,
          rarity: true,
          element: true,
          attack: true,
          defense: true,
          imageMimeType: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const formatted = offers.map(({ offeredCard, ...offer }) => ({
    ...offer,
    offeredCard: {
      ...offeredCard,
      imageUrl: offeredCard.imageMimeType ? `/api/gacha/cards/${offeredCard.id}/image` : null,
    },
  }));

  return NextResponse.json({ offers: formatted });
}