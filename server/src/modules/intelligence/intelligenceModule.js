// Closet Intelligence (version 1.3): the part of the product loop that turns
// WARDROBE + CONTEXT + FEEDBACK into advice. It owns no wardrobe data; it reads other modules
// through their interfaces and writes only its own two tables (learned decisions, read notices).
//   GET  /intelligence/health                   Wardrobe Health score (US-89)
//   GET  /intelligence/learned                  what Closet has learned (US-40)
//   POST /intelligence/learned/:key             confirm / dismiss a pattern
//   DELETE /intelligence/learned/:key           undo a decision (restores the profile exactly)
//   GET  /intelligence/conflicts                planned outfits with a piece that will not be back (US-79)
//   POST /intelligence/conflicts/:eventId/fix   replace that piece with the best Available one
//   GET  /notifications, POST /notifications/read   Notification Center (US-92)
const { isOwned } = require('../../shared/lifecycle');
const express = require('express');
const v = require('../../shared/validate');
const { errors } = require('../../shared/errors');
const { wardrobeHealth } = require('./health');
const { detectPatterns, previousOf } = require('./learning');
const { BASICS } = require('../shopping/shoppingModule');
const { proactiveService, proactiveRoutes } = require('./proactive');
const { explainHealth } = require('./insights');

const UUID = /^[0-9a-f-]{36}$/i;
const KEY = /^[a-z0-9:-]{3,80}$/;
const isoDay = (d) => new Date(d).toISOString().slice(0, 10);
const addDays = (day, n) => isoDay(new Date(`${day}T12:00:00Z`).getTime() + n * 86400000);
const pieceName = (p) => (p.name || `${p.colour} ${p.category}`).toLowerCase();
const { WHERE } = require('../../shared/lifecycle'); // one wording for every state (v1.6)
const RAIN = /rain|shower|drizzle|thunder/i;
const PUSH_LIMIT = 3; // NFR-13: at most 3 highlighted notices a day

