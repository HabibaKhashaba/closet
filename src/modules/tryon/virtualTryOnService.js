// VirtualTryOnService — business rules of the image-based Virtual Try-On (US-118).
// One garment at a time: the user's full-body photo + ONE wardrobe piece → provider job → stored result.
//
// Life of a try-on: PENDING (row created) → PROCESSING (provider accepted the job) → COMPLETED | FAILED.
// There is no background worker: each GET of a PROCESSING try-on asks the provider once (at most every
// few seconds), so the client's polling drives progress and nothing keeps running when nobody is waiting.
// A try-on still processing after `timeoutMs` becomes FAILED (TRYON_TIMEOUT).
//
// Privacy: photos are stored in the private photo storage (signed URLs only); provider keys never leave
// the server; image contents are never logged; every read is scoped to the signed-in user.
const { AppError, errors } = require('../../shared/errors');
const { STATUS, ProviderError } = require('./providers/VirtualTryOnProvider');
const { PROVIDER_CATEGORY, checkImage } = require('./imageChecks');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTIVE = [STATUS.PENDING, STATUS.PROCESSING];

// What the user is told for each failure (the raw provider message is kept for the record only).
const FRIENDLY = {
  TRYON_DISABLED: 'Virtual try-on is not set up on this server yet.',
  TRYON_NETWORK: 'We could not reach the try-on service. Check the connection and try again.',
  TRYON_PROVIDER_BUSY: 'The try-on service is busy right now. Try again in a minute.',
  TRYON_PROVIDER_AUTH: 'The try-on service is not configured correctly (API key). Please tell the team.',
  TRYON_PROVIDER: 'The try-on service could not create this image. Try again, or use a clearer full-body photo.',
  TRYON_TIMEOUT: 'This try-on took too long and was stopped. Please try again.',
  TRYON_NO_RESULT: 'The try-on service finished but sent no image back. Please try again.',
};
const failure = (code, message) => ({ errorCode: code, errorMessage: (message || FRIENDLY[code] || FRIENDLY.TRYON_PROVIDER).slice(0, 300) });

