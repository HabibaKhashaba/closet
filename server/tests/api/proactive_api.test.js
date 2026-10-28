// API / integration tests of the v1.5 proactive features against a real PostgreSQL test database.
// Every test checks STATE after the action (GET after the mutation), not just the response of the call.
const request = require('supertest');
const { makeApp, resetDb, pool, registerUser, addPiece, auth, weatherState } = require('../helpers');

const app = makeApp();
let u;
const P = {};
const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
async function closet() {
  const add = async (key, d) => { P[key] = (await addPiece(app, u.token, d)).body; };
  await add('tee', { name: 'White fitted tee', category: 'Top', colour: 'White', dressCodes: [1, 2, 3], styles: ['Minimal'] });
  await add('shirt', { name: 'Blue Oxford shirt', category: 'Top', colour: 'Blue', dressCodes: [1, 2, 3], styles: ['Classic'] });
  await add('blouse', { name: 'Ivory silk blouse', category: 'Top', colour: 'White', fabric: 'Silk', dressCodes: [2, 3], styles: ['Elegant'] });
  await add('jeans', { name: 'Light-wash jeans', category: 'Bottom', colour: 'Blue', fabric: 'Denim', dressCodes: [1, 2], styles: ['Casual'] });
  await add('trousers', { name: 'Black tailored trousers', category: 'Bottom', colour: 'Black', dressCodes: [1, 2, 3, 4], styles: ['Classic'] });
  await add('skirt', { name: 'Cream pleated skirt', category: 'Bottom', colour: 'Beige', dressCodes: [1, 2, 3], styles: ['Chic'] });
  await add('sneakers', { name: 'White sneakers', category: 'Shoes', colour: 'White', dressCodes: [1, 2], styles: ['Casual'] });
  await add('loafers', { name: 'Black loafers', category: 'Shoes', colour: 'Black', dressCodes: [1, 2, 3, 4], styles: ['Classic'] });
  await add('blazer', { name: 'Navy blazer', category: 'Layer', colour: 'Navy', fabric: 'Wool', season: 'Spring / Autumn', dressCodes: [2, 3, 4], styles: ['Classic'] });
  await add('denim', { name: 'Denim jacket', category: 'Layer', colour: 'Blue', fabric: 'Denim', season: 'All seasons', dressCodes: [1, 2], styles: ['Casual'] });
  await add('knit', { name: 'Cream knit sweater', category: 'Top', colour: 'Beige', fabric: 'Knit', season: 'Winter', dressCodes: [1, 2], styles: ['Classic'] });
  // the closet has existed for a while; the denim jacket was last worn 104 days ago
  await pool.query("UPDATE wardrobe.items SET created_at = now() - interval '400 days', wear_count = 3, last_worn_at = now() - interval '5 days'");
  await pool.query("UPDATE wardrobe.items SET last_worn_at = now() - interval '104 days' WHERE id = $1", [P.denim.id]);
  await pool.query("UPDATE wardrobe.items SET last_worn_at = now() - interval '60 days' WHERE id = $1", [P.knit.id]);
}
const api = (method, url, token = u.token) => request(app)[method](`/api/v1${url}`).set(auth(token));
beforeEach(async () => { await resetDb(); weatherState.tempC = 24; u = await registerUser(app); await closet(); });
afterAll(() => pool.end());

