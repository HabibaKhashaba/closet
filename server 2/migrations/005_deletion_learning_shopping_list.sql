-- Closet · version 1.4: deletion reasons that drive learning and shopping, and a real shopping list.
-- US-13 (delete with a reason, Sprint 2), US-33 (replace torn / too-small pieces, Sprint 3),
-- US-34 (never re-buy "no longer my style", Sprint 3), US-36 (shopping list, add from chat, Sprint 3).
-- All built early as labelled previews; no Sprint 1 table changes meaning.

-- 1. Deletion reasons (US-13): exactly four, each with a defined effect (see SDD 5.8).
--    Torn / damaged → replacement on the shopping list · Became too small → replacement (new size)
--    No longer my style → learned avoidance, never a replacement · Other → recorded only
ALTER TABLE wardrobe.deletions DROP CONSTRAINT IF EXISTS deletions_reason_check;
UPDATE wardrobe.deletions SET reason = 'Torn / damaged' WHERE reason = 'Torn or damaged';
UPDATE wardrobe.deletions SET reason = 'Other' WHERE reason IN ('Became too big', 'Gave it away');
ALTER TABLE wardrobe.deletions ADD CONSTRAINT deletions_reason_check
  CHECK (reason IN ('Torn / damaged', 'No longer my style', 'Became too small', 'Other'));
-- What the piece was like, so "No longer my style" can be learned and never re-suggested.
ALTER TABLE wardrobe.deletions ADD COLUMN styles      TEXT[]     NOT NULL DEFAULT '{}';
ALTER TABLE wardrobe.deletions ADD COLUMN dress_codes SMALLINT[] NOT NULL DEFAULT '{}';
ALTER TABLE wardrobe.deletions ADD COLUMN fabric      TEXT;

-- 2. Shopping list (US-36): what the user intends to buy, from any source (Ask Closet, replacement, gap, suggestion).
CREATE TABLE shopping.list_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES accounts.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 80),
  category    TEXT NOT NULL CHECK (category IN ('Top', 'Dress', 'Bottom', 'Layer', 'Shoes', 'Bag', 'Extra')),
  colour      TEXT,
  source      TEXT NOT NULL CHECK (source IN ('ask', 'replacement', 'gap', 'suggestion', 'manual')),
  reason      TEXT CHECK (reason IS NULL OR char_length(reason) <= 200),
  suggestion_key TEXT,
  replaces    TEXT CHECK (replaces IS NULL OR char_length(replaces) <= 80),   -- the piece this item replaces
  status      TEXT NOT NULL DEFAULT 'to_buy' CHECK (status IN ('to_buy', 'bought')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX list_items_user_idx ON shopping.list_items (user_id, created_at DESC);

-- 3. Learned avoidance (US-34 / UC-22): styles the user confirmed they let go of. The ranker
--    lowers pieces with these styles; nothing is removed from the closet.
ALTER TABLE profile.profiles ADD COLUMN avoid_styles TEXT[] NOT NULL DEFAULT '{}';
