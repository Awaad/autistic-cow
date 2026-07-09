/** Grey-box district: ground + spawned entities from a deterministic layout.
 * If the loop isn't fun here, art won't save it. but it is. */
import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import { addComponent, addEntity, type IWorld } from "bitecs";
import { CollisionGroups } from "../physics/layers";
import type { Physics } from "../physics/world";
import { Registry } from "../ecs/registry";
import { CowTag, Pickup, Smashable } from "../ecs/components";
import { computeSpawns, type SpawnTemplate } from "./spawn";

const COLORS = { ground: 0x232338, box: 0x8888aa, beer: 0xf5a623, wine: 0x9013fe, cow: 0xe8e8f0 };

export interface SceneHandles {
  scene: THREE.Scene;
  cowEid: number;
  cowBody: RAPIER.RigidBody;
}

export function buildGreybox(
  physics: Physics,
  ecs: IWorld,
  reg: Registry,
  seed: number,
  tpl: SpawnTemplate,
): SceneHandles {
  const { world, R } = physics;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a2e);
  scene.fog = new THREE.Fog(0x1a1a2e, 60, 140);

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.position.set(30, 50, 20);
  scene.add(sun);

  // ground
  const groundMesh = new THREE.Mesh(
    new THREE.BoxGeometry(140, 1, 140),
    new THREE.MeshStandardMaterial({ color: COLORS.ground }),
  );
  groundMesh.position.y = -0.5;
  scene.add(groundMesh);
  const groundBody = world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0));
  world.createCollider(R.ColliderDesc.cuboid(70, 0.5, 70), groundBody);

  // cow (capsule)
  const cowEid = addEntity(ecs);
  addComponent(ecs, CowTag, cowEid);
  const cowMesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.7, 1.2, 8, 16),
    new THREE.MeshStandardMaterial({ color: COLORS.cow }),
  );
  cowMesh.rotation.z = Math.PI / 2; // horizontal: she is a cow, not a pillar
  const cowGroup = new THREE.Group();
  cowGroup.add(cowMesh);
  scene.add(cowGroup);
  const cowBody = world.createRigidBody(
    R.RigidBodyDesc.dynamic().setTranslation(0, 1.2, 0).lockRotations().setLinearDamping(2.5),
  );
  const cowCollider = world.createCollider(
    R.ColliderDesc.capsule(0.6, 0.7).setCollisionGroups(CollisionGroups.cow).setActiveEvents(R.ActiveEvents.COLLISION_EVENTS),
    cowBody,
  );
  reg.register(cowEid, cowBody, cowGroup, cowCollider);

  // spawned entities
  const boxGeo = new THREE.BoxGeometry(1.6, 1.6, 1.6);
  const boxMat = new THREE.MeshStandardMaterial({ color: COLORS.box });
  const beerMat = new THREE.MeshStandardMaterial({ color: COLORS.beer, emissive: COLORS.beer, emissiveIntensity: 0.4 });
  const wineMat = new THREE.MeshStandardMaterial({ color: COLORS.wine, emissive: COLORS.wine, emissiveIntensity: 0.6 });

  for (const p of computeSpawns(seed, tpl)) {
    const eid = addEntity(ecs);
    if (p.kind === "smashable") {
      addComponent(ecs, Smashable, eid);
      Smashable.points[eid] = Math.round(10 * p.s);
      const mesh = new THREE.Mesh(boxGeo, boxMat);
      mesh.scale.setScalar(p.s);
      scene.add(mesh);
      const body = world.createRigidBody(
        R.RigidBodyDesc.dynamic().setTranslation(p.x, 0.8 * p.s, p.z),
      );
      const col = world.createCollider(
        R.ColliderDesc.cuboid(0.8 * p.s, 0.8 * p.s, 0.8 * p.s)
          .setCollisionGroups(CollisionGroups.smashable)
          .setActiveEvents(R.ActiveEvents.COLLISION_EVENTS),
        body,
      );
      reg.register(eid, body, mesh, col);
    } else {
      addComponent(ecs, Pickup, eid);
      Pickup.kind[eid] = p.kind === "beer" ? 0 : 1;
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.35, 0.9, 12),
        p.kind === "beer" ? beerMat : wineMat,
      );
      scene.add(mesh);
      const body = world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(p.x, 0.6, p.z));
      const col = world.createCollider(
        R.ColliderDesc.cylinder(0.45, 0.5)
          .setSensor(true)
          .setCollisionGroups(CollisionGroups.pickup)
          .setActiveEvents(R.ActiveEvents.COLLISION_EVENTS),
        body,
      );
      reg.register(eid, body, mesh, col);
    }
  }

  return { scene, cowEid, cowBody };
}
