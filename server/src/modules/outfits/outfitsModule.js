// Outfits: save and favorite (US-26), wear this (US-23), reject with a reason (US-60),
// hide a piece for 7 days (US-61), wear analytics and forgotten pieces (US-52, US-54, US-69).
// Publishes OutfitWorn on the event bus.
const express = require('express');
const v = require('../../shared/validate');
const { errors } = require('../../shared/errors');
const { TOPICS } = require('../../events/eventBus');

const REJECT_REASONS = ['Too formal', 'Too casual', 'Don’t like these colours', 'Not comfortable', 'Wore this recently', 'Don’t like one piece', 'Not in the mood today'];
const UUID = /^[0-9a-f-]{36}$/i;
const today = () => new Date().toISOString().slice(0, 10);

function checkIds(ids, min, max) {
  if (!Array.isArray(ids) || ids.length < min || ids.length > max || !ids.every((x) => typeof x === 'string' && UUID.test(x)) || new Set(ids).size !== ids.length) {
    throw errors.validation([{ field: 'itemIds', message: `itemIds must be ${min}–${max} different piece ids` }]);
  }
  return ids;
}

function outfitsRepository(db) {
  return {
    async save(userId, o) {
      const { rows } = await db.query(
        `INSERT INTO outfits.outfits (user_id, item_ids, occasion, style, rule_score, reasons, source, favorite)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [userId, o.itemIds, o.occasion || null, o.style || null, o.ruleScore ?? null, o.reasons || [], o.source || 'recommended', Boolean(o.favorite)],
      );
      return rows[0];
    },
    async list(userId, favoritesOnly) {
      const { rows } = await db.query(
        `SELECT * FROM outfits.outfits WHERE user_id = $1 AND source <> 'planned' AND ($2::boolean IS FALSE OR favorite) ORDER BY created_at DESC`, [userId, Boolean(favoritesOnly)],
      );
      return rows;
    },
    async get(userId, id) {
      if (!UUID.test(id)) return null;
      const { rows } = await db.query('SELECT * FROM outfits.outfits WHERE id = $1 AND user_id = $2', [id, userId]);
      return rows[0] || null;
    },
    async setFavorite(userId, id, favorite) {
      if (!UUID.test(id)) return null;
      const { rows } = await db.query('UPDATE outfits.outfits SET favorite = $3 WHERE id = $1 AND user_id = $2 RETURNING *', [id, userId, favorite]);
      return rows[0] || null;
    },
    async remove(userId, id) {
      if (!UUID.test(id)) return false;
      const { rowCount } = await db.query("DELETE FROM outfits.outfits WHERE id = $1 AND user_id = $2 AND source <> 'planned'", [id, userId]);
      return rowCount === 1;
    },
    async wear(userId, ids, day, rating, ctx = {}) {
      const { rows } = await db.query('INSERT INTO outfits.wears (user_id, item_ids, worn_on, rating, occasion, temp_c, conditions) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
        [userId, ids, day, rating || null, ctx.occasion || null, ctx.tempC ?? null, ctx.condition || null]);
      return rows[0].id;
    },
    async rate(userId, wearId, rating) {
      const { rowCount } = await db.query('UPDATE outfits.wears SET rating = $3 WHERE id = $1 AND user_id = $2', [wearId, userId, rating]);
      return rowCount === 1;
    },
    async feedback(userId, kind, ids, reason) {
      await db.query('INSERT INTO outfits.feedback (user_id, kind, item_ids, reason) VALUES ($1, $2, $3, $4)', [userId, kind, ids, reason || null]);
    },
    async rejectedLooks(userId) {
      const { rows } = await db.query(
        "SELECT item_ids FROM outfits.feedback WHERE user_id = $1 AND kind = 'reject' AND reason = 'Not in the mood today' AND created_at > now() - interval '7 days'", [userId],
      );
      return rows.map((r) => r.item_ids);
    },
    async hide(userId, itemId, days) {
      await db.query(
        `INSERT INTO outfits.hidden_items (user_id, item_id, until) VALUES ($1, $2, now() + ($3 || ' days')::interval)
         ON CONFLICT (user_id, item_id) DO UPDATE SET until = EXCLUDED.until`, [userId, itemId, String(days)],
      );
    },
    async unhide(userId, itemId) {
      await db.query('DELETE FROM outfits.hidden_items WHERE user_id = $1 AND item_id = $2', [userId, itemId]);
    },
    async hidden(userId) {
      const { rows } = await db.query('SELECT item_id, until FROM outfits.hidden_items WHERE user_id = $1 AND until > now()', [userId]);
      return rows;
    },
    // Learning signals: rejection reasons in the last 60 days and pieces in favourite looks.
    async rejectCounts(userId, days = 60) {
      const { rows } = await db.query(
        "SELECT reason, count(*)::int AS n FROM outfits.feedback WHERE user_id = $1 AND kind = 'reject' AND created_at > now() - ($2 || ' days')::interval GROUP BY reason", [userId, String(days)],
      );
      return Object.fromEntries(rows.map((r) => [r.reason, r.n]));
    },
    async favouriteIds(userId) {
      const { rows } = await db.query('SELECT DISTINCT unnest(item_ids) AS id FROM outfits.outfits WHERE user_id = $1 AND favorite', [userId]);
      return rows.map((r) => r.id);
    },
    // Outfit history (US-91): every "Wear this", newest first, with occasion, rating and weather.
    async history(userId, { from, to, occasion, minRating }) {
      const { rows } = await db.query(
        `SELECT id, item_ids, worn_on, rating, occasion, temp_c, conditions FROM outfits.wears
          WHERE user_id = $1 AND ($2::date IS NULL OR worn_on >= $2) AND ($3::date IS NULL OR worn_on <= $3)
            AND ($4::text IS NULL OR occasion = $4) AND ($5::int IS NULL OR rating >= $5)
          ORDER BY worn_on DESC, id DESC LIMIT 200`, [userId, from || null, to || null, occasion || null, minRating || null],
      );
      return rows;
    },
    async wornSince(userId, days) {
      const { rows } = await db.query(
        "SELECT DISTINCT unnest(item_ids) AS id FROM outfits.wears WHERE user_id = $1 AND worn_on > CURRENT_DATE - ($2 || ' days')::interval", [userId, String(days)],
      );
      return rows.map((r) => r.id);
    },
  };
}

function outfitsService({ repo, wardrobe, bus }) {
  async function withPieces(userId, rows) {
    const all = await wardrobe().allPieces(userId);
    const byId = new Map(all.map((p) => [p.id, p]));
    return rows.map((r) => ({
      id: r.id, occasion: r.occasion, style: r.style, ruleScore: r.rule_score, reasons: r.reasons, source: r.source, favorite: r.favorite, createdAt: r.created_at,
      pieces: r.item_ids.map((id) => byId.get(id)).filter(Boolean),
      wearable: r.item_ids.every((id) => byId.get(id) && byId.get(id).status === 'Available'),
    }));
  }
  async function ownAll(userId, ids) {
    const mine = new Set((await wardrobe().allPieces(userId)).map((p) => p.id));
    if (!ids.every((id) => mine.has(id))) throw errors.notFound('Piece');
  }
  return {
    REJECT_REASONS,
    async save(userId, o) {
      await ownAll(userId, o.itemIds);
      return (await withPieces(userId, [await repo.save(userId, o)]))[0];
    },
    async savePlanned(userId, o) {
      await ownAll(userId, o.itemIds);
      return repo.save(userId, { ...o, source: 'planned' });
    },
    async list(userId, favoritesOnly) { return withPieces(userId, await repo.list(userId, favoritesOnly)); },
    async get(userId, id) {
      const row = await repo.get(userId, id);
      return row ? (await withPieces(userId, [row]))[0] : null;
    },
    async favorite(userId, id, fav) {
      const row = await repo.setFavorite(userId, id, fav);
      if (!row) throw errors.notFound('Outfit');
      return (await withPieces(userId, [row]))[0];
    },
    async remove(userId, id) { if (!(await repo.remove(userId, id))) throw errors.notFound('Outfit'); },
    // US-23: wear count +1 and last-worn = today for every piece; analytics update through OutfitWorn.
    async wear(userId, ids, rating, ctx = {}) {
      await ownAll(userId, ids);
      const pieces = (await wardrobe().allPieces(userId)).filter((p) => ids.includes(p.id));
      const notAvailable = pieces.find((p) => p.status !== 'Available');
      if (notAvailable) throw errors.conflict('NOT_AVAILABLE', `The ${notAvailable.colour.toLowerCase()} ${notAvailable.category.toLowerCase()} is ${notAvailable.status}.`);
      const day = today();
      const wearId = await repo.wear(userId, ids, day, rating, ctx);
      await wardrobe().recordWear(userId, ids, day);
      await bus.publish(TOPICS.OutfitWorn, { userId, itemIds: ids, day });
      return { wearId, day, itemIds: ids };
    },
    async rate(userId, wearId, rating) {
      if (!(await repo.rate(userId, wearId, rating))) throw errors.notFound('Wear');
      return { wearId, rating };
    },
    async reject(userId, ids, reason) {
      await ownAll(userId, ids);
      await repo.feedback(userId, 'reject', ids, reason);
      return { stored: true, hiddenForAWeek: reason === 'Not in the mood today' };
    },
    async swapped(userId, ids) { await repo.feedback(userId, 'swap', ids, null); },
    async hide(userId, itemId, days = 7) {
      await ownAll(userId, [itemId]);
      await repo.hide(userId, itemId, days);
      return { itemId, hiddenDays: days };
    },
    async unhide(userId, itemId) { await repo.unhide(userId, itemId); return { itemId, hidden: false }; },
    async hiddenIds(userId) { return (await repo.hidden(userId)).map((r) => r.item_id); },
    async hiddenUntil(userId) { return Object.fromEntries((await repo.hidden(userId)).map((r) => [r.item_id, r.until])); },
    async rejectedLooks(userId) { return repo.rejectedLooks(userId); },
    async signals(userId) {
      const [rejectCounts, favouriteIds] = await Promise.all([repo.rejectCounts(userId), repo.favouriteIds(userId)]);
      return { rejectCounts, favouriteIds };
    },
    async feedbackRows(userId, days = 60) { return repo.rejectCounts(userId, days); },
    async wornIds(userId, days = 30) { return repo.wornSince(userId, days); },
    async history(userId, filters = {}) {
      const rows = await repo.history(userId, filters);
      const all = await wardrobe().allPieces(userId);
      const byId = new Map(all.map((p) => [p.id, p]));
      const iso = (d) => (d instanceof Date ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : String(d).slice(0, 10));
      const wears = rows.map((r) => ({
        id: Number(r.id), date: iso(r.worn_on), rating: r.rating, occasion: r.occasion,
        weather: r.temp_c === null ? null : { tempC: r.temp_c, condition: r.conditions },
        pieces: r.item_ids.map((id) => byId.get(id)).filter(Boolean),
      }));
      const occasions = [...new Set(wears.map((w) => w.occasion).filter(Boolean))];
      const rated = wears.filter((w) => w.rating);
      return { wears, total: wears.length, occasions, averageRating: rated.length ? Math.round((rated.reduce((t, w) => t + w.rating, 0) / rated.length) * 10) / 10 : null };
    },
    // US-52 most/least worn, US-54 forgotten pieces, US-69 utilization.
    async insights(userId) {
      const pieces = await wardrobe().allPieces(userId);
      const now = Date.now();
      const daysSince = (d) => Math.floor((now - new Date(d)) / 86400000);
      const worn30 = new Set(await repo.wornSince(userId, 30));
      const sorted = [...pieces].sort((a, b) => b.wearCount - a.wearCount || String(a.name).localeCompare(String(b.name)) || a.id.localeCompare(b.id));
      const forgotten = pieces.filter((p) => p.wearCount > 0 && p.lastWornAt && daysSince(p.lastWornAt) >= 40)
        .map((p) => ({ ...p, daysSince: daysSince(p.lastWornAt) })).sort((a, b) => b.daysSince - a.daysSince);
      return {
        total: pieces.length,
        utilization: pieces.length ? Math.round((pieces.filter((p) => worn30.has(p.id)).length / pieces.length) * 100) : 0,
        wornLast30: pieces.filter((p) => worn30.has(p.id)).length,
        mostWorn: sorted.filter((p) => p.wearCount > 0).slice(0, 5),
        leastWorn: [...sorted].reverse().slice(0, 5),
        forgotten,
        neverWorn: pieces.filter((p) => p.wearCount === 0).length,
      };
    },
  };
}

function outfitsRoutes({ outfits }) {
  const r = express.Router();
  const saveSchema = {
    occasion: { type: 'string', max: 30 }, style: { type: 'string', max: 30 },
    ruleScore: { type: 'int', min: 0, max: 100 }, favorite: { type: 'bool' },
    source: { type: 'enum', values: ['recommended', 'built'] },
  };
  r.get('/', async (req, res, next) => {
    try { res.json({ outfits: await outfits.list(req.user.id, req.query.favorites === 'true') }); } catch (e) { next(e); }
  });
  r.post('/', v.body(saveSchema), async (req, res, next) => {
    try {
      const itemIds = checkIds(req.body.itemIds, 2, 4);
      const reasons = Array.isArray(req.body.reasons) ? req.body.reasons.filter((x) => typeof x === 'string').slice(0, 6).map((x) => x.slice(0, 200)) : [];
      res.status(201).json(await outfits.save(req.user.id, { ...req.valid, itemIds, reasons }));
    } catch (e) { next(e); }
  });
  r.patch('/:id', v.body({ favorite: { type: 'bool', required: true } }), async (req, res, next) => {
    try { res.json(await outfits.favorite(req.user.id, req.params.id, req.valid.favorite)); } catch (e) { next(e); }
  });
  r.delete('/:id', async (req, res, next) => {
    try { await outfits.remove(req.user.id, req.params.id); res.status(204).end(); } catch (e) { next(e); }
  });
  r.post('/wear', v.body({ rating: { type: 'int', min: 1, max: 5 }, occasion: { type: 'string', max: 30 }, tempC: { type: 'int', min: -30, max: 55 }, condition: { type: 'string', max: 40 } }), async (req, res, next) => {
    try {
      const { rating, ...ctx } = req.valid;
      res.status(201).json(await outfits.wear(req.user.id, checkIds(req.body.itemIds, 2, 4), rating, ctx));
    } catch (e) { next(e); }
  });
  r.get('/history', v.query({ from: { type: 'date' }, to: { type: 'date' }, occasion: { type: 'string', max: 30 }, minRating: { type: 'int', min: 1, max: 5 } }), async (req, res, next) => {
    try { res.json(await outfits.history(req.user.id, { ...req.validQuery, minRating: req.validQuery.minRating ? Number(req.validQuery.minRating) : null })); } catch (e) { next(e); }
  });
  r.patch('/wears/:id', v.body({ rating: { type: 'int', min: 1, max: 5, required: true } }), async (req, res, next) => {
    try { res.json(await outfits.rate(req.user.id, Number(req.params.id), req.valid.rating)); } catch (e) { next(e); }
  });
  r.post('/reject', v.body({ reason: { type: 'enum', values: REJECT_REASONS, required: true } }), async (req, res, next) => {
    try { res.json(await outfits.reject(req.user.id, checkIds(req.body.itemIds, 2, 4), req.valid.reason)); } catch (e) { next(e); }
  });
  const items = express.Router();
  items.post('/:id/hide', async (req, res, next) => {
    try { checkIds([req.params.id], 1, 1); res.json(await outfits.hide(req.user.id, req.params.id, 7)); } catch (e) { next(e); }
  });
  items.delete('/:id/hide', async (req, res, next) => {
    try { checkIds([req.params.id], 1, 1); res.json(await outfits.unhide(req.user.id, req.params.id)); } catch (e) { next(e); }
  });
  const insights = express.Router();
  insights.get('/', async (req, res, next) => {
    try { res.json(await outfits.insights(req.user.id)); } catch (e) { next(e); }
  });
  return { outfits: r, items, insights };
}

function registerOutfits({ db, bus, wardrobe }) {
  const service = outfitsService({ repo: outfitsRepository(db), wardrobe, bus });
  return { service, routes: outfitsRoutes({ outfits: service }) };
}

module.exports = { registerOutfits, REJECT_REASONS, checkIds };
