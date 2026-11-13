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
}

function loadSavedQuality(): GraphicsQuality {
  if (typeof window === "undefined") return "MEDIUM";
  try {
    const saved = localStorage.getItem("a2k-graphics");
    if (saved === "LOW" || saved === "MEDIUM" || saved === "HIGH") return saved;
  } catch {}
  return "MEDIUM";
}

export const useGraphicsStore = create<GraphicsStore>((set) => {
  const initial = loadSavedQuality();
  return {
    quality: initial,
    settings: GRAPHICS_PRESETS[initial],
    setQuality: (quality) => {
      try {
        localStorage.setItem("a2k-graphics", quality);
      } catch {}
      set({ quality, settings: GRAPHICS_PRESETS[quality] });
    },
  };
});
