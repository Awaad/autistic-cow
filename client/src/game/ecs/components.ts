import { Types, defineComponent } from "bitecs";

/** Tag/data components. Transforms live in Rapier; render syncs from bodies. */
export const CowTag = defineComponent();
export const Smashable = defineComponent({ points: Types.ui16 });
export const Pickup = defineComponent({ kind: Types.ui8 }); // 0 beer, 1 wine
/** kind: 0 dog, 1 cat, 2 ice_cream_cart, 3 dropped_ice_cream */
export const Rescueable = defineComponent({ kind: Types.ui8, points: Types.ui16 });
export const ChildTag = defineComponent();
export const Dead = defineComponent(); // marked for removal this frame
