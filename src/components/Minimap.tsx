"use client";

/* Lightweight procedural minimap using a small canvas (80×80 px)
   Draws a stylized top-down region map using the same biome noise
   as the 3D terrain. Renders local city and nearby multiplayer bases. */

import { useEffect, useRef } from "react";
import { getBiomeAtWorld } from "./world3d/terrain/BiomeManager";
import { VIEW_RADIUS_METERS, VIEW_RADIUS_UNITS, worldToRender } from "@/lib/world-coordinates";

const CANVAS = 80;
/** Half-width of the area shown, in world metres (matches the 3D view radius). */
const WORLD_RANGE_METERS = VIEW_RADIUS_METERS;

function biomeToRgb(type: string): [number, number, number] {
  switch (type) {
    case "FOREST":   return [38, 100, 38];
    case "MOUNTAIN": return [105, 100, 90];
    case "DESERT":   return [200, 170, 100];
    case "RIVER":    return [55, 120, 185];
    case "LAKE":     return [45, 100, 165];
    case "COAST":    return [185, 175, 130];
    default:         return [95, 150, 65]; // GRASSLAND
  }
}

interface MinimapProps {
  /** Player's stored world coordinates in metres. */
  cityX?: number;
  cityZ?: number;
  nearbyBases?: Array<{
    coordinateX: number;
    coordinateZ: number;
    displayName: string;
    pvpShieldUntil?: string | null;
  }>;
}

export function Minimap({ cityX = 0, cityZ = 0, nearbyBases = [] }: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Schedule off-main-thread to avoid blocking paint
    const id = requestAnimationFrame(() => {
      const img = ctx.createImageData(CANVAS, CANVAS);
      for (let py = 0; py < CANVAS; py++) {
        for (let px = 0; px < CANVAS; px++) {
          const offsetX = ((px / CANVAS) * 2 - 1) * WORLD_RANGE_METERS;
          const offsetZ = ((py / CANVAS) * 2 - 1) * WORLD_RANGE_METERS;
          const biome = getBiomeAtWorld(cityX + offsetX, cityZ + offsetZ);
          const [r, g, b] = biomeToRgb(biome.type);
          const idx = (py * CANVAS + px) * 4;
          img.data[idx]     = r;
          img.data[idx + 1] = g;
          img.data[idx + 2] = b;
          img.data[idx + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);

      // Draw other player bases within minimap range (render units → pixels).
      const now = Date.now();
      for (const base of nearbyBases) {
        const { x: relX, z: relZ } = worldToRender(
          base.coordinateX,
          base.coordinateZ,
          cityX,
          cityZ,
        );
        if (Math.abs(relX) <= VIEW_RADIUS_UNITS && Math.abs(relZ) <= VIEW_RADIUS_UNITS) {
          const bx = Math.round(((relX / VIEW_RADIUS_UNITS + 1) / 2) * CANVAS);
          const by = Math.round(((relZ / VIEW_RADIUS_UNITS + 1) / 2) * CANVAS);
          const shielded =
            base.pvpShieldUntil !== null &&
            base.pvpShieldUntil !== undefined &&
            new Date(base.pvpShieldUntil).getTime() > now;
          ctx.beginPath();
          ctx.arc(bx, by, 3, 0, Math.PI * 2);
          ctx.fillStyle = shielded ? "#38bdf8" : "#f97316";
          ctx.fill();
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // Local player city marker (center)
      const mx = CANVAS / 2;
      const my = CANVAS / 2;
      ctx.beginPath();
      ctx.arc(mx, my, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = "#ffcc00";
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Compass N
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = "bold 8px sans-serif";
      ctx.fillText("N", CANVAS - 10, 10);
    });

    return () => cancelAnimationFrame(id);
  }, [cityX, cityZ, nearbyBases]);

  return (
    <div
      style={{ width: CANVAS, height: CANVAS + 16 }}
      className="rounded overflow-hidden border border-white/20 shadow-lg"
    >
      <div className="bg-black/80 h-4 flex items-center px-1.5">
        <span className="text-[8px] font-bold uppercase tracking-widest text-white/50">Minimap</span>
      </div>
      <canvas
        ref={canvasRef}
        width={CANVAS}
        height={CANVAS}
        style={{ display: "block", imageRendering: "pixelated" }}
      />
    </div>
  );
}
