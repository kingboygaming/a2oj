export type ResourceNodeKind =
  | "FOREST"
  | "IRON_MINE"
  | "STONE_DEPOSIT"
  | "FOOD_LAND"
  | "RARE_RESOURCE";

export type WorldMapObject =
  | {
      id: string;
      kind: "RESOURCE";
      name: string;
      resource: ResourceNodeKind;
      level: number;
      amount: number;
      yieldPerMinute: number;
      requiredPower: number;
      x: number;
      z: number;
    }
  | {
      id: string;
      kind: "ROGUE_CAMP";
      name: string;
      monsterType: string;
      tier: "LEVEL_1" | "LEVEL_2" | "LEVEL_3" | "ELITE";
      level: number;
      troopCount: number;
      combatPower: number;
      reward: string;
      rewardItemKey: string;
      x: number;
      z: number;
    };

export const RESOURCE_NODES: Extract<WorldMapObject, { kind: "RESOURCE" }>[] = [
  { id: "forest-01", kind: "RESOURCE", name: "Rừng Thông Xanh", resource: "FOREST", level: 1, amount: 1_200, yieldPerMinute: 24, requiredPower: 80, x: -10800, z: -7000 },
  { id: "forest-02", kind: "RESOURCE", name: "Rừng Cổ Thụ", resource: "FOREST", level: 3, amount: 4_800, yieldPerMinute: 58, requiredPower: 220, x: 13400, z: 4800 },
  { id: "iron-01", kind: "RESOURCE", name: "Mỏ Sắt Đồi Đen", resource: "IRON_MINE", level: 2, amount: 2_400, yieldPerMinute: 32, requiredPower: 150, x: -13800, z: 5200 },
  { id: "iron-02", kind: "RESOURCE", name: "Mạch Sắt Đỏ", resource: "IRON_MINE", level: 3, amount: 4_000, yieldPerMinute: 48, requiredPower: 240, x: 7200, z: -13600 },
  { id: "stone-01", kind: "RESOURCE", name: "Vách Đá Xám", resource: "STONE_DEPOSIT", level: 1, amount: 1_600, yieldPerMinute: 28, requiredPower: 90, x: 2400, z: 14600 },
  { id: "stone-02", kind: "RESOURCE", name: "Mỏ Đá Thạch Anh", resource: "STONE_DEPOSIT", level: 3, amount: 4_500, yieldPerMinute: 55, requiredPower: 230, x: -3600, z: -15600 },
  { id: "food-01", kind: "RESOURCE", name: "Đồng Cỏ Màu Mỡ", resource: "FOOD_LAND", level: 1, amount: 1_400, yieldPerMinute: 34, requiredPower: 70, x: 14400, z: -8600 },
  { id: "food-02", kind: "RESOURCE", name: "Thung Lũng Lúa Mạch", resource: "FOOD_LAND", level: 2, amount: 3_000, yieldPerMinute: 52, requiredPower: 160, x: -15200, z: -11000 },
  { id: "rare-01", kind: "RESOURCE", name: "Tinh Thể Lam", resource: "RARE_RESOURCE", level: 3, amount: 360, yieldPerMinute: 5, requiredPower: 300, x: 8600, z: 10600 },
  { id: "rare-02", kind: "RESOURCE", name: "Mạch Nguyệt Thạch", resource: "RARE_RESOURCE", level: 4, amount: 620, yieldPerMinute: 8, requiredPower: 420, x: -7800, z: 12400 },
];

export const ROGUE_CAMPS: Extract<WorldMapObject, { kind: "ROGUE_CAMP" }>[] = [
  { id: "camp-01", kind: "ROGUE_CAMP", name: "Trại Goblin Bìa Rừng", monsterType: "Goblin", tier: "LEVEL_1", level: 1, troopCount: 24, combatPower: 90, reward: "Gỗ, đá và kinh nghiệm", rewardItemKey: "GOBLIN_FANG", x: 5600, z: 6800 },
  { id: "camp-02", kind: "ROGUE_CAMP", name: "Hang Sói Xám", monsterType: "Sói hoang", tier: "LEVEL_2", level: 2, troopCount: 48, combatPower: 180, reward: "Gỗ, đá và nguyên liệu", rewardItemKey: "WOLF_PELT", x: -6200, z: -4200 },
  { id: "camp-03", kind: "ROGUE_CAMP", name: "Pháo Đài Lưu Khấu", monsterType: "Lưu khấu", tier: "LEVEL_3", level: 3, troopCount: 90, combatPower: 330, reward: "Tài nguyên và vật phẩm nâng cấp", rewardItemKey: "BANDIT_TOKEN", x: 15800, z: 13000 },
  { id: "camp-elite", kind: "ROGUE_CAMP", name: "Ổ Quái Tinh Anh", monsterType: "Quái tinh anh", tier: "ELITE", level: 5, troopCount: 140, combatPower: 520, reward: "Vật phẩm hiếm và nguyên liệu chế tạo", rewardItemKey: "ELITE_CORE", x: -16400, z: 14600 },
];

export const WORLD_MAP_OBJECTS = [...RESOURCE_NODES, ...ROGUE_CAMPS];
export const MAX_RESOURCE_NODE_OCCUPANCY = 3;
export const RESOURCE_NODE_OCCUPATION_MS = 24 * 60 * 60 * 1000;
export const RESOURCE_NODE_RESPAWN_MS = 24 * 60 * 60 * 1000;
export const WORLD_MAP_MARCH_TROOP_LIMIT = 500;
export const WORLD_MAP_TROOP_RETURN_MS = 5 * 60 * 1000;
export const ROGUE_CAMP_RESPAWN_MS = {
  DEFAULT: 6 * 60 * 60 * 1000,
  ELITE: 24 * 60 * 60 * 1000,
} as const;

/**
 * Travel time for a map-object march.
 * @param offsetX distance along X in METRES, relative to the player's base.
 * @param offsetZ distance along Z in METRES, relative to the player's base.
 */
export function worldMapTravelMilliseconds(offsetX: number, offsetZ: number) {
  const distanceMeters = Math.hypot(offsetX, offsetZ);
  return Math.min(
    2 * 60 * 60 * 1000,
    Math.max(30_000, Math.ceil(distanceMeters / 10_000 * 5 * 60_000)),
  );
}

export function resourceKindLabel(kind: ResourceNodeKind) {
  switch (kind) {
    case "FOREST": return "Gỗ";
    case "IRON_MINE": return "Quặng sắt";
    case "STONE_DEPOSIT": return "Đá";
    case "FOOD_LAND": return "Lương thực";
    case "RARE_RESOURCE": return "Tài nguyên hiếm";
  }
}
