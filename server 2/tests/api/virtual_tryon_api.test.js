// API tests: Virtual Try-On (US-118) through the real HTTP pipeline and PostgreSQL, with the provider mocked
// (no API key and no network in tests). Login, ownership, validation, async status and saved photo.
const request = require('supertest');
const { makeApp, resetDb, pool, registerUser, addPiece, auth } = require('../helpers');
const { mockProvider } = require('../../src/modules/tryon/providers/mockProvider');
const { ProviderError } = require('../../src/modules/tryon/providers/VirtualTryOnProvider');

function png(w = 800, h = 1200) {
  const b = Buffer.alloc(64, 0);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]).copy(b, 0);
  b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20);
  return b;
}
const settings = { minCheckMs: 0 };
const app = makeApp({ tryOnProvider: mockProvider({ delayMs: 0 }), tryOnSettings: settings });
const failingApp = makeApp({ tryOnProvider: { ...mockProvider({ delayMs: 0 }), async generateTryOn() { throw new ProviderError('TRYON_PROVIDER', 'down'); } }, tryOnSettings: settings });
const offApp = makeApp({ tryOnProvider: require('../../src/modules/tryon/providers').createProvider({}) });

let salma; let top; let shoes;
const start = (a, token, fields = {}, photo = png()) => {
  let r = request(a).post('/api/v1/virtual-try-on').set(auth(token));
  for (const [k, v] of Object.entries({ consent: 'true', ...fields })) r = r.field(k, v);
  return photo ? r.attach('photo', photo, { filename: 'me.png', contentType: 'image/png' }) : r;
};
beforeEach(async () => {
  await resetDb();
  salma = await registerUser(app);
  top = (await addPiece(app, salma.token, { category: 'Top', colour: 'White', name: 'White blouse' })).body;
  shoes = (await addPiece(app, salma.token, { category: 'Shoes', colour: 'Black' })).body;
});
afterAll(() => pool.end());

