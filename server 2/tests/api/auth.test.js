// API tests: registration, login, lockout, logout, Google sign-in, protected routes (US-01, NFR-04).
const request = require('supertest');
const jwt = require('jsonwebtoken');
const config = require('../../src/config');
const { makeApp, resetDb, pool, registerUser, auth } = require('../helpers');
const { BAD_LOGIN } = require('../../src/modules/identity/identityService');

const app = makeApp();
beforeEach(resetDb);
afterAll(() => pool.end());

describe('Registration', () => {
  test('API-A01 valid email and password → 201, token, profile created', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({ email: 'Salma@Example.com', password: 'Closet2026!' });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: 'salma@example.com', role: 'user' });
    expect(res.body.token).toEqual(expect.any(String));
    const { rows } = await pool.query('SELECT * FROM profile.profiles WHERE user_id = $1', [res.body.user.id]);
    expect(rows).toHaveLength(1);
  });
  test('API-A02 password stored as bcrypt hash, never in plain text', async () => {
    await registerUser(app);
    const { rows } = await pool.query('SELECT password_hash FROM accounts.users');
    expect(rows[0].password_hash).toMatch(/^\$2[aby]\$10\$/);
  });
  test('API-A03 duplicate email (any letter case) → 409', async () => {
    await registerUser(app, 'karim@example.com');
    const res = await request(app).post('/api/v1/auth/register').send({ email: 'KARIM@example.com', password: 'Another2026!' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('EMAIL_TAKEN');
  });
  test('API-A04 7-character password → 400 with field details', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({ email: 'a@b.co', password: '1234567' });
    expect(res.status).toBe(400);
    expect(res.body.details[0].field).toBe('password');
  });
  test('API-A05 missing fields → 400 listing both', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({});
    expect(res.status).toBe(400);
    expect(res.body.details.map((d) => d.field).sort()).toEqual(['email', 'password']);
  });
});

describe('Login', () => {
  test('API-A06 correct credentials → 200 and a working token', async () => {
    await registerUser(app);
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'salma@example.com', password: 'Closet2026!' });
    expect(res.status).toBe(200);
    const me = await request(app).get('/api/v1/auth/me').set(auth(res.body.token));
    expect(me.body.user.email).toBe('salma@example.com');
  });
  test('API-A07 wrong password and unknown email give the same 401 message', async () => {
    await registerUser(app);
    const wrong = await request(app).post('/api/v1/auth/login').send({ email: 'salma@example.com', password: 'Wrong2026!' });
    const unknown = await request(app).post('/api/v1/auth/login').send({ email: 'nobody@example.com', password: 'Wrong2026!' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.message).toBe(BAD_LOGIN);
    expect(unknown.body.message).toBe(BAD_LOGIN);
  });
  test('API-A08 4 failures still allow login (boundary below lockout)', async () => {
    await registerUser(app);
    for (let i = 0; i < 4; i += 1) await request(app).post('/api/v1/auth/login').send({ email: 'salma@example.com', password: 'Wrong2026!' });
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'salma@example.com', password: 'Closet2026!' });
    expect(res.status).toBe(200);
  });
  test('API-A09 5th failure locks the account; even the right password gets 423', async () => {
    await registerUser(app);
    const results = [];
    for (let i = 0; i < 5; i += 1) {
      results.push((await request(app).post('/api/v1/auth/login').send({ email: 'salma@example.com', password: 'Wrong2026!' })).status);
    }
    expect(results).toEqual([401, 401, 401, 401, 423]);
    const right = await request(app).post('/api/v1/auth/login').send({ email: 'salma@example.com', password: 'Closet2026!' });
    expect(right.status).toBe(423);
  });
  test('API-A10 after the 15-minute lock expires, the right password works again', async () => {
    await registerUser(app);
    for (let i = 0; i < 5; i += 1) await request(app).post('/api/v1/auth/login').send({ email: 'salma@example.com', password: 'Wrong2026!' });
    await pool.query("UPDATE accounts.users SET locked_until = now() - interval '1 second'");
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'salma@example.com', password: 'Closet2026!' });
    expect(res.status).toBe(200);
  });
  test('API-A11 suspended account cannot sign in (403)', async () => {
    await registerUser(app);
    await pool.query("UPDATE accounts.users SET account_status = 'suspended'");
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'salma@example.com', password: 'Closet2026!' });
    expect(res.status).toBe(403);
  });
});

describe('Sessions and protected routes', () => {
  test('API-A12 no token → 401 on every protected route', async () => {
    const routes = [['get', '/api/v1/profile'], ['get', '/api/v1/items'], ['get', '/api/v1/laundry'],
      ['post', '/api/v1/laundry/wash-done'], ['get', '/api/v1/events?month=2026-11'], ['get', '/api/v1/closet/gaps'], ['delete', '/api/v1/account']];
    for (const [method, url] of routes) {
      const res = await request(app)[method](url);
      expect([url, res.status]).toEqual([url, 401]);
    }
  });
  test('API-A13 tampered, wrong-secret and expired tokens → 401', async () => {
    const { token, user } = await registerUser(app);
    const tampered = `${token.slice(0, -2)}xx`;
    const forged = jwt.sign({ sub: user.id, role: 'admin', tv: 0 }, 'attacker');
    const expired = jwt.sign({ sub: user.id, role: 'user', tv: 0, exp: Math.floor(Date.now() / 1000) - 5 }, config.jwtSecret);
    for (const t of [tampered, forged, expired, 'garbage']) {
      expect((await request(app).get('/api/v1/profile').set(auth(t))).status).toBe(401);
    }
    expect((await request(app).get('/api/v1/profile').set({ Authorization: token })).status).toBe(401); // no "Bearer"
  });
  test('API-A14 logout ends the session: the old token stops working', async () => {
    const { token } = await registerUser(app);
    expect((await request(app).post('/api/v1/auth/logout').set(auth(token))).status).toBe(204);
    expect((await request(app).get('/api/v1/profile').set(auth(token))).status).toBe(401);
  });
  test('API-A15 a token for a deleted user is refused', async () => {
    const { token } = await registerUser(app);
    await pool.query('DELETE FROM accounts.users');
    expect((await request(app).get('/api/v1/auth/me').set(auth(token))).status).toBe(401);
  });
});

describe('Google sign-in (US-01 "or Google")', () => {
  test('API-A16 first Google sign-in creates the account and profile', async () => {
    const res = await request(app).post('/api/v1/auth/google').send({ credential: 'google:g-123:bashar@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('bashar@example.com');
    const { rows } = await pool.query('SELECT google_id, password_hash FROM accounts.users');
    expect(rows[0]).toEqual({ google_id: 'g-123', password_hash: null });
  });
  test('API-A17 Google sign-in links to an existing email account', async () => {
    const { user } = await registerUser(app, 'youssef@example.com');
    const res = await request(app).post('/api/v1/auth/google').send({ credential: 'google:g-9:youssef@example.com' });
    expect(res.body.user.id).toBe(user.id);
  });
  test('API-A18 invalid Google credential → 401', async () => {
    expect((await request(app).post('/api/v1/auth/google').send({ credential: 'forged' })).status).toBe(401);
  });
});
