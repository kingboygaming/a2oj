"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { useGraphicsStore } from "../engine/useGraphicsStore";
import { getCurrentPhase } from "./DayNightCycle";

export function AtmosphereSystem() {
  const settings = useGraphicsStore((s) => s.settings);
  const phase = useMemo(() => getCurrentPhase(), []);

  const fogColor = useMemo(
    () => new THREE.Color(...phase.fogColor),
    [phase]
  );

  return (
    <>
      {/* Atmospheric fog */}
      <fog attach="fog" args={[fogColor, 50, settings.drawDistance]} />

      {/* Sky dome — gradient sphere */}
      <SkyDome phase={phase.name} />
    </>
  );
}

function SkyDome({ phase }: { phase: string }) {
  const colors = useMemo(() => {
    switch (phase) {
      case "dawn":
        return { top: 0x4a6a9a, bottom: 0xddaa77 };
      case "dusk":
        return { top: 0x2a3a6a, bottom: 0xcc7744 };
      case "night":
        return { top: 0x0a0a2a, bottom: 0x1a1a3a };
      default: // day
        return { top: 0x5588cc, bottom: 0x88bbdd };
    }
  }, [phase]);

  const skyGeo = useMemo(() => {
    const geo = new THREE.SphereGeometry(400, 16, 12);
    const positions = geo.attributes.position;
    const vertexColors = new Float32Array(positions.count * 3);

    const topColor = new THREE.Color(colors.top);
    const bottomColor = new THREE.Color(colors.bottom);

    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i);
      const t = Math.max(0, Math.min(1, (y + 400) / 800));
      const c = new THREE.Color().lerpColors(bottomColor, topColor, t);
      vertexColors[i * 3] = c.r;
      vertexColors[i * 3 + 1] = c.g;
      vertexColors[i * 3 + 2] = c.b;
    }

    geo.setAttribute("color", new THREE.BufferAttribute(vertexColors, 3));
    return geo;
  }, [colors]);

  return (
    <mesh geometry={skyGeo}>
      <meshBasicMaterial vertexColors side={THREE.BackSide} />
    </mesh>
  );
}
