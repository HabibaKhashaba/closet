// Availability: the garment lifecycle (shared/lifecycle.js) — status per piece (US-56), laundry basket (US-15),
// "Wash done" (US-16), and since v1.6 Care (repairs & alterations, at the tailor) and Borrow & lend.
// Provides IAvailability. Owns availability.item_status, status_history, care_jobs and loans.
//
// ONE rule: the status column says where a piece is and whether it can be worn. care_jobs and loans only hold
// the details (reason, tailor, person, dates) and the history. Every status change goes through setStatus(),
// which keeps the details in step with the status — whichever screen, Ask Closet or trip made the change.
const express = require('express');
const v = require('../../shared/validate');
const { errors } = require('../../shared/errors');
const { STATUSES } = require('../../shared/vocabulary');
const { TOPICS } = require('../../events/eventBus');
const { canMove, INITIAL, ALLOWED } = require('./statusMachine');
const { CARE_KIND, NEEDS, LABEL } = require('../../shared/lifecycle');

const DAY = 86400000;
const isoDay = (d) => new Date(d).toISOString().slice(0, 10);
const today = () => isoDay(Date.now());
const daysBetween = (a, b) => Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / DAY);
const asDay = (d) => (d ? String(d instanceof Date ? isoDay(d) : d).slice(0, 10) : null);

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
    // ---- Care: repairs & alterations ----
    async openJob(userId, itemId, kind, reason, notes) {
      await db.query('INSERT INTO availability.care_jobs (item_id, user_id, kind, reason, notes) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING',
        [itemId, userId, kind, reason, notes || null]);
    },
    async updateJob(userId, itemId, d) {
      await db.query(`UPDATE availability.care_jobs SET tailor = COALESCE($3, tailor), sent_on = COALESCE($4::date, sent_on), expected_back = COALESCE($5::date, expected_back),
        cost = COALESCE($6::numeric, cost), kind = COALESCE($7, kind), reason = COALESCE($8, reason), notes = COALESCE($9, notes)
        WHERE item_id = $1 AND user_id = $2 AND closed_on IS NULL`,
      [itemId, userId, d.tailor ?? null, d.sentOn ?? null, d.expectedBack ?? null, d.cost ?? null, d.kind ?? null, d.reason ?? null, d.notes ?? null]);
    },
    async closeJob(userId, itemId, outcome, on) {
      await db.query('UPDATE availability.care_jobs SET closed_on = $4, outcome = $3 WHERE item_id = $1 AND user_id = $2 AND closed_on IS NULL', [itemId, userId, outcome, on]);
    },
    async jobs(userId) {
      const { rows } = await db.query('SELECT * FROM availability.care_jobs WHERE user_id = $1 ORDER BY created_at DESC, id DESC', [userId]);
      return rows;
    },
    // ---- Borrow & lend ----
    async openLoan(userId, itemId, person, lentOn, dueOn, note) {
      await db.query('INSERT INTO availability.loans (item_id, user_id, person, lent_on, due_on, note) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING',
        [itemId, userId, person, lentOn, dueOn || null, note || null]);
    },
    async closeLoan(userId, itemId, on) {
      await db.query('UPDATE availability.loans SET returned_on = $3 WHERE item_id = $1 AND user_id = $2 AND returned_on IS NULL', [itemId, userId, on]);
    },
    async loans(userId) {
      const { rows } = await db.query('SELECT * FROM availability.loans WHERE user_id = $1 ORDER BY lent_on DESC, id DESC', [userId]);
      return rows;
    },
  };
}

const jobApi = (j) => (j ? {
  kind: j.kind, reason: j.reason, notes: j.notes || null, tailor: j.tailor || null, sentOn: asDay(j.sent_on), expectedBack: asDay(j.expected_back),
  cost: j.cost === null || j.cost === undefined ? null : Number(j.cost), closedOn: asDay(j.closed_on), outcome: j.outcome || null, createdAt: j.created_at,
} : null);
const loanApi = (l) => (l ? { person: l.person, lentOn: asDay(l.lent_on), dueOn: asDay(l.due_on), note: l.note || null, returnedOn: asDay(l.returned_on) } : null);

