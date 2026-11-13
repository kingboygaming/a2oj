/* ── Day/Night cycle timing ── */

export interface DayPhase {
  name: "dawn" | "day" | "dusk" | "night";
  sunIntensity: number;
  ambientIntensity: number;
  sunColor: [number, number, number];
  ambientColor: [number, number, number];
  fogColor: [number, number, number];
  sunAngle: number; // radians around X axis
}

const PHASES: Record<DayPhase["name"], DayPhase> = {
  dawn: {
    name: "dawn",
    sunIntensity: 0.6,
    ambientIntensity: 0.35,
    sunColor: [1.0, 0.75, 0.5],
    ambientColor: [0.6, 0.5, 0.55],
    fogColor: [0.85, 0.72, 0.6],
    sunAngle: -0.1,
  },
  day: {
    name: "day",
    sunIntensity: 1.2,
    ambientIntensity: 0.5,
    sunColor: [1.0, 0.95, 0.85],
    ambientColor: [0.6, 0.65, 0.75],
    fogColor: [0.75, 0.82, 0.9],
    sunAngle: -0.8,
  },
  dusk: {
    name: "dusk",
    sunIntensity: 0.5,
    ambientIntensity: 0.3,
    sunColor: [1.0, 0.55, 0.3],
    ambientColor: [0.5, 0.35, 0.4],
    fogColor: [0.8, 0.55, 0.4],
    sunAngle: -0.15,
  },
  night: {
    name: "night",
    sunIntensity: 0.08,
    ambientIntensity: 0.15,
    sunColor: [0.3, 0.35, 0.6],
    ambientColor: [0.15, 0.15, 0.3],
    fogColor: [0.1, 0.1, 0.2],
    sunAngle: 0.5,
  },
};

/**
 * Get the current phase based on real-world UTC hour.
 * 6-8 dawn, 8-17 day, 17-19 dusk, 19-6 night
 */
export function getCurrentPhase(): DayPhase {
  const hour = new Date().getUTCHours();

  if (hour >= 6 && hour < 8) return PHASES.dawn;
  if (hour >= 8 && hour < 17) return PHASES.day;
  if (hour >= 17 && hour < 19) return PHASES.dusk;
  return PHASES.night;
}

/**
 * Interpolate between two phases based on fractional progress.
 */
export function lerpPhase(a: DayPhase, b: DayPhase, t: number): DayPhase {
  const l = (x: number, y: number) => x + (y - x) * t;
  const lc = (c1: [number, number, number], c2: [number, number, number]): [number, number, number] =>
    [l(c1[0], c2[0]), l(c1[1], c2[1]), l(c1[2], c2[2])];

  return {
    name: t < 0.5 ? a.name : b.name,
    sunIntensity: l(a.sunIntensity, b.sunIntensity),
    ambientIntensity: l(a.ambientIntensity, b.ambientIntensity),
    sunColor: lc(a.sunColor, b.sunColor),
    ambientColor: lc(a.ambientColor, b.ambientColor),
    fogColor: lc(a.fogColor, b.fogColor),
    sunAngle: l(a.sunAngle, b.sunAngle),
  };
}

export { PHASES };
