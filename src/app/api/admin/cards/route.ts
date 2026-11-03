import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { GACHA_RARITIES } from "@/lib/gacha";
import { prisma } from "@/lib/prisma";

const cardSchema = z.object({
  slug: z.string().trim()
    .min(2, "Slug thẻ cần ít nhất 2 ký tự.")
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug chỉ gồm chữ thường, số và dấu gạch ngang."),
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).default(""),
  category: z.enum(["DISPLAY", "BATTLE"]),
  battleType: z.enum(["MONSTER", "SPELL", "TRAP"]).default("MONSTER"),
  rarity: z.enum(GACHA_RARITIES),
  specialOnly: z.enum(["true", "false"]).transform((value) => value === "true").default(false),
  attack: z.coerce.number().int().min(0).max(3000).default(0),
  defense: z.coerce.number().int().min(0).max(3000).default(0),
  manaCost: z.coerce.number().int().min(0).max(5).default(0),
  level: z.coerce.number().int().min(1).max(12).default(1),
  element: z.preprocess(
    (value) => value == null || (typeof value === "string" && !value.trim()) ? "Tin học" : value,
    z.string().trim().min(1).max(30),
  ),
  icon: z.preprocess(
    (value) => value == null || (typeof value === "string" && !value.trim()) ? "🃏" : value,
    z.string().trim().min(1).max(12),
  ),
  critRate: z.coerce.number().int().min(0).max(100).default(0),
  evasionRate: z.coerce.number().int().min(0).max(100).default(0),
  counterRate: z.coerce.number().int().min(0).max(100).default(0),
  lifeStealRate: z.coerce.number().int().min(0).max(100).default(0),
  specialEffect: z.enum([
    "NONE", "SLIFER", "RA", "OBELISK",
    "SPELL_DRAW", "SPELL_HEAL", "SPELL_DAMAGE",
    "TRAP_NEGATE_ATTACK", "TRAP_REFLECT_DAMAGE",
  ]).default("NONE"),
  bugPart: z.enum(["CE", "TLE", "MLE", "WA", "PE"]).or(z.literal("")).default(""),
}).superRefine((data, context) => {
  if (data.category === "BATTLE" && data.battleType === "MONSTER" && (data.attack < 500 || data.defense < 500 || data.manaCost < 1)) {
    context.addIssue({ code: "custom", path: ["attack"], message: "Thẻ chiến đấu cần ATK/DEF từ 500 và Mana Cost từ 1." });
  }
  if (data.category === "BATTLE" && data.battleType === "SPELL" && (!["SPELL_DRAW", "SPELL_HEAL", "SPELL_DAMAGE"].includes(data.specialEffect) || data.manaCost < 1)) {
    context.addIssue({ code: "custom", path: ["specialEffect"], message: "Thẻ Phép cần hiệu ứng Phép hợp lệ và Mana Cost từ 1." });
  }
  if (data.category === "BATTLE" && data.battleType === "TRAP" && (!["TRAP_NEGATE_ATTACK", "TRAP_REFLECT_DAMAGE"].includes(data.specialEffect) || data.manaCost < 1)) {
    context.addIssue({ code: "custom", path: ["specialEffect"], message: "Thẻ Bẫy cần hiệu ứng Bẫy hợp lệ và Mana Cost từ 1." });
  }
  if (data.category === "BATTLE" && data.battleType === "MONSTER" && !["NONE", "SLIFER", "RA", "OBELISK"].includes(data.specialEffect)) {
    context.addIssue({ code: "custom", path: ["specialEffect"], message: "Quái vật chỉ được dùng nội tại quái vật." });
  }
  if (data.battleType !== "MONSTER" && data.category === "BATTLE" && data.bugPart) {
    context.addIssue({ code: "custom", path: ["bugPart"], message: "Chỉ quái vật mới có thể mang mảnh Compile Exodia." });
  }
  if (data.battleType !== "MONSTER" && data.specialEffect !== "NONE" &&
    !["SPELL_DRAW", "SPELL_HEAL", "SPELL_DAMAGE", "TRAP_NEGATE_ATTACK", "TRAP_REFLECT_DAMAGE"].includes(data.specialEffect)) {
    context.addIssue({ code: "custom", path: ["specialEffect"], message: "Hiệu ứng Thần chỉ dùng cho quái vật." });
  }
  if (data.category === "DISPLAY" && data.specialEffect !== "NONE") {
    context.addIssue({ code: "custom", path: ["specialEffect"], message: "Nội tại Thần chỉ dùng cho thẻ chiến đấu." });
  }
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Bạn không có quyền quản trị." }, { status: 403 });
  }

  const formData = await request.formData();
  const parsed = cardSchema.safeParse({
    slug: formData.get("slug"),
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    category: formData.get("category"),
    battleType: formData.get("battleType") ?? "MONSTER",
    rarity: formData.get("rarity"),
    specialOnly: formData.get("specialOnly") ?? "false",
    attack: formData.get("attack") ?? 0,
    defense: formData.get("defense") ?? 0,
    manaCost: formData.get("manaCost") ?? 0,
    level: formData.get("level") ?? 1,
    element: formData.get("element") ?? "Tin học",
    icon: formData.get("icon") ?? "🃏",
    critRate: formData.get("critRate") ?? 0,
    evasionRate: formData.get("evasionRate") ?? 0,
    counterRate: formData.get("counterRate") ?? 0,
    lifeStealRate: formData.get("lifeStealRate") ?? 0,
    specialEffect: formData.get("specialEffect") ?? "NONE",
    bugPart: formData.get("bugPart") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Thông tin thẻ không hợp lệ." }, { status: 400 });
  }

  const image = formData.get("image");
  if (image && (!(image instanceof File) || !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(image.type) || image.size > 3 * 1024 * 1024)) {
    return NextResponse.json({ error: "Ảnh phải là JPEG, PNG, WebP hoặc GIF và không quá 3 MB." }, { status: 400 });
  }

  const battle = parsed.data.category === "BATTLE";
  const battleType = battle ? parsed.data.battleType : "MONSTER";
  const isMonster = battle && battleType === "MONSTER";
  const specialEffect = battle ? parsed.data.specialEffect : "NONE";
  const isGod = ["SLIFER", "RA", "OBELISK"].includes(specialEffect);
  if (parsed.data.bugPart && !battle) {
    return NextResponse.json({ error: "Mảnh Compile Exodia chỉ dành cho thẻ chiến đấu." }, { status: 400 });
  }

  try {
    const card = await prisma.gachaCard.create({
      data: {
        ...parsed.data,
        category: parsed.data.category,
        battleType,
        specialOnly: battle ? false : parsed.data.specialOnly,
        attack: isMonster ? (isGod ? 4000 : parsed.data.attack) : 0,
        defense: isMonster ? (isGod ? 4000 : parsed.data.defense) : 0,
        manaCost: battle ? parsed.data.manaCost : 0,
        level: isMonster ? (isGod ? 10 : parsed.data.level) : 1,
        critRate: isMonster ? parsed.data.critRate : 0,
        evasionRate: isMonster ? parsed.data.evasionRate : 0,
        counterRate: isMonster ? parsed.data.counterRate : 0,
        lifeStealRate: isMonster ? parsed.data.lifeStealRate : 0,
        imageData: image instanceof File && image.size > 0 ? new Uint8Array(await image.arrayBuffer()) : null,
        imageMimeType: image instanceof File && image.size > 0 ? image.type : null,
        bugPart: isMonster ? parsed.data.bugPart || null : null,
      },
      select: {
        id: true,
        slug: true,
        name: true,
        category: true,
        rarity: true,
        attack: true,
        defense: true,
      },
    });
    return NextResponse.json({ success: true, card }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "Slug thẻ đã được sử dụng." }, { status: 409 });
    }
    throw error;
  }
}
