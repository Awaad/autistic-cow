/** Street furniture (real-placed smashables) + backdrop signage.
 * Same low-poly flat-shaded language as critters.ts (ADR-014). These render the
 * generated district's `smashables` and `backdrop` layers. Signage is the
 * recognisability layer — real names on the unsmashable backdrop (ADR-018). */
import * as THREE from "three";
import { PALETTE, flat } from "./palette";

// --- smashable street furniture -------------------------------------------

export function buildBench(): THREE.Group {
  const g = new THREE.Group();
  const wood = flat(PALETTE.stall);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 0.4), wood);
  seat.position.y = 0.45;
  g.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.38, 0.08), wood);
  back.position.set(0, 0.68, -0.16);
  g.add(back);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.45, 0.4), flat(0x555555));
    leg.position.set(0.5 * s, 0.22, 0);
    g.add(leg);
  }
  return g;
}

export function buildBin(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.6, 8), flat(PALETTE.shutterTeal));
  body.position.y = 0.35;
  g.add(body);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 6, 10), flat(0x2a2a2a));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.66;
  g.add(rim);
  return g;
}

export function buildPostBox(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.0, 0.4), flat(PALETTE.awningRed));
  body.position.y = 0.6;
  g.add(body);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.4, 8, 1, false, 0, Math.PI), flat(PALETTE.awningRed));
  roof.rotation.z = Math.PI / 2;
  roof.position.y = 1.1;
  g.add(roof);
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.02), flat(0x1a1a1a));
  slot.position.set(0, 0.85, 0.21);
  g.add(slot);
  return g;
}

export function buildFountain(): THREE.Group {
  const g = new THREE.Group();
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.1, 0.5, 12), flat(PALETTE.ground));
  basin.position.y = 0.25;
  g.add(basin);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.1, 12), flat(PALETTE.sea));
  water.position.y = 0.48;
  g.add(water);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.9, 8), flat(PALETTE.ground));
  spout.position.y = 0.9;
  g.add(spout);
  return g;
}

export function buildBollard(): THREE.Group {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.8, 8), flat(PALETTE.shutterCobalt));
  post.position.y = 0.4;
  g.add(post);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), flat(PALETTE.shutterCobalt));
  cap.position.y = 0.8;
  g.add(cap);
  return g;
}

export function buildPlanter(): THREE.Group {
  const g = new THREE.Group();
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.3, 0.5, 8), flat(PALETTE.crate));
  pot.position.y = 0.25;
  g.add(pot);
  const bush = new THREE.Mesh(new THREE.SphereGeometry(0.4, 6, 5), flat(PALETTE.palmFrond));
  bush.position.y = 0.7;
  g.add(bush);
  return g;
}

/** half-extents [hx, hy, hz] for the physics box, per prop kind. */
export const PROP_HALF: Record<string, [number, number, number]> = {
  bench: [0.6, 0.3, 0.25],
  bin: [0.22, 0.35, 0.22],
  post_box: [0.22, 0.6, 0.22],
  fountain: [1.0, 0.5, 1.0],
  bollard: [0.12, 0.4, 0.12],
  planter: [0.4, 0.35, 0.4],
};

const BUILDERS: Record<string, () => THREE.Group> = {
  bench: buildBench, bin: buildBin, post_box: buildPostBox,
  fountain: buildFountain, bollard: buildBollard, planter: buildPlanter,
};

/** dispatch by kind; unknown kinds fall back to a crate-sized box. */
export function buildProp(kind: string): THREE.Group {
  const b = BUILDERS[kind];
  if (b) return b();
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), flat(PALETTE.crate)));
  return g;
}

export function propHalf(kind: string): [number, number, number] {
  return PROP_HALF[kind] ?? [0.3, 0.3, 0.3];
}

// --- backdrop signage (recognisability; visual only, no collider) ---------

function makeLabel(text: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "rgba(245,240,232,0.92)";
  ctx.fillRect(0, 0, 256, 64);
  ctx.strokeStyle = "#3a3a42";
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 252, 60);
  ctx.fillStyle = "#3a3a42";
  ctx.font = "bold 26px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text.slice(0, 20), 128, 34);
  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  sprite.scale.set(3.2, 0.8, 1);
  return sprite;
}

/** A named sign post on the backdrop layer. Cheap (one sprite), never a collider. */
export function buildSign(name: string, x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6), flat(PALETTE.palmTrunk));
  post.position.y = 1.2;
  g.add(post);
  const label = makeLabel(name);
  label.position.y = 2.7;
  g.add(label);
  g.position.set(x, 0, z);
  return g;
}
