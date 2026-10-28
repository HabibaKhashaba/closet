// Proactive intelligence (v1.5). Orchestrates the pure rules in insights.js over the other modules'
// interfaces (IWardrobe, IAvailability, IOutfits, IPlanner, IRecommend, IWeather, IPreferences).
// It owns ONE table, intelligence.snoozes ("Keep it", "Not now", "Remind me later"). Every state change
// goes through the owning module (status through the Availability state machine, plans through the
// Planner), so there is still exactly one source of truth for each fact.
//   GET  /intelligence/forgotten                     long-unworn pieces: style it, keep it, donate
//   POST /intelligence/forgotten/:itemId/keep        snooze the suggestion (default 90 days)
//   GET  /intelligence/seasonal                      seasonal rotation suggestion
//   POST /intelligence/seasonal                      { action: pack | bring_back | not_now, itemIds }
//   GET  /intelligence/laundry-risk                  high-use pieces for an upcoming event are in the laundry
//   POST /intelligence/plan-days                     several days of outfits, laundry-aware
//   GET  /intelligence/monitor                       planned outfits vs CURRENT weather and status
//   POST /intelligence/monitor/:eventId/adjust       change only the affected piece
//   GET  /intelligence/borrowed                      who has what, since when, overdue
//   POST /intelligence/borrowed/:itemId/remind       remind me later (default 3 days)
//   GET  /intelligence/value                         cost per wear
//   GET  /intelligence/memory?q=&best=               outfit memory
//   POST /intelligence/repeat                        repeat insight for a look
//   GET  /intelligence/gaps                          wardrobe gaps with confidence
const express = require('express');
const v = require('../../shared/validate');
const { errors } = require('../../shared/errors');
const { OCCASIONS } = require('../../shared/vocabulary');
const { PASSED_ON } = require('../../shared/deletionPolicy');
const ins = require('./insights');

const UUID = /^[0-9a-f-]{36}$/i;
const isoDay = (d) => new Date(d).toISOString().slice(0, 10);
const addDays = (day, n) => isoDay(new Date(`${day}T12:00:00Z`).getTime() + n * 86400000);
const label = (p) => (p.name || `${p.colour} ${p.category}`).toLowerCase();

