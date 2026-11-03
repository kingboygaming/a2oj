import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const cards = await prisma.gachaCard.findMany({
    where: { category: "BATTLE" },
    orderBy: [{ specialEffect: "asc" }, { name: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      rarity: true,
      attack: true,
      defense: true,
      manaCost: true,
      level: true,
      element: true,
      icon: true,
      critRate: true,
      evasionRate: true,
      counterRate: true,
      lifeStealRate: true,
      specialEffect: true,
      bugPart: true,
      imageMimeType: true,
    },
  });
  return NextResponse.json({
    cards: cards.map(({ imageMimeType, ...card }) => ({
      ...card,
      imageUrl: imageMimeType ? `/api/gacha/cards/${card.id}/image` : null,
    })),
  });
}
