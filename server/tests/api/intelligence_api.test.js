// API tests of the version 1.3 features (all Sprint 2 / Sprint 3 / stretch previews):
// explainable recommendations, Wardrobe Health, Closet has learned, conflict detection,
// outfit history, packing mode, notification center, activity log, admin health, templates.
const request = require('supertest');
const { makeApp, resetDb, pool, registerUser, addPiece, auth, weatherState } = require('../helpers');

const app = makeApp();
let u;
const P = {};
const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function closet() {
  const add = async (key, d) => { P[key] = (await addPiece(app, u.token, d)).body; };
  await add('tee', { name: 'White fitted tee', category: 'Top', colour: 'White', dressCodes: [1, 2], styles: ['Minimal'] });
  await add('shirt', { name: 'Blue Oxford shirt', category: 'Top', colour: 'Blue', dressCodes: [1, 2, 3], styles: ['Classic'] });
  await add('blouse', { name: 'Ivory silk blouse', category: 'Top', colour: 'White', fabric: 'Silk', dressCodes: [2, 3], styles: ['Elegant'] });
  await add('jeans', { name: 'Light-wash jeans', category: 'Bottom', colour: 'Blue', fabric: 'Denim', dressCodes: [1, 2], styles: ['Casual'] });
  await add('trousers', { name: 'Black tailored trousers', category: 'Bottom', colour: 'Black', dressCodes: [2, 3, 4], styles: ['Classic'] });
  await add('sneakers', { name: 'White sneakers', category: 'Shoes', colour: 'White', dressCodes: [1, 2], styles: ['Casual'] });
  await add('loafers', { name: 'Black loafers', category: 'Shoes', colour: 'Black', dressCodes: [1, 2, 3, 4], styles: ['Classic'] });
  await add('blazer', { name: 'Navy blazer', category: 'Layer', colour: 'Navy', fabric: 'Wool', dressCodes: [2, 3, 4], styles: ['Classic'] });
  await add('trench', { name: 'Beige trench coat', category: 'Layer', colour: 'Beige', dressCodes: [1, 2, 3], styles: ['Classic'] });
}
const api = (method, url, token = u.token) => request(app)[method](`/api/v1${url}`).set(auth(token));
beforeEach(async () => { await resetDb(); weatherState.tempC = 22; u = await registerUser(app); await closet(); });
afterAll(() => pool.end());

describe('Explainable recommendations (US-57)', () => {
  test('API-EX01 each recommended outfit explains why, using the profile and the weather', async () => {
    await api('put', '/profile/quiz').send({ styles: ['Classic'], modest: false, dressCode: 2, city: 'Cairo' });
    const r = await api('post', '/recommendations').send({ occasion: 'Work' });
    expect(r.status).toBe(200);
    for (const o of r.body.outfits) {
      expect(o.explanation).toMatch(/^Recommended because /);
      expect(o.why.map((f) => f.factor)).toEqual(expect.arrayContaining(['Occasion', 'Weather', 'Availability']));
    }
  });
  test('API-EX02 rejections feed the explanation ("Your feedback")', async () => {
    for (let i = 0; i < 2; i += 1) await api('post', '/outfits/reject').send({ itemIds: [P.blouse.id, P.trousers.id, P.loafers.id], reason: 'Too formal' });
    const r = await api('post', '/recommendations').send({ occasion: 'Dinner' });
    expect(r.body.outfits.some((o) => o.why.some((f) => f.factor === 'Your feedback' && /2 looks as too formal/.test(f.text)))).toBe(true);
  });
});

describe('Wardrobe Health (US-89)', () => {
  test('API-H01 score with parts, penalties and actions; parts add up to the score', async () => {
    const r = await api('get', '/intelligence/health');
    expect(r.status).toBe(200);
    expect(r.body.score).toBeGreaterThan(0);
    const sum = r.body.parts.reduce((t, p) => t + p.points, 0) + r.body.penalties.reduce((t, p) => t + p.points, 0);
    expect(r.body.score).toBe(Math.max(0, Math.min(100, sum)));
    expect(r.body.stats.pieces).toBe(9);
  });
  test('API-H02 a new user with no pieces gets an empty score, not an error', async () => {
    const other = await registerUser(app, 'empty@example.com');
    const r = await api('get', '/intelligence/health', other.token);
    expect(r.body).toMatchObject({ score: 0, empty: true });
  });
});

