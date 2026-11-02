export type BgType = "default" | "solid" | "gradient" | "image" | "matrix" | "grid";

export interface BgConfig {
  type: BgType;
  // solid / gradient
  color?: string;   // e.g. "#0f172a"
  gradient?: string; // e.g. "linear-gradient(135deg, #0f172a 0%, #1e0a3c 100%)"
  // image
  imageUrl?: string;
  imageOpacity?: number; // 0-1
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

const LS_KEY = "a2oj:bg";
const BG_CHANGE_EVENT = "a2oj-bg-change";
const DEFAULT_BG_CONFIG: BgConfig = { type: "default" };
let cachedBgConfig: BgConfig | undefined;

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
      return config as BgConfig;
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
    window.localStorage.setItem(LS_KEY, JSON.stringify(config));
  } catch {
    throw new Error("Không thể lưu giao diện vào trình duyệt. Hãy thử ảnh nhỏ hơn hoặc xóa bớt dữ liệu trang web.");
  }
  cachedBgConfig = config;
  window.dispatchEvent(new Event(BG_CHANGE_EVENT));
}

export function subscribeToBgConfig(callback: () => void) {
  function onStorageChange(event: StorageEvent) {
    if (event.key !== LS_KEY && event.key !== null) return;
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

export function getServerBgConfigSnapshot() {
  return DEFAULT_BG_CONFIG;
}
