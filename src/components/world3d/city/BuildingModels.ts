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

export function createArcheryRange(): THREE.Group {
  const group = new THREE.Group();
  const hall = new THREE.Mesh(box(6, 2.4, 3.2), WHITE_STONE);
  const roof = new THREE.Mesh(box(6.5, 0.35, 3.7, 0, 2.4), ROOF_BLUE);
  hall.castShadow = true;
  roof.castShadow = true;
  group.add(hall, roof);
  for (const x of [-2.2, 0, 2.2]) {
    const target = new THREE.Mesh(
      new THREE.CylinderGeometry(0.65, 0.65, 0.16, 12),
      new THREE.MeshStandardMaterial({ color: 0xc98d43, roughness: 0.8 }),
    );
    target.rotation.x = Math.PI / 2;
    target.position.set(x, 1.15, -3.4);
    group.add(target);
    const center = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 0.18, 8),
      new THREE.MeshStandardMaterial({ color: 0x9b2820 }),
    );
    center.rotation.x = Math.PI / 2;
    center.position.set(x, 1.15, -3.52);
    group.add(center);
  }
  for (const x of [-2.4, 2.4]) {
    group.add(new THREE.Mesh(box(0.12, 1.8, 0.12, x, 0.4, 1.7), WOOD));
  }
  return group;
}

export function createStable(): THREE.Group {
  const group = new THREE.Group();
  const body = new THREE.Mesh(box(6.5, 2.6, 4.2), WOOD);
  const roofGeo = new THREE.ConeGeometry(4.2, 2.1, 4);
  roofGeo.rotateY(Math.PI / 4);
  roofGeo.translate(0, 3.65, 0);
  const roof = new THREE.Mesh(roofGeo, ROOF_RED);
  body.castShadow = true;
  body.receiveShadow = true;
  roof.castShadow = true;
  group.add(body, roof);
  for (const x of [-2.1, 0, 2.1]) {
    group.add(new THREE.Mesh(box(0.13, 2.1, 0.13, x, 0, 2.12), DARK_STONE));
  }
  group.add(new THREE.Mesh(box(3.2, 0.18, 0.16, 0, 1.1, 2.2), WOOD));
  for (const x of [-1.4, 1.4]) {
    group.add(new THREE.Mesh(box(0.65, 1.1, 0.08, x, 0, 2.22), DOOR));
  }
  return group;
}

export function createSiegeWorkshop(): THREE.Group {
  const group = new THREE.Group();
  const body = new THREE.Mesh(box(6.8, 2.5, 4.5), DARK_STONE);
  const roof = new THREE.Mesh(box(7.2, 0.35, 4.9, 0, 2.5), ROOF_RED);
  body.castShadow = true;
  roof.castShadow = true;
  group.add(body, roof);
  for (const x of [-2.5, 2.5]) {
    const wheel = new THREE.Mesh(
      new THREE.TorusGeometry(0.85, 0.12, 6, 12),
      WOOD,
    );
    wheel.position.set(x, 0.95, 2.35);
    group.add(wheel);
    group.add(new THREE.Mesh(cyl(0.12, 0.12, 0.25, x, 0.85, 2.35), METAL));
  }
  group.add(new THREE.Mesh(box(0.2, 2.1, 0.2, 0, 0.4, -2.35), WOOD));
  group.add(new THREE.Mesh(box(0.16, 0.16, 4.4, 0, 2.35, -0.1), WOOD));
  return group;
}

export function createIronMine(): THREE.Group {
  const group = new THREE.Group();
  const entrance = new THREE.Mesh(box(4.4, 3.8, 0.6), DARK_STONE);
  entrance.castShadow = true;
  group.add(entrance);
  group.add(new THREE.Mesh(box(2.2, 2.6, 0.18, 0, 0, 0.38), DOOR));
  for (const x of [-2.5, 2.5]) {
    const support = new THREE.Mesh(box(0.22, 3.5, 0.24, x, 0, 0.15), WOOD);
    support.castShadow = true;
    group.add(support);
  }
  const beam = new THREE.Mesh(box(5.2, 0.3, 0.28, 0, 3.35, 0.15), WOOD);
  group.add(beam);
  for (let i = 0; i < 4; i++) {
    const ore = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.5 + (i % 2) * 0.15, 0),
      new THREE.MeshStandardMaterial({ color: 0x62656a, metalness: 0.6, roughness: 0.38 }),
    );
    ore.position.set(-2.2 + i * 1.45, 0.35, 1.25);
    ore.scale.y = 0.7;
    group.add(ore);
  }
  return group;
}

