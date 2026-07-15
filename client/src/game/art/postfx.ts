/** Elevated-stylized renderer. ACES filmic tone
 * mapping is the single biggest visual win, flat colors
 * become "graded". One call in boot after renderer creation. */
import * as THREE from "three";

export function applyElevatedRenderer(renderer: THREE.WebGLRenderer): void {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
}

/** Golden-hour rig: long warm key, cool sky fill, lifted shadows. */
export function goldenHourLights(scene: THREE.Scene): void {
  scene.add(new THREE.HemisphereLight(0xbfd8ec, 0xd9b98a, 0.9));
  scene.add(new THREE.AmbientLight(0xffe6c4, 0.3));
  const sun = new THREE.DirectionalLight(0xffd9a0, 1.5);
  sun.position.set(-70, 45, 30);
  
  scene.add(sun);
}
