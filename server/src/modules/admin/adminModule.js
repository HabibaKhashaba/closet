// Admin (Sprint 3 early start, US-80): an admin can see accounts and suspend or restore one.
// Only reachable with role = 'admin' (Access Control: requireRole). An admin never sees
// anyone's photos or pieces — only counts — so the privacy promise (NFR-03) still holds.
const express = require('express');
const v = require('../../shared/validate');
const { errors } = require('../../shared/errors');
const { requireRole } = require('../../gateway/accessControl');
const { counters } = require('../../gateway/errorHandler');
const vocabulary = require('../../shared/vocabulary');

const UUID = /^[0-9a-f-]{36}$/i;

function adminService({ db, services = {} }) {
  return {
    // US-81 system health: totals and service status only — never a user's wardrobe.
    async health() {
      const t0 = Date.now();
      let database = 'ok';
      try { await db.query('SELECT 1'); } catch { database = 'down'; }
      const dbMs = Date.now() - t0;
      const env = services.env || process.env;
      const llm = env.ANTHROPIC_API_KEY ? 'Anthropic (tool calling)' : env.OPENAI_API_KEY ? 'OpenAI (tool calling)' : 'Keyword parser (no API key)';
      return {
        status: database === 'ok' ? 'ok' : 'degraded',
        uptimeMinutes: Math.round((Date.now() - counters.startedAt.getTime()) / 60000),
        serverErrors: counters.serverErrors,
        services: [
          { name: 'PostgreSQL', status: database, detail: `${dbMs} ms` },
          { name: 'Weather API', status: 'ok', detail: 'Open-Meteo, 30-minute cache, seasonal estimate as fallback' },
          { name: 'Language model', status: env.ANTHROPIC_API_KEY || env.OPENAI_API_KEY ? 'ok' : 'fallback', detail: llm },
          { name: 'Virtual Try-On Service', status: 'not connected', detail: 'Stylised avatar drawn in the app' },
          { name: 'Notification Service', status: 'not connected', detail: 'In-app Notification Center' },
        ],
      };
    },
    // US-83 (read-only preview): the lists every module shares.
    config() {
      return {
        categories: vocabulary.CATEGORIES, statuses: vocabulary.STATUSES, dressCodes: vocabulary.DRESS_CODES,
        occasions: Object.keys(vocabulary.OCCASIONS), templates: vocabulary.OCCASION_TEMPLATES.map((t) => t.label),
        switches: [{ key: 'ask-closet', label: 'Ask Closet chat', on: true }, { key: 'auto-return', label: 'Laundry auto-return', on: true }],
        editable: false,
      };
    },
    async users() {
      const { rows } = await db.query(`
        SELECT u.id, u.email, u.role, u.account_status, u.created_at, u.locked_until,
               (SELECT count(*) FROM wardrobe.items i WHERE i.user_id = u.id)::int AS pieces,
               (SELECT max(w.worn_on) FROM outfits.wears w WHERE w.user_id = u.id) AS last_worn
          FROM accounts.users u ORDER BY u.created_at`);
      return rows.map((r) => ({ id: r.id, email: r.email, role: r.role, status: r.account_status, createdAt: r.created_at, locked: Boolean(r.locked_until && r.locked_until > new Date()), pieces: r.pieces, lastActive: r.last_worn }));
    },
    async stats() {
      const one = async (sql) => (await db.query(sql)).rows[0].n;
      const reasons = (await db.query('SELECT reason, count(*)::int AS n FROM wardrobe.deletions GROUP BY reason ORDER BY n DESC')).rows;
      return {
        users: await one('SELECT count(*)::int AS n FROM accounts.users'),
        suspended: await one("SELECT count(*)::int AS n FROM accounts.users WHERE account_status = 'suspended'"),
        pieces: await one('SELECT count(*)::int AS n FROM wardrobe.items'),
        outfitsSaved: await one('SELECT count(*)::int AS n FROM outfits.outfits'),
        wears: await one('SELECT count(*)::int AS n FROM outfits.wears'),
        deletionReasons: reasons,
      };
    },
    // Suspending also ends every session: the token version goes up.
    async setStatus(adminId, userId, status) {
      if (!UUID.test(userId)) throw errors.notFound('User');
      if (userId === adminId) throw errors.conflict('SELF', 'You cannot suspend your own account.');
      const { rows } = await db.query(
        `UPDATE accounts.users SET account_status = $2, token_version = token_version + CASE WHEN $2 = 'suspended' THEN 1 ELSE 0 END
          WHERE id = $1 RETURNING id, email, account_status`, [userId, status],
      );
      if (!rows[0]) throw errors.notFound('User');
      return { id: rows[0].id, email: rows[0].email, status: rows[0].account_status };
    },
  };
}

function registerAdmin({ db, services }) {
  const service = adminService({ db, services });
  const r = express.Router();
  r.use(requireRole('admin'));
  r.get('/users', async (_req, res, next) => {
    try { res.json({ users: await service.users() }); } catch (e) { next(e); }
  });
  r.get('/health', async (_req, res, next) => {
    try { res.json(await service.health()); } catch (e) { next(e); }
  });
  r.get('/config', (_req, res) => res.json(service.config()));
  r.get('/stats', async (_req, res, next) => {
    try { res.json(await service.stats()); } catch (e) { next(e); }
  });
  r.patch('/users/:id', v.body({ status: { type: 'enum', values: ['active', 'suspended'], required: true } }), async (req, res, next) => {
    try { res.json(await service.setStatus(req.user.id, req.params.id, req.valid.status)); } catch (e) { next(e); }
  });
  return { service, routes: r };
}

module.exports = { registerAdmin };
