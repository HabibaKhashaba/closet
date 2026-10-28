// API tests of the Sprint 2 / Sprint 3 early-start features and the version 1.2 customization:
// recommendations, change one piece, Mix & Match, outfits and wear history, insights, Ask Closet,
// calendar (markers, reminders, .ics import), laundry basket time, recycle time, return dates,
// delete with a reason, Smart Shopping and Admin.
const request = require('supertest');
const { makeApp, resetDb, pool, registerUser, addPiece, auth, weatherState } = require('../helpers');

const app = makeApp();
let u;
const P = {};
const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
async function closet() {
  const add = async (key, d) => { P[key] = (await addPiece(app, u.token, d)).body; };
  await add('tee', { name: 'White fitted tee', category: 'Top', colour: 'White', dressCodes: [1, 2], styles: ['Minimal'] });
  await add('shirt', { name: 'Blue Oxford shirt', category: 'Top', colour: 'Blue', dressCodes: [1, 2, 3], styles: ['Classic'] });
  await add('jeans', { name: 'Light-wash jeans', category: 'Bottom', colour: 'Blue', fabric: 'Denim', dressCodes: [1, 2], styles: ['Casual'] });
  await add('trousers', { name: 'Black tailored trousers', category: 'Bottom', colour: 'Black', dressCodes: [2, 3, 4], styles: ['Classic'] });
  await add('dress', { name: 'Navy silk midi dress', category: 'Dress', colour: 'Navy', fabric: 'Silk', dressCodes: [2, 4, 5], styles: ['Elegant'] });
  await add('sneakers', { name: 'White sneakers', category: 'Shoes', colour: 'White', dressCodes: [1, 2], styles: ['Casual'] });
  await add('loafers', { name: 'Black loafers', category: 'Shoes', colour: 'Black', dressCodes: [2, 3, 4], styles: ['Classic'] });
  await add('blazer', { name: 'Navy blazer', category: 'Layer', colour: 'Navy', fabric: 'Wool', season: 'Winter', dressCodes: [2, 3, 4], styles: ['Classic'] });
  await add('bag', { name: 'Structured black bag', category: 'Bag', colour: 'Black', dressCodes: [1, 2, 3, 4], styles: ['Classic'] });
}
beforeEach(async () => { await resetDb(); weatherState.tempC = 24; u = await registerUser(app); await closet(); });
afterAll(() => pool.end());

describe('Recommendations (Sprint 2 early start)', () => {
  test('API-R01 three explained outfits with title, compatibility and breakdown', async () => {
    const r = await request(app).post('/api/v1/recommendations').set(auth(u.token)).send({ occasion: 'Dinner' });
    expect(r.status).toBe(200);
    expect(r.body.outfits).toHaveLength(3);
    for (const o of r.body.outfits) {
      expect(o.title).toMatch(/^[A-Z][\w-]+ [A-Z][\w-]+$/); // editorial name (final pass), e.g. “Dinner Oxford”
      expect(o).toHaveProperty('compatibility');
      expect(Object.keys(o)).toEqual(expect.arrayContaining(['colour', 'style', 'formality', 'weather', 'reasons', 'pieces']));
    }
    expect(r.body.weather.tempC).toBe(24);
  });
  test('API-R02 occasion is required', async () => {
    expect((await request(app).post('/api/v1/recommendations').set(auth(u.token)).send({})).status).toBe(400);
  });
  test('API-R03 a bag counts as the fourth piece', async () => {
    const r = await request(app).post('/api/v1/recommendations').set(auth(u.token)).send({ occasion: 'Work' });
    expect(r.body.outfits.some((o) => o.itemIds.includes(P.bag.id))).toBe(true);
  });
  test('API-R04 change one piece keeps the others', async () => {
    const ids = [P.tee.id, P.jeans.id, P.sneakers.id];
    const r = await request(app).post('/api/v1/recommendations/swap').set(auth(u.token)).send({ itemIds: ids, slot: 1, occasion: 'Dinner' });
    expect(r.status).toBe(200);
    expect(r.body.outfit.itemIds[0]).toBe(P.tee.id);
    expect(r.body.outfit.itemIds[2]).toBe(P.sneakers.id);
    expect(r.body.outfit.itemIds[1]).not.toBe(P.jeans.id);
  });
  test('API-R05 Mix & Match check: graded breakdown and an explanation', async () => {
    const r = await request(app).post('/api/v1/recommendations/check').set(auth(u.token)).send({ itemIds: [P.shirt.id, P.trousers.id, P.loafers.id, P.bag.id], occasion: 'Work' });
    expect(r.body).toMatchObject({ ruleScore: 100, formality: 100, levelName: 'Business Casual' });
    expect(r.body.compatibility).toBeGreaterThan(85);
    expect(r.body.explanation).toMatch(/A strong, complete look/);
    const bad = await request(app).post('/api/v1/recommendations/check').set(auth(u.token)).send({ itemIds: [P.tee.id, P.jeans.id, P.sneakers.id], occasion: 'Work' });
    expect(bad.body.formality).toBeLessThan(100);
    expect(bad.body.explanation).toMatch(/To improve: dress code/);
  });
  test('API-R06 another user’s piece cannot be styled (404)', async () => {
    const other = await registerUser(app, 'karim@example.com');
    const r = await request(app).post('/api/v1/recommendations').set(auth(other.token)).send({ occasion: 'Everyday', fixedId: P.tee.id });
    expect(r.status).toBe(404);
  });
});

