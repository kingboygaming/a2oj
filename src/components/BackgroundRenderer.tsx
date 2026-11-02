"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import {
  getBgConfigSnapshot,
  getHeaderTransparency,
  getServerBgConfigSnapshot,
  getThemeMode,
  subscribeToBgConfig,
} from "@/lib/background-theme";

function startMatrixAnimation(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
) {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const fontSize = 14;
  const drops = Array(Math.floor(canvas.width / fontSize)).fill(1) as number[];
  const chars = "01";
  let frameId = 0;
  let stopped = false;

  function draw() {
    if (stopped) return;
    context.fillStyle = "rgba(0,0,0,0.05)";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "rgba(0,255,70,0.55)";
    context.font = `${fontSize}px monospace`;

    for (let i = 0; i < drops.length; i++) {
      context.fillText(
        chars[Math.floor(Math.random() * chars.length)],
        i * fontSize,
        drops[i] * fontSize,
      );
      if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
        drops[i] = 0;
      }
      drops[i]++;
    }
    frameId = requestAnimationFrame(draw);
  }

  function onResize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  frameId = requestAnimationFrame(draw);
  window.addEventListener("resize", onResize);
  return () => {
    stopped = true;
    window.removeEventListener("resize", onResize);
    cancelAnimationFrame(frameId);
  };
}

export function BackgroundRenderer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const config = useSyncExternalStore(
    subscribeToBgConfig,
    getBgConfigSnapshot,
    getServerBgConfigSnapshot,
  );

  useEffect(() => {
    document.documentElement.dataset.theme = getThemeMode(config);
    document.body.style.background =
      config.type === "gradient" || config.type === "solid"
        ? config.gradient ?? config.color ?? ""
        : "";
    document.documentElement.style.setProperty(
      "--header-bg-opacity",
      `${100 - getHeaderTransparency(config)}%`,
    );
    return () => {
      document.body.style.background = "";
      document.documentElement.style.removeProperty("--header-bg-opacity");
    };
  }, [config]);

  useEffect(() => {
    if (config.type !== "matrix") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    return startMatrixAnimation(canvas, context);
  }, [config.type]);

  return (
    <>
      {/* Matrix canvas — always rendered but only used when type === "matrix" */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{
          display: "block",
          position: "fixed",
          inset: 0,
          zIndex: -1,
          pointerEvents: "none",
          opacity: config.type === "matrix" ? 1 : 0,
        }}
      />

      {/* Image overlay */}
      {config.type === "image" && config.imageUrl && (
        <div
          aria-hidden="true"
          style={{
            backgroundImage: `url(${config.imageUrl})`,
            opacity: config.imageOpacity ?? 0.15,
            position: "fixed",
            inset: 0,
            zIndex: -1,
            backgroundSize: "cover",
            backgroundPosition: "center",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Space Grid overlay */}
      {config.type === "grid" && (
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: -1,
            pointerEvents: "none",
            opacity: 0.08,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      )}
    </>
  );
}