describe('Long-unworn pieces → style, keep or donate (user decides)', () => {
  test('API-PR01 the 104-day denim jacket is a candidate; Keep it snoozes it; another user cannot keep my piece', async () => {
    const f = await api('get', '/intelligence/forgotten');
    expect(f.body.top).toMatchObject({ id: P.denim.id, days: 104 });
    expect(f.body.candidates.map((c) => c.id)).not.toContain(P.knit.id); // winter knit at 24 °C is not judged now
    const other = await registerUser(app, 'karim@example.com');
    expect((await api('post', `/intelligence/forgotten/${P.denim.id}/keep`, other.token).send({})).status).toBe(404);
    const k = await api('post', `/intelligence/forgotten/${P.denim.id}/keep`).send({ reason: 'Still love it' });
    expect(k.status).toBe(200);
    expect((await api('get', '/intelligence/forgotten')).body.candidates.map((c) => c.id)).not.toContain(P.denim.id);
  });
  test('API-PR02 Donate: Ready to donate → left out of outfits → Mark as donated → gone, history kept, NO replacement', async () => {
    expect((await api('post', `/items/${P.denim.id}/rehome/done`).send({})).status).toBe(409); // must be marked first
    const m = await api('post', `/items/${P.denim.id}/rehome`).send({ method: 'donate' });
    expect(m.body.rehome).toMatchObject({ method: 'donate', label: 'Ready to donate' });
    expect((await api('get', `/items/${P.denim.id}`)).body.rehome.label).toBe('Ready to donate'); // still in the closet
    const looks = await api('post', '/recommendations').send({ occasion: 'University', tempC: 15 });
    expect(looks.body.outfits.some((o) => o.itemIds.includes(P.denim.id))).toBe(false);
    const d = await api('post', `/items/${P.denim.id}/rehome/done`).send({});
    expect(d.body).toMatchObject({ deleted: true, reason: 'Donated', addedToShoppingList: null });
    expect((await api('get', `/items/${P.denim.id}`)).status).toBe(404);
    expect((await api('get', '/items')).body.items.map((i) => i.id)).not.toContain(P.denim.id);
    expect((await api('get', '/shopping/list')).body.items).toHaveLength(0);
    const { rows } = await pool.query('SELECT reason, name FROM wardrobe.deletions WHERE user_id = $1', [u.user.id]);
    expect(rows).toEqual([{ reason: 'Donated', name: 'Denim jacket' }]);
    expect((await api('get', '/intelligence/forgotten')).body.stats.passedOn).toBe(1);
  });
  test('API-PR03 Cancel brings the piece back to normal; invalid method → 400; someone else’s piece → 404', async () => {
    expect((await api('post', `/items/${P.denim.id}/rehome`).send({ method: 'burn' })).status).toBe(400);
    const other = await registerUser(app, 'salma2@example.com');
    expect((await api('post', `/items/${P.denim.id}/rehome`, other.token).send({ method: 'give' })).status).toBe(404);
    await api('post', `/items/${P.denim.id}/rehome`).send({ method: 'give' });
    expect((await api('delete', `/items/${P.denim.id}/rehome`)).body.rehome).toBeNull();
  });
});

describe('Seasonal rotation', () => {
  test('API-PR10 at 30 °C the winter knit is suggested; Pack for season → Packed (seasonal storage); Bring back → Available', async () => {
    weatherState.tempC = 30;
    const s = await api('get', '/intelligence/seasonal');
    expect(s.body.pack.map((p) => p.id)).toEqual([P.knit.id]);
    expect((await api('get', `/items/${P.knit.id}`)).body.status).toBe('Available'); // nothing changes without the user
    await api('post', '/intelligence/seasonal').send({ action: 'pack', itemIds: [P.knit.id] });
    const knit = (await api('get', `/items/${P.knit.id}`)).body;
    expect(knit).toMatchObject({ status: 'Packed', statusNote: 'Seasonal storage' });
    const looks = await api('post', '/recommendations').send({ occasion: 'Everyday', tempC: 12 });
    expect(looks.body.outfits.some((o) => o.itemIds.includes(P.knit.id))).toBe(false); // packed: excluded
    expect((await api('get', '/intelligence/seasonal')).body.pack).toHaveLength(0); // not suggested again
    weatherState.tempC = 12;
    expect((await api('get', '/intelligence/seasonal')).body.bringBack.map((p) => p.id)).toEqual([P.knit.id]);
    await api('post', '/intelligence/seasonal').send({ action: 'bring_back', itemIds: [P.knit.id] });
    expect((await api('get', `/items/${P.knit.id}`)).body.status).toBe('Available');
  });
});

