/** Low-poly cow. She deserved better than a capsule. */
import * as THREE from "three";
import { PALETTE, flat } from "./palette";

export function buildCowMesh(): THREE.Group {
  const g = new THREE.Group();
  const white = flat(PALETTE.cowWhite);
  const patch = flat(PALETTE.cowPatch);
  const pink = flat(PALETTE.cowPink);

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.1, 2.2), white);
  body.position.y = 1.05;
  g.add(body);

  // patches: offset slabs, the low-poly holstein look
  for (const [x, y, z, w, h, d] of [
    [0.45, 1.25, 0.5, 0.5, 0.5, 0.7],
    [-0.4, 0.95, -0.6, 0.55, 0.6, 0.6],
  ] as const) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), patch);
    p.position.set(x, y, z);
    p.scale.multiplyScalar(1.02);
    g.add(p);
  }

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.65, 0.75), white);
  head.position.set(0, 1.55, 1.35);
  g.add(head);
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.3), pink);
  snout.position.set(0, 1.4, 1.75);
  g.add(snout);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 0.2), patch);
    ear.position.set(0.45 * s, 1.75, 1.25);
    ear.rotation.z = 0.4 * s;
    g.add(ear);
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.28, 5), flat(0xe8dcc8));
    horn.position.set(0.22 * s, 1.95, 1.3);
    horn.rotation.z = -0.35 * s;
    g.add(horn);
    for (const fz of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.7, 0.28), white);
      leg.position.set(0.42 * s, 0.35, 0.75 * fz);
      g.add(leg);
      const hoof = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.3), patch);
      hoof.position.set(0.42 * s, 0.07, 0.75 * fz);
      g.add(hoof);
    }
  }
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.7, 0.1), white);
  tail.position.set(0, 1.2, -1.2);
  tail.rotation.x = 0.5;
  g.add(tail);
  return g;
}
