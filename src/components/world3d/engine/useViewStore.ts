"use client";

import { create } from "zustand";
import { VIEW_RADIUS_METERS } from "@/lib/world-coordinates";

/**
 * Current world view radius, shared by the 3D systems.
 *
 * The base view is 44 km; a completed scout camp widens it (59/74/89 km). The
 * server derives the same number from the player's buildings, so the client
 * must use it for terrain coverage, base culling and the minimap range.
 */
interface ViewStore {
  viewRadiusMeters: number;
  setViewRadiusMeters: (radius: number) => void;
}

export const useViewStore = create<ViewStore>((set) => ({
  viewRadiusMeters: VIEW_RADIUS_METERS,
  setViewRadiusMeters: (radius) =>
    set((state) =>
      state.viewRadiusMeters === radius ? state : { viewRadiusMeters: radius },
    ),
}));
