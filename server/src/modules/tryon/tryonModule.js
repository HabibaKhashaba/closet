// Virtual try-on with a photo-real AI provider (US-118). The overlay preview in the browser stays as the fallback.
// Flow: the user's full-body photo (multipart, kept in memory only, never stored) + the look's pieces →
// the Try-On adapter dresses the person one garment at a time (one-piece, or bottom then top, then the layer)
// → the result image URL comes back labelled as AI-generated. Shoes, bags and extras are not sent (the
// provider does not support them); the response lists them as skipped.
const fs = require('fs/promises');
const express = require('express');
const multer = require('multer');
const config = require('../../config');
const { errors, AppError } = require('../../shared/errors');
const { sniffType } = require('../wardrobe/photoStorage');
const { TryOnError } = require('./fashnAdapter');

// Closet category → provider category, and the order garments are put on.
const PROVIDER_CATEGORY = { Dress: 'one-pieces', Bottom: 'bottoms', Top: 'tops', Layer: 'tops' };
const ORDER = { Dress: 0, Bottom: 1, Top: 2, Layer: 3 };
const MIME_BY_EXT = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic' };

function plan(pieces) {
  const worn = pieces.filter((p) => PROVIDER_CATEGORY[p.category]);
  const hasDress = worn.some((p) => p.category === 'Dress');
  const use = worn.filter((p) => !(hasDress && (p.category === 'Bottom' || p.category === 'Top'))) // a dress replaces top + bottom
    .sort((a, b) => ORDER[a.category] - ORDER[b.category]);
  const skipped = pieces.filter((p) => !use.includes(p));
  return { use, skipped };
}

function dailyLimiter(limit, now = () => Date.now()) {
  const used = new Map(); // userId → { day, count } (in memory: resets on restart; enough for a course deployment)
  return {
    take(userId) {
      const day = new Date(now()).toISOString().slice(0, 10);
      const u = used.get(userId);
      const count = u && u.day === day ? u.count : 0;
      if (count >= limit) return false;
      used.set(userId, { day, count: count + 1 });
      return true;
    },
  };
}

function tryOnService({ wardrobe, storage, adapter, limiter }) {
  async function garmentImage(piece) {
    const m = /\/photos\/([^?]+)/.exec(piece.photoUrl || '');
    if (!m) throw errors.notFound('Piece photo');
    const key = m[1];
    const buf = await fs.readFile(storage.filePath(key));
    return `data:${MIME_BY_EXT[key.split('.').pop()] || 'image/jpeg'};base64,${buf.toString('base64')}`;
  }
  return {
    status() { return { enabled: adapter.enabled, provider: adapter.enabled ? adapter.name : null, dailyLimit: config.tryOn.dailyLimit }; },
    async tryOn(userId, file, itemIds) {
      if (!adapter.enabled) throw new AppError(503, 'TRYON_DISABLED', 'AI try-on is not set up on this server. The simulated preview still works.');
      if (!file) throw errors.validation([{ field: 'photo', message: 'A full-body photo is required' }]);
      const mime = sniffType(file.buffer);
      if (!mime || mime === 'image/heic') throw errors.unsupportedMedia();
      if (!Array.isArray(itemIds) || itemIds.length < 1 || itemIds.length > 6) throw errors.validation([{ field: 'itemIds', message: 'Choose 1 to 6 pieces' }]);
      const pieces = [];
      for (const id of itemIds) pieces.push(await wardrobe().getPiece(userId, id)); // 404 for someone else's piece
      const { use, skipped } = plan(pieces);
      if (!use.length) throw errors.validation([{ field: 'itemIds', message: 'The look needs a top, bottom, dress or layer to try on' }]);
      if (!limiter.take(userId)) throw new AppError(429, 'TRYON_LIMIT', `You can create ${config.tryOn.dailyLimit} AI try-ons a day. The simulated preview has no limit.`);
      let person = `data:${mime};base64,${file.buffer.toString('base64')}`;
      try {
        for (const p of use) {
          // Each step dresses the result of the previous one.
          person = (await adapter.tryOn({ personImage: person, garmentImage: await garmentImage(p), category: PROVIDER_CATEGORY[p.category] })).imageUrl;
        }
      } catch (e) {
        if (e instanceof TryOnError) throw new AppError(e.code === 'TRYON_TIMEOUT' ? 504 : 502, e.code, `${e.message} The simulated preview is shown instead.`);
        throw e;
      }
      return {
        imageUrl: person,
        aiGenerated: true,
        provider: adapter.name,
        applied: use.map((p) => ({ id: p.id, name: p.name, category: p.category })),
        skipped: skipped.map((p) => ({ id: p.id, name: p.name, category: p.category })),
      };
    },
  };
}

function tryOnRoutes({ tryOn }) {
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.maxPhotoBytes + 1, files: 1 } });
  const r = express.Router();
  r.get('/status', (_req, res) => res.json(tryOn.status()));
  r.post('/', (req, res, next) => upload.single('photo')(req, res, (err) => {
    if (err && err.code === 'LIMIT_FILE_SIZE') return next(errors.payloadTooLarge());
    if (err) return next(errors.validation([{ field: 'photo', message: 'Could not read the photo' }]));
    return next();
  }), async (req, res, next) => {
    try {
      let ids;
      try { ids = JSON.parse(req.body.itemIds || '[]'); } catch { throw errors.validation([{ field: 'itemIds', message: 'itemIds must be a JSON list' }]); }
      res.json(await tryOn.tryOn(req.user.id, req.file, ids));
    } catch (e) { next(e); }
  });
  return r;
}

function registerTryOn({ wardrobe, storage, adapter, limiter }) {
  const tryOn = tryOnService({ wardrobe, storage, adapter, limiter: limiter || dailyLimiter(config.tryOn.dailyLimit) });
  return { service: tryOn, routes: tryOnRoutes({ tryOn }) };
}

module.exports = { registerTryOn, tryOnService, plan, dailyLimiter, PROVIDER_CATEGORY };
