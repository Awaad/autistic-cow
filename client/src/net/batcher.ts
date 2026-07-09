/** Judge/telemetry event batcher.
 * Flush: every 5s OR 20 events OR critical event, whichever first.
 * Later: IndexedDB persistence for offline sessions. */
import { newId } from "../game/core/ids";

export interface OutgoingEvent {
  event_id: string;
  seq_in_session: number;
  event_type: string;
  target_kind?: string | null;
  rage_at_event: number;
  payload: Record<string, unknown>;
  client_ts: string;
}

const CRITICAL = new Set(["cameld", "photo_calm_used", "session_end"]);

export class EventBatcher {
  private queue: OutgoingEvent[] = [];
  private seq = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private sessionId: string,
    private flushFn: (events: OutgoingEvent[]) => Promise<void>,
    private intervalS = 5,
    private maxBatch = 20,
  ) {}

  start(): void {
    this.timer = setInterval(() => void this.flush(), this.intervalS * 1000);
  }

  push(eventType: string, rage: number, payload: Record<string, unknown> = {}, targetKind?: string): void {
    this.queue.push({
      event_id: newId(),
      seq_in_session: this.seq++,
      event_type: eventType,
      target_kind: targetKind ?? null,
      rage_at_event: Math.round(rage),
      payload,
      client_ts: new Date().toISOString(),
    });
    if (this.queue.length >= this.maxBatch || CRITICAL.has(eventType)) void this.flush();
  }

  async flush(): Promise<void> {
    if (this.queue.length === 0) return;
    const batch = this.queue.splice(0, this.queue.length);
    try {
      await this.flushFn(batch);
    } catch {
      this.queue.unshift(...batch); // network is hostile; retry next tick
    }
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    void this.flush();
  }
}
