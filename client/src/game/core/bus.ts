/**
 * Game -> UI event bus.
 * The engine emits; React subscribes through a zustand adapter in src/state.
 * UI never reaches into the ECS world; the engine never imports React.
 */
export type GameEvent =
  | { type: "rageChanged"; value: number; band: RageBand }
  | { type: "scoreChanged"; destruction: number; rescue: number }
  | { type: "judgeCommentQueued"; i18nKey: string }
  | { type: "maxRageResolutionStarted"; timerS: number }
  | { type: "sessionEnded"; reason: "timer" | "cameld" | "player_exit" };

export type RageBand = "serene" | "irritated" | "furious" | "berserk";

type Listener = (e: GameEvent) => void;

const listeners = new Set<Listener>();

export const bus = {
  emit(e: GameEvent): void {
    for (const l of listeners) l(e);
  },
  subscribe(l: Listener): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};
