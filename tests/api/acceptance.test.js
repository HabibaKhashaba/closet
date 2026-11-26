// Acceptance tests: one per Sprint 1 story, written from its acceptance criteria (product backlog v1.1).
// They walk one user through the whole "working closet" journey, the same path as the live demo.
const request = require('supertest');
const { makeApp, resetDb, pool, auth, jpegWithExif } = require('../helpers');

const app = makeApp();
const S = {}; // shared journey state
beforeAll(resetDb);
afterAll(() => pool.end());
const api = () => request(app);
const piece = (details, token = S.token) => api().post('/api/v1/items').set(auth(token))
  .field('details', JSON.stringify(details)).attach('photo', jpegWithExif(), 'piece.jpg');

describe('Sprint 1 acceptance: "A working closet"', () => {
  test('AT-01 US-01 Register and log in — password ≥ 8 chars; wrong password shows an error; no other user’s data is returned', async () => {
    expect((await api().post('/api/v1/auth/register').send({ email: 'nour@example.com', password: 'short' })).status).toBe(400);
    const reg = await api().post('/api/v1/auth/register').send({ email: 'nour@example.com', password: 'Closet2026!' });
    expect(reg.status).toBe(201);
    const wrong = await api().post('/api/v1/auth/login').send({ email: 'nour@example.com', password: 'Nope2026!' });
    expect(wrong.status).toBe(401);
    expect(wrong.body.message).toBe('Email or password is incorrect.');
    const login = await api().post('/api/v1/auth/login').send({ email: 'nour@example.com', password: 'Closet2026!' });
    S.token = login.body.token;
    S.other = (await api().post('/api/v1/auth/register').send({ email: 'other@example.com', password: 'Closet2026!' })).body.token;
    await piece({ category: 'Top', colour: 'Red', dressCodes: [1] }, S.other);
    expect((await api().get('/api/v1/items').set(auth(S.token))).body.total).toBe(0);
  });

  test('AT-02 US-02 Style quiz — ≤ 4 steps, skippable; answers saved', async () => {
    const res = await api().put('/api/v1/profile/quiz').set(auth(S.token))
      .send({ styles: ['Chic', 'Classic'], colours: ['Beige', 'Navy'], occasions: ['University', 'Work', 'Wedding'] });
    expect(res.body).toMatchObject({ styles: ['Chic', 'Classic'], quizCompleted: true });
  });

  test('AT-03 US-03 Dress code and modest preference — one of the 5 levels; modest stored', async () => {
    const res = await api().put('/api/v1/profile').set(auth(S.token)).send({ dressCode: 2, modest: true });
    expect(res.body).toMatchObject({ dressCode: 2, modest: true });
    expect((await api().put('/api/v1/profile').set(auth(S.token)).send({ dressCode: 0 })).status).toBe(400);
  });

  test('AT-04 US-04 Set my city — saved to the profile (forecast shown from Sprint 2)', async () => {
    expect((await api().put('/api/v1/profile').set(auth(S.token)).send({ city: 'Cairo' })).body.city).toBe('Cairo');
  });

  test('AT-05 US-08 Add a piece by photo — JPG/PNG/HEIC ≤ 10 MB stored and shown as the piece’s image', async () => {
    const res = await piece({ category: 'Top', colour: 'Beige', fabric: 'Linen', season: 'Summer', size: 'M', styles: ['Chic'], dressCodes: [1, 2], modest: true });
    expect(res.status).toBe(201);
    S.top = res.body;
    expect((await api().get(res.body.photoUrl)).status).toBe(200);
  });

  test('AT-06 US-09 Enter details — values from 3.1; category, colour and ≥ 1 dress-code level required', async () => {
    expect((await piece({ category: 'Top', colour: 'Beige', dressCodes: [] })).status).toBe(400);
    expect((await piece({ colour: 'Beige', dressCodes: [1] })).status).toBe(400);
    expect((await piece({ category: 'Top', colour: 'Turquoise-ish', dressCodes: [1] })).status).toBe(400);
  });

  test('AT-07 US-11 Review before saving — the piece exists only after Save', async () => {
    // The review screen is client-side; the server only creates a piece on the single Save request.
    const { body } = await api().get('/api/v1/items').set(auth(S.token));
    expect(body.total).toBe(1); // the three rejected attempts in AT-06 created nothing
  });

  test('AT-08 US-12 Browse and filter — filters combine; counts update', async () => {
    S.jeans = (await piece({ category: 'Bottom', colour: 'Blue', fabric: 'Denim', dressCodes: [1, 2] })).body;
    S.shoes = (await piece({ category: 'Shoes', colour: 'White', dressCodes: [1] })).body;
    S.blazer = (await piece({ category: 'Layer', colour: 'Navy', dressCodes: [3] })).body;
    const all = await api().get('/api/v1/items').set(auth(S.token));
    expect(all.body.counts.category).toMatchObject({ Top: 1, Bottom: 1, Shoes: 1, Layer: 1 });
    const res = await api().get('/api/v1/items?category=Bottom&status=Available').set(auth(S.token));
    expect(res.body.items.map((i) => i.id)).toEqual([S.jeans.id]);
  });

  test('AT-09 US-71 Edit a piece later — changes appear in filters', async () => {
    await api().patch(`/api/v1/items/${S.top.id}`).set(auth(S.token)).send({ colour: 'White' });
    const res = await api().get('/api/v1/items?category=Top').set(auth(S.token));
    expect(res.body.items[0].colour).toBe('White');
  });

  test('AT-10 US-56 Status per piece — exactly one status, shown as a badge', async () => {
    await api().patch(`/api/v1/items/${S.blazer.id}/status`).set(auth(S.token)).send({ status: 'Borrowed' });
    const res = await api().get(`/api/v1/items/${S.blazer.id}`).set(auth(S.token));
    expect(res.body.status).toBe('Borrowed');
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM availability.item_status WHERE item_id = $1', [S.blazer.id]);
    expect(rows[0].n).toBe(1);
  });

  test('AT-11 US-15 Laundry basket — one tap each way; basket lists all Laundry pieces', async () => {
    await api().patch(`/api/v1/items/${S.top.id}/status`).set(auth(S.token)).send({ status: 'Laundry' });
    await api().patch(`/api/v1/items/${S.jeans.id}/status`).set(auth(S.token)).send({ status: 'Laundry' });
    await api().patch(`/api/v1/items/${S.shoes.id}/status`).set(auth(S.token)).send({ status: 'Laundry' });
    expect((await api().get('/api/v1/laundry').set(auth(S.token))).body.count).toBe(3);
    await api().patch(`/api/v1/items/${S.shoes.id}/status`).set(auth(S.token)).send({ status: 'Available' });
    expect((await api().get('/api/v1/laundry').set(auth(S.token))).body.count).toBe(2);
  });

  test('AT-12 US-16 Wash done — all Laundry pieces become Available', async () => {
    expect((await api().post('/api/v1/laundry/wash-done').set(auth(S.token))).body.returned).toBe(2);
    const res = await api().get('/api/v1/items').set(auth(S.token));
    expect(res.body.counts.status).toMatchObject({ Laundry: 0, Available: 3, Borrowed: 1 });
  });

  test('AT-13 US-46 Add events by hand — title, date, time and one occasion; month view', async () => {
    await api().post('/api/v1/events').set(auth(S.token)).send({ title: 'Internship interview', date: '2026-11-04', time: '10:00', occasion: 'Interview' });
    const res = await api().get('/api/v1/events?month=2026-11').set(auth(S.token));
    expect(res.body.events[0]).toMatchObject({ title: 'Internship interview', occasion: 'Interview', dressCode: 3 });
  });

  test('AT-14 US-64 Closet gaps — a gap is ≤ 1 piece at a level the user dresses for', async () => {
    const res = await api().get('/api/v1/closet/gaps').set(auth(S.token));
    // Dresses for: 2 (usual) + 1 (University) + 3 (Work) + 5 (Wedding). Only 1 top at level 1–2 and none at 3 or 5.
    expect(res.body.levels.map((l) => l.level)).toEqual([1, 2, 3, 5]);
    expect(res.body.gaps).toContainEqual(expect.objectContaining({ group: 'Tops & dresses', level: 5, count: 0 }));
    expect(res.body.gaps).toContainEqual(expect.objectContaining({ group: 'Shoes', level: 3, count: 0 }));
  });

  test('AT-15 US-06 Delete my account — double confirmation; all data and photos deleted', async () => {
    expect((await api().delete('/api/v1/account').set(auth(S.token)).send({ confirm: 'delete' })).status).toBe(400);
    const res = await api().delete('/api/v1/account').set(auth(S.token)).send({ confirm: 'DELETE MY ACCOUNT', password: 'Closet2026!' });
    expect(res.status).toBe(204);
    expect((await api().post('/api/v1/auth/login').send({ email: 'nour@example.com', password: 'Closet2026!' })).status).toBe(401);
  });
});
