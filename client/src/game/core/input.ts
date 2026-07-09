/** Keyboard input (WASD/arrows). Touch joystick lands soon. */
export interface InputState {
  x: number; // -1..1 strafe
  z: number; // -1..1 forward/back
}

export function createInput(): { state: InputState; dispose: () => void } {
  const down = new Set<string>();
  const state: InputState = { x: 0, z: 0 };

  const recompute = (): void => {
    state.x = (down.has("KeyD") || down.has("ArrowRight") ? 1 : 0) -
              (down.has("KeyA") || down.has("ArrowLeft") ? 1 : 0);
    state.z = (down.has("KeyS") || down.has("ArrowDown") ? 1 : 0) -
              (down.has("KeyW") || down.has("ArrowUp") ? 1 : 0);
  };
  const onDown = (e: KeyboardEvent): void => { down.add(e.code); recompute(); };
  const onUp = (e: KeyboardEvent): void => { down.delete(e.code); recompute(); };

  window.addEventListener("keydown", onDown);
  window.addEventListener("keyup", onUp);
  return {
    state,
    dispose: () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    },
  };
}