describe('Closet has learned (US-40)', () => {
  test('API-LR01 confirm a pattern → profile changes; undo → restored exactly', async () => {
    await api('put', '/profile/quiz').send({ dressCode: 3 });
    for (let i = 0; i < 3; i += 1) await api('post', '/outfits/reject').send({ itemIds: [P.blouse.id, P.trousers.id, P.loafers.id], reason: 'Too formal' });
    const l = await api('get', '/intelligence/learned');
    const p = l.body.patterns.find((x) => x.key === 'less-formal');
    expect(p).toMatchObject({ count: 3, confidence: 60, change: { dressCode: 2 } });
    const c = await api('post', '/intelligence/learned/less-formal').send({ decision: 'confirm' });
    expect(c.body).toMatchObject({ state: 'confirmed', profile: { dressCode: 2 } });
    const after = await api('get', '/intelligence/learned');
    expect(after.body.patterns.some((x) => x.key === 'less-formal')).toBe(false);
    expect(after.body.decided[0]).toMatchObject({ key: 'less-formal', state: 'confirmed' });
    const undo = await api('delete', '/intelligence/learned/less-formal');
    expect(undo.body.profile.dressCode).toBe(3);
  });
  test('API-LR02 "Not accurate" dismisses without changing the profile; unknown pattern → 404', async () => {
    await api('put', '/profile/quiz').send({ dressCode: 3 });
    for (let i = 0; i < 2; i += 1) await api('post', '/outfits/reject').send({ itemIds: [P.blouse.id, P.trousers.id, P.loafers.id], reason: 'Too formal' });
    const d = await api('post', '/intelligence/learned/less-formal').send({ decision: 'dismiss' });
    expect(d.body.state).toBe('dismissed');
    expect((await api('get', '/profile')).body.dressCode).toBe(3);
    expect((await api('post', '/intelligence/learned/style-bold').send({ decision: 'confirm' })).status).toBe(404);
    expect((await api('post', '/intelligence/learned/less-formal').send({ decision: 'maybe' })).status).toBe(400);
  });
});

describe('Conflict detection (US-79)', () => {
  async function planned(date = day(1)) {
    const ev = await api('post', '/events').send({ title: 'SE presentation', date, time: '11:00', occasion: 'Work' });
    await api('put', `/events/${ev.body.id}/outfit`).send({ itemIds: [P.shirt.id, P.trousers.id, P.blazer.id, P.loafers.id] });
    return ev.body;
  }
  test('API-K01 a planned piece moved to Laundry (not back in time) creates a conflict with a replacement', async () => {
    const ev = await planned(day(1));
    expect((await api('get', '/intelligence/conflicts')).body.conflicts).toHaveLength(0);
    await api('patch', `/items/${P.blazer.id}/status`).send({ status: 'Laundry' }); // back in 2 days > tomorrow
    const c = (await api('get', '/intelligence/conflicts')).body.conflicts;
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ kind: 'unavailable', eventId: ev.id, itemId: P.blazer.id, status: 'Laundry' });
    expect(c[0].message).toMatch(/Your navy blazer is in the laundry/);
    expect(c[0].replacement.piece.id).toBe(P.trench.id);
  });
  test('API-K02 fix swaps only that piece; a piece back before the event is not a conflict', async () => {
    const ev = await planned(day(1));
    await api('patch', `/items/${P.blazer.id}/status`).send({ status: 'Laundry' });
    const f = await api('post', `/intelligence/conflicts/${ev.id}/fix`).send({ itemId: P.blazer.id });
    expect(f.status).toBe(200);
    expect(f.body.with.id).toBe(P.trench.id);
    expect(f.body.event.plannedOutfit.pieces.map((p) => p.id)).toEqual([P.shirt.id, P.trousers.id, P.trench.id, P.loafers.id]);
    expect((await api('get', '/intelligence/conflicts')).body.conflicts).toHaveLength(0);
    expect((await api('post', `/intelligence/conflicts/${ev.id}/fix`).send({ itemId: P.blazer.id })).status).toBe(409);
    const later = await planned(day(5)); // laundry is back in 2 days → in time
    expect((await api('get', '/intelligence/conflicts')).body.conflicts.some((c) => c.eventId === later.id)).toBe(false);
  });
  test('API-K03 a Packed planned piece is a conflict, and it shows in the Notification Center', async () => {
    await planned(day(1));
    await api('patch', `/items/${P.loafers.id}/status`).send({ status: 'Packed', until: day(4), note: 'Alex' });
    const n = (await api('get', '/notifications')).body;
    const c = n.notifications.find((x) => x.kind === 'conflict');
    expect(c.text).toMatch(/black loafers is packed until/);
    expect(c.highlight).toBe(true);
  });
});

