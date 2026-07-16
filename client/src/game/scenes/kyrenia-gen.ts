/** Kyrenia Harbor — SELF-RENDERED REAL GROUND.
 *  - SEA BUG: sea sat at y=-0.15, INSIDE the ground box (y=-1..0) → invisible.
 *    Ground top is y=0; all water now sits above it. This was why the harbour
 *    had no water.
 *  - DRAW CALLS: building shells and road ribbons are merged BY MATERIAL
 *    (~900 + ~1000 → ~6). Shells are unique polygons, so they merge; repeated
 *    detail (windows/doors/awnings) instances via addFacades. Both, not either.
 *  - ART: PALETTE v2, golden-hour rig, ACES (boot), real shadows, foam/shallow
 *    sea bands, use-driven facades (cafe/bar/hotel/civic from the pipeline).
 *
 * Colliders remain one convex hull per building footprint — collision matches
 * what is drawn. Merging is a DRAW concern only.
 */
import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import { addComponent, addEntity, type IWorld } from "bitecs";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { CollisionGroups } from "../physics/layers";
import type { Physics } from "../physics/world";
import { Registry } from "../ecs/registry";
import { ChildTag, Pickup, Rescueable, Smashable } from "../ecs/components";
import { PALETTE, flat } from "../art/palette";
import { goldenHourLights } from "../art/postfx";
import { addFacades } from "../art/facades";
import { buildCowMesh } from "../art/cow";
import { buildCat, buildChild, buildDog, buildIceCreamCart } from "../art/critters";
import { buildProp, propHalf } from "../art/props";
import { KYRENIA_GEN as GEN } from "../assets/kyrenia-harbor-gen.scene";

export interface SceneHandles {
  scene: THREE.Scene;
  cowEid: number;
  cowBody: RAPIER.RigidBody;
  buildingColliders: Set<number>;
}

/** renamed mergeBufferGeometries → mergeGeometries. Support both. */
const mergeGeos = (geos: THREE.BufferGeometry[]): THREE.BufferGeometry | null => {
  const u = BufferGeometryUtils as unknown as Record<string, unknown>;
  const fn = (u.mergeGeometries ?? u.mergeBufferGeometries) as
    | ((g: THREE.BufferGeometry[], useGroups?: boolean) => THREE.BufferGeometry | null)
    | undefined;
  return fn ? fn(geos, false) : null;
};

const wallMat = (k: string) => flat((PALETTE as Record<string, number>)[k] ?? PALETTE.wallCream);
const roofMat = (k: string) => flat((PALETTE as Record<string, number>)[k] ?? PALETTE.roofOchre);

function shapeFromPoly(poly: number[][]): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(poly[0][0], -poly[0][1]);   // (x, -z); rotateX(-90°) lands it back at (x, z)
  for (let i = 1; i < poly.length; i++) s.lineTo(poly[i][0], -poly[i][1]);
  s.closePath();
  return s;
}

/** Scale a polygon about its own centroid — used for the shallow/foam bands. */
function scalePoly(poly: number[][], f: number): number[][] {
  let cx = 0, cz = 0;
  for (const [x, z] of poly) { cx += x; cz += z; }
  cx /= poly.length; cz /= poly.length;
  return poly.map(([x, z]) => [cx + (x - cx) * f, cz + (z - cz) * f]);
}

function flatShapeMesh(poly: number[][], color: number, y: number): THREE.Mesh {
  const g = new THREE.ShapeGeometry(shapeFromPoly(poly));
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, flat(color));
  m.position.y = y;
  m.receiveShadow = true;
  m.userData.sea = { baseY: y };
  return m;
}

/** Call once per frame from the render loop: `animateSea(scene, elapsed)`.
 * Swells around each layer's OWN base height — never around a hardcoded y, or
 * the water sinks back into the ground box (that was the original sea bug). */
export function animateSea(scene: THREE.Scene, elapsed: number): void {
  scene.traverse((o) => {
    const sea = (o as THREE.Mesh).userData?.sea as { baseY: number } | undefined;
    if (!sea) return;
    const m = o as THREE.Mesh;
    m.position.y = sea.baseY + Math.sin(elapsed * 0.8 + sea.baseY * 40) * 0.03;
    const mat = m.material as THREE.MeshStandardMaterial;
    if (mat?.color) mat.color.offsetHSL(0, 0, Math.sin(elapsed * 0.5) * 0.0008);
  });
}

