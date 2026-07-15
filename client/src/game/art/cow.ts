/** Low-poly cow. She deserved better than a capsule. heavier stance, expressive head, umber patches.
 * She is the protagonist: bulk reads unstoppable, the slight head-droop
 * reads tragic. */
import * as THREE from "three";
import { PALETTE, flat } from "./palette";

export function buildCowMesh(): THREE.Group {
  const g = new THREE.Group();
  const hide = flat(PALETTE.cowHide);
  const patch = flat(PALETTE.cowPatch);
  const hoof = flat(PALETTE.hoof);

  const barrel = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.0, 1.9), hide);
  barrel.position.y = 1.0;
  g.add(barrel);
  const haunch = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.85, 0.8), hide);
  haunch.position.set(0, 1.08, -0.65);
  g.add(haunch);

  for (const [x, y, z, w, h, d] of [
    [0.35, 1.25, 0.3, 0.5, 0.55, 0.7], [-0.42, 0.95, -0.55, 0.45, 0.5, 0.6],
    [0.1, 1.4, -0.2, 0.6, 0.25, 0.5],
  ] as const) {
    const pm = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), patch);
    pm.position.set(x, y, z);
    g.add(pm);
  }

  const head = new THREE.Group();
  head.add(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.6, 0.7), hide));
  const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.34, 0.3), flat(PALETTE.cowMuzzle));
  muzzle.position.set(0, -0.14, 0.45);
  head.add(muzzle);
  for (const sgn of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.05), hoof);
    eye.position.set(0.2 * sgn, 0.12, 0.36);
    head.add(eye);
    const ear = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.16), hide);
    ear.position.set(0.42 * sgn, 0.18, -0.05);
    ear.rotation.z = 0.35 * sgn;
    head.add(ear);
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.3, 5), flat(0xd8cfc0));
    horn.position.set(0.24 * sgn, 0.38, 0.02);
    horn.rotation.z = -0.5 * sgn;
    head.add(horn);
  }
  head.position.set(0, 1.55, 1.15);
  head.rotation.x = 0.14;
  g.add(head);

  for (const [sx, sz] of [[-0.38, 0.62], [0.38, 0.62], [-0.42, -0.72], [0.42, -0.72]] as const) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.62, 0.28), hide);
    leg.position.set(sx, 0.31, sz);
    g.add(leg);
    const hf = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.3), hoof);
    hf.position.set(sx, 0.07, sz);
    g.add(hf);
  }

  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.75, 0.09), hide);
  tail.position.set(0, 1.15, -1.1);
  tail.rotation.x = 0.35;
  g.add(tail);
  const tuft = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.14), patch);
  tuft.position.set(0, 0.78, -1.24);
  g.add(tuft);

  return g;
}
