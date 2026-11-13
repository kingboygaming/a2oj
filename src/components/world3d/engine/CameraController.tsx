"use client";

import { useRef, useEffect, type ComponentRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { useCameraStore } from "./useCameraStore";

export function CameraController() {
  const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null);
  const { camera } = useThree();
  const { target, viewMode } = useCameraStore();
  const targetVec = useRef(new THREE.Vector3(0, 0, 0));
  const isAnimating = useRef(false);

  useEffect(() => {
    const newTarget = new THREE.Vector3(...target);
    if (!targetVec.current.equals(newTarget)) {
      targetVec.current.copy(newTarget);
      isAnimating.current = true;
    }
  }, [target]);

  useEffect(() => {
    if (viewMode === "city") {
      const pos = camera.position.clone();
      const dist = 40;
      camera.position.set(
        targetVec.current.x + dist * 0.6,
        targetVec.current.y + dist * 0.8,
        targetVec.current.z + dist * 0.6
      );
      camera.lookAt(targetVec.current);
      isAnimating.current = true;
    } else {
      camera.position.set(0, 80, 80);
      targetVec.current.set(0, 0, 0);
      isAnimating.current = true;
    }
  }, [viewMode, camera]);

  useFrame(() => {
    if (!controlsRef.current) return;
    const controls = controlsRef.current as unknown as {
      target: THREE.Vector3;
      update: () => void;
    };
    if (isAnimating.current) {
      controls.target.lerp(targetVec.current, 0.05);
      if (controls.target.distanceTo(targetVec.current) < 0.1) {
        controls.target.copy(targetVec.current);
        isAnimating.current = false;
      }
      controls.update();
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.08}
      minDistance={20}
      maxDistance={300}
      minPolarAngle={0.3}
      maxPolarAngle={1.2}
      enablePan
      panSpeed={0.8}
      zoomSpeed={1.2}
      rotateSpeed={0.5}
      mouseButtons={{
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      }}
    />
  );
}
