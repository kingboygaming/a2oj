"use client";

/**
 * Particle effects for A2 Kingdom 3D world.
 * - SmokeParticles: rising smoke from chimneys/fires
 * - SparkParticles: glowing sparks near smithy/barracks
 *
 * Uses InstancedMesh for performance.
 */

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
}

const MAX_SMOKE = 24;
const MAX_SPARKS = 16;

/* ── Smoke column rising from chimneys ── */
export function SmokeParticles({
  position,
}: {
  position: [number, number, number];
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const particles = useRef<Particle[]>([]);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    particles.current = Array.from(
      { length: MAX_SMOKE },
      (_, index) => createSmoke(index * (60 / MAX_SMOKE)),
    );
  }, []);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dt = 0.016;

    for (let i = 0; i < particles.current.length; i++) {
      const p = particles.current[i];
      p.life -= dt;
      if (p.life <= 0) {
        particles.current[i] = createSmoke(0);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      // Slight drift
      p.vx += (Math.sin(clock.elapsedTime * 0.7 + i) * 0.002);
      p.vz += (Math.cos(clock.elapsedTime * 0.5 + i) * 0.002);

      const lifeRatio = p.life / p.maxLife;
      const scale = p.size * (1.5 - lifeRatio * 0.5);
      dummy.position.set(position[0] + p.x, position[1] + p.y, position[2] + p.z);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      // Color: dark smoke → lighter as it rises
      const col = new THREE.Color().setHSL(0, 0, 0.3 + (1 - lifeRatio) * 0.4);
      mesh.setColorAt(i, col);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  const geo = useMemo(() => new THREE.SphereGeometry(0.3, 4, 4), []);
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: 0x888888,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      }),
    []
  );

  return (
    <instancedMesh
      ref={meshRef}
      args={[geo, mat, MAX_SMOKE]}
      frustumCulled={false}
    />
  );
}

function createSmoke(initialY: number): Particle {
  return {
    x: (Math.random() - 0.5) * 0.2,
    y: initialY * 0.3,
    z: (Math.random() - 0.5) * 0.2,
    vx: (Math.random() - 0.5) * 0.03,
    vy: 0.6 + Math.random() * 0.3,
    vz: (Math.random() - 0.5) * 0.03,
    life: 4 + Math.random() * 2,
    maxLife: 6,
    size: 0.3 + Math.random() * 0.3,
  };
}

/* ── Torch sparks near gate / barracks ── */
export function TorchFlame({ position }: { position: [number, number, number] }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const particles = useRef<Particle[]>([]);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    particles.current = Array.from(
      { length: MAX_SPARKS },
      (_, index) => createSpark(index * (1.5 / MAX_SPARKS)),
    );
  }, []);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dt = 0.016;

    for (let i = 0; i < particles.current.length; i++) {
      const p = particles.current[i];
      p.life -= dt;
      if (p.life <= 0) {
        particles.current[i] = createSpark(0);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy -= 0.5 * dt; // gravity

      const lifeRatio = p.life / p.maxLife;
      dummy.position.set(position[0] + p.x, position[1] + p.y, position[2] + p.z);
      dummy.scale.setScalar(p.size * lifeRatio);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      const hue = 0.07 - lifeRatio * 0.05; // orange → red
      const col = new THREE.Color().setHSL(hue, 1, 0.5 + lifeRatio * 0.2);
      mesh.setColorAt(i, col);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  const geo = useMemo(() => new THREE.SphereGeometry(0.08, 3, 3), []);
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: 0xff8800,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      }),
    []
  );

  return (
    <instancedMesh
      ref={meshRef}
      args={[geo, mat, MAX_SPARKS]}
      frustumCulled={false}
    />
  );
}

function createSpark(initialY: number): Particle {
  const angle = Math.random() * Math.PI * 2;
  const speed = 0.5 + Math.random() * 0.8;
  return {
    x: (Math.random() - 0.5) * 0.08,
    y: initialY * 0.5,
    z: (Math.random() - 0.5) * 0.08,
    vx: Math.cos(angle) * speed * 0.3,
    vy: 1.5 + Math.random() * 1.0,
    vz: Math.sin(angle) * speed * 0.3,
    life: 0.8 + Math.random() * 0.7,
    maxLife: 1.5,
    size: 0.08 + Math.random() * 0.08,
  };
}
