/** Side registries bridging ECS ids <-> Rapier bodies <-> Three meshes.
 * bitecs stores numbers; objects live here (standard bitecs practice). */
import type RAPIER from "@dimforge/rapier3d-compat";
import type * as THREE from "three";

export class Registry {
  readonly bodies = new Map<number, RAPIER.RigidBody>();
  readonly meshes = new Map<number, THREE.Object3D>();
  readonly colliderToEid = new Map<number, number>();

  register(eid: number, body: RAPIER.RigidBody, mesh: THREE.Object3D, collider: RAPIER.Collider): void {
    this.bodies.set(eid, body);
    this.meshes.set(eid, mesh);
    this.colliderToEid.set(collider.handle, eid);
  }

  remove(eid: number, physics: RAPIER.World, scene: THREE.Scene): void {
    const body = this.bodies.get(eid);
    if (body) {
      for (let i = 0; i < body.numColliders(); i++) {
        this.colliderToEid.delete(body.collider(i).handle);
      }
      physics.removeRigidBody(body);
    }
    const mesh = this.meshes.get(eid);
    if (mesh) scene.remove(mesh);
    this.bodies.delete(eid);
    this.meshes.delete(eid);
  }
}
