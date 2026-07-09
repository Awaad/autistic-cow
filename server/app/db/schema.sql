-- autistic-cow consolidated schema v1.0 — mirrors docs/02_DATA_SCHEMA.md
-- Applied by alembic migration 0001 via op.execute. Future changes: normal
-- alembic revisions; this file is the genesis block, never edited after merge.

CREATE EXTENSION IF NOT EXISTS citext;

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
  'lure_executed','wine_found','mission_completed','mission_abandoned','hesitation',
  'event_invalidated');
CREATE TYPE venue_kind AS ENUM ('bar','landmark','partner_venue');
CREATE TYPE mission_type AS ENUM ('bar_pilgrimage','rescue_chain',
  'controlled_demolition','wine_hunt','ar_checkin');
CREATE TYPE mission_status AS ENUM ('offered','active','completed','abandoned');
CREATE TYPE photo_purpose AS ENUM ('pet_calm','mission_photo','herd_upload');
CREATE TYPE bonus_tier AS ENUM ('full','reduced','rejected');
CREATE TYPE comment_source AS ENUM ('curated','llm_approved');
CREATE TYPE sponsor_kind AS ENUM ('beer_brand','venue','other');
CREATE TYPE interaction_kind AS ENUM ('seen','consumed','ar_checkin');

-- ===== identity layer (ONLY place with PII) =====
CREATE TABLE players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- app supplies UUIDv7; default = manual-insert net
    email CITEXT UNIQUE,
    password_hash TEXT,
    auth_provider auth_provider NOT NULL DEFAULT 'email',
    locale locale NOT NULL DEFAULT 'en',
    birth_year SMALLINT,
    display_name TEXT,
    is_anonymous BOOLEAN NOT NULL DEFAULT false,
    status player_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    orphaned_at TIMESTAMPTZ,
    CONSTRAINT registered_needs_identity CHECK (is_anonymous OR (email IS NOT NULL AND birth_year IS NOT NULL))
);
CREATE INDEX idx_players_last_seen ON players (last_seen_at) WHERE status = 'active';

CREATE TABLE consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    consent_key consent_key NOT NULL,
    granted BOOLEAN NOT NULL,
    source TEXT NOT NULL,
    policy_version TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_consents_lookup ON consents (player_id, consent_key, created_at DESC);

-- ===== behavior layer (anonymous-safe) =====
CREATE TABLE player_profiles (
    player_id UUID PRIMARY KEY,           -- soft ref by design; survives orphaning
    moral_axis REAL NOT NULL DEFAULT 0.0,
    axis_band axis_band NOT NULL DEFAULT 'flexible',
    total_sessions INT NOT NULL DEFAULT 0,
    total_destruction_score BIGINT NOT NULL DEFAULT 0,
    total_rescue_score BIGINT NOT NULL DEFAULT 0,
    camel_deaths INT NOT NULL DEFAULT 0,
    lures_executed INT NOT NULL DEFAULT 0,
    wines_found INT NOT NULL DEFAULT 0,
    currency_balance BIGINT NOT NULL DEFAULT 0,
    energy SMALLINT NOT NULL DEFAULT 3,
    energy_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE regions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    name JSONB NOT NULL,
    active BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE districts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    region_id UUID NOT NULL REFERENCES regions(id),
    slug TEXT NOT NULL,
    name JSONB NOT NULL,
    scene_asset_key TEXT NOT NULL,
    spawn_template JSONB NOT NULL,
    active BOOLEAN NOT NULL DEFAULT false,
    UNIQUE (region_id, slug)
);

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL,
    district_id UUID NOT NULL REFERENCES districts(id),
    spawn_seed BIGINT NOT NULL,
    tuning_version TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ,
    end_reason session_end_reason,
    destruction_score INT NOT NULL DEFAULT 0,
    rescue_score INT NOT NULL DEFAULT 0,
    peak_rage SMALLINT,
    max_rage_events SMALLINT NOT NULL DEFAULT 0,
    integrity_flags JSONB NOT NULL DEFAULT '[]',
    client_platform TEXT,
    locale locale NOT NULL DEFAULT 'en'
);
CREATE INDEX idx_sessions_player ON sessions (player_id, started_at DESC);