function proactiveService({ repo, wardrobe, outfits, profile, planner, rec, availability, intelligence }) {
  const today = () => isoDay(Date.now());
  async function snoozeMap(userId, prefix) {
    const rows = await repo.snoozes(userId, prefix);
    return new Map(rows.map((r) => [r.key.slice(prefix.length + 1), typeof r.until === 'string' ? r.until : isoDay(r.until)]));
  }
  async function snooze(userId, key, days, reason = null) {
    const until = addDays(today(), days);
    await repo.snooze(userId, key, until, reason);
    return until;
  }
  async function own(userId, itemId) {
    if (!UUID.test(itemId || '')) throw errors.notFound('Piece');
    return wardrobe().getPiece(userId, itemId);
  }
  const todayWeather = (userId) => rec().weather(userId, today());

  const svc = {
    snoozeMap,
    async unsnooze(userId, key) { await repo.unsnooze(userId, key); },
    async forgotten(userId) {
      const [pieces, w, snoozes, deletions] = await Promise.all([wardrobe().allPieces(userId), todayWeather(userId), snoozeMap(userId, 'keep'), wardrobe().deletions(userId)]);
      const candidates = ins.forgottenCandidates(pieces, { today: new Date(), tempC: w.tempC, snoozes });
      const pending = pieces.filter((p) => p.rehome).map((p) => ({ id: p.id, name: p.name, photoUrl: p.photoUrl, rehome: p.rehome, lastWornAt: p.lastWornAt }));
      return {
        candidates: candidates.map((c) => ({ ...c, piece: c.piece })), top: candidates[0] || null, pending,
        stats: { passedOn: deletions.filter((d) => PASSED_ON.includes(d.reason)).length, kept: snoozes.size },
        thresholds: ins.INACTIVITY_DAYS, weather: { tempC: w.tempC, source: w.source },
      };
    },
    async keep(userId, itemId, { days = 90, reason = null } = {}) {
      const p = await own(userId, itemId);
      const until = await snooze(userId, `keep:${p.id}`, days, reason);
      return { itemId: p.id, keptUntil: until, message: `Got it — Closet won’t suggest donating your ${label(p)} before ${until}.` };
    },
    async seasonal(userId) {
      const [pieces, w, snoozes] = await Promise.all([wardrobe().allPieces(userId), todayWeather(userId), snoozeMap(userId, 'season')]);
      return ins.seasonalRotation(pieces, { tempC: w.tempC, today: new Date(), snoozes });
    },
    async applySeasonal(userId, { action, itemIds }) {
      const done = []; const skipped = [];
      for (const id of itemIds) {
        const p = await own(userId, id);
        try {
          if (action === 'pack') { await availability.setStatus(userId, p.id, 'Packed', { note: ins.SEASONAL_NOTE }); done.push(p.id); }
          else if (action === 'bring_back') { if (p.status === 'Packed') { await availability.setStatus(userId, p.id, 'Available'); done.push(p.id); } else skipped.push({ id: p.id, reason: `${label(p)} is ${p.status}` }); }
          else { await snooze(userId, `season:${p.id}`, 30, 'Not now'); done.push(p.id); }
        } catch (e) { skipped.push({ id: p.id, reason: e.message }); }
      }
      return { action, changed: done, skipped };
    },
    async laundryRisk(userId) {
      const [pieces, events] = await Promise.all([wardrobe().allPieces(userId), planner().upcoming(userId, 8)]);
      return { warnings: ins.laundryRisk(pieces, events, { today: new Date() }) };
    },
    async planDays(userId, { days = 4, startDate, occasion } = {}) {
      const start = startDate || addDays(today(), 1);
      const [prefs, events, all] = await Promise.all([profile.preferences(userId), planner().upcoming(userId, 21), wardrobe().allPieces(userId)]);
      const list = [];
      for (let i = 0; i < days; i += 1) {
        const date = addDays(start, i);
        const e = events.find((x) => x.date === date);
        const occ = e ? e.occasion : occasion || (prefs.occasions || [])[0] || 'Everyday';
        list.push({ date, occasion: occ, level: e ? e.dressCode : OCCASIONS[occ], event: e ? e.title : null, weather: await rec().weather(userId, date) });
      }
      // A piece away now counts for a day it is expected back by (laundry basket time / return date).
      const forDay = all.map((p) => (p.status !== 'Available' && p.status !== 'Unavailable' && p.expectedBack && p.expectedBack <= start ? { ...p, status: 'Available' } : p));
      const r = ins.planDays(forDay, list, { prefs, allowRepeats: prefs.allowRepeats });
      return { ...r, days: r.days.map((d) => ({ ...d, outfit: d.outfit && { ...d.outfit, pieces: d.outfit.itemIds.map((id) => all.find((p) => p.id === id)) } })) };
    },
    // One monitor for planned outfits: CURRENT status (never a stored copy) and the CURRENT forecast.
    async monitor(userId) {
      const events = (await planner().upcoming(userId, 8)).filter((e) => e.plannedOutfit);
      const alerts = [];
      for (const c of (await intelligence.conflicts(userId)).conflicts.filter((x) => x.kind === 'unavailable')) {
        alerts.push({ key: `availability:${c.eventId}:${c.itemId}`, kind: 'availability', eventId: c.eventId, event: c.event, itemId: c.itemId, piece: c.piece, status: c.status,
          message: `Your ${label(c.piece)} is ${{ Laundry: 'in the laundry', Borrowed: 'lent out', Packed: 'packed', Unavailable: 'unavailable' }[c.status]}, but it’s part of the outfit for “${c.event.title}”.`,
          actions: c.status === 'Laundry' ? ['Replace item', 'Wash first', 'Ignore'] : ['Replace item', 'Ignore'], replacement: c.replacement ? { id: c.replacement.piece.id, name: c.replacement.piece.name } : null });
      }
      for (const e of events) {
        const shift = ins.weatherShift(e.plannedWeather, e.weather, e.plannedOutfit.pieces);
        if (!shift) continue;
        alerts.push({ key: `weather:${e.id}:${e.weather.tempC}:${e.weather.condition}`, kind: 'weather', eventId: e.id, event: { title: e.title, date: e.date, time: e.time, occasion: e.occasion }, itemId: shift.itemId, piece: shift.piece,
          planned: e.plannedWeather, current: { tempC: e.weather.tempC, condition: e.weather.condition, source: e.weather.source }, message: shift.message, actions: shift.itemId ? ['Adjust outfit', 'Ignore'] : ['Ignore'] });
      }
      const ignored = await snoozeMap(userId, 'notice');
      return { alerts: alerts.filter((a) => !ignored.has(a.key)) };
    },
    async adjust(userId, eventId, itemId) {
      if (!UUID.test(eventId || '') || !UUID.test(itemId || '')) throw errors.notFound('Event');
      const e = (await planner().upcoming(userId, 30)).find((x) => x.id === eventId);
      if (!e || !e.plannedOutfit) throw errors.notFound('Planned outfit');
      const ids = e.plannedOutfit.pieces.map((p) => p.id);
      const slot = ids.indexOf(itemId);
      if (slot < 0) throw errors.notFound('Piece');
      const r = await rec().swap(userId, { itemIds: ids, slot, occasion: e.occasion, level: e.dressCode, date: e.date });
      if (!r.outfit) throw errors.conflict('NO_REPLACEMENT', 'No other Available piece fits this slot.');
      const old = e.plannedOutfit.pieces[slot]; const now = r.outfit.pieces[slot];
      const event = await planner().plan(userId, eventId, { itemIds: r.outfit.itemIds, ruleScore: r.outfit.ruleScore, reasons: [`Changed only the ${label(old)} → ${label(now)}.`, ...r.outfit.reasons.slice(0, 3)] });
      return { event, replaced: old, with: now, unchanged: ids.filter((id, i) => i !== slot) };
    },
    async ignore(userId, key) { return { key, until: await snooze(userId, `notice:${key}`.slice(0, 120), 7, 'Ignored') }; },
    async borrowed(userId) {
      const [pieces, later] = await Promise.all([wardrobe().allPieces(userId), snoozeMap(userId, 'borrow')]);
      const t = today();
      const list = pieces.filter((p) => p.status === 'Borrowed').map((p) => {
        const since = p.statusSince ? isoDay(p.statusSince) : null;
        const days = since ? Math.round((new Date(`${t}T12:00:00Z`) - new Date(`${since}T12:00:00Z`)) / 86400000) : null;
        const overdue = Boolean(p.statusUntil && p.statusUntil < t);
        return { id: p.id, piece: p, borrowedBy: p.statusNote || null, since, expected: p.statusUntil, days, overdue, remindLater: later.get(p.id) || null,
          message: `Your ${label(p)} has been with ${p.statusNote || 'someone'} for ${days} day${days === 1 ? '' : 's'}${overdue ? ` (expected back ${p.statusUntil})` : ''}.` };
      });
      return { borrowed: list, overdue: list.filter((x) => x.overdue && !x.remindLater) };
    },
    async remindLater(userId, itemId, days = 3) {
      const p = await own(userId, itemId);
      return { itemId: p.id, until: await snooze(userId, `borrow:${p.id}`, days, 'Remind me later') };
    },
    async value(userId) { return ins.valueInsights(await wardrobe().allPieces(userId)); },
    async memory(userId, { q = '', best = false } = {}) {
      const h = await outfits().history(userId, {});
      return { matches: ins.memoryMatches(h.wears, q, { today: new Date(), best }), total: h.total };
    },
    async repeat(userId, itemIds) {
      const [h, pieces, prefs] = await Promise.all([outfits().history(userId, {}), wardrobe().allPieces(userId), profile.preferences(userId)]);
      return { insight: ins.repeatInsight(itemIds, h.wears, pieces, { today: new Date(), allowRepeats: prefs.allowRepeats }) };
    },
    async gaps(userId) {
      const [g, pieces, prefs, events, hist] = await Promise.all([wardrobe().gaps(userId), wardrobe().allPieces(userId), profile.preferences(userId), planner().upcoming(userId, 30), outfits().history(userId, { from: addDays(today(), -60) })]);
      const atLevel = (l) => events.filter((e) => e.dressCode === l).length + hist.wears.filter((w) => w.occasion && OCCASIONS[w.occasion] === l).length;
      const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      return { ...g, gaps: g.gaps.map((x) => ins.gapConfidence(x, pieces.filter((p) => !p.rehome), prefs, { eventsAtLevel: atLevel(x.level) })).sort((a, b) => order[a.confidence] - order[b.confidence] || b.limits - a.limits) };
    },
  };
  return svc;
}

