import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { chooseBannerCard, isBannerAvailable } from "@/lib/gacha";
import { prisma } from "@/lib/prisma";

const requestSchema = z.object({
  bannerId: z.string().min(1),
  quantity: z.union([z.literal(1), z.literal(10)]),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Cần đăng nhập để quay gacha." }, { status: 401 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Lượt quay không hợp lệ." }, { status: 400 });

  const result = await prisma.$transaction(async (transaction) => {
    const banner = await transaction.gachaBanner.findUnique({
      where: { id: parsed.data.bannerId },
      include: { cards: { select: { cardId: true, dropRate: true } } },
    });
    if (!banner || !isBannerAvailable(banner)) return { error: "Banner hiện không mở." as const };
    if (banner.cards.length === 0) return { error: "Banner chưa có thẻ để quay." as const };

    const spent = await transaction.user.updateMany({
      where: { id: user.id, gachaTickets: { gte: parsed.data.quantity } },
      data: { gachaTickets: { decrement: parsed.data.quantity } },
    });
    if (!spent.count) return { error: "Bạn không đủ lượt quay." as const };

    const pulledCards: { id: string; name: string; rarity: string; description: string; imageUrl: string; dropRate: number }[] = [];
    for (let index = 0; index < parsed.data.quantity; index += 1) {
      const cardId = chooseBannerCard(banner.cards);
      const bannerCard = banner.cards.find((item) => item.cardId === cardId);
      const card = await transaction.gachaCard.findUnique({
        where: { id: cardId },
        select: { id: true, name: true, rarity: true, description: true },
      });
      if (!bannerCard || !card) throw new Error("Banner chứa thẻ không hợp lệ.");
      await transaction.gachaPull.create({
        data: { userId: user.id, bannerId: banner.id, cardId },
      });
      await transaction.userGachaCard.upsert({
        where: { userId_cardId: { userId: user.id, cardId } },
        create: { userId: user.id, cardId },
        update: { count: { increment: 1 } },
      });
      pulledCards.push({
        ...card,
        imageUrl: `/api/gacha/cards/${card.id}/image`,
        dropRate: bannerCard.dropRate,
      });
    }

    const balance = await transaction.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { gachaTickets: true },
    });
    return { cards: pulledCards, tickets: balance.gachaTickets };
  });

  if ("error" in result) {
    const status = result.error === "Bạn không đủ lượt quay." ? 400 : 409;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json(result);
}
