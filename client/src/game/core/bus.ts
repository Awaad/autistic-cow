/**
 * Game -> UI event bus.
 * bus: game emits, React subscribes. commands: React emits, game subscribes.
 * Two one-way channels; the engine still never imports React.
 */
export type GameEvent =
  | { type: "rageChanged"; value: number; band: RageBand }
  | { type: "scoreChanged"; destruction: number; rescue: number }
  | { type: "timerTick"; remainingS: number }
  | { type: "nervesChanged"; remaining: number }
  | { type: "camelStateChanged"; state: "approaching" | "gone" }
  | { type: "maxRageResolutionStarted"; timerS: number }
  | { type: "maxRageResolved"; via: "photo" | "camel" }
  | { type: "judgeComment"; text: string }
  | { type: "rescueHint"; state: "none" | "calm_needed" | "soothing"; pct: number }
  | { type: "judgeEventRecorded"; etype: string; rage: number }
  | { type: "sessionStats"; destruction: number; rescue: number; peakRage: number; nervesLost: number }
  | { type: "serverVerdict"; xp: number; level: number; levelUp: boolean; axisBand: string }
  | { type: "bootError"; message: string }
  | { type: "sessionEnded"; reason: "timer" | "cameld" | "player_exit" };


export type RageBand = "serene" | "irritated" | "furious" | "berserk";

export type GameCommand =
  | { type: "photoProvided" }   // any file accepted; Later: real pipeline
  | { type: "refusePhoto" };


function channel<T>() {
  const listeners = new Set<(m: T) => void>();
  return {
    emit(m: T): void {
      for (const l of listeners) l(m);
    },
    subscribe(l: (m: T) => void): () => void {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

export const bus = channel<GameEvent>();
export const commands = channel<GameCommand>();
