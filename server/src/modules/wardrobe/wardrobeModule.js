// Wardrobe: add a piece by photo (US-08) with details (US-09), saved only after review (US-11),
// browse and filter (US-12), edit later (US-71), closet gaps (US-64). Provides IWardrobe.
const express = require('express');
const multer = require('multer');
const v = require('../../shared/validate');
const { errors } = require('../../shared/errors');
const { CATEGORIES, COLOURS, FABRICS, SEASONS, STYLES, STATUSES, DELETE_REASONS, CURRENCIES, REHOME_METHODS } = require('../../shared/vocabulary');
const { costPerWear } = require('../intelligence/insights');
const { TOPICS } = require('../../events/eventBus');
const { sniffType } = require('./photoStorage');
const { closetGaps } = require('./closetGaps');
const { effectOf } = require('../../shared/deletionPolicy');
const config = require('../../config');

const detailsSchema = {
  name: { type: 'string', min: 1, max: 60, label: 'Name' },
  category: { type: 'enum', values: CATEGORIES, required: true, label: 'Category' },
  colour: { type: 'enum', values: COLOURS, required: true, label: 'Colour' },
  fabric: { type: 'enum', values: FABRICS },
  season: { type: 'enum', values: SEASONS },
  size: { type: 'string', max: 10 },
  styles: { type: 'enumArray', values: STYLES, max: STYLES.length },
  dressCodes: { type: 'enumArray', values: [1, 2, 3, 4, 5], min: 1, max: 5, required: true, label: 'At least one dress-code level' },
  modest: { type: 'bool' },
  // v1.5 cost per wear — optional personal data
  price: { type: 'number', min: 0, max: 1000000, label: 'Price' },
  currency: { type: 'enum', values: CURRENCIES, label: 'Currency' },
  purchaseDate: { type: 'date', label: 'Purchase date' },
};
// Editing: every field optional, but if given it must still be valid.
const editSchema = Object.fromEntries(Object.entries(detailsSchema).map(([k, r]) => [k, { ...r, required: false }]));
const filterSchema = {
  category: { type: 'enum', values: CATEGORIES },
  status: { type: 'enum', values: STATUSES },
};

