"use client";

/**
 * Ground decals: cobblestone path inside city, dirt road to gate.
 * Uses flat planes with vertex colors placed on terrain.
 */

import { useMemo } from "react";
import * as THREE from "three";
import { heightAtRender } from "../terrain/BiomeManager";

const COBBLE_MAT = new THREE.MeshStandardMaterial({
  color: 0x8a8070,
  roughness: 0.9,
  metalness: 0.0,
});
const DIRT_MAT = new THREE.MeshStandardMaterial({
  color: 0x7a6a50,
  roughness: 0.95,
  metalness: 0.0,
});

interface GroundDecalsProps {
  cityPosition: [number, number, number];
  /** Player's stored world coordinates in metres; anchors terrain sampling. */
  anchorWorldX: number;
  anchorWorldZ: number;
}

export function GroundDecals({
  cityPosition,
  anchorWorldX,
  anchorWorldZ,
}: GroundDecalsProps) {
  const [cx, , cz] = cityPosition;

  const decorations = useMemo(() => {
    const items: Array<{
      pos: [number, number, number];
      rot: number;
      w: number;
      d: number;
      type: "cobble" | "dirt";
    }> = [];

    // Central city plaza (cobblestone circle approximated by several squares)
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
      const r = 3;
      const px = cx + Math.cos(angle) * r;
      const pz = cz + Math.sin(angle) * r;
      const py = heightAtRender(px, pz, anchorWorldX, anchorWorldZ) + 0.05;
      items.push({ pos: [px, py, pz], rot: angle, w: 2, d: 2, type: "cobble" });
    }
    // Center plaza
    items.push({
      pos: [cx, heightAtRender(cx, cz, anchorWorldX, anchorWorldZ) + 0.05, cz],
      rot: 0,
      w: 4,
      d: 4,
      type: "cobble",
    });

    // Dirt road from gate (south) going outward
    for (let i = 0; i < 8; i++) {
      const pz = cz + 10 + i * 4;
      const py = heightAtRender(cx, pz, anchorWorldX, anchorWorldZ) + 0.04;
      items.push({ pos: [cx, py, pz], rot: 0, w: 2, d: 4, type: "dirt" });
    }

    // Connecting paths between buildings
    const connectors: Array<[[number, number], [number, number]]> = [
      [[cx, cz], [cx + 4, cz + 3]],
      [[cx, cz], [cx - 4, cz + 3]],
      [[cx, cz], [cx + 5, cz - 3]],
      [[cx, cz], [cx - 4, cz - 4]],
    ];
    for (const [[ax, az], [bx, bz]] of connectors) {
      const mx = (ax + bx) / 2;
      const mz = (az + bz) / 2;
      const angle = Math.atan2(bz - az, bx - ax);
      const dist = Math.hypot(bx - ax, bz - az);
      const py = heightAtRender(mx, mz, anchorWorldX, anchorWorldZ) + 0.04;
      items.push({ pos: [mx, py, mz], rot: angle, w: 1, d: dist, type: "cobble" });
    }

    return items;
  }, [cx, cz, anchorWorldX, anchorWorldZ]);

  return (
    <group>
      {decorations.map((d, i) => (
        <mesh
          key={i}
          position={d.pos}
          rotation={[-Math.PI / 2, 0, d.rot]}
          receiveShadow
        >
          <planeGeometry args={[d.w, d.d, 1, 1]} />
          {d.type === "cobble" ? (
            <primitive object={COBBLE_MAT} attach="material" />
          ) : (
            <primitive object={DIRT_MAT} attach="material" />
          )}
        </mesh>
      ))}
    </group>
  );
}
