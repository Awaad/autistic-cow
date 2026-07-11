/** Session sync — the bridge between the network and the bus.
 * The engine emits judgeEventRecorded/sessionStats; this layer batches,
 * ships, and returns the server's verdict as a bus event. If the server is
 * down, everything degrades to local play silently. */
import { bus } from "../game/core/bus";
import { newId } from "../game/core/ids";
import { api, type AnonIdentity } from "./api";
import { EventBatcher } from "./batcher";

const LS_KEY = "cowgame.identity";

async function identity(locale: string): Promise<AnonIdentity | null> {
  const stored = localStorage.getItem(LS_KEY);
  if (stored) return JSON.parse(stored) as AnonIdentity;
  try {
    const id = await api.anon(locale);
    localStorage.setItem(LS_KEY, JSON.stringify(id));
    return id;
  } catch {
    return null; // offline: local play
  }
}

export interface SyncHandle {
  seed: number | undefined;
  dispose: () => void;
}

export async function startSync(locale: string): Promise<SyncHandle> {
  const id = await identity(locale);
  if (!id) return { seed: undefined, dispose: () => undefined };

  let session: { session_id: string; spawn_seed: number } | null = null;
  try {
    session = await api.startSession(id.access_token);
  } catch {
    return { seed: undefined, dispose: () => undefined };
  }

  const sid = session.session_id;
  const batcher = new EventBatcher(sid, async (events) => {
    await api.sendEvents(id.access_token, sid, events);
  });
  batcher.start();

  let stats = { destruction: 0, rescue: 0, peakRage: 0, nervesLost: 0 };
  const unsub = bus.subscribe((e) => {
    if (e.type === "judgeEventRecorded") batcher.push(e.etype, e.rage);
    if (e.type === "sessionStats") stats = { ...e };
    if (e.type === "sessionEnded") {
      void (async () => {
        batcher.stop();
        try {
          const v = await api.endSession(id.access_token, sid, {
            destruction_score: stats.destruction,
            rescue_score: stats.rescue,
            peak_rage: stats.peakRage,
            nerves_lost: stats.nervesLost,
            end_reason: e.reason,
          });
          bus.emit({
            type: "serverVerdict",
            xp: v.xp, level: v.level, levelUp: v.level_up, axisBand: v.axis_band,
          });
        } catch {
          /* offline end: local verdict only */
        }
      })();
    }
  });
  void newId; // batcher generates event ids internally

  return { seed: session.spawn_seed, dispose: () => unsub() };
}
