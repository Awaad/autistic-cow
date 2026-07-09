/** bitecs world + typed wrapper seam. If bitecs ergonomics lose
 * the Stage 1 fight, miniplex slots in behind this module. */
import { createWorld } from "bitecs";

export type World = ReturnType<typeof createWorld>;

export function newWorld(): World {
  return createWorld();
}
