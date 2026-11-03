import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const starterCards = [
  {
    id: "a2oj_starter_spell_draw",
    slug: "a2oj-menh-de-tiep-te",
    name: "Mệnh Đề Tiếp Tế",
    description: "Rút thêm một lá từ bộ bài nếu vẫn còn lá.",
    battleType: "SPELL",
    manaCost: 2,
    element: "Phép",
    icon: "📚",
    specialEffect: "SPELL_DRAW",
  },
  {
    id: "a2oj_starter_spell_heal",
    slug: "a2oj-vong-hoi-phuc",
    name: "Vòng Hồi Phục",
    description: "Khôi phục 5 HP hoặc 1000 LP cho người sử dụng.",
    battleType: "SPELL",
    manaCost: 2,
    element: "Phép",
    icon: "💚",
    specialEffect: "SPELL_HEAL",
  },
  {
    id: "a2oj_starter_spell_strike",
    slug: "a2oj-xung-dot-bit",
    name: "Xung Đột Bit",
    description: "Gây 4 sát thương hoặc 800 LP cho đối thủ.",
    battleType: "SPELL",
    manaCost: 3,
    element: "Phép",
    icon: "⚡",
    specialEffect: "SPELL_DAMAGE",
  },
  {
    id: "a2oj_starter_trap_negate",
    slug: "a2oj-luoi-chan-tin-hieu",
    name: "Lưới Chặn Tín Hiệu",
    description: "Úp xuống sân. Khi đối thủ tấn công, hủy sát thương của đòn đánh đó.",
    battleType: "TRAP",
    manaCost: 2,
    element: "Bẫy",
    icon: "🕸️",
    specialEffect: "TRAP_NEGATE_ATTACK",
  },
  {
    id: "a2oj_starter_trap_reflect",
    slug: "a2oj-guong-doi-xung",
    name: "Gương Đối Xứng",
    description: "Úp xuống sân. Khi đối thủ tấn công, phản lại 25% sát thương.",
    battleType: "TRAP",
    manaCost: 2,
    element: "Bẫy",
    icon: "🪞",
    specialEffect: "TRAP_REFLECT_DAMAGE",
  },
] as const;

async function seedSpellTrapStarter() {
  const banner = await prisma.gachaBanner.upsert({
    where: { slug: "a2oj-spell-trap-starter" },
    create: {
      id: "a2oj_spell_trap_starter_banner",
      slug: "a2oj-spell-trap-starter",
      title: "Bộ khởi đầu: Phép & Bẫy A2OJ",
      description: "Các lá Phép và Bẫy nguyên bản để bắt đầu xây dựng chiến thuật PvP.",
      type: "NORMAL",
      active: true,
    },
    update: {},
    select: { id: true },
  });

  for (const card of starterCards) {
    const savedCard = await prisma.gachaCard.upsert({
      where: { slug: card.slug },
      create: {
        ...card,
        category: "BATTLE",
        rarity: "COMMON",
        specialOnly: false,
        attack: 0,
        defense: 0,
        level: 1,
      },
      update: {},
      select: { id: true },
    });

    await prisma.gachaBannerCard.upsert({
      where: { bannerId_cardId: { bannerId: banner.id, cardId: savedCard.id } },
      create: { bannerId: banner.id, cardId: savedCard.id, dropRate: 20 },
      update: {},
    });
  }

  console.info("Spell/trap starter banner is ready.");
}

seedSpellTrapStarter()
  .catch((error: unknown) => {
    console.error("Could not seed the spell/trap starter banner.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
