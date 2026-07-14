/** Kyrenia Harbor — SELF-RENDERED REAL GROUND. Art V1.
 * colliders are built from each building's real FOOTPRINT (convex hull),
 * not merged bounding boxes — so the cow only collides with what's actually drawn
 * ART: warmer/brighter light, roof parapets, road contrast, warm sky/fog.
  */
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
import { buildProp, propHalf, buildSign } from "../art/props";
import { KYRENIA_GEN as GEN } from "../assets/kyrenia-harbor-gen.scene";

export interface SceneHandles {
  scene: THREE.Scene;
  cowEid: number;
  cowBody: RAPIER.RigidBody;
  buildingColliders: Set<number>;
}

const ROAD_COLOR = 0x9c8b6b;   // darker than ground for street contrast

const wallMat = (k: string) => flat((PALETTE as Record<string, number>)[k] ?? PALETTE.wallCream);
const roofMat = (k: string) => flat((PALETTE as Record<string, number>)[k] ?? PALETTE.roofOchre);

function shapeFromPoly(poly: number[][]): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(poly[0][0], -poly[0][1]);       // (x, -z); rotateX(-90) lands back at (x, z)
  for (let i = 1; i < poly.length; i++) s.lineTo(poly[i][0], -poly[i][1]);
  s.closePath();
  return s;
}

/** Extruded footprint with a wall body and a low roof parapet — low-poly
 * Mediterranean, no giant cones. */
function extrudeBuilding(poly: number[][], h: number, wall: string, roof: string): THREE.Group {
  const g = new THREE.Group();
  const shape = shapeFromPoly(poly);

  const walls = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false });
  walls.rotateX(-Math.PI / 2);
  g.add(new THREE.Mesh(walls, wallMat(wall)));

  const parapet = new THREE.ExtrudeGeometry(shape, { depth: 0.5, bevelEnabled: false });
  parapet.rotateX(-Math.PI / 2);
  const pm = new THREE.Mesh(parapet, roofMat(roof));
  pm.position.y = h;
  g.add(pm);

  const cap = new THREE.Mesh(new THREE.ShapeGeometry(shape), roofMat(roof));
  cap.geometry.rotateX(-Math.PI / 2);
  cap.position.y = h + 0.35;
  g.add(cap);
  return g;
}

function seaMesh(poly: number[][]): THREE.Mesh {
  const geo = new THREE.ShapeGeometry(shapeFromPoly(poly));
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, flat(PALETTE.sea));
  m.position.y = -0.15;
  return m;
}

function roadRibbon(pts: number[][], width: number): THREE.Group {
  const g = new THREE.Group();
  const mat = flat(ROAD_COLOR);
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i];
    const [x1, z1] = pts[i + 1];
    const len = Math.hypot(x1 - x0, z1 - z0);
    if (len < 0.01) continue;
    const seg = new THREE.Mesh(new THREE.BoxGeometry(len + width, 0.1, width), mat);
    seg.position.set((x0 + x1) / 2, 0.05, (z0 + z1) / 2);
    seg.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    g.add(seg);
  }
  return g;
}

function mesh(geo: THREE.BufferGeometry, color: number, y: number): THREE.Mesh {
  const m = new THREE.Mesh(geo, flat(color));
  m.position.y = y;
  return m;
}

function buildLandmark(kind: string): THREE.Group {
  const g = new THREE.Group();
  if (kind === "mosque" || kind === "church_cathedral") {
    g.add(mesh(new THREE.BoxGeometry(10, 8, 10), PALETTE.wallWhite, 4));
    g.add(mesh(new THREE.SphereGeometry(4, 14, 10), PALETTE.shutterTeal, 9));
    const min = mesh(new THREE.CylinderGeometry(0.8, 1, 16, 8), PALETTE.wallWhite, 8);
    min.position.set(6, 0, 6);
    g.add(min);
  } else if (kind === "castle") {
    g.add(mesh(new THREE.BoxGeometry(22, 11, 22), PALETTE.ground, 5.5));
    for (const [sx, sz] of [[-10, -10], [10, -10], [10, 10], [-10, 10]] as const) {
      const t = mesh(new THREE.CylinderGeometry(2.6, 3, 15, 10), PALETTE.ground, 7.5);
      t.position.set(sx, 0, sz);
      g.add(t);
    }
  } else {
    g.add(mesh(new THREE.BoxGeometry(12, 10, 12), PALETTE.wallCream, 5));
    g.add(mesh(new THREE.BoxGeometry(13, 1, 13), PALETTE.roofTerracotta, 10.5));
  }
  return g;
}

