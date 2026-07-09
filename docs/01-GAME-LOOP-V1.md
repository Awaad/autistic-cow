Name To Be Decided - Core Game Loop & Design Document
Version: 1.0 (pre-production base) Status: Design-locked pending playtest tuning Platforms: Browser (Three.js/WebGL) → later Capacitor app wrap → WebXR AR mode Languages: English, German, Russian (culture-rewritten, not translated) Audience: 18+ (dark comedy, alcohol themes)


1. Core Fantasy
You are barely in control of a perpetually enraged cow rampaging through North Cyprus. Destruction is fun, easy, and rewarded. Restraint is hard, deliberate, and also rewarded - differently. The game silently watches which one you choose and judges you for it, out loud, in your own culture's voice.

One thing on Earth frightens the cow: a camel that has no business being in Cyprus. Nobody explains why he is there. He just is.

The pillar sentence (test every feature against it):

Rage earns. Calm spends. The Judge remembers.


2. The Three Meters
2.1 Rage (0–100)
The cow's natural state. Governs speed, damage, and controllability.

Band
Name
Speed
Damage
Steering
Notes
0–19
Serene
0.8×
0.5×
Precise
Only band where delicate interactions unlock
20–49
Irritated
1.0×
1.0×
Normal
Default play band
50–79
Furious
1.3×
1.6×
Loose - cow drifts toward smashables
Combo multipliers active
80–99
Berserk
1.6×
2.2×
Barely responsive - input is a suggestion
Screen shake, red vignette, camel attraction ×2
100
MAXED
-
-
None
Triggers Max-Rage Resolution (§5)


Rage sources (tunable defaults):

Passive climb: +1 per 4 seconds (always, even standing still)
Trigger sightings (line-of-sight events): car alarm +8, children giggling +5, camel silhouette on horizon +15, wedding music +6, scooter horn +4
Taking a hit / obstacle collision that doesn't break: +3

Rage sinks:

Beer (common pickup): −25
Beer (sponsored-brand tier, see §8): −25 to −40 by brand tier
Wine (rare, ~1 per 3 sessions): rage → 0 instantly, +2× score multiplier for 60s
Petting-zoo fallback interaction (§5.3): −15, 90s cooldown
Live pet photo (§5.2): rage → 0, +energy bonus
2.2 Score / Currency (session score → persistent currency)
Destruction awards points scaled by object class × rage-band multiplier × combo chain (chain window: 4s between smashes).
Rescues award points on a separate track (equal earning power — the game must never make the saint path economically worse, only mechanically harder; morality is a choice, not a tax).
Session score converts to persistent currency (cosmetics, session energy, future paid features).
2.3 Energy (session gating, monetization surface)
1 energy = 1 session. Regenerates 1 per N hours (tune at beta; start 3h, cap 5).
Bonus energy sources: pet photo with passing authenticity score (+1, daily cap 1), sponsored brand interactions (+1, per campaign rules), streak login (+1 at day 3).


