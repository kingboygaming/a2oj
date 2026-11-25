/**
 * A2 Kingdom — Fog of War / exploration math.
 *
 * Isomorphic and pure so the server can enforce reveals and the client can draw
 * the same grid. A "region" is a fixed 5 km cell in stored world metres; fog is
 * persisted per region, never per pixel and never per object.
 */

/** Edge length of one exploration cell, in stored world metres. */
export const EXPLORATION_REGION_METERS = 5_000;

/** Cells revealed around a brand-new base (2 cells = 25 km across). */
export const INITIAL_REVEAL_RADIUS_REGIONS = 2;

/** Extra reveal radius per completed Scout Camp level. */
export const SCOUT_REVEAL_RADIUS_PER_LEVEL = 1;

export const SCOUT_MISSION_WOOD_COST = 25;
export const SCOUT_MISSION_FOOD_COST = 15;
export const SCOUT_MISSION_MAX_TROOPS = 200;
export const SCOUT_MISSION_SPEED_METERS_PER_SECOND = 150;
export const SCOUT_MISSION_MIN_SECONDS = 8;
export const SCOUT_MISSION_MAX_SECONDS = 120;

export type RegionCoord = { regionX: number; regionZ: number };

export type RegionRow = {
  regionX: number;
  regionZ: number;
  revealedAt: Date | string;
  source?: string;
};

export function worldToRegion(x: number, z: number): RegionCoord {
  return {
    regionX: Math.floor(x / EXPLORATION_REGION_METERS),
    regionZ: Math.floor(z / EXPLORATION_REGION_METERS),
  };
}

export function regionCenter(regionX: number, regionZ: number): { x: number; z: number } {
  return {
    x: regionX * EXPLORATION_REGION_METERS + EXPLORATION_REGION_METERS / 2,
    z: regionZ * EXPLORATION_REGION_METERS + EXPLORATION_REGION_METERS / 2,
  };
}

export function regionKey(regionX: number, regionZ: number): string {
  return `${regionX},${regionZ}`;
}

export function parseRegionKey(key: string): RegionCoord | null {
  const [rawX, rawZ] = key.split(",");
  const regionX = Number(rawX);
  const regionZ = Number(rawZ);
  if (!Number.isInteger(regionX) || !Number.isInteger(regionZ)) return null;
  return { regionX, regionZ };
}

/** Distance in metres from a base to the centre of a region. */
export function regionDistanceMeters(
  baseX: number,
  baseZ: number,
  regionX: number,
  regionZ: number,
): number {
  const center = regionCenter(regionX, regionZ);
  return Math.hypot(center.x - baseX, center.z - baseZ);
}

/** Square block of regions around a centre. */
export function regionBlock(
  centerRegionX: number,
  centerRegionZ: number,
  radius: number,
): RegionCoord[] {
  const safeRadius = Math.max(0, Math.trunc(radius));
  const regions: RegionCoord[] = [];
  for (let dx = -safeRadius; dx <= safeRadius; dx += 1) {
    for (let dz = -safeRadius; dz <= safeRadius; dz += 1) {
      regions.push({
        regionX: centerRegionX + dx,
        regionZ: centerRegionZ + dz,
      });
    }
  }
  return regions;
}

export function initialRegionSet(baseX: number, baseZ: number): RegionCoord[] {
  const center = worldToRegion(baseX, baseZ);
  return regionBlock(center.regionX, center.regionZ, INITIAL_REVEAL_RADIUS_REGIONS);
}

export function scoutRevealRegionSet(
  targetRegionX: number,
  targetRegionZ: number,
  scoutCampLevel: number,
): RegionCoord[] {
  const level = Math.max(1, Math.min(3, Math.trunc(scoutCampLevel)));
  return regionBlock(targetRegionX, targetRegionZ, level);
}

