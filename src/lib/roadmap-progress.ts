export const roadmapProgressStorageKey = "cp-roadmap-progress-v1";

export type RoadmapTrackId = "basic" | "intermediate" | "advanced";
export type RoadmapProgress = Record<RoadmapTrackId, string[]>;

export const emptyRoadmapProgress: RoadmapProgress = {
  basic: [],
  intermediate: [],
  advanced: [],
};

export function getRoadmapTrack(level: string): RoadmapTrackId {
  const normalizedLevel = level.trim().toLocaleLowerCase("vi");
  if (normalizedLevel.includes("nâng cao") || normalizedLevel.includes("advanced")) return "advanced";
  if (normalizedLevel.includes("trung cấp") || normalizedLevel.includes("intermediate")) return "intermediate";
  return "basic";
}

export function parseRoadmapProgress(value: string | null): RoadmapProgress | null {
  if (!value) return null;
  try {
    const savedProgress: unknown = JSON.parse(value);
    if (!savedProgress || typeof savedProgress !== "object") return null;
    const progress = savedProgress as Record<string, unknown>;
    return {
      basic: Array.isArray(progress.basic) ? progress.basic.filter((id): id is string => typeof id === "string") : [],
      intermediate: Array.isArray(progress.intermediate) ? progress.intermediate.filter((id): id is string => typeof id === "string") : [],
      advanced: Array.isArray(progress.advanced) ? progress.advanced.filter((id): id is string => typeof id === "string") : [],
    };
  } catch {
    return null;
  }
}
