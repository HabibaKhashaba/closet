// VirtualTryOnController — HTTP layer of Virtual Try-On, mounted at /api/v1/virtual-try-on (behind login).
//   GET    /status            is it set up? provider, supported categories, limits
//   GET    /photo             the saved try-on photo (signed URL) or null
//   PUT    /photo             save / replace it (multipart: photo, consent=true)
//   DELETE /photo             delete it
//   POST   /                  start a try-on (multipart: wardrobeItemId, photo | useSavedPhoto=true, savePhoto,
//                             outfitId?, outfitItemIds? (JSON list), consent=true) → 202 { tryOnId, status, … }
//   GET    /                  my try-ons (?saved=true for saved results only)
//   GET    /:id               one try-on; while PROCESSING each call checks the provider once
//   POST   /:id/save          keep the result in my try-ons ({ saved: false } to unsave)
//   POST   /:id/retry         retry a FAILED try-on with the same photo and piece
//   DELETE /:id               delete the try-on and its images
const express = require('express');
const multer = require('multer');
const { errors } = require('../../shared/errors');

const yes = (v) => v === true || v === 'true' || v === '1' || v === 'on';

function virtualTryOnController({ service, maxPhotoBytes }) {
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: maxPhotoBytes + 1, files: 1, fields: 10 } });
  const photo = (req, res, next) => upload.single('photo')(req, res, (err) => {
    if (err && err.code === 'LIMIT_FILE_SIZE') return next(errors.payloadTooLarge());
    if (err) return next(errors.validation([{ field: 'photo', message: 'Could not read the photo' }]));
    return next();
  });
  const h = (fn) => async (req, res, next) => { try { await fn(req, res); } catch (e) { next(e); } };
  const r = express.Router();

  r.get('/status', h(async (_req, res) => res.json(service.status())));
  r.get('/photo', h(async (req, res) => res.json(await service.getPhoto(req.user.id))));
  r.put('/photo', photo, h(async (req, res) => res.json(await service.savePhoto(req.user.id, req.file, yes(req.body && req.body.consent)))));
  r.delete('/photo', h(async (req, res) => res.json(await service.deletePhoto(req.user.id))));

  r.post('/', photo, h(async (req, res) => {
    const b = req.body || {};
    let outfitItemIds = [];
    if (b.outfitItemIds) {
      try { outfitItemIds = JSON.parse(b.outfitItemIds); } catch { throw errors.validation([{ field: 'outfitItemIds', message: 'outfitItemIds must be a JSON list' }]); }
    }
    const out = await service.create(req.user.id, {
      wardrobeItemId: b.wardrobeItemId, outfitId: b.outfitId || null, outfitItemIds, file: req.file,
      useSavedPhoto: yes(b.useSavedPhoto), savePhoto: yes(b.savePhoto), consent: yes(b.consent),
    });
    res.status(out.status === 'FAILED' ? 201 : 202).json(out);
  }));
  r.get('/', h(async (req, res) => res.json(await service.list(req.user.id, { savedOnly: req.query.saved === 'true' }))));
  r.get('/:id', h(async (req, res) => res.json(await service.get(req.user.id, req.params.id))));
  r.post('/:id/save', express.json(), h(async (req, res) => res.json(await service.setSaved(req.user.id, req.params.id, !(req.body && req.body.saved === false)))));
  r.post('/:id/retry', h(async (req, res) => res.status(202).json(await service.retry(req.user.id, req.params.id))));
  r.delete('/:id', h(async (req, res) => { await service.remove(req.user.id, req.params.id); res.status(204).end(); }));
  return r;
}

module.exports = { virtualTryOnController };
