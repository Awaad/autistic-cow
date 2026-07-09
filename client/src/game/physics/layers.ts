/**
 * Rapier collision groups — SAFETY-CRITICAL FILE.
 *
 * COW and CHILD share no membership/filter bits. This is mechanism #1 of the
 * children no-contact guarantee (mechanism #2: npcFleeSystem repulsion field).
 * CI test: tests/child-safety.test.ts. Changing these masks requires a
 * PR that explicitly says so in the title, forever.
 */
export const Group = {
  COW:        0b00000001,
  SMASHABLE:  0b00000010,
  RESCUEABLE: 0b00000100,
  CHILD:      0b00001000,
  CAMEL:      0b00010000,
  TERRAIN:    0b00100000,
  PICKUP:     0b01000000,
} as const;

// membership << 16 | filter  (Rapier convention)
export const CollisionGroups = {
  cow: (Group.COW << 16) | (Group.SMASHABLE | Group.CAMEL | Group.TERRAIN | Group.PICKUP | Group.RESCUEABLE),
  child: (Group.CHILD << 16) | (Group.TERRAIN), // children collide with terrain ONLY
  camel: (Group.CAMEL << 16) | (Group.COW | Group.SMASHABLE | Group.TERRAIN),
  smashable: (Group.SMASHABLE << 16) | (Group.COW | Group.CAMEL | Group.TERRAIN | Group.SMASHABLE),
  pickup: (Group.PICKUP << 16) | (Group.COW), // sensor: sensed by the cow only
} as const;

export function cowCanContact(otherMembership: number): boolean {
  return (CollisionGroups.cow & otherMembership) !== 0;
}
