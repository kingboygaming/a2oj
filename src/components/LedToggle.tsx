"use client";

import { useState, useSyncExternalStore } from "react";
import {
  getBgConfigSnapshot,
  getLedEnabled,
  getServerBgConfigSnapshot,
  setLedEnabled,
  subscribeToBgConfig,
} from "@/lib/background-theme";

export function LedToggle() {
  const config = useSyncExternalStore(
    subscribeToBgConfig,
    getBgConfigSnapshot,
    getServerBgConfigSnapshot,
  );
  const enabled = getLedEnabled(config);
  const [saveError, setSaveError] = useState("");

  function toggleLed() {
    try {
      setLedEnabled(!enabled);
      setSaveError("");
    } catch (cause) {
      setSaveError(
        cause instanceof Error ? cause.message : "Không thể lưu cài đặt LED RGB.",
      );
    }
  }

  return (
    <button
      type="button"
      onClick={toggleLed}
      aria-pressed={enabled}
      aria-label={`LED RGB đang ${enabled ? "bật" : "tắt"}. ${enabled ? "Tắt" : "Bật"} LED RGB`}
      title={saveError || `${enabled ? "Tắt" : "Bật"} LED RGB`}
      className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border px-2 text-xs font-semibold transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--teal)] ${
        enabled
          ? "border-fuchsia-300/40 text-fuchsia-200"
          : "border-white/15 text-[var(--cream)]/60"
      }`}
    >
      <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="size-4">
        <path
          d="M10 2.5v3m0 9v3m7.5-7.5h-3m-9 0h-3m12.3-5.3-2.1 2.1m-6.4 6.4-2.1 2.1m10.6 0-2.1-2.1m-6.4-6.4L4.2 4.4"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.5"
        />
        <circle cx="10" cy="10" r="3.1" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <span>RGB</span>
    </button>
  );
}
