// API tests (v3.0 Studio): at least one test per endpoint, including 401/403/404 authorization checks.
// Runs on CI against PostgreSQL (migration 009). No language model: every feature uses its rule fallback.
const request = require('supertest');
const { makeApp, resetDb, pool, registerUser, addPiece, auth, weatherState } = require('../helpers');

const app = makeApp({ llm: null });
let u; let other;
const P = {};
async function closet(token, into) {
  const add = async (key, d) => { into[key] = (await addPiece(app, token, d)).body; };
  await add('tee', { name: 'White fitted tee', category: 'Top', colour: 'White', dressCodes: [1, 2], styles: ['Minimal'], fabric: 'Cotton' });
  await add('shirt', { name: 'Blue Oxford shirt', category: 'Top', colour: 'Blue', dressCodes: [1, 2, 3], styles: ['Classic'] });
  await add('knit', { name: 'Cream knit sweater', category: 'Top', colour: 'Beige', dressCodes: [1, 2, 3], styles: ['Comfortable'], fabric: 'Knit' });
  await add('jeans', { name: 'Light-wash jeans', category: 'Bottom', colour: 'Blue', fabric: 'Denim', dressCodes: [1, 2], styles: ['Casual'] });
  await add('beige', { name: 'Beige wide-leg trousers', category: 'Bottom', colour: 'Beige', dressCodes: [1, 2, 3], styles: ['Classic', 'Minimal'] });
  await add('black', { name: 'Black tailored trousers', category: 'Bottom', colour: 'Black', dressCodes: [2, 3, 4], styles: ['Classic'] });
  await add('sneakers', { name: 'White sneakers', category: 'Shoes', colour: 'White', dressCodes: [1, 2], styles: ['Casual'] });
  await add('loafers', { name: 'Black loafers', category: 'Shoes', colour: 'Black', dressCodes: [1, 2, 3], styles: ['Classic'] });
  await add('blazer', { name: 'Black blazer', category: 'Layer', colour: 'Black', dressCodes: [2, 3, 4], styles: ['Classic'] });
}
const api = (method, url, token = u.token) => request(app)[method](`/api/v1${url}`).set(auth(token));
const ids = (...keys) => keys.map((k) => P[k].id);
beforeEach(async () => {
  await resetDb(); weatherState.tempC = 22;
  u = await registerUser(app); await closet(u.token, P);
  other = await registerUser(app, 'karim@example.com'); other.P = {}; await closet(other.token, other.P);
});
afterAll(() => pool.end());

describe('v3.0 Studio — authentication and feature flags', () => {
  test('API-ST01 every studio endpoint needs a login (401)', async () => {
    expect((await request(app).post('/api/v1/studio/buy/check').send({})).status).toBe(401);
    expect((await request(app).post('/api/v1/cher-mode/spin').send({})).status).toBe(401);
    expect((await request(app).get('/api/v1/studio/friends')).status).toBe(401);
  });
  test('API-ST02 GET /studio/features lists the flags; a feature turned off answers 404 FEATURE_OFF', async () => {
    expect((await api('get', '/studio/features')).body.features).toMatchObject({ buy: true, friends: true });
    const off = makeApp({ llm: null, env: { FEATURES_OFF: 'wrapped' } });
    const r = await request(off).get('/api/v1/studio/wrapped?days=30').set(auth(u.token));
    expect(r.status).toBe(404);
    expect(r.body.error).toBe('FEATURE_OFF');
  });
});

