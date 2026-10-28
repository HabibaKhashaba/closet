// Offline demo backend (v1.5). Replaces the old "recorded responses" replay (defect D-13).
// It runs Closet's REAL services and domain rules — buildModules() from server/src/app.js — on the
// in-memory repositories (server/src/db/memoryRepositories.js), seeded from the same deterministic
// seed data as `npm run seed`. fetch('/api/v1/...') is answered here, so every mutation changes the
// in-memory state and every later GET returns the new state. Nothing is stored outside this tab.
// Differences from the live server (honest list, also shown on screen):
//   · sign-in is local: only the seeded demo account, no password hashing or JWT (server-side features)
//   · photos are embedded images; a new photo stays in this tab only
//   · weather is the deterministic seasonal estimate; Ask Closet uses the keyword parser (no API key)
const { buildModules } = require('../../server/src/app');
const { memoryRepositories, createMemoryStore, serializeStore, restoreStore } = require('../../server/src/db/memoryRepositories');
const seed = require('../../server/src/db/seedData');
const vocabulary = require('../../server/src/shared/vocabulary');
const { ALLOWED: STATUS_TRANSITIONS } = require('../../server/src/modules/availability/statusMachine');
const { weatherAdapter } = require('../../server/src/modules/recommendation/weatherAdapter');
const { llmAdapter } = require('../../server/src/modules/assistant/llmAdapter');
const { TOPICS } = require('../../server/src/events/eventBus');
const v = require('../../server/src/shared/validate');
const { AppError } = require('../../server/src/shared/errors');
const { detailsSchema, editSchema } = require('../../server/src/modules/wardrobe/wardrobeModule');
const { optionsSchema } = require('../../server/src/modules/recommendation/recommendationModule');
const { eventSchema } = require('../../server/src/modules/planner/plannerModule');
const { tripSchema } = require('../../server/src/modules/packing/packingModule');
const { settingsSchema, profileSchema } = require('../../server/src/modules/profile/profileModule');

const PHOTOS = (typeof window !== 'undefined' && window.__CLOSET_PHOTOS__) || {};
const DAY = 86400000;
const USER = { id: '00000000-0000-4000-8000-00000000d3e0', email: seed.EMAIL, role: 'user' };
const TOKEN = 'offline-demo-session';