function toApi(row, info, storage) {
  const st = typeof info === 'string' ? { status: info } : (info || {});
  return {
    id: row.id,
    name: row.name || null,
    category: row.category,
    colour: row.colour,
    fabric: row.fabric,
    season: row.season,
    size: row.size,
    styles: row.styles,
    dressCodes: row.dress_codes.map(Number),
    modest: row.modest,
    status: st.status || 'Available',
    statusSince: st.since || null,
    statusUntil: st.until || null,
    statusNote: st.note || null,
    expectedBack: st.expectedBack || null,
    wearCount: row.wear_count,
    lastWornAt: row.last_worn_at,
    price: row.price === null || row.price === undefined ? null : Number(row.price),
    currency: row.price === null || row.price === undefined ? null : (row.currency || 'EGP'),
    purchaseDate: row.purchase_date ? String(row.purchase_date).slice(0, 10) : null,
    costPerWear: costPerWear({ price: row.price === null || row.price === undefined ? null : Number(row.price), currency: row.currency, wearCount: row.wear_count }),
    rehome: row.rehome_method ? { method: row.rehome_method, label: { donate: 'Ready to donate', give: 'Ready to give away', sell: 'Ready to sell / rehome' }[row.rehome_method], since: row.rehome_started } : null,
    photoUrl: storage.signedUrl(row.photo_key),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function wardrobeRepository(db) {
  return {
    async create(userId, photoKey, d) {
      const { rows } = await db.query(
        `INSERT INTO wardrobe.items (user_id, photo_key, category, colour, fabric, season, size, styles, dress_codes, modest, name, price, currency, purchase_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
        [userId, photoKey, d.category, d.colour, d.fabric || null, d.season || null, d.size || null,
          d.styles || [], d.dressCodes, d.modest || false, d.name ? d.name.trim() : null,
          d.price ?? null, d.price !== undefined && d.price !== null ? (d.currency || 'EGP') : null, d.purchaseDate || null],
      );
      return rows[0];
    },
    // Every query is scoped by user_id: a user can never reach another user's pieces.
    async list(userId, category) {
      const { rows } = await db.query(
        `SELECT i.*, r.method AS rehome_method, r.started_at AS rehome_started FROM wardrobe.items i
           LEFT JOIN wardrobe.rehoming r ON r.item_id = i.id
          WHERE i.user_id = $1 AND ($2::text IS NULL OR i.category = $2)
         ORDER BY i.created_at DESC`,
        [userId, category || null],
      );
      return rows;
    },
    async get(userId, id) {
      if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
      const { rows } = await db.query(`SELECT i.*, r.method AS rehome_method, r.started_at AS rehome_started FROM wardrobe.items i
        LEFT JOIN wardrobe.rehoming r ON r.item_id = i.id WHERE i.id = $1 AND i.user_id = $2`, [id, userId]);
      return rows[0] || null;
    },
    // Rehoming (v1.5): the piece is still owned until the user confirms it has left.
    async startRehome(userId, id, method) {
      const { rows } = await db.query(`INSERT INTO wardrobe.rehoming (item_id, user_id, method)
        SELECT id, user_id, $3 FROM wardrobe.items WHERE id = $1 AND user_id = $2
        ON CONFLICT (item_id) DO UPDATE SET method = EXCLUDED.method RETURNING item_id`, [id, userId, method]);
      return rows.length === 1;
    },
    async cancelRehome(userId, id) {
      const { rowCount } = await db.query('DELETE FROM wardrobe.rehoming WHERE item_id = $1 AND user_id = $2', [id, userId]);
      return rowCount === 1;
    },
    async update(userId, id, d) {
      const { rows } = await db.query(
        `UPDATE wardrobe.items SET
           category = COALESCE($3, category), colour = COALESCE($4, colour),
           fabric = CASE WHEN $11::boolean THEN $5 ELSE fabric END,
           season = CASE WHEN $12::boolean THEN $6 ELSE season END,
           size = CASE WHEN $13::boolean THEN $7 ELSE size END,
           styles = COALESCE($8, styles), dress_codes = COALESCE($9, dress_codes), modest = COALESCE($10, modest),
           name = CASE WHEN $14::boolean THEN $15 ELSE name END,
           price = CASE WHEN $16::boolean THEN $17::numeric ELSE price END,
           currency = CASE WHEN $16::boolean AND $17::numeric IS NULL THEN NULL WHEN $18::boolean THEN $19 WHEN $16::boolean AND currency IS NULL THEN 'EGP' ELSE currency END,
           purchase_date = CASE WHEN $20::boolean THEN $21::date ELSE purchase_date END,
           updated_at = now()
         WHERE id = $1 AND user_id = $2 RETURNING *`,
        [id, userId, d.category ?? null, d.colour ?? null, d.fabric ?? null, d.season ?? null, d.size ?? null,
          d.styles ?? null, d.dressCodes ?? null, d.modest ?? null, 'fabric' in d, 'season' in d, 'size' in d,
          'name' in d, d.name ? d.name.trim() : null, 'price' in d, d.price ?? null, 'currency' in d && d.currency !== null, d.currency ?? null,
          'purchaseDate' in d, d.purchaseDate ?? null],
      );
      return rows[0] ? this.get(userId, id) : null;
    },
    async recordWear(userId, ids, day) {
      await db.query(
        `UPDATE wardrobe.items SET wear_count = wear_count + 1,
           last_worn_at = GREATEST(COALESCE(last_worn_at, $3::date), $3::date) WHERE user_id = $1 AND id = ANY($2::uuid[])`,
        [userId, ids, day],
      );
    },
    // US-13: the reason is kept (without the photo) so Smart Shopping can suggest a replacement.
    async remove(userId, id, reason, note) {
      if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
      const { rows } = await db.query('DELETE FROM wardrobe.items WHERE id = $1 AND user_id = $2 RETURNING *', [id, userId]);
      if (!rows[0]) return null;
      const r = rows[0];
      await db.query('INSERT INTO wardrobe.deletions (user_id, name, category, colour, wear_count, reason, note, styles, dress_codes, fabric) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
        [userId, r.name, r.category, r.colour, r.wear_count, reason, note || null, r.styles || [], r.dress_codes || [], r.fabric || null]);
      return r;
    },
    async deletions(userId) {
      const { rows } = await db.query('SELECT * FROM wardrobe.deletions WHERE user_id = $1 ORDER BY deleted_at DESC', [userId]);
      return rows.map((d) => ({ name: d.name, category: d.category, colour: d.colour, wearCount: d.wear_count, reason: d.reason, note: d.note, styles: d.styles || [], dressCodes: d.dress_codes || [], fabric: d.fabric, deletedAt: d.deleted_at }));
    },
    async photoKeys(userId) {
      const { rows } = await db.query('SELECT photo_key FROM wardrobe.items WHERE user_id = $1', [userId]);
      return rows.map((r) => r.photo_key);
    },
  };
}

function wardrobeService({ repo, storage, bus, availability, profile }) {
  async function withStatus(userId, rows) {
    const info = await availability.infoMap(userId);
    return rows.map((r) => toApi(r, info.get(r.id), storage));
  }

  return {
    // US-11: the piece only exists after Save — the app sends photo and details together.
    async addPiece(userId, file, details) {
      if (!file) throw errors.validation([{ field: 'photo', message: 'A photo is required' }]);
      const mime = sniffType(file.buffer);
      if (!mime) throw errors.unsupportedMedia();
      const key = await storage.save(file.buffer, mime);
      try {
        const row = await repo.create(userId, key, details);
        await bus.publish(TOPICS.ItemCreated, { userId, itemId: row.id });
        return toApi(row, 'Available', storage);
      } catch (e) {
        await storage.remove(key); // do not leave an orphan photo behind
        throw e;
      }
    },

    // US-12: filters combine (category AND status); counts are returned for the filter chips.
    async browse(userId, { category, status } = {}) {
      const all = await withStatus(userId, await repo.list(userId));
      const counts = { category: {}, status: {} };
      for (const c of CATEGORIES) counts.category[c] = all.filter((i) => i.category === c && (!status || i.status === status)).length;
      for (const s of STATUSES) counts.status[s] = all.filter((i) => i.status === s && (!category || i.category === category)).length;
      const items = all.filter((i) => (!category || i.category === category) && (!status || i.status === status));
      return { items, counts, total: all.length };
    },

    async getPiece(userId, id) {
      const row = await repo.get(userId, id);
      if (!row) throw errors.notFound('Piece');
      return (await withStatus(userId, [row]))[0];
    },

    async editPiece(userId, id, changes) {
      const row = await repo.update(userId, id, changes);
      if (!row) throw errors.notFound('Piece');
      return (await withStatus(userId, [row]))[0];
    },

    async deletePiece(userId, id, reason, note) {
      const row = await repo.remove(userId, id, reason, note);
      if (!row) throw errors.notFound('Piece');
      await storage.remove(row.photo_key);
      // Observer: Smart Shopping reacts to the reason (replacement on the list, or nothing).
      const deletion = { name: row.name, category: row.category, colour: row.colour, wearCount: row.wear_count, reason, styles: row.styles || [], dressCodes: row.dress_codes || [] };
      const reactions = [];
      await bus.publish(TOPICS.ItemDeleted, { userId, deletion }, { reactions });
      return { deleted: true, reason, effect: effectOf(reason).effect, addedToShoppingList: reactions.find((x) => x.listItem)?.listItem || null };
    },
    async deletions(userId) { return repo.deletions(userId); },

    // v1.5 Donate / give / sell: two steps, the user stays in control.
    //   start  → "Ready to donate": still in the closet, left out of new outfits
    //   done   → leaves the active closet with reason Donated / Given away / Sold / rehomed (history kept, no replacement)
    //   cancel → back to normal
    async startRehome(userId, id, method) {
      const p = await this.getPiece(userId, id);
      if (!(await repo.startRehome(userId, id, method))) throw errors.notFound('Piece');
      return { ...p, rehome: { method, label: { donate: 'Ready to donate', give: 'Ready to give away', sell: 'Ready to sell / rehome' }[method], since: new Date().toISOString() } };
    },
    async cancelRehome(userId, id) {
      if (!(await repo.cancelRehome(userId, id))) throw errors.notFound('Donation');
      return this.getPiece(userId, id);
    },
    async completeRehome(userId, id) {
      const p = await this.getPiece(userId, id);
      if (!p.rehome) throw errors.conflict('NOT_MARKED', 'Mark the piece as ready to donate, give or sell first.');
      const reason = REHOME_METHODS[p.rehome.method];
      return { ...(await this.deletePiece(userId, id, reason)), piece: { id: p.id, name: p.name, category: p.category, colour: p.colour } };
    },

    async gaps(userId) {
      const items = (await repo.list(userId)).map((r) => ({ category: r.category, dressCodes: r.dress_codes.map(Number) }));
      return closetGaps(items, await profile.preferences(userId));
    },

    // v1.5 duplicate detection on Add (also used by Ask Closet and Smart Shopping through similarOwned).
    async similar(userId, d) {
      const { similarOwned } = require('../shopping/shoppingModule');
      const pieces = (await this.allPieces(userId)).filter((p) => !p.rehome);
      const want = { category: d.category, colour: d.colour, styles: d.styles || [], dressCodes: d.dressCodes || [], season: d.season };
      const list = similarOwned(pieces, want);
      const noun = { Top: 'top', Dress: 'dress', Bottom: 'bottom', Layer: 'layer', Shoes: 'pair of shoes', Bag: 'bag', Extra: 'accessory' }[d.category];
      const plural = { Top: 'tops', Dress: 'dresses', Bottom: 'bottoms', Layer: 'layers', Shoes: 'pairs of shoes', Bag: 'bags', Extra: 'accessories' }[d.category];
      return {
        count: list.length,
        similar: list.slice(0, 6).map((p) => ({ id: p.id, name: p.name, category: p.category, colour: p.colour, photoUrl: p.photoUrl, similarity: p.similarity, matched: p.matched })),
        message: list.length ? `You already own ${list.length === 1 ? `a similar ${d.colour.toLowerCase()} ${noun}` : `${list.length} similar ${d.colour.toLowerCase()} ${plural}`}.` : null,
        actions: list.length ? ['Add anyway', 'View similar', 'Cancel'] : [],
      };
    },

    // IWardrobe: every piece with its status, for the recommendation engine and the builder.
    async allPieces(userId) {
      return withStatus(userId, await repo.list(userId));
    },
    async recordWear(userId, ids, day) {
      await repo.recordWear(userId, ids, day);
    },
    // IWardrobe: other modules read pieces through this, never through the table.
    async piecesByIds(userId, ids) {
      const rows = (await repo.list(userId)).filter((r) => ids.includes(r.id));
      return rows.map((r) => toApi(r, null, storage));
    },

    async deletePhotosOf(userId) {
      for (const key of await repo.photoKeys(userId)) await storage.remove(key);
    },
  };
}

function wardrobeRoutes({ wardrobe }) {
  // multer rejects a file that reaches its limit, so allow one extra byte:
  // exactly 10 MB is accepted, 10 MB + 1 byte is refused (defect D-02, found by BVA test API-W07).
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.maxPhotoBytes + 1, files: 1 } });
  const single = (req, res, next) => upload.single('photo')(req, res, (err) => {
    if (err && err.code === 'LIMIT_FILE_SIZE') return next(errors.payloadTooLarge());
    if (err) return next(errors.validation([{ field: 'photo', message: 'Could not read the photo' }]));
    return next();
  });

  const r = express.Router();
  r.post('/', single, async (req, res, next) => {
    try {
      // Details arrive as one JSON field next to the photo in a multipart form.
      let raw;
      try { raw = JSON.parse(req.body.details || '{}'); } catch { throw errors.validation([{ field: 'details', message: 'Details must be JSON' }]); }
      const details = v.validate(detailsSchema, raw);
      res.status(201).json(await wardrobe.addPiece(req.user.id, req.file, details));
    } catch (e) { next(e); }
  });
  // v1.5 duplicate check before adding (structured metadata, no computer vision): "You already own 3 black fitted tops."
  r.post('/similar', v.body({ ...Object.fromEntries(Object.entries(detailsSchema).map(([k, x]) => [k, { ...x, required: ['category', 'colour'].includes(k) }])), dressCodes: { ...detailsSchema.dressCodes, required: false } }), async (req, res, next) => {
    try { res.json(await wardrobe.similar(req.user.id, req.valid)); } catch (e) { next(e); }
  });
  r.post('/:id/rehome', v.body({ method: { type: 'enum', values: Object.keys(REHOME_METHODS), required: true, label: 'How' } }), async (req, res, next) => {
    try { res.json(await wardrobe.startRehome(req.user.id, req.params.id, req.valid.method)); } catch (e) { next(e); }
  });
  r.delete('/:id/rehome', async (req, res, next) => {
    try { res.json(await wardrobe.cancelRehome(req.user.id, req.params.id)); } catch (e) { next(e); }
  });
  r.post('/:id/rehome/done', async (req, res, next) => {
    try { res.json(await wardrobe.completeRehome(req.user.id, req.params.id)); } catch (e) { next(e); }
  });
  r.get('/', v.query(filterSchema), async (req, res, next) => {
    try { res.json(await wardrobe.browse(req.user.id, req.validQuery)); } catch (e) { next(e); }
  });
  r.get('/:id', async (req, res, next) => {
    try { res.json(await wardrobe.getPiece(req.user.id, req.params.id)); } catch (e) { next(e); }
  });
  r.patch('/:id', v.body(editSchema), async (req, res, next) => {
    try {
      for (const f of ['fabric', 'season', 'size', 'name', 'price', 'currency', 'purchaseDate']) if (req.body[f] === null || req.body[f] === '') req.valid[f] = null;
      res.json(await wardrobe.editPiece(req.user.id, req.params.id, req.valid));
    } catch (e) { next(e); }
  });
  const deleteSchema = {
    reason: { type: 'enum', values: DELETE_REASONS, required: true, label: 'Reason' },
    note: { type: 'string', max: 120, label: 'Note' },
  };
  r.delete('/:id', v.body(deleteSchema), async (req, res, next) => {
    try { res.json(await wardrobe.deletePiece(req.user.id, req.params.id, req.valid.reason, req.valid.note)); } catch (e) { next(e); }
  });
  return r;
}

function photoRoutes({ storage }) {
  const r = express.Router();
  // Public route, but only works with a valid, unexpired signature.
  r.get('/:key', (req, res, next) => {
    if (!storage.verify(req.params.key, req.query.exp, req.query.sig)) return next(errors.notFound('Photo'));
    res.set('Cache-Control', 'private, max-age=600');
    return res.sendFile(storage.filePath(req.params.key), (err) => err && next(errors.notFound('Photo')));
  });
  return r;
}

function registerWardrobe({ db, bus, storage, availability, profile }) {
  const repo = wardrobeRepository(db);
  const service = wardrobeService({ repo, storage, bus, availability, profile });
  bus.subscribe(TOPICS.AccountDeleted, ({ userId }) => service.deletePhotosOf(userId));
  const gapsRouter = express.Router();
  gapsRouter.get('/', async (req, res, next) => {
    try { res.json(await service.gaps(req.user.id)); } catch (e) { next(e); }
  });
  return { service, routes: wardrobeRoutes({ wardrobe: service }), photos: photoRoutes({ storage }), gaps: gapsRouter };
}

module.exports = { registerWardrobe, detailsSchema, editSchema, toApi };