describe('v3.0 Studio — features', () => {
  test('API-ST03 POST /studio/buy/check counts outfits before/after on a virtual closet (nothing saved)', async () => {
    const r = await api('post', '/studio/buy/check').send({ piece: { category: 'Shoes', colour: 'Beige', dressCodes: [2, 3], styles: ['Classic'] } });
    expect(r.status).toBe(200);
    expect(r.body.after - r.body.before).toBe(r.body.gain);
    expect((await api('get', '/items')).body.total).toBe(9);
    expect((await api('post', '/studio/buy/check').send({ piece: { category: 'Hat', colour: 'Black' } })).status).toBe(400);
  });
  test('API-ST04 POST /studio/buy/donate: own piece → outfits lost; someone else’s piece → 404', async () => {
    const r = await api('post', '/studio/buy/donate').send({ itemId: P.black.id });
    expect(r.status).toBe(200);
    expect(r.body.before - r.body.after).toBe(r.body.lost);
    expect((await api('post', '/studio/buy/donate').send({ itemId: other.P.black.id })).status).toBe(404);
  });
  test('API-ST05 POST /cher-mode/spin never returns another user’s garments; locking someone else’s piece → 400', async () => {
    const mine = new Set(Object.values(P).map((p) => p.id));
    for (let i = 0; i < 5; i++) {
      const r = await api('post', '/cher-mode/spin').send({ occasion: 'Everyday', rediscovery: true });
      expect(r.status).toBe(200);
      expect(r.body.itemIds.every((id) => mine.has(id))).toBe(true);
      for (const ring of Object.values(r.body.rings)) expect(ring.every((c) => mine.has(c.id))).toBe(true);
    }
    expect((await api('post', '/cher-mode/spin').send({ lockedGarmentIds: { top: other.P.tee.id } })).status).toBe(400);
  });
  test('API-ST06 POST /cher-mode/feedback stores the action; someone else’s pieces → 404', async () => {
    expect((await api('post', '/cher-mode/feedback').send({ garmentIds: ids('tee', 'jeans', 'sneakers'), score: 100, action: 'accepted' })).body.stored).toBe(true);
    expect((await api('post', '/cher-mode/feedback').send({ garmentIds: other.P ? [other.P.tee.id, other.P.jeans.id] : [], score: 100, action: 'rejected' })).status).toBe(404);
    expect((await api('post', '/cher-mode/feedback').send({ garmentIds: ids('tee', 'jeans'), action: 'loved' })).status).toBe(400);
  });
  test('API-ST07 POST /studio/rescue swaps the stained top and keeps the rest; marks it Laundry when asked', async () => {
    const r = await api('post', '/studio/rescue').send({ itemIds: ids('shirt', 'beige', 'loafers'), problem: 'Coffee on my shirt!', occasion: 'Work', apply: true });
    expect(r.status).toBe(200);
    expect(r.body.fix.itemIds).not.toContain(P.shirt.id);
    expect(r.body.marked).toEqual([P.shirt.id]);
    expect((await api('get', `/items/${P.shirt.id}`)).body.status).toBe('Laundry');
    expect((await api('post', '/studio/rescue').send({ itemIds: [other.P.shirt.id, P.beige.id], problem: 'stain' })).status).toBe(404);
  });
  test('API-ST08 POST /studio/invitation/decode + /confirm → a Planner event and looks', async () => {
    const d = await api('post', '/studio/invitation/decode').send({ text: 'Engagement party on 2027-01-15 at 8 pm. Dress code: cocktail.' });
    expect(d.body.card).toMatchObject({ date: '2027-01-15', time: '20:00', dressCodeLevel: 4 });
    const c = await api('post', '/studio/invitation/confirm').send({ card: d.body.card });
    expect(c.status).toBe(200);
    expect(c.body.event.dressCode).toBe(4);
    expect((await api('post', '/studio/invitation/confirm').send({ card: { title: 'x' } })).status).toBe(400);
  });
  test('API-ST09 GET/POST /studio/mood and /studio/mood/restyle', async () => {
    expect((await api('get', '/studio/mood')).body.moods).toHaveLength(6);
    const r = await api('post', '/studio/mood').send({ mood: 'cozy', occasion: 'Everyday' });
    expect(r.status).toBe(200);
    expect(r.body.looks.every((l) => l.score >= 83)).toBe(true);
    expect((await api('post', '/studio/mood/restyle').send({ itemId: other.P.blazer.id })).status).toBe(404);
  });
  test('API-ST10 POST /studio/recreate and /studio/recreate/shopping-list', async () => {
    const r = await api('post', '/studio/recreate').send({ text: 'black blazer, white tee and blue jeans, red clutch' });
    expect(r.body.matches.map((m) => m.level)).toEqual(['Exact', 'Exact', 'Exact', 'Missing']);
    const s = await api('post', '/studio/recreate/shopping-list').send({ target: r.body.matches[3].target });
    expect(s.body.added).toBe(true);
  });
  test('API-ST11 POST /studio/fit-check and /fit-check/save (the normal wear flow)', async () => {
    const r = await api('post', '/studio/fit-check').send({ itemIds: ids('tee', 'jeans', 'sneakers'), occasion: 'Everyday' });
    expect(r.status).toBe(200);
    expect(typeof r.body.score).toBe('number');
    expect((await api('post', '/studio/fit-check/save').send({ itemIds: ids('tee', 'jeans', 'sneakers') })).body.saved).toBe(true);
    expect((await api('get', `/items/${P.tee.id}`)).body.wearCount).toBe(1);
    expect((await api('post', '/studio/fit-check').send({ itemIds: [other.P.tee.id, P.jeans.id] })).status).toBe(404);
  });
  test('API-ST13 GET /studio/wrapped counts only her own wears', async () => {
    await api('post', '/outfits/wear').send({ itemIds: ids('tee', 'jeans', 'sneakers') });
    const w = await api('get', '/studio/wrapped?days=30');
    expect(w.body.outfitsWorn).toBe(1);
    expect(w.body.mostWorn.times).toBe(1);
    expect((await api('get', '/studio/wrapped?days=7')).status).toBe(400);
  });
});

