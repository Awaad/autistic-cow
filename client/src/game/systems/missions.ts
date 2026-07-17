/** Mission tracker — the four launch types. Pure logic: boot feeds it
 * hooks (smash/rescue/wine/position), it emits progress via callback.
 * Types are code; missions are rows (map-as-content). */
export interface MissionDef {
  mission_id: string;
  mission_type: "bar_pilgrimage" | "rescue_chain" | "controlled_demolition" | "wine_hunt";
  config: Record<string, unknown>;
}

export interface MissionUpdate {
  progress: number;   // 0..1
  label: string;      // "2/3" or "hold..."
  done: boolean;
  reset?: boolean;    // demolition: unmarked hit
}

export class MissionTracker {
  done = false;
  private count = 0;
  private dwell = 0;
  readonly markedTargets = new Set<number>();

  constructor(
    readonly def: MissionDef,
    private emit: (u: MissionUpdate) => void,
  ) {}

  /** demolition: boot supplies candidate smashable eids; we mark N */
  markTargets(candidates: number[]): void {
    const n = Number(this.def.config.count ?? 5);
    for (const eid of candidates.slice(0, n)) this.markedTargets.add(eid);
  }

  onSmash(eid: number): void {
    if (this.done || this.def.mission_type !== "controlled_demolition") return;
    const n = Number(this.def.config.count ?? 5);
    if (this.markedTargets.has(eid)) {
      this.markedTargets.delete(eid);
      this.count += 1;
      this.finishOr(`${this.count}/${n}`, this.count >= n);
    } else if (this.count > 0 || this.markedTargets.size > 0) {
      this.count = 0;
      this.emit({ progress: 0, label: `0/${n}`, done: false, reset: true });
    }
  }

  onRescue(): void {
    if (this.done || this.def.mission_type !== "rescue_chain") return;
    const n = Number(this.def.config.count ?? 3);
    this.count += 1;
    this.finishOr(`${this.count}/${n}`, this.count >= n);
  }

  onWine(): void {
    if (this.done || this.def.mission_type !== "wine_hunt") return;
    this.finishOr("1/1", true);
  }

  /** bar_pilgrimage: call per frame with serene flag + distance to venue */
  onPosition(dt: number, serene: boolean, dist: number): void {
    if (this.done || this.def.mission_type !== "bar_pilgrimage") return;
    const radius = Number(this.def.config.radius ?? 6);
    const need = Number(this.def.config.dwell_s ?? 2);
    if (serene && dist < radius) {
      this.dwell += dt;
      this.finishOr("hold...", this.dwell >= need, Math.min(1, this.dwell / need));
    } else if (this.dwell > 0) {
      this.dwell = 0;
      this.emit({ progress: 0, label: "", done: false });
    }
  }

  private finishOr(label: string, complete: boolean, prog?: number): void {
    const n = Number(this.def.config.count ?? 1);
    const progress = prog ?? Math.min(1, this.count / Math.max(1, n));
    if (complete) {
      this.done = true;
      this.emit({ progress: 1, label, done: true });
    } else {
      this.emit({ progress, label, done: false });
    }
  }
}
