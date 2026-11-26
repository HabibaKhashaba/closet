-- Closet · Sprint 1 schema (version 1.1)
-- One schema per module. Every table that holds user data references accounts.users
-- with ON DELETE CASCADE, so deleting an account removes all of its rows (US-06).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS accounts;
CREATE SCHEMA IF NOT EXISTS profile;
CREATE SCHEMA IF NOT EXISTS wardrobe;
CREATE SCHEMA IF NOT EXISTS availability;
CREATE SCHEMA IF NOT EXISTS planner;

-- Identity & Auth --------------------------------------------------------
CREATE TABLE accounts.users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT NOT NULL UNIQUE,
  password_hash   TEXT,                       -- NULL when the account uses Google only
  google_id       TEXT UNIQUE,
  role            TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  account_status  TEXT NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'suspended')),
  token_version   INT  NOT NULL DEFAULT 0,    -- raised on logout: older tokens stop working
  failed_logins   INT  NOT NULL DEFAULT 0,
  locked_until    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (password_hash IS NOT NULL OR google_id IS NOT NULL)
);

-- Accounts & Profile -----------------------------------------------------
CREATE TABLE profile.profiles (
  user_id            UUID PRIMARY KEY REFERENCES accounts.users(id) ON DELETE CASCADE,
  styles             TEXT[] NOT NULL DEFAULT '{}',
  colours            TEXT[] NOT NULL DEFAULT '{}',
  occasions          TEXT[] NOT NULL DEFAULT '{}',
  dress_code         SMALLINT NOT NULL DEFAULT 1 CHECK (dress_code BETWEEN 1 AND 5),
  modest             BOOLEAN NOT NULL DEFAULT false,
  city               TEXT,
  quiz_completed_at  TIMESTAMPTZ,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Wardrobe ---------------------------------------------------------------
CREATE TABLE wardrobe.items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES accounts.users(id) ON DELETE CASCADE,
  photo_key     TEXT NOT NULL,
  category      TEXT NOT NULL CHECK (category IN ('Top', 'Dress', 'Bottom', 'Layer', 'Shoes', 'Extra')),
  colour        TEXT NOT NULL,
  fabric        TEXT,
  season        TEXT,
  size          TEXT,
  styles        TEXT[] NOT NULL DEFAULT '{}',
  dress_codes   SMALLINT[] NOT NULL CHECK (cardinality(dress_codes) >= 1 AND dress_codes <@ ARRAY[1,2,3,4,5]::SMALLINT[]),
  modest        BOOLEAN NOT NULL DEFAULT false,
  wear_count    INT NOT NULL DEFAULT 0,
  last_worn_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX items_user_idx ON wardrobe.items (user_id);

-- Availability -----------------------------------------------------------
CREATE TABLE availability.item_status (
  item_id     UUID PRIMARY KEY REFERENCES wardrobe.items(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES accounts.users(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'Available'
              CHECK (status IN ('Available', 'Laundry', 'Borrowed', 'Packed', 'Unavailable')),
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX item_status_user_idx ON availability.item_status (user_id, status);

CREATE TABLE availability.status_history (
  id           BIGSERIAL PRIMARY KEY,
  item_id      UUID NOT NULL REFERENCES wardrobe.items(id) ON DELETE CASCADE,
  from_status  TEXT NOT NULL,
  to_status    TEXT NOT NULL,
  changed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Planner ----------------------------------------------------------------
CREATE TABLE planner.events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES accounts.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 80),
  event_date  DATE NOT NULL,
  event_time  TIME NOT NULL,
  occasion    TEXT NOT NULL,
  dress_code  SMALLINT NOT NULL CHECK (dress_code BETWEEN 1 AND 5),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX events_user_date_idx ON planner.events (user_id, event_date);