function intelligenceRepository(db) {
  return {
    async learned(userId) { return (await db.query('SELECT key, state, previous, decided_at FROM intelligence.learned WHERE user_id = $1 ORDER BY decided_at DESC', [userId])).rows; },
    async upsertLearned(userId, key, state, previous) {
      await db.query(`INSERT INTO intelligence.learned (user_id, key, state, previous) VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, key) DO UPDATE SET state = EXCLUDED.state, previous = EXCLUDED.previous, decided_at = now()`, [userId, key, state, previous]);
    },
    async deleteLearned(userId, key) { return (await db.query('DELETE FROM intelligence.learned WHERE user_id = $1 AND key = $2 RETURNING state, previous', [userId, key])).rows[0] || null; },
    async readKeys(userId) { return (await db.query('SELECT key FROM intelligence.notifications_read WHERE user_id = $1', [userId])).rows.map((r) => r.key); },
    async markRead(userId, key) { await db.query('INSERT INTO intelligence.notifications_read (user_id, key) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, key]); },
    // snoozes ("Keep it", "Not now", "Remind me later") — used by the proactive service
    async snoozes(userId, prefix) { return (await db.query('SELECT key, until FROM intelligence.snoozes WHERE user_id = $1 AND key LIKE $2 AND until >= CURRENT_DATE', [userId, `${prefix}:%`])).rows; },
    async snooze(userId, key, until, reason) {
      await db.query(`INSERT INTO intelligence.snoozes (user_id, key, until, reason) VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, key) DO UPDATE SET until = EXCLUDED.until, reason = EXCLUDED.reason, created_at = now()`, [userId, key, until, reason]);
    },
    async unsnooze(userId, key) { await db.query('DELETE FROM intelligence.snoozes WHERE user_id = $1 AND key = $2', [userId, key]); },
  };
}

function intelligenceService({ db, repo: givenRepo, wardrobe, outfits, profile, planner, rec, activity, packing }) {
  const repo = givenRepo || intelligenceRepository(db);
  async function health(userId) {
    const [pieces, worn, gaps] = await Promise.all([wardrobe().allPieces(userId), outfits().wornIds(userId, 30), wardrobe().gaps(userId)]);
    const missingBasics = BASICS.filter((b) => !pieces.some(b.has)).map((b) => b.title);
    const h = wardrobeHealth({ pieces: pieces.filter(isOwned), worn30: new Set(worn), gaps, missingBasics, basicsTotal: BASICS.length });
    return { ...h, explain: explainHealth(h) };
  }

  async function decisions(userId) {
    return repo.learned(userId);
  }
  async function patterns(userId) {
    const from = addDays(isoDay(Date.now()), -60);
    const [prefs, rejectCounts, favourites, hist, pieces, deletions] = await Promise.all([
      profile.preferences(userId), outfits().feedbackRows(userId, 60), outfits().list(userId, true), outfits().history(userId, { from }), wardrobe().allPieces(userId), wardrobe().deletions(userId),
    ]);
    return { prefs, list: detectPatterns({ prefs, rejectCounts, favourites, wears: hist.wears, pieces, deletions }) };
  }

  async function conflicts(userId) {
    const events = await planner().upcoming(userId, 30);
    const out = [];
    const usage = new Map(); // itemId → events that plan it (double booking)
    for (const e of events) {
      if (!e.plannedOutfit) continue;
      for (const p of e.plannedOutfit.pieces) {
        if (!usage.has(p.id)) usage.set(p.id, []);
        usage.get(p.id).push(e);
        if (p.status === 'Available') continue;
        if (p.expectedBack && p.expectedBack <= e.date) continue; // back in time (laundry, loan, trip, tailor): not a conflict
        // Needs repair / alteration and Ready to donate have no return date: always a conflict.
        out.push({
          key: `conflict:${e.id}:${p.id}`, kind: 'unavailable', eventId: e.id, event: { title: e.title, date: e.date, time: e.time, occasion: e.occasion },
          itemId: p.id, piece: p, status: p.status, expectedBack: p.expectedBack || null,
          message: `Your ${pieceName(p)} is ${WHERE[p.status]}${p.expectedBack ? ` until ${p.expectedBack}` : ''}. It is part of the outfit for “${e.title}”. Choose a replacement?`,
        });
      }
    }
    for (const [itemId, list] of usage) {
      for (let i = 1; i < list.length; i += 1) {
        const a = list[i - 1]; const b = list[i];
        const gap = Math.abs(new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`)) / 3600000;
        if (a.date === b.date && gap < 4) {
          const p = a.plannedOutfit.pieces.find((x) => x.id === itemId);
          out.push({ key: `double:${b.id}:${itemId}`, kind: 'double-booked', eventId: b.id, event: { title: b.title, date: b.date, time: b.time, occasion: b.occasion }, itemId, piece: p, status: p.status,
            message: `Your ${pieceName(p)} is planned for “${a.title}” and “${b.title}” on the same day, ${Math.round(gap * 10) / 10} h apart.` });
        }
      }
    }
    return out;
  }

  async function replacement(userId, c, events) {
    const e = events.find((x) => x.id === c.eventId);
    const ids = e.plannedOutfit.pieces.map((p) => p.id);
    const slot = ids.indexOf(c.itemId);
    const r = await rec().swap(userId, { itemIds: ids, slot, occasion: e.occasion, level: e.dressCode, date: e.date });
    if (!r.outfit) return null;
    return { outfit: r.outfit, piece: r.outfit.pieces[slot] };
  }

  return {
    health,
    async learned(userId) {
      const [{ list }, decided] = await Promise.all([patterns(userId), decisions(userId)]);
      const done = new Set(decided.map((d) => d.key));
      return {
        patterns: list.filter((p) => !done.has(p.key)),
        decided: decided.map((d) => ({ key: d.key, state: d.state, text: d.previous && d.previous.text, effect: d.previous && d.previous.effect, decidedAt: d.decided_at, undoable: true })),
        loop: ['Rejections', 'Ratings', 'Favourites', 'Wear history', 'Deleted pieces', 'Learned preferences', 'Better recommendations'],
      };
    },
    async decide(userId, key, decision) {
      const { prefs, list } = await patterns(userId);
      const p = list.find((x) => x.key === key);
      if (!p) throw errors.notFound('Pattern');
      const state = decision === 'confirm' ? 'confirmed' : 'dismissed';
      const values = state === 'confirmed' ? previousOf(prefs, p.change) : null;
      if (state === 'confirmed' && p.change) await profile.update(userId, p.change);
      await repo.upsertLearned(userId, key, state, { values, text: p.text, effect: p.effect });
      return { key, state, effect: state === 'confirmed' ? p.effect : 'Closet will not suggest this pattern again.', profile: state === 'confirmed' && p.change ? await profile.get(userId) : undefined };
    },
    async undo(userId, key) {
      const row = await repo.deleteLearned(userId, key);
      if (!row) throw errors.notFound('Decision');
      const values = row.previous && row.previous.values;
      if (row.state === 'confirmed' && values) await profile.update(userId, values);
      return { key, undone: true, profile: await profile.get(userId) };
    },
    async conflicts(userId) {
      const list = await conflicts(userId);
      const events = await planner().upcoming(userId, 30);
      for (const c of list) if (c.kind === 'unavailable') c.replacement = await replacement(userId, c, events);
      return { conflicts: list };
    },
    async fix(userId, eventId, itemId) {
      if (!UUID.test(eventId) || !UUID.test(itemId || '')) throw errors.notFound('Event');
      const list = await conflicts(userId);
      const c = list.find((x) => x.eventId === eventId && x.itemId === itemId && x.kind === 'unavailable');
      if (!c) throw errors.conflict('NO_CONFLICT', 'This planned outfit has no conflict any more.');
      const events = await planner().upcoming(userId, 30);
      const r = await replacement(userId, c, events);
      if (!r) throw errors.conflict('NO_REPLACEMENT', 'No other Available piece fits this slot. Try planning a new outfit.');
      const event = await planner().plan(userId, eventId, { itemIds: r.outfit.itemIds, ruleScore: r.outfit.ruleScore, reasons: [`Replaced the ${pieceName(c.piece)} (${c.status.toLowerCase()}) with the ${pieceName(r.piece)}.`, ...r.outfit.reasons.slice(0, 3)] });
      return { event, replaced: c.piece, with: r.piece };
    },
    async notifications(userId) {
      const today = isoDay(Date.now());
      const pro = this.proactive;
      const [monitor, laundry, borrowed, seasonal, forgotten, tailor] = pro ? await Promise.all([
        pro.monitor(userId), pro.laundryRisk(userId), pro.borrowed(userId), pro.seasonal(userId), pro.forgotten(userId), pro.tailorDue(userId),
      ]) : [{ alerts: [] }, { warnings: [] }, { overdue: [] }, {}, {}, { due: [] }];
      const [rem, conf, insights, readRows, trips, recent] = await Promise.all([
        planner().reminders(userId), conflicts(userId), outfits().insights(userId),
        repo.readKeys(userId),
        packing ? packing().trips(userId) : [], activity ? activity().recent(userId, 24) : [],
      ]);
      const read = new Set(readRows);
      const list = [];
      const add = (n) => list.push({ ...n, read: read.has(n.key) });
      for (const c of conf) add({ key: c.key, kind: 'conflict', priority: 5, title: c.kind === 'double-booked' ? 'Piece planned twice' : 'Planned outfit conflict', text: c.message, link: '#/planner', date: c.event.date });
      for (const r of rem.reminders) {
        if (r.kind === 'conflict') continue; // covered above, with a replacement
        if (r.kind === 'plan') add({ key: `plan:${r.eventId}`, kind: 'plan', priority: 4, title: r.date === addDays(today, 1) ? 'Your event is tomorrow' : 'Upcoming event', text: `${r.text.replace(/\.$/, '')} — no outfit selected yet.`, link: '#/planner', date: r.date });
        if (r.kind === 'due' && !borrowed.overdue.some((b) => b.id === r.itemId)) add({ key: `due:${r.itemId}:${r.date}`, kind: 'due', priority: 3, title: 'Borrowed piece due', text: r.text, link: `#/closet/${r.itemId}`, date: r.date });
        if (r.kind === 'laundry') add({ key: `laundry:${r.date}`, kind: 'laundry', priority: 2, title: 'Laundry day tomorrow', text: r.text, link: '#/laundry', date: r.date });
      }
      for (const e of await planner().upcoming(userId, 3)) {
        if (e.weather && RAIN.test(e.weather.condition || '')) add({ key: `weather:${e.id}:${e.weather.condition}`, kind: 'weather', priority: 3, title: 'Weather alert', text: `${e.weather.condition} expected for “${e.title}” (${e.weather.tempC} °C). Consider a layer you can rely on.`, link: '#/planner', date: e.date });
      }
      for (const t of trips) {
        if (!t.packed && t.startDate >= today && t.startDate <= addDays(today, 3)) add({ key: `pack:${t.id}`, kind: 'packing', priority: 4, title: 'Packing list incomplete', text: `Your ${t.destination} trip starts ${t.startDate === today ? 'today' : t.startDate === addDays(today, 1) ? 'tomorrow' : `on ${t.startDate}`} — ${t.itemIds.length} pieces are not marked as packed yet.`, link: '#/packing', date: t.startDate });
      }
      for (const a of recent.filter((x) => x.action === 'Wash done')) add({ key: `wash:${a.id}`, kind: 'wash', priority: 1, title: 'Wash done', text: `${a.detail || 'Your pieces'} returned to Available.`, link: '#/laundry', date: isoDay(a.at) });
      // v1.5 proactive notices — one Notification Center, stable keys (dedupe), snoozes respected.
      const week = `${today.slice(0, 4)}-w${String(Math.ceil((((new Date(`${today}T12:00:00Z`) - new Date(`${today.slice(0, 4)}-01-01T12:00:00Z`)) / 86400000) + 1) / 7)).padStart(2, '0')}`;
      for (const a of monitor.alerts.filter((x) => x.kind === 'weather')) add({ key: a.key, kind: 'weather-change', type: 'WEATHER_CHANGE', priority: a.event.date <= addDays(today, 1) ? 5 : 4, title: 'Weather changed for a planned outfit', text: a.message, link: '#/planner', date: a.event.date, action: a.itemId ? { label: 'Adjust outfit', eventId: a.eventId, itemId: a.itemId } : null });
      for (const w of laundry.warnings) add({ key: w.key, kind: 'laundry-risk', type: 'LAUNDRY_WARNING', priority: 3, title: 'Laundry may affect your plans', text: w.message, link: '#/laundry', date: w.date, action: { label: 'Open laundry', link: '#/laundry' } });
      for (const b of borrowed.overdue) add({ key: `borrow:${b.id}:${today}`, kind: 'borrow', type: 'BORROW_RETURN', priority: 3, title: 'A lent piece is overdue', text: b.message, link: `#/closet/${b.id}`, date: today, action: { label: 'Mark returned', itemId: b.id } });
      for (const t of tailor.due) add({ key: `tailor:${t.id}:${today}`, kind: 'tailor', type: 'TAILOR_READY', priority: 4, title: 'Ready at the tailor', text: t.message, link: '#/care/repairs', date: today, action: { label: 'Mark collected', itemId: t.id } });
      if (seasonal.headline) add({ key: `season:${seasonal.season}:${today.slice(0, 7)}`, kind: 'seasonal', type: 'SEASONAL_ROTATION', priority: 1, title: 'Seasonal rotation', text: seasonal.headline, link: '#/analytics#seasonal', date: today, action: { label: 'Review', link: '#/analytics#seasonal' } });
      const f = forgotten.top || null;
      if (f) add({ key: `donate:${f.id}:${week}`, kind: 'forgotten', type: 'FORGOTTEN_DONATION', priority: 1, title: 'Still love it?', text: f.message, link: '#/analytics#forgotten', itemId: f.id, date: today, action: { label: 'Style it', link: `#/outfits?piece=${f.id}` } });
      else if (insights.forgotten[0]) { const g = insights.forgotten[0]; add({ key: `forgotten:${g.id}:${today.slice(0, 7)}`, kind: 'forgotten', priority: 1, title: 'Forgotten in your closet', text: `You haven’t worn your ${pieceName(g)} in ${g.daysSince} days. Give it another chance?`, link: `#/outfits?piece=${g.id}`, itemId: g.id, date: today }); }
      const ignored = pro ? await pro.snoozeMap(userId, 'notice') : new Map();
      for (let i = list.length - 1; i >= 0; i -= 1) if (ignored.has(list[i].key)) list.splice(i, 1);
      for (const n of list) { n.level = n.priority >= 5 ? 'HIGH' : n.priority >= 3 ? 'MEDIUM' : 'LOW'; n.type = n.type || ({ conflict: 'AVAILABILITY_CONFLICT', plan: 'PLAN_REMINDER', due: 'BORROW_RETURN', laundry: 'LAUNDRY_DAY', weather: 'WEATHER_ALERT', packing: 'PACKING', wash: 'WASH_DONE', forgotten: 'FORGOTTEN_PIECE' })[n.kind] || 'NOTICE'; }
      list.sort((a, b) => Number(a.read) - Number(b.read) || b.priority - a.priority || String(a.date).localeCompare(String(b.date)));
      let highlighted = 0;
      for (const n of list) n.highlight = !n.read && highlighted++ < PUSH_LIMIT;
      return { notifications: list, unread: list.filter((n) => !n.read).length, dailyLimit: PUSH_LIMIT, channel: 'in-app' };
    },
    async markRead(userId, keys) {
      for (const k of keys) await repo.markRead(userId, k);
      return { read: keys.length };
    },
  };
}

function registerIntelligence(deps) {
  const service = intelligenceService(deps);
  service.proactive = proactiveService({ ...deps, repo: deps.repo || intelligenceRepository(deps.db), intelligence: service });
  const r = express.Router();
  r.use(proactiveRoutes(service.proactive));
  r.get('/health', async (req, res, next) => { try { res.json(await service.health(req.user.id)); } catch (e) { next(e); } });
  r.get('/learned', async (req, res, next) => { try { res.json(await service.learned(req.user.id)); } catch (e) { next(e); } });
  r.post('/learned/:key', v.body({ decision: { type: 'enum', values: ['confirm', 'dismiss'], required: true, label: 'Decision' } }), async (req, res, next) => {
    try {
      if (!KEY.test(req.params.key)) throw errors.notFound('Pattern');
      res.json(await service.decide(req.user.id, req.params.key, req.valid.decision));
    } catch (e) { next(e); }
  });
  r.delete('/learned/:key', async (req, res, next) => {
    try {
      if (!KEY.test(req.params.key)) throw errors.notFound('Decision');
      res.json(await service.undo(req.user.id, req.params.key));
    } catch (e) { next(e); }
  });
  r.get('/conflicts', async (req, res, next) => { try { res.json(await service.conflicts(req.user.id)); } catch (e) { next(e); } });
  r.post('/conflicts/:eventId/fix', v.body({ itemId: { type: 'string', required: true, max: 36 } }), async (req, res, next) => {
    try { res.json(await service.fix(req.user.id, req.params.eventId, req.valid.itemId)); } catch (e) { next(e); }
  });
  const n = express.Router();
  n.get('/', async (req, res, next) => { try { res.json(await service.notifications(req.user.id)); } catch (e) { next(e); } });
  n.post('/read', async (req, res, next) => {
    try {
      const keys = Array.isArray(req.body.keys) ? req.body.keys.filter((k) => typeof k === 'string' && KEY.test(k)).slice(0, 50) : null;
      if (!keys) throw errors.validation([{ field: 'keys', message: 'keys must be a list of notification keys' }]);
      res.json(await service.markRead(req.user.id, keys));
    } catch (e) { next(e); }
  });
  return { service, routes: { intelligence: r, notifications: n } };
}

module.exports = { registerIntelligence, intelligenceService, intelligenceRepository };
