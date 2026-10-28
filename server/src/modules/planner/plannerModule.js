// Planner: add events by hand and see them in a month view (US-46).
// Acceptance criterion: title, date, time and one occasion.
// Sprint 3 adds outfits planned for each event (US-47, US-48).
const express = require('express');
const v = require('../../shared/validate');
const { errors } = require('../../shared/errors');
const { OCCASIONS } = require('../../shared/vocabulary');
const { guessOccasion } = require('../assistant/keywordParser');

// Calendar import (.ics, from Google Calendar / Outlook / Apple): only title, date and time are read.
function parseIcs(text, tz = 'Africa/Cairo') {
  const lines = String(text).replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  const out = [];
  let cur = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') cur = {};
    else if (line === 'END:VEVENT') { if (cur && cur.title && cur.date) out.push(cur); cur = null; }
    else if (cur) {
      const i = line.indexOf(':');
      if (i < 0) continue;
      const [name, ...params] = line.slice(0, i).split(';');
      const value = line.slice(i + 1);
      if (name === 'SUMMARY') cur.title = value.replace(/\\([,;\\])/g, '$1').replace(/\\n/gi, ' ').trim().slice(0, 80);
      if (name === 'DTSTART') {
        const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})\d{2}(Z)?)?$/);
        if (!m) continue;
        if (m[6]) { // UTC → the user's time zone
          const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]));
          const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d);
          const g = (t) => f.find((x) => x.type === t).value;
          cur.date = `${g('year')}-${g('month')}-${g('day')}`; cur.time = `${g('hour')}:${g('minute')}`;
        } else {
          cur.date = `${m[1]}-${m[2]}-${m[3]}`; cur.time = m[4] ? `${m[4]}:${m[5]}` : '09:00';
        }
        cur.allDay = params.includes('VALUE=DATE') || !m[4];
      }
    }
  }
  return out;
}

const eventSchema = {
  title: { type: 'string', required: true, min: 1, max: 80, label: 'Title' },
  date: { type: 'date', required: true, label: 'Date' },
  time: { type: 'time', required: true, label: 'Time' },
  occasion: { type: 'enum', values: Object.keys(OCCASIONS), required: true, label: 'Occasion' },
  dressCode: { type: 'int', min: 1, max: 5 },
};
const editSchema = Object.fromEntries(Object.entries(eventSchema).map(([k, r]) => [k, { ...r, required: false }]));
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

function toApi(row) {
  const d = row.event_date instanceof Date
    ? `${row.event_date.getFullYear()}-${String(row.event_date.getMonth() + 1).padStart(2, '0')}-${String(row.event_date.getDate()).padStart(2, '0')}`
    : String(row.event_date).slice(0, 10);
  return { id: row.id, title: row.title, date: d, time: String(row.event_time).slice(0, 5), occasion: row.occasion, dressCode: row.dress_code, plannedOutfitId: row.planned_outfit_id || null,
    plannedWeather: row.planned_temp_c === null || row.planned_temp_c === undefined ? null : { tempC: row.planned_temp_c, condition: row.planned_condition || null } };
}

