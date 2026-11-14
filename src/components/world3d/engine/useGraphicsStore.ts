"use client";

import { create } from "zustand";
import {
  type GraphicsQuality,
  type GraphicsConfig,
  GRAPHICS_PRESETS,
} from "./GraphicsSettings";

interface GraphicsStore {
  quality: GraphicsQuality;
  settings: GraphicsConfig;
  setQuality: (quality: GraphicsQuality) => void;
  /** Applies the persisted quality after hydration so SSR and client match. */
  hydrateQuality: () => void;
}

function loadSavedQuality(): GraphicsQuality {
  if (typeof window === "undefined") return "MEDIUM";
  try {
    const saved = localStorage.getItem("a2k-graphics");
    if (saved === "LOW" || saved === "MEDIUM" || saved === "HIGH") return saved;
  } catch {}
  return "MEDIUM";
}

export const useGraphicsStore = create<GraphicsStore>((set, get) => {
  return {
    // Always start from the default: reading localStorage during module init
    // makes the first client render differ from the server-rendered HTML.
    quality: "MEDIUM",
    settings: GRAPHICS_PRESETS.MEDIUM,
    setQuality: (quality) => {
      try {
        localStorage.setItem("a2k-graphics", quality);
      } catch {}
      set({ quality, settings: GRAPHICS_PRESETS[quality] });
    },
    hydrateQuality: () => {
      const saved = loadSavedQuality();
      if (saved === get().quality) return;
      set({ quality: saved, settings: GRAPHICS_PRESETS[saved] });
    },
  };
});
