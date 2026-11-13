"use client";

/**
 * LOD (Level of Detail) utilities for A2 Kingdom 3D world.
 * Uses @react-three/drei's Detailed component (wrapper around THREE.LOD).
 */

import { type ReactElement, type JSXElementConstructor } from "react";
import { Detailed } from "@react-three/drei";
import * as THREE from "three";

type R3FElement = ReactElement<THREE.Object3D, string | JSXElementConstructor<unknown>>;

interface LodWrapperProps {
  distances: [number, number, number];
  hi: R3FElement;
  mid: R3FElement;
  lo: R3FElement;
}

/**
 * Renders hi-quality mesh when near, switches to mid then lo at given distances.
 */
export function LodWrapper({ distances, hi, mid, lo }: LodWrapperProps) {
  return (
    <Detailed distances={distances}>
      {hi}
      {mid}
      {lo}
    </Detailed>
  );
}

/**
 * Culls children beyond maxDistance from the camera.
 * Children must be a valid R3F scene element.
 */
export function DistanceCull({
  position,
  maxDistance,
  children,
}: {
  position: [number, number, number];
  maxDistance: number;
  children: R3FElement;
}) {
  const empty = <group /> as R3FElement;
  return (
    <Detailed distances={[maxDistance]} position={position}>
      {children}
      {empty}
    </Detailed>
  );
}