describe('Virtual Try-On API', () => {
  test('API-VT01 without a login token every route is 401', async () => {
    expect((await request(app).get('/api/v1/virtual-try-on/status')).status).toBe(401);
    expect((await request(app).post('/api/v1/virtual-try-on')).status).toBe(401);
  });
  test('API-VT02 create → 202 PROCESSING, then GET → COMPLETED with a signed result URL that serves an image', async () => {
    const res = await start(app, salma.token, { wardrobeItemId: top.id, outfitItemIds: JSON.stringify([top.id, shoes.id]) });
    expect(res.status).toBe(202);
    expect(res.body).toMatchObject({ status: 'PROCESSING', provider: 'mock', garment: { id: top.id, category: 'Top' } });
    const done = await request(app).get(`/api/v1/virtual-try-on/${res.body.tryOnId}`).set(auth(salma.token));
    expect(done.body.status).toBe('COMPLETED');
    const img = await request(app).get(done.body.resultImageUrl);
    expect(img.status).toBe(200);
    const { rows } = await pool.query('SELECT status, wardrobe_item_id, user_id FROM tryon.virtual_try_ons WHERE id = $1', [res.body.tryOnId]);
    expect(rows[0]).toMatchObject({ status: 'COMPLETED', wardrobe_item_id: top.id, user_id: salma.user.id });
  });
  test('API-VT03 invalid item id → 400; unknown item → 404; shoes → 422 UNSUPPORTED_GARMENT', async () => {
    expect((await start(app, salma.token, { wardrobeItemId: 'abc' })).status).toBe(400);
    expect((await start(app, salma.token, { wardrobeItemId: '00000000-0000-4000-8000-000000000000' })).status).toBe(404);
    const s = await start(app, salma.token, { wardrobeItemId: shoes.id });
    expect(s.status).toBe(422);
    expect(s.body.error).toBe('UNSUPPORTED_GARMENT');
  });
  test('API-VT04 missing photo → 400 PHOTO_REQUIRED; a non-image → 415; no consent → 400', async () => {
    expect((await start(app, salma.token, { wardrobeItemId: top.id }, null)).body.error).toBe('PHOTO_REQUIRED');
    const txt = await request(app).post('/api/v1/virtual-try-on').set(auth(salma.token)).field('consent', 'true').field('wardrobeItemId', top.id)
      .attach('photo', Buffer.from('this is not an image, just text....'), { filename: 'x.png', contentType: 'image/png' });
    expect(txt.status).toBe(415);
    expect((await start(app, salma.token, { wardrobeItemId: top.id, consent: 'false' })).body.error).toBe('CONSENT_REQUIRED');
  });
  test('API-VT05 provider failure → FAILED with a friendly error, retry works once the provider is back', async () => {
    const res = await start(failingApp, salma.token, { wardrobeItemId: top.id });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: 'FAILED', error: { code: 'TRYON_PROVIDER' } });
    const retry = await request(app).post(`/api/v1/virtual-try-on/${res.body.tryOnId}/retry`).set(auth(salma.token));
    expect(retry.status).toBe(202);
  });
  test('API-VT06 another user cannot read, save, retry or delete my try-on (404)', async () => {
    const mine = (await start(app, salma.token, { wardrobeItemId: top.id })).body;
    const nour = await registerUser(app, 'nour@example.com');
    for (const [m, u] of [['get', ''], ['post', '/save'], ['post', '/retry'], ['delete', '']]) {
      expect((await request(app)[m](`/api/v1/virtual-try-on/${mine.tryOnId}${u}`).set(auth(nour.token))).status).toBe(404);
    }
    expect((await start(app, nour.token, { wardrobeItemId: top.id })).status).toBe(404); // not her piece
  });
  test('API-VT07 save the result, list saved, delete it', async () => {
    const t = (await start(app, salma.token, { wardrobeItemId: top.id })).body;
    await request(app).get(`/api/v1/virtual-try-on/${t.tryOnId}`).set(auth(salma.token));
    expect((await request(app).post(`/api/v1/virtual-try-on/${t.tryOnId}/save`).set(auth(salma.token))).body.saved).toBe(true);
    expect((await request(app).get('/api/v1/virtual-try-on?saved=true').set(auth(salma.token))).body.tryOns).toHaveLength(1);
    expect((await request(app).delete(`/api/v1/virtual-try-on/${t.tryOnId}`).set(auth(salma.token))).status).toBe(204);
    expect((await request(app).get(`/api/v1/virtual-try-on/${t.tryOnId}`).set(auth(salma.token))).status).toBe(404);
  });
  test('API-VT08 saved try-on photo: PUT, reuse with useSavedPhoto, DELETE', async () => {
    const put = await request(app).put('/api/v1/virtual-try-on/photo').set(auth(salma.token)).field('consent', 'true').attach('photo', png(), { filename: 'me.png', contentType: 'image/png' });
    expect(put.status).toBe(200);
    expect((await start(app, salma.token, { wardrobeItemId: top.id, useSavedPhoto: 'true' }, null)).status).toBe(202);
    expect((await request(app).delete('/api/v1/virtual-try-on/photo').set(auth(salma.token))).body.deleted).toBe(true);
    expect((await request(app).get('/api/v1/virtual-try-on/photo').set(auth(salma.token))).body.photo).toBeNull();
  });
  test('API-VT09 status route; with no provider configured, creating is 503', async () => {
    expect((await request(app).get('/api/v1/virtual-try-on/status').set(auth(salma.token))).body).toMatchObject({ enabled: true, supportedCategories: ['Top', 'Layer', 'Dress'] });
    expect((await request(offApp).get('/api/v1/virtual-try-on/status').set(auth(salma.token))).body.enabled).toBe(false);
    expect((await start(offApp, salma.token, { wardrobeItemId: top.id })).status).toBe(503);
  });
});
