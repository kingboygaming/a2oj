"use client";

/**
 * Visual effects for Hospital healing in A2 Kingdom 3D world.
 * - Rising glowing medical cross motes with gentle swirling
 * - Soft pulsing emerald & golden healing aura
 * - Low-overhead InstancedMesh rendering with AdditiveBlending
 */

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface HealingParticle {
  x: number;
  y: number;
  z: number;
  baseX: number;
  baseZ: number;
  swirlSpeed: number;
  swirlRadius: number;
  vy: number;
  rot: number;
  vRot: number;
  life: number;
  maxLife: number;
  scale: number;
}

const PARTICLE_COUNT = 16;

function createCrossShape(): THREE.Shape {
  const shape = new THREE.Shape();
  const w = 0.06;
  const l = 0.18;
  shape.moveTo(-w, -l);
  shape.lineTo(w, -l);
  shape.lineTo(w, -w);
  shape.lineTo(l, -w);
  shape.lineTo(l, w);
  shape.lineTo(w, w);
  shape.lineTo(w, l);
  shape.lineTo(-w, l);
  shape.lineTo(-w, w);
  shape.lineTo(-l, w);
  shape.lineTo(-l, -w);
  shape.lineTo(-w, -w);
  shape.closePath();
  return shape;
}

function initParticle(staggerRatio = 0): HealingParticle {
  const angle = Math.random() * Math.PI * 2;
  const radius = 0.4 + Math.random() * 1.6;
  const maxLife = 2.2 + Math.random() * 1.2;
  return {
    x: Math.cos(angle) * radius,
    y: 1.2 + staggerRatio * 3.5,
    z: Math.sin(angle) * radius,
    baseX: Math.cos(angle) * radius,
    baseZ: Math.sin(angle) * radius,
    swirlSpeed: (Math.random() > 0.5 ? 1 : -1) * (0.8 + Math.random() * 0.8),
    swirlRadius: radius,
    vy: 0.9 + Math.random() * 0.6,
    rot: Math.random() * Math.PI * 2,
    vRot: (Math.random() - 0.5) * 2.5,
    life: maxLife * (1 - staggerRatio),
    maxLife,
    scale: 0.8 + Math.random() * 0.5,
  };
}

export function HealingVFX({
  position = [0, 0, 0],
}: {
  position?: [number, number, number];
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const particles = useRef<HealingParticle[]>([]);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    particles.current = Array.from({ length: PARTICLE_COUNT }, (_, index) =>
      initParticle(index / PARTICLE_COUNT),
    );
  }, []);

  const crossGeometry = useMemo(() => {
    const shape = createCrossShape();
    return new THREE.ShapeGeometry(shape);
  }, []);

  const crossMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color("#4ade80"),
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    [],
  );

  useFrame(({ clock }, delta) => {
    const elapsed = clock.elapsedTime;
    const dt = Math.min(delta, 0.1);

    // Pulse point light
    if (lightRef.current) {
      lightRef.current.intensity = 1.4 + Math.sin(elapsed * 3.5) * 0.5;
    }

    // Slowly rotate sanctuary ring
    if (ringRef.current) {
      ringRef.current.rotation.z = elapsed * 0.4;
    }

    const mesh = meshRef.current;
    if (!mesh) return;

    for (let i = 0; i < particles.current.length; i++) {
      const p = particles.current[i];
      p.life -= dt;
      if (p.life <= 0) {
        particles.current[i] = initParticle(0);
        continue;
      }

      // Physics update
      p.y += p.vy * dt;
      const swirlAngle = elapsed * p.swirlSpeed + i;
      p.x = p.baseX * 0.7 + Math.cos(swirlAngle) * (p.swirlRadius * 0.3);
      p.z = p.baseZ * 0.7 + Math.sin(swirlAngle) * (p.swirlRadius * 0.3);
      p.rot += p.vRot * dt;

      // Scale & fade envelope
      const progress = 1 - p.life / p.maxLife; // 0 -> 1
      let scaleFade = 1;
      if (progress < 0.2) {
        scaleFade = progress / 0.2;
      } else if (progress > 0.75) {
        scaleFade = (1 - progress) / 0.25;
      }
      const currentScale = p.scale * Math.max(0.01, scaleFade);

      dummy.position.set(position[0] + p.x, position[1] + p.y, position[2] + p.z);
      dummy.rotation.set(0, p.rot, 0);
      dummy.scale.setScalar(currentScale);
      dummy.updateMatrix();

      mesh.setMatrixAt(i, dummy.matrix);

      // Hue variation: emerald green transitioning toward soft gold
      const hue = 0.36 - progress * 0.08; // green (0.36) -> warm lime/gold (0.28)
      const color = new THREE.Color().setHSL(hue, 0.85, 0.65);
      mesh.setColorAt(i, color);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <group position={position}>
      {/* Soft emerald healing aura light */}
      <pointLight
        ref={lightRef}
        color="#34d399"
        intensity={1.5}
        distance={7.5}
        position={[0, 2.5, 0]}
      />

      {/* Floating cross motes */}
      <instancedMesh
        ref={meshRef}
        args={[crossGeometry, crossMaterial, PARTICLE_COUNT]}
        frustumCulled={false}
      />

      {/* Magic sanctuary ring on the ground / roof base */}
      <mesh
        ref={ringRef}
        position={[0, 0.1, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[1.5, 1.75, 32]} />
        <meshBasicMaterial
          color="#10b981"
          transparent
          opacity={0.35}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}
