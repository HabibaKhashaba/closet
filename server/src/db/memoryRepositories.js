// In-memory implementations of every repository interface (same methods, same row shapes as the
// PostgreSQL repositories). Used by the offline demo (tools/offline_demo), so the offline build runs the
// SAME services and domain rules as the server — only storage differs. State lives in one object and
// every mutation changes it, so a GET after a mutation returns the new state.
// Not a database: no SQL, no persistence beyond the page (the offline demo says so on screen).

const DAY = 86400000;
const iso = (d) => new Date(d).toISOString().slice(0, 10);
const now = () => new Date();
const clone = (x) => (x === undefined ? x : JSON.parse(JSON.stringify(x), (k, v) => (typeof v === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d/.test(v) ? new Date(v) : v)));
const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

function createMemoryStore() {
  return {
    users: [], profiles: new Map(), items: [], careJobs: [], loans: [], deletions: [], status: new Map(), history: [],
    outfits: [], wears: [], feedback: [], hidden: [], events: [], actions: [], decisions: [], listItems: [],
    learned: [], read: [], snoozes: [], activity: [], trips: [], seq: { wear: 0, activity: 0, history: 0, deletion: 0, job: 0, loan: 0 },
  };
}

function memoryRepositories(S = createMemoryStore()) {
  // deterministic ids, continued after a restore (the counter lives in the store)
  const uuid = () => { S.seq.uuid = (S.seq.uuid || 0) + 1; return `00000000-0000-4000-8000-${String(S.seq.uuid).padStart(12, '0')}`; };
  const itemRow = (r) => (r ? { ...r } : null);
  const day = () => iso(Date.now());
  const own = (list, userId, id) => list.find((x) => x.id === id && x.user_id === userId) || null;

  const profile = {
    async createDefault(userId) {
      if (!S.profiles.has(userId)) S.profiles.set(userId, { user_id: userId, styles: [], colours: [], occasions: [], dress_code: 1, modest: false, city: null, quiz_completed_at: null, display_name: null, laundry_days: 2, laundry_auto_return: true, laundry_weekday: null, repeat_days: 3, reminders: true, reminder_hour: 20, avoid_styles: [], allow_repeats: false });
    },
    async get(userId) { return S.profiles.has(userId) ? { ...S.profiles.get(userId) } : null; },
    async update(userId, p, completeQuiz) {
      const r = S.profiles.get(userId);
      const set = (col, v) => { if (v !== undefined && v !== null) r[col] = v; };
      set('styles', p.styles); set('colours', p.colours); set('occasions', p.occasions); set('dress_code', p.dressCode); set('modest', p.modest);
      if ('city' in p) r.city = p.city ?? null;
      if (completeQuiz && !r.quiz_completed_at) r.quiz_completed_at = now();
      set('display_name', p.displayName); set('laundry_days', p.laundryDays); set('laundry_auto_return', p.laundryAutoReturn);
      if ('laundryWeekday' in p) r.laundry_weekday = p.laundryWeekday ?? null;
      set('repeat_days', p.repeatDays); set('reminders', p.reminders); set('reminder_hour', p.reminderHour); set('avoid_styles', p.avoidStyles); set('allow_repeats', p.allowRepeats);
      return { ...r };
    },
  };

  const wardrobe = {
    async create(userId, photoKey, d) {
      const r = { id: uuid(), user_id: userId, photo_key: photoKey, category: d.category, colour: d.colour, fabric: d.fabric || null, season: d.season || null, size: d.size || null, styles: d.styles || [], dress_codes: d.dressCodes, modest: d.modest || false, name: d.name ? d.name.trim() : null,
        price: d.price ?? null, currency: d.price !== undefined && d.price !== null ? (d.currency || 'EGP') : null, purchase_date: d.purchaseDate || null, wear_count: 0, last_worn_at: null, created_at: now(), updated_at: now() };
      S.items.push(r);
      return itemRow({ ...r });
    },
    async list(userId, category) { return S.items.filter((r) => r.user_id === userId && (!category || r.category === category)).sort((a, b) => b.created_at - a.created_at).map((r) => itemRow({ ...r })); },
    async get(userId, id) { return itemRow(own(S.items, userId, id) && { ...own(S.items, userId, id) }); },
    async update(userId, id, d) {
      const r = own(S.items, userId, id); if (!r) return null;
      for (const [k, col] of [['category', 'category'], ['colour', 'colour'], ['styles', 'styles'], ['dressCodes', 'dress_codes'], ['modest', 'modest']]) if (d[k] !== undefined && d[k] !== null) r[col] = d[k];
      for (const k of ['fabric', 'season', 'size']) if (k in d) r[k] = d[k] ?? null;
      if ('name' in d) r.name = d.name ? d.name.trim() : null;
      if ('price' in d) { r.price = d.price ?? null; if (r.price === null) r.currency = null; else if (!r.currency) r.currency = 'EGP'; }
      if ('currency' in d && d.currency && r.price !== null) r.currency = d.currency;
      if ('purchaseDate' in d) r.purchase_date = d.purchaseDate ?? null;
      r.updated_at = now();
      return this.get(userId, id);
    },
    async recordWear(userId, ids, day) {
      for (const r of S.items.filter((x) => x.user_id === userId && ids.includes(x.id))) {
        r.wear_count += 1;
        const d = new Date(`${day}T00:00:00`);
        r.last_worn_at = !r.last_worn_at || d > r.last_worn_at ? d : r.last_worn_at;
      }
    },
    async remove(userId, id, reason, note) {
      const r = own(S.items, userId, id); if (!r) return null;
      S.items = S.items.filter((x) => x !== r); S.status.delete(id); S.careJobs = S.careJobs.filter((j) => j.item_id !== id); S.loans = S.loans.filter((l) => l.item_id !== id); S.hidden = S.hidden.filter((h) => h.item_id !== id);
      S.seq.deletion += 1;
      S.deletions.unshift({ id: S.seq.deletion, user_id: userId, name: r.name, category: r.category, colour: r.colour, wear_count: r.wear_count, reason, note: note || null, styles: r.styles || [], dress_codes: r.dress_codes || [], fabric: r.fabric || null, deleted_at: now() });
      return { ...r };
    },
    async deletions(userId) { return S.deletions.filter((d) => d.user_id === userId).map((d) => ({ name: d.name, category: d.category, colour: d.colour, wearCount: d.wear_count, reason: d.reason, note: d.note, styles: d.styles, dressCodes: d.dress_codes, fabric: d.fabric, deletedAt: d.deleted_at })); },
    async photoKeys(userId) { return S.items.filter((r) => r.user_id === userId).map((r) => r.photo_key); },
  };

  const availability = {
    // Care jobs and loans (same row shapes as availability.care_jobs / availability.loans)
    async openJob(userId, itemId, kind, reason, notes) {
      if (S.careJobs.some((j) => j.item_id === itemId && !j.closed_on)) return;
      S.seq.job = (S.seq.job || 0) + 1;
      S.careJobs.unshift({ id: S.seq.job, item_id: itemId, user_id: userId, kind, reason, notes: notes || null, tailor: null, sent_on: null, expected_back: null, cost: null, closed_on: null, outcome: null, created_at: now() });
    },
    async updateJob(userId, itemId, d) {
      const j = S.careJobs.find((x) => x.item_id === itemId && x.user_id === userId && !x.closed_on); if (!j) return;
      for (const [k, col] of [['tailor', 'tailor'], ['sentOn', 'sent_on'], ['expectedBack', 'expected_back'], ['cost', 'cost'], ['kind', 'kind'], ['reason', 'reason'], ['notes', 'notes']]) if (d[k] !== undefined && d[k] !== null) j[col] = d[k];
    },
    async closeJob(userId, itemId, outcome, on) {
      const j = S.careJobs.find((x) => x.item_id === itemId && x.user_id === userId && !x.closed_on); if (j) Object.assign(j, { closed_on: on || day(), outcome });
    },
    async jobs(userId) { return S.careJobs.filter((j) => j.user_id === userId).map((j) => ({ ...j })); },
    async openLoan(userId, itemId, person, lentOn, dueOn, note) {
      if (S.loans.some((l) => l.item_id === itemId && !l.returned_on)) return;
      S.seq.loan = (S.seq.loan || 0) + 1;
      S.loans.unshift({ id: S.seq.loan, item_id: itemId, user_id: userId, person, lent_on: lentOn || day(), due_on: dueOn || null, note: note || null, returned_on: null, created_at: now() });
    },
    async closeLoan(userId, itemId, on) {
      const l = S.loans.find((x) => x.item_id === itemId && x.user_id === userId && !x.returned_on); if (l) l.returned_on = on || day();
    },
    async loans(userId) { return S.loans.filter((l) => l.user_id === userId).sort((a, b) => String(b.lent_on).localeCompare(String(a.lent_on)) || b.id - a.id).map((l) => ({ ...l })); },
    async init(userId, itemId) { if (!S.status.has(itemId)) S.status.set(itemId, { item_id: itemId, user_id: userId, status: 'Available', changed_at: now(), until: null, note: null }); },
    async all(userId) { return [...S.status.values()].filter((r) => r.user_id === userId).map((r) => ({ ...r })); },
    async sweepLaundry(userId, days) {
      const out = [];
      for (const r of S.status.values()) if (r.user_id === userId && r.status === 'Laundry' && r.changed_at <= new Date(Date.now() - days * DAY)) { Object.assign(r, { status: 'Available', changed_at: now(), until: null, note: null }); out.push(r.item_id); }
      return out;
    },
    async get(userId, itemId) { const r = S.status.get(itemId); return r && r.user_id === userId ? { item_id: r.item_id, status: r.status } : null; },
    async move(userId, itemId, from, to, until = null, note = null) {
      const r = S.status.get(itemId);
      if (!r || r.user_id !== userId || r.status !== from) return false;
      Object.assign(r, { status: to, changed_at: now(), until, note });
      S.seq.history += 1; S.history.push({ id: S.seq.history, item_id: itemId, from_status: from, to_status: to, changed_at: now() });
      return true;
    },
    async restore(userId, itemId, status) {
      const r = S.status.get(itemId);
      if (!r || r.user_id !== userId || r.status === status) return false;
      S.history.push({ item_id: itemId, from_status: r.status, to_status: status, changed_at: now() });
      Object.assign(r, { status, changed_at: now() });
      return true;
    },
    async washDone(userId) {
      const out = [];
      for (const r of S.status.values()) if (r.user_id === userId && r.status === 'Laundry') { Object.assign(r, { status: 'Available', changed_at: now(), until: null, note: null }); out.push(r.item_id); }
      return out;
    },
  };

  const outfits = {
    async findSame(userId, ids) { return S.outfits.filter((o) => o.user_id === userId && o.source !== 'planned' && sameSet(o.item_ids, ids)).sort((a, b) => a.created_at - b.created_at)[0] || null; },
    async updateSaved(userId, id, m) { const o = own(S.outfits, userId, id); Object.assign(o, { favorite: m.favorite, rule_score: m.ruleScore, reasons: m.reasons }); return { ...o }; },
    async save(userId, o) {
      const r = { id: uuid(), user_id: userId, item_ids: o.itemIds, occasion: o.occasion || null, style: o.style || null, rule_score: o.ruleScore ?? null, reasons: o.reasons || [], source: o.source || 'recommended', favorite: Boolean(o.favorite), created_at: new Date(Date.now() + S.outfits.length) };
      S.outfits.push(r); return { ...r };
    },
    async list(userId, favoritesOnly) { return S.outfits.filter((o) => o.user_id === userId && o.source !== 'planned' && (!favoritesOnly || o.favorite)).sort((a, b) => b.created_at - a.created_at).map((o) => ({ ...o })); },
    async get(userId, id) { const o = own(S.outfits, userId, id); return o ? { ...o } : null; },
    async setFavorite(userId, id, favorite) { const o = own(S.outfits, userId, id); if (!o) return null; o.favorite = favorite; return { ...o }; },
    async remove(userId, id) { const o = own(S.outfits, userId, id); if (!o || o.source === 'planned') return false; S.outfits = S.outfits.filter((x) => x !== o); S.events.forEach((e) => { if (e.planned_outfit_id === id) e.planned_outfit_id = null; }); return true; },
    async wear(userId, ids, day, rating, ctx = {}) {
      S.seq.wear += 1;
      S.wears.push({ id: S.seq.wear, user_id: userId, item_ids: ids, worn_on: day, rating: rating || null, occasion: ctx.occasion || null, temp_c: ctx.tempC ?? null, conditions: ctx.condition || null, event_title: ctx.eventTitle || null, note: ctx.note || null });
      return S.seq.wear;
    },
    async rate(userId, wearId, rating) { const w = S.wears.find((x) => x.id === wearId && x.user_id === userId); if (!w) return false; w.rating = rating; return true; },
    async feedback(userId, kind, ids, reason) { S.feedback.push({ user_id: userId, kind, item_ids: ids, reason: reason || null, created_at: now() }); },
    async rejectedLooks(userId) { return S.feedback.filter((f) => f.user_id === userId && f.kind === 'reject' && f.reason === 'Not in the mood today' && f.created_at > new Date(Date.now() - 7 * DAY)).map((f) => f.item_ids); },
    async hide(userId, itemId, days) { S.hidden = S.hidden.filter((h) => !(h.user_id === userId && h.item_id === itemId)); S.hidden.push({ user_id: userId, item_id: itemId, until: new Date(Date.now() + days * DAY) }); },
    async unhide(userId, itemId) { S.hidden = S.hidden.filter((h) => !(h.user_id === userId && h.item_id === itemId)); },
    async hidden(userId) { return S.hidden.filter((h) => h.user_id === userId && h.until > now()).map((h) => ({ ...h })); },
    async rejectCounts(userId, days = 60) {
      const out = {};
      for (const f of S.feedback) if (f.user_id === userId && f.kind === 'reject' && f.created_at > new Date(Date.now() - days * DAY)) out[f.reason] = (out[f.reason] || 0) + 1;
      return out;
    },
    async favouriteIds(userId) { return [...new Set(S.outfits.filter((o) => o.user_id === userId && o.favorite).flatMap((o) => o.item_ids))]; },
    async history(userId, { from, to, occasion, minRating }) {
      return S.wears.filter((w) => w.user_id === userId && (!from || w.worn_on >= from) && (!to || w.worn_on <= to) && (!occasion || w.occasion === occasion) && (!minRating || (w.rating || 0) >= minRating))
        .sort((a, b) => b.worn_on.localeCompare(a.worn_on) || b.id - a.id).slice(0, 200).map((w) => ({ ...w }));
    },
    async wornSince(userId, days) {
      const since = iso(Date.now() - days * DAY);
      return [...new Set(S.wears.filter((w) => w.user_id === userId && w.worn_on > since).flatMap((w) => w.item_ids))];
    },
  };

  const planner = {
    async create(userId, e) { const r = { id: uuid(), user_id: userId, title: e.title, event_date: e.date, event_time: `${e.time}:00`, occasion: e.occasion, dress_code: e.dressCode, planned_outfit_id: null, planned_temp_c: null, planned_condition: null, created_at: now() }; S.events.push(r); return { ...r }; },
    async month(userId, month) { return S.events.filter((e) => e.user_id === userId && e.event_date.slice(0, 7) === month).sort((a, b) => (a.event_date + a.event_time).localeCompare(b.event_date + b.event_time)).map((e) => ({ ...e })); },
    async update(userId, id, e) {
      const r = own(S.events, userId, id); if (!r) return null;
      if (e.title) r.title = e.title; if (e.date) r.event_date = e.date; if (e.time) r.event_time = `${e.time}:00`; if (e.occasion) r.occasion = e.occasion; if (e.dressCode) r.dress_code = e.dressCode;
      return { ...r };
    },
    async get(userId, id) { const r = own(S.events, userId, id); return r ? { ...r } : null; },
    async upcoming(userId, days) {
      const t = iso(Date.now()); const end = iso(Date.now() + days * DAY);
      return S.events.filter((e) => e.user_id === userId && e.event_date >= t && e.event_date < end).sort((a, b) => (a.event_date + a.event_time).localeCompare(b.event_date + b.event_time)).map((e) => ({ ...e }));
    },
    async setPlanned(userId, id, outfitId, weather = null) { const r = own(S.events, userId, id); if (!r) return; r.planned_outfit_id = outfitId; r.planned_temp_c = weather ? weather.tempC : null; r.planned_condition = weather ? String(weather.condition || '').slice(0, 40) || null : null; },
    async remove(userId, id) { const r = own(S.events, userId, id); if (!r) return false; S.events = S.events.filter((x) => x !== r); return true; },
  };

  const shopping = {
    async decisions(userId) { return S.decisions.filter((d) => d.user_id === userId).map((d) => ({ key: d.key, state: d.state })); },
    async decide(userId, key, state) { S.decisions = S.decisions.filter((d) => !(d.user_id === userId && d.key === key)); S.decisions.push({ user_id: userId, key, state, decided_at: now() }); },
    async undecide(userId, key) { S.decisions = S.decisions.filter((d) => !(d.user_id === userId && d.key === key)); },
    async listItems(userId) { return S.listItems.filter((i) => i.user_id === userId).sort((a, b) => Number(a.status === 'bought') - Number(b.status === 'bought') || b.created_at - a.created_at).map((i) => ({ ...i })); },
    async findOpen(userId, { category, colour, title }) { return S.listItems.find((i) => i.user_id === userId && i.status === 'to_buy' && i.category === category && (i.colour || null) === (colour || null) && i.title.toLowerCase() === title.toLowerCase()) || null; },
    async insertItem(userId, i) { const r = { id: uuid(), user_id: userId, title: i.title, category: i.category, colour: i.colour || null, source: i.source, reason: i.reason || null, suggestion_key: i.suggestionKey || null, replaces: i.replaces || null, status: 'to_buy', created_at: new Date(Date.now() + S.listItems.length) }; S.listItems.push(r); return { ...r }; },
    async setStatus(userId, id, status) { const r = own(S.listItems, userId, id); if (!r) return null; r.status = status; return { ...r }; },
    async removeItem(userId, id) { const r = own(S.listItems, userId, id); if (!r) return null; S.listItems = S.listItems.filter((x) => x !== r); return { suggestion_key: r.suggestion_key }; },
  };

  const intelligence = {
    async learned(userId) { return S.learned.filter((l) => l.user_id === userId).sort((a, b) => b.decided_at - a.decided_at).map((l) => clone(l)); },
    async upsertLearned(userId, key, state, previous) { S.learned = S.learned.filter((l) => !(l.user_id === userId && l.key === key)); S.learned.push({ user_id: userId, key, state, previous: clone(previous), decided_at: now() }); },
    async deleteLearned(userId, key) { const l = S.learned.find((x) => x.user_id === userId && x.key === key); if (!l) return null; S.learned = S.learned.filter((x) => x !== l); return { state: l.state, previous: l.previous }; },
    async readKeys(userId) { return S.read.filter((r) => r.user_id === userId).map((r) => r.key); },
    async markRead(userId, key) { if (!S.read.some((r) => r.user_id === userId && r.key === key)) S.read.push({ user_id: userId, key }); },
    async snoozes(userId, prefix) { const t = iso(Date.now()); return S.snoozes.filter((s) => s.user_id === userId && s.key.startsWith(`${prefix}:`) && s.until >= t).map((s) => ({ key: s.key, until: s.until })); },
    async snooze(userId, key, until, reason) { S.snoozes = S.snoozes.filter((s) => !(s.user_id === userId && s.key === key)); S.snoozes.push({ user_id: userId, key, until, reason }); },
    async unsnooze(userId, key) { S.snoozes = S.snoozes.filter((s) => !(s.user_id === userId && s.key === key)); },
  };

  const packing = {
    async insert(userId, t) { const r = { id: uuid(), user_id: userId, destination: t.destination, start_date: t.startDate, end_date: t.endDate, trip_type: t.tripType, activities: t.activities, item_ids: t.itemIds, plan: clone(t.plan), packed: false, created_at: now() }; S.trips.push(r); return { ...r }; },
    async list(userId) { return S.trips.filter((t) => t.user_id === userId).sort((a, b) => a.start_date.localeCompare(b.start_date)).map((t) => ({ ...t })); },
    async get(userId, id) { const t = own(S.trips, userId, id); return t ? { ...t } : null; },
    async setPacked(userId, id, packed) { const t = own(S.trips, userId, id); if (t) t.packed = packed; },
    async remove(userId, id) { const t = own(S.trips, userId, id); if (!t) return 0; S.trips = S.trips.filter((x) => x !== t); return 1; },
  };

  const assistant = {
    async log(userId, fn, undo) { const id = uuid(); S.actions.push({ id, user_id: userId, function: fn, undo: clone(undo), undone: false, created_at: now() }); return id; },
    async get(userId, id) { const a = own(S.actions, userId, id); return a ? { ...a } : null; },
    async markUndone(id) { const a = S.actions.find((x) => x.id === id); if (a) a.undone = true; },
  };

  const activity = {
    async insert(userId, action, detail) { S.seq.activity += 1; S.activity.unshift({ id: S.seq.activity, user_id: userId, action, detail, at: now() }); },
    async list(userId, limit) { return S.activity.filter((a) => a.user_id === userId).slice(0, limit); },
    async since(userId, hours) { const t = new Date(Date.now() - hours * 3600000); return S.activity.filter((a) => a.user_id === userId && a.at > t); },
    async pieceLabel(userId, itemId) { const r = own(S.items, userId, itemId); return r ? { name: r.name, colour: r.colour, category: r.category } : null; },
  };

  return { store: S, profile, wardrobe, availability, outfits, planner, shopping, intelligence, packing, assistant, activity };
}

// The store as JSON (Maps → arrays) so the offline demo can keep state across a page refresh in the
// same tab (sessionStorage), and back again (ISO timestamps → Date).
const MAPS = ['profiles', 'status'];
function serializeStore(S) { return JSON.stringify({ ...S, ...Object.fromEntries(MAPS.map((k) => [k, [...S[k].entries()]])) }); }
function restoreStore(json) {
  const o = JSON.parse(json, (k, v) => (typeof v === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d/.test(v) ? new Date(v) : v));
  for (const k of MAPS) o[k] = new Map(o[k]);
  return o;
}

module.exports = { memoryRepositories, createMemoryStore, serializeStore, restoreStore };