function createLocalApi({ saved = null, persist = () => {} } = {}) {
  const repos = memoryRepositories(saved ? restoreStore(saved) : createMemoryStore());
  const S = repos.store;
  const storage = {
    async save(buffer, mime) { const key = `local-${Object.keys(PHOTOS).length}`; PHOTOS[key] = buffer; return key; },
    async remove() {}, signedUrl: (key) => PHOTOS[key] || '', verify: () => false, filePath: () => '',
  };
  const m = buildModules({ repos: { ...repos, identity: false, admin: false }, storage, weather: weatherAdapter({ mode: 'estimate' }), parser: llmAdapter({ env: {} }) });
  const uid = USER.id;

  // ---------- deterministic seed through the same services (data: server/src/db/seedData.js) ----------
  async function applySeed() {
    S.users.push({ ...USER });
    await m.bus.publish(TOPICS.UserRegistered, { userId: uid });
    await m.profile.service.saveQuiz(uid, { styles: ['Chic', 'Classic', 'Minimal'], colours: ['Beige', 'Navy', 'Black', 'White'], occasions: ['University', 'Work', 'Dinner', 'Wedding'], dressCode: 2, modest: false, city: 'Cairo' });
    await m.profile.service.update(uid, { displayName: 'Habiba', laundryDays: 2, laundryAutoReturn: true, laundryWeekday: 4, repeatDays: 3, reminders: true, reminderHour: 20 });
    const add = async (file, name, d) => {
      const row = await repos.wardrobe.create(uid, file, { ...v.validate(detailsSchema, d), name });
      await m.bus.publish(TOPICS.ItemCreated, { userId: uid, itemId: row.id });
      return S.items.find((x) => x.id === row.id);
    };
    for (const [file, name, d, worn, reason] of seed.REMOVED) { const r = await add(file, name, d); r.wear_count = worn; await m.wardrobe.service.deletePiece(uid, r.id, reason); }
    const ids = {};
    for (const [file, name, d, worn, lastDays] of seed.PIECES) {
      const r = await add(file, name, d); ids[file] = r.id;
      r.wear_count = worn; r.last_worn_at = worn && lastDays !== null ? new Date(Date.now() - lastDays * DAY) : null; r.created_at = new Date(Date.now() - 400 * DAY);
    }
    for (const [file, status, daysAgo, until, note] of seed.STATUSES) {
      await m.availability.service.setStatus(uid, ids[file], status, { ...(until > 0 && { until: seed.inDays(until) }), ...(note && { note }) });
      const st = S.status.get(ids[file]); st.changed_at = new Date(Date.now() - daysAgo * DAY); if (until < 0) st.until = seed.inDays(until);
    }
    for (const [d, files, rating, occasion, tempC, condition, eventTitle] of seed.WEARS) {
      await repos.outfits.wear(uid, files.map((f) => ids[f]), seed.inDays(-d), rating, { occasion, tempC, condition, eventTitle });
    }
    for (const [file, price] of Object.entries(seed.PRICES)) await m.wardrobe.service.editPiece(uid, ids[file], { price, currency: 'EGP' });
    const save = (files, o) => m.outfits.service.save(uid, { itemIds: files.map((f) => ids[f]), ...o });
    await save(['ivory_silk_blouse', 'black_tailored_trousers', 'navy_blazer', 'black_loafers'], { occasion: 'Work', ruleScore: 100, favorite: true, reasons: ['Every piece suits Business Casual for work.', 'Colours: all neutral colours.', 'The navy blazer adds structure without feeling stiff.'] });
    await save(['breton_striped_top', 'beige_wide_leg_trousers', 'white_sneakers', 'tan_leather_tote'], { occasion: 'University', ruleScore: 100, favorite: true, reasons: ['Every piece suits Casual for university.', 'Colours: neutrals with navy stripes.', 'Comfortable for a long campus day.'] });
    await save(['navy_silk_midi_dress', 'nude_heels', 'structured_black_bag', 'gold_hoop_earrings'], { occasion: 'Wedding', ruleScore: 100, reasons: ['Every piece suits Formal for a wedding.', 'Silk and gold read as evening wear.'] });
    await save(['blue_oxford_shirt', 'light_wash_jeans', 'white_sneakers', 'tortoise_sunglasses'], { occasion: 'Everyday', ruleScore: 100, source: 'built', reasons: ['Built in Mix & Match.'] });
    for (const e of seed.EVENTS) {
      const ev = await m.planner.service.add(uid, { title: e.title, date: e.date, time: e.time, occasion: e.occasion });
      if (e.plan) await m.planner.service.plan(uid, ev.id, { itemIds: e.plan.map((f) => ids[f]), ruleScore: 100, reasons: e.reasons });
      if (e.plannedWeather) { const row = S.events.find((x) => x.id === ev.id); row.planned_temp_c = e.plannedWeather.tempC; row.planned_condition = e.plannedWeather.condition; }
    }
    for (const [d, files, reason] of seed.REJECTS) S.feedback.push({ user_id: uid, kind: 'reject', item_ids: files.map((f) => ids[f]), reason, created_at: new Date(Date.now() - d * DAY) });
    await m.packing.service.save(uid, { destination: 'Paris', startDate: seed.inDays(12), endDate: seed.inDays(15), tripType: 'Travel', activities: ['Travel', 'Dinner', 'Everyday'] });
    S.activity.length = 0; // the seed is not the user's activity
    return ids;
  }
  const ready = saved ? Promise.resolve() : applySeed();

  // ---------- routes: the same endpoints as the server, calling the same services ----------
  const sv = () => ({ wardrobe: m.wardrobe.service, availability: m.availability.service, outfits: m.outfits.service, rec: m.rec.service, planner: m.planner.service, shopping: m.shopping.service, intel: m.intelligence.service, pro: m.intelligence.service.proactive, packing: m.packing.service, assistant: m.assistant.service, profile: m.profile.service, activity: m.activity.service });
  const ids = (x, min, max) => { if (!Array.isArray(x) || x.length < min || x.length > max) throw new AppError(400, 'VALIDATION', `itemIds must be ${min}–${max} piece ids`, [{ field: 'itemIds' }]); return x; };
  const R = [];
  const route = (method, pattern, fn) => R.push({ method, re: new RegExp(`^${pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)')}$`), fn });
  route('GET', '/health', () => ({ status: 'ok', mode: 'offline demo' }));
  route('GET', '/vocabulary', () => ({ ...vocabulary, STATUS_TRANSITIONS }));
  route('POST', '/auth/login', ({ body }) => {
    const email = String(body.email || '').trim().toLowerCase();
    if (email !== seed.EMAIL || body.password !== seed.PASSWORD) throw new AppError(401, 'BAD_LOGIN', 'Offline demo: sign in with demo@closet.app / Closet2026!');
    return { token: TOKEN, user: USER };
  });
  route('POST', '/auth/register', () => { throw new AppError(403, 'OFFLINE', 'The offline demo uses the seeded demo account. Registration needs the live server.'); });
  route('POST', '/auth/google', () => { throw new AppError(403, 'OFFLINE', 'Google sign-in needs the live server.'); });
  route('POST', '/auth/logout', () => null);
  route('GET', '/auth/me', () => ({ user: USER }));
  route('GET', '/profile', () => sv().profile.get(uid));
  route('PUT', '/profile/quiz', ({ body }) => sv().profile.saveQuiz(uid, v.validate(profileSchema, body)));
  route('PUT', '/profile', ({ body }) => sv().profile.update(uid, v.validate(settingsSchema, body)));
  // wardrobe
  route('GET', '/items', ({ query }) => sv().wardrobe.browse(uid, { category: query.category || undefined, status: query.status || undefined }));
  route('POST', '/items/similar', ({ body }) => sv().wardrobe.similar(uid, body));
  route('POST', '/items', async ({ body }) => {
    const details = v.validate(detailsSchema, JSON.parse(body.details || '{}'));
    const key = await storage.save(body.photo, 'image/*');
    const row = await repos.wardrobe.create(uid, key, details);
    await m.bus.publish(TOPICS.ItemCreated, { userId: uid, itemId: row.id });
    return sv().wardrobe.getPiece(uid, row.id);
  });
  route('GET', '/items/:id', ({ p }) => sv().wardrobe.getPiece(uid, p.id));
  route('PATCH', '/items/:id', ({ p, body }) => { const c = v.validate(editSchema, body); for (const f of ['fabric', 'season', 'size', 'name', 'price', 'currency', 'purchaseDate']) if (body[f] === null || body[f] === '') c[f] = null; return sv().wardrobe.editPiece(uid, p.id, c); });
  route('DELETE', '/items/:id', ({ p, body }) => sv().wardrobe.deletePiece(uid, p.id, v.validate({ reason: { type: 'enum', values: vocabulary.DELETE_REASONS, required: true, label: 'Reason' } }, body).reason, body.note));
  route('PATCH', '/items/:id/status', ({ p, body }) => sv().availability.setStatus(uid, p.id, v.validate({ status: { type: 'enum', values: vocabulary.STATUSES, required: true }, until: { type: 'date' }, note: { type: 'string', max: 60 } }, body).status, body));
  route('POST', '/items/:id/hide', ({ p }) => sv().outfits.hide(uid, p.id, 7));
  route('DELETE', '/items/:id/hide', ({ p }) => sv().outfits.unhide(uid, p.id));
  route('POST', '/items/:id/rehome', ({ p, body }) => sv().wardrobe.startRehome(uid, p.id, v.validate({ method: { type: 'enum', values: Object.keys(vocabulary.REHOME_METHODS), required: true } }, body).method));
  route('DELETE', '/items/:id/rehome', ({ p }) => sv().wardrobe.cancelRehome(uid, p.id));
  route('POST', '/items/:id/rehome/done', ({ p }) => sv().wardrobe.completeRehome(uid, p.id));
  route('GET', '/laundry', async () => { const s = sv(); const lids = await s.availability.laundryIds(uid); const pieces = (await s.wardrobe.allPieces(uid)).filter((x) => lids.includes(x.id)); const st = await s.availability.settings(uid); return { items: pieces, count: pieces.length, laundryDays: st.laundryDays, autoReturn: st.autoReturn, laundryWeekday: st.laundryWeekday }; });
  route('POST', '/laundry/wash-done', () => sv().availability.washDone(uid));
  route('GET', '/closet/gaps', () => sv().wardrobe.gaps(uid));
  // planner
  route('GET', '/events/calendar', ({ query }) => sv().planner.calendar(uid, query.month));
  route('GET', '/events/reminders', () => sv().planner.reminders(uid));
  route('GET', '/events/upcoming', async () => ({ events: await sv().planner.upcoming(uid, 14) }));
  route('POST', '/events/import', ({ body }) => sv().planner.importIcs(uid, body.ics || ''));
  route('GET', '/events', async ({ query }) => ({ events: await sv().planner.month(uid, query.month) }));
  route('POST', '/events', ({ body }) => sv().planner.add(uid, v.validate(eventSchema, body)));
  route('PATCH', '/events/:id', ({ p, body }) => sv().planner.edit(uid, p.id, body));
  route('DELETE', '/events/:id', ({ p }) => sv().planner.remove(uid, p.id));
  route('POST', '/events/:id/recommend', ({ p }) => sv().planner.recommendFor(uid, p.id));
  route('PUT', '/events/:id/outfit', ({ p, body }) => sv().planner.plan(uid, p.id, { itemIds: ids(body.itemIds, 2, 4), ruleScore: body.ruleScore ?? null, reasons: body.reasons || [] }));
  route('DELETE', '/events/:id/outfit', ({ p }) => sv().planner.unplan(uid, p.id));
  // recommendations
  route('GET', '/weather', ({ query }) => sv().rec.weather(uid, query.date));
  route('POST', '/recommendations', ({ body }) => sv().rec.recommend(uid, { ...v.validate({ ...optionsSchema, occasion: { ...optionsSchema.occasion, required: true } }, body), fixedId: body.fixedId }));
  route('POST', '/recommendations/swap', ({ body }) => sv().rec.swap(uid, { ...v.validate({ ...optionsSchema, slot: { type: 'int', min: 0, max: 3, required: true } }, body), itemIds: ids(body.itemIds, 2, 4) }));
  route('POST', '/recommendations/check', ({ body }) => sv().rec.check(uid, { ...v.validate(optionsSchema, body), itemIds: ids(body.itemIds, 1, 4) }));
  // outfits
  route('GET', '/outfits', async ({ query }) => ({ outfits: await sv().outfits.list(uid, query.favorites === 'true') }));
  route('POST', '/outfits', ({ body }) => sv().outfits.save(uid, { ...body, itemIds: ids(body.itemIds, 2, 4), reasons: (body.reasons || []).slice(0, 6) }));
  route('PATCH', '/outfits/:id', ({ p, body }) => sv().outfits.favorite(uid, p.id, Boolean(body.favorite)));
  route('DELETE', '/outfits/:id', ({ p }) => sv().outfits.remove(uid, p.id));
  route('POST', '/outfits/wear', ({ body }) => { const { rating, itemIds, ...ctx } = body; return sv().outfits.wear(uid, ids(itemIds, 2, 4), rating, ctx); });
  route('GET', '/outfits/history', ({ query }) => sv().outfits.history(uid, { ...query, minRating: query.minRating ? Number(query.minRating) : null }));
  route('PATCH', '/outfits/wears/:id', ({ p, body }) => sv().outfits.rate(uid, Number(p.id), body.rating));
  route('POST', '/outfits/reject', ({ body }) => sv().outfits.reject(uid, ids(body.itemIds, 2, 4), body.reason));
  route('GET', '/insights', () => sv().outfits.insights(uid));
  // Ask Closet
  route('GET', '/chat', () => ({ suggestions: [], languageModel: 'keyword parser' }));
  route('POST', '/chat', ({ body }) => sv().assistant.chat(uid, { message: String(body.message || '').slice(0, 500), context: body.context || null, pieceId: body.pieceId }));
  route('POST', '/chat/undo/:id', ({ p }) => sv().assistant.undo(uid, p.id));
  // shopping
  route('GET', '/shopping/list', () => sv().shopping.list(uid));
  route('POST', '/shopping/list', ({ body }) => sv().shopping.addToList(uid, body));
  route('PATCH', '/shopping/list/:id', ({ p, body }) => sv().shopping.setListStatus(uid, p.id, body.status));
  route('DELETE', '/shopping/list/:id', ({ p }) => sv().shopping.removeFromList(uid, p.id));
  route('POST', '/shopping/check', ({ body }) => sv().shopping.check(uid, body));
  route('POST', '/shopping/impact', ({ body }) => sv().shopping.impact(uid, body));
  route('GET', '/shopping', () => sv().shopping.suggestions(uid));
  route('PUT', '/shopping/:key', ({ p, body }) => sv().shopping.decide(uid, p.key, body.state));
  route('DELETE', '/shopping/:key', ({ p }) => sv().shopping.undecide(uid, p.key));
  // intelligence
  route('GET', '/intelligence/health', () => sv().intel.health(uid));
  route('GET', '/intelligence/learned', () => sv().intel.learned(uid));
  route('POST', '/intelligence/learned/:key', ({ p, body }) => sv().intel.decide(uid, p.key, body.decision));
  route('DELETE', '/intelligence/learned/:key', ({ p }) => sv().intel.undo(uid, p.key));
  route('GET', '/intelligence/conflicts', () => sv().intel.conflicts(uid));
  route('POST', '/intelligence/conflicts/:eventId/fix', ({ p, body }) => sv().intel.fix(uid, p.eventId, body.itemId));
  route('GET', '/intelligence/forgotten', () => sv().pro.forgotten(uid));
  route('POST', '/intelligence/forgotten/:itemId/keep', ({ p, body }) => sv().pro.keep(uid, p.itemId, body));
  route('GET', '/intelligence/seasonal', () => sv().pro.seasonal(uid));
  route('POST', '/intelligence/seasonal', ({ body }) => sv().pro.applySeasonal(uid, body));
  route('GET', '/intelligence/laundry-risk', () => sv().pro.laundryRisk(uid));
  route('POST', '/intelligence/plan-days', ({ body }) => sv().pro.planDays(uid, body));
  route('GET', '/intelligence/monitor', () => sv().pro.monitor(uid));
  route('POST', '/intelligence/monitor/ignore', ({ body }) => sv().pro.ignore(uid, body.key));
  route('POST', '/intelligence/monitor/:eventId/adjust', ({ p, body }) => sv().pro.adjust(uid, p.eventId, body.itemId));
  route('GET', '/intelligence/borrowed', () => sv().pro.borrowed(uid));
  route('POST', '/intelligence/borrowed/:itemId/remind', ({ p, body }) => sv().pro.remindLater(uid, p.itemId, body.days));
  route('GET', '/intelligence/value', () => sv().pro.value(uid));
  route('GET', '/intelligence/memory', ({ query }) => sv().pro.memory(uid, { q: query.q, best: query.best === 'true' }));
  route('POST', '/intelligence/repeat', ({ body }) => sv().pro.repeat(uid, ids(body.itemIds, 2, 4)));
  route('GET', '/intelligence/gaps', () => sv().pro.gaps(uid));
  route('GET', '/notifications', () => sv().intel.notifications(uid));
  route('POST', '/notifications/read', ({ body }) => sv().intel.markRead(uid, (body.keys || []).slice(0, 50)));
  // packing, activity
  route('POST', '/packing/plan', ({ body }) => sv().packing.plan(uid, { ...v.validate(tripSchema, body), exclude: body.exclude || [] }));
  route('GET', '/packing/trips', async () => ({ trips: await sv().packing.trips(uid) }));
  route('POST', '/packing/trips', ({ body }) => sv().packing.save(uid, { ...v.validate(tripSchema, body), exclude: body.exclude || [] }));
  route('POST', '/packing/trips/:id/pack', ({ p }) => sv().packing.pack(uid, p.id));
  route('POST', '/packing/trips/:id/unpack', ({ p }) => sv().packing.unpack(uid, p.id));
  route('DELETE', '/packing/trips/:id', ({ p }) => sv().packing.remove(uid, p.id));
  route('GET', '/activity', async () => ({ activity: await sv().activity.list(uid) }));

  // Activity log, as the server's audit step would write it (a subset of gateway/audit.js RULES).
  const AUDIT = [[/^POST \/laundry\/wash-done$/, 'Wash done'], [/^PATCH \/items\/[^/]+\/status$/, 'Status changed'], [/^POST \/outfits\/wear$/, 'Outfit worn'], [/^DELETE \/items\/[^/]+$/, 'Piece deleted'], [/^POST \/shopping\/list$/, 'Added to shopping list']];

  async function handle(method, url, body, authorization) {
    await ready;
    const [path, qs] = url.split('?');
    const query = Object.fromEntries(new URLSearchParams(qs || ''));
    const hit = R.find((r) => r.method === method && r.re.test(path));
    if (!hit) return { status: 404, data: { error: 'NOT_FOUND', message: 'No such endpoint in the offline demo.' } };
    const open = path === '/auth/login' || path === '/auth/register' || path === '/auth/google' || path === '/vocabulary' || path === '/health';
    if (!open && authorization !== `Bearer ${TOKEN}`) return { status: 401, data: { error: 'UNAUTHORIZED', message: 'Please sign in.' } };
    try {
      const data = await hit.fn({ p: path.match(hit.re).groups || {}, body: body || {}, query });
      const a = AUDIT.find(([re]) => re.test(`${method} ${path}`));
      if (a) await sv().activity.record(uid, a[1], null);
      if (method !== 'GET') persist(serializeStore(S));
      return { status: data === null || data === undefined ? 204 : method === 'POST' && /^\/(items|events|outfits\/wear|packing\/trips)$/.test(path) ? 201 : 200, data };
    } catch (e) {
      if (e instanceof AppError || (e && e.status)) return { status: e.status, data: { error: e.code, message: e.message, details: e.details } };
      console.error(e); // eslint-disable-line no-console
      return { status: 500, data: { error: 'INTERNAL_ERROR', message: 'Something went wrong in the offline demo.' } };
    }
  }
  return { handle, ready, store: S, modules: m };
}

module.exports = { createLocalApi, TOKEN, USER };
