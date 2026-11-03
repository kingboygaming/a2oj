import { z } from "zod";
import { GACHA_RARITIES } from "@/lib/gacha";

export const gachaCardSchema = z.object({
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
  attack: z.coerce.number().int().min(0).max(5000).default(0),
  defense: z.coerce.number().int().min(0).max(5000).default(0),
  manaCost: z.coerce.number().int().min(0).max(5).default(0),
  level: z.coerce.number().int().min(1).max(12).default(1),
  requiredTributes: z.preprocess(
    (value) => value == null || value === "" ? null : value,
    z.union([z.null(), z.coerce.number().int().min(0).max(3)]),
  ).default(null),
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
    "NONE", "SLIFER", "RA", "OBELISK", "STONE_WARDEN",
    "SPELL_DRAW", "SPELL_HEAL", "SPELL_DAMAGE",
    "TRAP_NEGATE_ATTACK", "TRAP_REFLECT_DAMAGE",
  ]).default("NONE"),
  bugPart: z.enum(["CE", "TLE", "MLE", "WA", "PE"]).or(z.literal("")).default(""),
}).superRefine((data, context) => {
  if (data.category === "BATTLE" && data.battleType === "MONSTER" && (data.attack < 500 || data.defense < 500 || data.manaCost < 1)) {
    context.addIssue({ code: "custom", path: ["attack"], message: "Quái vật cần ATK/DEF từ 500 và Mana Cost từ 1." });
  }
  if (data.category === "BATTLE" && data.battleType === "SPELL" && (!["SPELL_DRAW", "SPELL_HEAL", "SPELL_DAMAGE"].includes(data.specialEffect) || data.manaCost < 1)) {
    context.addIssue({ code: "custom", path: ["specialEffect"], message: "Thẻ Phép cần hiệu ứng Phép hợp lệ và Mana Cost từ 1." });
  }
  if (data.category === "BATTLE" && data.battleType === "TRAP" && (!["TRAP_NEGATE_ATTACK", "TRAP_REFLECT_DAMAGE"].includes(data.specialEffect) || data.manaCost < 1)) {
    context.addIssue({ code: "custom", path: ["specialEffect"], message: "Thẻ Bẫy cần hiệu ứng Bẫy hợp lệ và Mana Cost từ 1." });
  }
  if (data.category === "BATTLE" && data.battleType === "MONSTER" && !["NONE", "SLIFER", "RA", "OBELISK", "STONE_WARDEN"].includes(data.specialEffect)) {
    context.addIssue({ code: "custom", path: ["specialEffect"], message: "Quái vật chỉ được dùng nội tại quái vật." });
  }
  if (data.battleType !== "MONSTER" && data.category === "BATTLE" && data.bugPart) {
    context.addIssue({ code: "custom", path: ["bugPart"], message: "Chỉ quái vật mới có thể mang mảnh Compile Exodia." });
  }
  if (data.battleType !== "MONSTER" && data.specialEffect !== "NONE" &&
    !["SPELL_DRAW", "SPELL_HEAL", "SPELL_DAMAGE", "TRAP_NEGATE_ATTACK", "TRAP_REFLECT_DAMAGE"].includes(data.specialEffect)) {
    context.addIssue({ code: "custom", path: ["specialEffect"], message: "Hiệu ứng quái vật chỉ dùng cho quái vật." });
  }
  if (data.category === "DISPLAY" && data.specialEffect !== "NONE") {
    context.addIssue({ code: "custom", path: ["specialEffect"], message: "Hiệu ứng chỉ dùng cho thẻ PvP." });
  }
});

export function parseGachaCardForm(formData: FormData) {
  return gachaCardSchema.safeParse({
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
    requiredTributes: formData.get("requiredTributes"),
    element: formData.get("element") ?? "Tin học",
    icon: formData.get("icon") ?? "🃏",
    critRate: formData.get("critRate") ?? 0,
    evasionRate: formData.get("evasionRate") ?? 0,
    counterRate: formData.get("counterRate") ?? 0,
    lifeStealRate: formData.get("lifeStealRate") ?? 0,
    specialEffect: formData.get("specialEffect") ?? "NONE",
    bugPart: formData.get("bugPart") ?? "",
  });
}

export function normalizeGachaCardData(data: z.output<typeof gachaCardSchema>) {
  const isBattle = data.category === "BATTLE";
  const isMonster = isBattle && data.battleType === "MONSTER";
  const isGod = ["SLIFER", "RA", "OBELISK", "STONE_WARDEN"].includes(data.specialEffect);
  const specialEffect = data.specialEffect === "OBELISK" ? "STONE_WARDEN" : data.specialEffect;

  return {
    ...data,
    battleType: isBattle ? data.battleType : "MONSTER",
    specialOnly: isBattle ? false : data.specialOnly,
    attack: isMonster ? data.attack : 0,
    defense: isMonster ? data.defense : 0,
    manaCost: isBattle ? data.manaCost : 0,
    level: isMonster ? (isGod ? 10 : data.level) : 1,
    requiredTributes: isMonster
      ? specialEffect === "RA" ? 3 : specialEffect === "STONE_WARDEN" ? 2 : data.requiredTributes
      : null,
    critRate: isMonster ? data.critRate : 0,
    evasionRate: isMonster ? data.evasionRate : 0,
    counterRate: isMonster ? data.counterRate : 0,
    lifeStealRate: isMonster ? data.lifeStealRate : 0,
    specialEffect: isBattle ? specialEffect : "NONE",
    bugPart: isMonster ? data.bugPart || null : null,
  };
}