describe('Version 1.2 customization (review comments)', () => {
  test('API-C01 settings: laundry basket time, recycle time, laundry day, name', async () => {
    const r = await request(app).put('/api/v1/profile').set(auth(u.token)).send({ displayName: 'Habiba', laundryDays: 3, repeatDays: 5, laundryWeekday: 5, reminderHour: 21 });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ displayName: 'Habiba', laundryDays: 3, repeatDays: 5, laundryWeekday: 5, reminderHour: 21 });
    expect((await request(app).put('/api/v1/profile').set(auth(u.token)).send({ laundryDays: 0 })).status).toBe(400);
    expect((await request(app).put('/api/v1/profile').set(auth(u.token)).send({ repeatDays: 31 })).status).toBe(400);
    expect((await request(app).put('/api/v1/profile').set(auth(u.token)).send({ laundryWeekday: null })).body.laundryWeekday).toBeNull();
  });
  test('API-C02 laundry basket time: a piece comes back on its own after N days', async () => {
    await request(app).patch(`/api/v1/items/${P.tee.id}/status`).set(auth(u.token)).send({ status: 'Laundry' });
    let laundry = await request(app).get('/api/v1/laundry').set(auth(u.token));
    expect(laundry.body).toMatchObject({ count: 1, laundryDays: 2, autoReturn: true });
    expect(laundry.body.items[0].expectedBack).toBe(day(2));
    await pool.query("UPDATE availability.item_status SET changed_at = now() - interval '3 days' WHERE item_id = $1", [P.tee.id]);
    laundry = await request(app).get('/api/v1/laundry').set(auth(u.token));
    expect(laundry.body.count).toBe(0);
    const piece = await request(app).get(`/api/v1/items/${P.tee.id}`).set(auth(u.token));
    expect(piece.body.status).toBe('Available');
  });
  test('API-C03 auto-return off: the piece stays in the basket', async () => {
    await request(app).put('/api/v1/profile').set(auth(u.token)).send({ laundryAutoReturn: false });
    await request(app).patch(`/api/v1/items/${P.tee.id}/status`).set(auth(u.token)).send({ status: 'Laundry' });
    await pool.query("UPDATE availability.item_status SET changed_at = now() - interval '9 days' WHERE item_id = $1", [P.tee.id]);
    expect((await request(app).get('/api/v1/laundry').set(auth(u.token))).body.count).toBe(1);
  });
  test('API-C04 recycle time: clothes worn yesterday wait; shoes may repeat', async () => {
    await request(app).put('/api/v1/profile').set(auth(u.token)).send({ repeatDays: 3 });
    await pool.query("UPDATE wardrobe.items SET wear_count = 1, last_worn_at = now() - interval '1 day' WHERE id = ANY($1)", [[P.tee.id, P.sneakers.id]]);
    const r = await request(app).post('/api/v1/recommendations').set(auth(u.token)).send({ occasion: 'Dinner' });
    expect(r.body.outfits.length).toBeGreaterThan(0);
    expect(r.body.outfits.some((o) => o.itemIds.includes(P.tee.id))).toBe(false);
    await request(app).put('/api/v1/profile').set(auth(u.token)).send({ repeatDays: 0 });
    const again = await request(app).post('/api/v1/recommendations').set(auth(u.token)).send({ occasion: 'Dinner' });
    expect(again.body.poolSize).toBe(r.body.poolSize + 1); // the tee is back in the pool
  });
  test('API-C05 borrowed with a return date and a note', async () => {
    const r = await request(app).patch(`/api/v1/items/${P.dress.id}/status`).set(auth(u.token)).send({ status: 'Borrowed', until: day(4), note: 'Salma' });
    expect(r.body).toMatchObject({ status: 'Borrowed', until: day(4), note: 'Salma' });
    const piece = await request(app).get(`/api/v1/items/${P.dress.id}`).set(auth(u.token));
    expect(piece.body).toMatchObject({ statusUntil: day(4), statusNote: 'Salma', expectedBack: day(4) });
    expect((await request(app).patch(`/api/v1/items/${P.dress.id}/status`).set(auth(u.token)).send({ status: 'Borrowed', until: day(-1) })).status).toBe(400);
  });
  test('API-C06 planning ahead: a piece in the laundry counts if it is back by the date', async () => {
    await request(app).patch(`/api/v1/items/${P.dress.id}/status`).set(auth(u.token)).send({ status: 'Laundry' });
    const today = await request(app).post('/api/v1/recommendations').set(auth(u.token)).send({ occasion: 'Party' });
    expect(today.body.outfits).toHaveLength(0);
    const later = await request(app).post('/api/v1/recommendations').set(auth(u.token)).send({ occasion: 'Party', date: day(5) });
    expect(later.status).toBe(200);
    expect(later.body.outfits.length).toBeGreaterThan(0);
    expect(later.body.availabilityNote).toMatch(/navy silk midi dress will be back from the laundry by then/);
  });
});