function virtualTryOnService({ repo, provider, wardrobe, outfits, storage, settings, fetchImpl = (...a) => fetch(...a), now = () => Date.now() }) {
  const lastCheck = new Map(); // tryOnId → time of the last provider status call (avoids hammering the provider)

  const toDataUri = (buf, mime) => `data:${mime};base64,${buf.toString('base64')}`;
  const signed = (key) => (key ? storage.signedUrl(key) : null);

  function view(r) {
    return {
      tryOnId: r.id,
      status: r.status,
      provider: r.provider,
      mock: r.provider === 'mock',
      wardrobeItemId: r.wardrobe_item_id,
      outfitId: r.outfit_id,
      outfitItemIds: r.outfit_item_ids || [],
      garment: { id: r.wardrobe_item_id, name: r.garment_name, category: r.garment_category, imageUrl: signed(r.garment_image_key) },
      userImageUrl: signed(r.user_image_key),
      resultImageUrl: r.result_image_key ? signed(r.result_image_key) : (r.result_remote_url || null),
      saved: Boolean(r.saved),
      error: r.status === STATUS.FAILED ? { code: r.error_code, message: FRIENDLY[r.error_code] || r.error_message || FRIENDLY.TRYON_PROVIDER } : null,
      attempts: r.attempts,
      createdAt: r.created_at,
      completedAt: r.completed_at,
    };
  }

  async function readKey(key) {
    if (!key) return null;
    try { return await storage.read(key); } catch { return null; }
  }

  // The generated image is copied into Closet's private storage, so it is access-controlled and does not
  // depend on the provider keeping it. Only https URLs or data URIs are accepted.
  async function storeResult(imageUrl) {
    let buf;
    const m = /^data:([^;,]+);base64,(.*)$/s.exec(imageUrl || '');
    if (m) buf = Buffer.from(m[2], 'base64');
    else if (/^https:\/\//.test(imageUrl || '')) {
      const res = await fetchImpl(imageUrl);
      if (!res.ok) throw new ProviderError('TRYON_NO_RESULT', `Result download failed (${res.status})`);
      buf = Buffer.from(await res.arrayBuffer());
    } else throw new ProviderError('TRYON_NO_RESULT', 'The provider returned no usable image.');
    if (buf.length > settings.maxResultBytes) throw new ProviderError('TRYON_NO_RESULT', 'The result image is too large.');
    const c = checkImage(buf, { minSide: 1, what: 'result' });
    if (!c.ok) throw new ProviderError('TRYON_NO_RESULT', 'The result is not an image.');
    return storage.save(buf, c.mime);
  }

  // Submits the job for a PENDING row. Never throws for provider problems: the row becomes FAILED instead.
  async function submit(userId, row) {
    const [person, garment] = await Promise.all([readKey(row.user_image_key), readKey(row.garment_image_key)]);
    if (!person || !garment) return repo.update(userId, row.id, { status: STATUS.FAILED, ...failure('TRYON_NO_RESULT', 'An input image is missing.') });
    const pm = checkImage(person, { minSide: 1, what: 'photo' }).mime; const gm = checkImage(garment, { minSide: 1, what: 'garment photo' }).mime;
    try {
      const { jobId } = await provider.generateTryOn({ personImage: toDataUri(person, pm), garmentImage: toDataUri(garment, gm), category: PROVIDER_CATEGORY[row.garment_category] });
      return repo.update(userId, row.id, { status: STATUS.PROCESSING, providerJobId: jobId });
    } catch (e) {
      if (!(e instanceof ProviderError)) throw e;
      return repo.update(userId, row.id, { status: STATUS.FAILED, ...failure(e.code, e.message) });
    }
  }

  // One provider check for a PROCESSING row (rate-limited per try-on).
  async function advance(userId, row) {
    if (row.status === STATUS.PENDING && now() - new Date(row.updated_at || row.created_at).getTime() > 30000) {
      return repo.update(userId, row.id, { status: STATUS.FAILED, ...failure('TRYON_PROVIDER', 'The job was never accepted.') });
    }
    if (row.status !== STATUS.PROCESSING) return row;
    if (now() - new Date(row.started_at).getTime() > settings.timeoutMs) return repo.update(userId, row.id, { status: STATUS.FAILED, ...failure('TRYON_TIMEOUT') });
    const last = lastCheck.get(row.id) || 0;
    if (now() - last < settings.minCheckMs) return row;
    lastCheck.set(row.id, now());
    try {
      const s = await provider.getStatus(row.provider_job_id);
      if (s.status === STATUS.FAILED) { lastCheck.delete(row.id); return repo.update(userId, row.id, { status: STATUS.FAILED, ...failure((s.error && s.error.code) || 'TRYON_PROVIDER', s.error && s.error.message) }); }
      if (s.status !== STATUS.COMPLETED) return row;
      const result = await provider.getResult(row.provider_job_id);
      lastCheck.delete(row.id);
      if (!result || !result.imageUrl) return repo.update(userId, row.id, { status: STATUS.FAILED, ...failure('TRYON_NO_RESULT') });
      let key = null; let remote = null;
      try { key = await storeResult(result.imageUrl); } catch (e) {
        if (/^https:\/\//.test(result.imageUrl)) remote = result.imageUrl; // show the provider's copy if ours failed
        else return repo.update(userId, row.id, { status: STATUS.FAILED, ...failure('TRYON_NO_RESULT') });
      }
      return repo.update(userId, row.id, { status: STATUS.COMPLETED, resultImageKey: key, resultRemoteUrl: remote, completedAt: new Date(now()), errorCode: null, errorMessage: null });
    } catch (e) {
      if (e instanceof ProviderError && e.retryable) return row;          // transient: the next poll tries again
      if (e instanceof ProviderError) return repo.update(userId, row.id, { status: STATUS.FAILED, ...failure(e.code, e.message) });
      throw e;
    }
  }

  async function checkQuota(userId) {
    const start = new Date(now()); start.setUTCHours(0, 0, 0, 0);
    if (await repo.countSince(userId, start) >= settings.dailyLimit) throw new AppError(429, 'TRYON_LIMIT', `You can create ${settings.dailyLimit} virtual try-ons a day. Try again tomorrow.`);
    if (await repo.countActive(userId) >= settings.maxActive) throw new AppError(429, 'TRYON_BUSY', 'A try-on is already being created. Wait for it to finish first.');
  }

  async function personPhotoFrom(userId, { file, useSavedPhoto, savePhoto }) {
    if (file) {
      const c = checkImage(file.buffer, { minSide: settings.minPhotoSide, what: 'photo' });
      if (!c.ok) throw new AppError(c.code === 'UNSUPPORTED_FILE' ? 415 : 422, c.code, c.message);
      const key = await storage.save(file.buffer, c.mime);          // this try-on's own copy
      if (savePhoto) await setSavedPhoto(userId, file.buffer, c.mime);
      return key;
    }
    if (useSavedPhoto) {
      const saved = await repo.getPhoto(userId);
      const buf = saved && await readKey(saved.photo_key);
      if (!buf) throw new AppError(400, 'PHOTO_REQUIRED', 'You have no saved try-on photo. Upload a full-body photo.');
      return storage.save(buf, checkImage(buf, { minSide: 1, what: 'photo' }).mime);
    }
    throw new AppError(400, 'PHOTO_REQUIRED', 'Upload a clear full-body photo of yourself first.');
  }

  async function setSavedPhoto(userId, buffer, mime) {
    const old = await repo.getPhoto(userId);
    const key = await storage.save(buffer, mime);
    const row = await repo.setPhoto(userId, key);
    if (old && old.photo_key !== key) await storage.remove(old.photo_key).catch(() => {});
    return row;
  }

  return {
    status() {
      return { enabled: provider.enabled, provider: provider.enabled ? provider.name : null, mock: Boolean(provider.mock),
        supportedCategories: settings.categories, dailyLimit: settings.dailyLimit, maxPhotoMb: Math.round(settings.maxPhotoBytes / 1048576), pollAfterMs: settings.minCheckMs };
    },

    // ---------- the saved try-on photo ----------
    async getPhoto(userId) {
      const p = await repo.getPhoto(userId);
      return { photo: p ? { url: signed(p.photo_key), savedAt: p.updated_at } : null };
    },
    async savePhoto(userId, file, consent) {
      if (consent !== true) throw new AppError(400, 'CONSENT_REQUIRED', 'Please agree to the photo notice first.');
      if (!file) throw new AppError(400, 'PHOTO_REQUIRED', 'Choose a photo to save.');
      const c = checkImage(file.buffer, { minSide: settings.minPhotoSide, what: 'photo' });
      if (!c.ok) throw new AppError(c.code === 'UNSUPPORTED_FILE' ? 415 : 422, c.code, c.message);
      const row = await setSavedPhoto(userId, file.buffer, c.mime);
      return { photo: { url: signed(row.photo_key), savedAt: row.updated_at } };
    },
    async deletePhoto(userId) {
      const p = await repo.deletePhoto(userId);
      if (p) await storage.remove(p.photo_key).catch(() => {});
      return { deleted: Boolean(p) };
    },

    // ---------- try-ons ----------
    async create(userId, input) {
      if (!provider.enabled) throw new AppError(503, 'TRYON_DISABLED', FRIENDLY.TRYON_DISABLED);
      if (input.consent !== true) throw new AppError(400, 'CONSENT_REQUIRED', 'Please agree to send your photo to the try-on service first.');
      if (!UUID.test(String(input.wardrobeItemId || ''))) throw errors.validation([{ field: 'wardrobeItemId', message: 'Choose a piece from your closet' }]);
      const piece = await wardrobe().getPiece(userId, input.wardrobeItemId); // 404 for another user's piece
      if (!settings.categories.includes(piece.category)) {
        throw new AppError(422, 'UNSUPPORTED_GARMENT', `Virtual try-on works with ${settings.categories.map((c) => ({ Top: 'tops', Layer: 'jackets and layers', Dress: 'dresses', Bottom: 'bottoms' }[c])).join(', ')} for now. ${piece.category === 'Shoes' ? 'Shoes' : piece.category === 'Bag' ? 'Bags' : 'This kind of piece'} cannot be tried on yet.`);
      }
      const garmentKey = await wardrobe().photoKey(userId, piece.id);
      const garment = await readKey(garmentKey);
      if (!garment) throw new AppError(422, 'GARMENT_IMAGE_MISSING', 'This piece has no usable photo. Add a clear photo of it first.');
      const gc = checkImage(garment, { minSide: settings.minGarmentSide, what: 'garment photo' });
      if (!gc.ok) throw new AppError(422, gc.code === 'UNSUPPORTED_FILE' ? 'GARMENT_IMAGE_UNSUITABLE' : gc.code, `${gc.message} Retake the photo of the piece on a plain background.`);
      let outfitId = null;
      if (input.outfitId) { if (!UUID.test(String(input.outfitId))) throw errors.validation([{ field: 'outfitId', message: 'Not a valid look' }]); outfitId = (await outfits().get(userId, input.outfitId)).id; }
      const outfitItemIds = Array.isArray(input.outfitItemIds) ? input.outfitItemIds.filter((x) => UUID.test(String(x))).slice(0, 6) : [];
      await checkQuota(userId);
      const userImageKey = await personPhotoFrom(userId, input);
      let row = await repo.insert(userId, { outfitId, outfitItemIds, wardrobeItemId: piece.id, garmentName: piece.name || `${piece.colour} ${piece.category}`.toLowerCase(), garmentCategory: piece.category,
        userImageKey, garmentImageKey: garmentKey, status: STATUS.PENDING, provider: provider.name, startedAt: new Date(now()) });
      row = await submit(userId, row);
      return view(row);
    },

    async get(userId, id) {
      let row = await repo.get(userId, id);
      if (!row) throw errors.notFound('Try-on');
      if (ACTIVE.includes(row.status)) row = await advance(userId, row);
      return view(row);
    },

    async list(userId, { savedOnly } = {}) {
      return { tryOns: (await repo.list(userId, { savedOnly })).map(view) };
    },

    async setSaved(userId, id, saved) {
      const row = await repo.get(userId, id);
      if (!row) throw errors.notFound('Try-on');
      if (saved && row.status !== STATUS.COMPLETED) throw errors.conflict('TRYON_NOT_READY', 'Only a finished try-on can be saved.');
      return view(await repo.update(userId, id, { saved: Boolean(saved) }));
    },

    async retry(userId, id) {
      if (!provider.enabled) throw new AppError(503, 'TRYON_DISABLED', FRIENDLY.TRYON_DISABLED);
      const row = await repo.get(userId, id);
      if (!row) throw errors.notFound('Try-on');
      if (row.status !== STATUS.FAILED) throw errors.conflict('TRYON_NOT_FAILED', 'Only a failed try-on can be retried.');
      if (!row.wardrobe_item_id || !(await readKey(row.garment_image_key)) || !(await readKey(row.user_image_key))) {
        throw new AppError(422, 'TRYON_INPUT_GONE', 'The photo or the piece of this try-on is no longer available. Start a new try-on.');
      }
      await checkQuota(userId);
      const reset = await repo.update(userId, id, { status: STATUS.PENDING, providerJobId: null, errorCode: null, errorMessage: null, resultImageKey: null, resultRemoteUrl: null, completedAt: null, startedAt: new Date(now()), attempts: (row.attempts || 1) + 1 });
      return view(await submit(userId, reset));
    },

    async remove(userId, id) {
      const row = await repo.remove(userId, id);
      if (!row) throw errors.notFound('Try-on');
      for (const k of [row.user_image_key, row.result_image_key]) if (k) await storage.remove(k).catch(() => {});
      lastCheck.delete(id);
    },

    // Account deletion (US-06): every try-on file of the user is removed; rows go by ON DELETE CASCADE.
    async deleteFilesOf(userId) {
      for (const k of await repo.keysOf(userId)) await storage.remove(k).catch(() => {});
    },
  };
}

module.exports = { virtualTryOnService, FRIENDLY };
