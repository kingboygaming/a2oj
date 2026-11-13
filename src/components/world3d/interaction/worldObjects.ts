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
      x: number;
      z: number;
    };

export const RESOURCE_NODES: Extract<WorldMapObject, { kind: "RESOURCE" }>[] = [
  { id: "forest-01", kind: "RESOURCE", name: "Rừng Thông Xanh", resource: "FOREST", level: 1, amount: 1_200, yieldPerMinute: 24, requiredPower: 80, x: -54, z: -35 },
  { id: "forest-02", kind: "RESOURCE", name: "Rừng Cổ Thụ", resource: "FOREST", level: 3, amount: 4_800, yieldPerMinute: 58, requiredPower: 220, x: 67, z: 24 },
  { id: "iron-01", kind: "RESOURCE", name: "Mỏ Sắt Đồi Đen", resource: "IRON_MINE", level: 2, amount: 2_400, yieldPerMinute: 32, requiredPower: 150, x: -69, z: 26 },
  { id: "iron-02", kind: "RESOURCE", name: "Mạch Sắt Đỏ", resource: "IRON_MINE", level: 3, amount: 4_000, yieldPerMinute: 48, requiredPower: 240, x: 36, z: -68 },
  { id: "stone-01", kind: "RESOURCE", name: "Vách Đá Xám", resource: "STONE_DEPOSIT", level: 1, amount: 1_600, yieldPerMinute: 28, requiredPower: 90, x: 12, z: 73 },
  { id: "stone-02", kind: "RESOURCE", name: "Mỏ Đá Thạch Anh", resource: "STONE_DEPOSIT", level: 3, amount: 4_500, yieldPerMinute: 55, requiredPower: 230, x: -18, z: -78 },
  { id: "food-01", kind: "RESOURCE", name: "Đồng Cỏ Màu Mỡ", resource: "FOOD_LAND", level: 1, amount: 1_400, yieldPerMinute: 34, requiredPower: 70, x: 72, z: -43 },
  { id: "food-02", kind: "RESOURCE", name: "Thung Lũng Lúa Mạch", resource: "FOOD_LAND", level: 2, amount: 3_000, yieldPerMinute: 52, requiredPower: 160, x: -76, z: -55 },
  { id: "rare-01", kind: "RESOURCE", name: "Tinh Thể Lam", resource: "RARE_RESOURCE", level: 3, amount: 360, yieldPerMinute: 5, requiredPower: 300, x: 43, z: 53 },
  { id: "rare-02", kind: "RESOURCE", name: "Mạch Nguyệt Thạch", resource: "RARE_RESOURCE", level: 4, amount: 620, yieldPerMinute: 8, requiredPower: 420, x: -39, z: 62 },
];

export const ROGUE_CAMPS: Extract<WorldMapObject, { kind: "ROGUE_CAMP" }>[] = [
  { id: "camp-01", kind: "ROGUE_CAMP", name: "Trại Goblin Bìa Rừng", monsterType: "Goblin", tier: "LEVEL_1", level: 1, troopCount: 24, combatPower: 90, reward: "Gỗ, đá và kinh nghiệm", x: 28, z: 34 },
  { id: "camp-02", kind: "ROGUE_CAMP", name: "Hang Sói Xám", monsterType: "Sói hoang", tier: "LEVEL_2", level: 2, troopCount: 48, combatPower: 180, reward: "Gỗ, đá và nguyên liệu", x: -31, z: -21 },
  { id: "camp-03", kind: "ROGUE_CAMP", name: "Pháo Đài Lưu Khấu", monsterType: "Lưu khấu", tier: "LEVEL_3", level: 3, troopCount: 90, combatPower: 330, reward: "Tài nguyên và vật phẩm nâng cấp", x: 79, z: 65 },
  { id: "camp-elite", kind: "ROGUE_CAMP", name: "Ổ Quái Tinh Anh", monsterType: "Quái tinh anh", tier: "ELITE", level: 5, troopCount: 140, combatPower: 520, reward: "Vật phẩm hiếm và nguyên liệu chế tạo", x: -82, z: 73 },
];

export const WORLD_MAP_OBJECTS = [...RESOURCE_NODES, ...ROGUE_CAMPS];

export function resourceKindLabel(kind: ResourceNodeKind) {
  switch (kind) {
    case "FOREST": return "Gỗ";
    case "IRON_MINE": return "Quặng sắt";
    case "STONE_DEPOSIT": return "Đá";
    case "FOOD_LAND": return "Lương thực";
    case "RARE_RESOURCE": return "Tài nguyên hiếm";
  }
}