describe('Delete with a reason (US-13)', () => {
  test('API-DL01 reason is required and must be one of the list', async () => {
    expect((await request(app).delete(`/api/v1/items/${P.tee.id}`).set(auth(u.token)).send({})).status).toBe(400);
    expect((await request(app).delete(`/api/v1/items/${P.tee.id}`).set(auth(u.token)).send({ reason: 'Bored' })).status).toBe(400);
  });
  test('API-DL02 the piece and its photo are gone, the reason is kept', async () => {
    const r = await request(app).delete(`/api/v1/items/${P.tee.id}`).set(auth(u.token)).send({ reason: 'Torn / damaged' });
    expect(r.body).toMatchObject({ deleted: true, reason: 'Torn / damaged', effect: 'A replacement is added to your shopping list.' });
    expect((await request(app).get(`/api/v1/items/${P.tee.id}`).set(auth(u.token))).status).toBe(404);
    expect((await request(app).get(P.tee.photoUrl)).status).toBe(404);
    const { rows } = await pool.query('SELECT reason, name FROM wardrobe.deletions');
    expect(rows).toEqual([{ reason: 'Torn / damaged', name: 'White fitted tee' }]);
  });
  test('API-DL03 another user cannot delete my piece', async () => {
    const other = await registerUser(app, 'karim@example.com');
    expect((await request(app).delete(`/api/v1/items/${P.tee.id}`).set(auth(other.token)).send({ reason: 'Other' })).status).toBe(404);
  });
});