3. The World & Session Structure
3.1 Session shape
One district of Kyrenia per session. Target length 5–8 minutes (mobile-friendly for the later app wrap).
Fixed contents per district instance:
Smashable population (procedurally placed from district templates)
6–10 rescueables (dogs, cats, ice-cream cart, backgammon table, laundry line…)
3–6 children NPCs (see §4)
1–2 missions available (see §7)
Beer spawns: enough that a player looking for beer finds it in ≤45s; a player not looking passes 2–3 without noticing
Wine: rare spawn, hidden placement (rooftops, cellars, behind the church)
1 guaranteed camel event (§6)
Session ends on: timer, energy-relevant fail state (camel'd), or player exit.
3.2 End-of-session screen
Score breakdown (destruction vs rescue tracks, side by side - the visual comparison IS a psychological nudge)
The Judge's verdict: current title on the Psycho↔Saint axis (§9)
Best-moment replay: auto-recorded 10s clip of the highest-combo or highest-drama moment, one-tap share (viral loop)
Mission results, currency earned, energy state
One meme interstitial (§10) - skippable after 2s


4. Children NPCs - Design Law
Children exist as world characters. Hard rules, (TBD), enforced in physics/code, not in content review:

The cow's hitbox and children's hurtboxes never intersect. Children have a repulsion field: any cow approach within radius R triggers their flee behavior with guaranteed escape pathing(tripping failing). There is no animation, state, or bug path in which the cow makes contact with a child(Only in one case-TBD).
Children can be scared (they scatter, scream comedically, drop things). Scaring is a tracked Judge event (child_scared) with negative karma weight.
Dropped items (ice cream, balloon, toy) become rescueables: in Serene band, the cow can nudge the item back to the child → big positive karma event (child_helped), unique animation (child pats the cow's nose; the cow, confused, tolerates it for exactly 1.5 seconds).
Children never appear in fail states, camel events, or meme content.
The Judge comments on child-related behavior patterns (chasing children around the map is legal in-game and mechanically pointless — it earns nothing except the Judge's escalating attention: "Third time chasing the kids. They don't drop beer, you know.")

This preserves the full psychological edge (the game notices and names the player's impulse) with zero depiction of harm.


5. Max-Rage Resolution (the signature moment)
Trigger: Rage reaches 100 without a sink.
5.1 The Cutaway
Hard camera cut. Game world desaturates. The cow stands center-frame, breathing. Fourth-wall text, localized:

EN: "She's gone. Only one thing brings her back. Show her something soft."
DE: "Sie ist weg. Nur eines holt sie zurück. Zeigen Sie ihr etwas Weiches." (formal Sie — the bureaucratic distance IS the joke)
RU: "Всё. Её больше нет. Вернуть её может только одно. Покажи ей что-нибудь мягкое."

15-second decision timer.
5.2 Path A — The Pet Photo
Camera/gallery prompt (browser: getUserMedia live capture preferred; gallery pick allowed with lower authenticity weight).
Photo → ingestion pipeline (§11): animal-verification classifier + authenticity scoring.
Pass: rage → 0. The cow sits down. Unique calm animation (she looks at the photo; the photo appears on a tiny billboard in-world). +1 energy (daily cap). Photo → Herd album if consented.
Fail classifier (not an animal): soft-reject with humor — "That is a sandwich. She is not calmed by sandwiches." One retry within the timer.
Authenticity score low (suspected internet image): bonus reduced (rage → 30 instead of 0, no energy). Never hard-block; never accuse. Judge may note it: "Recycled love. She can tell."
5.3 Path B — No photo / refusal / timeout
The camel arrives.

Ominous single-note music sting. Dust on the horizon. The camel walks — never runs — directly to the cow.
Takedown: full slapstick bodyslam. Rotating animation pool (launch with 3, add via content drops — players will fail on purpose to collect them; this is intended).
Session ends. Humiliation screen: "CAMEL'D." with stats and share button.
Slapstick only. No cruelty, no crude content — repeatability is the goal.
5.4 Fallback (no camera / no pet / permission denied)
"Petting zoo" pen exists in every district. Interacting in ANY rage band during max-rage countdown gives rage → 40 (survival, not victory). Progression is never hard-gated behind camera permission (app-store requirement and basic decency).
5.5 The dark elegance (design intent, keep in all docs)
The rescue mechanic requires proving you love something. A full-psycho player maintaining a folder of pet photos as ammunition is a player-created story, and the Judge names it: "You use love as a resource. Fascinating."


6. The Camel
6.1 Behavior model
Attraction: destruction generates "noise heat" on a district heatmap. Sustained high heat spawns the camel event early; low-heat sessions get him at the scheduled beat (~70% through session).
He never runs. Constant walking speed slightly below the cow's Irritated-band speed. Dread through inevitability, not pursuit speed.
Line-of-sight to camel: +15 rage (fear feeds the thing that summons him — intentional death spiral for greedy players).
6.2 Player options during camel presence
Option
Mechanics
Risk/Reward
Flee district zone
Break line-of-sight for 20s
Lose current combo chain; safe
Hide
Terrain occlusion spots (barns, alleys); breathing minigame (rhythm tap keeps rage passive-climb frozen)
Tense; failed rhythm = rage spike
The Lure (advanced)
Kite the camel's walk path through structures — HIS collisions score for YOU at 1.5×
Highest scoring strategy in the game; one mistimed turn = takedown


The Lure is the skill ceiling: weaponizing your own fear. Judge has a dedicated line pool for lure players: "Using him. Bold. He remembers too."
6.3 Lore rule (writing law)
The camel is never explained. No NPC dialogue, no mission text, no loading-screen lore may state why he is in Cyprus. The absence of explanation is canonical and permanent.


7. Missions
Data-driven (see schema: regions → venues → missions). North Cyprus is content, not code.

Launch mission types:

Bar pilgrimage — reach venue X in Serene band, take the in-game photo (photo mode unlocks only when calm — forces a beer-management plan).
Rescue chain — save N specific rescueables in one session.
Controlled demolition — destroy ONLY marked targets; hitting anything unmarked resets. (Rage management as puzzle.)
Wine hunt — cryptic clue to a wine spawn.
AR check-in (post-launch, opt-in real location)  physically visit a partner venue, AR camel or cow appears on premises, photo → reward. Sponsorship surface. Game is 100% playable without it.


8. Beer, Wine & Brand Tiers
Generic beer: always available, −25 rage. No branding.
Sponsored brands: tiered by partnership level:
Tier 1: −30 rage, standard spawn
Tier 2: −35 rage, +small score bonus, branded fridge spawn point
Tier 3 (flagship): −40 rage, +energy fragment (3 fragments = 1 energy), unique drink animation
Wine: never branded at launch (scarcity mystique is worth more than a wine sponsor early; revisit at scale).
All brand interactions logged (brand_interactions) - this table IS the sponsorship sales deck.
Compliance: 18+ gate at account creation; alcohol-brand exposure only after age gate; per-market alcohol advertising rules checked before any brand goes live (DE rules differ from TRNC rules).


9. The Judge
9.1 The axis
Single float moral_axis ∈ [−1.0 … +1.0] per player. −1 = full psycho, +1 = full saint. Never displayed as a number. Computed from the judged-event log with recency weighting (last 5 sessions weigh 70%). Behavior can drift; the Judge notices drift specifically: "Saving things now? Who are you trying to convince?"
9.2 Judged events (append-only log; sequence matters)
rescue_completed, rescue_ignored (line-of-sight + proximity, no action), child_scared, child_helped, destruction_spree (combo ≥ X), photo_calm_used, cameld, lure_executed, wine_found, mission_completed, mission_abandoned, hesitation (approached a rescueable, waited, left — the richest signal in the game).
9.3 Comment engine
Launch: curated line pools per (event pattern × axis band × locale), weighted-random with no-repeat window. Minimum 40 lines per locale at launch.
Post-launch: server-side LLM generation from the event-log window (FastAPI backend advantage), with the curated pool as fallback and a human-review cache for generated lines before they enter rotation.
Localization law: lines are rewritten per culture, never translated.
EN: sarcastic, direct. "You didn't even look at the dog. Interesting."
DE: dry, bureaucratic, formal Sie. "Ihr Verhalten wurde dokumentiert."
RU: fatalist deadpan. "Собаку не спас. Ну и правильно. Всех не спасёшь."
Frequency cap: max 1 Judge comment per 90s of play. Scarcity = weight.
9.4 Titles (end-of-session, leaderboard-visible)
Axis bands map to localized titles (examples, EN): −1.0..−0.6 "Certified Menace" · −0.6..−0.2 "Enthusiast" · −0.2..+0.2 "Morally Flexible" · +0.2..+0.6 "Reluctant Hero" · +0.6..+1.0 "Cow Whisperer". Titles are the retention hook: players grind to keep or change them. Leaderboards are per-axis-band (psychos compete with psychos).


10. Meme Interstitials
100% original content in the game's art style: short animated clips (adults falling off scooters, tourists losing hats, sunburn panic, the camel photobombing). No sourced internet reels, no real people, no minors  ever.
Sourced if we can manage the rights, also place for ads.
Shown at: end-of-session (1, skippable after 2s), mission completion (rare pool).
Player-generated clips (the real meme engine): auto-recorded 10s best-moments with game watermark, one-tap share. This is the growth loop.


11. Pet-Photo Ingestion Pipeline (design-level)
capture/upload

   → EXIF parsed into quarantine table

   → AUTHENTICITY SCORE (functional, always on — fraud prevention):

       signals: live-capture vs gallery, EXIF/device coherence,

       perceptual-hash duplicate check, reverse-image match,

       EXIF-missing ≠ fraud (browsers strip it) — just a neutral signal

   → ANIMAL CLASSIFIER (functional, always on — is this a pet?)

   → decision: full bonus / reduced bonus / humorous soft-reject

   → EXIF STRIPPED from stored image (always)

   → marketing-signal derivation ONLY IF opted in (coarse region, device tier - location for specific missions)

   → store to object storage (S3-compatible, signed URLs) → Herd album if consented

Soft enforcement only: low authenticity = reduced reward, never accusation, never hard block.


12. Onboarding & Account Wall
Landing page → instant play, no signup. Anonymous session; Judge profile held in browser session storage only (never leaves the client). Cookie banner shown from first pixel.
First session ends → account wall: "She remembers you. Sign up so she doesn't forget." → on signup, local Judge profile merges into the account (the game already knows you — creepy, on-brand, converts).
Age gate (18+) at signup. Locale detection → language + culture pack (user-overridable).


13. Anti-Frustration & Safety Rails
Rage passive-climb pauses during menus, photo prompts, and Judge cutaways.
Colorblind-safe rage-band indicators (shape + color).
Session length hard-capped; no mechanics reward continuous multi-hour play (energy system doubles as healthy-session pacing).
All alcohol content is cartoon-styled; no realistic drunk mechanics, no drink-driving scenarios (the cow never operates vehicles - she IS the vehicle).
Panic-skip: any interstitial or Judge cutaway skippable after 2s.


14. Tuning Table (single source of truth)
All numeric values in this document live in config/tuning.json at build time  designers tune without deploys. Every value above is a launch default, not a law.

