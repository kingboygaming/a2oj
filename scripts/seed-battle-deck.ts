import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seedBattleDeck() {
  // Find the student user
  const student = await prisma.user.findUnique({
    where: { username: "hs" },
  });

  if (!student) {
    console.error("User 'hs' not found. Please run prisma seed first.");
    process.exit(1);
  }

  // Get all battle cards
  const battleCards = await prisma.gachaCard.findMany({
    where: { category: "BATTLE" },
  });

  if (battleCards.length === 0) {
    console.error("No battle cards found. Please run seed-spell-trap-starter.ts first.");
    process.exit(1);
  }

  // Create or update user's battle deck
  const deck = await prisma.userBattleDeck.upsert({
    where: { userId: student.id },
    create: { userId: student.id },
    update: {},
  });

  // Add multiple copies of each card to the deck
  for (const card of battleCards) {
    await prisma.userBattleDeckCard.upsert({
      where: {
        deckId_cardId: {
          deckId: deck.id,
          cardId: card.id,
        },
      },
      create: {
        deckId: deck.id,
        cardId: card.id,
        count: 3, // 3 copies of each card
      },
      update: {
        count: 3,
      },
    });
  }

  // Also add the cards to user's owned cards so they can pull them
  for (const card of battleCards) {
    await prisma.userGachaCard.upsert({
      where: {
        userId_cardId: {
          userId: student.id,
          cardId: card.id,
        },
      },
      create: {
        userId: student.id,
        cardId: card.id,
        count: 10, // 10 copies for gacha pulls
      },
      update: {
        count: 10,
      },
    });
  }

  console.log(`Battle deck seeded for user ${student.username} with ${battleCards.length} card types (3 copies each).`);
  console.log(`User also owns ${battleCards.length} card types (10 copies each) for gacha.`);
}

seedBattleDeck()
  .catch((error: unknown) => {
    console.error("Could not seed battle deck.", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
