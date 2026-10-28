// Activity / audit log (US-93). Written by the Audit step of the API Gateway (gateway/audit.js),
// so feature modules do not need to know about it. Each user sees only their own entries.
//   GET /activity   the last 50 actions, newest first
const express = require('express');

function activityService({ db }) {
  return {
    async record(userId, action, detail = null) {
      await db.query('INSERT INTO activity.log (user_id, action, detail) VALUES ($1, $2, $3)', [userId, action, detail ? String(detail).slice(0, 160) : null]);
    },
    async list(userId, limit = 50) {
      const { rows } = await db.query('SELECT id, action, detail, at FROM activity.log WHERE user_id = $1 ORDER BY at DESC, id DESC LIMIT $2', [userId, limit]);
      return rows.map((r) => ({ id: Number(r.id), action: r.action, detail: r.detail, at: r.at }));
    },
    async recent(userId, hours = 24) {
      const { rows } = await db.query("SELECT id, action, detail, at FROM activity.log WHERE user_id = $1 AND at > now() - ($2 || ' hours')::interval ORDER BY at DESC", [userId, String(hours)]);
      return rows.map((r) => ({ id: Number(r.id), action: r.action, detail: r.detail, at: r.at }));
    },
    async pieceName(userId, itemId) {
      if (!/^[0-9a-f-]{36}$/i.test(itemId || '')) return null;
      const { rows } = await db.query('SELECT name, colour, category FROM wardrobe.items WHERE id = $1 AND user_id = $2', [itemId, userId]);
      return rows[0] ? rows[0].name || `${rows[0].colour} ${rows[0].category}`.toLowerCase() : null;
    },
  };
}

function registerActivity({ db }) {
  const service = activityService({ db });
  const r = express.Router();
  r.get('/', async (req, res, next) => {
    try { res.json({ activity: await service.list(req.user.id) }); } catch (e) { next(e); }
  });
  return { service, routes: r };
}

module.exports = { registerActivity };