export function createFarm(): THREE.Group {
  const group = new THREE.Group();
  for (let row = 0; row < 5; row++) {
    const cropRow = new THREE.Mesh(
      new THREE.BoxGeometry(5.5, 0.08, 0.35),
      new THREE.MeshStandardMaterial({ color: row % 2 ? 0x9c9b3b : 0x727d2f, roughness: 0.95 }),
    );
    cropRow.position.set(0, 0.15 + (row % 2) * 0.06, -2 + row);
    group.add(cropRow);
  }
  const windmill = new THREE.Mesh(box(0.5, 3.5, 0.5, -2.5, 0, -3.4), WHITE_STONE);
  windmill.castShadow = true;
  group.add(windmill);
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.23, 8, 6), METAL);
  hub.position.set(-2.25, 3.1, -3.4);
  group.add(hub);
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Mesh(box(0.18, 2.1, 0.12, -2.25, 3.1, -3.4), WOOD);
    blade.rotation.z = i * Math.PI / 2;
    group.add(blade);
  }
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

/* ── Scout Camp (Trại trinh sát) ── */
export function createScoutCamp(level = 1): THREE.Group {
  const group = new THREE.Group();
  const cappedLevel = Math.max(1, Math.min(3, Math.round(level)));
  const towerH = 4.2 + cappedLevel * 1.0;
  const towerX = 1.3;
  const towerZ = 0.2;

  // 1. Observation Tower Stilts (4 wooden posts)
  const legOffset = 0.9;
  const legRadius = 0.12;
  const corners = [
    [-legOffset, -legOffset],
    [legOffset, -legOffset],
    [-legOffset, legOffset],
    [legOffset, legOffset],
  ] as const;

  for (const [dx, dz] of corners) {
    const stilt = new THREE.Mesh(cyl(legRadius * 0.8, legRadius, towerH, towerX + dx, 0, towerZ + dz, 6), WOOD);
    stilt.castShadow = true;
    group.add(stilt);
  }

  // Cross braces for tower
  for (let h = 1.2; h < towerH; h += 1.6) {
    const beam1 = new THREE.Mesh(box(legOffset * 2, 0.1, 0.1, towerX, h, towerZ - legOffset), WOOD);
    const beam2 = new THREE.Mesh(box(legOffset * 2, 0.1, 0.1, towerX, h, towerZ + legOffset), WOOD);
    const beam3 = new THREE.Mesh(box(0.1, 0.1, legOffset * 2, towerX - legOffset, h, towerZ), WOOD);
    const beam4 = new THREE.Mesh(box(0.1, 0.1, legOffset * 2, towerX + legOffset, h, towerZ), WOOD);
    group.add(beam1, beam2, beam3, beam4);
  }

  // Ladder
  const ladderZ = towerZ - legOffset - 0.05;
  for (let y = 0.3; y < towerH; y += 0.45) {
    const rung = new THREE.Mesh(box(0.5, 0.05, 0.05, towerX, y, ladderZ), WOOD);
    group.add(rung);
  }

  // Observation Platform
  const platform = new THREE.Mesh(box(2.2, 0.2, 2.2, towerX, towerH, towerZ), WOOD);
  platform.castShadow = true;
  group.add(platform);

  // Platform Railing
  const railH = 0.8;
  const railPosts = [
    [-1.0, -1.0], [1.0, -1.0], [-1.0, 1.0], [1.0, 1.0],
    [0, 1.0], [-1.0, 0], [1.0, 0],
  ] as const;
  for (const [px, pz] of railPosts) {
    const post = new THREE.Mesh(box(0.08, railH, 0.08, towerX + px, towerH + 0.2, towerZ + pz), WOOD);
    group.add(post);
  }
  const topRail1 = new THREE.Mesh(box(2.1, 0.06, 0.06, towerX, towerH + 0.2 + railH, towerZ + 1.0), WOOD);
  const topRail2 = new THREE.Mesh(box(0.06, 0.06, 2.1, towerX - 1.0, towerH + 0.2 + railH, towerZ), WOOD);
  const topRail3 = new THREE.Mesh(box(0.06, 0.06, 2.1, towerX + 1.0, towerH + 0.2 + railH, towerZ), WOOD);
  group.add(topRail1, topRail2, topRail3);

  // Tower Roof (Canopy)
  const roofPillars = [
    [-0.95, -0.95], [0.95, -0.95], [-0.95, 0.95], [0.95, 0.95],
  ] as const;
  for (const [rx, rz] of roofPillars) {
    const rPost = new THREE.Mesh(cyl(0.06, 0.06, 1.6, towerX + rx, towerH + 0.2, towerZ + rz, 4), WOOD);
    group.add(rPost);
  }
  const towerRoof = new THREE.Mesh(cone(1.7, 1.2, towerX, towerH + 1.8, towerZ, 6), ROOF_BLUE);
  towerRoof.castShadow = true;
  group.add(towerRoof);

  // Lookout Pennant / Flag
  const flagpole = new THREE.Mesh(cyl(0.04, 0.04, 1.3, towerX, towerH + 2.8, towerZ, 4), METAL);
  const flag = new THREE.Mesh(box(0.6, 0.35, 0.02, towerX + 0.3, towerH + 3.2, towerZ), FLAG_RED);
  group.add(flagpole, flag);

  // 2. Scout Canvas Tent(s)
  const tentMat = WHITE_STONE;
  const mainTent = new THREE.Mesh(cone(1.5, 2.2, -1.4, 0, 0.6, 5), tentMat);
  mainTent.castShadow = true;
  group.add(mainTent);

  // Tent entrance flaps
  const flapMesh = new THREE.Mesh(box(0.4, 1.0, 0.05, -1.4, 0, 1.6), DOOR);
  group.add(flapMesh);

  if (cappedLevel >= 2) {
    // Auxiliary scout tent
    const auxTent = new THREE.Mesh(cone(1.1, 1.6, -1.7, 0, -1.3, 5), tentMat);
    auxTent.castShadow = true;
    group.add(auxTent);
  }

  // 3. Reconnaissance Map Desk
  const deskMat = WOOD;
  const deskX = -0.1;
  const deskZ = -1.2;
  const deskTop = new THREE.Mesh(box(1.1, 0.08, 0.7, deskX, 0.75, deskZ), deskMat);
  deskTop.castShadow = true;
  group.add(deskTop);
  for (const [dx, dz] of [[-0.45, -0.25], [0.45, -0.25], [-0.45, 0.25], [0.45, 0.25]]) {
    const leg = new THREE.Mesh(cyl(0.04, 0.04, 0.75, deskX + dx, 0, deskZ + dz, 4), deskMat);
    group.add(leg);
  }
  // Parchment map on desk
  const mapPaper = new THREE.Mesh(box(0.7, 0.03, 0.45, deskX, 0.81, deskZ), WINDOW_MAT);
  group.add(mapPaper);
  // Spyglass / Compass
  const spyglass = new THREE.Mesh(cyl(0.04, 0.06, 0.35, deskX + 0.2, 0.85, deskZ - 0.1, 6), METAL);
  spyglass.rotation.z = Math.PI / 3;
  group.add(spyglass);

  // 4. Campfire & Lantern
  const firePitMat = DARK_STONE;
  const fireX = -0.3;
  const fireZ = 1.3;
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const stone = new THREE.Mesh(
      box(0.2, 0.15, 0.2, fireX + Math.cos(angle) * 0.45, 0, fireZ + Math.sin(angle) * 0.45),
      firePitMat,
    );
    group.add(stone);
  }
  const emberMat = new THREE.MeshStandardMaterial({
    color: 0xff5500,
    emissive: 0xff3300,
    emissiveIntensity: 0.9,
    roughness: 0.4,
  });
  const fireFlame = new THREE.Mesh(cone(0.25, 0.5, fireX, 0.1, fireZ, 5), emberMat);
  group.add(fireFlame);

  // 5. Level 3 Extras: Fortified timber perimeter & Archery target dummy
  if (cappedLevel >= 3) {
    // Training Target Dummy
    const targetPole = new THREE.Mesh(cyl(0.06, 0.06, 1.4, -2.2, 0, 0.8, 6), WOOD);
    const targetStraw = new THREE.Mesh(cyl(0.35, 0.35, 0.15, -2.2, 1.0, 0.8, 8), WINDOW_MAT);
    targetStraw.rotation.x = Math.PI / 2;
    const targetBullseye = new THREE.Mesh(cyl(0.12, 0.12, 0.16, -2.2, 1.0, 0.8, 8), FLAG_RED);
    targetBullseye.rotation.x = Math.PI / 2;
    group.add(targetPole, targetStraw, targetBullseye);

    // Perimeter wooden stakes
    const stakeMat = WOOD;
    const stakes = [
      [-2.4, -0.6], [-2.4, -1.2], [-2.4, -1.8],
      [0.6, -2.2], [1.3, -2.2], [2.0, -2.2],
    ] as const;
    for (const [sx, sz] of stakes) {
      const stake = new THREE.Mesh(cone(0.12, 1.2, sx, 0, sz, 4), stakeMat);
      stake.castShadow = true;
      group.add(stake);
    }
  }

  return group;
}

export {
  STONE, ROOF_RED, ROOF_BLUE, WOOD, METAL, DOOR,
  WINDOW_MAT, WHITE_STONE, DARK_STONE, GLOW_BLUE, FLAG_RED,
};
