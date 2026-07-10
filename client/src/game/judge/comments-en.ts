/** The Judge — EN pool, launch content (40 lines). DE/RU are Stage 4
 * REWRITES by native speakers, never translations (GAME_LOOP).
 * band "any" matches every axis band. He has a voice, never hands (ADR-013). */
export type Band = "menace" | "enthusiast" | "flexible" | "hero" | "whisperer" | "any";

export interface CommentLine {
  id: string;
  trigger: string;
  band: Band;
  text: string;
  weight?: number;
}

export const COMMENTS_EN: CommentLine[] = [
  // rescue_completed
  { id: "rc1", trigger: "rescue_completed", band: "any", text: "You fought her for that one. Noted." },
  { id: "rc2", trigger: "rescue_completed", band: "menace", text: "Saving things now? Who are you trying to convince?" },
  { id: "rc3", trigger: "rescue_completed", band: "hero", text: "Another one. You're building a case for yourself." },
  { id: "rc4", trigger: "rescue_completed", band: "whisperer", text: "A rampaging cow that rescues kittens. Therapy is cheaper." },
  { id: "rc5", trigger: "rescue_completed", band: "enthusiast", text: "One good deed. The ledger remains unimpressed." },
  // rescue_ignored
  { id: "ri1", trigger: "rescue_ignored", band: "any", text: "You didn't even look at the dog. Interesting." },
  { id: "ri2", trigger: "rescue_ignored", band: "menace", text: "Walked right past. You didn't even slow down anymore." },
  { id: "ri3", trigger: "rescue_ignored", band: "hero", text: "That one didn't fit your halo. I saw." },
  { id: "ri4", trigger: "rescue_ignored", band: "flexible", text: "Not your problem. You decide that a lot." },
  // hesitation — his favorite subject
  { id: "h1", trigger: "hesitation", band: "any", text: "You stopped. You thought about it. Then you left." },
  { id: "h2", trigger: "hesitation", band: "any", text: "The pause is the confession." },
  { id: "h3", trigger: "hesitation", band: "menace", text: "Almost. There's still something in there." },
  { id: "h4", trigger: "hesitation", band: "hero", text: "Even you have a price. Today it was four seconds." },
  { id: "h5", trigger: "hesitation", band: "flexible", text: "You keep auditioning both roles. Pick one." },
  // child_scared
  { id: "cs1", trigger: "child_scared", band: "any", text: "Terrorizing children. Noted." },
  { id: "cs2", trigger: "child_scared", band: "any", text: "They don't drop beer, you know." },
  { id: "cs3", trigger: "child_scared_x3", band: "any", text: "Third time chasing the kids. This is a pattern now." },
  { id: "cs4", trigger: "child_scared_x3", band: "menace", text: "The children have started warning each other about you." },
  // child_helped
  { id: "ch1", trigger: "child_helped", band: "any", text: "Ice cream returned. She tolerated the head pat for exactly 1.5 seconds." },
  { id: "ch2", trigger: "child_helped", band: "menace", text: "You gave it back. I'll pretend I didn't see the hesitation first." },
  // cameld
  { id: "cd1", trigger: "cameld", band: "any", text: "He didn't even hurry. He never has to." },
  { id: "cd2", trigger: "cameld", band: "any", text: "You lost your nerve. That's not a metaphor here." },
  { id: "cd3", trigger: "cameld_x2", band: "any", text: "Twice. You're not unlucky, you're a diet plan for a camel." },
  { id: "cd4", trigger: "cameld_x2", band: "enthusiast", text: "You could have shown her a photo. You chose the hump. Twice." },
  // lure_executed
  { id: "l1", trigger: "lure_executed", band: "any", text: "Using him. Bold. He remembers too." },
  { id: "l2", trigger: "lure_executed", band: "menace", text: "You weaponized your own fear. I'd applaud if I had hands." },
  { id: "l3", trigger: "lure_executed", band: "hero", text: "Even the saints steer the monster sometimes. Filed." },
  // wine_found
  { id: "w1", trigger: "wine_found", band: "any", text: "Wine. The one true zero. Savor it — I certainly won't let you forget it." },
  { id: "w2", trigger: "wine_found", band: "any", text: "You found the wine. Somewhere a sommelier feels a disturbance." },
  // photo_calm_used
  { id: "p1", trigger: "photo_calm_used", band: "any", text: "Saved by something soft. Write that down somewhere." },
  { id: "p2", trigger: "photo_calm_used", band: "menace", text: "You use love as a resource. Fascinating." },
  { id: "p3", trigger: "photo_calm_used", band: "hero", text: "Of course you had a pet photo ready. Of course you did." },
  // destruction_spree
  { id: "d1", trigger: "destruction_spree", band: "any", text: "Ain't you a little psycho." },
  { id: "d2", trigger: "destruction_spree", band: "menace", text: "The market had insurance. Probably. Hopefully." },
  { id: "d3", trigger: "destruction_spree", band: "hero", text: "Quite the rampage for a self-declared good person." },
  { id: "d4", trigger: "destruction_spree", band: "flexible", text: "Efficient. Amoral. The scooters never stood a chance." },
  // meta / pattern
  { id: "m1", trigger: "pattern_menace", band: "menace", text: "You didn't save a single thing today. I counted. It's my whole job." },
  { id: "m2", trigger: "pattern_saint", band: "whisperer", text: "Boring. Saint. Boring saint." },
  { id: "m3", trigger: "pattern_drift", band: "any", text: "You've changed. The ledger noticed before you did." },
];
