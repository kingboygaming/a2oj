"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useGraphicsStore } from "../engine/useGraphicsStore";
import { getCurrentPhase } from "./DayNightCycle";

export function LightingSystem() {
  const dirLightRef = useRef<THREE.DirectionalLight>(null);
  const settings = useGraphicsStore((s) => s.settings);

  const phase = useMemo(() => getCurrentPhase(), []);

  useFrame(() => {
    if (!dirLightRef.current) return;
    const light = dirLightRef.current;

    // Slowly rotate sun position
    const time = Date.now() * 0.00001;
    const radius = 80;
    light.position.set(
      Math.cos(time) * radius,
      50 + Math.sin(phase.sunAngle) * 30,
      Math.sin(time) * radius * 0.5
    );
  });

  return (
    <>
      {/* Directional sunlight */}
      <directionalLight
        ref={dirLightRef}
        color={new THREE.Color(...phase.sunColor)}
        intensity={phase.sunIntensity}
        position={[60, 50, 30]}
        castShadow={settings.shadowEnabled}
        shadow-mapSize-width={settings.shadowMapSize}
        shadow-mapSize-height={settings.shadowMapSize}
        shadow-camera-near={1}
        shadow-camera-far={200}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
        shadow-bias={-0.0005}
      />

      {/* Ambient light for fill */}
      <ambientLight
        color={new THREE.Color(...phase.ambientColor)}
        intensity={phase.ambientIntensity}
      />

      {/* Hemisphere light for natural sky/ground color */}
      <hemisphereLight
        color={new THREE.Color(0.6, 0.7, 0.85)}
        groundColor={new THREE.Color(0.3, 0.25, 0.2)}
        intensity={0.3}
      />
    </>
  );
}
