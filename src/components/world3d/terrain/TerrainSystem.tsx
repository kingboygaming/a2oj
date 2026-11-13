"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { useGraphicsStore } from "../engine/useGraphicsStore";
import { getHeightAt, getBiomeColor } from "./BiomeManager";

const WORLD_SIZE = 200;

export function TerrainSystem() {
  const settings = useGraphicsStore((s) => s.settings);
  const segments = settings.terrainSegments;

  const { geometry, roadLine } = useMemo(() => {
    const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, segments, segments);
    geo.rotateX(-Math.PI / 2);

    const positions = geo.attributes.position;
    const colors = new Float32Array(positions.count * 3);

    const halfSize = WORLD_SIZE / 2;

    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);

      // Set height
      const height = getHeightAt(x, z);
      positions.setY(i, height);

      // Set vertex color from biome
      const [r, g, b] = getBiomeColor(x, z);

      // Darken valleys, lighten peaks
      const heightFactor = Math.max(0, Math.min(1, (height + 2) / 32));
      const brightness = 0.7 + heightFactor * 0.3;

      colors[i * 3] = r * brightness;
      colors[i * 3 + 1] = g * brightness;
      colors[i * 3 + 2] = b * brightness;
    }

    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    // Road/path lines
    const pathPoints: THREE.Vector3[] = [];
    const pathStep = 2;
    for (let x = -halfSize; x < halfSize; x += pathStep) {
      const z = Math.sin(x * 0.02) * 8;
      const h = getHeightAt(x, z) + 0.15;
      pathPoints.push(new THREE.Vector3(x, h, z));
    }
    const pathGeo = new THREE.BufferGeometry().setFromPoints(pathPoints);
    const lineMat = new THREE.LineBasicMaterial({ color: 0x5a4a3a });
    const line = new THREE.Line(pathGeo, lineMat);

    return { geometry: geo, roadLine: line };
  }, [segments]);

  return (
    <group>
      <mesh geometry={geometry} receiveShadow>
        <meshStandardMaterial
          vertexColors
          roughness={0.85}
          metalness={0.05}
          flatShading={settings.textureQuality === "low"}
        />
      </mesh>

      {/* Roads / paths */}
      <primitive object={roadLine} />
    </group>
  );
}
