export type BgType = "default" | "solid" | "gradient" | "image" | "matrix" | "grid";
export const THEME_MODES = ["light", "dark", "lgbt"] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

export interface BgConfig {
  type: BgType;
  themeMode?: ThemeMode;
  ledEnabled?: boolean;
  // solid / gradient
  color?: string;   // e.g. "#0f172a"
  gradient?: string; // e.g. "linear-gradient(135deg, #0f172a 0%, #1e0a3c 100%)"
  // image
  imageUrl?: string;
  imageOpacity?: number; // 0-1
  headerTransparency?: number; // 0-40
  // preset name
  preset?: string;
}

export const BG_PRESETS: { name: string; label: string; config: BgConfig }[] = [
  { name: "default", label: "Mặc định", config: { type: "default" } },
  { name: "midnight", label: "🌃 Midnight Blue", config: { type: "gradient", gradient: "linear-gradient(135deg, #0f172a 0%, #0c1445 50%, #0f172a 100%)" } },
  { name: "cyberpunk", label: "⚡ Cyberpunk", config: { type: "gradient", gradient: "linear-gradient(135deg, #0d0221 0%, #1a0533 40%, #0d1033 100%)" } },
  { name: "neon", label: "🟢 Neon Forest", config: { type: "gradient", gradient: "linear-gradient(135deg, #000d0d 0%, #001a1a 50%, #000f0d 100%)" } },
  { name: "sunset", label: "🌅 Dusk Hacker", config: { type: "gradient", gradient: "linear-gradient(135deg, #1a0505 0%, #1a0d1a 50%, #0d0a1a 100%)" } },
  { name: "matrix", label: "🟩 Matrix Rain", config: { type: "matrix" } },
  { name: "grid", label: "⬜ Space Grid", config: { type: "grid" } },
];

export function getHeaderTransparency(config: BgConfig) {
  const transparency = config.headerTransparency;
  if (typeof transparency !== "number" || !Number.isFinite(transparency)) {
    return 12;
  }
  return Math.min(40, Math.max(0, Math.round(transparency)));
}

const LS_KEY = "a2oj:bg";
const LEGACY_THEME_KEY = "tinoj-theme";
const BG_CHANGE_EVENT = "a2oj-bg-change";
const DEFAULT_BG_CONFIG: BgConfig = { type: "default", ledEnabled: true };
let cachedBgConfig: BgConfig | undefined;

function getLegacyThemeMode(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  try {
    return window.localStorage.getItem(LEGACY_THEME_KEY) === "light"
      ? "light"
      : "dark";
  } catch {
    return "dark";
  }
}

function parseBgConfig(raw: string | null): BgConfig {
  if (!raw) return DEFAULT_BG_CONFIG;
  try {
    const config: unknown = JSON.parse(raw);
    if (
      typeof config === "object" &&
      config !== null &&
      "type" in config &&
      ["default", "solid", "gradient", "image", "matrix", "grid"].includes(
        String(config.type),
      )
    ) {
      const saved = config as BgConfig;
      return {
        ...saved,
        ledEnabled: saved.ledEnabled !== false,
        themeMode: THEME_MODES.includes(saved.themeMode as ThemeMode)
          ? saved.themeMode
          : getLegacyThemeMode(),
      };
    }
  } catch {
    return DEFAULT_BG_CONFIG;
  }
  return DEFAULT_BG_CONFIG;
}

export function loadBgConfig(): BgConfig {
  if (typeof window === "undefined") return DEFAULT_BG_CONFIG;
  try {
    cachedBgConfig = parseBgConfig(window.localStorage.getItem(LS_KEY));
  } catch {
    cachedBgConfig = DEFAULT_BG_CONFIG;
  }
  return cachedBgConfig;
}

export function saveBgConfig(config: BgConfig): void {
  if (typeof window === "undefined") {
    throw new Error("Không thể lưu giao diện ở môi trường hiện tại.");
  }
  try {
    window.localStorage.setItem(
      LS_KEY,
      JSON.stringify({
        ...config,
        ledEnabled: config.ledEnabled !== false,
        themeMode: getThemeMode(config),
      }),
    );
    window.localStorage.setItem(LEGACY_THEME_KEY, getThemeMode(config));
  } catch {
    throw new Error("Không thể lưu giao diện vào trình duyệt. Hãy thử ảnh nhỏ hơn hoặc xóa bớt dữ liệu trang web.");
  }
  cachedBgConfig = {
    ...config,
    ledEnabled: config.ledEnabled !== false,
    themeMode: getThemeMode(config),
  };
  window.dispatchEvent(new Event(BG_CHANGE_EVENT));
}

export function subscribeToBgConfig(callback: () => void) {
  function onStorageChange(event: StorageEvent) {
    if (
      event.key !== LS_KEY &&
      event.key !== LEGACY_THEME_KEY &&
      event.key !== null
    ) return;
    loadBgConfig();
    window.dispatchEvent(new Event(BG_CHANGE_EVENT));
  }

  window.addEventListener(BG_CHANGE_EVENT, callback);
  window.addEventListener("storage", onStorageChange);
  return () => {
    window.removeEventListener(BG_CHANGE_EVENT, callback);
    window.removeEventListener("storage", onStorageChange);
  };
}

export function getBgConfigSnapshot() {
  return cachedBgConfig ?? loadBgConfig();
}

export function getThemeMode(config: BgConfig): ThemeMode {
  return THEME_MODES.includes(config.themeMode as ThemeMode)
    ? config.themeMode!
    : getLegacyThemeMode();
}

export function getLedEnabled(config: BgConfig) {
  return config.ledEnabled !== false;
}

export function setThemeMode(themeMode: ThemeMode) {
  saveBgConfig({ ...getBgConfigSnapshot(), themeMode });
}

export function setLedEnabled(ledEnabled: boolean) {
  saveBgConfig({ ...getBgConfigSnapshot(), ledEnabled });
}

export function getServerBgConfigSnapshot() {
  return DEFAULT_BG_CONFIG;
}
