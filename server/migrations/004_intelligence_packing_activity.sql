-- Closet · version 1.3 (Milestone 2 final): Closet Intelligence, outfit history, packing, activity log.
-- All of these are Sprint 2 / Sprint 3 / stretch features built early; Sprint 1 tables are unchanged.

-- Outfit history (US-91): what the outfit was for and the weather that day.
ALTER TABLE outfits.wears ADD COLUMN occasion   TEXT;
ALTER TABLE outfits.wears ADD COLUMN temp_c     SMALLINT;
ALTER TABLE outfits.wears ADD COLUMN conditions TEXT;

CREATE SCHEMA IF NOT EXISTS intelligence;

-- "Closet has learned" (US-40): the user confirms or dismisses a detected pattern.
-- previous keeps the profile values before a confirmed change, so Undo restores them exactly.
CREATE TABLE intelligence.learned (
  user_id    UUID NOT NULL REFERENCES accounts.users(id) ON DELETE CASCADE,
  key        TEXT NOT NULL,
  state      TEXT NOT NULL CHECK (state IN ('confirmed', 'dismissed')),
  previous   JSONB,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);

-- Notification Center (US-92): which notices the user has already read.
CREATE TABLE intelligence.notifications_read (
  user_id UUID NOT NULL REFERENCES accounts.users(id) ON DELETE CASCADE,
  key     TEXT NOT NULL,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);

-- Activity / audit log (US-93): written by the Audit step of the API Gateway.
CREATE SCHEMA IF NOT EXISTS activity;
CREATE TABLE activity.log (
  id      BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES accounts.users(id) ON DELETE CASCADE,
  action  TEXT NOT NULL,
  detail  TEXT,
  at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX activity_user_idx ON activity.log (user_id, at DESC);

-- Packing Mode (US-68): a saved packing list for a trip.
CREATE SCHEMA IF NOT EXISTS packing;
CREATE TABLE packing.trips (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES accounts.users(id) ON DELETE CASCADE,
  destination TEXT NOT NULL,
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL CHECK (end_date >= start_date),
  trip_type   TEXT NOT NULL,
  activities  TEXT[] NOT NULL DEFAULT '{}',
  item_ids    UUID[] NOT NULL DEFAULT '{}',
  plan        JSONB NOT NULL DEFAULT '{}',
  packed      BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX trips_user_idx ON packing.trips (user_id, start_date);
