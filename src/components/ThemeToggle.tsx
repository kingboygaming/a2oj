"use client";

import { useEffect, useSyncExternalStore } from "react";

const THEME_CHANGE_EVENT = "tinoj-theme-change";

function subscribeToThemeChanges(callback: () => void) {
  window.addEventListener(THEME_CHANGE_EVENT, callback);
  return () => window.removeEventListener(THEME_CHANGE_EVENT, callback);
}

function getThemeSnapshot() {
  return document.documentElement.dataset.theme !== "light";
}

function getServerThemeSnapshot() {
  return true;
}

export function ThemeToggle() {
  const isDark = useSyncExternalStore(
    subscribeToThemeChanges,
    getThemeSnapshot,
    getServerThemeSnapshot,
  );

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("tinoj-theme");
    const dark = savedTheme !== "light";
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }, []);

  function toggleTheme() {
    const dark = !isDark;
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    window.localStorage.setItem("tinoj-theme", dark ? "dark" : "light");
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Chuyển sang giao diện ${isDark ? "sáng" : "tối"}`}
      title={`Chuyển sang giao diện ${isDark ? "sáng" : "tối"}`}
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-white/15 text-[var(--cream)] transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--teal)]"
    >
      {isDark ? (
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