/** Water: foam rim → shallow band → deep water, each inset and stacked.
 * ALL ABOVE y=0 (ground top) — the old y=-0.15 buried it in the ground box. */
function addSea(scene: THREE.Scene, polys: number[][][]): void {
  for (const poly of polys) {
    if (poly.length < 3) continue;
    scene.add(flatShapeMesh(scalePoly(poly, 1.01), PALETTE.seaFoam, 0.05));
    scene.add(flatShapeMesh(poly, PALETTE.seaShallow, 0.055));
    scene.add(flatShapeMesh(scalePoly(poly, 0.98), PALETTE.sea, 0.06));
  }
}

/** All streets merged into ONE mesh: flat planes + a disc at every joint so
 * corners connect instead of reading as disconnected rectangles. */
function addRoads(scene: THREE.Scene, roads: { pts: number[][]; width: number }[]): void {
  const geos: THREE.BufferGeometry[] = [];
  for (const r of roads) {
    const pts = r.pts;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, z0] = pts[i];
      const [x1, z1] = pts[i + 1];
      const len = Math.hypot(x1 - x0, z1 - z0);
      if (len < 0.01) continue;
      const g = new THREE.PlaneGeometry(len, r.width);
      g.rotateX(-Math.PI / 2);
      g.rotateY(-Math.atan2(z1 - z0, x1 - x0));
      g.translate((x0 + x1) / 2, 0.03, (z0 + z1) / 2);
      g.clearGroups();
      geos.push(g);
    }
    for (const [x, z] of pts) {
      const j = new THREE.CircleGeometry(r.width / 2, 10);
      j.rotateX(-Math.PI / 2);
      j.translate(x, 0.031, z);
      j.clearGroups();
      geos.push(j);
    }
  }
  if (geos.length === 0) return;
  const merged = mergeGeos(geos);
  geos.forEach((g) => g.dispose());
  if (!merged) return;
  const mesh = new THREE.Mesh(merged, flat(PALETTE.road));
  mesh.receiveShadow = true;
  scene.add(mesh);
  console.info(`[roads] merged → 1 draw call`);
}

interface GenBuilding { poly: number[][]; h: number; wall: string; roof: string; use?: string; name?: string | null; hero?: string | null }

/** Building shells merged BY MATERIAL: unique polygons can't instance, but they
 * can merge → 3 wall tones + 2 roof tones ≈ 5 draw calls for the whole city. */
function addBuildingShells(scene: THREE.Scene, buildings: GenBuilding[]): void {
  const walls = new Map<string, THREE.BufferGeometry[]>();
  const roofs = new Map<string, THREE.BufferGeometry[]>();
  const push = (m: Map<string, THREE.BufferGeometry[]>, k: string, g: THREE.BufferGeometry) => {
    g.clearGroups();
    const a = m.get(k);
    if (a) a.push(g); else m.set(k, [g]);
  };

  for (const b of buildings) {
    if (b.poly.length < 3) continue;
    if (b.hero) continue;   // a hero model replaces this shell (else it buries it)
    const shape = shapeFromPoly(b.poly);
    // civic buildings are masonry, not painted plaster
    const wallKey = b.use === "civic" ? "stone" : b.wall;

    const w = new THREE.ExtrudeGeometry(shape, { depth: b.h, bevelEnabled: false });
    w.rotateX(-Math.PI / 2);
    push(walls, wallKey, w);

    const p = new THREE.ExtrudeGeometry(shape, { depth: 0.45, bevelEnabled: false });
    p.rotateX(-Math.PI / 2);
    p.translate(0, b.h, 0);
    push(roofs, b.roof, p);

    const cap = new THREE.ShapeGeometry(shape);
    cap.rotateX(-Math.PI / 2);
    cap.translate(0, b.h + 0.3, 0);
    push(roofs, b.roof, cap);
  }

  let calls = 0;
  const bake = (m: Map<string, THREE.BufferGeometry[]>, mat: (k: string) => THREE.Material) => {
    for (const [key, geos] of m) {
      const merged = mergeGeos(geos);
      geos.forEach((g) => g.dispose());
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, mat(key));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      calls++;
    }
  };
  bake(walls, wallMat);
  bake(roofs, roofMat);
  console.info(`[shells] ${buildings.length} buildings → ${calls} draw calls`);
}

/** Scattered-smashable meshes. The pipeline now spreads crates/stalls/scooters/
 * planters across the WHOLE district (kerbside + open ground), so these are the
 * things she actually smashes. props.ts owns the OSM street furniture kinds. */
