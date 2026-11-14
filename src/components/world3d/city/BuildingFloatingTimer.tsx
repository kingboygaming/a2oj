"use client";

import { useEffect, useState } from "react";
import { Html } from "@react-three/drei";

interface BuildingFloatingTimerProps {
  /** Target completion timestamp in milliseconds */
  completesAtMs: number;
  /** Optional start timestamp in milliseconds (for progress calculation) */
  startedAtMs?: number;
  /** Optional 3D position vector; if omitted, defaults to [0, heightOffset, 0] */
  position?: [number, number, number];
  /** Height offset above the building model (default 5.5 units) */
  heightOffset?: number;
  /** Activity icon, e.g. "⏳", "🔨", "🔭", "🩹" */
  icon?: string;
  /** Activity title, e.g. "Xây dựng", "Huấn luyện", "Do thám", "Điều trị" */
  label?: string;
  /** Sub-label or troop count e.g. "+20 Bộ binh" */
  detail?: string;
  /** Callback triggered when countdown reaches 0 */
  onComplete?: () => void;
}

function formatCountdown(remSec: number): string {
  if (remSec <= 0) return "Hoàn thành";
  const hours = Math.floor(remSec / 3600);
  const minutes = Math.floor((remSec % 3600) / 60);
  const seconds = remSec % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Isolated floating billboard timer attached above 3D buildings.
 * Updates DOM internally via setInterval without causing Three.js scene re-renders.
 */
export function BuildingFloatingTimer({
  completesAtMs,
  startedAtMs,
  position,
  heightOffset = 5.5,
  icon = "⏳",
  label,
  detail,
  onComplete,
}: BuildingFloatingTimerProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setNowMs(now);
      if (now >= completesAtMs && onComplete) {
        onComplete();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [completesAtMs, onComplete]);

  const remSec = Math.max(0, Math.ceil((completesAtMs - nowMs) / 1000));
  if (remSec <= 0 && completesAtMs < nowMs - 5000) {
    // Hide if already completed more than 5s ago
    return null;
  }

  let progressPercent: number | null = null;
  if (startedAtMs && completesAtMs > startedAtMs) {
    const totalDuration = completesAtMs - startedAtMs;
    const elapsed = Math.max(0, nowMs - startedAtMs);
    progressPercent = Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 100)));
  }

  const isCompleted = remSec <= 0;

  return (
    <Html
      center
      position={position ?? [0, heightOffset, 0]}
      distanceFactor={26}
      zIndexRange={[100, 0]}
      style={{ pointerEvents: "none", userSelect: "none" }}
    >
      <div className="flex flex-col items-center">
        {/* Medieval styled timer badge */}
        <div className="flex flex-col items-center rounded-xl border border-amber-400/50 bg-[#14120e]/90 px-2.5 py-1.5 shadow-2xl shadow-black/80 backdrop-blur-md text-amber-50 min-w-[90px]">
          {/* Header row */}
          <div className="flex items-center gap-1.5 text-[11px] font-bold">
            <span className={isCompleted ? "" : "animate-pulse"}>{icon}</span>
            {label && <span className="text-amber-200/90 text-[10px]">{label}</span>}
            <span
              className={`font-mono text-xs font-black ${
                isCompleted ? "text-emerald-300" : "text-amber-300"
              }`}
            >
              {formatCountdown(remSec)}
            </span>
          </div>

          {/* Optional detail */}
          {detail && (
            <p className="text-[9px] text-white/60 font-medium leading-none mt-0.5">
              {detail}
            </p>
          )}

          {/* Progress bar */}
          {progressPercent !== null && !isCompleted && (
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-black/60 border border-white/10">
              <div
                className="h-full bg-gradient-to-r from-amber-500 via-yellow-400 to-emerald-400 transition-all duration-300 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          )}
        </div>

        {/* Pointer caret pointing down to the building roof */}
        <div className="w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-amber-400/50 -mt-[1px]" />
      </div>
    </Html>
  );
}
