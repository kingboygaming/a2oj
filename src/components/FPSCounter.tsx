"use client";

/**
 * FPS counter using @react-three/fiber's useFrame.
 * Displays real-time frame rate in the 3D scene overlay.
 * Lightweight — only renders a 2D overlay div outside the Canvas.
 */

import { useRef, useEffect, useState } from "react";

export function FPSCounter() {
  const [fps, setFps] = useState(0);
  const frameCount = useRef(0);

  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();
    frameCount.current = 0;

    function tick() {
      frameCount.current += 1;
      const now = performance.now();
      const elapsed = now - lastTime;
      if (elapsed >= 1000) {
        setFps(Math.round((frameCount.current * 1000) / elapsed));
        frameCount.current = 0;
        lastTime = now;
      }
      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const color =
    fps >= 50 ? "text-emerald-400" : fps >= 30 ? "text-amber-400" : "text-rose-400";

  return (
    <span className={`font-mono text-[10px] font-bold ${color}`}>
      {fps} FPS
    </span>
  );
}
