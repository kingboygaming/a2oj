/* ── Procedural tree & vegetation geometry generators ── */
import * as THREE from "three";

const TRUNK_MAT = new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.9 });
const PINE_MAT = new THREE.MeshStandardMaterial({ color: 0x1a4a20, roughness: 0.8 });
const OAK_MAT = new THREE.MeshStandardMaterial({ color: 0x2d5a1e, roughness: 0.75 });
const BUSH_MAT = new THREE.MeshStandardMaterial({ color: 0x3a6a2a, roughness: 0.85 });
const ROCK_MAT = new THREE.MeshStandardMaterial({ color: 0x6a6a68, roughness: 0.95, metalness: 0.05 });
const FLOWER_RED = new THREE.MeshStandardMaterial({ color: 0xcc3344, roughness: 0.6 });
const FLOWER_YELLOW = new THREE.MeshStandardMaterial({ color: 0xddbb22, roughness: 0.6 });
const FLOWER_PURPLE = new THREE.MeshStandardMaterial({ color: 0x8844aa, roughness: 0.6 });
const GRASS_MAT = new THREE.MeshStandardMaterial({ color: 0x4a8a30, roughness: 0.9, side: THREE.DoubleSide });

/* ── Pine Tree ── */
export function createPineTree(scale = 1): THREE.Group {
  const group = new THREE.Group();

  // Trunk
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15 * scale, 0.25 * scale, 2 * scale, 5),
    TRUNK_MAT
  );
  trunk.position.y = 1 * scale;
  trunk.castShadow = true;
  group.add(trunk);

  // Three cone layers for foliage
  for (let i = 0; i < 3; i++) {
    const radius = (1.2 - i * 0.25) * scale;
    const height = (1.5 - i * 0.2) * scale;
    const y = (1.5 + i * 1.0) * scale;
    const foliage = new THREE.Mesh(
      new THREE.ConeGeometry(radius, height, 6),
      PINE_MAT
    );
    foliage.position.y = y;
    foliage.castShadow = true;
    group.add(foliage);
  }

  return group;
}

/* ── Oak Tree ── */
export function createOakTree(scale = 1): THREE.Group {
  const group = new THREE.Group();

  // Trunk
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2 * scale, 0.35 * scale, 2.5 * scale, 5),
    TRUNK_MAT
  );
  trunk.position.y = 1.25 * scale;
  trunk.castShadow = true;
  group.add(trunk);

  // Rounded canopy (icosahedron for organic shape)
  const canopy = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.8 * scale, 1),
    OAK_MAT
  );
  canopy.position.y = 3.5 * scale;
  canopy.scale.y = 0.7;
  canopy.castShadow = true;
  group.add(canopy);

  // Secondary smaller canopy cluster
  const canopy2 = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.1 * scale, 1),
    OAK_MAT
  );
  canopy2.position.set(0.8 * scale, 3.0 * scale, 0.5 * scale);
  canopy2.castShadow = true;
  group.add(canopy2);

  return group;
}

/* ── Bush ── */
export function createBush(scale = 1): THREE.Group {
  const group = new THREE.Group();
  const bush = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.6 * scale, 1),
    BUSH_MAT
  );
  bush.position.y = 0.4 * scale;
  bush.scale.y = 0.65;
  bush.castShadow = true;
  group.add(bush);

  // Secondary lump
  const bush2 = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.4 * scale, 1),
    BUSH_MAT
  );
  bush2.position.set(0.3 * scale, 0.3 * scale, 0.2 * scale);
  bush2.castShadow = true;
  group.add(bush2);

  return group;
}

/* ── Rock ── */
export function createRock(scale = 1): THREE.Group {
  const group = new THREE.Group();
  const rock = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.8 * scale, 0),
    ROCK_MAT
  );
  rock.position.y = 0.3 * scale;
  rock.scale.set(1, 0.6, 0.9);
  rock.rotation.y = 0.7; // deterministic
  rock.castShadow = true;
  rock.receiveShadow = true;
  group.add(rock);

  // Smaller secondary rock
  const rock2 = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.35 * scale, 0),
    ROCK_MAT
  );
  rock2.position.set(0.6 * scale, 0.15 * scale, 0.3 * scale);
  rock2.scale.set(1, 0.5, 0.8);
  rock2.castShadow = true;
  group.add(rock2);

  return group;
}

/* ── Flower ── */
export function createFlower(variant = 0): THREE.Group {
  const group = new THREE.Group();
  const colors = [FLOWER_RED, FLOWER_YELLOW, FLOWER_PURPLE];

  // Stem
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.03, 0.4, 4),
    new THREE.MeshStandardMaterial({ color: 0x2a6a1a })
  );
  stem.position.y = 0.2;
  group.add(stem);

  // Flower head
  const flower = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 6, 4),
    colors[variant % 3]
  );
  flower.position.y = 0.45;
  flower.scale.y = 0.5;
  group.add(flower);

  return group;
}

/* ── Grass Tuft (for instancing) ── */
export function createGrassTuft(): THREE.Group {
  const group = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Mesh(
      new THREE.PlaneGeometry(0.08, 0.3 + i * 0.08),
      GRASS_MAT
    );
    blade.position.set((i - 1) * 0.06, 0.15, 0);
    blade.rotation.y = i * 0.8;
    blade.rotation.z = (i - 1) * 0.1;
    group.add(blade);
  }
  return group;
}

export { TRUNK_MAT, PINE_MAT, OAK_MAT, BUSH_MAT, ROCK_MAT, GRASS_MAT };