describe('Laundry intelligence', () => {
  test('API-PR20 the two most-worn work tops in the laundry before a Work event → warning; Wash done clears it', async () => {
    await pool.query('UPDATE wardrobe.items SET wear_count = 20 WHERE id = ANY($1)', [[P.tee.id, P.shirt.id]]);
    await api('post', '/events').send({ title: 'Monday meeting', date: day(2), time: '09:00', occasion: 'Work' });
    expect((await api('get', '/intelligence/laundry-risk')).body.warnings).toHaveLength(0);
    for (const id of [P.tee.id, P.shirt.id]) await api('patch', `/items/${id}/status`).send({ status: 'Laundry' });
    const w = (await api('get', '/intelligence/laundry-risk')).body.warnings;
    expect(w).toHaveLength(1);
    expect(w[0].message).toMatch(/2 of your 3 most-worn business casual tops are in the laundry/);
    await api('post', '/laundry/wash-done');
    expect((await api('get', '/intelligence/laundry-risk')).body.warnings).toHaveLength(0);
  });
  test('API-PR21 a 3-day plan never repeats a top, bottom or dress and skips laundry pieces', async () => {
    await api('patch', `/items/${P.tee.id}/status`).send({ status: 'Laundry' });
    await pool.query("UPDATE availability.item_status SET changed_at = now() + interval '30 days' WHERE item_id = $1", [P.tee.id]); // not back in time
    const r = (await api('post', '/intelligence/plan-days').send({ days: 3, occasion: 'University' })).body;
    expect(r.days).toHaveLength(3);
    const ids = r.days.flatMap((d) => (d.outfit ? d.outfit.itemIds.filter((id) => !d.repeated.includes(id)) : []));
    expect(ids).not.toContain(P.tee.id);
    const clothes = ids.filter((id) => [P.shirt.id, P.blouse.id, P.knit.id, P.jeans.id, P.trousers.id, P.skirt.id].includes(id));
    expect(new Set(clothes).size).toBe(clothes.length);
  });
});

describe('Planned-outfit monitor: weather + availability, one system', () => {
  async function planTomorrow() {
    const ev = (await api('post', '/events').send({ title: 'SE presentation', date: day(1), time: '11:00', occasion: 'Work' })).body;
    await api('put', `/events/${ev.id}/outfit`).send({ itemIds: [P.shirt.id, P.trousers.id, P.loafers.id, P.blazer.id], ruleScore: 100 });
    return ev;
  }
  test('API-PR30 a planned piece goes to the laundry → alert from the CURRENT status; Adjust changes only that piece', async () => {
    const ev = await planTomorrow();
    expect((await api('get', '/intelligence/monitor')).body.alerts).toHaveLength(0);
    await api('patch', `/items/${P.blazer.id}/status`).send({ status: 'Laundry' });
    const a = (await api('get', '/intelligence/monitor')).body.alerts;
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ kind: 'availability', itemId: P.blazer.id, actions: ['Replace item', 'Wash first', 'Ignore'] });
    const fix = await api('post', `/intelligence/monitor/${ev.id}/adjust`).send({ itemId: P.blazer.id });
    expect(fix.status).toBe(200);
    const planned = fix.body.event.plannedOutfit.pieces.map((p) => p.id);
    expect(planned).not.toContain(P.blazer.id);
    expect(planned).toEqual(expect.arrayContaining([P.shirt.id, P.trousers.id, P.loafers.id]));
    expect((await api('get', '/intelligence/monitor')).body.alerts).toHaveLength(0);
  });
  test('API-PR31 BVA: planned at 24 °C, now 30 °C → weather alert on the wool blazer; 28 °C → no alert', async () => {
    await planTomorrow();
    weatherState.tempC = 28;
    expect((await api('get', '/intelligence/monitor')).body.alerts).toHaveLength(0);
    weatherState.tempC = 30;
    const a = (await api('get', '/intelligence/monitor')).body.alerts;
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ kind: 'weather', itemId: P.blazer.id, planned: { tempC: 24 }, current: { tempC: 30 } });
    expect(a[0].message).toMatch(/30 °C instead of 24 °C/);
    const n = (await api('get', '/notifications')).body.notifications.filter((x) => x.type === 'WEATHER_CHANGE');
    expect(n).toHaveLength(1);
    expect(n[0].level).toBe('HIGH');
    expect((await api('get', '/notifications')).body.notifications.filter((x) => x.type === 'WEATHER_CHANGE')).toHaveLength(1); // deduplicated
  });
  test('API-PR32 Packed and Borrowed planned pieces are caught too', async () => {
    await planTomorrow();
    await api('patch', `/items/${P.loafers.id}/status`).send({ status: 'Borrowed', note: 'Salma', until: day(5) });
    await api('patch', `/items/${P.blazer.id}/status`).send({ status: 'Packed' });
    const kinds = (await api('get', '/intelligence/monitor')).body.alerts.map((x) => `${x.kind}:${x.status}`).sort();
    expect(kinds).toEqual(['availability:Borrowed', 'availability:Packed']);
  });
});

