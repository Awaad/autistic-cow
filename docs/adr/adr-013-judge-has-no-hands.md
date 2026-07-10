# ADR-013: The Judge has no hands
**Status:** accepted
**Context:** Tying score or lives to moral direction would make the game
punish choices — a morality tax that collapses the psychological experiment
into a lecture. We want harsh judgment WITHOUT mechanical punishment.
**Decision:** Judgment never touches economy. Concretely:
1. Two identity scores — Havoc (destruction) and Grace (rescue) — displayed
   side by side, converting to currency/XP/energy at EXACTLY equal rates.
   They reveal direction; they never reward one.
2. Lives ("Nerves", 3/session) are lost only to amoral failures: rage
   mismanagement (max-rage unresolved -> camel takedown = -1 Nerve, respawn
   dazed at rage 40, combo dead, scores kept; last Nerve -> CAMEL'D, session
   over). Saint and psycho die identically.
3. Nerves return direction-blind: combined-score intensity milestones or the
   pet photo. XP/levels: combined score, direction-blind.
4. The Judge's ONLY output is voice (comments, titles, end-cards). Any PR
   that makes a karma-weighted event change currency, energy, Nerves, XP, or
   drop rates violates this ADR by definition.
**Consequences:** score measures how hard you played; the Judge measures
which direction. Naming rule: score/track names must carry no built-in
valence in ANY locale ("Grace" is borderline — verify with native testers,
rename if one track reads as "the good one").
