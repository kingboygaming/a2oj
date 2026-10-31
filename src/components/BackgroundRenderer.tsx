"use client";

import { useEffect, useRef } from "react";
import { loadBgConfig, type BgConfig } from "@/lib/background-theme";

const BG_CHANGE_EVENT = "a2oj-bg-change";

export function BackgroundRenderer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const configRef = useRef<BgConfig>({ type: "default" });

  function applyConfig(config: BgConfig) {
    configRef.current = config;

    // Cancel any running Matrix animation
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }

    // Reset body background when switching away from solid/gradient
    if (config.type === "default" || config.type === "image" || config.type === "matrix" || config.type === "grid") {
      document.body.style.background = "";
    }

    if (config.type === "gradient" || config.type === "solid") {
      document.body.style.background = config.gradient ?? config.color ?? "";
    }

    if (config.type === "matrix") {
      startMatrix();
    }
  }

  function startMatrix() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const fontSize = 14;
    const cols = Math.floor(canvas.width / fontSize);
    const drops: number[] = Array(cols).fill(1);
    const chars = "01";

    function draw() {
      if (configRef.current.type !== "matrix") return;
      ctx2d!.fillStyle = "rgba(0,0,0,0.05)";
      ctx2d!.fillRect(0, 0, canvas!.width, canvas!.height);
      ctx2d!.fillStyle = "rgba(0,255,70,0.55)";
      ctx2d!.font = `${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        const text = chars[Math.floor(Math.random() * chars.length)];
        ctx2d!.fillText(text, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > canvas!.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
  }

  useEffect(() => {
    const initial = loadBgConfig();
    applyConfig(initial);

    function onBgChange(e: Event) {
      const detail = (e as CustomEvent<BgConfig>).detail;
      if (detail) applyConfig(detail);
    }

    function onResize() {
      const canvas = canvasRef.current;
      if (!canvas || configRef.current.type !== "matrix") return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    window.addEventListener(BG_CHANGE_EVENT, onBgChange);
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener(BG_CHANGE_EVENT, onBgChange);
      window.removeEventListener("resize", onResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      document.body.style.background = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const config = configRef.current;

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
