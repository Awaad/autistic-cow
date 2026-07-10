/** Children NPCs — mechanism #2 of the no-contact guarantee.
 * Mechanism #1 is collision masks (physics/layers.ts): contact is impossible.
 * This brain guarantees they also always ESCAPE: flee speed exceeds the cow's
 * serene/irritated speed, activation radius exceeds any approach she can
 * make undetected, and flee direction is always directly away. */
export type ChildState = "wandering" | "fleeing";

export const SCARE_RADIUS = 7;
export const FLEE_SPEED = 10.5;   // > cow irritated (9.0); she scares, never catches
export const CALM_RADIUS = 16;    // stops fleeing only when safely away
const WANDER_SPEED = 1.2;

export interface ChildStep {
  vx: number;
  vz: number;
  /** true exactly once per scare (edge, not level) */
  scared: boolean;
}

export class ChildBrain {
  state: ChildState = "wandering";
  private wanderA: number;
  private wanderT = 0;

  constructor(seedAngle: number) {
    this.wanderA = seedAngle;
  }

  step(dt: number, self: { x: number; z: number }, cow: { x: number; z: number }, cowSpeed: number): ChildStep {
    const dx = self.x - cow.x;
    const dz = self.z - cow.z;
    const dist = Math.hypot(dx, dz);

    if (this.state === "wandering") {
      if (dist < SCARE_RADIUS && cowSpeed > 2) {
        this.state = "fleeing";
        const d = Math.max(dist, 0.001);
        return { vx: (dx / d) * FLEE_SPEED, vz: (dz / d) * FLEE_SPEED, scared: true };
      }
      this.wanderT -= dt;
      if (this.wanderT <= 0) {
        this.wanderT = 1.5 + Math.abs(Math.sin(this.wanderA * 7.13)) * 2;
        this.wanderA += Math.sin(this.wanderA * 3.7) * 1.4;
      }
      return { vx: Math.cos(this.wanderA) * WANDER_SPEED, vz: Math.sin(this.wanderA) * WANDER_SPEED, scared: false };
    }

    // fleeing: always directly away, faster than she can follow
    if (dist > CALM_RADIUS) {
      this.state = "wandering";
      return { vx: 0, vz: 0, scared: false };
    }
    const d = Math.max(dist, 0.001);
    return { vx: (dx / d) * FLEE_SPEED, vz: (dz / d) * FLEE_SPEED, scared: false };
  }
}
