import { VIEW_RADIUS_METERS } from "./world-coordinates";

export const WORLD_BUILDING_TYPES = [
  "BARRACKS",
  "ARCHERY_RANGE",
  "STABLE",
  "SIEGE_WORKSHOP",
  "MILITARY_ACADEMY",
  "HOSPITAL",
  "SCOUT_CAMP",
  "WATCHTOWER",
  "GATEHOUSE",
  "LUMBER_MILL",
  "IRON_MINE",
  "STONE_QUARRY",
  "FARM",
  "WAREHOUSE",
] as const;

export type WorldBuildingType = (typeof WORLD_BUILDING_TYPES)[number];

export type WorldBuildingGroup = "Quân sự" | "Kinh tế" | "Phòng thủ";

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
    group: WorldBuildingGroup;
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
  HOSPITAL: { name: "Quân y viện", group: "Quân sự", description: "Tiếp nhận và cứu chữa thương binh. Mỗi cấp tăng 150 sức chứa.", woodCost: 160, stoneCost: 90, constructionSeconds: 90, requiredCastleLevel: 2 },
  SCOUT_CAMP: { name: "Trại trinh sát", group: "Quân sự", description: "Mỗi cấp mở rộng tầm nhìn bản đồ thêm 15 km, tối đa 89 km.", woodCost: 180, stoneCost: 100, constructionSeconds: 90, requiredCastleLevel: 1, maxLevel: 3 },
  WATCHTOWER: { name: "Tháp canh", group: "Phòng thủ", description: "Chỉ đặt trên 4 tháp tường thành; tăng phòng thủ và tầm quan sát mỗi cấp.", woodCost: 170, stoneCost: 120, constructionSeconds: 100, requiredCastleLevel: 2, maxLevel: 10 },
  GATEHOUSE: { name: "Cổng thành", group: "Phòng thủ", description: "Chỉ đặt tại cổng chính; giảm tỉ lệ tài nguyên bị cướp khi bị tấn công.", woodCost: 200, stoneCost: 160, constructionSeconds: 120, requiredCastleLevel: 3, maxLevel: 10 },
  LUMBER_MILL: { name: "Xưởng gỗ", group: "Kinh tế", description: "Sản xuất 30 gỗ/giờ mỗi cấp, kể cả khi offline.", woodCost: 100, stoneCost: 45, constructionSeconds: 60, requiredCastleLevel: 1 },
  IRON_MINE: { name: "Mỏ sắt", group: "Kinh tế", description: "Khai thác quặng sắt; sản lượng mỏ chưa được tích hợp.", woodCost: 150, stoneCost: 90, constructionSeconds: 90, requiredCastleLevel: 2 },
  STONE_QUARRY: { name: "Mỏ đá", group: "Kinh tế", description: "Sản xuất 12 đá/giờ mỗi cấp, kể cả khi offline.", woodCost: 100, stoneCost: 60, constructionSeconds: 60, requiredCastleLevel: 1 },
  FARM: { name: "Nông trại", group: "Kinh tế", description: "Sản xuất 20 lương thực/giờ mỗi cấp, kể cả khi offline.", woodCost: 90, stoneCost: 35, constructionSeconds: 60, requiredCastleLevel: 1 },
  WAREHOUSE: { name: "Nhà kho", group: "Kinh tế", description: "Tăng sức chứa tài nguyên sau khi hoàn thành.", woodCost: 150, stoneCost: 100, constructionSeconds: 120, requiredCastleLevel: 2 },
};

/** Legacy inner plots kept for backward compatibility. */
export const WORLD_BUILDING_PLOT_COUNT = 12;

/**
 * Technical safety cap for plot indices. Gameplay has no practical slot limit;
 * this only prevents absurd indexes from reaching the database / 3D renderer.
 */
export const WORLD_PLOT_LIMIT = 10_000;

/** Fixed wall positions: these are not regular city-grid cells. */
export const WORLD_GATEHOUSE_PLOT_INDEX = 9_000;
export const WORLD_WATCHTOWER_PLOT_INDEXES = [9_001, 9_002, 9_003, 9_004] as const;
export const WORLD_FORTIFICATION_PLOT_INDEXES: ReadonlySet<number> = new Set([
  WORLD_GATEHOUSE_PLOT_INDEX,
  ...WORLD_WATCHTOWER_PLOT_INDEXES,
]);

export function isFortificationBuildingType(type: WorldBuildingType): boolean {
  return type === "GATEHOUSE" || type === "WATCHTOWER";
}

/** Reserved index for a fortification building, or null for normal buildings. */
export function fortificationPlotIndex(
  type: WorldBuildingType,
  towerIndex = 0,
): number | null {
  if (type === "GATEHOUSE") return WORLD_GATEHOUSE_PLOT_INDEX;
  if (type === "WATCHTOWER") {
    return WORLD_WATCHTOWER_PLOT_INDEXES[
      Math.max(0, Math.min(WORLD_WATCHTOWER_PLOT_INDEXES.length - 1, Math.trunc(towerIndex)))
    ];
  }
  return null;
}

const INNER_PLOTS: ReadonlyArray<readonly [number, number]> = [
  [-12, -12], [-5, -12], [5, -12], [12, -12],
  [-12, -5], [12, -5],
  [-12, 5], [12, 5],
  [-12, 12], [-5, 12], [5, 12], [12, 12],
];

/** Render-space position of a plot. Beyond the inner 12, plots spiral outward. */
export function worldPlotPosition(index: number): [number, number] {
  if (!Number.isInteger(index) || index < 0) return INNER_PLOTS[0] as [number, number];
  if (index < INNER_PLOTS.length) return [...INNER_PLOTS[index]] as [number, number];

  const step = 7;
  let remaining = index - INNER_PLOTS.length;
  let ring = 4; // first ring sits just outside the castle wall (radius 23)
  while (true) {
    const perRing = 8 * ring;
    if (remaining < perRing) {
      const radius = ring * step;
      const side = Math.floor(remaining / (2 * ring));
      const offset = remaining % (2 * ring);
      if (side === 0) return [-radius + offset * step, -radius];
      if (side === 1) return [radius, -radius + offset * step];
      if (side === 2) return [radius - offset * step, radius];
      return [-radius, radius - offset * step];
    }
    remaining -= perRing;
    ring += 1;
  }
}

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

export const HOSPITAL_CAPACITY_PER_LEVEL = 150;

/** Highest hospital level in a base's building list (0 when not built). */
export function worldHospitalLevel(
  buildings: ReadonlyArray<{ type: string; level: number }>,
): number {
  let level = 0;
  for (const building of buildings) {
    if (building.type === "HOSPITAL" && building.level > level) {
      level = building.level;
    }
  }
  return level;
}

export function worldHospitalCapacity(hospitalLevel: number, fieldMedicineLevel = 0): number {
  if (hospitalLevel <= 0) return 0;
  return hospitalLevel * HOSPITAL_CAPACITY_PER_LEVEL + Math.max(0, fieldMedicineLevel) * 50;
}

