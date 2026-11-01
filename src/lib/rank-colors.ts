export const RANK_NAME_COLORS: Record<string, string> = {
  Newbie: "text-slate-600 dark:text-slate-300",
  Pupil: "text-emerald-700 dark:text-emerald-300",
  Specialist: "text-cyan-700 dark:text-cyan-300",
  Expert: "text-blue-700 dark:text-blue-300",
  "Candidate Master": "text-violet-700 dark:text-violet-300",
  Master: "text-orange-700 dark:text-orange-300",
  Grandmaster: "text-rose-700 dark:text-rose-300",
  Legend: "text-red-700 dark:text-red-300",
  Admin: "text-amber-700 dark:text-amber-300",
};

export const ACHIEVEMENT_COLOR_CLASSES: Record<string, string> = {
  AMBER: "text-amber-700 dark:text-amber-300",
  EMERALD: "text-emerald-700 dark:text-emerald-300",
  CYAN: "text-cyan-700 dark:text-cyan-300",
  SKY: "text-sky-700 dark:text-sky-300",
  BLUE: "text-blue-700 dark:text-blue-300",
  VIOLET: "text-violet-700 dark:text-violet-300",
  FUCHSIA: "text-fuchsia-700 dark:text-fuchsia-300",
  ROSE: "text-rose-700 dark:text-rose-300",
  RED: "text-red-700 dark:text-red-300",
};

export const ACHIEVEMENT_RARITIES = ["COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY", "SECRET"] as const;
export const ACHIEVEMENT_TRIGGERS = ["SOLVED_PROBLEMS", "CONTESTS", "CONTEST_PODIUMS", "CONTEST_WINS", "RANK_POINTS", "PROBLEM_AC", "HEURISTIC_SCORE", "WRONG_ANSWERS", "CE_STREAK"] as const;
