/* ── Procedural medieval building geometry generators ── */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const STONE = new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.9, metalness: 0.05 });
const ROOF_RED = new THREE.MeshStandardMaterial({ color: 0x8b2020, roughness: 0.7, metalness: 0.05 });
const ROOF_BLUE = new THREE.MeshStandardMaterial({ color: 0x2a4a6b, roughness: 0.7, metalness: 0.05 });
const WOOD = new THREE.MeshStandardMaterial({ color: 0x654321, roughness: 0.85, metalness: 0.0 });
const METAL = new THREE.MeshStandardMaterial({ color: 0x708090, roughness: 0.4, metalness: 0.6 });
const DOOR = new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 0.9, metalness: 0.0 });
const WINDOW_MAT = new THREE.MeshStandardMaterial({ color: 0xf5e6a8, roughness: 0.3, metalness: 0.1, emissive: 0xf5e6a8, emissiveIntensity: 0.15 });
const WHITE_STONE = new THREE.MeshStandardMaterial({ color: 0xc8bfa0, roughness: 0.85, metalness: 0.05 });
const DARK_STONE = new THREE.MeshStandardMaterial({ color: 0x5a5048, roughness: 0.9, metalness: 0.1 });
const GLOW_BLUE = new THREE.MeshStandardMaterial({ color: 0x4488ff, roughness: 0.2, metalness: 0.3, emissive: 0x4488ff, emissiveIntensity: 0.4 });
const FLAG_RED = new THREE.MeshStandardMaterial({ color: 0xcc2222, roughness: 0.6, side: THREE.DoubleSide });

function applyMatrixToGeo(geo: THREE.BufferGeometry, matrix: THREE.Matrix4): THREE.BufferGeometry {
  const cloned = geo.clone();
  cloned.applyMatrix4(matrix);
  return cloned;
}

function box(w: number, h: number, d: number, x = 0, y = 0, z = 0): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y + h / 2, z);
  return g;
}

function cyl(rTop: number, rBot: number, h: number, x = 0, y = 0, z = 0, segs = 8): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, segs);
  g.translate(x, y + h / 2, z);
  return g;
}

function cone(r: number, h: number, x = 0, y = 0, z = 0, segs = 8): THREE.BufferGeometry {
  const g = new THREE.ConeGeometry(r, h, segs);
  g.translate(x, y + h / 2, z);
  return g;
}

/* ── Castle ── */
export function createCastle(level: number): THREE.Group {
  const group = new THREE.Group();
  const scale = 0.8 + (level / 20) * 0.6;
  const baseH = 3 * scale;
  const towerH = 5 * scale;
  const towerR = 1.2 * scale;

  // Main keep
  const keepGeos = [
    box(4 * scale, baseH, 4 * scale),
    // Crenellations on top
    box(0.4, 0.6, 4 * scale, -2 * scale + 0.2, baseH),
    box(0.4, 0.6, 4 * scale, 2 * scale - 0.2, baseH),
    box(4 * scale, 0.6, 0.4, 0, baseH, -2 * scale + 0.2),
    box(4 * scale, 0.6, 0.4, 0, baseH, 2 * scale - 0.2),
  ];
  const keepMesh = new THREE.Mesh(mergeGeometries(keepGeos)!, STONE);
  keepMesh.castShadow = true;
  keepMesh.receiveShadow = true;
  group.add(keepMesh);

  // Central tower
  const towerGeos = [cyl(towerR, towerR * 1.1, towerH, 0, baseH)];
  const towerMesh = new THREE.Mesh(mergeGeometries(towerGeos)!, DARK_STONE);
  towerMesh.castShadow = true;
  group.add(towerMesh);

  // Tower roof
  const roofMesh = new THREE.Mesh(
    cone(towerR * 1.3, 2.5 * scale, 0, baseH + towerH),
    ROOF_RED
  );
  roofMesh.castShadow = true;
  group.add(roofMesh);

  // Flag pole + flag
  const poleMesh = new THREE.Mesh(cyl(0.06, 0.06, 2, 0, baseH + towerH + 2.5 * scale), METAL);
  group.add(poleMesh);
  const flagGeo = new THREE.PlaneGeometry(1, 0.6);
  flagGeo.translate(0.5, baseH + towerH + 2.5 * scale + 2.3, 0);
  const flagMesh = new THREE.Mesh(flagGeo, FLAG_RED);
  group.add(flagMesh);

  // Windows
  const winPositions = [
    [0, baseH * 0.5, 2 * scale + 0.01],
    [0, baseH * 0.5, -(2 * scale + 0.01)],
    [2 * scale + 0.01, baseH * 0.5, 0],
  ] as const;
  for (const [wx, wy, wz] of winPositions) {
    const win = new THREE.Mesh(box(0.5, 0.7, 0.05, wx, wy, wz), WINDOW_MAT);
    group.add(win);
  }

  // Door
  const doorMesh = new THREE.Mesh(box(1 * scale, 1.8, 0.1, 0, 0, 2 * scale + 0.05), DOOR);
  group.add(doorMesh);

  return group;
}

