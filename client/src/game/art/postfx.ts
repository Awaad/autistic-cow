/** Elevated-stylized renderer. ACES filmic tone
 * mapping is the single biggest visual win, flat colors
 * become "graded". One call in boot after renderer creation.
 * Shadows are a QUALITY TIER: real fill-rate cost on the mid-Android budget — default off
 * there, on for desktop.  */
import * as THREE from "three";

export interface ElevatedOpts {
  shadows?: boolean; // default: off on coarse pointers (mobile), on otherwise
}

export function applyElevatedRenderer(renderer: THREE.WebGLRenderer, opts?: ElevatedOpts): void {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const shadows = opts?.shadows ?? !window.matchMedia("(pointer: coarse)").matches;
  renderer.shadowMap.enabled = shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
}

/** Golden-hour rig. Pass the cell half-size so the sun's shadow camera is
 * FITTED — a DirectionalLight's default shadow box is 10x10m: without this,
 * shadows exist only in a postage stamp at the origin. */
export function goldenHourLights(scene: THREE.Scene, cellHalf = 80): void {
  scene.add(new THREE.HemisphereLight(0xbfd8ec, 0xd9b98a, 0.9));
  scene.add(new THREE.AmbientLight(0xffe6c4, 0.3));
  const sun = new THREE.DirectionalLight(0xffd9a0, 1.5);
  sun.position.set(-70, 45, 30);
  sun.castShadow = true; // (a bare `sun.castShadow` once shipped: a read, not a set)
  sun.shadow.mapSize.set(2048, 2048);
  const c = sun.shadow.camera;
  c.left = -cellHalf; c.right = cellHalf; c.top = cellHalf; c.bottom = -cellHalf;
  c.near = 1; c.far = 400;
  sun.shadow.bias = -0.0015;
  scene.add(sun);
}

