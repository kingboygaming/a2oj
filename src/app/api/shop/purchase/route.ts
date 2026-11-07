import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const shopPurchaseSchema = z.object({
  packId: z.enum(["single_ticket", "starter_bundle", "booster_box", "exclusive_legendary"]),
  paymentMethod: z.enum(["A2_COIN", "ATTENDANCE_POINT"]).optional().default("A2_COIN"),
});

const SHOP_ITEMS = {
  single_ticket: {
    name: "1 Vé Quay Gacha",
    costCoins: 150,
    costPoints: 15,
    tickets: 1,
    type: "TICKETS",
  },
  starter_bundle: {
    name: "Túi Tân Thủ (10 Vé + Thẻ R/SR Ngẫu Nhiên)",
    costCoins: 1200,
    costPoints: 120,
    tickets: 10,
    type: "BUNDLE",
    guaranteedRarity: "RARE",
  },
  booster_box: {
    name: "Hộp Thẻ Master (30 Vé Quay + Thẻ Epic)",
    costCoins: 3200,
    costPoints: 320,
    tickets: 30,
    type: "BUNDLE",
    guaranteedRarity: "EPIC",
  },
  exclusive_legendary: {
    name: "Rương Thần Bí (1 Thẻ Huyền Thoại Legendary)",
    costCoins: 6000,
    costPoints: 600,
    tickets: 0,
    type: "EXCLUSIVE_CARD",
    guaranteedRarity: "LEGENDARY",
  },
};

// POST /api/shop/purchase - Purchase gacha packs/exclusive cards with A2 Coins or Points
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = shopPurchaseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Gói vật phẩm không tồn tại." }, { status: 400 });
  }

  const { packId, paymentMethod } = parsed.data;
  const item = SHOP_ITEMS[packId];

  const result = await prisma.$transaction(async (tx) => {
    const account = await tx.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { gachaTickets: true, a2Coins: true },
    });

    if (paymentMethod === "A2_COIN") {
      if (account.a2Coins < item.costCoins) {
        return {
          error: `Bạn không đủ A2 Coin (Cần ${item.costCoins.toLocaleString("vi-VN")} A2C, bạn có ${account.a2Coins.toLocaleString("vi-VN")} A2C). Hãy đổi Điểm chuyên cần sang A2 Coin để mua!`,
        };
      }
      await tx.user.update({
        where: { id: user.id },
        data: { a2Coins: { decrement: item.costCoins } },
      });
    } else {
      if (account.gachaTickets < item.costPoints) {
        return {
          error: `Bạn không đủ Điểm chuyên cần (Cần ${item.costPoints} điểm, bạn có ${account.gachaTickets} điểm).`,
        };
      }
      await tx.user.update({
        where: { id: user.id },
        data: { gachaTickets: { decrement: item.costPoints } },
      });
    }

    const awardedCards: Array<{ id: string; name: string; rarity: string }> = [];

    // If tickets granted
    if (item.tickets > 0) {
      await tx.user.update({
        where: { id: user.id },
        data: { gachaTickets: { increment: item.tickets } },
      });
    }

    // If guaranteed card included
    if ("guaranteedRarity" in item && item.guaranteedRarity) {
      const candidates = await tx.gachaCard.findMany({
        where: { rarity: item.guaranteedRarity },
        select: {
          id: true,
          name: true,
          rarity: true,
          description: true,
          attack: true,
          defense: true,
          element: true,
          icon: true,
          imageMimeType: true,
          battleType: true,
        },
        take: 50,
      });

      if (candidates.length > 0) {
        const picked = candidates[Math.floor(Math.random() * candidates.length)];
        await tx.userGachaCard.upsert({
          where: { userId_cardId: { userId: user.id, cardId: picked.id } },
          create: { userId: user.id, cardId: picked.id, count: 1 },
          update: { count: { increment: 1 } },
        });
        const { imageMimeType, ...cardData } = picked;
        awardedCards.push({
          ...cardData,
          imageUrl: imageMimeType ? `/api/gacha/cards/${picked.id}/image` : null,
        } as any);
      }
    }

    // Record PointTransaction
    await tx.pointTransaction.create({
      data: {
        userId: user.id,
        amount: paymentMethod === "A2_COIN" ? -item.costCoins : -item.costPoints,
        currency: paymentMethod,
        type: "SHOP_PURCHASE",
        description: `Mua "${item.name}" tại Shop bằng ${paymentMethod === "A2_COIN" ? `${item.costCoins.toLocaleString("vi-VN")} A2C` : `${item.costPoints} Điểm`}`,
      },
    });

    const updated = await tx.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { gachaTickets: true, a2Coins: true },
    });

    return {
      success: true,
      itemName: item.name,
      newBalanceCoins: updated.a2Coins,
      newBalanceTickets: updated.gachaTickets,
      awardedCards,
      ticketsAwarded: item.tickets,
    };
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    message: `Đổi thành công "${result.itemName}"!`,
    newBalanceCoins: result.newBalanceCoins,
    newBalanceTickets: result.newBalanceTickets,
    awardedCards: result.awardedCards,
    ticketsAwarded: result.ticketsAwarded,
  });
}