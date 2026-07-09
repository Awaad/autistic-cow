Autistic Cow(for now)  Data Schema v1.0
Store: PostgreSQL 16+ (primary), Redis (leaderboards/sessions/rate-limits), S3-compatible object storage (photos, replays) Principles: identity/behavior separation · consent as data · append-only event logs · map-as-content · 6-month retention from last activity


0. Conventions
Table names: snake_case, plural. PKs: id UUID DEFAULT gen_random_uuid().
All timestamps TIMESTAMPTZ, UTC. created_at on every table.
Soft references from behavior layer → identity layer via player_id only; no PII ever outside the identity layer.
Enums as Postgres ENUM types (listed at bottom).
Every judged/analytics event is append-only; no UPDATEs on event tables.


1. Identity Layer (PII lives here and ONLY here)
CREATE TABLE players (

    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    email            CITEXT UNIQUE NOT NULL,

    password_hash    TEXT,                        -- null if social-auth only

    auth_provider    auth_provider NOT NULL DEFAULT 'email',

    locale           locale NOT NULL DEFAULT 'en',        -- en | de | ru

    birth_year       SMALLINT NOT NULL,           -- 18+ gate; year only, minimal PII

    display_name     TEXT NOT NULL,

    status           player_status NOT NULL DEFAULT 'active',

                     -- active | dormant_warned | orphaned | deleted

    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

    last_seen_at     TIMESTAMPTZ NOT NULL DEFAULT now(),  -- drives retention job

    orphaned_at      TIMESTAMPTZ

);

CREATE INDEX idx_players_last_seen ON players (last_seen_at)

    WHERE status = 'active';

CREATE TABLE consents (

    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    player_id     UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,

    consent_key   consent_key NOT NULL,

    -- functional_tos | herd_album | product_analytics | personalized_comments

    -- | marketing_profiling | real_location_ar | photo_promotional | paid_processing

    granted       BOOLEAN NOT NULL,

    source        TEXT NOT NULL,          -- 'signup' | 'settings' | 'in_game_offer'

    policy_version TEXT NOT NULL,         -- privacy-policy version at grant time

    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()

);

-- Append-only: a consent CHANGE is a new row. Current state = latest row

-- per (player_id, consent_key). This is your audit trail.

CREATE INDEX idx_consents_lookup ON consents (player_id, consent_key, created_at DESC);

Retention job (nightly):

last_seen_at < now − 150d AND status='active' → status='dormant_warned', send email.
last_seen_at < now − 180d → orphan: null out email/password_hash/display_name (replace with deleted_<id-prefix>), status='orphaned', delete Herd photos from object storage, keep behavior layer (now anonymous).
User-requested deletion → same orphan procedure immediately (≤30d SLA).


2. Behavior Layer (anonymous-safe; survives orphaning)
CREATE TABLE player_profiles (

    player_id        UUID PRIMARY KEY,   -- soft ref; NOT a FK on purpose

                                         -- (row survives identity deletion)

    moral_axis       REAL NOT NULL DEFAULT 0.0,   -- [-1.0 .. 1.0], recomputed

    axis_band        axis_band NOT NULL DEFAULT 'flexible',

    total_sessions   INT NOT NULL DEFAULT 0,

    total_destruction_score BIGINT NOT NULL DEFAULT 0,

    total_rescue_score      BIGINT NOT NULL DEFAULT 0,

    camel_deaths     INT NOT NULL DEFAULT 0,

    lures_executed   INT NOT NULL DEFAULT 0,

    wines_found      INT NOT NULL DEFAULT 0,

    currency_balance BIGINT NOT NULL DEFAULT 0,

    energy           SMALLINT NOT NULL DEFAULT 3,

    energy_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()

);

CREATE TABLE sessions (

    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    player_id       UUID NOT NULL,

    district_id     UUID NOT NULL REFERENCES districts(id),

    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    ended_at        TIMESTAMPTZ,

    end_reason      session_end_reason,   -- timer | cameld | player_exit | error

    destruction_score INT NOT NULL DEFAULT 0,

    rescue_score    INT NOT NULL DEFAULT 0,

    peak_rage       SMALLINT,

    max_rage_events SMALLINT NOT NULL DEFAULT 0,

    client_platform TEXT,                 -- 'web' | 'app_ios' | 'app_android'

    locale          locale NOT NULL

);

CREATE INDEX idx_sessions_player ON sessions (player_id, started_at DESC);

-- THE JUDGE'S LOG — the most valuable table in the product.

CREATE TABLE judge_events (

    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    session_id   UUID NOT NULL REFERENCES sessions(id),

    player_id    UUID NOT NULL,

    event_type   judge_event_type NOT NULL,

    -- rescue_completed | rescue_ignored | child_scared | child_helped

    -- | destruction_spree | photo_calm_used | cameld | lure_executed

    -- | wine_found | mission_completed | mission_abandoned | hesitation

    target_kind  TEXT,                    -- 'dog' | 'cat' | 'ice_cream_cart' ...

    rage_at_event SMALLINT NOT NULL,      -- context is the signal

    karma_weight REAL NOT NULL,           -- from tuning.json at write time

    seq_in_session INT NOT NULL,          -- sequence matters (hesitation chains)

    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()

);

