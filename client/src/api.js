// Model layer (MVC): every call to the Closet API goes through here.
// The login token is kept in session storage, so it is gone when the tab closes.
const BASE = '/api/v1';
const KEY = 'closet.token';

export const session = {
  get token() { try { return sessionStorage.getItem(KEY); } catch { return null; } },
  set(token) { try { sessionStorage.setItem(KEY, token); } catch { /* private mode */ } },
  clear() { try { sessionStorage.removeItem(KEY); } catch { /* ignore */ } },
};

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.message || 'Something went wrong.');
    this.status = status;
    this.code = body?.error;
    this.details = body?.details || [];
  }
  field(name) { return this.details.find((d) => d.field === name)?.message; }
}

let onUnauthorized = () => {};
export function whenSignedOut(fn) { onUnauthorized = fn; }

async function call(method, path, body, { form } = {}) {
  const headers = {};
  if (session.token) headers.Authorization = `Bearer ${session.token}`;
  if (body && !form) headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE + path, { method, headers, body: form ? body : body && JSON.stringify(body) });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && session.token && !path.startsWith('/auth/login')) { session.clear(); onUnauthorized(); }
    throw new ApiError(res.status, data);
  }
  return data;
}

export const api = {
  vocabulary: () => call('GET', '/vocabulary'),
  register: (email, password) => call('POST', '/auth/register', { email, password }),
  login: (email, password) => call('POST', '/auth/login', { email, password }),
  google: (credential) => call('POST', '/auth/google', { credential }),
  logout: () => call('POST', '/auth/logout'),
  me: () => call('GET', '/auth/me'),

  profile: () => call('GET', '/profile'),
  saveQuiz: (answers) => call('PUT', '/profile/quiz', answers),
  updateProfile: (changes) => call('PUT', '/profile', changes),

  items: (filters = {}) => {
    const q = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();
    return call('GET', `/items${q ? `?${q}` : ''}`);
  },
  item: (id) => call('GET', `/items/${id}`),
  addItem: (photo, details) => {
    const form = new FormData();
    form.append('photo', photo);
    form.append('details', JSON.stringify(details));
    return call('POST', '/items', form, { form: true });
  },
  editItem: (id, changes) => call('PATCH', `/items/${id}`, changes),
  deleteItem: (id, reason, note) => call('DELETE', `/items/${id}`, { reason, ...(note && { note }) }),
  setStatus: (id, status, extra = {}) => call('PATCH', `/items/${id}/status`, { status, ...extra }),
  hide: (id) => call('POST', `/items/${id}/hide`),
  unhide: (id) => call('DELETE', `/items/${id}/hide`),

  laundry: () => call('GET', '/laundry'),
  washDone: () => call('POST', '/laundry/wash-done'),

  gaps: () => call('GET', '/closet/gaps'),

  events: (month) => call('GET', `/events?month=${month}`),
  addEvent: (e) => call('POST', '/events', e),
  editEvent: (id, e) => call('PATCH', `/events/${id}`, e),
  deleteEvent: (id) => call('DELETE', `/events/${id}`),
  calendar: (month) => call('GET', `/events/calendar?month=${month}`),
  upcoming: () => call('GET', '/events/upcoming'),
  reminders: () => call('GET', '/events/reminders'),
  importIcs: (ics) => call('POST', '/events/import', { ics }),
  eventRecommend: (id) => call('POST', `/events/${id}/recommend`),
  planOutfit: (id, outfit) => call('PUT', `/events/${id}/outfit`, outfit),
  unplanOutfit: (id) => call('DELETE', `/events/${id}/outfit`),

  weather: (date) => call('GET', `/weather${date ? `?date=${date}` : ''}`),
  recommend: (opts) => call('POST', '/recommendations', opts),
  swap: (opts) => call('POST', '/recommendations/swap', opts),
  check: (opts) => call('POST', '/recommendations/check', opts),

  outfits: (favorites) => call('GET', `/outfits${favorites ? '?favorites=true' : ''}`),
  saveOutfit: (o) => call('POST', '/outfits', o),
  favorite: (id, favorite) => call('PATCH', `/outfits/${id}`, { favorite }),
  deleteOutfit: (id) => call('DELETE', `/outfits/${id}`),
  wear: (itemIds, rating, ctx = {}) => call('POST', '/outfits/wear', { itemIds, ...(rating && { rating }), ...ctx }),
  history: (f = {}) => { const q = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString(); return call('GET', `/outfits/history${q ? `?${q}` : ''}`); },
  rate: (wearId, rating) => call('PATCH', `/outfits/wears/${wearId}`, { rating }),
  reject: (itemIds, reason) => call('POST', '/outfits/reject', { itemIds, reason }),
  insights: () => call('GET', '/insights'),

  chatInfo: () => call('GET', '/chat'),
  chat: (message, context, pieceId) => call('POST', '/chat', { message, ...(context && { context }), ...(pieceId && { pieceId }) }),
  undo: (id) => call('POST', `/chat/undo/${id}`),

  shopping: () => call('GET', '/shopping'),
  buyCheck: (q) => call('POST', '/shopping/check', q),
  decide: (key, state) => call('PUT', `/shopping/${key}`, { state }),
  undecide: (key) => call('DELETE', `/shopping/${key}`),
  shoppingList: () => call('GET', '/shopping/list'),
  addToList: (item) => call('POST', '/shopping/list', item),
  setListStatus: (id, status) => call('PATCH', `/shopping/list/${id}`, { status }),
  removeFromList: (id) => call('DELETE', `/shopping/list/${id}`),

  health: () => call('GET', '/intelligence/health'),
  learned: () => call('GET', '/intelligence/learned'),
  decideLearned: (key, decision) => call('POST', `/intelligence/learned/${key}`, { decision }),
  undoLearned: (key) => call('DELETE', `/intelligence/learned/${key}`),
  conflicts: () => call('GET', '/intelligence/conflicts'),
  fixConflict: (eventId, itemId) => call('POST', `/intelligence/conflicts/${eventId}/fix`, { itemId }),
  notifications: () => call('GET', '/notifications'),
  markRead: (keys) => call('POST', '/notifications/read', { keys }),
  activity: () => call('GET', '/activity'),
  packPlan: (t) => call('POST', '/packing/plan', t),
  trips: () => call('GET', '/packing/trips'),
  saveTrip: (t) => call('POST', '/packing/trips', t),
  pack: (id) => call('POST', `/packing/trips/${id}/pack`),
  unpack: (id) => call('POST', `/packing/trips/${id}/unpack`),
  deleteTrip: (id) => call('DELETE', `/packing/trips/${id}`),

  // v1.5 proactive intelligence
  similarPieces: (d) => call('POST', '/items/similar', d),
  rehome: (id, method) => call('POST', `/items/${id}/rehome`, { method }),
  cancelRehome: (id) => call('DELETE', `/items/${id}/rehome`),
  rehomeDone: (id) => call('POST', `/items/${id}/rehome/done`, {}),
  forgotten: () => call('GET', '/intelligence/forgotten'),
  keep: (id, body = {}) => call('POST', `/intelligence/forgotten/${id}/keep`, body),
  seasonal: () => call('GET', '/intelligence/seasonal'),
  applySeasonal: (action, itemIds) => call('POST', '/intelligence/seasonal', { action, itemIds }),
  laundryRisk: () => call('GET', '/intelligence/laundry-risk'),
  planDays: (b) => call('POST', '/intelligence/plan-days', b),
  monitor: () => call('GET', '/intelligence/monitor'),
  adjustPlanned: (eventId, itemId) => call('POST', `/intelligence/monitor/${eventId}/adjust`, { itemId }),
  ignoreAlert: (key) => call('POST', '/intelligence/monitor/ignore', { key }),
  borrowed: () => call('GET', '/intelligence/borrowed'),
  remindLater: (id, days = 3) => call('POST', `/intelligence/borrowed/${id}/remind`, { days }),
  value: () => call('GET', '/intelligence/value'),
  memory: (q, best) => call('GET', `/intelligence/memory?${new URLSearchParams({ ...(q && { q }), ...(best && { best: 'true' }) })}`),
  repeat: (itemIds) => call('POST', '/intelligence/repeat', { itemIds }),
  smartGaps: () => call('GET', '/intelligence/gaps'),
  impact: (q) => call('POST', '/shopping/impact', q),

  adminHealth: () => call('GET', '/admin/health'),
  adminConfig: () => call('GET', '/admin/config'),
  adminUsers: () => call('GET', '/admin/users'),
  adminStats: () => call('GET', '/admin/stats'),
  adminSetStatus: (id, status) => call('PATCH', `/admin/users/${id}`, { status }),

  deleteAccount: (confirm, password) => call('DELETE', '/account', { confirm, password }),
};