function buildScatterProp(kind: string, rnd: () => number): THREE.Group | null {
  const g = new THREE.Group();
  if (kind === "crate") {
    const s = 0.7 + rnd() * 0.6;
    const m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), flat(PALETTE.crate));
    m.position.y = s / 2;
    m.rotation.y = rnd() * Math.PI;
    g.add(m);
    return g;
  }
  if (kind === "stall") {
    const table = new THREE.Mesh(new THREE.BoxGeometry(2, 0.9, 1.2), flat(PALETTE.stall));
    table.position.y = 0.45; g.add(table);
    const canopy = new THREE.Mesh(
      new THREE.BoxGeometry(2.3, 0.1, 1.5),
      flat(rnd() > 0.5 ? PALETTE.awningRed : PALETTE.awningStripe),
    );
    canopy.position.y = 1.9; g.add(canopy);
    for (const sx of [-0.95, 0.95]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.9, 5), flat(PALETTE.stall));
      pole.position.set(sx, 0.95, 0.6); g.add(pole);
    }
    g.rotation.y = rnd() * Math.PI;
    return g;
  }
  if (kind === "scooter") {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 1.6), flat(PALETTE.shutterCobalt));
    body.position.y = 0.55; g.add(body);
    for (const fz of [-0.6, 0.6]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.15, 8), flat(PALETTE.hoof));
      wheel.rotation.z = Math.PI / 2; wheel.position.set(0, 0.25, fz); g.add(wheel);
    }
    g.rotation.y = rnd() * Math.PI * 2;
    return g;
  }
  return null;
}

const SCATTER_HALF: Record<string, [number, number, number]> = {
  crate: [0.5, 0.5, 0.5], stall: [1.1, 0.95, 0.75], scooter: [0.3, 0.55, 0.85],
};

