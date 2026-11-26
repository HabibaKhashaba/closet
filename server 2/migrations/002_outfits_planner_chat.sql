-- Closet · Sprint 2 / 3 early start: outfits, wear history, feedback, planned outfits, chat.

CREATE SCHEMA IF NOT EXISTS outfits;
CREATE SCHEMA IF NOT EXISTS assistant;

-- Outfits: saved (US-26), favorites, built in the builder (US-42), planned for an event (US-48)
CREATE TABLE outfits.outfits (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES accounts.users(id) ON DELETE CASCADE,
  item_ids    UUID[] NOT NULL CHECK (cardinality(item_ids) BETWEEN 2 AND 4),
  occasion    TEXT,
  style       TEXT,
  rule_score  SMALLINT CHECK (rule_score BETWEEN 0 AND 100),
  reasons     TEXT[] NOT NULL DEFAULT '{}',
  source      TEXT NOT NULL DEFAULT 'recommended' CHECK (source IN ('recommended', 'built', 'planned')),
  favorite    BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX outfits_user_idx ON outfits.outfits (user_id);

-- Wear log (US-23): one row per "Wear this"
CREATE TABLE outfits.wears (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES accounts.users(id) ON DELETE CASCADE,
  item_ids   UUID[] NOT NULL,
  worn_on    DATE NOT NULL DEFAULT CURRENT_DATE,
  rating     SMALLINT CHECK (rating BETWEEN 1 AND 5)
);
CREATE INDEX wears_user_idx ON outfits.wears (user_id, worn_on);

-- Feedback (US-37, US-60): swaps and rejections with a reason
CREATE TABLE outfits.feedback (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES accounts.users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL CHECK (kind IN ('swap', 'reject')),
  item_ids   UUID[] NOT NULL,
  reason     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Hide a piece for 7 days without it counting as a dislike (US-61)
CREATE TABLE outfits.hidden_items (
  user_id    UUID NOT NULL REFERENCES accounts.users(id) ON DELETE CASCADE,
  item_id    UUID NOT NULL REFERENCES wardrobe.items(id) ON DELETE CASCADE,
  until      TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (user_id, item_id)
);

-- Planned outfit for an event (US-48)
ALTER TABLE planner.events ADD COLUMN planned_outfit_id UUID REFERENCES outfits.outfits(id) ON DELETE SET NULL;

-- Ask Closet: actions the agent took, so each can be undone (US-76)
CREATE TABLE assistant.actions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES accounts.users(id) ON DELETE CASCADE,
  function    TEXT NOT NULL,
  undo        JSONB NOT NULL,
  undone      BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
