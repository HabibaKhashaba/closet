-- Closet · version 1.2: customization asked for in the Milestone 1 review
-- (laundry basket time, recycle time, calendar), bags as their own category,
-- delete with a reason, smart shopping decisions.

-- Wardrobe: a short name per piece ("Navy silk midi dress") and Bags as a category
ALTER TABLE wardrobe.items ADD COLUMN name TEXT CHECK (name IS NULL OR char_length(name) BETWEEN 1 AND 60);
ALTER TABLE wardrobe.items DROP CONSTRAINT items_category_check;
ALTER TABLE wardrobe.items ADD CONSTRAINT items_category_check
  CHECK (category IN ('Top', 'Dress', 'Bottom', 'Layer', 'Shoes', 'Bag', 'Extra'));

-- Delete with a reason (US-13): the piece is gone, the reason stays for Smart Shopping
CREATE TABLE wardrobe.deletions (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES accounts.users(id) ON DELETE CASCADE,
  name        TEXT,
  category    TEXT NOT NULL,
  colour      TEXT NOT NULL,
  wear_count  INT NOT NULL DEFAULT 0,
  reason      TEXT NOT NULL CHECK (reason IN ('Became too small', 'Became too big', 'Torn or damaged', 'No longer my style', 'Gave it away', 'Other')),
  note        TEXT CHECK (note IS NULL OR char_length(note) <= 120),
  deleted_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX deletions_user_idx ON wardrobe.deletions (user_id);

-- Profile: personal settings that drive Availability and the Recommendation Engine
ALTER TABLE profile.profiles
  ADD COLUMN display_name        TEXT CHECK (display_name IS NULL OR char_length(display_name) BETWEEN 1 AND 40),
  ADD COLUMN laundry_days        SMALLINT NOT NULL DEFAULT 2 CHECK (laundry_days BETWEEN 1 AND 14),   -- laundry basket time
  ADD COLUMN laundry_auto_return BOOLEAN  NOT NULL DEFAULT true,
  ADD COLUMN laundry_weekday     SMALLINT CHECK (laundry_weekday BETWEEN 0 AND 6),                    -- 0 = Sunday
  ADD COLUMN repeat_days         SMALLINT NOT NULL DEFAULT 3 CHECK (repeat_days BETWEEN 0 AND 30),    -- recycle time
  ADD COLUMN reminders           BOOLEAN  NOT NULL DEFAULT true,
  ADD COLUMN reminder_hour       SMALLINT NOT NULL DEFAULT 20 CHECK (reminder_hour BETWEEN 0 AND 23);

-- Availability: Borrowed / Packed / Unavailable can carry a return date and a note ("Salma")
ALTER TABLE availability.item_status
  ADD COLUMN until DATE,
  ADD COLUMN note  TEXT CHECK (note IS NULL OR char_length(note) <= 60);

-- Smart Shopping: what the user did with a suggestion
CREATE SCHEMA IF NOT EXISTS shopping;
CREATE TABLE shopping.decisions (
  user_id     UUID NOT NULL REFERENCES accounts.users(id) ON DELETE CASCADE,
  key         TEXT NOT NULL CHECK (char_length(key) <= 80),
  state       TEXT NOT NULL CHECK (state IN ('saved', 'dismissed', 'bought')),
  decided_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);
