# ADR-001: UUIDv7 via centralized ID helper
**Context:** Random v4 PKs scatter B-tree inserts on hot event tables; ID
strategy scattered across code is unswappable later.
**Decision:** UUIDv7 everywhere, generated only through `server/app/core/ids.py`
(`new_id()`) and `client/src/game/core/ids.ts` (`newId()`). DB defaults remain
as manual-insert safety nets. IDs are never secrets — `new_token()` for those.
**Consequences:** chronological index locality; one-file backend swaps
(uuid-utils → py3.14 stdlib → PG18 native); v7 leaks creation time — accepted,
every table has created_at anyway.