describe('Borrow tracker', () => {
  test('API-PR40 borrower and dates persist; overdue reminder; Remind me later; Mark returned → Available', async () => {
    await api('patch', `/items/${P.blazer.id}/status`).send({ status: 'Borrowed', note: 'Salma', until: day(3) });
    await pool.query("UPDATE availability.item_status SET changed_at = now() - interval '12 days', until = CURRENT_DATE - 5 WHERE item_id = $1", [P.blazer.id]);
    const b = (await api('get', '/intelligence/borrowed')).body;
    expect(b.borrowed[0]).toMatchObject({ id: P.blazer.id, borrowedBy: 'Salma', days: 12, overdue: true });
    expect((await api('get', '/notifications')).body.notifications.some((n) => n.type === 'BORROW_RETURN' && /12 days/.test(n.text))).toBe(true);
    await api('post', `/intelligence/borrowed/${P.blazer.id}/remind`).send({ days: 3 });
    expect((await api('get', '/intelligence/borrowed')).body.overdue).toHaveLength(0);
    expect((await api('post', '/recommendations').send({ occasion: 'Work' })).body.outfits.some((o) => o.itemIds.includes(P.blazer.id))).toBe(false);
    await api('patch', `/items/${P.blazer.id}/status`).send({ status: 'Available' });
    expect((await api('get', '/intelligence/borrowed')).body.borrowed).toHaveLength(0);
  });
});

describe('Cost per wear', () => {
  test('API-PR50 optional price; recalculated after a confirmed wear and after an edit; removable', async () => {
    expect((await api('get', `/items/${P.loafers.id}`)).body.costPerWear).toEqual({ hasPrice: false, text: null });
    expect((await api('patch', `/items/${P.loafers.id}`).send({ price: -5 })).status).toBe(400);
    const e = await api('patch', `/items/${P.loafers.id}`).send({ price: 2400, currency: 'EGP' });
    expect(e.body.costPerWear).toMatchObject({ perWear: 800, wears: 3, currency: 'EGP' });
    await api('post', '/outfits/wear').send({ itemIds: [P.shirt.id, P.trousers.id, P.loafers.id] });
    expect((await api('get', `/items/${P.loafers.id}`)).body.costPerWear.perWear).toBe(600);
    await api('post', '/outfits').send({ itemIds: [P.shirt.id, P.trousers.id, P.loafers.id] }); // saving is NOT wearing
    expect((await api('get', `/items/${P.loafers.id}`)).body.costPerWear.perWear).toBe(600);
    expect((await api('patch', `/items/${P.loafers.id}`).send({ price: 1200 })).body.costPerWear.perWear).toBe(300);
    expect((await api('patch', `/items/${P.loafers.id}`).send({ price: null })).body).toMatchObject({ price: null, currency: null, costPerWear: { hasPrice: false } });
  });
});

