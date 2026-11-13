"use client";

/**
 * Animated waving flag using morph targets approach.
 * Uses vertex displacement via useFrame for a cloth-like wave effect.
 */

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface AnimatedFlagProps {
  position: [number, number, number];
  color?: number;
  width?: number;
  height?: number;
}

const W_SEGS = 8;
const H_SEGS = 4;

export function AnimatedFlag({
  position,
  color = 0xcc2222,
  width = 1.2,
  height = 0.75,
}: AnimatedFlagProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(width, height, W_SEGS, H_SEGS);
    // Store original positions
    const positions = geo.attributes.position as THREE.BufferAttribute;
    const originals = new Float32Array(positions.array);
    geo.userData.originals = originals;
    return geo;
  }, [width, height]);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const geo = mesh.geometry;
    const positions = geo.attributes.position as THREE.BufferAttribute;
    const originals = geo.userData.originals as Float32Array;
    const t = clock.elapsedTime;

    for (let i = 0; i < positions.count; i++) {
      const ox = originals[i * 3];
      const oy = originals[i * 3 + 1];
      // oz = originals[i * 3 + 2]

      // Wave amplitude increases toward the free end (right side of flag)
      const normalizedX = (ox + width / 2) / width; // 0 at pole, 1 at free end
      const wave =
        Math.sin(ox * 3 + t * 4) * 0.08 * normalizedX +
        Math.sin(ox * 5 + t * 6) * 0.04 * normalizedX;
      const vertWave =
        Math.cos(oy * 2 + t * 2) * 0.02 * normalizedX;

      positions.setXYZ(i, ox, oy, wave + vertWave);
    }

    positions.needsUpdate = true;
    geo.computeVertexNormals();
  });

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color,
        side: THREE.DoubleSide,
        roughness: 0.65,
        metalness: 0.0,
      }),
    [color]
  );

  return (
    <group position={position}>
      {/* Flag pole */}
      <mesh castShadow>
        <cylinderGeometry args={[0.025, 0.025, height * 1.4 + 0.3, 5]} />
        <meshStandardMaterial color={0x888888} roughness={0.4} metalness={0.6} />
      </mesh>

      {/* Waving flag cloth */}
      <mesh
        ref={meshRef}
        geometry={geometry}
        material={material}
        position={[width / 2, height / 2, 0]}
        castShadow
      />

      {/* Pole finial (small ball on top) */}
      <mesh position={[0, height * 0.7 + 0.4, 0]}>
        <sphereGeometry args={[0.05, 6, 6]} />
        <meshStandardMaterial color={0xddbb00} roughness={0.3} metalness={0.7} />
      </mesh>
    </group>
  );
}
