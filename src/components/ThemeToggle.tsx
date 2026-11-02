"use client";

import { useState, useSyncExternalStore } from "react";
import {
  getBgConfigSnapshot,
  getServerBgConfigSnapshot,
  getThemeMode,
  setThemeMode,
  subscribeToBgConfig,
  type ThemeMode,
} from "@/lib/background-theme";

const NEXT_THEME: Record<ThemeMode, ThemeMode> = {
  light: "dark",
  dark: "lgbt",
  lgbt: "light",
};

const THEME_LABEL: Record<ThemeMode, string> = {
  light: "Light",
  dark: "Dark",
  lgbt: "LGBT",
};

export function ThemeToggle() {
  const config = useSyncExternalStore(
    subscribeToBgConfig,
    getBgConfigSnapshot,
    getServerBgConfigSnapshot,
  );
  const themeMode = getThemeMode(config);
  const [saveError, setSaveError] = useState("");

  function cycleTheme() {
    try {
      setThemeMode(NEXT_THEME[themeMode]);
      setSaveError("");
    } catch (cause) {
      setSaveError(
        cause instanceof Error ? cause.message : "Không thể lưu giao diện.",
      );
    }
  }

  return (
    <button
      type="button"
      onClick={cycleTheme}
      aria-label={`Giao diện ${THEME_LABEL[themeMode]}. Chuyển sang ${THEME_LABEL[NEXT_THEME[themeMode]]}`}
      title={
        saveError ||
        `Giao diện ${THEME_LABEL[themeMode]} · chuyển sang ${THEME_LABEL[NEXT_THEME[themeMode]]}`
      }
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-white/15 text-[var(--cream)] transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--teal)]"
    >
      {themeMode === "lgbt" ? (
        <span aria-hidden="true" className="text-base leading-none">🌈</span>
      ) : themeMode === "dark" ? (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-4">
          <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.7" />
          <path
            d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.7"
          />
        </svg>
      ) : (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-4">
          <path
            d="M20.2 15.4A8.4 8.4 0 0 1 8.6 3.8 8.5 8.5 0 1 0 20.2 15.4Z"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.7"
          />
        </svg>
      )}
    </button>
  );
}
