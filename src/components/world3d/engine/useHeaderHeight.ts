"use client";

import { useLayoutEffect } from "react";

/**
 * Publishes the real rendered height of the OJ header as the
 * `--site-header-height` CSS variable on <html>.
 *
 * The header is not a fixed 64px: it wraps on narrow screens, changes with
 * browser zoom and with the theme's font sizes. Measuring it keeps the game
 * viewport (`calc(100dvh - var(--site-header-height))`) flush with the header
 * without hardcoding a value.
 */
export function useHeaderHeight() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const header = document.querySelector<HTMLElement>(".site-header");

    const apply = () => {
      const height = header?.getBoundingClientRect().height ?? 0;
      if (height > 0) root.style.setProperty("--site-header-height", `${height}px`);
    };

    apply();

    if (!header) {
      return () => root.style.removeProperty("--site-header-height");
    }

    const observer = new ResizeObserver(apply);
    observer.observe(header);
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
      root.style.removeProperty("--site-header-height");
    };
  }, []);
}