describe('Conflict detection: double booking (US-79)', () => {
  test('API-K04 the same piece planned for two events < 4 h apart on one day is flagged', async () => {
    const a = (await api('post', '/events').send({ title: 'Lab', date: day(2), time: '10:00', occasion: 'University' })).body;
    const b = (await api('post', '/events').send({ title: 'Lunch', date: day(2), time: '12:30', occasion: 'Dinner' })).body;
    await api('put', `/events/${a.id}/outfit`).send({ itemIds: [P.tee.id, P.jeans.id, P.loafers.id] });
    await api('put', `/events/${b.id}/outfit`).send({ itemIds: [P.blouse.id, P.trousers.id, P.loafers.id] });
    const c = (await api('get', '/intelligence/conflicts')).body.conflicts.filter((x) => x.kind === 'double-booked');
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ eventId: b.id, itemId: P.loafers.id });
    expect(c[0].message).toMatch(/planned for “Lab” and “Lunch” on the same day, 2.5 h apart/);
  });
});

describe('Outfit history (US-91)', () => {
  test('API-OH01 wear with occasion and weather; filter by occasion and rating', async () => {
    await api('post', '/outfits/wear').send({ itemIds: [P.tee.id, P.jeans.id, P.sneakers.id], rating: 5, occasion: 'University', tempC: 24, condition: 'Clear' });
    await api('post', '/outfits/wear').send({ itemIds: [P.shirt.id, P.trousers.id, P.loafers.id], rating: 3, occasion: 'Work' });
    const all = (await api('get', '/outfits/history')).body;
    expect(all).toMatchObject({ total: 2, averageRating: 4 });
    expect(all.occasions.sort()).toEqual(['University', 'Work']);
    const uni = (await api('get', '/outfits/history?occasion=University')).body;
    expect(uni.wears[0]).toMatchObject({ rating: 5, occasion: 'University', weather: { tempC: 24, condition: 'Clear' } });
    expect(uni.wears[0].pieces[0].wearCount).toBe(1);
    expect((await api('get', '/outfits/history?minRating=4')).body.total).toBe(1);
    expect((await api('get', '/outfits/history?minRating=9')).status).toBe(400);
  });
});

describe('Packing mode (US-68)', () => {
  const trip = { destination: 'Alexandria', startDate: day(3), endDate: day(5), tripType: 'Travel', activities: ['Travel', 'Dinner'] };
  test('API-PK01 plan proposes outfits per day, counts, and never a Laundry piece', async () => {
    await api('patch', `/items/${P.tee.id}/status`).send({ status: 'Laundry' });
    const r = await api('post', '/packing/plan').send(trip);
    expect(r.status).toBe(200);
    expect(r.body.counts.days).toBe(3);
    expect(r.body.days.map((d) => d.occasion)).toEqual(['Travel', 'Dinner', 'Travel']);
    expect(r.body.itemIds.includes(P.tee.id)).toBe(false);
  });
  test('API-PK02 save → mark as packed: pieces become Packed with a return date and leave recommendations', async () => {
    const t = (await api('post', '/packing/trips').send(trip)).body;
    const p = await api('post', `/packing/trips/${t.id}/pack`);
    expect(p.body.packed).toBe(t.itemIds.length);
    const items = (await api('get', '/items')).body.items.filter((i) => t.itemIds.includes(i.id));
    expect(items.every((i) => i.status === 'Packed' && i.statusUntil === day(6) && i.statusNote === 'Alexandria')).toBe(true);
    const rec = await api('post', '/recommendations').send({ occasion: 'Everyday' });
    for (const o of rec.body.outfits) expect(o.itemIds.some((id) => t.itemIds.includes(id))).toBe(false);
    const un = await api('post', `/packing/trips/${t.id}/unpack`);
    expect(un.body.unpacked).toBe(t.itemIds.length);
  });
  test('API-PK03 validation: end before start, too long, unknown trip, another user’s trip', async () => {
    expect((await api('post', '/packing/plan').send({ ...trip, endDate: day(1) })).status).toBe(400);
    expect((await api('post', '/packing/plan').send({ ...trip, endDate: day(30) })).status).toBe(400);
    const t = (await api('post', '/packing/trips').send(trip)).body;
    const other = await registerUser(app, 'other@example.com');
    expect((await api('post', `/packing/trips/${t.id}/pack`, other.token)).status).toBe(404);
    expect((await api('delete', `/packing/trips/${t.id}`)).status).toBe(204);
  });
});

