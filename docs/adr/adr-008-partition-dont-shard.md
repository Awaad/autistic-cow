# ADR-008: Partition and replicate; do not shard
**Status:** accepted
**Context:** Even optimistic beta scale (~3M event rows/day) fits one Postgres
node. Sharding buys distributed pain.
**Decision:** Monthly partitioning on judge_events/brand_interactions with 90d
rollups. One async read replica at Stage 5–6 for analytics + failover. Keep
player_id as the natural partition key on all behavior tables and never join
across players on hot paths, so sharding remains possible for free.
**Consequences:** extra ops now; revisit if sustained write volume approaches
single-node limits (graphs trigger the revisit).
