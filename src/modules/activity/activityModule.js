// Activity / audit log (US-93). Written by the Audit step of the API Gateway (gateway/audit.js),
// so feature modules do not need to know about it. Each user sees only their own entries.
//   GET /activity   the last 50 actions, newest first
const express = require('express');

// Repository: the only code that touches activity.log (the offline demo supplies an in-memory one).
function activityRepository(db) {
  return {
    async insert(userId, action, detail) { await db.query('INSERT INTO activity.log (user_id, action, detail) VALUES ($1, $2, $3)', [userId, action, detail]); },
    async list(userId, limit) { return (await db.query('SELECT id, action, detail, at FROM activity.log WHERE user_id = $1 ORDER BY at DESC, id DESC LIMIT $2', [userId, limit])).rows; },
    async since(userId, hours) { return (await db.query("SELECT id, action, detail, at FROM activity.log WHERE user_id = $1 AND at > now() - ($2 || ' hours')::interval ORDER BY at DESC", [userId, String(hours)])).rows; },
    async pieceLabel(userId, itemId) { return (await db.query('SELECT name, colour, category FROM wardrobe.items WHERE id = $1 AND user_id = $2', [itemId, userId])).rows[0] || null; },
  };
}

function activityService({ repo }) {
  const out = (r) => ({ id: Number(r.id), action: r.action, detail: r.detail, at: r.at });
  return {
    async record(userId, action, detail = null) { await repo.insert(userId, action, detail ? String(detail).slice(0, 160) : null); },
    async list(userId, limit = 50) { return (await repo.list(userId, limit)).map(out); },
    async recent(userId, hours = 24) { return (await repo.since(userId, hours)).map(out); },
    async pieceName(userId, itemId) {
      if (!/^[0-9a-f-]{36}$/i.test(itemId || '')) return null;
      const r = await repo.pieceLabel(userId, itemId);
      return r ? r.name || `${r.colour} ${r.category}`.toLowerCase() : null;
    },
  };
}

function registerActivity({ db, repo }) {
  const service = activityService({ repo: repo || activityRepository(db) });
  const r = express.Router();
  r.get('/', async (req, res, next) => {
    try { res.json({ activity: await service.list(req.user.id) }); } catch (e) { next(e); }
  });
  return { service, routes: r };
}

module.exports = { registerActivity, activityService, activityRepository };
