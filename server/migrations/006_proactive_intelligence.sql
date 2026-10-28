-- Closet · version 1.5 (Milestone 2 final): proactive intelligence. Only the data the features need;
-- everything else (days since worn, cost per wear, seasons, laundry risk, conflicts) is DERIVED from
-- existing tables at read time, so there is no second copy of any status to go stale.

-- 1. Cost per wear: optional purchase details. Price is personal data: optional, editable, removable.
ALTER TABLE wardrobe.items
  ADD COLUMN price         NUMERIC(10, 2) CHECK (price IS NULL OR price >= 0),
  ADD COLUMN currency      TEXT CHECK (currency IS NULL OR currency IN ('EGP', 'USD', 'EUR', 'GBP', 'SAR', 'AED')),
  ADD COLUMN purchase_date DATE;

-- 2. Donating / giving away / rehoming a piece. The piece stays in the closet (the user still owns it)
--    until they confirm it has left; then it is deleted with reason Donated / Given away / Sold / rehomed,
--    which keeps the history row in wardrobe.deletions and never creates a replacement.
--    A separate table (not a sixth item status) keeps the 5-status state machine unchanged: SDD 5.15.
CREATE TABLE wardrobe.rehoming (
  item_id     UUID PRIMARY KEY REFERENCES wardrobe.items(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES accounts.users(id) ON DELETE CASCADE,
  method      TEXT NOT NULL CHECK (method IN ('donate', 'give', 'sell')),
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX rehoming_user_idx ON wardrobe.rehoming (user_id);

ALTER TABLE wardrobe.deletions DROP CONSTRAINT IF EXISTS deletions_reason_check;
ALTER TABLE wardrobe.deletions ADD CONSTRAINT deletions_reason_check
  CHECK (reason IN ('Torn / damaged', 'No longer my style', 'Became too small', 'Other', 'Donated', 'Given away', 'Sold / rehomed'));

-- 3. "Keep it", "Not now", "Remind me later": one snooze table for every proactive suggestion
--    (keys like keep:<itemId>, season:<itemId>, borrow:<itemId>, notice:<notificationKey>).
CREATE TABLE intelligence.snoozes (
  user_id    UUID NOT NULL REFERENCES accounts.users(id) ON DELETE CASCADE,
  key        TEXT NOT NULL CHECK (char_length(key) <= 120),
  until      DATE NOT NULL,
  reason     TEXT CHECK (reason IS NULL OR char_length(reason) <= 40),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);

-- 4. Outfit memory: the wear log already keeps occasion, temperature, conditions and rating (v1.3);
--    add the event title and an optional note ("Salma's birthday").
ALTER TABLE outfits.wears
  ADD COLUMN event_title TEXT CHECK (event_title IS NULL OR char_length(event_title) <= 80),
  ADD COLUMN note        TEXT CHECK (note IS NULL OR char_length(note) <= 120);

-- 5. Planned-outfit weather monitor: the forecast at the moment the outfit was planned.
ALTER TABLE planner.events
  ADD COLUMN planned_temp_c    SMALLINT,
  ADD COLUMN planned_condition TEXT CHECK (planned_condition IS NULL OR char_length(planned_condition) <= 40);

-- 6. Repeat intelligence respects the user: "I'm okay repeating outfits".
ALTER TABLE profile.profiles ADD COLUMN allow_repeats BOOLEAN NOT NULL DEFAULT false;