function availabilityService({ repo, profile, wardrobe }) {
  async function settings(userId) {
    const p = profile ? await profile().preferences(userId) : {};
    return { laundryDays: p.laundryDays || 2, autoReturn: p.laundryAutoReturn !== false, laundryWeekday: p.laundryWeekday ?? null };
  }
  // When will a piece be Available again? Laundry: changed_at + laundry basket time; others: their return date.
  function expectedBack(r, s) {
    if (r.status === 'Laundry') return isoDay(new Date(r.changed_at).getTime() + s.laundryDays * DAY);
    return r.until ? isoDay(r.until) : null;
  }
  async function piece(userId, itemId) {
    const p = wardrobe ? (await wardrobe().allPieces(userId)).find((x) => x.id === itemId) : null;
    return p;
  }

  const service = {
    async sweep(userId) {
      const s = await settings(userId);
      return s.autoReturn ? repo.sweepLaundry(userId, s.laundryDays) : [];
    },
    // IAvailability: status of each piece (a piece without a row counts as Available).
    async statusMap(userId) {
      return new Map((await repo.all(userId)).map((r) => [r.item_id, r.status]));
    },
    // Status with its dates, and the open repair / loan behind it.
    async infoMap(userId) {
      await this.sweep(userId);
      const s = await settings(userId);
      const jobs = new Map((await repo.jobs(userId)).filter((j) => !j.closed_on).map((j) => [j.item_id, jobApi(j)]));
      const loans = new Map((await repo.loans(userId)).filter((l) => !l.returned_on).map((l) => [l.item_id, loanApi(l)]));
      return new Map((await repo.all(userId)).map((r) => [r.item_id, {
        status: r.status, since: r.changed_at, until: r.until ? isoDay(r.until) : null, note: r.note, expectedBack: r.status === 'Available' ? null : expectedBack(r, s),
        care: jobs.get(r.item_id) || null, loan: r.status === 'Borrowed' ? loans.get(r.item_id) || null : null,
      }]));
    },
    async availableIds(userId) {
      return (await repo.all(userId)).filter((r) => r.status === 'Available').map((r) => r.item_id);
    },
    // The ONE way a status changes. Keeps repairs and loans in step with the lifecycle.
    //   o.care: { kind, reason, notes, tailor, sentOn, cost }   o.loan: { person, lentOn, note }
    async setStatus(userId, itemId, to, { until = null, note = null, care = {}, loan = {} } = {}) {
      const current = await repo.get(userId, itemId);
      if (!current) throw errors.notFound('Piece');
      const from = current.status;
      if (['Available', 'Laundry', 'Ready to donate'].includes(to)) { until = null; note = null; }
      const backDated = (to === 'Borrowed' && loan.lentOn) || (to === 'At tailor' && care.sentOn); // recording a loan / repair that started earlier
      if (until && until < today() && !backDated) throw errors.validation([{ field: 'until', message: 'The return date cannot be in the past' }]);
      if (to === 'Borrowed') note = (loan.person || note || 'Someone').slice(0, 60);
      if (CARE_KIND[to]) note = (care.reason || note || 'Not specified').slice(0, 60);
      if (to === 'At tailor') note = care.tailor ? care.tailor.slice(0, 60) : note;
      if (from === to && !until && !note) return { itemId, status: to, changed: false };
      if (from === to) {
        await repo.move(userId, itemId, to, to, until, note);
        if (to === 'Borrowed') await repo.openLoan(userId, itemId, note, loan.lentOn || today(), until, loan.note);
        return { itemId, status: to, changed: true, until, note };
      }
      if (!canMove(from, to)) {
        throw errors.conflict('INVALID_TRANSITION',
          `A piece that is ${LABEL[from].toLowerCase()} cannot go to ${LABEL[to].toLowerCase()}. Allowed: ${ALLOWED[from].join(', ')}.`);
      }
      if (!(await repo.move(userId, itemId, from, to, until, note))) {
        throw errors.conflict('STATUS_CHANGED', 'This piece was just changed. Refresh and try again.');
      }
      // keep the details in step
      if (from === 'Borrowed') await repo.closeLoan(userId, itemId, today());
      if (to === 'Borrowed') await repo.openLoan(userId, itemId, note, loan.lentOn || today(), until, loan.note);
      if (CARE_KIND[to]) await repo.openJob(userId, itemId, CARE_KIND[to], (care.reason || note).slice(0, 80), care.notes);
      if (to === 'At tailor') await repo.updateJob(userId, itemId, { tailor: care.tailor || null, sentOn: care.sentOn || today(), expectedBack: until, cost: care.cost ?? null });
      if ((CARE_KIND[from] || from === 'At tailor') && !CARE_KIND[to] && to !== 'At tailor') {
        await repo.closeJob(userId, itemId, to === 'Ready to donate' ? 'donated' : from === 'At tailor' ? 'collected' : 'fixed', today());
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

    // ---------- Care: repairs & alterations ----------
    // Repair / Alter → Needs repair | Needs alteration (reason, notes)
    async needsCare(userId, itemId, { kind, reason, notes }) {
      const p = await piece(userId, itemId);
      if (!p) throw errors.notFound('Piece');
      const to = NEEDS[kind];
      if (CARE_KIND[p.status]) { // already waiting: change what it needs
        if (p.status !== to) await this.setStatus(userId, itemId, 'Available');
        else { await repo.updateJob(userId, itemId, { kind, reason, notes }); return this.pieceCare(userId, itemId); }
      }
      await this.setStatus(userId, itemId, to, { care: { reason, notes } });
      return this.pieceCare(userId, itemId);
    },
    // Send to tailor (from Needs repair / Needs alteration): tailor, date sent, expected return, cost.
    async sendToTailor(userId, itemId, { tailor, sentOn, expectedBack, cost }) {
      const p = await piece(userId, itemId);
      if (!p) throw errors.notFound('Piece');
      if (!CARE_KIND[p.status]) throw errors.conflict('NOT_IN_CARE', 'Mark what it needs first (Repair / Alter), then send it to the tailor.');
      if (sentOn && expectedBack < sentOn) throw errors.validation([{ field: 'expectedBack', message: 'The expected return date is before the date it was sent' }]);
      await this.setStatus(userId, itemId, 'At tailor', { until: expectedBack, care: { tailor, sentOn, cost } });
      return this.pieceCare(userId, itemId);
    },
    // Mark collected (from the tailor) or Mark fixed (repaired at home) → Available, eligible for outfits again.
    async careDone(userId, itemId) {
      const p = await piece(userId, itemId);
      if (!p) throw errors.notFound('Piece');
      if (!CARE_KIND[p.status] && p.status !== 'At tailor') throw errors.conflict('NOT_IN_CARE', 'This piece is not waiting for a repair or at the tailor.');
      await this.setStatus(userId, itemId, 'Available');
      return { ...(await this.pieceCare(userId, itemId)), message: p.status === 'At tailor' ? 'Collected from the tailor — back in your outfits.' : 'Fixed — back in your outfits.' };
    },
    async pieceCare(userId, itemId) {
      const p = await piece(userId, itemId);
      return p;
    },
    // Care screen: everything that is being looked after, with what is due.
    async care(userId) {
      const pieces = wardrobe ? await wardrobe().allPieces(userId) : [];
      const t = today();
      const withJob = (p) => ({ ...p, due: p.status === 'At tailor' && p.statusUntil ? p.statusUntil <= t : false, daysLate: p.status === 'At tailor' && p.statusUntil && p.statusUntil < t ? daysBetween(p.statusUntil, t) : 0 });
      const closed = (await repo.jobs(userId)).filter((j) => j.closed_on).slice(0, 12);
      const names = new Map(pieces.map((p) => [p.id, p]));
      return {
        needsRepair: pieces.filter((p) => p.status === 'Needs repair').map(withJob),
        needsAlteration: pieces.filter((p) => p.status === 'Needs alteration').map(withJob),
        atTailor: pieces.filter((p) => p.status === 'At tailor').map(withJob).sort((a, b) => String(a.statusUntil).localeCompare(String(b.statusUntil))),
        laundry: pieces.filter((p) => p.status === 'Laundry').length,
        history: closed.map((j) => ({ itemId: j.item_id, name: names.get(j.item_id)?.name || null, ...jobApi(j) })),
      };
    },

    // ---------- Borrow & lend ----------
    async lend(userId, itemId, { person, lentOn, dueOn, note }) {
      if (lentOn && dueOn < lentOn) throw errors.validation([{ field: 'dueOn', message: 'The return date is before the day it was lent' }]);
      await this.setStatus(userId, itemId, 'Borrowed', { until: dueOn, loan: { person, lentOn, note } });
      return piece(userId, itemId);
    },
    async returned(userId, itemId) {
      const p = await piece(userId, itemId);
      if (!p) throw errors.notFound('Piece');
      if (p.status !== 'Borrowed') throw errors.conflict('NOT_LENT', 'This piece is not lent out.');
      await this.setStatus(userId, itemId, 'Available');
      return piece(userId, itemId);
    },
    async lending(userId) {
      const pieces = wardrobe ? await wardrobe().allPieces(userId) : [];
      const byId = new Map(pieces.map((p) => [p.id, p]));
      const t = today();
      const rows = await repo.loans(userId);
      const current = pieces.filter((p) => p.status === 'Borrowed').map((p) => {
        const l = p.loan || { person: p.statusNote || 'Someone', lentOn: p.statusSince ? isoDay(p.statusSince) : null, dueOn: p.statusUntil };
        const overdue = l.dueOn && l.dueOn < t ? daysBetween(l.dueOn, t) : 0;
        return { ...p, loan: l, daysOut: l.lentOn ? daysBetween(l.lentOn, t) : null, overdueDays: overdue, dueToday: l.dueOn === t };
      }).sort((a, b) => b.overdueDays - a.overdueDays || String(a.loan.dueOn).localeCompare(String(b.loan.dueOn)));
      const history = rows.filter((l) => l.returned_on).map((l) => ({ itemId: l.item_id, name: byId.get(l.item_id)?.name || null, photoUrl: byId.get(l.item_id)?.photoUrl || null, ...loanApi(l) }));
      return { current, overdue: current.filter((x) => x.overdueDays > 0).length, history };
    },
  };
  return service;
}

// Request schemas (also used by the offline demo's local API, so both validate the same way)
const careSchema = {
  kind: { type: 'enum', values: ['repair', 'alteration'], required: true, label: 'What it needs' },
  reason: { type: 'string', required: true, max: 80, label: 'Reason' },
  notes: { type: 'string', max: 200, label: 'Notes' },
};
const tailorSchema = {
  tailor: { type: 'string', max: 60, label: 'Tailor' },
  sentOn: { type: 'date', label: 'Date sent' },
  expectedBack: { type: 'date', required: true, label: 'Expected return' },
  cost: { type: 'number', min: 0, max: 100000, label: 'Cost' },
};
const lendSchema = {
  person: { type: 'string', required: true, max: 60, label: 'Who' },
  lentOn: { type: 'date', label: 'Date lent' },
  dueOn: { type: 'date', required: true, label: 'Expected return' },
  note: { type: 'string', max: 120, label: 'Note' },
};

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
  // Care (v1.6)
  items.post('/:id/care', v.body(careSchema), async (req, res, next) => {
    try { res.json(await availability.needsCare(req.user.id, req.params.id, req.valid)); } catch (e) { next(e); }
  });
  items.post('/:id/care/tailor', v.body(tailorSchema), async (req, res, next) => {
    try { res.json(await availability.sendToTailor(req.user.id, req.params.id, req.valid)); } catch (e) { next(e); }
  });
  items.post('/:id/care/done', async (req, res, next) => {
    try { res.json(await availability.careDone(req.user.id, req.params.id)); } catch (e) { next(e); }
  });
  // Borrow & lend (v1.6)
  items.post('/:id/lend', v.body(lendSchema), async (req, res, next) => {
    try { res.json(await availability.lend(req.user.id, req.params.id, req.valid)); } catch (e) { next(e); }
  });
  items.post('/:id/return', async (req, res, next) => {
    try { res.json(await availability.returned(req.user.id, req.params.id)); } catch (e) { next(e); }
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
  const care = express.Router();
  care.get('/', async (req, res, next) => { try { res.json(await availability.care(req.user.id)); } catch (e) { next(e); } });
  const lending = express.Router();
  lending.get('/', async (req, res, next) => { try { res.json(await availability.lending(req.user.id)); } catch (e) { next(e); } });
  return { items, laundry, care, lending };
}

function registerAvailability({ db, transaction, repo: givenRepo, bus, wardrobe, profile }) {
  const repo = givenRepo || availabilityRepository(db, transaction);
  const service = availabilityService({ repo, profile, wardrobe });
  bus.subscribe(TOPICS.ItemCreated, ({ userId, itemId }) => repo.init(userId, itemId));
  return { service, routes: availabilityRoutes({ availability: service, wardrobe }) };
}

module.exports = { registerAvailability, availabilityService, availabilityRepository, careSchema, tailorSchema, lendSchema };