function proactiveRoutes(svc) {
  const r = express.Router();
  const h = (fn) => async (req, res, next) => { try { res.json(await fn(req)); } catch (e) { next(e); } };
  r.get('/forgotten', h((req) => svc.forgotten(req.user.id)));
  r.post('/forgotten/:itemId/keep', v.body({ days: { type: 'int', min: 7, max: 365 }, reason: { type: 'enum', values: ['Sentimental', 'Seasonal', 'Special occasion', 'Still love it', 'Other'] } }), h((req) => svc.keep(req.user.id, req.params.itemId, req.valid)));
  r.get('/seasonal', h((req) => svc.seasonal(req.user.id)));
  r.post('/seasonal', v.body({ action: { type: 'enum', values: ['pack', 'bring_back', 'not_now'], required: true, label: 'Action' } }), h((req) => {
    const ids = Array.isArray(req.body.itemIds) ? req.body.itemIds.filter((x) => typeof x === 'string').slice(0, 40) : [];
    if (!ids.length) throw errors.validation([{ field: 'itemIds', message: 'Choose at least one piece' }]);
    return svc.applySeasonal(req.user.id, { action: req.valid.action, itemIds: ids });
  }));
  r.get('/laundry-risk', h((req) => svc.laundryRisk(req.user.id)));
  r.post('/plan-days', v.body({ days: { type: 'int', min: 1, max: 7 }, startDate: { type: 'date' }, occasion: { type: 'enum', values: Object.keys(OCCASIONS) } }), h((req) => svc.planDays(req.user.id, req.valid)));
  r.get('/monitor', h((req) => svc.monitor(req.user.id)));
  r.post('/monitor/:eventId/adjust', v.body({ itemId: { type: 'string', required: true, max: 36 } }), h((req) => svc.adjust(req.user.id, req.params.eventId, req.valid.itemId)));
  r.post('/monitor/ignore', v.body({ key: { type: 'string', required: true, max: 110 } }), h((req) => svc.ignore(req.user.id, req.valid.key)));
  r.get('/borrowed', h((req) => svc.borrowed(req.user.id)));
  r.post('/borrowed/:itemId/remind', v.body({ days: { type: 'int', min: 1, max: 30 } }), h((req) => svc.remindLater(req.user.id, req.params.itemId, req.valid.days)));
  r.get('/value', h((req) => svc.value(req.user.id)));
  r.get('/memory', v.query({ q: { type: 'string', max: 120 }, best: { type: 'bool' } }), h((req) => svc.memory(req.user.id, req.validQuery)));
  r.post('/repeat', h((req) => {
    const ids = req.body.itemIds;
    if (!Array.isArray(ids) || ids.length < 2 || ids.length > 4 || !ids.every((x) => UUID.test(x))) throw errors.validation([{ field: 'itemIds', message: 'itemIds must be 2–4 piece ids' }]);
    return svc.repeat(req.user.id, ids);
  }));
  r.get('/gaps', h((req) => svc.gaps(req.user.id)));
  return r;
}

module.exports = { proactiveService, proactiveRoutes };
