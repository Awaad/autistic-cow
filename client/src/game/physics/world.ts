/** Rapier world lifecycle. One place owns init, step, and event drain. */
import RAPIER from "@dimforge/rapier3d-compat";

export interface Physics {
  world: RAPIER.World;
  events: RAPIER.EventQueue;
  step: (onContact: (a: number, b: number, started: boolean) => void) => void;
  R: typeof RAPIER;
}

export async function createPhysics(): Promise<Physics> {
  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const events = new RAPIER.EventQueue(true);
  return {
    world,
    events,
    R: RAPIER,
    step(onContact) {
      world.step(events);
      events.drainCollisionEvents((h1, h2, started) => onContact(h1, h2, started));
    },
  };
}