CREATE TABLE judge_events (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_id UUID NOT NULL,               -- client UUIDv7; idempotency
    session_id UUID NOT NULL REFERENCES sessions(id),
    player_id UUID NOT NULL,
    event_type judge_event_type NOT NULL,
    target_kind TEXT,
    rage_at_event SMALLINT NOT NULL,
    karma_weight REAL NOT NULL,
    seq_in_session INT NOT NULL,
    invalidates BIGINT REFERENCES judge_events(id),  -- compensation, not UPDATE (ADR-004)
    client_ts TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (session_id, event_id)
);
CREATE INDEX idx_judge_player_time ON judge_events (player_id, created_at DESC);
CREATE INDEX idx_judge_session_seq ON judge_events (session_id, seq_in_session);

CREATE TABLE judge_comment_pool (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    locale locale NOT NULL,
    axis_band axis_band NOT NULL,
    trigger_pattern TEXT NOT NULL,
    text TEXT NOT NULL,
    weight REAL NOT NULL DEFAULT 1.0,
    source comment_source NOT NULL DEFAULT 'curated',
    active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE judge_comments_served (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES sessions(id),
    player_id UUID NOT NULL,
    comment_id UUID REFERENCES judge_comment_pool(id),
    generated_text TEXT,
    locale locale NOT NULL,
    trigger_event_id BIGINT REFERENCES judge_events(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE venues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    district_id UUID NOT NULL REFERENCES districts(id),
    slug TEXT NOT NULL,
    name JSONB NOT NULL,
    kind venue_kind NOT NULL,
    ingame_coords JSONB NOT NULL,
    real_coords JSONB,
    sponsor_id UUID,
    UNIQUE (district_id, slug)
);

CREATE TABLE sponsors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    kind sponsor_kind NOT NULL,
    active BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE venues ADD CONSTRAINT fk_venues_sponsor
    FOREIGN KEY (sponsor_id) REFERENCES sponsors(id);

CREATE TABLE brand_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sponsor_id UUID NOT NULL REFERENCES sponsors(id),
    tier SMALLINT NOT NULL CHECK (tier BETWEEN 1 AND 3),
    rage_reduction SMALLINT NOT NULL,
    perks JSONB NOT NULL DEFAULT '{}',
    markets locale[] NOT NULL,
    active BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE brand_interactions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    player_id UUID NOT NULL,
    brand_item_id UUID NOT NULL REFERENCES brand_items(id),
    session_id UUID NOT NULL REFERENCES sessions(id),
    interaction interaction_kind NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_brand_interactions_item ON brand_interactions (brand_item_id, created_at);

CREATE TABLE missions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    district_id UUID NOT NULL REFERENCES districts(id),
    venue_id UUID REFERENCES venues(id),
    mission_type mission_type NOT NULL,
    config JSONB NOT NULL,
    reward JSONB NOT NULL,
    text JSONB NOT NULL,
    active BOOLEAN NOT NULL DEFAULT false,
    requires_consent consent_key
);

CREATE TABLE mission_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL,
    mission_id UUID NOT NULL REFERENCES missions(id),
    session_id UUID REFERENCES sessions(id),
    status mission_status NOT NULL DEFAULT 'offered',
    progress JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (player_id, mission_id)
);

CREATE TABLE photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL,
    storage_key TEXT NOT NULL,
    purpose photo_purpose NOT NULL,
    classifier_label TEXT,
    classifier_confidence REAL,
    authenticity_score REAL,
    bonus_tier bonus_tier NOT NULL,
    in_herd BOOLEAN NOT NULL DEFAULT false,
    session_id UUID REFERENCES sessions(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_photos_player ON photos (player_id, created_at DESC);

CREATE TABLE photo_meta_quarantine (
    photo_id UUID PRIMARY KEY REFERENCES photos(id) ON DELETE CASCADE,
    capture_source TEXT,
    device_hint TEXT,
    exif_device TEXT,
    exif_present BOOLEAN NOT NULL,
    exif_datetime_delta_s INT,
    gps_region TEXT,                      -- coarsened ONLY;
    phash TEXT,
    reverse_match BOOLEAN,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    purge_after TIMESTAMPTZ NOT NULL
);

CREATE TABLE marketing_signals (          -- writes require live marketing_profiling consent
    player_id UUID PRIMARY KEY,
    device_tier TEXT,
    coarse_region TEXT,
    play_daypart TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
