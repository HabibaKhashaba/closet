// Admin (US-80 accounts, US-81 system health, US-83 configuration preview, US-84 security log).
// Only reachable with role = 'admin' (Access Control: requireRole). An admin sees accounts, counts and
// account-level security events — never anyone's photos, pieces, outfits or piece names (NFR-03).
// The rules live in adminService; the data comes from a repository (PostgreSQL here, in-memory in the
// offline demo and the unit tests), so both run the same logic.
const express = require('express');
const v = require('../../shared/validate');
const { errors } = require('../../shared/errors');
const { requireRole } = require('../../gateway/accessControl');
const { counters } = require('../../gateway/errorHandler');
const vocabulary = require('../../shared/vocabulary');

const UUID = /^[0-9a-f-]{36}$/i;
const DAY = 86400000;
const { SECURITY_ACTIONS, SHOW_DETAIL } = require('./securityEvents');

function pgAdminRepository(db) {
  const one = async (sql, p) => (await db.query(sql, p)).rows[0].n;
  return {
    async ping() { await db.query('SELECT 1'); },
    async users() {
      const { rows } = await db.query(`
        SELECT u.id, u.email, u.role, u.account_status, u.created_at, u.locked_until, u.failed_logins,
               (SELECT count(*) FROM wardrobe.items i WHERE i.user_id = u.id)::int AS pieces,
               (SELECT count(*) FROM outfits.outfits o WHERE o.user_id = u.id)::int AS outfits,
               (SELECT count(*) FROM outfits.wears w WHERE w.user_id = u.id)::int AS wears,
               (SELECT count(*) FROM tryon.virtual_try_ons t WHERE t.user_id = u.id)::int AS try_ons,
               (SELECT max(a.at) FROM activity.log a WHERE a.user_id = u.id) AS last_active
          FROM accounts.users u ORDER BY u.created_at`);
      return rows;
    },
    async totals() {
      const tryOns = (await db.query('SELECT status, count(*)::int AS n FROM tryon.virtual_try_ons GROUP BY status')).rows;
      return {
        pieces: await one('SELECT count(*)::int AS n FROM wardrobe.items'),
        outfits: await one('SELECT count(*)::int AS n FROM outfits.outfits'),
        wears: await one('SELECT count(*)::int AS n FROM outfits.wears'),
        tryOns: Object.fromEntries(tryOns.map((r) => [r.status, r.n])),
        deletionReasons: (await db.query('SELECT reason, count(*)::int AS n FROM wardrobe.deletions GROUP BY reason ORDER BY n DESC')).rows,
      };
    },
    async events({ userId = null, limit = 30 } = {}) {
      const { rows } = await db.query(
        `SELECT a.user_id, u.email, a.action, a.detail, a.at FROM activity.log a JOIN accounts.users u ON u.id = a.user_id
          WHERE a.action = ANY($1) AND ($2::uuid IS NULL OR a.user_id = $2) ORDER BY a.at DESC LIMIT $3`,
        [SECURITY_ACTIONS, userId, limit],
      );
      return rows;
    },
    async setStatus(userId, status) {
      const { rows } = await db.query(
        `UPDATE accounts.users SET account_status = $2, token_version = token_version + CASE WHEN $2 = 'suspended' THEN 1 ELSE 0 END
          WHERE id = $1 RETURNING id, email, account_status`, [userId, status],
      );
      return rows[0] || null;
    },
    async unlock(userId) {
      const { rows } = await db.query('UPDATE accounts.users SET failed_logins = 0, locked_until = NULL WHERE id = $1 RETURNING id, email, account_status', [userId]);
      return rows[0] || null;
    },
  };
}

