-- Closet v3.0 "Studio" features: Friends' closet (mutual, opt-in, per-piece lending) and Stylist battle votes.
-- Every table references accounts.users, so deleting an account removes its rows (US-06).

CREATE SCHEMA IF NOT EXISTS studio;

-- Mutual friendship: one row per pair, created by a request and confirmed by the other person.
CREATE TABLE studio.friendships (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES accounts.users(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES accounts.users(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at  TIMESTAMPTZ,
  CHECK (requester_id <> addressee_id)
);
CREATE UNIQUE INDEX friendships_pair_idx ON studio.friendships (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id));

-- Pieces the owner explicitly allows friends to borrow. Off by default (no row = not lendable).
CREATE TABLE studio.lendable (
  item_id    UUID PRIMARY KEY REFERENCES wardrobe.items(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES accounts.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX lendable_user_idx ON studio.lendable (user_id);

-- A friend asks to borrow a lendable piece; the owner approves (→ the existing Borrow & lend flow) or declines.
CREATE TABLE studio.borrow_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id      UUID NOT NULL REFERENCES wardrobe.items(id) ON DELETE CASCADE,
  owner_id     UUID NOT NULL REFERENCES accounts.users(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES accounts.users(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at   TIMESTAMPTZ
);
CREATE INDEX borrow_requests_owner_idx ON studio.borrow_requests (owner_id, created_at DESC);

-- Stylist battle: which persona's look the user voted for (feeds learned style patterns).
CREATE TABLE studio.battle_votes (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES accounts.users(id) ON DELETE CASCADE,
  occasion   TEXT NOT NULL,
  winner     TEXT NOT NULL,
  item_ids   UUID[] NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cher mode: what the user did with a spun look (accepted → saved as a favourite, rejected → a reject signal).
CREATE TABLE studio.cher_feedback (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES accounts.users(id) ON DELETE CASCADE,
  item_ids   UUID[] NOT NULL,
  score      INT,
  action     TEXT NOT NULL CHECK (action IN ('accepted', 'rejected', 'fine_tuned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
