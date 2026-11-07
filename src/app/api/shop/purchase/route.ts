import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const shopPurchaseSchema = z.object({
  packId: z.enum(["single_ticket", "starter_bundle", "booster_box", "exclusive_legendary"]),
});

const SHOP_ITEMS = {
  single_ticket: {
    name: "1 Vé Quay Gacha",
    cost: 15, // 15 points
    tickets: 1,
    type: "TICKETS",
  },
  starter_bundle: {
    name: "Túi Tân Thủ (10 Vé + Thẻ SR Ngẫu Nhiên)",
    cost: 120, // 120 points (discounted from 150)
    tickets: 10,
    type: "BUNDLE",
    guaranteedRarity: "RARE",
  },
  booster_box: {
    name: "Hộp Thẻ Master (30 Vé Quay + Thẻ Epic)",
    cost: 320, // 320 points
    tickets: 30,
    type: "BUNDLE",
    guaranteedRarity: "EPIC",
  },
  exclusive_legendary: {
    name: "Rương Thần Bí (1 Thẻ Huyền Thoại Legendary)",
    cost: 600, // 600 points
    tickets: 0,
    type: "EXCLUSIVE_CARD",
    guaranteedRarity: "LEGENDARY",
  },
};

// POST /api/shop/purchase - Purchase gacha packs/exclusive cards with points
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

  const item = SHOP_ITEMS[parsed.data.packId];

  const result = await prisma.$transaction(async (tx) => {
    const account = await tx.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { gachaTickets: true },
    });

    if (account.gachaTickets < item.cost) {
      return {
        error: `Bạn không đủ Điểm chuyên cần (Cần ${item.cost} điểm, bạn có ${account.gachaTickets} điểm). Hãy giải thêm bài tập để tích lũy!`,
      };
    }

    // Deduct cost
    await tx.user.update({
      where: { id: user.id },
      data: { gachaTickets: { decrement: item.cost } },
    });

    let awardedCards: Array<{ id: string; name: string; rarity: string }> = [];

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
        select: { id: true, name: true, rarity: true },
        take: 50,
      });

      if (candidates.length > 0) {
        const picked = candidates[Math.floor(Math.random() * candidates.length)];
        await tx.userGachaCard.upsert({
          where: { userId_cardId: { userId: user.id, cardId: picked.id } },
          create: { userId: user.id, cardId: picked.id, count: 1 },
          update: { count: { increment: 1 } },
        });
        awardedCards.push(picked);
      }
    }

    // Record PointTransaction
    await tx.pointTransaction.create({
      data: {
        userId: user.id,
        amount: -item.cost,
        type: "SHOP_PURCHASE",
        description: `Mua "${item.name}" tại Gacha Shop`,
      },
    });

    const updated = await tx.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { gachaTickets: true },
    });

    return {
      success: true,
      itemName: item.name,
      newBalance: updated.gachaTickets,
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
    newBalance: result.newBalance,
    awardedCards: result.awardedCards,
    ticketsAwarded: result.ticketsAwarded,
  });
}