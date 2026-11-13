export const WORLD_RESEARCH_KEYS = [
  "MILITARY_TIER",
  "PRODUCTION_EFFICIENCY",
  "RESEARCH_SPEED",
] as const;

export type WorldResearchKey = (typeof WORLD_RESEARCH_KEYS)[number];

export type WorldResearchCost = {
  wood: number;
  stone: number;
  iron: number;
  food: number;
  rare: number;
};

export type WorldResearchStep = {
  level: number;
  name: string;
  durationSeconds: number;
  castleLevel: number;
  cost: WorldResearchCost;
  effect: string;
};

type WorldResearchDefinition = {
  name: string;
  description: string;
  maxLevel: number;
  step(level: number): WorldResearchStep;
};

const TIER_NAMES = ["Sắt", "Vàng", "Kim cương"] as const;

export const WORLD_RESEARCH_DEFINITIONS: Record<WorldResearchKey, WorldResearchDefinition> = {
  MILITARY_TIER: {
    name: "Cấp quân đội",
    description: "Nâng chất lượng toàn quân và tăng chiến lực.",
    maxLevel: TIER_NAMES.length,
    step(level) {
      const costs = [
        { wood: 300, stone: 200, iron: 40, food: 100, rare: 0 },
        { wood: 800, stone: 500, iron: 160, food: 250, rare: 30 },
        { wood: 1_500, stone: 1_000, iron: 400, food: 600, rare: 100 },
      ];
      return {
        level,
        name: TIER_NAMES[level - 1] ?? `Bậc ${level + 1}`,
        durationSeconds: [120, 900, 3_600][level - 1] ?? 3_600 * level,
        castleLevel: level,
        cost: costs[level - 1] ?? {
          wood: 1_500 * level,
          stone: 1_000 * level,
          iron: 400 * level,
          food: 600 * level,
          rare: 100 * level,
        },
        effect: `Tăng ${25 * level}% chiến lực cho toàn quân.`,
      };
    },
  },
  PRODUCTION_EFFICIENCY: {
    name: "Kỹ thuật sản xuất",
    description: "Tăng sản lượng Xưởng gỗ, Mỏ đá và Nông trại.",
    maxLevel: 5,
    step(level) {
      return {
        level,
        name: `Kỹ thuật sản xuất ${level}`,
        durationSeconds: 90 * level,
        castleLevel: 1,
        cost: { wood: 120 * level, stone: 80 * level, iron: 0, food: 40 * level, rare: 0 },
        effect: `Tăng ${10 * level}% sản lượng công trình kinh tế.`,
      };
    },
  },
  RESEARCH_SPEED: {
    name: "Phương pháp nghiên cứu",
    description: "Rút ngắn thời gian hoàn thành các nghiên cứu tiếp theo.",
    maxLevel: 5,
    step(level) {
      return {
        level,
        name: `Phương pháp nghiên cứu ${level}`,
        durationSeconds: 120 * level,
        castleLevel: 1,
        cost: { wood: 150 * level, stone: 100 * level, iron: 20 * level, food: 50 * level, rare: 0 },
        effect: `Giảm ${10 * level}% thời gian nghiên cứu.`,
      };
    },
  },
};

export function isWorldResearchKey(value: string): value is WorldResearchKey {
  return WORLD_RESEARCH_KEYS.some((key) => key === value);
}

export function worldMilitaryTierName(level: number) {
  return ["Đá", ...TIER_NAMES][level] ?? `Bậc ${level + 1}`;
}
