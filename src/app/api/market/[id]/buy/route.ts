import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/market/[id]/buy - Instant Buy with activity points
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  }

  const { id: listingId } = await context.params;

  const result = await prisma.$transaction(async (tx) => {
    const listing = await tx.cardMarketListing.findUnique({
      where: { id: listingId },
      include: {
        seller: { select: { id: true, displayName: true } },
        card: { select: { id: true, name: true, rarity: true } },
      },
    });

    if (!listing || listing.status !== "ACTIVE") {
      return { error: "Vật phẩm này không còn mở bán hoặc đã được giao dịch." };
    }

    if (listing.sellerId === user.id) {
      return { error: "Bạn không thể tự mua thẻ do chính mình đăng bán." };
    }

    const priceInCoins = listing.priceCoins > 0 ? listing.priceCoins : listing.pricePoints * 10;

    // Check buyer's A2 Coins
    const buyer = await tx.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { a2Coins: true, gachaTickets: true },
    });

    if (buyer.a2Coins < priceInCoins) {
      return {
        error: `Bạn không đủ A2 Coin (Cần ${priceInCoins.toLocaleString("vi-VN")} A2C, bạn có ${buyer.a2Coins.toLocaleString("vi-VN")} A2C). Bạn có thể đổi Điểm chuyên cần sang A2 Coin để tiếp tục!`,
      };
    }

    // 1. Deduct A2 Coins from buyer
    await tx.user.update({
      where: { id: user.id },
      data: { a2Coins: { decrement: priceInCoins } },
    });

    // 2. Add A2 Coins to seller
    await tx.user.update({
      where: { id: listing.sellerId },
      data: { a2Coins: { increment: priceInCoins } },
    });

    // 3. Mark listing as SOLD
    await tx.cardMarketListing.update({
      where: { id: listingId },
      data: {
        status: "SOLD",
        buyerId: user.id,
      },
    });

    // 4. Give card to buyer
    await tx.userGachaCard.upsert({
      where: { userId_cardId: { userId: user.id, cardId: listing.cardId } },
      create: { userId: user.id, cardId: listing.cardId, count: 1 },
      update: { count: { increment: 1 } },
    });

    // 5. Cancel any other pending trade offers for this listing
    await tx.cardTradeOffer.updateMany({
      where: { listingId, status: "PENDING" },
      data: { status: "REJECTED" },
    });

    // 6. Record Point Transactions
    await tx.pointTransaction.createMany({
      data: [
        {
          userId: user.id,
          amount: -priceInCoins,
          currency: "A2_COIN",
          type: "MARKET_BUY",
          description: `Mua thẻ "${listing.card.name}" từ ${listing.seller.displayName} (-${priceInCoins.toLocaleString("vi-VN")} A2C)`,
          referenceId: listingId,
        },
        {
          userId: listing.sellerId,
          amount: priceInCoins,
          currency: "A2_COIN",
          type: "MARKET_SELL",
          description: `Bán thẻ "${listing.card.name}" cho ${user.displayName} (+${priceInCoins.toLocaleString("vi-VN")} A2C)`,
          referenceId: listingId,
        },
      ],
    });

    return { success: true, cardName: listing.card.name, priceInCoins };
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true, message: `Giao dịch thành công! Nhận thẻ "${result.cardName}".` });
}

// DELETE /api/market/[id] - Cancel/Unlist own active listing
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  }

  const { id: listingId } = await context.params;

  const result = await prisma.$transaction(async (tx) => {
    const listing = await tx.cardMarketListing.findUnique({
      where: { id: listingId },
    });

    if (!listing) return { error: "Không tìm thấy danh sách bán." };
    if (listing.sellerId !== user.id && user.role !== "ADMIN") {
      return { error: "Bạn không có quyền huỷ bài đăng này." };
    }
    if (listing.status !== "ACTIVE") {
      return { error: "Vật phẩm này không ở trạng thái mở bán." };
    }

    // 1. Mark CANCELLED
    await tx.cardMarketListing.update({
      where: { id: listingId },
      data: { status: "CANCELLED" },
    });

    // 2. Return card to seller
    await tx.userGachaCard.upsert({
      where: { userId_cardId: { userId: listing.sellerId, cardId: listing.cardId } },
      create: { userId: listing.sellerId, cardId: listing.cardId, count: 1 },
      update: { count: { increment: 1 } },
    });

    // 3. Reject pending trade offers
    await tx.cardTradeOffer.updateMany({
      where: { listingId, status: "PENDING" },
      data: { status: "CANCELLED" },
    });

    return { success: true };
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true, message: "Đã gỡ bài đăng và hoàn trả thẻ về kho đồ." });
}