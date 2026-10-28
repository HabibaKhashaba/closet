// Packing Mode (US-68, stretch goal built as a preview). Several modules work together:
// Weather (destination forecast) + Profile (style) + Wardrobe/Availability (what is Available)
// + Planner (events during the trip) + Recommendation Engine (outfits) → a packing list.
// "Mark as packed" moves every listed piece to Packed through IAvailability (the state machine),
// with a return date = the day after the trip, so packed pieces leave normal recommendations.
//   POST /packing/plan           propose a list (nothing is saved)
//   GET  /packing/trips          saved packing lists
//   POST /packing/trips          save a list ("Add to packing list")
//   POST /packing/trips/:id/pack     mark every piece as Packed
//   POST /packing/trips/:id/unpack   back to Available when the trip is over
//   DELETE /packing/trips/:id
const express = require('express');
const v = require('../../shared/validate');
const { errors } = require('../../shared/errors');
const { OCCASIONS, DRESS_CODES } = require('../../shared/vocabulary');
const engine = require('../recommendation/engine');

const UUID = /^[0-9a-f-]{36}$/i;
const MAX_DAYS = 14;
const isoDay = (d) => new Date(d).toISOString().slice(0, 10);
const addDays = (day, n) => isoDay(new Date(`${day}T12:00:00Z`).getTime() + n * 86400000);
const RAIN = /rain|shower|drizzle|thunder/i;
const pieceName = (p) => (p.name || `${p.colour} ${p.category}`).toLowerCase();

// Pure planner: one outfit per day, preferring pieces already in the suitcase (re-use = fewer pieces).
function planTrip(pieces, { days, prefs, hiddenIds = [] }) {
  // Wear history does not matter for a suitcase (no "forgotten piece" bonus): rank by style, colour and fit.
  const available = pieces.filter((p) => p.status === 'Available').map((p) => ({ ...p, lastWornAt: null }));
  const packed = new Map();
  const plan = [];
  const missing = [];
  for (const d of days) {
    const level = OCCASIONS[d.occasion] || 1;
    const r = engine.recommend(available, { occasion: d.occasion, prefs: { ...prefs, repeatDays: 0 }, weather: d.weather, hiddenIds, today: new Date(`${d.date}T12:00:00`) });
    if (!r.outfits.length) { missing.push({ date: d.date, occasion: d.occasion, text: `No complete ${DRESS_CODES[level].toLowerCase()} outfit for ${d.occasion.toLowerCase()} on ${d.date}${d.weather ? ` at ${d.weather.tempC} °C` : ''}.` }); plan.push({ ...d, outfit: null }); continue; }
    const best = [...r.outfits].sort((a, b) => b.itemIds.filter((id) => packed.has(id)).length - a.itemIds.filter((id) => packed.has(id)).length || b.ruleScore - a.ruleScore)[0];
    for (const id of best.itemIds) packed.set(id, (packed.get(id) || 0) + 1);
    plan.push({ ...d, outfit: { itemIds: best.itemIds, title: best.title, ruleScore: best.ruleScore, compatibility: best.compatibility, reasons: best.reasons.slice(0, 3) } });
  }
  const items = [...packed.keys()].map((id) => available.find((p) => p.id === id));
  const warnings = [];
  const temps = days.filter((d) => d.weather).map((d) => d.weather.tempC);
  const rainy = days.filter((d) => d.weather && RAIN.test(d.weather.condition || ''));
  const hasLayer = items.some((p) => p.category === 'Layer');
  if (rainy.length && !items.some((p) => p.category === 'Layer' && ['Cotton', 'Polyester', 'Leather', 'Denim'].includes(p.fabric))) warnings.push(`Rain is likely on ${rainy.length} day${rainy.length === 1 ? '' : 's'}: you may need a waterproof outer layer.`);
  if (temps.length && Math.min(...temps) < engine.COLD && !hasLayer) warnings.push(`It drops to ${Math.min(...temps)} °C: pack a warm layer.`);
  if (temps.length && Math.max(...temps) >= engine.HOT) warnings.push(`Up to ${Math.max(...temps)} °C: light fabrics only.`);
  if (days.some((d) => d.weather && d.weather.source === 'estimate')) warnings.push('Live forecast not available for some days — this plan uses a seasonal estimate. Check again closer to the trip.');
  return {
    days: plan, itemIds: items.map((p) => p.id), items,
    counts: { pieces: items.length, outfits: plan.filter((d) => d.outfit).length, days: days.length, missing: missing.length },
    missing, warnings,
    reuse: items.filter((p) => packed.get(p.id) > 1).map((p) => ({ id: p.id, name: p.name, outfits: packed.get(p.id) })),
  };
}

function tripApi(r) {
  return { id: r.id, destination: r.destination, startDate: isoDay(r.start_date), endDate: isoDay(r.end_date), tripType: r.trip_type, activities: r.activities, itemIds: r.item_ids, plan: r.plan, packed: r.packed, createdAt: r.created_at };
}

