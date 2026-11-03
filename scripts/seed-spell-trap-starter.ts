import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const starterCards = [
  {
    id: "a2oj_starter_tribute_five",
    slug: "a2oj-nguoi-gac-kho-du-lieu",
    name: "Người Gác Kho Dữ Liệu",
    description: "Quái vật cấp 5. Cần hiến tế 1 quái vật đang có trên sân để triệu hồi theo luật OCG.",
    battleType: "MONSTER",
    attack: 1800,
    defense: 2000,
    manaCost: 2,
    level: 5,
    element: "Tin học",
    icon: "🛡️",
    specialEffect: "NONE",
  },
  {
    id: "a2oj_starter_tribute_seven",
    slug: "a2oj-nguoi-giu-vong-lap",
    name: "Người Giữ Vòng Lặp",
    description: "Quái vật cấp 7. Cần hiến tế 2 quái vật đang có trên sân để triệu hồi theo luật OCG.",
    battleType: "MONSTER",
    attack: 2500,
    defense: 2200,
    manaCost: 3,
    level: 7,
    element: "Tin học",
    icon: "🔱",
    specialEffect: "NONE",
  },
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

  const tributeBanner = await prisma.gachaBanner.upsert({
    where: { slug: "a2oj-tribute-monsters" },
    create: {
      id: "a2oj_tribute_monsters_banner",
      slug: "a2oj-tribute-monsters",
      title: "Quái vật cần hiến tế",
      description: "Quái vật cấp cao nguyên bản, cần hiến tế quái vật trên sân theo luật OCG.",
      type: "NORMAL",
      active: true,
    },
    update: {},
    select: { id: true },
  });

  for (const card of starterCards) {
    await prisma.gachaCard.upsert({
      where: { slug: card.slug },
      create: {
        ...card,
        category: "BATTLE",
        rarity: "COMMON",
        specialOnly: false,
        attack: "attack" in card ? card.attack : 0,
        defense: "defense" in card ? card.defense : 0,
        level: "level" in card ? card.level : 1,
      },
      update: {},
    });
  }

  for (const slug of [
    "a2oj-menh-de-tiep-te",
    "a2oj-vong-hoi-phuc",
    "a2oj-xung-dot-bit",
    "a2oj-luoi-chan-tin-hieu",
    "a2oj-guong-doi-xung",
  ]) {
    const card = await prisma.gachaCard.findUniqueOrThrow({
      where: { slug },
      select: { id: true },
    });
    await prisma.gachaBannerCard.upsert({
      where: { bannerId_cardId: { bannerId: banner.id, cardId: card.id } },
      create: { bannerId: banner.id, cardId: card.id, dropRate: 20 },
      update: {},
    });
  }

  for (const slug of ["a2oj-nguoi-gac-kho-du-lieu", "a2oj-nguoi-giu-vong-lap"]) {
    const card = await prisma.gachaCard.findUniqueOrThrow({
      where: { slug },
      select: { id: true },
    });
    await prisma.gachaBannerCard.upsert({
      where: { bannerId_cardId: { bannerId: tributeBanner.id, cardId: card.id } },
      create: { bannerId: tributeBanner.id, cardId: card.id, dropRate: 50 },
      update: {},
    });
  }

  console.info("Spell/trap and tribute-monster starter banners are ready.");
}

seedSpellTrapStarter()
  .catch((error: unknown) => {
    console.error("Could not seed the spell/trap starter banner.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