export function buildKyreniaGen(physics: Physics, ecs: IWorld, reg: Registry): SceneHandles {
  const { world, R } = physics;
  const buildingColliders = new Set<number>();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbfe0ef);
  const halfW = GEN.bounds.halfW;
  const halfD = GEN.bounds.halfD;
  scene.fog = new THREE.Fog(0xdcd2b8, halfW * 1.4, halfW * 3.2);

  scene.add(new THREE.HemisphereLight(0xdfefff, 0xe6d3a8, 1.15));
  scene.add(new THREE.AmbientLight(0xfff2dc, 0.35));
  const sun = new THREE.DirectionalLight(0xfff0d0, 1.35);
  sun.position.set(60, 100, 20);
  scene.add(sun);

  const ground = new THREE.Mesh(
    new THREE.BoxGeometry(halfW * 2 + 60, 1, halfD * 2 + 60),
    flat(PALETTE.ground),
  );
  ground.position.y = -0.5;
  scene.add(ground);
  const groundBody = world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0));
  world.createCollider(R.ColliderDesc.cuboid(halfW + 30, 0.5, halfD + 30), groundBody);

  for (const poly of GEN.sea) if (poly.length >= 3) scene.add(seaMesh(poly));
  for (const r of GEN.roads) scene.add(roadRibbon(r.pts, r.width));

  for (const b of GEN.buildings) {
    if (b.poly.length < 3) continue;
    scene.add(extrudeBuilding(b.poly, b.h, b.wall, b.roof));
    const pts: number[] = [];
    for (const [x, z] of b.poly) { pts.push(x, 0.0, z, x, b.h, z); }
    const body = world.createRigidBody(R.RigidBodyDesc.fixed());
    const desc = R.ColliderDesc.convexHull(new Float32Array(pts));
    if (desc) {
      const col = world.createCollider(desc.setActiveEvents(R.ActiveEvents.COLLISION_EVENTS), body);
      buildingColliders.add(col.handle);
    } else {
      let mnx = Infinity, mnz = Infinity, mxx = -Infinity, mxz = -Infinity;
      for (const [x, z] of b.poly) { mnx = Math.min(mnx, x); mxx = Math.max(mxx, x); mnz = Math.min(mnz, z); mxz = Math.max(mxz, z); }
      body.setTranslation({ x: (mnx + mxx) / 2, y: b.h / 2, z: (mnz + mxz) / 2 }, true);
      const col = world.createCollider(
        R.ColliderDesc.cuboid(Math.max((mxx - mnx) / 2, 0.5), b.h / 2, Math.max((mxz - mnz) / 2, 0.5))
          .setActiveEvents(R.ActiveEvents.COLLISION_EVENTS),
        body,
      );
      buildingColliders.add(col.handle);
    }
  }

  for (const lm of GEN.landmarks) {
    const g = buildLandmark(lm.kind);
    g.position.set(lm.x, 0, lm.z);
    scene.add(g);
  }

  const play = GEN.play as Record<string, any>;

  for (const [x, z, sx, sz] of [
    [0, halfD, halfW, 1], [0, -halfD, halfW, 1], [-halfW, 0, 1, halfD], [halfW, 0, 1, halfD],
  ] as const) {
    const b = world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(x, 2, z));
    world.createCollider(R.ColliderDesc.cuboid(sx, 2.5, sz), b);
  }

  const cowEid = addEntity(ecs);
  const cowGroup = buildCowMesh();
  scene.add(cowGroup);
  const cs = play.cowStart ?? { x: 0, z: 0 };
  const cowBody = world.createRigidBody(
    R.RigidBodyDesc.dynamic().setTranslation(cs.x, 1.2, cs.z).lockRotations().setLinearDamping(2.5),
  );
  const cowCollider = world.createCollider(
    R.ColliderDesc.capsule(0.6, 0.7).setCollisionGroups(CollisionGroups.cow)
      .setActiveEvents(R.ActiveEvents.COLLISION_EVENTS),
    cowBody,
  );
  reg.register(cowEid, cowBody, cowGroup, cowCollider);

  const addSmashable = (m: THREE.Object3D, x: number, z: number, hx: number, hy: number, hz: number, pts: number) => {
    const eid = addEntity(ecs);
    addComponent(ecs, Smashable, eid);
    Smashable.points[eid] = pts;
    scene.add(m);
    const body = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(x, hy, z));
    const col = world.createCollider(
      R.ColliderDesc.cuboid(hx, hy, hz).setCollisionGroups(CollisionGroups.smashable)
        .setActiveEvents(R.ActiveEvents.COLLISION_EVENTS),
      body,
    );
    reg.register(eid, body, m, col);
  };

  const mb = play.marketBounds ?? { x0: -12, x1: 12, z0: 12, z1: 38 };
  const rnd = mulberry32(1337);
  const inMarket = () => ({ x: mb.x0 + rnd() * (mb.x1 - mb.x0), z: mb.z0 + rnd() * (mb.z1 - mb.z0) });
  for (let i = 0; i < (play.stallCount ?? 0); i++) {
    const { x, z } = inMarket();
    const g = new THREE.Group();
    const table = new THREE.Mesh(new THREE.BoxGeometry(2, 0.9, 1.2), flat(PALETTE.stall));
    table.position.y = 0.45; g.add(table);
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.1, 1.5), flat(i % 2 ? PALETTE.awningRed : PALETTE.awningStripe));
    canopy.position.y = 1.9; g.add(canopy);
    addSmashable(g, x, z, 1.1, 0.95, 0.75, 24);
  }
  for (let i = 0; i < (play.crateCount ?? 0); i++) {
    const { x, z } = inMarket();
    const s = 0.7 + rnd() * 0.6;
    addSmashable(new THREE.Mesh(new THREE.BoxGeometry(s, s, s), flat(PALETTE.crate)), x, z, s / 2, s / 2, s / 2, Math.round(8 * s));
  }

  for (const s of (play.smashables ?? [])) {
    const [hx, hy, hz] = propHalf(s.kind);
    const holder = new THREE.Group();
    const prop = buildProp(s.kind); prop.position.y = -hy; holder.add(prop);
    addSmashable(holder, s.x, s.z, hx, hy, hz, s.points);
  }

  for (const bd of (play.backdrop ?? [])) if (bd.name) scene.add(buildSign(bd.name, bd.x, bd.z));

  const addPickup = (x: number, z: number, kind: 0 | 1) => {
    const eid = addEntity(ecs);
    addComponent(ecs, Pickup, eid);
    Pickup.kind[eid] = kind;
    const mat = new THREE.MeshStandardMaterial({
      color: kind === 0 ? PALETTE.beer : PALETTE.wine,
      emissive: kind === 0 ? PALETTE.beer : PALETTE.wine,
      emissiveIntensity: kind === 0 ? 0.35 : 0.6,
    });
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.9, 10), mat);
    scene.add(m);
    const body = world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(x, 0.6, z));
    const col = world.createCollider(
      R.ColliderDesc.cylinder(0.45, 0.5).setSensor(true).setCollisionGroups(CollisionGroups.pickup)
        .setActiveEvents(R.ActiveEvents.COLLISION_EVENTS),
      body,
    );
    reg.register(eid, body, m, col);
  };
  for (const b of (play.beerSpots ?? [])) addPickup(b.x, b.z, 0);
  for (const w of (play.wineHides ?? [])) addPickup(w.x, w.z, 1);

  const RESCUE_POINTS = [30, 30, 45, 20] as const;
  const builders = [buildDog, buildCat, buildIceCreamCart];
  for (const spot of (play.rescueSpots ?? [])) {
    const kind = Math.min(spot.kind ?? 0, 2);
    const eid = addEntity(ecs);
    addComponent(ecs, Rescueable, eid);
    Rescueable.kind[eid] = kind;
    Rescueable.points[eid] = RESCUE_POINTS[kind];
    const m = builders[kind]();
    scene.add(m);
    const body = world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(spot.x, 0, spot.z));
    const col = world.createCollider(
      R.ColliderDesc.cuboid(0.6, 0.8, 0.6).setSensor(true).setCollisionGroups(CollisionGroups.pickup),
      body,
    );
    reg.register(eid, body, m, col);
  }

  for (const zone of (play.childZones ?? [])) {
    const eid = addEntity(ecs);
    addComponent(ecs, ChildTag, eid);
    const m = buildChild();
    scene.add(m);
    const body = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(zone.x, 0, zone.z));
    const col = world.createCollider(
      R.ColliderDesc.cuboid(0.25, 0.7, 0.2).setTranslation(0, 0.7, 0).setCollisionGroups(CollisionGroups.child),
      body,
    );
    reg.register(eid, body, m, col);
  }

  return { scene, cowEid, cowBody, buildingColliders };
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}