describe('v3.0 Studio — Friends’ closet security', () => {
  const befriend = async () => {
    await api('post', '/studio/friends').send({ email: other.email });
    const inc = (await api('get', '/studio/friends', other.token)).body.incoming[0];
    await api('post', `/studio/friends/${inc.id}/accept`, other.token);
    return inc;
  };
  test('API-ST14 not friends → 403; a pending request is not enough → 403; the owner is notified', async () => {
    expect((await api('get', `/studio/friends/${other.user.id}/closet`)).status).toBe(403);
    await api('post', '/studio/friends').send({ email: other.email });
    expect((await api('get', `/studio/friends/${other.user.id}/closet`)).status).toBe(403);
    expect((await api('post', '/studio/friends/borrow').send({ friendId: other.user.id, itemId: other.P.blazer.id })).status).toBe(403);
    const notes = (await api('get', '/notifications', other.token)).body.notifications;
    expect(notes.some((n) => n.type === 'CLOSET_ACCESS_REQUEST')).toBe(true);
  });
  test('API-ST15 after access: the whole closet with safe fields only; unavailable pieces are marked', async () => {
    await befriend();
    await api('patch', `/items/${other.P.tee.id}/status`, other.token).send({ status: 'Laundry' });
    const r = await api('get', `/studio/friends/${other.user.id}/closet`);
    expect(r.status).toBe(200);
    expect(r.body.items).toHaveLength(9);
    expect(r.body.items.find((p) => p.id === other.P.tee.id).available).toBe(false);
    expect(Object.keys(r.body.items[0]).sort()).toEqual(['available', 'category', 'colour', 'id', 'name', 'owner', 'photoUrl']);
  });
  test('API-ST16 borrowing an unavailable piece → 409; someone else’s piece id → 404', async () => {
    await befriend();
    await api('patch', `/items/${other.P.tee.id}/status`, other.token).send({ status: 'Laundry' });
    expect((await api('post', '/studio/friends/borrow').send({ friendId: other.user.id, itemId: other.P.tee.id })).status).toBe(409);
    expect((await api('post', '/studio/friends/borrow').send({ friendId: other.user.id, itemId: P.jeans.id })).status).toBe(404);
    expect((await api('get', '/studio/friends/not-a-uuid/closet')).status).toBe(404);
  });
  test('API-ST17 borrow → owner notified → owner approves → piece is Borrowed; only the owner can decide; requester notified', async () => {
    await befriend();
    const b = await api('post', '/studio/friends/borrow').send({ friendId: other.user.id, itemId: other.P.blazer.id });
    expect(b.body.request.status).toBe('pending');
    expect((await api('get', '/notifications', other.token)).body.notifications.some((n) => n.type === 'BORROW_REQUEST')).toBe(true);
    expect((await api('post', `/studio/friends/requests/${b.body.request.id}`).send({ decision: 'approve' })).status).toBe(404);
    expect((await api('post', `/studio/friends/requests/${b.body.request.id}`, other.token).send({ decision: 'approve' })).body.status).toBe('approved');
    expect((await api('get', `/items/${other.P.blazer.id}`, other.token)).body.status).toBe('Borrowed');
    expect((await api('get', '/notifications')).body.notifications.some((n) => n.type === 'BORROW_ANSWER')).toBe(true);
    const mine = (await api('get', '/studio/friends/requests')).body;
    expect(mine.borrowing).toHaveLength(1);
    expect(mine.borrowing[0].piece.id).toBe(other.P.blazer.id);
  });
  test('API-ST18 same reply for unknown emails; removing access ends it for both', async () => {
    const unknown = await api('post', '/studio/friends').send({ email: 'nobody@example.com' });
    const known = await api('post', '/studio/friends').send({ email: other.email });
    expect(unknown.body).toEqual(known.body);
    const inc = (await api('get', '/studio/friends', other.token)).body.incoming[0];
    await api('post', `/studio/friends/${inc.id}/accept`, other.token);
    expect((await api('get', `/studio/friends/${other.user.id}/closet`)).status).toBe(200);
    expect((await api('get', `/studio/friends/${u.user.id}/closet`, other.token)).status).toBe(200);
    await api('delete', `/studio/friends/${inc.id}`);
    expect((await api('get', `/studio/friends/${other.user.id}/closet`)).status).toBe(403);
  });
});