/** Regions whose centre lies inside the view radius around a base. */
export function regionsWithinView(
  baseX: number,
  baseZ: number,
  viewRadiusMeters: number,
): RegionCoord[] {
  const radius = Math.max(0, viewRadiusMeters);
  const min = worldToRegion(baseX - radius, baseZ - radius);
  const max = worldToRegion(baseX + radius, baseZ + radius);
  const regions: RegionCoord[] = [];
  for (let regionX = min.regionX; regionX <= max.regionX; regionX += 1) {
    for (let regionZ = min.regionZ; regionZ <= max.regionZ; regionZ += 1) {
      if (regionDistanceMeters(baseX, baseZ, regionX, regionZ) <= radius) {
        regions.push({ regionX, regionZ });
      }
    }
  }
  return regions;
}

export function isRegionWithinView(
  baseX: number,
  baseZ: number,
  viewRadiusMeters: number,
  regionX: number,
  regionZ: number,
): boolean {
  return regionDistanceMeters(baseX, baseZ, regionX, regionZ) <= viewRadiusMeters;
}

/**
 * A region can only be scouted when it touches an already revealed cell
 * (8-neighbourhood), which prevents teleport-scouting the far side of the map.
 */
export function isRegionOnFrontier(
  regionX: number,
  regionZ: number,
  revealed: ReadonlySet<string>,
): boolean {
  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dz = -1; dz <= 1; dz += 1) {
      if (dx === 0 && dz === 0) continue;
      if (revealed.has(regionKey(regionX + dx, regionZ + dz))) return true;
    }
  }
  return false;
}

export type ExplorationProgress = {
  /** Revealed cells that are inside the current view radius. */
  revealedInView: number;
  /** Total cells inside the current view radius. */
  totalInView: number;
  /** 0–100, rounded. */
  percent: number;
  /** Every revealed cell (used for filtering and rendering). */
  revealedKeys: Set<string>;
};

export function explorationProgress(
  baseX: number,
  baseZ: number,
  viewRadiusMeters: number,
  revealed: ReadonlyArray<RegionCoord>,
): ExplorationProgress {
  const inView = regionsWithinView(baseX, baseZ, viewRadiusMeters);
  const revealedKeys = new Set(revealed.map((region) => regionKey(region.regionX, region.regionZ)));
  let revealedInView = 0;
  for (const region of inView) {
    if (revealedKeys.has(regionKey(region.regionX, region.regionZ))) revealedInView += 1;
  }
  const totalInView = inView.length;
  return {
    revealedInView,
    totalInView,
    percent: totalInView === 0 ? 0 : Math.min(100, Math.round((revealedInView / totalInView) * 100)),
    revealedKeys,
  };
}

/** First-discovery reward for a cell; richer further from home. */
export function regionDiscoveryReward(
  baseX: number,
  baseZ: number,
  regionX: number,
  regionZ: number,
): { wood: number; stone: number; food: number; iron: number } {
  const ring = Math.floor(
    regionDistanceMeters(baseX, baseZ, regionX, regionZ) / EXPLORATION_REGION_METERS,
  );
  const safeRing = Math.max(0, Math.min(24, ring));
  return {
    wood: 6 + safeRing * 2,
    stone: 3 + safeRing,
    food: 4 + safeRing,
    iron: safeRing >= 8 ? Math.floor(safeRing / 8) : 0,
  };
}

export function scoutMissionDurationSeconds(distanceMeters: number): number {
  const seconds = Math.ceil(
    Math.max(0, distanceMeters) / SCOUT_MISSION_SPEED_METERS_PER_SECOND,
  );
  return Math.max(SCOUT_MISSION_MIN_SECONDS, Math.min(SCOUT_MISSION_MAX_SECONDS, seconds));
}

export function explorationStatusLabel(status: string): string {
  switch (status) {
    case "IN_TRANSIT": return "Đang hành quân";
    case "SCOUTING": return "Đang trinh sát";
    case "RETURNING": return "Đang trở về";
    case "COMPLETED": return "Hoàn tất";
    case "FAILED": return "Thất bại";
    case "RESOLVING": return "Đang xử lý";
    default: return status;
  }
}