function adminService({ repo, services = {}, now = () => new Date() }) {
  const account = (r) => {
    const t = now();
    return {
      id: r.id, email: r.email, role: r.role, status: r.account_status, createdAt: r.created_at,
      locked: Boolean(r.locked_until && new Date(r.locked_until) > t), lockedUntil: r.locked_until && new Date(r.locked_until) > t ? r.locked_until : null,
      failedLogins: r.failed_logins || 0,
      pieces: r.pieces || 0, outfits: r.outfits || 0, wears: r.wears || 0, tryOns: r.try_ons || 0, lastActive: r.last_active || null,
    };
  };
  const event = (e) => ({ userId: e.user_id, email: e.email, action: e.action, at: e.at, detail: SHOW_DETAIL.has(e.action) ? e.detail || null : null });
  const find = async (userId) => {
    if (!UUID.test(String(userId))) throw errors.notFound('User');
    const r = (await repo.users()).find((x) => x.id === userId);
    if (!r) throw errors.notFound('User');
    return r;
  };
  return {
    // US-81 system health: service status only — never a user's wardrobe.
    async health() {
      const t0 = Date.now();
      let database = 'ok';
      try { await repo.ping(); } catch { database = 'down'; }
      const dbMs = Date.now() - t0;
      const env = services.env || process.env;
      const llm = env.ANTHROPIC_API_KEY ? 'Anthropic (tool calling)' : env.OPENAI_API_KEY ? 'OpenAI (tool calling)' : 'Keyword parser (no API key)';
      const provider = (env.TRYON_PROVIDER || 'none').toLowerCase();
      const tryOn = provider === 'fashn' && env.FASHN_API_KEY ? ['ok', 'FASHN (key on the server only)'] : provider === 'mock' ? ['fallback', 'Mock provider (no AI) · FASHN with the live key'] : ['not connected', 'Set TRYON_PROVIDER and FASHN_API_KEY on the server'];
      return {
        status: database === 'ok' ? 'ok' : 'degraded',
        uptimeMinutes: Math.round((Date.now() - counters.startedAt.getTime()) / 60000),
        serverErrors: counters.serverErrors,
        services: [
          { name: services.databaseName || 'PostgreSQL', status: database, detail: services.databaseDetail || `${dbMs} ms` },
          { name: 'Weather API', status: services.weatherStatus || 'ok', detail: services.weatherDetail || 'Open-Meteo, 30-minute cache, seasonal estimate as fallback' },
          { name: 'Language model', status: env.ANTHROPIC_API_KEY || env.OPENAI_API_KEY ? 'ok' : 'fallback', detail: llm },
          { name: 'Virtual Try-On Service', status: tryOn[0], detail: tryOn[1] },
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
    async users() { return (await repo.users()).map(account); },
    // One account: counts and its security events only.
    async user(userId) {
      const a = account(await find(userId));
      return { ...a, events: (await repo.events({ userId, limit: 20 })).map(event) };
    },
    // Platform overview: account health, sign-ups per week, usage totals.
    async stats() {
      const list = (await repo.users()).map(account);
      const tot = await repo.totals();
      const t = now().getTime();
      const weeks = Array.from({ length: 6 }, (_, k) => {
        const end = t - (5 - k) * 7 * DAY; const start = end - 7 * DAY;
        return { weekEnding: new Date(end).toISOString().slice(0, 10), signups: list.filter((u) => { const c = new Date(u.createdAt).getTime(); return c > start && c <= end; }).length };
      });
      const tryOns = tot.tryOns || {};
      const members = list.filter((u) => u.role === 'user').length;
      return {
        users: list.length,
        active: list.filter((u) => u.status === 'active').length,
        suspended: list.filter((u) => u.status === 'suspended').length,
        admins: list.filter((u) => u.role === 'admin').length,
        locked: list.filter((u) => u.locked).length,
        newThisWeek: list.filter((u) => t - new Date(u.createdAt).getTime() <= 7 * DAY).length,
        activeThisWeek: list.filter((u) => u.lastActive && t - new Date(u.lastActive).getTime() <= 7 * DAY).length,
        pieces: tot.pieces, outfitsSaved: tot.outfits, wears: tot.wears,
        avgPieces: members ? Math.round((tot.pieces / members) * 10) / 10 : 0,
        tryOns: { total: Object.values(tryOns).reduce((a, b) => a + b, 0), completed: tryOns.COMPLETED || 0, failed: tryOns.FAILED || 0, running: (tryOns.PENDING || 0) + (tryOns.PROCESSING || 0) },
        signupsByWeek: weeks,
        deletionReasons: tot.deletionReasons,
      };
    },
    // US-84 security log: account events across the platform (no wardrobe actions).
    async events(limit = 30) { return (await repo.events({ limit: Math.min(Math.max(Number(limit) || 30, 1), 100) })).map(event); },
    // Suspending also ends every session: the token version goes up.
    async setStatus(adminId, userId, status) {
      const u = await find(userId);
      if (userId === adminId) throw errors.conflict('SELF', 'You cannot suspend your own account.');
      if (u.role === 'admin' && status === 'suspended') throw errors.conflict('ADMIN', 'An admin account cannot be suspended here.');
      const r = await repo.setStatus(userId, status);
      return { id: r.id, email: r.email, status: r.account_status };
    },
    // After five wrong passwords an account is locked for 15 minutes; an admin can lift it early.
    async unlock(userId) {
      await find(userId);
      const r = await repo.unlock(userId);
      return { id: r.id, email: r.email, status: r.account_status, locked: false };
    },
  };
}

function registerAdmin({ db, repo, services }) {
  const service = adminService({ repo: repo || pgAdminRepository(db), services });
  const r = express.Router();
  r.use(requireRole('admin'));
  const h = (fn) => async (req, res, next) => { try { res.json(await fn(req)); } catch (e) { next(e); } };
  r.get('/users', h(async () => ({ users: await service.users() })));
  r.get('/users/:id', h((req) => service.user(req.params.id)));
  r.get('/health', h(() => service.health()));
  r.get('/config', (_req, res) => res.json(service.config()));
  r.get('/stats', h(() => service.stats()));
  r.get('/events', h(async (req) => ({ events: await service.events(req.query.limit) })));
  r.patch('/users/:id', v.body({ status: { type: 'enum', values: ['active', 'suspended'], required: true } }), h((req) => service.setStatus(req.user.id, req.params.id, req.valid.status)));
  r.post('/users/:id/unlock', h((req) => service.unlock(req.params.id)));
  return { service, routes: r };
}

module.exports = { registerAdmin, adminService, pgAdminRepository, SECURITY_ACTIONS };
