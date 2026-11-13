"use client";

import { type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { useGraphicsStore } from "./useGraphicsStore";

interface WorldEngineProps {
  children: ReactNode;
  className?: string;
}

export function WorldEngine({ children, className }: WorldEngineProps) {
  const settings = useGraphicsStore((s) => s.settings);

  return (
    <Canvas
      className={className}
      shadows={settings.shadowEnabled}
      dpr={[1, 2]}
      gl={{
        antialias: settings.antialias,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.0,
      }}
      camera={{
        fov: 45,
        near: 1,
        far: settings.drawDistance + 200,
        position: [0, 80, 80],
      }}
      onCreated={({ gl }) => {
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.shadowMap.enabled = settings.shadowEnabled;
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
      }}
    >
      {children}
    </Canvas>
  );
}
