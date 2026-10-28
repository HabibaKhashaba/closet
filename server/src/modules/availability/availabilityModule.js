// Availability: status per piece (US-56), laundry basket (US-15), "Wash done" (US-16).
// Version 1.2: laundry basket time (pieces come back on their own after N days), return dates
// and notes for Borrowed / Packed / Unavailable. Provides IAvailability. Owns availability.item_status and availability.status_history.
const express = require('express');
const v = require('../../shared/validate');
const { errors } = require('../../shared/errors');
const { STATUSES } = require('../../shared/vocabulary');
const { TOPICS } = require('../../events/eventBus');
const { canMove, INITIAL, ALLOWED } = require('./statusMachine');

function availabilityRepository(db, transaction) {
  return {
    async init(userId, itemId) {
      await db.query(
        'INSERT INTO availability.item_status (item_id, user_id, status) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [itemId, userId, INITIAL],
      );
    },
    async all(userId) {
      const { rows } = await db.query('SELECT item_id, status, changed_at, until, note FROM availability.item_status WHERE user_id = $1', [userId]);
      return rows;
    },
    // Laundry basket time: pieces in Laundry for N days or more go back to Available (logged).
    async sweepLaundry(userId, days) {
      return transaction(async (c) => {
        const { rows } = await c.query(
          `UPDATE availability.item_status SET status = 'Available', changed_at = now(), until = NULL, note = NULL
            WHERE user_id = $1 AND status = 'Laundry' AND changed_at <= now() - ($2 || ' days')::interval RETURNING item_id`, [userId, String(days)],
        );
        for (const r of rows) await c.query("INSERT INTO availability.status_history (item_id, from_status, to_status) VALUES ($1, 'Laundry', 'Available')", [r.item_id]);
        return rows.map((r) => r.item_id);
      });
    },
    async get(userId, itemId) {
      if (!/^[0-9a-f-]{36}$/i.test(itemId)) return null;
      const { rows } = await db.query(
        'SELECT item_id, status FROM availability.item_status WHERE item_id = $1 AND user_id = $2', [itemId, userId],
      );
      return rows[0] || null;
    },
    async move(userId, itemId, from, to, until = null, note = null) {
      return transaction(async (c) => {
        // "AND status = $4" guards against two requests changing the same piece at once.
        const { rowCount } = await c.query(
          `UPDATE availability.item_status SET status = $3, changed_at = now(), until = $5, note = $6
            WHERE item_id = $1 AND user_id = $2 AND status = $4`, [itemId, userId, to, from, until, note],
        );
        if (rowCount === 1) {
          await c.query('INSERT INTO availability.status_history (item_id, from_status, to_status) VALUES ($1, $2, $3)', [itemId, from, to]);
        }
        return rowCount === 1;
      });
    },
    // Undo of an agent action: put a piece back to the status it had before (logged in history).
    async restore(userId, itemId, status) {
      return transaction(async (c) => {
        const { rows } = await c.query('SELECT status FROM availability.item_status WHERE item_id = $1 AND user_id = $2 FOR UPDATE', [itemId, userId]);
        if (!rows[0] || rows[0].status === status) return false;
        await c.query('UPDATE availability.item_status SET status = $3, changed_at = now() WHERE item_id = $1 AND user_id = $2', [itemId, userId, status]);
        await c.query('INSERT INTO availability.status_history (item_id, from_status, to_status) VALUES ($1, $2, $3)', [itemId, rows[0].status, status]);
        return true;
      });
    },
    async washDone(userId) {
      return transaction(async (c) => {
        const { rows } = await c.query(
          `UPDATE availability.item_status SET status = 'Available', changed_at = now(), until = NULL, note = NULL
            WHERE user_id = $1 AND status = 'Laundry' RETURNING item_id`, [userId],
        );
        for (const r of rows) {
          await c.query(
            "INSERT INTO availability.status_history (item_id, from_status, to_status) VALUES ($1, 'Laundry', 'Available')", [r.item_id],
          );
        }
        return rows.map((r) => r.item_id);
      });
    },
  };
}

const DAY = 86400000;
const isoDay = (d) => new Date(d).toISOString().slice(0, 10);

