/** Low-poly camel. Tall. Patient. Unexplained. */
import * as THREE from "three";
import { PALETTE, flat } from "./palette";

export function buildCamelMesh(): THREE.Group {
  const g = new THREE.Group();
  const sand = flat(PALETTE.camelSand);
  const dark = flat(PALETTE.camelDark);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.2, 2.4), sand);
  torso.position.y = 1.7;
  g.add(torso);
  const hump = new THREE.Mesh(new THREE.SphereGeometry(0.62, 7, 6), dark);
  hump.position.set(0, 2.5, -0.3);
  g.add(hump);
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.5, 0.5), sand);
  neck.position.set(0, 2.8, 1.05);
  neck.rotation.x = -0.25;
  g.add(neck);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.95), sand);
  head.position.set(0, 3.55, 1.45);
  g.add(head);
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.35), dark);
  snout.position.set(0, 3.45, 1.95);
  g.add(snout);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.1), dark);
    ear.position.set(0.22 * s, 3.85, 1.25);
    g.add(ear);
    for (const fz of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.26, 1.5, 0.26), sand);
      leg.position.set(0.38 * s, 0.75, 0.85 * fz);
      g.add(leg);
      const knee = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.3), dark);
      knee.position.set(0.38 * s, 0.85, 0.85 * fz);
      g.add(knee);
    }
  }
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.8, 0.08), dark);
  tail.position.set(0, 1.9, -1.3);
  tail.rotation.x = 0.4;
  g.add(tail);
  return g;
}