function mesh(geo: THREE.BufferGeometry, color: number, y: number): THREE.Mesh {
  const m = new THREE.Mesh(geo, flat(color));
  m.position.y = y;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function buildLandmark(kind: string): THREE.Group {
  const g = new THREE.Group();
  if (kind === "mosque" || kind === "church_cathedral" || kind === "anglican_church") {
    g.add(mesh(new THREE.BoxGeometry(11, 9, 11), PALETTE.wallWhite, 4.5));
    g.add(mesh(new THREE.SphereGeometry(4.4, 16, 10), PALETTE.shutterTeal, 10));
    const min = mesh(new THREE.CylinderGeometry(0.85, 1.05, 18, 8), PALETTE.wallWhite, 9);
    min.position.set(6.5, 0, 6.5);
    g.add(min);
    const cap = mesh(new THREE.ConeGeometry(1.2, 2.2, 8), PALETTE.shutterTeal, 19);
    cap.position.set(6.5, 0, 6.5);
    g.add(cap);
  } else if (kind === "castle" || kind === "landmark_and_historical_building") {
    g.add(mesh(new THREE.BoxGeometry(26, 12, 26), PALETTE.stone, 6));
    for (const [sx, sz] of [[-12, -12], [12, -12], [12, 12], [-12, 12]] as const) {
      const t = mesh(new THREE.CylinderGeometry(3, 3.4, 17, 12), PALETTE.stone, 8.5);
      t.position.set(sx, 0, sz);
      g.add(t);
      const crown = mesh(new THREE.CylinderGeometry(3.4, 3.4, 1.2, 12), PALETTE.ground, 17.5);
      crown.position.set(sx, 0, sz);
      g.add(crown);
    }
  } else {
    g.add(mesh(new THREE.BoxGeometry(13, 11, 13), PALETTE.wallCream, 5.5));
    g.add(mesh(new THREE.BoxGeometry(14, 1, 14), PALETTE.roofTerracotta, 11.5));
  }
  return g;
}

export function buildKyreniaGen(physics: Physics, ecs: IWorld, reg: Registry): SceneHandles {
  const { world, R } = physics;
  const buildingColliders = new Set<number>();
  const scene = new THREE.Scene();
  const halfW = GEN.bounds.halfW;
  const halfD = GEN.bounds.halfD;

  // atmosphere: PALETTE v2 amber sky, fog tuned to the cell
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(PALETTE.sky, halfW * 1.5, halfW * 3.4);
  goldenHourLights(scene);   // house rig (see postfx.ts)

  // ground — top surface at y=0; everything flat stacks above it
  const ground = new THREE.Mesh(
    new THREE.BoxGeometry(halfW * 2 + 60, 1, halfD * 2 + 60),
    flat(PALETTE.ground),
  );
  ground.position.y = -0.5;
  ground.receiveShadow = true;
  scene.add(ground);
  const groundBody = world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0));
  world.createCollider(R.ColliderDesc.cuboid(halfW + 30, 0.5, halfD + 30), groundBody);

  addSea(scene, GEN.sea as number[][][]);
  addRoads(scene, GEN.roads as { pts: number[][]; width: number }[]);

  const gbuildings = GEN.buildings as unknown as GenBuilding[];
  addBuildingShells(scene, gbuildings);
  addFacades(scene, gbuildings as never, 1337);   // instanced windows/doors/awnings

  // colliders: one convex hull per real footprint — collision == what you see
  for (const b of gbuildings) {
    if (b.poly.length < 3) continue;
    const pts: number[] = [];
    for (const [x, z] of b.poly) { pts.push(x, 0.0, z, x, b.h, z); }
    const body = world.createRigidBody(R.RigidBodyDesc.fixed());
    const desc = R.ColliderDesc.convexHull(new Float32Array(pts));
    if (desc) {
      const col = world.createCollider(desc.setActiveEvents(R.ActiveEvents.COLLISION_EVENTS), body);
      buildingColliders.add(col.handle);
    } else {
      let mnx = Infinity, mnz = Infinity, mxx = -Infinity, mxz = -Infinity;
      for (const [x, z] of b.poly) {
        mnx = Math.min(mnx, x); mxx = Math.max(mxx, x);
        mnz = Math.min(mnz, z); mxz = Math.max(mxz, z);
      }
      body.setTranslation({ x: (mnx + mxx) / 2, y: b.h / 2, z: (mnz + mxz) / 2 }, true);
      const col = world.createCollider(
        R.ColliderDesc.cuboid(Math.max((mxx - mnx) / 2, 0.5), b.h / 2, Math.max((mxz - mnz) / 2, 0.5))
          .setActiveEvents(R.ActiveEvents.COLLISION_EVENTS),
        body,
      );
      buildingColliders.add(col.handle);
    }
  }

  for (const poly of GEN.sea as number[][][]) {
    for (let i = 0; i < poly.length; i++) {
      const [x0, z0] = poly[i];
      const [x1, z1] = poly[(i + 1) % poly.length];
      const len = Math.hypot(x1 - x0, z1 - z0);
      if (len < 2) continue;
      const yaw = -Math.atan2(z1 - z0, x1 - x0);
      const b = world.createRigidBody(R.RigidBodyDesc.fixed()
        .setTranslation((x0 + x1) / 2, 1, (z0 + z1) / 2));
      b.setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }, true);
      world.createCollider(R.ColliderDesc.cuboid(len / 2, 1.5, 0.4), b);
    }
  }

   for (const lm of GEN.landmarks) {
    const host = (lm as { host?: { cx: number; cz: number; w: number; d: number } }).host;
    const g = buildLandmark(lm.kind);
    // Sit the hero ON its real footprint and scale it to fit. Previously it was
    // dropped at the raw POI point at a fixed size, landing inside neighbouring
    // shells — which is why the castle was invisible. The host footprint's shell
    // is now skipped (see addBuildingShells), so the hero is what you see.
    const isBig = lm.kind.includes("castle") || lm.kind.includes("historical");
    const cx = host ? host.cx : lm.x;
    const cz = host ? host.cz : lm.z;
    let half = isBig ? 15 : 8;
    if (host) {
      const base = isBig ? 26 : 11;
      g.scale.setScalar(Math.max(0.6, Math.min(2.6, Math.min(host.w, host.d) / base)));
      half = Math.max(2, (Math.min(host.w, host.d) / 2) * 0.95);
    }
    g.position.set(cx, 0, cz);
    g.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(g);
    const body = world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(cx, 6, cz));
    const col = world.createCollider(
      R.ColliderDesc.cuboid(half, 6, half).setActiveEvents(R.ActiveEvents.COLLISION_EVENTS),
      body,
    );
    buildingColliders.add(col.handle);   // landmarks bite back like buildings (owner's edit)
    console.info(`[landmark] ${lm.kind} "${lm.name}" @ ${cx.toFixed(0)},${cz.toFixed(0)}`
      + (host ? ` fitted to ${host.w.toFixed(0)}x${host.d.toFixed(0)}m footprint` : " — NO host footprint"));
  }
  if (GEN.landmarks.length === 0) console.warn("[district] no hero landmarks in cell — widen the crop");

  const play = GEN.play as Record<string, any>;

  // boundary walls (invisible, unpunishing)
  for (const [x, z, sx, sz] of [
    [0, halfD, halfW, 1], [0, -halfD, halfW, 1], [-halfW, 0, 1, halfD], [halfW, 0, 1, halfD],
  ] as const) {
    const b = world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(x, 2, z));
    world.createCollider(R.ColliderDesc.cuboid(sx, 2.5, sz), b);
  }

  // the cow
  const cowEid = addEntity(ecs);
  const cowGroup = buildCowMesh();
  cowGroup.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
  scene.add(cowGroup);
  const cs = play.cowStart ?? { x: 0, z: 0 };
  const cowBody = world.createRigidBody(
    R.RigidBodyDesc.dynamic().setTranslation(cs.x, 1.2, cs.z)
      .lockRotations().setLinearDamping(2.5)
      .setCcdEnabled(true),                  // continuous collision: no tunneling at berserk
  );
  const cowCollider = world.createCollider(
    R.ColliderDesc.capsule(0.6, 0.7)
      .setFriction(0.0)                      // slide along walls instead of sticking
      .setCollisionGroups(CollisionGroups.cow)
      .setActiveEvents(R.ActiveEvents.COLLISION_EVENTS),
    cowBody,
  );
  reg.register(cowEid, cowBody, cowGroup, cowCollider);

  const addSmashable = (
    m: THREE.Object3D, x: number, z: number, hx: number, hy: number, hz: number, pts: number,
  ): void => {
    const eid = addEntity(ecs);
    addComponent(ecs, Smashable, eid);
    Smashable.points[eid] = pts;
    m.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
    scene.add(m);
    const body = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(x, hy, z));
    const col = world.createCollider(
      R.ColliderDesc.cuboid(hx, hy, hz).setCollisionGroups(CollisionGroups.smashable)
        .setActiveEvents(R.ActiveEvents.COLLISION_EVENTS),
      body,
    );
    reg.register(eid, body, m, col);
  };

  // smashables: the pipeline now scatters them across the WHOLE district
  // (kerbside along real streets + open ground), capped to the dynamic budget.
  const rnd = mulberry32(1337);
  let placed = 0;
  for (const s of (play.smashables ?? [])) {
    const scatter = buildScatterProp(s.kind, rnd);
    if (scatter) {
      const [hx, hy, hz] = SCATTER_HALF[s.kind] ?? [0.5, 0.5, 0.5];
      const holder = new THREE.Group();
      scatter.position.y = -hy;
      holder.add(scatter);
      addSmashable(holder, s.x, s.z, hx, hy, hz, s.points);
    } else {
      const [hx, hy, hz] = propHalf(s.kind);      // OSM street furniture (props.ts)
      const holder = new THREE.Group();
      const prop = buildProp(s.kind);
      prop.position.y = -hy;
      holder.add(prop);
      addSmashable(holder, s.x, s.z, hx, hy, hz, s.points);
    }
    placed++;
  }
  console.info(`[smashables] ${placed} placed across the district`);

  const addPickup = (x: number, z: number, kind: 0 | 1): void => {
    const eid = addEntity(ecs);
    addComponent(ecs, Pickup, eid);
    Pickup.kind[eid] = kind;
    const mat = new THREE.MeshStandardMaterial({
      color: kind === 0 ? PALETTE.beer : PALETTE.wine,
      emissive: kind === 0 ? PALETTE.beer : PALETTE.wine,
      emissiveIntensity: kind === 0 ? 0.35 : 0.6,
      flatShading: true,
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
    m.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
    scene.add(m);
    const body = world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(spot.x, 0, spot.z));
    const col = world.createCollider(
      R.ColliderDesc.cuboid(0.6, 0.8, 0.6).setSensor(true).setCollisionGroups(CollisionGroups.pickup),
      body,
    );
    reg.register(eid, body, m, col);
  }

  // children: kinematic, terrain-only collisions
  for (const zone of (play.childZones ?? [])) {
    const eid = addEntity(ecs);
    addComponent(ecs, ChildTag, eid);
    const m = buildChild();
    m.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
    scene.add(m);
    const body = world.createRigidBody(
      R.RigidBodyDesc.kinematicPositionBased().setTranslation(zone.x, 0, zone.z),
    );
    const col = world.createCollider(
      R.ColliderDesc.cuboid(0.25, 0.7, 0.2).setTranslation(0, 0.7, 0)
        .setCollisionGroups(CollisionGroups.child),
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