function availabilityService({ repo, profile }) {
  async function settings(userId) {
    const p = profile ? await profile().preferences(userId) : {};
    return { laundryDays: p.laundryDays || 2, autoReturn: p.laundryAutoReturn !== false, laundryWeekday: p.laundryWeekday ?? null };
  }
  // When will a piece be Available again? Laundry: changed_at + laundry basket time; others: their return date.
  function expectedBack(r, s) {
    if (r.status === 'Laundry') return isoDay(new Date(r.changed_at).getTime() + s.laundryDays * DAY);
    return r.until ? isoDay(r.until) : null;
  }
  return {
    async sweep(userId) {
      const s = await settings(userId);
      return s.autoReturn ? repo.sweepLaundry(userId, s.laundryDays) : [];
    },
    // IAvailability: status of each piece (a piece without a row counts as Available).
    async statusMap(userId) {
      return new Map((await repo.all(userId)).map((r) => [r.item_id, r.status]));
    },
    // Status with its dates: since when, return date, note, and when it is expected back.
    async infoMap(userId) {
      await this.sweep(userId);
      const s = await settings(userId);
      return new Map((await repo.all(userId)).map((r) => [r.item_id, {
        status: r.status, since: r.changed_at, until: r.until ? isoDay(r.until) : null, note: r.note, expectedBack: r.status === 'Available' ? null : expectedBack(r, s),
      }]));
    },
    async availableIds(userId) {
      return (await repo.all(userId)).filter((r) => r.status === 'Available').map((r) => r.item_id);
    },
    async setStatus(userId, itemId, to, { until = null, note = null } = {}) {
      const current = await repo.get(userId, itemId);
      if (!current) throw errors.notFound('Piece');
      if (to === 'Available' || to === 'Laundry') { until = null; note = null; }
      if (until && until < isoDay(Date.now())) throw errors.validation([{ field: 'until', message: 'The return date cannot be in the past' }]);
      if (current.status === to && !until && !note) return { itemId, status: to, changed: false };
      if (current.status === to) {
        await repo.move(userId, itemId, to, to, until, note);
        return { itemId, status: to, changed: true, until, note };
      }
      if (!canMove(current.status, to)) {
        throw errors.conflict('INVALID_TRANSITION',
          `A piece that is ${current.status} cannot go to ${to}. Allowed: ${ALLOWED[current.status].join(', ')}.`);
      }
      if (!(await repo.move(userId, itemId, current.status, to, until, note))) {
        throw errors.conflict('STATUS_CHANGED', 'This piece was just changed. Refresh and try again.');
      }
      return { itemId, status: to, changed: true, until, note };
    },
    async restore(userId, itemId, status) { return repo.restore(userId, itemId, status); },
    async laundryIds(userId) {
      await this.sweep(userId);
      return (await repo.all(userId)).filter((r) => r.status === 'Laundry').map((r) => r.item_id);
    },
    settings,
    async washDone(userId) {
      const ids = await repo.washDone(userId);
      return { returned: ids.length, itemIds: ids };
    },
  };
}

function availabilityRoutes({ availability, wardrobe }) {
  const items = express.Router();
  const statusSchema = {
    status: { type: 'enum', values: STATUSES, required: true },
    until: { type: 'date', label: 'Return date' },
    note: { type: 'string', max: 60, label: 'Note' },
  };
  items.patch('/:id/status', v.body(statusSchema), async (req, res, next) => {
    try { res.json(await availability.setStatus(req.user.id, req.params.id, req.valid.status, req.valid)); } catch (e) { next(e); }
  });

  const laundry = express.Router();
  laundry.get('/', async (req, res, next) => {
    try {
      const ids = await availability.laundryIds(req.user.id);
      const pieces = (await wardrobe().allPieces(req.user.id)).filter((p) => ids.includes(p.id));
      const s = await availability.settings(req.user.id);
      res.json({ items: pieces, count: pieces.length, laundryDays: s.laundryDays, autoReturn: s.autoReturn, laundryWeekday: s.laundryWeekday });
    } catch (e) { next(e); }
  });
  laundry.post('/wash-done', async (req, res, next) => {
    try { res.json(await availability.washDone(req.user.id)); } catch (e) { next(e); }
  });
  return { items, laundry };
}

function registerAvailability({ db, transaction, repo: givenRepo, bus, wardrobe, profile }) {
  const repo = givenRepo || availabilityRepository(db, transaction);
  const service = availabilityService({ repo, profile });
  bus.subscribe(TOPICS.ItemCreated, ({ userId, itemId }) => repo.init(userId, itemId));
  return { service, routes: availabilityRoutes({ availability: service, wardrobe }) };
}

module.exports = { registerAvailability, availabilityService, availabilityRepository };
