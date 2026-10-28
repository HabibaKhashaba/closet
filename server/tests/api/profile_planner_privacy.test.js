// API tests: profile (US-02, 03, 04), planner (US-46), closet gaps (US-64), delete account (US-06),
// and the security pipeline (headers, CORS, safe errors).
const fs = require('fs');
const request = require('supertest');
const { makeApp, resetDb, pool, registerUser, addPiece, auth, photoDir } = require('../helpers');
const config = require('../../src/config');

const app = makeApp();
let user;
beforeEach(async () => { await resetDb(); user = await registerUser(app); });
afterAll(() => pool.end());

describe('Style quiz and profile (US-02, US-03, US-04)', () => {
  test('API-P01 new profile starts empty with quiz not done', async () => {
    const res = await request(app).get('/api/v1/profile').set(auth(user.token));
    expect(res.body).toMatchObject({ styles: [], dressCode: 1, modest: false, city: null, quizCompleted: false });
  });
  test('API-P02 quiz answers are saved and the quiz is marked done', async () => {
    const answers = { styles: ['Chic', 'Minimal'], colours: ['Black', 'Beige'], occasions: ['University', 'Work'], dressCode: 3, modest: true, city: 'Cairo' };
    const res = await request(app).put('/api/v1/profile/quiz').set(auth(user.token)).send(answers);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ...answers, quizCompleted: true, displayName: null, laundryDays: 2, laundryAutoReturn: true, laundryWeekday: null, repeatDays: 3, reminders: true, reminderHour: 20, allowRepeats: false, avoidStyles: [] }); // v1.5 adds allowRepeats
  });
  test('API-P03 the quiz can be skipped (empty answers) and is not shown again', async () => {
    const res = await request(app).put('/api/v1/profile/quiz').set(auth(user.token)).send({});
    expect(res.body.quizCompleted).toBe(true);
  });
  test('API-P04 settings change dress code, modest option and city later', async () => {
    await request(app).put('/api/v1/profile/quiz').set(auth(user.token)).send({ styles: ['Bold'], city: 'Cairo' });
    const res = await request(app).put('/api/v1/profile').set(auth(user.token)).send({ dressCode: 5, modest: false, city: 'Alexandria' });
    expect(res.body).toMatchObject({ dressCode: 5, modest: false, city: 'Alexandria', styles: ['Bold'] });
  });
  test('API-P05 dress code 6 and unknown style → 400', async () => {
    const res = await request(app).put('/api/v1/profile').set(auth(user.token)).send({ dressCode: 6, styles: ['Gothic'] });
    expect(res.status).toBe(400);
    expect(res.body.details.map((d) => d.field).sort()).toEqual(['dressCode', 'styles']);
  });
});

describe('Planner (US-46)', () => {
  const event = { title: "Nour's wedding", date: '2026-11-12', time: '19:30', occasion: 'Wedding' };
  test('API-E01 add an event: title, date, time, one occasion; dress code defaults from occasion', async () => {
    const res = await request(app).post('/api/v1/events').set(auth(user.token)).send(event);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ ...event, dressCode: 5 });
  });
  test('API-E02 month view returns only that month, in date order', async () => {
    await request(app).post('/api/v1/events').set(auth(user.token)).send({ ...event, date: '2026-11-30', title: 'B' });
    await request(app).post('/api/v1/events').set(auth(user.token)).send({ ...event, date: '2026-11-01', title: 'A' });
    await request(app).post('/api/v1/events').set(auth(user.token)).send({ ...event, date: '2026-12-01', title: 'C' });
    const res = await request(app).get('/api/v1/events?month=2026-11').set(auth(user.token));
    expect(res.body.events.map((e) => e.title)).toEqual(['A', 'B']);
  });
  test('API-E03 impossible date and time → 400', async () => {
    const res = await request(app).post('/api/v1/events').set(auth(user.token)).send({ ...event, date: '2026-02-30', time: '24:00' });
    expect(res.status).toBe(400);
    expect(res.body.details.map((d) => d.field).sort()).toEqual(['date', 'time']);
  });
  test('API-E04 bad month parameter → 400', async () => {
    expect((await request(app).get('/api/v1/events?month=2026-13').set(auth(user.token))).status).toBe(400);
  });
  test("API-E05 edit and delete my event; another user's event is not found", async () => {
    const { id } = (await request(app).post('/api/v1/events').set(auth(user.token)).send(event)).body;
    const edited = await request(app).patch(`/api/v1/events/${id}`).set(auth(user.token)).send({ occasion: 'Party' });
    expect(edited.body).toMatchObject({ occasion: 'Party', dressCode: 4 });
    const other = await registerUser(app, 'karim@example.com');
    expect((await request(app).delete(`/api/v1/events/${id}`).set(auth(other.token))).status).toBe(404);
    expect((await request(app).delete(`/api/v1/events/${id}`).set(auth(user.token))).status).toBe(204);
    expect((await request(app).delete(`/api/v1/events/${id}`).set(auth(user.token))).status).toBe(404);
  });
});