describe('Outfits, wear history and insights', () => {
  test('API-O01 save, favourite, list and delete', async () => {
    const s = await request(app).post('/api/v1/outfits').set(auth(u.token)).send({ itemIds: [P.tee.id, P.jeans.id, P.sneakers.id], occasion: 'Everyday', ruleScore: 100 });
    expect(s.status).toBe(201);
    await request(app).patch(`/api/v1/outfits/${s.body.id}`).set(auth(u.token)).send({ favorite: true });
    const fav = await request(app).get('/api/v1/outfits?favorites=true').set(auth(u.token));
    expect(fav.body.outfits).toHaveLength(1);
    expect((await request(app).delete(`/api/v1/outfits/${s.body.id}`).set(auth(u.token))).status).toBe(204);
  });
  test('API-O02 wear → counts, last worn, analytics; unavailable piece refused', async () => {
    const w = await request(app).post('/api/v1/outfits/wear').set(auth(u.token)).send({ itemIds: [P.tee.id, P.jeans.id, P.sneakers.id], rating: 5 });
    expect(w.status).toBe(201);
    const i = await request(app).get('/api/v1/insights').set(auth(u.token));
    expect(i.body).toMatchObject({ total: 9, wornLast30: 3, utilization: 33 });
    await request(app).patch(`/api/v1/items/${P.tee.id}/status`).set(auth(u.token)).send({ status: 'Laundry' });
    expect((await request(app).post('/api/v1/outfits/wear').set(auth(u.token)).send({ itemIds: [P.tee.id, P.jeans.id] })).status).toBe(409);
  });
  test('API-O03 reject with a reason; hide a piece for 7 days', async () => {
    expect((await request(app).post('/api/v1/outfits/reject').set(auth(u.token)).send({ itemIds: [P.tee.id, P.jeans.id], reason: 'Too casual' })).body.stored).toBe(true);
    expect((await request(app).post('/api/v1/outfits/reject').set(auth(u.token)).send({ itemIds: [P.tee.id, P.jeans.id], reason: 'meh' })).status).toBe(400);
    await request(app).post(`/api/v1/items/${P.sneakers.id}/hide`).set(auth(u.token));
    const r = await request(app).post('/api/v1/recommendations').set(auth(u.token)).send({ occasion: 'Everyday' });
    expect(r.body.outfits.some((o) => o.itemIds.includes(P.sneakers.id))).toBe(false);
  });
  test('API-O04 forgotten pieces: worn before, not for 40+ days', async () => {
    await pool.query("UPDATE wardrobe.items SET wear_count = 4, last_worn_at = now() - interval '60 days' WHERE id = $1", [P.dress.id]);
    const i = await request(app).get('/api/v1/insights').set(auth(u.token));
    expect(i.body.forgotten.map((p) => p.id)).toEqual([P.dress.id]);
    expect(i.body.forgotten[0].daysSince).toBe(60);
  });
});

