"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useGraphicsStore } from "./useGraphicsStore";

interface WorldEngineProps {
  children: ReactNode;
  className?: string;
}

/**
 * Keeps the renderer in sync with its host element.
 *
 * `react-use-measure` (used by <Canvas>) can miss the first layout pass when
 * the game viewport starts at 0px and grows once `--site-header-height` is
 * measured. The canvas then stays at the WebGL default 300x150 until the next
 * window resize. Watching the host directly removes that dependency on a
 * resize event, without remounting the scene or touching the camera.
 */
function CanvasSizeSync() {
  const setSize = useThree((state) => state.setSize);
  const gl = useThree((state) => state.gl);
  const size = useThree((state) => state.size);
  const applied = useRef({ width: size.width, height: size.height });

  useEffect(() => {
    const host = gl.domElement.parentElement;
    if (!host) return;

    let frame = 0;
    const sync = () => {
      frame = 0;
      const rect = host.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      const last = applied.current;
      if (
        Math.abs(last.width - rect.width) < 0.5 &&
        Math.abs(last.height - rect.height) < 0.5
      ) {
        return;
      }
      applied.current = { width: rect.width, height: rect.height };
      setSize(rect.width, rect.height);
    };
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(sync);
    };

    schedule();
    const observer = new ResizeObserver(schedule);
    observer.observe(host);
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [gl, setSize]);

  return null;
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
      <CanvasSizeSync />
      {children}
    </Canvas>
  );
}