describe('Closet gaps (US-64)', () => {
  test('API-G01 gaps follow the levels the user dresses for', async () => {
    await request(app).put('/api/v1/profile/quiz').set(auth(user.token)).send({ dressCode: 1, occasions: ['Work'] });
    for (let i = 0; i < 2; i += 1) await addPiece(app, user.token, { category: 'Top', dressCodes: [1] });
    await addPiece(app, user.token, { category: 'Top', dressCodes: [3] });
    const res = await request(app).get('/api/v1/closet/gaps').set(auth(user.token));
    expect(res.body.levels.map((l) => l.name)).toEqual(['Casual', 'Business Casual']);
    expect(res.body.gaps).toContainEqual(expect.objectContaining({ group: 'Tops & dresses', level: 3, count: 1 }));
    expect(res.body.gaps).not.toContainEqual(expect.objectContaining({ group: 'Tops & dresses', level: 1 }));
  });
});

describe('Delete my account (US-06)', () => {
  test('API-D01 without the confirmation phrase → 400, nothing deleted', async () => {
    const res = await request(app).delete('/api/v1/account').set(auth(user.token)).send({ confirm: 'yes', password: user.password });
    expect(res.status).toBe(400);
    expect((await pool.query('SELECT count(*)::int AS n FROM accounts.users')).rows[0].n).toBe(1);
  });
  test('API-D02 wrong password → 401, nothing deleted', async () => {
    const res = await request(app).delete('/api/v1/account').set(auth(user.token)).send({ confirm: 'DELETE MY ACCOUNT', password: 'Wrong2026!' });
    expect(res.status).toBe(401);
  });
  test('API-D03 confirmed → every row and every photo of the user is gone; token stops working', async () => {
    const other = await registerUser(app, 'habiba@example.com');
    const keep = (await addPiece(app, other.token)).body;
    await addPiece(app, user.token);
    await addPiece(app, user.token, { category: 'Shoes' });
    await request(app).post('/api/v1/events').set(auth(user.token)).send({ title: 'Work', date: '2026-11-02', time: '09:00', occasion: 'Work' });
    const before = fs.readdirSync(photoDir).length;

    const res = await request(app).delete('/api/v1/account').set(auth(user.token)).send({ confirm: 'DELETE MY ACCOUNT', password: user.password });
    expect(res.status).toBe(204);
    const counts = await pool.query(`SELECT
      (SELECT count(*) FROM accounts.users WHERE id = $1)::int AS users,
      (SELECT count(*) FROM profile.profiles WHERE user_id = $1)::int AS profiles,
      (SELECT count(*) FROM wardrobe.items WHERE user_id = $1)::int AS items,
      (SELECT count(*) FROM availability.item_status WHERE user_id = $1)::int AS statuses,
      (SELECT count(*) FROM planner.events WHERE user_id = $1)::int AS events`, [user.user.id]);
    expect(counts.rows[0]).toEqual({ users: 0, profiles: 0, items: 0, statuses: 0, events: 0 });
    expect(fs.readdirSync(photoDir).length).toBe(before - 2);
    expect((await request(app).get('/api/v1/profile').set(auth(user.token))).status).toBe(401);
    expect((await request(app).get(`/api/v1/items/${keep.id}`).set(auth(other.token))).status).toBe(200);
  });
});

describe('Security pipeline', () => {
  test('API-X01 security headers are set and the server is not advertised', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
  test('API-X02 CORS allows only the Closet web app', async () => {
    const ok = await request(app).get('/api/v1/health').set('Origin', config.clientOrigin);
    const evil = await request(app).get('/api/v1/health').set('Origin', 'https://evil.example');
    expect(ok.headers['access-control-allow-origin']).toBe(config.clientOrigin);
    expect(evil.headers['access-control-allow-origin']).not.toBe('https://evil.example');
  });
  test('API-X03 broken JSON → 400 with a safe message', async () => {
    const res = await request(app).post('/api/v1/auth/login').set('Content-Type', 'application/json').send('{"email":');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('BAD_JSON');
  });
  test('API-X04 unknown endpoint → 404 JSON', async () => {
    const res = await request(app).get('/api/v1/nothing-here').set(auth(user.token));
    expect(res.status).toBe(404);
  });
  test('API-X05 an internal error returns a generic 500 without details', async () => {
    const res = await request(app).get('/api/v1/events?month=2026-11').set(auth(user.token));
    expect(res.status).toBe(200);
    await pool.query('ALTER TABLE planner.events RENAME TO events_hidden');
    try {
      const broken = await request(app).get('/api/v1/events?month=2026-11').set(auth(user.token));
      expect(broken.status).toBe(500);
      expect(broken.body).toEqual({ error: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' });
    } finally {
      await pool.query('ALTER TABLE planner.events_hidden RENAME TO events');
    }
  });
});
