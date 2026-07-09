import { Types, defineComponent } from "bitecs";

/** Tag/data components. Transforms live in Rapier; render syncs from bodies. */
export const CowTag = defineComponent();
export const Smashable = defineComponent({ points: Types.ui16 });
export const Pickup = defineComponent({ kind: Types.ui8 }); // 0 beer, 1 wine
export const Dead = defineComponent(); // marked for removal this frame
