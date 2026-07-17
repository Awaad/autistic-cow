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
  | { type: "maxRageResolutionStarted"; timerS: number; pettingZoo: boolean }
  | { type: "maxRageResolved"; via: "photo" | "camel" | "petting" }
  | { type: "judgeComment"; text: string }
  | { type: "rescueHint"; state: "none" | "calm_needed" | "soothing"; pct: number }
  | { type: "judgeEventRecorded"; etype: string; rage: number }
  | { type: "moment"; kind: string }
  | { type: "missionProgress"; missionId: string; progress: number; label: string; reset: boolean }
  | { type: "missionCompleted"; missionId: string }
  | { type: "sessionStats"; destruction: number; rescue: number; peakRage: number; nervesLost: number }
  | { type: "serverVerdict"; xp: number; level: number; levelUp: boolean; axisBand: string }
  | { type: "bootError"; message: string }
  | { type: "sessionEnded"; reason: "timer" | "cameld" | "player_exit" };


export type RageBand = "serene" | "irritated" | "furious" | "berserk";

export type GameCommand =
  | { type: "photoCalm"; rageFloor: number } 
  | { type: "refusePhoto" }
  | { type: "pettingZoo" };


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
