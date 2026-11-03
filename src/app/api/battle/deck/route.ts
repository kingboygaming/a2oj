import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const deckSchema = z.object({
  cards: z.array(z.object({
    cardId: z.string().min(1),
    count: z.number().int().min(1).max(20),
  })).min(1).max(20),
}).superRefine(({ cards }, context) => {
  const total = cards.reduce((sum, item) => sum + item.count, 0);
  if (total < 5 || total > 20) {
    context.addIssue({ code: "custom", path: ["cards"], message: "Bộ bài cần từ 5 đến 20 lá." });
  }
  if (new Set(cards.map(({ cardId }) => cardId)).size !== cards.length) {
    context.addIssue({ code: "custom", path: ["cards"], message: "Không chọn trùng một dòng thẻ." });
  }
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Cần đăng nhập để quản lý bộ bài." }, { status: 401 });

  const [ownedCards, deck] = await Promise.all([
    prisma.userGachaCard.findMany({
      where: { userId: user.id, card: { category: "BATTLE" } },
      orderBy: { card: { name: "asc" } },
      select: {
        count: true,
        card: {
          select: {
            id: true,
            slug: true,
            name: true,
            rarity: true,
            description: true,
            attack: true,
            defense: true,
            manaCost: true,
            level: true,
            element: true,
            icon: true,
            specialEffect: true,
            bugPart: true,
            critRate: true,
            evasionRate: true,
            counterRate: true,
            lifeStealRate: true,
            imageMimeType: true,
          },
        },
      },
    }),
    prisma.userBattleDeck.findUnique({
      where: { userId: user.id },
      include: { cards: { select: { cardId: true, count: true } } },
    }),
  ]);

  return NextResponse.json({
    cards: ownedCards.map(({ card, count }) => ({
      id: card.id,
      slug: card.slug,
      name: card.name,
      rarity: card.rarity,
      description: card.description,
      attack: card.attack,
      defense: card.defense,
      manaCost: card.manaCost,
      level: card.level,
      element: card.element,
      icon: card.icon,
      specialEffect: card.specialEffect,
      bugPart: card.bugPart,
      critRate: card.critRate,
      evasionRate: card.evasionRate,
      counterRate: card.counterRate,
      lifeStealRate: card.lifeStealRate,
      imageUrl: card.imageMimeType ? `/api/gacha/cards/${card.id}/image` : null,
      ownedCount: count,
    })),
    deck: deck?.cards ?? [],
  });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Cần đăng nhập để lưu bộ bài." }, { status: 401 });

  const parsed = deckSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Bộ bài không hợp lệ." }, { status: 400 });
  }

  const ownedCards = await prisma.userGachaCard.findMany({
    where: {
      userId: user.id,
      cardId: { in: parsed.data.cards.map(({ cardId }) => cardId) },
      card: { category: "BATTLE" },
    },
    select: { cardId: true, count: true },
  });
  const ownedById = new Map(ownedCards.map(({ cardId, count }) => [cardId, count]));
  if (ownedCards.length !== parsed.data.cards.length) {
    return NextResponse.json({ error: "Chỉ được đưa thẻ chiến đấu bạn đã sở hữu vào bộ bài." }, { status: 400 });
  }
  if (parsed.data.cards.some(({ cardId, count }) => count > (ownedById.get(cardId) ?? 0))) {
    return NextResponse.json({ error: "Số bản sao trong bộ bài vượt quá số thẻ bạn đang sở hữu." }, { status: 400 });
  }

  await prisma.$transaction(async (transaction) => {
    const deck = await transaction.userBattleDeck.upsert({
      where: { userId: user.id },
      create: { userId: user.id },
      update: {},
      select: { id: true },
    });
    await transaction.userBattleDeckCard.deleteMany({ where: { deckId: deck.id } });
    await transaction.userBattleDeckCard.createMany({
      data: parsed.data.cards.map(({ cardId, count }) => ({ deckId: deck.id, cardId, count })),
    });
  });

  return NextResponse.json({ success: true });
}
