// API tests: status per piece, laundry basket, Wash done (US-56, US-15, US-16) — state-transition testing.
const request = require('supertest');
const { makeApp, resetDb, pool, registerUser, addPiece, auth } = require('../helpers');

const app = makeApp();
let user;
let id;
const setStatus = (status, pieceId = id, token = user.token) =>
  request(app).patch(`/api/v1/items/${pieceId}/status`).set(auth(token)).send({ status });

beforeEach(async () => {
  await resetDb();
  user = await registerUser(app);
  id = (await addPiece(app, user.token)).body.id;
});
afterAll(() => pool.end());

describe('Status per piece (US-56)', () => {
  test('API-S01 valid path Available → Borrowed → Laundry → Available', async () => {
    expect((await setStatus('Borrowed')).body).toMatchObject({ status: 'Borrowed', changed: true });
    expect((await setStatus('Laundry')).body.status).toBe('Laundry');
    expect((await setStatus('Available')).body.status).toBe('Available');
    const { rows } = await pool.query('SELECT from_status, to_status FROM availability.status_history ORDER BY id');
    expect(rows).toEqual([
      { from_status: 'Available', to_status: 'Borrowed' },
      { from_status: 'Borrowed', to_status: 'Laundry' },
      { from_status: 'Laundry', to_status: 'Available' },
    ]);
  });
  test('API-S02 invalid transition Laundry → Borrowed → 409 and status unchanged', async () => {
    await setStatus('Laundry');
    const res = await setStatus('Borrowed');
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('INVALID_TRANSITION');
    expect((await request(app).get(`/api/v1/items/${id}`).set(auth(user.token))).body.status).toBe('Laundry');
  });
  test('API-S03 invalid transition Unavailable → Packed → 409', async () => {
    await setStatus('Unavailable');
    expect((await setStatus('Packed')).status).toBe(409);
  });
  test('API-S04 setting the same status is a no-op (exactly one status, no duplicate history)', async () => {
    const res = await setStatus('Available');
    expect(res.body).toMatchObject({ status: 'Available', changed: false });
    expect((await pool.query('SELECT count(*)::int AS n FROM availability.status_history')).rows[0].n).toBe(0);
  });
  test('API-S05 unknown status value → 400', async () => {
    expect((await setStatus('Lost')).status).toBe(400);
  });
  test('API-S06 the status badge value comes back with the piece', async () => {
    await setStatus('Packed');
    expect((await request(app).get(`/api/v1/items/${id}`).set(auth(user.token))).body.status).toBe('Packed');
  });
});

describe('Laundry basket and Wash done (US-15, US-16)', () => {
  test('API-L01 one tap in, basket lists it; one tap out', async () => {
    await setStatus('Laundry');
    let basket = await request(app).get('/api/v1/laundry').set(auth(user.token));
    expect(basket.body.count).toBe(1);
    expect(basket.body.items[0]).toMatchObject({ id, status: 'Laundry' });
    await setStatus('Available');
    basket = await request(app).get('/api/v1/laundry').set(auth(user.token));
    expect(basket.body.count).toBe(0);
  });
  test('API-L02 Wash done returns every Laundry piece to Available, and only those', async () => {
    const id2 = (await addPiece(app, user.token, { category: 'Bottom' })).body.id;
    const id3 = (await addPiece(app, user.token, { category: 'Shoes' })).body.id;
    await setStatus('Laundry');
    await setStatus('Laundry', id2);
    await setStatus('Borrowed', id3);
    const res = await request(app).post('/api/v1/laundry/wash-done').set(auth(user.token));
    expect(res.body.returned).toBe(2);
    const all = await request(app).get('/api/v1/items').set(auth(user.token));
    expect(all.body.counts.status).toMatchObject({ Available: 2, Laundry: 0, Borrowed: 1 });
  });
  test('API-L03 Wash done with an empty basket returns 0', async () => {
    expect((await request(app).post('/api/v1/laundry/wash-done').set(auth(user.token))).body.returned).toBe(0);
  });
  test("API-L04 Wash done never touches another user's laundry", async () => {
    const other = await registerUser(app, 'bashar@example.com');
    const otherId = (await addPiece(app, other.token)).body.id;
    await setStatus('Laundry', otherId, other.token);
    await request(app).post('/api/v1/laundry/wash-done').set(auth(user.token));
    expect((await request(app).get('/api/v1/laundry').set(auth(other.token))).body.count).toBe(1);
  });
});