describe('Ask Closet (Sprint 3 early start)', () => {
  const say = (message, extra = {}) => request(app).post('/api/v1/chat').set(auth(u.token)).send({ message, ...extra });
  test('API-AC01 “What should I wear to university tomorrow?” → outfits', async () => {
    const r = await say('What should I wear to university tomorrow?');
    expect(r.body).toMatchObject({ function: 'recommend', via: 'keyword parser' });
    expect(r.body.outfits.length).toBeGreaterThan(0);
  });
  test('API-AC02 “Do I own something similar to a black blazer?” → my blazer', async () => {
    const r = await say('Do I own something similar to a black blazer?');
    expect(r.body.function).toBe('similar_owned');
    expect(r.body.pieces.map((p) => p.id)).toEqual([P.blazer.id]);
  });
  test('API-AC03 “I want to buy black trousers. Do I need them?” → Skip when owned twice', async () => {
    await addPiece(app, u.token, { category: 'Bottom', colour: 'Black', dressCodes: [2, 3] });
    const r = await say('I want to buy black trousers. Do I need them?');
    expect(r.body).toMatchObject({ function: 'buy_check', verdict: 'Skip' });
  });
  test('API-AC04 put in the laundry, then undo', async () => {
    const r = await say('Put my blue jeans in the laundry');
    expect(r.body.function).toBe('set_status');
    expect((await request(app).get(`/api/v1/items/${P.jeans.id}`).set(auth(u.token))).body.status).toBe('Laundry');
    await request(app).post(`/api/v1/chat/undo/${r.body.undoId}`).set(auth(u.token));
    expect((await request(app).get(`/api/v1/items/${P.jeans.id}`).set(auth(u.token))).body.status).toBe('Available');
    expect((await request(app).post(`/api/v1/chat/undo/${r.body.undoId}`).set(auth(u.token))).status).toBe(409);
  });
  test('API-AC06 change one piece of the last outfit, keeping the rest', async () => {
    const first = await say('What should I wear to dinner?');
    const ids = first.body.outfits[0].itemIds;
    const r = await say('Change the shoes', { context: { itemIds: ids, occasion: 'Dinner' } });
    expect(r.body.function).toBe('change_piece');
    expect(r.body.outfits[0].itemIds[0]).toBe(ids[0]);
    expect((await say('Change the shoes')).body.reply).toMatch(/Ask me for an outfit first/);
  });
  test('API-AC07 wash done, weather, help', async () => {
    await request(app).patch(`/api/v1/items/${P.tee.id}/status`).set(auth(u.token)).send({ status: 'Laundry' });
    const w = await say('Laundry is done');
    expect(w.body.reply).toMatch(/1 piece is Available again/);
    expect((await say('Laundry is done')).body.reply).toMatch(/already empty/);
    expect((await say('Weather tomorrow?')).body.weather.tempC).toBe(24);
    expect((await say('Tell me a joke')).body.suggestions.length).toBeGreaterThan(3);
  });
  test('API-AC08 hide a piece and undo; ambiguous piece asks which one', async () => {
    const h = await say('Hide my navy blazer for a week');
    expect(h.body.function).toBe('hide_piece');
    await request(app).post(`/api/v1/chat/undo/${h.body.undoId}`).set(auth(u.token));
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM outfits.hidden_items');
    expect(rows[0].n).toBe(0);
    const which = await say('Style my blue top');
    expect(which.body.function).toBe('style_piece');
    expect(which.body.outfits.length).toBeGreaterThan(0);
    await addPiece(app, u.token, { category: 'Top', colour: 'Blue', dressCodes: [1] });
    expect((await say('Style my blue top')).body.choices).toHaveLength(2);
    expect((await say('Style my purple dress')).body.reply).toMatch(/couldn’t find/);
  });
  test('API-AC09 plan my outfit for the next event', async () => {
    expect((await say('Plan my outfit for the wedding')).body.reply).toMatch(/no events/);
    await request(app).post('/api/v1/events').set(auth(u.token)).send({ title: 'Office meeting', date: day(2), time: '10:00', occasion: 'Work' });
    const r = await say('Plan my outfit for the office meeting');
    expect(r.body).toMatchObject({ function: 'plan_event' });
    expect(r.body.outfits.length).toBeGreaterThan(0);
  });
  test('API-AC10 bad context and bad undo id are refused', async () => {
    expect((await say('Change the shoes', { context: { itemIds: ['x'] } })).status).toBe(400);
    expect((await request(app).post('/api/v1/chat/undo/nope').set(auth(u.token))).status).toBe(404);
    expect((await request(app).get('/api/v1/chat').set(auth(u.token))).body.languageModel).toBe('keyword parser');
  });
  test('API-AC05 “What is missing from my wardrobe?” → shopping suggestions', async () => {
    const r = await say('What is missing from my wardrobe?');
    expect(r.body.function).toBe('closet_needs');
    expect(r.body.shopping.length).toBeGreaterThan(0);
  });
});