describe('Notification Center (US-92) and activity log (US-93)', () => {
  test('API-N01 event tomorrow without an outfit → a notice; mark read', async () => {
    await api('post', '/events').send({ title: 'Lab demo', date: day(1), time: '10:00', occasion: 'University' });
    const n = (await api('get', '/notifications')).body;
    const plan = n.notifications.find((x) => x.kind === 'plan');
    expect(plan.title).toBe('Your event is tomorrow');
    expect(plan.text).toMatch(/no outfit selected yet/);
    expect(n.dailyLimit).toBe(3);
    await api('post', '/notifications/read').send({ keys: [plan.key] });
    const again = (await api('get', '/notifications')).body;
    expect(again.notifications.find((x) => x.key === plan.key).read).toBe(true);
    expect(again.unread).toBe(n.unread - 1);
    expect((await api('post', '/notifications/read').send({ keys: 'x' })).status).toBe(400);
  });
  test('API-N02 Wash done creates a notice and activity entries', async () => {
    await api('patch', `/items/${P.tee.id}/status`).send({ status: 'Laundry' });
    await api('post', '/laundry/wash-done');
    await wait(80);
    const n = (await api('get', '/notifications')).body;
    expect(n.notifications.find((x) => x.kind === 'wash').text).toBe('1 piece returned to Available.');
    const a = (await api('get', '/activity')).body.activity.map((x) => `${x.action}${x.detail ? ` · ${x.detail}` : ''}`);
    expect(a).toEqual(expect.arrayContaining(['Wash done · 1 piece', 'Moved to Laundry · White fitted tee', 'Account created']));
  });
  test('API-N03 the activity log records sign-in, profile update and a deleted piece by name, only for its owner', async () => {
    await request(app).post('/api/v1/auth/login').send({ email: u.email, password: u.password });
    await api('put', '/profile').send({ displayName: 'Salma' });
    await api('delete', `/items/${P.tee.id}`).send({ reason: 'Torn / damaged' });
    await api('get', '/items'); // reads are never logged
    await wait(80);
    const a = (await api('get', '/activity')).body.activity;
    expect(a.map((x) => x.action)).toEqual(expect.arrayContaining(['Signed in', 'Profile updated', 'Piece deleted']));
    expect(a.find((x) => x.action === 'Piece deleted').detail).toBe('White fitted tee · Torn / damaged');
    expect(a.length).toBe(13); // account + 9 pieces added + sign-in + profile + delete
    const other = await registerUser(app, 'b@example.com');
    expect((await api('get', '/activity', other.token)).body.activity.map((x) => x.action)).toEqual(['Account created']);
  });
});

describe('Admin system health (US-81) and templates (US-90)', () => {
  test('API-AD05 admin sees service health and config; a normal user gets 403', async () => {
    expect((await api('get', '/admin/health')).status).toBe(403);
    await pool.query("UPDATE accounts.users SET role = 'admin' WHERE id = $1", [u.user.id]);
    const h = await api('get', '/admin/health');
    expect(h.status).toBe(200);
    expect(h.body.services.map((s) => s.name)).toEqual(['PostgreSQL', 'Weather API', 'Language model', 'Virtual Try-On Service', 'Notification Service']);
    expect(h.body.services[0].status).toBe('ok');
    expect(JSON.stringify(h.body)).not.toMatch(/White fitted tee/); // never wardrobe contents
    const c = await api('get', '/admin/config');
    expect(c.body.templates).toHaveLength(9);
  });
  test('API-OT01 templates are part of the shared vocabulary', async () => {
    const r = await request(app).get('/api/v1/vocabulary');
    expect(r.body.OCCASION_TEMPLATES.map((t) => t.label)).toEqual(['University', 'Work', 'Dinner', 'Wedding', 'Casual outing', 'Formal event', 'Travel', 'Gym', 'Interview']);
  });
});

describe('Duplicate purchase warning (US-65)', () => {
  test('API-DU01 two similar white tops → "You already own 2 similar white tops" with match details', async () => {
    const r = await api('post', '/shopping/check').send({ category: 'Top', colour: 'White', styles: ['Minimal', 'Elegant'] });
    expect(r.body.verdict).toBe('Skip');
    expect(r.body.duplicate.message).toBe('You already own 2 similar white tops.');
    expect(r.body.similarOwned[0]).toHaveProperty('similarity');
    expect(r.body.similarOwned[0].matched).toEqual(expect.arrayContaining(['category', 'colour']));
  });
  test('API-DU02 a dissimilar piece does not trigger the warning', async () => {
    const r = await api('post', '/shopping/check').send({ category: 'Layer', colour: 'Red', styles: ['Sporty'] });
    expect(r.body.duplicate).toBe(null);
    expect(r.body.verdict).not.toBe('Skip');
  });
});
