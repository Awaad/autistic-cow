/** Rescueables + children — small, low-poly, instantly lovable (that's the point). */
import * as THREE from "three";
import { PALETTE, flat } from "./palette";

export function buildDog(): THREE.Group {
  const g = new THREE.Group();
  const tan = flat(0xb98a56);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.4, 0.85), tan);
  body.position.y = 0.45;
  g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.32, 0.35), tan);
  head.position.set(0, 0.72, 0.5);
  g.add(head);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.06), flat(0x8a6238));
    ear.position.set(0.14 * s, 0.92, 0.45);
    g.add(ear);
  }
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.3, 0.07), tan);
  tail.position.set(0, 0.65, -0.45);
  tail.rotation.x = -0.6;
  g.add(tail);
  return g;
}

export function buildCat(): THREE.Group {
  const g = new THREE.Group();
  const grey = flat(0x9aa0ad);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.3, 0.65), grey);
  body.position.y = 0.35;
  g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.26, 0.26), grey);
  head.position.set(0, 0.58, 0.38);
  g.add(head);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.14, 4), grey);
    ear.position.set(0.09 * s, 0.76, 0.36);
    g.add(ear);
  }
  return g;
}

export function buildIceCreamCart(): THREE.Group {
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 0.8), flat(PALETTE.awningStripe));
  box.position.y = 0.75;
  g.add(box);
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 1.0), flat(PALETTE.awningRed));
  canopy.position.y = 1.9;
  g.add(canopy);
  for (const s of [-1, 1]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.1, 8), flat(0x2a2a2a));
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(0.5 * s, 0.28, 0);
    g.add(wheel);
  }
  return g;
}

export function buildIceCream(): THREE.Group {
  const g = new THREE.Group();
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 6), flat(0xd9a45b));
  cone.rotation.x = Math.PI; // dropped: point up, scoop on the ground. tragedy.
  cone.position.y = 0.18;
  g.add(cone);
  const scoop = new THREE.Mesh(new THREE.SphereGeometry(0.13, 6, 6), flat(0xf7c8d0));
  scoop.position.y = 0.05;
  scoop.position.z = 0.1;
  g.add(scoop);
  return g;
}

export function buildChild(): THREE.Group {
  const g = new THREE.Group();
  const shirt = flat([0xe8794a, 0x4a90d9, 0x7ac74f][Math.floor(Math.random() * 3)]);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.55, 0.28), shirt);
  body.position.y = 0.75;
  g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.3), flat(0xe8c39e));
  head.position.y = 1.2;
  g.add(head);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.45, 0.16), flat(0x3d5a80));
    leg.position.set(0.11 * s, 0.24, 0);
    g.add(leg);
  }
  return g;
}
