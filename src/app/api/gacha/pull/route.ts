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
      include: { cards: { select: { cardId: true, dropRate: true, card: { select: { rarity: true } } } } },
    });
    if (!banner || !isBannerAvailable(banner)) return { error: "Banner hiện không mở." as const };
    if (banner.cards.length === 0) return { error: "Banner chưa có thẻ để quay." as const };
    const legendaryCards = banner.cards.filter(({ card }) => card.rarity === "LEGENDARY");
    if (banner.legendaryPity > 0 && legendaryCards.length === 0) {
      return { error: "Banner chưa có thẻ Huyền thoại để kích hoạt pity." as const };
    }

    const spent = await transaction.user.updateMany({
      where: { id: user.id, gachaTickets: { gte: parsed.data.quantity } },
      data: { gachaTickets: { decrement: parsed.data.quantity } },
    });
    if (!spent.count) return { error: "Bạn không đủ lượt quay." as const };
    const pityState = banner.legendaryPity > 0
      ? await transaction.userGachaBannerPity.findUnique({
          where: { userId_bannerId: { userId: user.id, bannerId: banner.id } },
          select: { failedPulls: true },
        })
      : null;
    let failedPulls = pityState?.failedPulls ?? 0;

    const pulledCards: {
      id: string;
      name: string;
      rarity: string;
      description: string;
      category: string;
      battleType: string;
      attack: number;
      defense: number;
      manaCost: number;
      level: number;
      element: string;
      icon: string;
      imageUrl: string | null;
      dropRate: number;
      pityGuaranteed: boolean;
    }[] = [];
    for (let index = 0; index < parsed.data.quantity; index += 1) {
      const pityGuaranteed = banner.legendaryPity > 0 && failedPulls + 1 >= banner.legendaryPity;
      const cardId = chooseBannerCard(pityGuaranteed ? legendaryCards : banner.cards, !pityGuaranteed);
      const bannerCard = banner.cards.find((item) => item.cardId === cardId);
      const card = await transaction.gachaCard.findUnique({
        where: { id: cardId },
        select: {
          id: true,
          name: true,
          rarity: true,
          description: true,
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
        imageUrl: card.imageMimeType ? `/api/gacha/cards/${card.id}/image` : null,
        dropRate: bannerCard.dropRate,
        pityGuaranteed,
      });
      failedPulls = card.rarity === "LEGENDARY" ? 0 : failedPulls + 1;
    }
    if (banner.legendaryPity > 0) {
      await transaction.userGachaBannerPity.upsert({
        where: { userId_bannerId: { userId: user.id, bannerId: banner.id } },
        create: { userId: user.id, bannerId: banner.id, failedPulls },
        update: { failedPulls },
      });
    }

    const balance = await transaction.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { gachaTickets: true },
    });
    return {
      cards: pulledCards,
      tickets: balance.gachaTickets,
      pity: { failedPulls, threshold: banner.legendaryPity },
    };
  });

  if ("error" in result) {
    const status = result.error === "Bạn không đủ lượt quay." ? 400 : 409;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json(result);
}
