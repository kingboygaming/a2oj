import { VIEW_RADIUS_METERS } from "./world-coordinates";

export const WORLD_BUILDING_TYPES = [
  "BARRACKS",
  "ARCHERY_RANGE",
  "STABLE",
  "SIEGE_WORKSHOP",
  "MILITARY_ACADEMY",
  "SCOUT_CAMP",
  "LUMBER_MILL",
  "IRON_MINE",
  "STONE_QUARRY",
  "FARM",
  "WAREHOUSE",
] as const;

export type WorldBuildingType = (typeof WORLD_BUILDING_TYPES)[number];

export interface WorldBuildingView {
  id: string;
  type: WorldBuildingType;
  plotIndex: number;
  level: number;
  pendingLevel: number | null;
  status: "CONSTRUCTING" | "UPGRADING" | "COMPLETED";
  startedAt: string;
  completedAt: string | null;
  completesAt: string;
}

export const WORLD_BUILDING_DEFINITIONS: Record<
  WorldBuildingType,
  {
    name: string;
    group: "Quân sự" | "Kinh tế";
    description: string;
    woodCost: number;
    stoneCost: number;
    constructionSeconds: number;
    requiredCastleLevel: number;
    /** Level cap for buildings that cannot reach the global maximum. */
    maxLevel?: number;
  }
> = {
  BARRACKS: { name: "Doanh trại", group: "Quân sự", description: "Huấn luyện bộ binh.", woodCost: 120, stoneCost: 60, constructionSeconds: 60, requiredCastleLevel: 1 },
  ARCHERY_RANGE: { name: "Trường cung", group: "Quân sự", description: "Huấn luyện cung thủ.", woodCost: 140, stoneCost: 70, constructionSeconds: 90, requiredCastleLevel: 2 },
  STABLE: { name: "Chuồng ngựa", group: "Quân sự", description: "Huấn luyện kỵ binh.", woodCost: 180, stoneCost: 100, constructionSeconds: 120, requiredCastleLevel: 3 },
  SIEGE_WORKSHOP: { name: "Công xưởng công thành", group: "Quân sự", description: "Mở khóa máy công thành.", woodCost: 260, stoneCost: 180, constructionSeconds: 180, requiredCastleLevel: 5 },
  MILITARY_ACADEMY: { name: "Học viện quân sự", group: "Quân sự", description: "Công trình quân sự nâng cao.", woodCost: 500, stoneCost: 400, constructionSeconds: 300, requiredCastleLevel: 10 },
  SCOUT_CAMP: { name: "Trại trinh sát", group: "Quân sự", description: "Mỗi cấp mở rộng tầm nhìn bản đồ thêm 15 km, tối đa 89 km.", woodCost: 180, stoneCost: 100, constructionSeconds: 90, requiredCastleLevel: 1, maxLevel: 3 },
  LUMBER_MILL: { name: "Xưởng gỗ", group: "Kinh tế", description: "Tăng năng lực khai thác gỗ.", woodCost: 100, stoneCost: 45, constructionSeconds: 60, requiredCastleLevel: 1 },
  IRON_MINE: { name: "Mỏ sắt", group: "Kinh tế", description: "Khai thác quặng sắt; sản lượng mỏ chưa được tích hợp.", woodCost: 150, stoneCost: 90, constructionSeconds: 90, requiredCastleLevel: 2 },
  STONE_QUARRY: { name: "Mỏ đá", group: "Kinh tế", description: "Tăng năng lực khai thác đá.", woodCost: 100, stoneCost: 60, constructionSeconds: 60, requiredCastleLevel: 1 },
  FARM: { name: "Nông trại", group: "Kinh tế", description: "Sản xuất 20 lương thực/giờ mỗi cấp, kể cả khi offline.", woodCost: 90, stoneCost: 35, constructionSeconds: 60, requiredCastleLevel: 1 },
  WAREHOUSE: { name: "Nhà kho", group: "Kinh tế", description: "Tăng sức chứa tài nguyên sau khi hoàn thành.", woodCost: 150, stoneCost: 100, constructionSeconds: 120, requiredCastleLevel: 2 },
};

export const WORLD_BUILDING_PLOT_COUNT = 12;
export const WORLD_TRAINING_BUILDINGS = {
  INFANTRY: "BARRACKS",
  ARCHERS: "ARCHERY_RANGE",
  CAVALRY: "STABLE",
} as const satisfies Record<"INFANTRY" | "ARCHERS" | "CAVALRY", WorldBuildingType>;

export function isWorldBuildingType(value: string): value is WorldBuildingType {
  return WORLD_BUILDING_TYPES.some((type) => type === value);
}

/** Level cap for a building type (falls back to the global 20 level cap). */
export function worldBuildingMaxLevel(type: WorldBuildingType): number {
  return WORLD_BUILDING_DEFINITIONS[type].maxLevel ?? 20;
}

export const SCOUT_CAMP_MAX_LEVEL = 3;
/** Extra world view radius unlocked by each scout camp level. */
export const SCOUT_CAMP_VIEW_STEP_METERS = 15_000;

/** Highest scout camp level in a base's building list (0 when not built). */
export function worldScoutCampLevel(
  buildings: ReadonlyArray<{ type: string; level: number }>,
): number {
  let level = 0;
  for (const building of buildings) {
    if (building.type === "SCOUT_CAMP" && building.level > level) {
      level = building.level;
    }
  }
  return Math.min(level, SCOUT_CAMP_MAX_LEVEL);
}

/**
 * World view radius in metres: the base 44 km plus 15 km per scout camp level
 * (59/74/89 km). Used by the server queries and by the client region
 * subscriptions so both sides agree on what is visible.
 */
export function worldViewRadiusMeters(scoutCampLevel: number): number {
  const level = Math.max(0, Math.min(Math.trunc(scoutCampLevel), SCOUT_CAMP_MAX_LEVEL));
  return VIEW_RADIUS_METERS + level * SCOUT_CAMP_VIEW_STEP_METERS;
}