CREATE INDEX idx_judge_player_time ON judge_events (player_id, created_at DESC);

CREATE INDEX idx_judge_session_seq ON judge_events (session_id, seq_in_session);

-- Partition by month at scale; aggregate rows older than 90d into

-- judge_events_monthly_rollup, then drop raw partitions.

CREATE TABLE judge_comments_served (

    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    session_id  UUID NOT NULL REFERENCES sessions(id),

    player_id   UUID NOT NULL,

    comment_id  UUID REFERENCES judge_comment_pool(id),  -- null if LLM-generated

    generated_text TEXT,                 -- filled only for LLM lines (review cache)

    locale      locale NOT NULL,

    trigger_event_id BIGINT REFERENCES judge_events(id),

    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()

);


3. Content Layer (map-as-data; Cyprus = rows, not code)
CREATE TABLE regions (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    slug TEXT UNIQUE NOT NULL,            -- 'north-cyprus'

    name JSONB NOT NULL,                  -- {"en":..., "de":..., "ru":...}

    active BOOLEAN NOT NULL DEFAULT false,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()

);

CREATE TABLE districts (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    region_id UUID NOT NULL REFERENCES regions(id),

    slug TEXT NOT NULL,                   -- 'kyrenia-harbor'

    name JSONB NOT NULL,

    scene_asset_key TEXT NOT NULL,        -- pointer to 3D scene bundle

    spawn_template JSONB NOT NULL,        -- smashables/rescueables/beer density

    active BOOLEAN NOT NULL DEFAULT false,

    UNIQUE (region_id, slug)

);

CREATE TABLE venues (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    district_id UUID NOT NULL REFERENCES districts(id),

    slug TEXT NOT NULL,

    name JSONB NOT NULL,

    kind venue_kind NOT NULL,             -- bar | landmark | partner_venue

    ingame_coords JSONB NOT NULL,         -- {x,y,z} in scene space

    real_coords JSONB,                    -- coarse lat/lng, ONLY for AR partner venues

    sponsor_id UUID REFERENCES sponsors(id),

    UNIQUE (district_id, slug)

);

CREATE TABLE missions (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    district_id UUID NOT NULL REFERENCES districts(id),

    venue_id UUID REFERENCES venues(id),

    mission_type mission_type NOT NULL,

    -- bar_pilgrimage | rescue_chain | controlled_demolition | wine_hunt | ar_checkin

    config JSONB NOT NULL,                -- type-specific params

    reward JSONB NOT NULL,                -- {currency, energy_fragments, title_progress}

    text JSONB NOT NULL,                  -- localized brief {"en":{...},"de":{...},"ru":{...}}

    active BOOLEAN NOT NULL DEFAULT false,

    requires_consent consent_key          -- 'real_location_ar' for AR missions

);

CREATE TABLE mission_progress (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    player_id UUID NOT NULL,

    mission_id UUID NOT NULL REFERENCES missions(id),

    session_id UUID REFERENCES sessions(id),

    status mission_status NOT NULL DEFAULT 'offered',

    -- offered | active | completed | abandoned

    progress JSONB NOT NULL DEFAULT '{}',

    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (player_id, mission_id)

);

CREATE TABLE judge_comment_pool (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    locale locale NOT NULL,

    axis_band axis_band NOT NULL,         -- menace|enthusiast|flexible|hero|whisperer

    trigger_pattern TEXT NOT NULL,        -- 'child_scared_x3' | 'rescue_ignored' ...

    text TEXT NOT NULL,                   -- culture-REWRITTEN, not translated

    weight REAL NOT NULL DEFAULT 1.0,

    source comment_source NOT NULL DEFAULT 'curated',  -- curated | llm_approved

    active BOOLEAN NOT NULL DEFAULT true

);


4. Photos & the Herd
CREATE TABLE photos (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    player_id UUID NOT NULL,

    storage_key TEXT NOT NULL,            -- S3 key; EXIF ALREADY STRIPPED

    purpose photo_purpose NOT NULL,       -- pet_calm | mission_photo | herd_upload

    classifier_label TEXT,                -- 'dog' | 'cat' | 'not_animal' ...

    classifier_confidence REAL,

    authenticity_score REAL,              -- 0..1 composite (fraud prevention)

    bonus_tier bonus_tier NOT NULL,       -- full | reduced | rejected

    in_herd BOOLEAN NOT NULL DEFAULT false,  -- true only with herd_album consent

    session_id UUID REFERENCES sessions(id),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()

);

CREATE INDEX idx_photos_player ON photos (player_id, created_at DESC);

-- EXIF quarantine: parsed metadata NEVER joins the photo row.