/* ── Watch Tower ── */
export function createWatchTower(): THREE.Group {
  const group = new THREE.Group();
  const towerMesh = new THREE.Mesh(cyl(0.8, 1.0, 7, 0, 0, 0, 6), STONE);
  towerMesh.castShadow = true;
  group.add(towerMesh);

  // Platform
  const platform = new THREE.Mesh(cyl(1.3, 1.3, 0.3, 0, 7), DARK_STONE);
  platform.castShadow = true;
  group.add(platform);

  // Pointed roof
  const roof = new THREE.Mesh(cone(1.1, 2, 0, 7.3), ROOF_RED);
  roof.castShadow = true;
  group.add(roof);

  // Window slits
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2;
    const win = new THREE.Mesh(
      box(0.15, 0.5, 0.05, Math.cos(angle) * 0.85, 4 + i, Math.sin(angle) * 0.85),
      WINDOW_MAT
    );
    group.add(win);
  }

  return group;
}

/* ── Gate ── */
export function createGate(): THREE.Group {
  const group = new THREE.Group();

  // Two pillars
  const leftPillar = new THREE.Mesh(box(1.2, 5, 1.5, -2, 0, 0), STONE);
  leftPillar.castShadow = true;
  group.add(leftPillar);

  const rightPillar = new THREE.Mesh(box(1.2, 5, 1.5, 2, 0, 0), STONE);
  rightPillar.castShadow = true;
  group.add(rightPillar);

  // Arch connecting
  const archGeos = [
    box(5.2, 1, 1.5, 0, 5, 0),
    box(5.2, 0.3, 0.3, 0, 5.5, 0),   // Crenellation strip
  ];
  const arch = new THREE.Mesh(mergeGeometries(archGeos)!, DARK_STONE);
  arch.castShadow = true;
  group.add(arch);

  // Gate door
  const gateDoor = new THREE.Mesh(box(2.8, 3.8, 0.15, 0, 0, 0), DOOR);
  group.add(gateDoor);

  // Pillar tops (small pyramids)
  const leftTop = new THREE.Mesh(cone(0.8, 1.2, -2, 5), ROOF_RED);
  group.add(leftTop);
  const rightTop = new THREE.Mesh(cone(0.8, 1.2, 2, 5), ROOF_RED);
  group.add(rightTop);

  return group;
}

/* ── House ── */
export function createHouse(variant = 0): THREE.Group {
  const group = new THREE.Group();
  const w = 2 + (variant % 3) * 0.3;
  const h = 1.8 + (variant % 2) * 0.3;
  const d = 2.5 + (variant % 2) * 0.4;

  // Walls
  const walls = new THREE.Mesh(box(w, h, d), WHITE_STONE);
  walls.castShadow = true;
  walls.receiveShadow = true;
  group.add(walls);

  // Pitched roof (using a prism-like shape approximation)
  const roofH = 1.2;
  const roofGeo = new THREE.ConeGeometry(Math.max(w, d) * 0.75, roofH, 4);
  roofGeo.rotateY(Math.PI / 4);
  roofGeo.translate(0, h + roofH / 2, 0);
  const roofMat = variant % 2 === 0 ? ROOF_RED : ROOF_BLUE;
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.castShadow = true;
  group.add(roof);

  // Door
  const door = new THREE.Mesh(box(0.5, 1, 0.06, 0, 0, d / 2 + 0.03), DOOR);
  group.add(door);

  // Window
  const win = new THREE.Mesh(box(0.4, 0.4, 0.06, w * 0.3, h * 0.5, d / 2 + 0.03), WINDOW_MAT);
  group.add(win);

  return group;
}

/* ── Factory ── */
export function createFactory(level: number): THREE.Group {
  const group = new THREE.Group();
  const scale = 0.8 + (level / 20) * 0.4;

  // Main building
  const mainBody = new THREE.Mesh(box(4 * scale, 2.5 * scale, 3 * scale), STONE);
  mainBody.castShadow = true;
  mainBody.receiveShadow = true;
  group.add(mainBody);

  // Flat-ish roof
  const roof = new THREE.Mesh(box(4.4 * scale, 0.3, 3.4 * scale, 0, 2.5 * scale), DARK_STONE);
  roof.castShadow = true;
  group.add(roof);

  // Chimney
  const chimney = new THREE.Mesh(cyl(0.3, 0.4, 2.5 * scale, 1.2 * scale, 2.8 * scale, -0.8 * scale), DARK_STONE);
  chimney.castShadow = true;
  group.add(chimney);

  // Second chimney for higher levels
  if (level > 5) {
    const chimney2 = new THREE.Mesh(cyl(0.25, 0.35, 2 * scale, -1 * scale, 2.8 * scale, 0.5 * scale), DARK_STONE);
    chimney2.castShadow = true;
    group.add(chimney2);
  }

  // Door (large)
  const door = new THREE.Mesh(box(1.2 * scale, 1.8, 0.1, 0, 0, 1.5 * scale + 0.05), DOOR);
  group.add(door);

  // Gear decoration on wall
  const gear = new THREE.Mesh(
    new THREE.TorusGeometry(0.4, 0.08, 6, 6),
    METAL
  );
  gear.position.set(-2 * scale - 0.01, 1.5, 0);
  gear.rotation.y = Math.PI / 2;
  group.add(gear);

  return group;
}

