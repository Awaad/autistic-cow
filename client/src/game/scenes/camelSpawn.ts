/** Grey-box camel: kinematic body (pushes dynamics -> the Lure works),
 * tall sand-colored silhouette on the horizon. */
import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import { addEntity, type IWorld } from "bitecs";
import { CollisionGroups } from "../physics/layers";
import type { Physics } from "../physics/world";
import type { Registry } from "../ecs/registry";

export function spawnCamelEntity(
  physics: Physics,
  ecs: IWorld,
  reg: Registry,
  scene: THREE.Scene,
  x: number,
  z: number,
): { eid: number; body: RAPIER.RigidBody } {
  const { world, R } = physics;
  const eid = addEntity(ecs);

  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xc2a56b });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, 2.6), mat);
  torso.position.y = 1.6;
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.6, 0.5), mat);
  neck.position.set(0, 2.8, 1.2);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 1.0), mat);
  head.position.set(0, 3.6, 1.5);
  const hump = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 8), mat);
  hump.position.set(0, 2.5, -0.4);
  group.add(torso, neck, head, hump);
  scene.add(group);

  const body = world.createRigidBody(
    R.RigidBodyDesc.kinematicPositionBased().setTranslation(x, 0, z),
  );
  const collider = world.createCollider(
    R.ColliderDesc.cuboid(0.7, 1.6, 1.4)
      .setTranslation(0, 1.6, 0)
      .setCollisionGroups(CollisionGroups.camel)
      .setActiveEvents(R.ActiveEvents.COLLISION_EVENTS),
    body,
  );
  reg.register(eid, body, group, collider);
  return { eid, body };
}