CREATE TABLE photo_meta_quarantine (

    photo_id UUID PRIMARY KEY REFERENCES photos(id) ON DELETE CASCADE,

    capture_source TEXT,                  -- 'live_camera' | 'gallery'

    device_hint TEXT,                     -- UA-derived, coarse ('iPhone', 'Android')

    exif_device TEXT,                     -- from EXIF Make/Model if present

    exif_present BOOLEAN NOT NULL,

    exif_datetime_delta_s INT,            -- |capture time − upload time|

    gps_region TEXT,                      -- COARSENED to region ('cy-kyrenia');

                                          -- precise coords parsed in memory,

                                          -- NEVER written to disk

    phash TEXT,                           -- perceptual hash (duplicate detection)

    reverse_match BOOLEAN,                -- known-internet-image hit

    processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    purge_after TIMESTAMPTZ NOT NULL      -- default now()+30d; nightly purge job

);

-- Authenticity scoring reads this table; marketing-signal derivation reads it

-- ONLY where consents(marketing_profiling)=true, writes derived coarse signals

-- to marketing_signals, and never copies raw values.

CREATE TABLE marketing_signals (         -- populated ONLY under opt-in

    player_id UUID PRIMARY KEY,

    device_tier TEXT,                     -- 'high' | 'mid' | 'low'

    coarse_region TEXT,                   -- region slug, never coordinates

    play_daypart TEXT,                    -- 'evening' etc.

    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()

);


5. Sponsorship
CREATE TABLE sponsors (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name TEXT NOT NULL,

    kind sponsor_kind NOT NULL,           -- beer_brand | venue | other

    active BOOLEAN NOT NULL DEFAULT false,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()

);

CREATE TABLE brand_items (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    sponsor_id UUID NOT NULL REFERENCES sponsors(id),

    tier SMALLINT NOT NULL CHECK (tier BETWEEN 1 AND 3),

    rage_reduction SMALLINT NOT NULL,     -- overrides generic −25

    perks JSONB NOT NULL DEFAULT '{}',    -- {score_bonus, energy_fragments, anim_key}

    markets locale[] NOT NULL,            -- alcohol-ad compliance per market

    active BOOLEAN NOT NULL DEFAULT false

);

CREATE TABLE brand_interactions (        -- the sponsorship sales deck

    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    player_id UUID NOT NULL,

    brand_item_id UUID NOT NULL REFERENCES brand_items(id),

    session_id UUID NOT NULL REFERENCES sessions(id),

    interaction interaction_kind NOT NULL, -- seen | consumed | ar_checkin

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()

);

CREATE INDEX idx_brand_interactions_item ON brand_interactions (brand_item_id, created_at);


6. Redis Keyspace (convention)
leaderboard:{axis_band}:{period}     ZSET  score by player_id (weekly/alltime)

session:live:{session_id}            HASH  live rage/score (TTL 2h)

ratelimit:{route}:{player_id}        counters

energy:lock:{player_id}              distributed lock for energy spend

anon:merge:{merge_token}             TTL 24h — signup merge of local profile


7. Enum Definitions
CREATE TYPE auth_provider AS ENUM ('email','google','apple');

CREATE TYPE locale AS ENUM ('en','de','ru');

CREATE TYPE player_status AS ENUM ('active','dormant_warned','orphaned','deleted');

CREATE TYPE consent_key AS ENUM ('functional_tos','herd_album','product_analytics',

  'personalized_comments','marketing_profiling','real_location_ar',

  'photo_promotional','paid_processing');

CREATE TYPE axis_band AS ENUM ('menace','enthusiast','flexible','hero','whisperer');

CREATE TYPE session_end_reason AS ENUM ('timer','cameld','player_exit','error');

CREATE TYPE judge_event_type AS ENUM ('rescue_completed','rescue_ignored',

  'child_scared','child_helped','destruction_spree','photo_calm_used','cameld',

  'lure_executed','wine_found','mission_completed','mission_abandoned','hesitation');

CREATE TYPE venue_kind AS ENUM ('bar','landmark','partner_venue');

CREATE TYPE mission_type AS ENUM ('bar_pilgrimage','rescue_chain',

  'controlled_demolition','wine_hunt','ar_checkin');

CREATE TYPE mission_status AS ENUM ('offered','active','completed','abandoned');

CREATE TYPE photo_purpose AS ENUM ('pet_calm','mission_photo','herd_upload');

CREATE TYPE bonus_tier AS ENUM ('full','reduced','rejected');

CREATE TYPE comment_source AS ENUM ('curated','llm_approved');

CREATE TYPE sponsor_kind AS ENUM ('beer_brand','venue','other');

CREATE TYPE interaction_kind AS ENUM ('seen','consumed','ar_checkin');


8. Data-Flow Invariants (enforced in code review, forever)
No PII outside players + consents. Ever.
photo_meta_quarantine never joins to photos in any API response.
Precise GPS from EXIF exists in memory only; only gps_region touches disk.
marketing_signals writes require a live marketing_profiling=true consent check at write time, not a cached flag.
Orphaning nulls identity and deletes object-storage photos; behavior rows persist.
Event tables are append-only; corrections are new rows.
Every consent-gated feature checks the latest consent row, and every check is logged in application logs (audit trail).