/* ── Warehouse ── */
export function createWarehouse(level: number): THREE.Group {
  const group = new THREE.Group();
  const scale = 0.8 + (level / 20) * 0.4;

  // Large barn body
  const body = new THREE.Mesh(box(5 * scale, 2.5 * scale, 3.5 * scale), WOOD);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Barn roof (triangular)
  const roofH = 1.5 * scale;
  const roofGeo = new THREE.ConeGeometry(Math.max(5 * scale, 3.5 * scale) * 0.55, roofH, 4);
  roofGeo.rotateY(Math.PI / 4);
  roofGeo.translate(0, 2.5 * scale + roofH / 2, 0);
  const roof = new THREE.Mesh(roofGeo, ROOF_RED);
  roof.castShadow = true;
  group.add(roof);

  // Big double doors
  const ldoor = new THREE.Mesh(box(0.8 * scale, 2, 0.08, -0.5 * scale, 0, 1.75 * scale + 0.04), DOOR);
  group.add(ldoor);
  const rdoor = new THREE.Mesh(box(0.8 * scale, 2, 0.08, 0.5 * scale, 0, 1.75 * scale + 0.04), DOOR);
  group.add(rdoor);

  // Wooden supports
  for (const xOff of [-2 * scale, 0, 2 * scale]) {
    const support = new THREE.Mesh(box(0.15, 2.5 * scale, 0.15, xOff, 0, 1.75 * scale), DARK_STONE);
    group.add(support);
  }

  return group;
}

/* ── Barracks ── */
export function createBarracks(): THREE.Group {
  const group = new THREE.Group();

  // Long rectangular building
  const body = new THREE.Mesh(box(6, 2.2, 3), STONE);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Flat roof with slight edge
  const roof = new THREE.Mesh(box(6.3, 0.25, 3.3, 0, 2.2), DARK_STONE);
  group.add(roof);

  // Doors (two)
  for (const xOff of [-1.5, 1.5]) {
    const door = new THREE.Mesh(box(0.7, 1.6, 0.08, xOff, 0, 1.54), DOOR);
    group.add(door);
  }

  // Weapon rack detail
  const rack = new THREE.Mesh(box(0.1, 1.5, 0.6, 3.05, 0.5, 0), WOOD);
  group.add(rack);
  // Spears on rack
  for (const zOff of [-0.15, 0, 0.15]) {
    const spear = new THREE.Mesh(cyl(0.02, 0.02, 1.8, 3.1, 0.2, zOff), METAL);
    group.add(spear);
  }

  // Banner
  const bannerPole = new THREE.Mesh(cyl(0.04, 0.04, 1.5, -3, 2.2), METAL);
  group.add(bannerPole);
  const bannerGeo = new THREE.PlaneGeometry(0.6, 0.8);
  bannerGeo.translate(-2.65, 3.2, 0);
  const banner = new THREE.Mesh(bannerGeo, FLAG_RED);
  group.add(banner);

  return group;
}

/* ── Research Lab ── */
export function createResearchLab(): THREE.Group {
  const group = new THREE.Group();

  // Tower base
  const base = new THREE.Mesh(cyl(1.5, 1.8, 4, 0, 0, 0, 6), WHITE_STONE);
  base.castShadow = true;
  group.add(base);

  // Dome roof
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1.6, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), ROOF_BLUE);
  dome.position.y = 4;
  dome.castShadow = true;
  group.add(dome);

  // Glowing orb on top
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), GLOW_BLUE);
  orb.position.y = 5.5;
  group.add(orb);

  // Window ring
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const win = new THREE.Mesh(
      box(0.3, 0.6, 0.05, Math.cos(angle) * 1.55, 2.5, Math.sin(angle) * 1.55),
      WINDOW_MAT
    );
    win.lookAt(0, 2.5, 0);
    group.add(win);
  }

  // Door
  const door = new THREE.Mesh(box(0.7, 1.5, 0.08, 0, 0, 1.85), DOOR);
  group.add(door);

  return group;
}

/* ── Wall Segment ── */
export function createWallSegment(length: number): THREE.Group {
  const group = new THREE.Group();

  const wall = new THREE.Mesh(box(length, 2.5, 0.5), STONE);
  wall.castShadow = true;
  wall.receiveShadow = true;
  group.add(wall);

  // Crenellations
  const crenCount = Math.floor(length / 1.2);
  for (let i = 0; i < crenCount; i++) {
    const x = -length / 2 + 0.6 + i * 1.2;
    if (i % 2 === 0) {
      const cren = new THREE.Mesh(box(0.5, 0.5, 0.55, x, 2.5, 0), DARK_STONE);
      group.add(cren);
    }
  }

  return group;
}

export {
  STONE, ROOF_RED, ROOF_BLUE, WOOD, METAL, DOOR,
  WINDOW_MAT, WHITE_STONE, DARK_STONE, GLOW_BLUE, FLAG_RED,
};
