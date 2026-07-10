/** GLTF loading with procedural fallback. Callers never know which they got —
 * that indirection is the whole art pipeline. */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MANIFEST } from "./manifest";

const loader = new GLTFLoader();
const cache = new Map<string, THREE.Group>();

export async function loadModel(
  key: string,
  fallback: () => THREE.Group,
): Promise<THREE.Group> {
  const cached = cache.get(key);
  if (cached) return cached.clone(true);

  const entry = MANIFEST[key];
  if (!entry || !entry.url) {
    const built = fallback();
    cache.set(key, built);
    return built.clone(true);
  }
  try {
    const gltf = await loader.loadAsync(entry.url);
    const g = new THREE.Group();
    g.add(gltf.scene);
    if (entry.scale) g.scale.setScalar(entry.scale);
    cache.set(key, g);
    return g.clone(true);
  } catch (err) {
    console.warn(`[assets] ${key} failed to load, using fallback`, err);
    const built = fallback();
    cache.set(key, built);
    return built.clone(true);
  }
}
