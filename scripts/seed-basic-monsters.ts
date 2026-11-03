import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const basicMonsters = [
  {
    id: "a2oj_basic_ember_fox",
    slug: "a2oj-cu-rung-database",
    name: "Cú Rừng Database",
    description: "Quái vật cơ bản với chỉ số cân bằng.",
    battleType: "MONSTER",
    attack: 2000,
    defense: 1500,
    manaCost: 1,
    level: 4,
    element: "Tin học",
    icon: "🦊",
    specialEffect: "NONE",
  },
  {
    id: "a2oj_basic_python_dragon",
    slug: "a2oj-rong-python",
    name: "Rồng Python",
    description: "Quái vật tấn công mạnh nhưng phòng thủ yếu.",
    battleType: "MONSTER",
    attack: 2500,
    defense: 1000,
    manaCost: 2,
    level: 4,
    element: "Tin học",
    icon: "🐉",
    specialEffect: "NONE",
  },
  {
    id: "a2oj_basic_java_golem",
    slug: "a2oj-golem-java",
    name: "Golem Java",
    description: "Quái vật phòng thủ mạnh nhưng tấn công yếu.",
    battleType: "MONSTER",
    attack: 1200,
    defense: 2800,
    manaCost: 2,
    level: 4,
    element: "Tin học",
    icon: "🗿",
    specialEffect: "NONE",
  },
  {
    id: "a2oj_basic_cpp_tiger",
    slug: "a2oj-ho-cpp",
    name: "Hổ C++",
    description: "Quái vật cân bằng với chỉ số trung bình.",
    battleType: "MONSTER",
    attack: 1800,
    defense: 1800,
    manaCost: 1,
    level: 4,
    element: "Tin học",
    icon: "🐯",
    specialEffect: "NONE",
  },
  {
    id: "a2oj_basic_goblin",
    slug: "a2oj-tinh-goblin",
    name: "Tinh Goblin",
    description: "Quái vật yếu, dễ triệu hồi.",
    battleType: "MONSTER",
    attack: 1000,
    defense: 1000,
    manaCost: 0,
    level: 1,
    element: "Tin học",
    icon: "👺",
    specialEffect: "NONE",
  },
] as const;

async function seedBasicMonsters() {
  const banner = await prisma.gachaBanner.upsert({
    where: { slug: "a2oj-basic-monsters" },
    create: {
      id: "a2oj_basic_monsters_banner",
      slug: "a2oj-basic-monsters",
      title: "Quái vật cơ bản A2OJ",
      description: "Các quái vật cơ bản để bắt đầu chiến đấu.",
      type: "NORMAL",
      active: true,
    },
    update: {},
    select: { id: true },
  });

  for (const card of basicMonsters) {
    await prisma.gachaCard.upsert({
      where: { slug: card.slug },
      create: {
        ...card,
        category: "BATTLE",
        rarity: "COMMON",
        specialOnly: false,
        attack: card.attack,
        defense: card.defense,
        level: card.level,
      },
      update: {},
    });
  }

  for (const card of basicMonsters) {
    const dbCard = await prisma.gachaCard.findUniqueOrThrow({
      where: { slug: card.slug },
      select: { id: true },
    });
    await prisma.gachaBannerCard.upsert({
      where: { bannerId_cardId: { bannerId: banner.id, cardId: dbCard.id } },
      create: { bannerId: banner.id, cardId: dbCard.id, dropRate: 30 },
      update: {},
    });
  }

  // Add to user's deck
  const student = await prisma.user.findUnique({
    where: { username: "hs" },
  });

  if (student) {
    const deck = await prisma.userBattleDeck.upsert({
      where: { userId: student.id },
      create: { userId: student.id },
      update: {},
    });

    for (const card of basicMonsters) {
      const dbCard = await prisma.gachaCard.findUniqueOrThrow({
        where: { slug: card.slug },
        select: { id: true },
      });

      await prisma.userBattleDeckCard.upsert({
        where: {
          deckId_cardId: {
            deckId: deck.id,
            cardId: dbCard.id,
          },
        },
        create: {
          deckId: deck.id,
          cardId: dbCard.id,
          count: 3,
        },
        update: {
          count: 3,
        },
      });

      await prisma.userGachaCard.upsert({
        where: {
          userId_cardId: {
            userId: student.id,
            cardId: dbCard.id,
          },
        },
        create: {
          userId: student.id,
          cardId: dbCard.id,
          count: 10,
        },
        update: {
          count: 10,
        },
      });
    }
  }

  console.info("Basic monsters seeded and added to user's deck.");
}

seedBasicMonsters()
  .catch((error: unknown) => {
    console.error("Could not seed basic monsters.", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
