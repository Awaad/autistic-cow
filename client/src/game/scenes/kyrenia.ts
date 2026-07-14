/** Kyrenia Harbor — the first real district. Buildings are terrain (static,
 * unsmashable at this stage); stalls, crates, scooters are the smashable
 * population; the sea is a mood, not a mechanic. Physics groups unchanged. */
import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import { addComponent, addEntity, type IWorld } from "bitecs";
import { CollisionGroups } from "../physics/layers";
import type { Physics } from "../physics/world";
import { Registry } from "../ecs/registry";
import { ChildTag, Pickup, Rescueable, Smashable } from "../ecs/components";
import { PALETTE, flat } from "../art/palette";
import { buildCowMesh } from "../art/cow";
import { buildCat, buildChild, buildDog, buildIceCreamCart } from "../art/critters";
import { KYRENIA } from "../assets/kyrenia-harbor-gen";
import { seededRng } from "../core/rng";
import { buildProp, propHalf, buildSign } from "../art/props";

export interface SceneHandles {
  scene: THREE.Scene;
  cowEid: number;
  cowBody: RAPIER.RigidBody;
  /** unbreakable city: contact at speed punishes (rage + heat), never scores */
  buildingColliders: Set<number>;
}

export function buildKyrenia(
  physics: Physics,
  ecs: IWorld,
  reg: Registry,
  seed: number,
): SceneHandles {
  const { world, R } = physics;
  const rng = seededRng(seed);
  const buildingColliders = new Set<number>();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(PALETTE.sky, 90, 190);

  // Mediterranean light: warm sun, cool sky fill
  scene.add(new THREE.HemisphereLight(0xbfe3ff, 0xd9c9a3, 0.85));
  const sun = new THREE.DirectionalLight(0xfff2d9, 1.4);
  sun.position.set(40, 60, -30);
  scene.add(sun);

  const { halfW, halfD } = KYRENIA.bounds;

  // ground (stone) + sea
  const ground = new THREE.Mesh(
    new THREE.BoxGeometry(halfW * 2, 1, KYRENIA.waterline + halfD),
    flat(PALETTE.ground),
  );
  ground.position.set(0, -0.5, (KYRENIA.waterline - halfD) / 2);
  scene.add(ground);
  const sea = new THREE.Mesh(
    new THREE.BoxGeometry(halfW * 2 + 60, 0.6, halfD),
    flat(PALETTE.sea),
  );
  sea.position.set(0, -0.75, KYRENIA.waterline + halfD / 2);
  scene.add(sea);

  const groundBody = world.createRigidBody(
    R.RigidBodyDesc.fixed().setTranslation(0, -0.5, (KYRENIA.waterline - halfD) / 2),
  );
  world.createCollider(
    R.ColliderDesc.cuboid(halfW, 0.5, (KYRENIA.waterline + halfD) / 2),
    groundBody,
  );

  // boundary walls (invisible; fog + sea sell the edges) — quay wall at waterline
  const walls: Array<[number, number, number, number]> = [
    [0, KYRENIA.waterline, halfW, 1],
    [0, -halfD, halfW, 1],
    [-halfW, 0, 1, halfD],
    [halfW, 0, 1, halfD],
  ];
  for (const [x, z, sx, sz] of walls) {
    const b = world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(x, 2, z));
    world.createCollider(R.ColliderDesc.cuboid(sx, 2.5, sz), b);
  }

  // buildings: static terrain with roofs, doors, shutters, awnings
  for (const spec of KYRENIA.buildings) {
    const g = new THREE.Group();
    const wallMat = flat(PALETTE[spec.wall]);
    const body = new THREE.Mesh(new THREE.BoxGeometry(spec.w, spec.h, spec.d), wallMat);
    body.position.y = spec.h / 2;
    g.add(body);
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(Math.max(spec.w, spec.d) * 0.72, spec.h * 0.35, 4),
      flat(PALETTE[spec.roof]),
    );
    roof.position.y = spec.h + spec.h * 0.17;
    roof.rotation.y = Math.PI / 4;
    g.add(roof);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2, 0.15), flat(PALETTE.doorGreen));
    door.position.set(0, 1, spec.d / 2 + 0.05);
    g.add(door);
    const shutter = flat(rng() > 0.5 ? PALETTE.shutterCobalt : PALETTE.shutterTeal);
    for (const sx of [-spec.w * 0.28, spec.w * 0.28]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.12), shutter);
      win.position.set(sx, spec.h * 0.62, spec.d / 2 + 0.05);
      g.add(win);
    }
    if (spec.awning) {
      const aw = new THREE.Mesh(new THREE.BoxGeometry(spec.w * 0.8, 0.12, 1.6), flat(PALETTE.awningRed));
      aw.position.set(0, 2.5, spec.d / 2 + 0.9);
      aw.rotation.x = 0.18;
      g.add(aw);
    }
    g.position.set(spec.x, 0, spec.z);
    scene.add(g);

    const bBody = world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(spec.x, spec.h / 2, spec.z));
    const bCol = world.createCollider(
      R.ColliderDesc.cuboid(spec.w / 2, spec.h / 2, spec.d / 2)
        .setActiveEvents(R.ActiveEvents.COLLISION_EVENTS),
      bBody,
    );
    buildingColliders.add(bCol.handle);
  }

  // palms
  for (const p of KYRENIA.palms) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 4.5, 6), flat(PALETTE.palmTrunk));
    trunk.position.y = 2.25;
    g.add(trunk);
    for (let i = 0; i < 6; i++) {
      const frond = new THREE.Mesh(new THREE.ConeGeometry(0.35, 2.6, 4), flat(PALETTE.palmFrond));
      const a = (i / 6) * Math.PI * 2;
      frond.position.set(Math.cos(a) * 1.1, 4.6, Math.sin(a) * 1.1);
      frond.rotation.set(Math.sin(a) * 1.25, 0, Math.cos(a) * -1.25);
      g.add(frond);
    }
    g.position.set(p.x, 0, p.z);
    scene.add(g);
  }

  // --- petting zoo (max-rage fallback §5.4: survival, not victory) ---
  {
    const pz = KYRENIA.pettingZoo;
    const pen = new THREE.Group();
    for (const [dx, dz, w, d] of [[0, -3, 6, 0.2], [0, 3, 6, 0.2], [-3, 0, 0.2, 6], [3, 0, 0.2, 6]] as const) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(w, 1, d), flat(PALETTE.palmTrunk));
      rail.position.set(dx, 0.5, dz);
      pen.add(rail);
    }
    const goat = new THREE.Group();
    const gBody = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.9), flat(0xd8d3c8));
    gBody.position.y = 0.55;
    goat.add(gBody);
    const gHead = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.35), flat(0xd8d3c8));
    gHead.position.set(0, 0.85, 0.55);
    goat.add(gHead);
    pen.add(goat);
    pen.position.set(pz.x, 0, pz.z);
    scene.add(pen);
  }

  // --- the cow ---
  const cowEid = addEntity(ecs);
  const cowGroup = buildCowMesh();
  scene.add(cowGroup);
  const cowBody = world.createRigidBody(
    R.RigidBodyDesc.dynamic()
      .setTranslation(KYRENIA.cowStart.x, 1.2, KYRENIA.cowStart.z)
      .lockRotations()
      .setLinearDamping(2.5),
  );
  const cowCollider = world.createCollider(
    R.ColliderDesc.capsule(0.6, 0.7)
      .setCollisionGroups(CollisionGroups.cow)
      .setActiveEvents(R.ActiveEvents.COLLISION_EVENTS),
    cowBody,
  );
  reg.register(cowEid, cowBody, cowGroup, cowCollider);

  // --- smashables: stalls, crates, scooters ---
  const addSmashable = (
    mesh: THREE.Object3D, x: number, z: number,
    hx: number, hy: number, hz: number, points: number,
  ): void => {
    const eid = addEntity(ecs);
    addComponent(ecs, Smashable, eid);
    Smashable.points[eid] = points;
    scene.add(mesh);
    const body = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(x, hy, z));
    const col = world.createCollider(
      R.ColliderDesc.cuboid(hx, hy, hz)
        .setCollisionGroups(CollisionGroups.smashable)
        .setActiveEvents(R.ActiveEvents.COLLISION_EVENTS),
      body,
    );
    reg.register(eid, body, mesh, col);
  };

  const mb = KYRENIA.marketBounds;
  const inMarket = (): { x: number; z: number } => ({
    x: mb.x0 + rng() * (mb.x1 - mb.x0),
    z: mb.z0 + rng() * (mb.z1 - mb.z0),
  });
  const inStreets = (): { x: number; z: number } => ({
    x: (rng() * 2 - 1) * (KYRENIA.bounds.halfW - 10),
    z: -KYRENIA.bounds.halfD + 8 + rng() * (KYRENIA.waterline + KYRENIA.bounds.halfD - 20),
  });

  for (let i = 0; i < KYRENIA.stallCount; i++) {
    const { x, z } = inMarket();
    const g = new THREE.Group();
    const table = new THREE.Mesh(new THREE.BoxGeometry(2, 0.9, 1.2), flat(PALETTE.stall));
    table.position.y = 0.45;
    g.add(table);
    const canopy = new THREE.Mesh(
      new THREE.BoxGeometry(2.3, 0.1, 1.5),
      flat(i % 2 ? PALETTE.awningRed : PALETTE.awningStripe),
    );
    canopy.position.y = 1.9;
    g.add(canopy);
    for (const sx of [-0.95, 0.95]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.9, 5), flat(PALETTE.stall));
      pole.position.set(sx, 0.95, 0.6);
      g.add(pole);
    }
    addSmashable(g, x, z, 1.1, 0.95, 0.75, 24);
  }

  for (let i = 0; i < KYRENIA.crateCount; i++) {
    const { x, z } = rng() > 0.45 ? inMarket() : inStreets();
    const s = 0.7 + rng() * 0.6;
    const m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), flat(PALETTE.crate));
    addSmashable(m, x, z, s / 2, s / 2, s / 2, Math.round(8 * s));
  }

  for (let i = 0; i < KYRENIA.scooterCount; i++) {
    const { x, z } = inStreets();
    const g = new THREE.Group();
    const bodyM = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 1.6), flat(PALETTE.shutterCobalt));
    bodyM.position.y = 0.55;
    g.add(bodyM);
    for (const fz of [-0.6, 0.6]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.15, 8), flat(0x2a2a2a));
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(0, 0.25, fz);
      g.add(wheel);
    }
    addSmashable(g, x, z, 0.3, 0.55, 0.85, 18);
  }

  // --- pickups ---
  const addPickup = (x: number, z: number, kind: 0 | 1): void => {
    const eid = addEntity(ecs);
    addComponent(ecs, Pickup, eid);
    Pickup.kind[eid] = kind;
    const mat = new THREE.MeshStandardMaterial({
      color: kind === 0 ? PALETTE.beer : PALETTE.wine,
      emissive: kind === 0 ? PALETTE.beer : PALETTE.wine,
      emissiveIntensity: kind === 0 ? 0.35 : 0.6,
    });
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.9, 10), mat);
    scene.add(mesh);
    const body = world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(x, 0.6, z));
    const col = world.createCollider(
      R.ColliderDesc.cylinder(0.45, 0.5)
        .setSensor(true)
        .setCollisionGroups(CollisionGroups.pickup)
        .setActiveEvents(R.ActiveEvents.COLLISION_EVENTS),
      body,
    );
    reg.register(eid, body, mesh, col);
  };

  // --- rescueables (sensors: she can't crush what she can save) ---
  const RESCUE_POINTS = [30, 30, 45, 20] as const; // dog, cat, cart, dropped ice cream
  const builders = [buildDog, buildCat, buildIceCreamCart];
  for (const spot of KYRENIA.rescueSpots) {
    const eid = addEntity(ecs);
    addComponent(ecs, Rescueable, eid);
    Rescueable.kind[eid] = spot.kind;
    Rescueable.points[eid] = RESCUE_POINTS[spot.kind];
    const mesh = builders[spot.kind]();
    scene.add(mesh);
    const body = world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(spot.x, 0, spot.z));
    const col = world.createCollider(
      R.ColliderDesc.cuboid(0.6, 0.8, 0.6).setSensor(true).setCollisionGroups(CollisionGroups.pickup),
      body,
    );
    reg.register(eid, body, mesh, col);
  }

  // --- children (kinematic, terrain-only collisions — Repo Law 4 mechanism #1) ---
  for (const zone of KYRENIA.childZones) {
    const eid = addEntity(ecs);
    addComponent(ecs, ChildTag, eid);
    const mesh = buildChild();
    scene.add(mesh);
    const body = world.createRigidBody(
      R.RigidBodyDesc.kinematicPositionBased().setTranslation(zone.x, 0, zone.z),
    );
    const col = world.createCollider(
      R.ColliderDesc.cuboid(0.25, 0.7, 0.2).setTranslation(0, 0.7, 0).setCollisionGroups(CollisionGroups.child),
      body,
    );
    reg.register(eid, body, mesh, col);
  }

  for (const b of KYRENIA.beerSpots) addPickup(b.x, b.z, 0);
  if (rng() < 0.33) {
    const hide = KYRENIA.wineHides[Math.floor(rng() * KYRENIA.wineHides.length)];
    addPickup(hide.x, hide.z, 1);
  }
  // --- generated layers (absent in hand-authored data -> empty -> no-op) ---
  const gen = KYRENIA as unknown as {
    smashables?: Array<{ x: number; z: number; kind: string; points: number }>;
    backdrop?: Array<{ x: number; z: number; name: string | null }>;
  };
  for (const s of gen.smashables ?? []) {
    const [hx, hy, hz] = propHalf(s.kind);
    const holder = new THREE.Group();     // centre the ground-built prop on its body
    const prop = buildProp(s.kind);
    prop.position.y = -hy;
    holder.add(prop);
    addSmashable(holder, s.x, s.z, hx, hy, hz, s.points);
  }
  for (const b of gen.backdrop ?? []) {
    if (b.name) scene.add(buildSign(b.name, b.x, b.z));
  }

  return { scene, cowEid, cowBody, buildingColliders };
}