function plannerRepository(db) {
  return {
    async create(userId, e) {
      const { rows } = await db.query(
        `INSERT INTO planner.events (user_id, title, event_date, event_time, occasion, dress_code)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [userId, e.title, e.date, e.time, e.occasion, e.dressCode],
      );
      return rows[0];
    },
    async month(userId, month) {
      const { rows } = await db.query(
        `SELECT * FROM planner.events WHERE user_id = $1
            AND event_date >= to_date($2, 'YYYY-MM') AND event_date < to_date($2, 'YYYY-MM') + interval '1 month'
          ORDER BY event_date, event_time`,
        [userId, month],
      );
      return rows;
    },
    async update(userId, id, e) {
      if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
      const { rows } = await db.query(
        `UPDATE planner.events SET title = COALESCE($3, title), event_date = COALESCE($4, event_date),
           event_time = COALESCE($5, event_time), occasion = COALESCE($6, occasion), dress_code = COALESCE($7, dress_code)
         WHERE id = $1 AND user_id = $2 RETURNING *`,
        [id, userId, e.title ?? null, e.date ?? null, e.time ?? null, e.occasion ?? null, e.dressCode ?? null],
      );
      return rows[0] || null;
    },
    async get(userId, id) {
      if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
      const { rows } = await db.query('SELECT * FROM planner.events WHERE id = $1 AND user_id = $2', [id, userId]);
      return rows[0] || null;
    },
    async upcoming(userId, days) {
      const { rows } = await db.query(
        `SELECT * FROM planner.events WHERE user_id = $1 AND event_date >= CURRENT_DATE AND event_date < CURRENT_DATE + ($2 || ' days')::interval
          ORDER BY event_date, event_time`, [userId, String(days)],
      );
      return rows;
    },
    // The forecast at planning time is kept, so the weather monitor can tell when it changed materially.
    async setPlanned(userId, id, outfitId, weather = null) {
      await db.query('UPDATE planner.events SET planned_outfit_id = $3, planned_temp_c = $4, planned_condition = $5 WHERE id = $1 AND user_id = $2',
        [id, userId, outfitId, weather ? weather.tempC : null, weather ? String(weather.condition || '').slice(0, 40) || null : null]);
    },
    async remove(userId, id) {
      if (!/^[0-9a-f-]{36}$/i.test(id)) return false;
      const { rowCount } = await db.query('DELETE FROM planner.events WHERE id = $1 AND user_id = $2', [id, userId]);
      return rowCount === 1;
    },
  };
}

const isoDay = (d) => new Date(d).toISOString().slice(0, 10);
const addDays = (day, n) => isoDay(new Date(`${day}T12:00:00Z`).getTime() + n * 86400000);
const pieceName = (p) => (p.name || `${p.colour} ${p.category}`).toLowerCase();

function plannerService({ repo, rec, outfits, wardrobe, availability }) {
  // Adds the forecast (up to 16 days ahead) and the planned outfit to each event.
  async function enrich(userId, rows) {
    const today = new Date().toISOString().slice(0, 10);
    const ahead = new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10);
    return Promise.all(rows.map(async (row) => {
      const e = toApi(row);
      if (rec && e.date >= today && e.date <= ahead) e.weather = await rec().weather(userId, e.date);
      if (outfits && e.plannedOutfitId) e.plannedOutfit = await outfits().get(userId, e.plannedOutfitId);
      return e;
    }));
  }
  return {
    async add(userId, e) {
      // The event's dress code defaults to the occasion's level (section 3.1).
      return (await enrich(userId, [await repo.create(userId, { ...e, dressCode: e.dressCode || OCCASIONS[e.occasion] })]))[0];
    },
    async month(userId, month) {
      if (!MONTH.test(month || '')) throw errors.validation([{ field: 'month', message: 'month must be YYYY-MM' }]);
      return enrich(userId, await repo.month(userId, month));
    },
    async upcoming(userId, days = 14) { return enrich(userId, await repo.upcoming(userId, days)); },
    // US-47: 3 outfits for an event, using its dress code and that day's forecast.
    async recommendFor(userId, id) {
      const row = await repo.get(userId, id);
      if (!row) throw errors.notFound('Event');
      const e = toApi(row);
      return { event: e, ...(await rec().recommend(userId, { occasion: e.occasion, level: e.dressCode, date: e.date })) };
    },
    // US-48: choose one as the planned outfit.
    async plan(userId, id, outfit) {
      const row = await repo.get(userId, id);
      if (!row) throw errors.notFound('Event');
      const e = toApi(row);
      const saved = await outfits().savePlanned(userId, { ...outfit, occasion: e.occasion });
      const today = new Date().toISOString().slice(0, 10);
      const w = rec && e.date >= today ? await rec().weather(userId, e.date).catch(() => null) : null;
      await repo.setPlanned(userId, id, saved.id, w);
      return (await enrich(userId, [await repo.get(userId, id)]))[0];
    },
    async unplan(userId, id) {
      if (!(await repo.get(userId, id))) throw errors.notFound('Event');
      await repo.setPlanned(userId, id, null);
      return (await enrich(userId, [await repo.get(userId, id)]))[0];
    },
    async edit(userId, id, e) {
      const changes = { ...e };
      if (e.occasion && !e.dressCode) changes.dressCode = OCCASIONS[e.occasion];
      const row = await repo.update(userId, id, changes);
      if (!row) throw errors.notFound('Event');
      return (await enrich(userId, [row]))[0];
    },
    async remove(userId, id) {
      if (!(await repo.remove(userId, id))) throw errors.notFound('Event');
    },
    // Calendar view: events plus wardrobe dates — laundry day, pieces back from the laundry,
    // borrowed pieces due back, packed pieces returning — and planned outfits.
    async calendar(userId, month) {
      const events = await this.month(userId, month);
      const markers = [];
      if (wardrobe && availability) {
        const pieces = await wardrobe().allPieces(userId);
        const s = await availability.settings(userId);
        const inMonth = (d) => d && d.slice(0, 7) === month;
        for (const p of pieces) {
          if (p.status === 'Available' || !inMonth(p.expectedBack)) continue;
          const kind = { Laundry: 'laundry-back', Borrowed: 'borrowed-due', Packed: 'packed-back', Unavailable: 'unavailable-back' }[p.status];
          const label = { Laundry: `${pieceName(p)} back from the laundry`, Borrowed: `${pieceName(p)} due back${p.statusNote ? ` from ${p.statusNote}` : ''}`, Packed: `${pieceName(p)} unpacked`, Unavailable: `${pieceName(p)} ready again` }[p.status];
          markers.push({ date: p.expectedBack, kind, label, itemId: p.id });
        }
        if (s.laundryWeekday !== null && s.laundryWeekday !== undefined) {
          const first = new Date(`${month}-01T12:00:00Z`);
          for (let d = new Date(first); d.getUTCMonth() === first.getUTCMonth(); d.setUTCDate(d.getUTCDate() + 1)) {
            if (d.getUTCDay() === s.laundryWeekday) markers.push({ date: isoDay(d), kind: 'laundry-day', label: 'Laundry day' });
          }
        }
      }
      markers.sort((a, b) => a.date.localeCompare(b.date));
      return { month, events, markers };
    },
    // In-app reminders (the Notification Service will push these in Sprint 3).
    async reminders(userId) {
      const today = isoDay(Date.now());
      const tomorrow = addDays(today, 1);
      const list = [];
      const events = await this.upcoming(userId, 3);
      const pieces = wardrobe ? await wardrobe().allPieces(userId) : [];
      for (const e of events) {
        const when = e.date === today ? 'today' : e.date === tomorrow ? 'tomorrow' : `on ${e.date}`;
        if (!e.plannedOutfit) list.push({ kind: 'plan', eventId: e.id, date: e.date, text: `Plan an outfit for “${e.title}” ${when}.` });
        else {
          const blocked = e.plannedOutfit.pieces.find((p) => p.status !== 'Available');
          if (blocked) {
            const back = blocked.expectedBack;
            list.push({ kind: 'conflict', eventId: e.id, date: e.date, itemId: blocked.id,
              text: back && back <= e.date ? `Your ${pieceName(blocked)} (${blocked.status.toLowerCase()}) will be back by ${back}, in time for “${e.title}”.` : `Your ${pieceName(blocked)} is ${blocked.status} — it is part of the outfit for “${e.title}” ${when}.` });
          }
        }
      }
      for (const p of pieces) {
        if (p.status === 'Borrowed' && p.statusUntil && p.statusUntil <= tomorrow) list.push({ kind: 'due', itemId: p.id, date: p.statusUntil, text: `${p.name || 'A piece'}${p.statusNote ? ` (with ${p.statusNote})` : ''} is due back ${p.statusUntil < today ? 'and is overdue' : p.statusUntil === today ? 'today' : 'tomorrow'}.` });
      }
      if (availability) {
        const s = await availability.settings(userId);
        const laundry = pieces.filter((p) => p.status === 'Laundry').length;
        if (s.laundryWeekday === new Date(`${tomorrow}T12:00:00Z`).getUTCDay() && laundry) list.push({ kind: 'laundry', date: tomorrow, text: `Tomorrow is laundry day: ${laundry} piece${laundry === 1 ? '' : 's'} in the basket.` });
      }
      return { reminders: list, channel: 'in-app' };
    },
    async importIcs(userId, text) {
      const parsed = parseIcs(text);
      const today = isoDay(Date.now());
      const limit = addDays(today, 366);
      const existing = await repo.upcoming(userId, 400);
      const seen = new Set(existing.map((r) => `${toApi(r).title}|${toApi(r).date}`));
      const created = [];
      let skipped = 0;
      for (const e of parsed.slice(0, 200)) {
        if (e.date < today || e.date > limit || seen.has(`${e.title}|${e.date}`) || !e.title) { skipped += 1; continue; }
        const occasion = guessOccasion(e.title) || 'Everyday';
        created.push(toApi(await repo.create(userId, { title: e.title, date: e.date, time: e.time, occasion, dressCode: OCCASIONS[occasion] })));
        seen.add(`${e.title}|${e.date}`);
      }
      return { imported: created.length, skipped, found: parsed.length, events: created };
    },
  };
}

function plannerRoutes({ planner }) {
  const r = express.Router();
  r.get('/calendar', async (req, res, next) => {
    try {
      if (!MONTH.test(req.query.month || '')) throw errors.validation([{ field: 'month', message: 'month must be YYYY-MM' }]);
      res.json(await planner.calendar(req.user.id, req.query.month));
    } catch (e) { next(e); }
  });
  r.get('/reminders', async (req, res, next) => {
    try { res.json(await planner.reminders(req.user.id)); } catch (e) { next(e); }
  });
  r.post('/import', v.body({ ics: { type: 'string', required: true, min: 10, max: 90000, label: 'Calendar file' } }), async (req, res, next) => {
    try {
      if (!/BEGIN:VCALENDAR/.test(req.valid.ics)) throw errors.validation([{ field: 'ics', message: 'This is not a calendar (.ics) file' }]);
      res.status(201).json(await planner.importIcs(req.user.id, req.valid.ics));
    } catch (e) { next(e); }
  });
  r.get('/upcoming', async (req, res, next) => {
    try { res.json({ events: await planner.upcoming(req.user.id, 14) }); } catch (e) { next(e); }
  });
  r.post('/:id/recommend', async (req, res, next) => {
    try { res.json(await planner.recommendFor(req.user.id, req.params.id)); } catch (e) { next(e); }
  });
  r.put('/:id/outfit', async (req, res, next) => {
    try {
      const { checkIds } = require('../outfits/outfitsModule');
      const itemIds = checkIds(req.body.itemIds, 2, 4);
      const ruleScore = Number.isInteger(req.body.ruleScore) && req.body.ruleScore >= 0 && req.body.ruleScore <= 100 ? req.body.ruleScore : null;
      const reasons = Array.isArray(req.body.reasons) ? req.body.reasons.filter((x) => typeof x === 'string').slice(0, 6) : [];
      res.json(await planner.plan(req.user.id, req.params.id, { itemIds, ruleScore, reasons }));
    } catch (e) { next(e); }
  });
  r.delete('/:id/outfit', async (req, res, next) => {
    try { res.json(await planner.unplan(req.user.id, req.params.id)); } catch (e) { next(e); }
  });
  r.get('/', async (req, res, next) => {
    try { res.json({ events: await planner.month(req.user.id, req.query.month) }); } catch (e) { next(e); }
  });
  r.post('/', v.body(eventSchema), async (req, res, next) => {
    try { res.status(201).json(await planner.add(req.user.id, req.valid)); } catch (e) { next(e); }
  });
  r.patch('/:id', v.body(editSchema), async (req, res, next) => {
    try { res.json(await planner.edit(req.user.id, req.params.id, req.valid)); } catch (e) { next(e); }
  });
  r.delete('/:id', async (req, res, next) => {
    try { await planner.remove(req.user.id, req.params.id); res.status(204).end(); } catch (e) { next(e); }
  });
  return r;
}

function registerPlanner({ db, repo, rec, outfits, wardrobe, availability }) {
  const service = plannerService({ repo: repo || plannerRepository(db), rec, outfits, wardrobe, availability });
  return { service, routes: plannerRoutes({ planner: service }) };
}

module.exports = { registerPlanner, plannerService, plannerRepository, eventSchema, toApi, parseIcs };
