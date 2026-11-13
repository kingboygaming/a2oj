/* ── Procedural army unit geometry generators ── */
import * as THREE from "three";

const ARMOR_MAT = new THREE.MeshStandardMaterial({ color: 0x708090, roughness: 0.4, metalness: 0.6 });
const SKIN_MAT = new THREE.MeshStandardMaterial({ color: 0xd4a574, roughness: 0.8 });
const SHIELD_MAT = new THREE.MeshStandardMaterial({ color: 0x8b0000, roughness: 0.6, metalness: 0.2 });
const SWORD_MAT = new THREE.MeshStandardMaterial({ color: 0xc0c0c0, roughness: 0.2, metalness: 0.8 });
const HORSE_MAT = new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.85 });
const BOW_MAT = new THREE.MeshStandardMaterial({ color: 0x654321, roughness: 0.8 });
const SIEGE_WOOD = new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.9 });
const CAPE_BLUE = new THREE.MeshStandardMaterial({ color: 0x1a3a6a, roughness: 0.7, side: THREE.DoubleSide });

function cyl(rT: number, rB: number, h: number, segs = 6): THREE.CylinderGeometry {
  return new THREE.CylinderGeometry(rT, rB, h, segs);
}

/* ── Infantry — soldier with shield and sword ── */
export function createInfantry(): THREE.Group {
  const group = new THREE.Group();

  // Body (torso)
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.5, 0.2), ARMOR_MAT);
  torso.position.y = 0.75;
  torso.castShadow = true;
  group.add(torso);

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), SKIN_MAT);
  head.position.y = 1.15;
  group.add(head);

  // Helmet
  const helmet = new THREE.Mesh(cyl(0.13, 0.14, 0.1, 6), ARMOR_MAT);
  helmet.position.y = 1.25;
  group.add(helmet);

  // Legs
  for (const xOff of [-0.08, 0.08]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.45, 0.12), ARMOR_MAT);
    leg.position.set(xOff, 0.25, 0);
    group.add(leg);
  }

  // Shield (left hand)
  const shield = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.35, 0.28), SHIELD_MAT);
  shield.position.set(-0.25, 0.8, 0);
  shield.castShadow = true;
  group.add(shield);

  // Sword (right hand)
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.4, 0.04), SWORD_MAT);
  blade.position.set(0.25, 0.9, 0);
  group.add(blade);
  const hilt = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.12), HORSE_MAT);
  hilt.position.set(0.25, 0.68, 0);
  group.add(hilt);

  return group;
}

/* ── Cavalry — rider on horse ── */
export function createCavalry(): THREE.Group {
  const group = new THREE.Group();

  // Horse body
  const horseBody = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.35, 0.7), HORSE_MAT);
  horseBody.position.set(0, 0.5, 0);
  horseBody.castShadow = true;
  group.add(horseBody);

  // Horse head
  const horseHead = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.2, 0.25), HORSE_MAT);
  horseHead.position.set(0, 0.65, 0.4);
  horseHead.rotation.x = -0.3;
  group.add(horseHead);

  // Horse legs (4)
  for (const [x, z] of [[-0.12, 0.2], [0.12, 0.2], [-0.12, -0.2], [0.12, -0.2]] as const) {
    const leg = new THREE.Mesh(cyl(0.04, 0.04, 0.35, 4), HORSE_MAT);
    leg.position.set(x, 0.17, z);
    group.add(leg);
  }

  // Horse tail
  const tail = new THREE.Mesh(cyl(0.02, 0.05, 0.25, 4), HORSE_MAT);
  tail.position.set(0, 0.55, -0.45);
  tail.rotation.x = 0.5;
  group.add(tail);

  // Rider torso
  const rider = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.35, 0.16), ARMOR_MAT);
  rider.position.set(0, 0.95, 0);
  rider.castShadow = true;
  group.add(rider);

  // Rider head
  const riderHead = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4), SKIN_MAT);
  riderHead.position.y = 1.22;
  group.add(riderHead);

  // Rider helmet
  const riderHelmet = new THREE.Mesh(cyl(0.11, 0.12, 0.08, 6), ARMOR_MAT);
  riderHelmet.position.y = 1.3;
  group.add(riderHelmet);

  // Spear
  const spear = new THREE.Mesh(cyl(0.02, 0.02, 1.2, 4), BOW_MAT);
  spear.position.set(0.22, 1.1, 0);
  spear.rotation.z = -0.15;
  group.add(spear);
  const spearTip = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 4), SWORD_MAT);
  spearTip.position.set(0.22 - 0.15 * 0.6, 1.7, 0);
  group.add(spearTip);

  return group;
}

