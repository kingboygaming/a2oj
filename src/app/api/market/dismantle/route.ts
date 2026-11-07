import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const DISMANTLE_COIN_VALUES: Record<string, number> = {
  COMMON: 15,
  UNCOMMON: 30,
  RARE: 100,
  EPIC: 350,
  LEGENDARY: 1500,
  SPECIAL: 3000,
};

const dismantleSchema = z.object({
  cardId: z.string().min(1),
  count: z.number().int().min(1).default(1),
});

// POST /api/market/dismantle - Dismantle duplicate cards to get A2 Coins
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = dismantleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu yêu cầu không hợp lệ." }, { status: 400 });
  }

  const { cardId, count: countToDismantle } = parsed.data;

  const result = await prisma.$transaction(async (tx) => {
    const userCard = await tx.userGachaCard.findUnique({
      where: { userId_cardId: { userId: user.id, cardId } },
      include: { card: true },
    });

    if (!userCard || userCard.count < countToDismantle) {
      return { error: `Bạn không có đủ số lượng thẻ này để tách (Hiện có: ${userCard?.count ?? 0}).` };
    }

    const valuePerCard = DISMANTLE_COIN_VALUES[userCard.card.rarity] ?? 15;
    const totalCoins = valuePerCard * countToDismantle;

    // Deduct cards
    if (userCard.count === countToDismantle) {
      await tx.userGachaCard.delete({
        where: { userId_cardId: { userId: user.id, cardId } },
      });
    } else {
      await tx.userGachaCard.update({
        where: { userId_cardId: { userId: user.id, cardId } },
        data: { count: { decrement: countToDismantle } },
      });
    }

    // Add A2 Coins
    const updated = await tx.user.update({
      where: { id: user.id },
      data: { a2Coins: { increment: totalCoins } },
      select: { a2Coins: true },
    });

    // Record transaction ledger
    await tx.pointTransaction.create({
      data: {
        userId: user.id,
        amount: totalCoins,
        currency: "A2_COIN",
        type: "DISMANTLE_CARD",
        description: `Tách ${countToDismantle}x thẻ "${userCard.card.name}" [${userCard.card.rarity}] thu được ${totalCoins.toLocaleString("vi-VN")} A2 Coins`,
      },
    });

    return {
      cardName: userCard.card.name,
      totalCoins,
      newA2Coins: updated.a2Coins,
    };
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    message: `Tách thành công ${countToDismantle} thẻ "${result.cardName}", nhận được ${result.totalCoins.toLocaleString("vi-VN")} A2 Coins!`,
    coinsEarned: result.totalCoins,
    newA2Coins: result.newA2Coins,
  });
}