/** Input — keyboard (wasd/arrows) + touch virtual joystick, one InputState.
 * The engine never knows fingers from keys; rescue-band gentleness must be
 * expressible on a phone. */

export interface InputState {
  x: number; // -1..1 strafe
  z: number; // -1..1 forward/back
}

const JOY_RADIUS = 56; // px to full deflection

export function createInput(): { state: InputState; dispose: () => void } {
  const down = new Set<string>();
  const state: InputState = { x: 0, z: 0 };
  let touchId: number | null = null;
  let ox = 0;
  let oy = 0;

  const recomputeKeys = (): void => {
    if (touchId !== null) return; // finger has the wheel
    state.x = (down.has("KeyD") || down.has("ArrowRight") ? 1 : 0) -
              (down.has("KeyA") || down.has("ArrowLeft") ? 1 : 0);
    state.z = (down.has("KeyS") || down.has("ArrowDown") ? 1 : 0) -
              (down.has("KeyW") || down.has("ArrowUp") ? 1 : 0);
  };
  const onDown = (e: KeyboardEvent): void => { down.add(e.code); recomputeKeys(); };
  const onUp = (e: KeyboardEvent): void => { down.delete(e.code); recomputeKeys(); };

  const onPointerDown = (e: PointerEvent): void => {
    if (e.pointerType !== "touch" || touchId !== null) return;
    touchId = e.pointerId;
    ox = e.clientX;
    oy = e.clientY;
  };
  const onPointerMove = (e: PointerEvent): void => {
    if (e.pointerId !== touchId) return;
    const dx = (e.clientX - ox) / JOY_RADIUS;
    const dy = (e.clientY - oy) / JOY_RADIUS;
    const len = Math.hypot(dx, dy);
    const s = len > 1 ? 1 / len : 1;
    state.x = dx * s;
    state.z = dy * s; // screen-down = toward camera = +z, matches keyboard S
  };
  const onPointerEnd = (e: PointerEvent): void => {
    if (e.pointerId !== touchId) return;
    touchId = null;
    state.x = 0;
    state.z = 0;
    recomputeKeys();
  };

  window.addEventListener("keydown", onDown);
  window.addEventListener("keyup", onUp);
  window.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerEnd);
  window.addEventListener("pointercancel", onPointerEnd);
  return {
    state,
    dispose: () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerEnd);
      window.removeEventListener("pointercancel", onPointerEnd);
    },
  };
}