/* ── Archer — soldier with bow ── */
export function createArcher(): THREE.Group {
  const group = new THREE.Group();

  // Body
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.45, 0.18), new THREE.MeshStandardMaterial({ color: 0x2a5a2a, roughness: 0.8 }));
  torso.position.y = 0.72;
  torso.castShadow = true;
  group.add(torso);

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 6, 4), SKIN_MAT);
  head.position.y = 1.08;
  group.add(head);

  // Hood
  const hood = new THREE.Mesh(cyl(0.08, 0.14, 0.12, 6), new THREE.MeshStandardMaterial({ color: 0x1a3a1a, roughness: 0.85 }));
  hood.position.y = 1.18;
  group.add(hood);

  // Legs
  for (const xOff of [-0.07, 0.07]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.4, 0.1), new THREE.MeshStandardMaterial({ color: 0x3a3a2a, roughness: 0.85 }));
    leg.position.set(xOff, 0.22, 0);
    group.add(leg);
  }

  // Bow (left)
  const bowCurve = new THREE.TorusGeometry(0.2, 0.015, 4, 8, Math.PI);
  const bow = new THREE.Mesh(bowCurve, BOW_MAT);
  bow.position.set(-0.25, 0.85, 0);
  bow.rotation.z = Math.PI / 2;
  group.add(bow);

  // Quiver (back)
  const quiver = new THREE.Mesh(cyl(0.05, 0.06, 0.35, 6), BOW_MAT);
  quiver.position.set(0.05, 0.85, -0.15);
  quiver.rotation.x = 0.15;
  group.add(quiver);

  // Arrow tips sticking out
  for (let i = 0; i < 3; i++) {
    const arrow = new THREE.Mesh(cyl(0.008, 0.008, 0.15, 3), SWORD_MAT);
    arrow.position.set(0.05 + (i - 1) * 0.02, 1.1, -0.15);
    group.add(arrow);
  }

  // Cape
  const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.4), CAPE_BLUE);
  cape.position.set(0, 0.7, -0.12);
  group.add(cape);

  return group;
}

/* ── Siege unit — catapult / battering ram ── */
export function createSiege(): THREE.Group {
  const group = new THREE.Group();

  // Base frame
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.15, 1.2), SIEGE_WOOD);
  frame.position.y = 0.25;
  frame.castShadow = true;
  group.add(frame);

  // Wheels (4)
  for (const [x, z] of [[-0.35, 0.4], [0.35, 0.4], [-0.35, -0.4], [0.35, -0.4]] as const) {
    const wheel = new THREE.Mesh(cyl(0.15, 0.15, 0.05, 8), HORSE_MAT);
    wheel.position.set(x, 0.15, z);
    wheel.rotation.z = Math.PI / 2;
    group.add(wheel);
  }

  // Catapult arm
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1.0), SIEGE_WOOD);
  arm.position.set(0, 0.55, 0.2);
  arm.rotation.x = -0.4;
  arm.castShadow = true;
  group.add(arm);

  // Arm pivot support
  const pivotL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, 0.06), SIEGE_WOOD);
  pivotL.position.set(-0.15, 0.4, 0);
  group.add(pivotL);
  const pivotR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, 0.06), SIEGE_WOOD);
  pivotR.position.set(0.15, 0.4, 0);
  group.add(pivotR);

  // Boulder basket
  const basket = new THREE.Mesh(new THREE.SphereGeometry(0.1, 4, 4), new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.95 }));
  basket.position.set(0, 0.7, 0.65);
  group.add(basket);

  return group;
}

export { ARMOR_MAT, SKIN_MAT, SHIELD_MAT, SWORD_MAT, HORSE_MAT, BOW_MAT, SIEGE_WOOD };
