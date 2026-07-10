/** The camel. He never runs. He is never explained.
 * Pure brain: positions in, movement + events out; boot owns bodies/meshes. */
import { tuning } from "../core/tuning";

export type CamelState = "absent" | "approaching" | "leaving";

const SLAM_RADIUS = 1.9;
const LEAVE_AFTER_S = 25;   // pursuit patience before he loses interest
const DESPAWN_DIST = 90;

export interface CamelStep {
  vx: number;
  vz: number;
  slam: boolean;
  despawn: boolean;
}

export class CamelBrain {
  state: CamelState = "absent";
  private pursuitT = 0;
  /** walk speed: fraction of the cow's irritated-band speed — dread, not chase */
  readonly speed: number;

  constructor(cowBaseSpeed: number) {
    this.speed = cowBaseSpeed * tuning.camel.walk_speed_ratio;
  }

  spawn(): void {
    this.state = "approaching";
    this.pursuitT = 0;
  }

  step(dt: number, self: { x: number; z: number }, cow: { x: number; z: number }): CamelStep {
    const none: CamelStep = { vx: 0, vz: 0, slam: false, despawn: false };
    if (this.state === "absent") return none;

    const dx = cow.x - self.x;
    const dz = cow.z - self.z;
    const dist = Math.hypot(dx, dz);

    if (this.state === "approaching") {
      this.pursuitT += dt;
      if (dist <= SLAM_RADIUS) {
        this.state = "leaving";
        return { vx: 0, vz: 0, slam: true, despawn: false };
      }
      if (this.pursuitT > LEAVE_AFTER_S) {
        this.state = "leaving";
        return none;
      }
      return { vx: (dx / dist) * this.speed, vz: (dz / dist) * this.speed, slam: false, despawn: false };
    }

    // leaving: walk away from the cow, despawn far out
    if (dist > DESPAWN_DIST) {
      this.state = "absent";
      return { ...none, despawn: true };
    }
    const d = Math.max(dist, 0.001);
    return { vx: (-dx / d) * this.speed, vz: (-dz / d) * this.speed, slam: false, despawn: false };
  }
}
