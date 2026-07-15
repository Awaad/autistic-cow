/** Facade detailing for generated buildings — doors, windows, shopfronts —
 * as INSTANCED meshes: ~3 draw calls for the whole city (perf budget).
 * Deterministic per building. Visual only: no colliders. */
import * as THREE from "three";
import { PALETTE } from "./palette";

interface GenBuilding { poly: number[][]; h: number; wall: string; roof: string }

const FLOOR_H = 2.9;
const WIN_SPACING = 2.2;
const MAX_WINDOWS = 3500;

function rng(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function addFacades(scene: THREE.Scene, buildings: GenBuilding[], seed = 1337): void {
  const windows: THREE.Matrix4[] = [];
  const winColors: THREE.Color[] = [];
  const doors: THREE.Matrix4[] = [];
  const awnings: THREE.Matrix4[] = [];
  const awnColors: THREE.Color[] = [];

  const cobalt = new THREE.Color(PALETTE.shutterCobalt);
  const teal = new THREE.Color(PALETTE.shutterTeal);
  const awnRed = new THREE.Color(PALETTE.awningRed);
  const awnStripe = new THREE.Color(PALETTE.awningStripe);

  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scl = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);

  for (const b of buildings) {
    const poly = b.poly;
    if (poly.length < 3) continue;
    const r = rng(seed ^ (Math.round(poly[0][0] * 7) * 31 + Math.round(poly[0][1] * 13)));
    const shutter = r() > 0.5 ? cobalt : teal;

    let cx = 0;
    let cz = 0;
    for (const [x, z] of poly) { cx += x; cz += z; }
    cx /= poly.length;
    cz /= poly.length;

    let doorEdge = 0;
    let bestLen = 0;
    for (let i = 0; i < poly.length; i++) {
      const [x0, z0] = poly[i];
      const [x1, z1] = poly[(i + 1) % poly.length];
      const l = Math.hypot(x1 - x0, z1 - z0);
      if (l > bestLen) { bestLen = l; doorEdge = i; }
    }

    const floors = Math.max(1, Math.floor((b.h - 0.6) / FLOOR_H));

    for (let i = 0; i < poly.length; i++) {
      const [x0, z0] = poly[i];
      const [x1, z1] = poly[(i + 1) % poly.length];
      const dx = x1 - x0;
      const dz = z1 - z0;
      const len = Math.hypot(dx, dz);
      if (len < 2.4) continue;

      let nx = dz / len;
      let nz = -dx / len;
      const mx = (x0 + x1) / 2;
      const mz = (z0 + z1) / 2;
      if (nx * (mx - cx) + nz * (mz - cz) < 0) { nx = -nx; nz = -nz; }
      quat.setFromAxisAngle(UP, Math.atan2(nx, nz));

      const isDoorEdge = i === doorEdge;
      const at = (t: number, y: number, out: number): THREE.Vector3 =>
        pos.set(x0 + dx * t + nx * out, y, z0 + dz * t + nz * out);

      if (isDoorEdge) {
        doors.push(new THREE.Matrix4().compose(
          at(0.5, 1.1, 0.1).clone(), quat.clone(), scl.set(1.1, 2.2, 0.16).clone(),
        ));
        if (len >= 6 && b.h >= 3) {
          const aw = Math.min(4.2, len * 0.55);
          awnings.push(new THREE.Matrix4().compose(
            at(0.5, 2.5, 0.55).clone(), quat.clone(), scl.set(aw, 0.12, 1.15).clone(),
          ));
          awnColors.push(r() > 0.4 ? awnRed : awnStripe);
        }
      }

      const count = Math.floor((len - 1.4) / WIN_SPACING);
      if (count < 1) continue;
      for (let f = 0; f < floors; f++) {
        if (f === 0 && isDoorEdge) continue;
        const y = 1.7 + f * FLOOR_H;
        if (y > b.h - 0.7) break;
        for (let w = 0; w < count; w++) {
          if (windows.length >= MAX_WINDOWS) break;
          const t = (w + 1) / (count + 1);
          windows.push(new THREE.Matrix4().compose(
            at(t, y, 0.08).clone(), quat.clone(), scl.set(0.9, 1.15, 0.12).clone(),
          ));
          winColors.push(shutter);
        }
      }
    }
  }

  const unit = new THREE.BoxGeometry(1, 1, 1);
  const mk = (mats: THREE.Matrix4[], colors: THREE.Color[] | null, baseColor: number): void => {
    if (mats.length === 0) return;
    const mat = new THREE.MeshStandardMaterial({ color: baseColor, flatShading: true, roughness: 0.9 });
    const m = new THREE.InstancedMesh(unit, mat, mats.length);
    for (let i = 0; i < mats.length; i++) {
      m.setMatrixAt(i, mats[i]);
      if (colors) m.setColorAt(i, colors[i]);
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    scene.add(m);
  };

  mk(windows, winColors, 0xffffff);
  mk(doors, null, PALETTE.doorGreen);
  mk(awnings, awnColors, 0xffffff);
  console.info(`[facades] windows=${windows.length} doors=${doors.length} awnings=${awnings.length} drawCalls=+3`);
}