describe('Planner: calendar, reminders, import', () => {
  const month = day(0).slice(0, 7);
  test('API-PL01 calendar markers: laundry day and a borrowed piece due back', async () => {
    await request(app).put('/api/v1/profile').set(auth(u.token)).send({ laundryWeekday: 4 });
    await request(app).patch(`/api/v1/items/${P.dress.id}/status`).set(auth(u.token)).send({ status: 'Borrowed', until: day(0), note: 'Nour' });
    const r = await request(app).get(`/api/v1/events/calendar?month=${month}`).set(auth(u.token));
    expect(r.status).toBe(200);
    expect(r.body.markers.filter((m) => m.kind === 'laundry-day').length).toBeGreaterThanOrEqual(4);
    expect(r.body.markers.find((m) => m.kind === 'borrowed-due')).toMatchObject({ date: day(0), label: 'navy silk midi dress due back from Nour' });
    expect((await request(app).get('/api/v1/events/calendar?month=2026-13').set(auth(u.token))).status).toBe(400);
  });
  test('API-PL02 reminders: plan an outfit, a planned piece in the laundry, a borrowed piece due', async () => {
    const e = await request(app).post('/api/v1/events').set(auth(u.token)).send({ title: 'Family dinner', date: day(1), time: '20:00', occasion: 'Dinner' });
    let r = await request(app).get('/api/v1/events/reminders').set(auth(u.token));
    expect(r.body.reminders[0]).toMatchObject({ kind: 'plan', text: 'Plan an outfit for “Family dinner” tomorrow.' });
    await request(app).put(`/api/v1/events/${e.body.id}/outfit`).set(auth(u.token)).send({ itemIds: [P.dress.id, P.loafers.id] });
    await request(app).patch(`/api/v1/items/${P.dress.id}/status`).set(auth(u.token)).send({ status: 'Laundry' });
    r = await request(app).get('/api/v1/events/reminders').set(auth(u.token));
    expect(r.body.reminders[0].kind).toBe('conflict');
  });
  test('API-PL03 .ics import: future events only, occasion guessed, no duplicates', async () => {
    const d = day(6).replace(/-/g, '');
    const ics = `BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:Nour's wedding\r\nDTSTART:${d}T190000\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nSUMMARY:Old lecture\r\nDTSTART;VALUE=DATE:20200101\r\nEND:VEVENT\r\nEND:VCALENDAR`;
    const r = await request(app).post('/api/v1/events/import').set(auth(u.token)).send({ ics });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ imported: 1, skipped: 1, found: 2 });
    expect(r.body.events[0]).toMatchObject({ title: "Nour's wedding", occasion: 'Wedding', dressCode: 5, time: '19:00' });
    expect((await request(app).post('/api/v1/events/import').set(auth(u.token)).send({ ics })).body.imported).toBe(0);
    expect((await request(app).post('/api/v1/events/import').set(auth(u.token)).send({ ics: 'hello there, not a calendar' })).status).toBe(400);
  });
});