describe('Outfit memory and saved looks', () => {
  test('API-PR60 wearing stores the context (event, temperature, rating); Ask Closet finds it', async () => {
    await api('post', '/outfits/wear').send({ itemIds: [P.blouse.id, P.skirt.id, P.loafers.id], rating: 5, occasion: 'Dinner', tempC: 27, condition: 'Clear', eventTitle: 'Salma’s birthday' });
    const h = (await api('get', '/outfits/history')).body.wears[0];
    expect(h).toMatchObject({ rating: 5, occasion: 'Dinner', eventTitle: 'Salma’s birthday', weather: { tempC: 27 } });
    const m = (await api('get', `/intelligence/memory?q=${encodeURIComponent("what did I wear to salma's birthday")}`)).body;
    expect(m.matches[0].eventTitle).toBe('Salma’s birthday');
    const c = (await api('post', '/chat').send({ message: 'What did I wear to Salma’s birthday?' })).body;
    expect(c).toMatchObject({ function: 'memory' });
    expect(c.reply).toMatch(/Salma’s birthday · 27 °C · ★★★★★/);
  });
  test('API-PR61 Save then Favourite (and Favourite then Save) keep ONE record (defect D-10)', async () => {
    const ids = [P.shirt.id, P.jeans.id, P.sneakers.id];
    const s = await api('post', '/outfits').send({ itemIds: ids, occasion: 'University' });
    const f = await api('post', '/outfits').send({ itemIds: [...ids].reverse(), occasion: 'University', favorite: true });
    expect(f.status).toBe(200);
    expect(f.body.id).toBe(s.body.id);
    expect((await api('get', '/outfits')).body.outfits).toHaveLength(1);
    expect((await api('get', '/outfits?favorites=true')).body.outfits.map((o) => o.id)).toEqual([s.body.id]);
    await api('post', '/outfits').send({ itemIds: ids }); // a later Save never removes the favourite
    expect((await api('get', '/outfits?favorites=true')).body.outfits).toHaveLength(1);
    await api('patch', `/outfits/${s.body.id}`).send({ favorite: false }); // unfavourite: stays under All looks
    expect((await api('get', '/outfits?favorites=true')).body.outfits).toHaveLength(0);
    expect((await api('get', '/outfits')).body.outfits).toHaveLength(1);
  });
  test('API-PR62 repeat insight: a 5★ look is offered again; with repeats switched off a same-week copy suggests a variation', async () => {
    const ids = [P.shirt.id, P.jeans.id, P.sneakers.id];
    await api('post', '/outfits/wear').send({ itemIds: ids, rating: 3 });
    expect((await api('post', '/intelligence/repeat').send({ itemIds: ids })).body.insight.kind).toBe('variety');
    await api('put', '/profile').send({ allowRepeats: true });
    expect((await api('post', '/intelligence/repeat').send({ itemIds: ids })).body.insight).toBeNull();
  });
});

describe('Smart shopping: duplicates, gap confidence, purchase impact', () => {
  test('API-PR70 adding a near-duplicate warns first; the user can still add it', async () => {
    const s = (await api('post', '/items/similar').send({ category: 'Top', colour: 'White', styles: ['Minimal'], dressCodes: [1, 2] })).body;
    expect(s.message).toMatch(/You already own/);
    expect(s.actions).toEqual(['Add anyway', 'View similar', 'Cancel']);
    expect((await api('post', '/items/similar').send({ category: 'Shoes', colour: 'Red', dressCodes: [5] })).body.count).toBe(0);
    expect((await addPiece(app, u.token, { category: 'Top', colour: 'White', dressCodes: [1, 2], styles: ['Minimal'] })).status).toBe(201);
  });
  test('API-PR71 purchase simulation uses the real wardrobe and never saves the piece', async () => {
    const before = (await api('get', '/items')).body.total;
    const r = (await api('post', '/shopping/impact').send({ category: 'Dress', colour: 'Navy', dressCodes: [4, 5] })).body;
    expect(r).toMatchObject({ simulated: true });
    expect(typeof r.newCombinations).toBe('number');
    expect((await api('get', '/items')).body.total).toBe(before);
    const dup = (await api('post', '/shopping/impact').send({ category: 'Shoes', colour: 'Black', name: 'loafers', dressCodes: [2, 3] })).body;
    expect(dup.recommendation).toBe('Probably unnecessary');
  });
  test('API-PR72 every gap has a confidence and reasons; HIGH comes first', async () => {
    await api('put', '/profile/quiz').send({ dressCode: 5, occasions: ['Wedding'] });
    const g = (await api('get', '/intelligence/gaps')).body.gaps;
    expect(g.length).toBeGreaterThan(0);
    expect(g.every((x) => ['HIGH', 'MEDIUM', 'LOW'].includes(x.confidence) && x.reasons.length)).toBe(true);
    expect(['HIGH', 'MEDIUM', 'LOW'].indexOf(g[0].confidence)).toBeLessThanOrEqual(['HIGH', 'MEDIUM', 'LOW'].indexOf(g[g.length - 1].confidence));
  });
});

