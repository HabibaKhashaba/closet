-- Closet · version 1.6: ONE authoritative garment lifecycle (shared/lifecycle.js).
--   Available ↔ Laundry · Borrowed · Packed · Needs repair · Needs alteration · At tailor
--   Available → Ready to donate → Donated (archived: removed from the active closet, history kept)
-- The status column is the only source of truth for "where is this piece / can I wear it".
-- care_jobs and loans hold the DETAILS of a repair or a loan (reason, tailor, person, dates) and
-- their history; they never decide availability on their own.

-- 1. Lifecycle statuses
ALTER TABLE availability.item_status DROP CONSTRAINT IF EXISTS item_status_status_check;
ALTER TABLE availability.item_status ADD CONSTRAINT item_status_status_check CHECK (status IN (
  'Available', 'Laundry', 'Borrowed', 'Packed', 'Needs repair', 'Needs alteration', 'At tailor', 'Ready to donate', 'Unavailable'));

-- 2. Repairs & alterations (Care)
CREATE TABLE availability.care_jobs (
  id            BIGSERIAL PRIMARY KEY,
  item_id       UUID NOT NULL REFERENCES wardrobe.items(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES accounts.users(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL CHECK (kind IN ('repair', 'alteration')),
  reason        TEXT NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 80),
  notes         TEXT CHECK (notes IS NULL OR char_length(notes) <= 200),
  tailor        TEXT CHECK (tailor IS NULL OR char_length(tailor) <= 60),
  sent_on       DATE,
  expected_back DATE,
  cost          NUMERIC(10, 2) CHECK (cost IS NULL OR cost >= 0),
  closed_on     DATE,
  outcome       TEXT CHECK (outcome IS NULL OR outcome IN ('collected', 'fixed', 'donated', 'cancelled')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX care_jobs_user_idx ON availability.care_jobs (user_id, closed_on);
CREATE UNIQUE INDEX care_jobs_one_open ON availability.care_jobs (item_id) WHERE closed_on IS NULL;

-- 3. Borrow & lend (history kept after the piece comes back)
CREATE TABLE availability.loans (
  id          BIGSERIAL PRIMARY KEY,
  item_id     UUID NOT NULL REFERENCES wardrobe.items(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES accounts.users(id) ON DELETE CASCADE,
  person      TEXT NOT NULL CHECK (char_length(person) BETWEEN 1 AND 60),
  lent_on     DATE NOT NULL DEFAULT CURRENT_DATE,
  due_on      DATE,
  note        TEXT CHECK (note IS NULL OR char_length(note) <= 120),
  returned_on DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX loans_user_idx ON availability.loans (user_id, returned_on);
CREATE UNIQUE INDEX loans_one_open ON availability.loans (item_id) WHERE returned_on IS NULL;

-- Existing Borrowed pieces get their loan record (the note held the person, until the due date).
INSERT INTO availability.loans (item_id, user_id, person, lent_on, due_on)
  SELECT item_id, user_id, COALESCE(NULLIF(note, ''), 'Someone'), changed_at::date, until
    FROM availability.item_status WHERE status = 'Borrowed';

-- 4. Donation is a lifecycle state now (v1.5 kept it in a side table with donate / give / sell).
--    Every piece that was waiting to leave becomes Ready to donate; the side table is removed.
UPDATE availability.item_status s SET status = 'Ready to donate', changed_at = r.started_at, until = NULL, note = NULL
  FROM wardrobe.rehoming r WHERE r.item_id = s.item_id;
DROP TABLE IF EXISTS wardrobe.rehoming;
