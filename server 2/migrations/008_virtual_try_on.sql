-- Closet · Virtual Try-On (US-118): image-based try-on of ONE garment on the user's own photo.
-- One row per generation. The user photo, the garment photo used and the result are private files in
-- the photo storage (signed URLs only); this table keeps their storage keys, never file paths.

CREATE SCHEMA IF NOT EXISTS tryon;

-- The saved "try-on photo" (optional): reused for later try-ons, replaceable and deletable.
CREATE TABLE tryon.user_photos (
  user_id     UUID PRIMARY KEY REFERENCES accounts.users(id) ON DELETE CASCADE,
  photo_key   TEXT NOT NULL,
  consent_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tryon.virtual_try_ons (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES accounts.users(id) ON DELETE CASCADE,
  outfit_id         UUID REFERENCES outfits.outfits(id) ON DELETE SET NULL,   -- a saved look, when the look was saved
  outfit_item_ids   UUID[] NOT NULL DEFAULT '{}',                             -- the recommended look it came from
  wardrobe_item_id  UUID REFERENCES wardrobe.items(id) ON DELETE SET NULL,
  garment_name      TEXT,
  garment_category  TEXT NOT NULL,
  user_image_key    TEXT,            -- copy of the person photo used for this generation
  garment_image_key TEXT,            -- the wardrobe photo sent (the original is never changed)
  result_image_key  TEXT,            -- the generated image, stored privately
  result_remote_url TEXT,            -- provider URL, only if the result could not be copied
  status            TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
  provider          TEXT NOT NULL,
  provider_job_id   TEXT,
  error_code        TEXT,
  error_message     TEXT,
  saved             BOOLEAN NOT NULL DEFAULT false,
  attempts          SMALLINT NOT NULL DEFAULT 1,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX virtual_try_ons_user_idx ON tryon.virtual_try_ons (user_id, created_at DESC);
