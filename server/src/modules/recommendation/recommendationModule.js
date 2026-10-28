// Recommendation Engine module: 3 explained outfits (US-19 – 21, US-57), change one piece (US-24),
// "Style this piece" (US-59), outfit builder check (US-42, 43, 66). Provides IRecommend.
// Requires IWardrobe, IAvailability (statuses come with the pieces), IPreferences and IWeather.
const express = require('express');
const v = require('../../shared/validate');
const { errors } = require('../../shared/errors');
const { OCCASIONS, STYLES } = require('../../shared/vocabulary');
const engine = require('./engine');
const { checkIds } = require('../outfits/outfitsModule');

const todayStr = () => new Date().toISOString().slice(0, 10);

function recommendationService({ wardrobe, profile, outfits, weather }) {
  async function context(userId, { date, tempC } = {}) {
    const prefs = await profile.preferences(userId);
    const day = date || todayStr();
    const w = tempC !== undefined ? { date: day, tempC, high: tempC, low: tempC, condition: 'Set by you', source: 'manual' } : await weather.forDate(prefs.city, day);
    // Planning ahead (calendar): a piece in the laundry, borrowed or packed counts as Available
    // on a later date if it is expected back by then (laundry basket time or its return date).
    let pieces = await wardrobe().allPieces(userId);
    const back = [];
    if (day > todayStr()) {
      pieces = pieces.map((p) => {
        if (p.status !== 'Available' && p.status !== 'Unavailable' && p.expectedBack && p.expectedBack <= day) { back.push({ ...p, statusNow: p.status }); return { ...p, status: 'Available', backBy: p.expectedBack, statusNow: p.status }; }
        return p;
      });
    }
    const sig = outfits().signals ? await outfits().signals(userId) : {};
    const signals = { ...sig, total: pieces.length, availableCount: pieces.filter((p) => p.status === 'Available').length };
    return { prefs, weather: w, pieces, back, signals, today: new Date(`${day}T12:00:00`), hiddenIds: await outfits().hiddenIds(userId) };
  }
  const backNote = (ctx, ids) => {
    const used = ctx.back.filter((p) => ids.some((o) => o.itemIds.includes(p.id)));
    return used.length ? `${used.map((p) => (p.name || `${p.colour} ${p.category}`).toLowerCase()).join(', ')} will be back from ${used[0].statusNow === 'Laundry' ? 'the laundry' : used[0].statusNow.toLowerCase()} by then.` : null;
  };
  const attach = (pieces, o) => o && { ...o, pieces: o.itemIds.map((id) => pieces.find((p) => p.id === id)) };

  return {
    // IWeather for the web app
    async weather(userId, date) {
      const prefs = await profile.preferences(userId);
      return weather.forDate(prefs.city, date || todayStr());
    },
    // IRecommend
    async recommend(userId, { occasion, style, date, tempC, level, fixedId }) {
      const ctx = await context(userId, { date, tempC });
      if (fixedId && !ctx.pieces.some((p) => p.id === fixedId)) throw errors.notFound('Piece');
      const fixed = fixedId && ctx.pieces.find((p) => p.id === fixedId);
      const result = engine.recommend(ctx.pieces, {
        occasion, style, level, fixedId, prefs: ctx.prefs, weather: ctx.weather, hiddenIds: ctx.hiddenIds, today: ctx.today, signals: ctx.signals,
        rejectedLooks: await outfits().rejectedLooks(userId),
      });
      result.availabilityNote = backNote(ctx, result.outfits);
      if (fixed && fixed.status !== 'Available') result.note = `This piece is ${fixed.status}. Change its status to style it.`;
      return { ...result, occasion, style: style || null, weather: ctx.weather, outfits: result.outfits.map((o) => attach(ctx.pieces, o)) };
    },
    async swap(userId, { itemIds, slot, occasion, style, date, tempC, level }) {
      const ctx = await context(userId, { date, tempC });
      if (!itemIds.every((id) => ctx.pieces.some((p) => p.id === id))) throw errors.notFound('Piece');
      const r = engine.swap(ctx.pieces, itemIds, slot, { occasion, style, level, prefs: ctx.prefs, weather: ctx.weather, hiddenIds: ctx.hiddenIds, today: ctx.today, signals: ctx.signals });
      if (r.outfit) await outfits().swapped(userId, itemIds);
      return {
        outfit: attach(ctx.pieces, r.outfit),
        alternatives: r.alternatives.map((a) => ({ ...a, piece: ctx.pieces.find((p) => p.id === a.itemId) })),
        options: r.options.map((o) => ({ piece: ctx.pieces.find((p) => p.id === o.itemId), outfit: attach(ctx.pieces, o.outfit) })),
        note: r.outfit ? null : 'No other Available piece fits this slot.',
      };
    },
    async check(userId, { itemIds, occasion, style, date, tempC, level }) {
      const ctx = await context(userId, { date, tempC });
      const chosen = itemIds.map((id) => ctx.pieces.find((p) => p.id === id));
      if (chosen.some((p) => !p)) throw errors.notFound('Piece');
      return { ...engine.check(chosen, { occasion, style, level, prefs: ctx.prefs, weather: ctx.weather }), forecast: ctx.weather, pieces: chosen };
    },
  };
}

const optionsSchema = {
  occasion: { type: 'enum', values: Object.keys(OCCASIONS) },
  style: { type: 'enum', values: STYLES },
  date: { type: 'date' },
  tempC: { type: 'int', min: -30, max: 55 },
  level: { type: 'int', min: 1, max: 5 },
};

function recommendationRoutes({ rec }) {
  const r = express.Router();
  r.post('/', v.body({ ...optionsSchema, occasion: { ...optionsSchema.occasion, required: true, label: 'Occasion' }, fixedId: { type: 'string', max: 36 } }), async (req, res, next) => {
    try {
      if (req.valid.fixedId) checkIds([req.valid.fixedId], 1, 1);
      res.json(await rec.recommend(req.user.id, req.valid));
    } catch (e) { next(e); }
  });
  r.post('/swap', v.body({ ...optionsSchema, slot: { type: 'int', min: 0, max: 3, required: true } }), async (req, res, next) => {
    try { res.json(await rec.swap(req.user.id, { ...req.valid, itemIds: checkIds(req.body.itemIds, 2, 4) })); } catch (e) { next(e); }
  });
  r.post('/check', v.body(optionsSchema), async (req, res, next) => {
    try { res.json(await rec.check(req.user.id, { ...req.valid, itemIds: checkIds(req.body.itemIds, 1, 4) })); } catch (e) { next(e); }
  });
  const w = express.Router();
  w.get('/', v.query({ date: { type: 'date' } }), async (req, res, next) => {
    try { res.json(await rec.weather(req.user.id, req.validQuery.date)); } catch (e) { next(e); }
  });
  return { recommendations: r, weather: w };
}

function registerRecommendation(deps) {
  const service = recommendationService(deps);
  return { service, routes: recommendationRoutes({ rec: service }) };
}

module.exports = { registerRecommendation, optionsSchema };