describe('Packing Mode trip capsule', () => {
  test('API-PR80 carry-on limits, reuse, and Mark as packed changes the REAL item status (no duplicate records)', async () => {
    const trip = { destination: 'Milan', startDate: day(3), endDate: day(7), tripType: 'Travel', activities: ['University', 'Dinner', 'Everyday'], carryOn: true };
    const plan = (await api('post', '/packing/plan').send(trip)).body;
    expect(plan.counts.clothing).toBeLessThanOrEqual(8);
    expect(plan.counts.shoes).toBeLessThanOrEqual(2);
    expect(plan.summary).toMatch(/possible outfit/);
    const t = (await api('post', '/packing/trips').send(trip)).body;
    const total = (await api('get', '/items')).body.total;
    await api('post', `/packing/trips/${t.id}/pack`);
    const items = (await api('get', '/items')).body;
    expect(items.total).toBe(total);
    expect(t.itemIds.every((id) => items.items.find((i) => i.id === id).status === 'Packed')).toBe(true);
    await api('post', `/packing/trips/${t.id}/unpack`);
    expect((await api('get', '/items')).body.items.filter((i) => t.itemIds.includes(i.id)).every((i) => i.status === 'Available')).toBe(true);
  });
});

describe('Ask Closet routes to real state (several different intents)', () => {
  const chat = (message, context) => api('post', '/chat').send({ message, ...(context && { context }) });
  test('API-PR90 “Is my blazer clean?” reads state and changes nothing; “Put the blazer in the wash” changes it', async () => {
    const q = (await chat('Is my blazer clean?')).body;
    expect(q).toMatchObject({ function: 'availability' });
    expect(q.reply).toMatch(/navy blazer is Available/);
    await chat('Put the blazer in the wash.');
    expect((await api('get', `/items/${P.blazer.id}`)).body.status).toBe('Laundry');
    expect((await chat('Is my blazer clean?')).body.reply).toMatch(/in the laundry/);
    expect((await api('get', '/laundry')).body.items.map((i) => i.id)).toContain(P.blazer.id);
  });
  test('API-PR91 “What could I donate?” → the denim jacket; “I want to keep it” snoozes THAT piece', async () => {
    const d = (await chat('What could I donate?')).body;
    expect(d).toMatchObject({ function: 'donate_candidates', context: { pieceId: P.denim.id } });
    const k = (await chat('I want to keep it.', d.context)).body;
    expect(k.function).toBe('keep_piece');
    const { rows } = await pool.query('SELECT key FROM intelligence.snoozes WHERE user_id = $1', [u.user.id]);
    expect(rows.map((r) => r.key)).toEqual([`keep:${P.denim.id}`]);
    await api('post', `/chat/undo/${k.undoId}`); // undo restores the suggestion
    expect((await pool.query('SELECT key FROM intelligence.snoozes WHERE user_id = $1', [u.user.id])).rows).toHaveLength(0);
  });
  test('API-PR92 “Mark the denim jacket for donation” then “I donated the denim jacket” → gone, no replacement', async () => {
    await chat('Mark the denim jacket for donation.');
    expect((await api('get', `/items/${P.denim.id}`)).body.rehome.method).toBe('donate');
    const done = (await chat('I donated the denim jacket.')).body;
    expect(done.function).toBe('rehome_done');
    expect((await api('get', `/items/${P.denim.id}`)).status).toBe(404);
    expect((await api('get', '/shopping/list')).body.items).toHaveLength(0);
  });
  test('API-PR93 different questions get different functions and answers', async () => {
    const qs = ['What should I wear to university tomorrow?', 'Who has my blazer?', 'Why is my wardrobe health low?', 'What clothes should I pack away?', 'Tell me a joke', 'I have an interview in 2 hours'];
    const r = [];
    for (const q of qs) r.push((await chat(q)).body);
    expect(r.map((x) => x.function)).toEqual(['recommend', 'borrowed', 'health', 'seasonal', 'help', 'event_rescue']);
    expect(new Set(r.map((x) => x.reply)).size).toBe(qs.length);
    expect(r[4].reply).toMatch(/^I can help with your wardrobe, outfits, laundry, shopping, weather and planner/);
    expect(r.every((x) => !/beige trousers/i.test(x.reply))).toBe(true);
  });
});