function packingService({ db, wardrobe, profile, weather, planner, availability, outfits }) {
  async function days(userId, { startDate, endDate, tripType, activities = [], destination }) {
    const out = [];
    const events = planner ? await planner().upcoming(userId, 400) : [];
    const acts = activities.length ? activities : [tripType];
    for (let d = startDate, i = 0; d <= endDate; d = addDays(d, 1), i += 1) {
      const ev = events.find((e) => e.date === d);
      out.push({ date: d, occasion: ev ? ev.occasion : acts[i % acts.length], event: ev ? ev.title : null, weather: await weather.forDate(destination, d) });
    }
    return out;
  }
  return {
    async plan(userId, input) {
      if (input.endDate < input.startDate) throw errors.validation([{ field: 'endDate', message: 'The trip must end on or after its first day' }]);
      if ((new Date(input.endDate) - new Date(input.startDate)) / 86400000 + 1 > MAX_DAYS) throw errors.validation([{ field: 'endDate', message: `A trip can be at most ${MAX_DAYS} days` }]);
      const [pieces, prefs, hiddenIds] = await Promise.all([wardrobe().allPieces(userId), profile.preferences(userId), outfits ? outfits().hiddenIds(userId) : []]);
      const d = await days(userId, input);
      return { ...input, ...planTrip(pieces, { days: d, prefs, hiddenIds }) };
    },
    async save(userId, input) {
      const p = await this.plan(userId, input);
      const { rows } = await db.query(
        `INSERT INTO packing.trips (user_id, destination, start_date, end_date, trip_type, activities, item_ids, plan)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [userId, input.destination, input.startDate, input.endDate, input.tripType, input.activities || [], p.itemIds, { days: p.days.map((x) => ({ date: x.date, occasion: x.occasion, event: x.event, weather: x.weather, outfit: x.outfit })), warnings: p.warnings, missing: p.missing, counts: p.counts }],
      );
      return tripApi(rows[0]);
    },
    async trips(userId) {
      const { rows } = await db.query('SELECT * FROM packing.trips WHERE user_id = $1 ORDER BY start_date', [userId]);
      return rows.map(tripApi);
    },
    async get(userId, id) {
      if (!UUID.test(id)) throw errors.notFound('Trip');
      const { rows } = await db.query('SELECT * FROM packing.trips WHERE id = $1 AND user_id = $2', [id, userId]);
      if (!rows[0]) throw errors.notFound('Trip');
      return tripApi(rows[0]);
    },
    // Mark as packed: each piece goes Available → Packed (state machine); others are reported, not forced.
    async pack(userId, id) {
      const t = await this.get(userId, id);
      const pieces = await wardrobe().allPieces(userId);
      const packed = []; const skipped = [];
      for (const itemId of t.itemIds) {
        const p = pieces.find((x) => x.id === itemId);
        if (!p) continue;
        if (p.status === 'Packed') { packed.push(itemId); continue; }
        if (p.status !== 'Available') { skipped.push({ itemId, name: p.name, status: p.status, reason: `${pieceName(p)} is ${p.status}` }); continue; }
        await availability.setStatus(userId, itemId, 'Packed', { until: addDays(t.endDate, 1), note: t.destination.slice(0, 60) });
        packed.push(itemId);
      }
      await db.query('UPDATE packing.trips SET packed = true WHERE id = $1 AND user_id = $2', [id, userId]);
      return { trip: { ...t, packed: true }, packed: packed.length, skipped };
    },
    async unpack(userId, id) {
      const t = await this.get(userId, id);
      const pieces = await wardrobe().allPieces(userId);
      let n = 0;
      for (const itemId of t.itemIds) {
        const p = pieces.find((x) => x.id === itemId);
        if (p && p.status === 'Packed') { await availability.setStatus(userId, itemId, 'Available'); n += 1; }
      }
      await db.query('UPDATE packing.trips SET packed = false WHERE id = $1 AND user_id = $2', [id, userId]);
      return { trip: { ...t, packed: false }, unpacked: n };
    },
    async remove(userId, id) {
      if (!UUID.test(id)) throw errors.notFound('Trip');
      const { rowCount } = await db.query('DELETE FROM packing.trips WHERE id = $1 AND user_id = $2', [id, userId]);
      if (!rowCount) throw errors.notFound('Trip');
    },
  };
}

const tripSchema = {
  destination: { type: 'string', required: true, min: 2, max: 60, label: 'Destination' },
  startDate: { type: 'date', required: true, label: 'First day' },
  endDate: { type: 'date', required: true, label: 'Last day' },
  tripType: { type: 'enum', values: Object.keys(OCCASIONS), required: true, label: 'Trip type' },
  activities: { type: 'enumArray', values: Object.keys(OCCASIONS), max: 6 },
};

function registerPacking(deps) {
  const service = packingService(deps);
  const r = express.Router();
  const h = (fn) => async (req, res, next) => { try { await fn(req, res); } catch (e) { next(e); } };
  r.post('/plan', v.body(tripSchema), h(async (req, res) => res.json(await service.plan(req.user.id, req.valid))));
  r.get('/trips', h(async (req, res) => res.json({ trips: await service.trips(req.user.id) })));
  r.post('/trips', v.body(tripSchema), h(async (req, res) => res.status(201).json(await service.save(req.user.id, req.valid))));
  r.post('/trips/:id/pack', h(async (req, res) => res.json(await service.pack(req.user.id, req.params.id))));
  r.post('/trips/:id/unpack', h(async (req, res) => res.json(await service.unpack(req.user.id, req.params.id))));
  r.delete('/trips/:id', h(async (req, res) => { await service.remove(req.user.id, req.params.id); res.status(204).end(); }));
  return { service, routes: r };
}

module.exports = { registerPacking, planTrip };
