# ADR-011: Own auth (no Clerk/Kinde)
**Status:** accepted
**Context:** Our hard parts (anon-first identity, merge-at-the-wall) are custom
regardless. Hosted auth adds a US subprocessor to a German-targeted privacy
story, an availability risk for Russian-speaking users, and per-MAU pricing
exactly at success.
**Decision:** argon2id + JWT access/refresh in-house (`core/security.py`);
Google/Apple OAuth via authlib (they hold passwords, we hold the link).
Anonymous players get real JWTs (anon=true) — first-class from second one.
**Consequences:** we own security hygiene (rotation, rate limits, lockouts —
Stage 3 checklist); revisit ONLY if signup flows exceed 2 weeks of dev time.
