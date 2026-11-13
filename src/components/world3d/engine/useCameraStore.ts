"use client";

import { create } from "zustand";

interface CameraStore {
  target: [number, number, number];
  viewMode: "world" | "city";
  focusOn: (position: [number, number, number]) => void;
  setViewMode: (mode: "world" | "city") => void;
}

export const useCameraStore = create<CameraStore>((set) => ({
  target: [0, 0, 0],
  viewMode: "world",
  focusOn: (position) => set({ target: position }),
  setViewMode: (mode) => set({ viewMode: mode }),
}));