describe('Smart Shopping (Sprint 3 early start)', () => {
  test('API-SH01 suggestions name a reason and what they pair with', async () => {
    const r = await request(app).get('/api/v1/shopping').set(auth(u.token));
    expect(r.status).toBe(200);
    const s = r.body.suggestions.find((x) => x.key === 'basic-formal-shoes');
    expect(s).toMatchObject({ source: 'Basic', category: 'Shoes' });
    expect(s.outfitsUnlocked).toBeGreaterThan(0);
    expect(s.pairsWith.length).toBeGreaterThan(0);
    expect(r.body.suggestions.some((x) => x.key === 'basic-black-trousers')).toBe(false); // already owned
  });
  test('API-SH02 a torn piece goes onto the shopping list as a replacement (not a duplicate suggestion)', async () => {
    await pool.query('UPDATE wardrobe.items SET wear_count = 12 WHERE id = $1', [P.tee.id]);
    await request(app).delete(`/api/v1/items/${P.tee.id}`).set(auth(u.token)).send({ reason: 'Torn / damaged' });
    const list = await request(app).get('/api/v1/shopping/list').set(auth(u.token));
    expect(list.body.items[0]).toMatchObject({ title: 'White fitted tee', source: 'replacement', tags: ['Replacement'], replaces: 'white fitted tee' });
    const r = await request(app).get('/api/v1/shopping').set(auth(u.token));
    expect(r.body.suggestions.some((x) => x.category === 'Top' && x.colour === 'White' && x.source === 'Replace')).toBe(false);
  });
  test('API-SH03 dismiss hides a suggestion; bad key 404', async () => {
    await request(app).put('/api/v1/shopping/basic-formal-shoes').set(auth(u.token)).send({ state: 'dismissed' });
    const r = await request(app).get('/api/v1/shopping').set(auth(u.token));
    expect(r.body.suggestions.some((x) => x.key === 'basic-formal-shoes')).toBe(false);
    expect((await request(app).put('/api/v1/shopping/BAD KEY').set(auth(u.token)).send({ state: 'saved' })).status).toBe(404);
  });
  test('API-SH04 “Do I need it?”: good buy vs. skip', async () => {
    const beige = await request(app).post('/api/v1/shopping/check').set(auth(u.token)).send({ category: 'Bottom', colour: 'Beige', level: 2 });
    expect(beige.body.verdict).toBe('Good buy');
    await addPiece(app, u.token, { category: 'Bottom', colour: 'Black', dressCodes: [2] });
    const black = await request(app).post('/api/v1/shopping/check').set(auth(u.token)).send({ category: 'Bottom', colour: 'Black' });
    expect(black.body).toMatchObject({ verdict: 'Skip' });
    expect(black.body.similarOwned).toHaveLength(2);
  });
});

describe('Admin (Sprint 3 early start, US-80)', () => {
  async function admin() {
    const a = await registerUser(app, 'admin@closet.app');
    await pool.query("UPDATE accounts.users SET role = 'admin' WHERE id = $1", [a.user.id]);
    return a;
  }
  test('API-AD01 a normal user gets 403', async () => {
    expect((await request(app).get('/api/v1/admin/users').set(auth(u.token))).status).toBe(403);
  });
  test('API-AD02 admin sees accounts with counts only, never pieces', async () => {
    const a = await admin();
    const r = await request(app).get('/api/v1/admin/users').set(auth(a.token));
    expect(r.status).toBe(200);
    const me = r.body.users.find((x) => x.email === u.email);
    expect(me).toMatchObject({ pieces: 9, status: 'active', role: 'user' });
    expect(JSON.stringify(r.body)).not.toMatch(/photo|password/i);
    expect((await request(app).get('/api/v1/admin/stats').set(auth(a.token))).body).toMatchObject({ users: 2, pieces: 9 });
  });
  test('API-AD03 suspend ends the user’s session at once; restore lets them sign in again', async () => {
    const a = await admin();
    const s = await request(app).patch(`/api/v1/admin/users/${u.user.id}`).set(auth(a.token)).send({ status: 'suspended' });
    expect(s.body.status).toBe('suspended');
    expect((await request(app).get('/api/v1/items').set(auth(u.token))).status).toBe(401);
    expect((await request(app).post('/api/v1/auth/login').send({ email: u.email, password: u.password })).status).toBe(403);
    await request(app).patch(`/api/v1/admin/users/${u.user.id}`).set(auth(a.token)).send({ status: 'active' });
    expect((await request(app).post('/api/v1/auth/login').send({ email: u.email, password: u.password })).status).toBe(200);
  });
  test('API-AD04 an admin cannot suspend themselves', async () => {
    const a = await admin();
    expect((await request(app).patch(`/api/v1/admin/users/${a.user.id}`).set(auth(a.token)).send({ status: 'suspended' })).status).toBe(409);
  });
});
