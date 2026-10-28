// API / integration tests of the v1.6 garment lifecycle against a real PostgreSQL test database:
// Care (repairs & alterations, at the tailor), Borrow & lend, Donation (donate only), and that EVERY module
// reads the same lifecycle: Style me, Planner conflicts, multi-day plans, packing, Ask Closet, notifications.
// Every test checks STATE after the action (GET after the mutation).
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
  await add('blouse', { name: 'Ivory silk blouse', category: 'Top', colour: 'White', fabric: 'Silk', dressCodes: [2, 3, 4], styles: ['Elegant'] });
  await add('ribbed', { name: 'Black ribbed top', category: 'Top', colour: 'Black', fabric: 'Knit', dressCodes: [1, 2, 3], styles: ['Minimal'] });
  await add('jeans', { name: 'Light-wash jeans', category: 'Bottom', colour: 'Blue', fabric: 'Denim', dressCodes: [1, 2], styles: ['Casual'] });
  await add('trousers', { name: 'Black tailored trousers', category: 'Bottom', colour: 'Black', dressCodes: [1, 2, 3, 4], styles: ['Classic'] });
  await add('skirt', { name: 'Cream pleated skirt', category: 'Bottom', colour: 'Beige', dressCodes: [1, 2, 3, 4], styles: ['Chic'] });
  await add('sneakers', { name: 'White sneakers', category: 'Shoes', colour: 'White', dressCodes: [1, 2], styles: ['Casual'] });
  await add('loafers', { name: 'Black loafers', category: 'Shoes', colour: 'Black', dressCodes: [1, 2, 3, 4], styles: ['Classic'] });
  await add('blazer', { name: 'Black blazer', category: 'Layer', colour: 'Black', fabric: 'Wool', season: 'All seasons', dressCodes: [2, 3, 4], styles: ['Classic'] });
  await add('denim', { name: 'Denim jacket', category: 'Layer', colour: 'Blue', fabric: 'Denim', season: 'All seasons', dressCodes: [1, 2], styles: ['Casual'] });
  await pool.query("UPDATE wardrobe.items SET created_at = now() - interval '400 days', wear_count = 3, last_worn_at = now() - interval '5 days'");
  await pool.query("UPDATE wardrobe.items SET last_worn_at = now() - interval '104 days' WHERE id = $1", [P.denim.id]);
}
const api = (method, url, token = u.token) => request(app)[method](`/api/v1${url}`).set(auth(token));
const chat = (message) => api('post', '/chat').send({ message });
// “Style this piece”: three looks around the piece when it can be worn, none when it can’t (same rule as Style me).
const styleable = async (id) => (await api('post', '/recommendations').send({ occasion: 'Work', fixedId: id })).body.outfits.length > 0;
const recommendedAnywhere = async (id) => {
  for (const occasion of ['Work', 'Interview', 'Dinner', 'University']) {
    if ((await api('post', '/recommendations').send({ occasion })).body.outfits.some((o) => o.itemIds.includes(id))) return true;
  }
  return false;
};
beforeEach(async () => { await resetDb(); weatherState.tempC = 22; u = await registerUser(app); await closet(); });
afterAll(() => pool.end());

describe('Repairs & alterations (Care)', () => {
  test('LC-01 the exact flow: Repair / Alter → Needs alteration “Sleeves too long” → Send to tailor → AT TAILOR in Care → not in Style me → Mark collected → Available again', async () => {
    expect(await styleable(P.blazer.id)).toBe(true); // baseline: it can be styled when Available
    const a = await api('post', `/items/${P.blazer.id}/care`).send({ kind: 'alteration', reason: 'Sleeves too long', notes: 'Shorten 2 cm' });
    expect(a.body).toMatchObject({ status: 'Needs alteration', care: { kind: 'alteration', reason: 'Sleeves too long', notes: 'Shorten 2 cm' } });
    expect((await api('get', '/care')).body.needsAlteration.map((p) => p.id)).toEqual([P.blazer.id]);
    const t = await api('post', `/items/${P.blazer.id}/care/tailor`).send({ tailor: 'Hany', sentOn: day(0), expectedBack: day(4), cost: 150 });
    expect(t.body).toMatchObject({ status: 'At tailor', statusUntil: day(4), care: { tailor: 'Hany', sentOn: day(0), expectedBack: day(4), cost: 150 } });
    const care = (await api('get', '/care')).body;
    expect(care.atTailor.map((p) => p.name)).toEqual(['Black blazer']);
    expect(care.needsAlteration).toHaveLength(0);
    expect((await api('get', '/items')).body.items.find((p) => p.id === P.blazer.id).status).toBe('At tailor'); // still visible in Closet
    expect(await recommendedAnywhere(P.blazer.id)).toBe(false);
    expect(await styleable(P.blazer.id)).toBe(false);
    const done = await api('post', `/items/${P.blazer.id}/care/done`).send({});
    expect(done.body).toMatchObject({ status: 'Available', care: null, message: expect.stringMatching(/Collected from the tailor/) });
    const after = (await api('get', '/care')).body;
    expect(after.atTailor).toHaveLength(0);
    expect(after.history[0]).toMatchObject({ name: 'Black blazer', kind: 'alteration', reason: 'Sleeves too long', tailor: 'Hany', outcome: 'collected' });
    expect(await styleable(P.blazer.id)).toBe(true); // eligible again
  });
  test('LC-02 “should be ready from the tailor today”: TAILOR_READY notice on the expected day; Remind me later hides it; Fixed at home closes a repair without a tailor', async () => {
    await api('post', `/items/${P.blazer.id}/care`).send({ kind: 'alteration', reason: 'Sleeves too long' });
    await api('post', `/items/${P.blazer.id}/care/tailor`).send({ expectedBack: day(0) });
    const n = (await api('get', '/notifications')).body.notifications.find((x) => x.type === 'TAILOR_READY');
    expect(n).toMatchObject({ text: 'Your black blazer should be ready from the tailor today.', action: { label: 'Mark collected', itemId: P.blazer.id } });
    await api('post', `/intelligence/tailor/${P.blazer.id}/remind`).send({ days: 2 });
    expect((await api('get', '/notifications')).body.notifications.some((x) => x.type === 'TAILOR_READY')).toBe(false);
    await api('post', `/items/${P.loafers.id}/care`).send({ kind: 'repair', reason: 'Heel worn down' });
    expect((await api('post', `/items/${P.loafers.id}/care/done`).send({})).body).toMatchObject({ status: 'Available', message: expect.stringMatching(/Fixed/) });
    expect((await api('get', '/care')).body.history.find((h) => h.reason === 'Heel worn down').outcome).toBe('fixed');
  });
  test('LC-03 a planned outfit with a piece in Needs repair / At tailor (back too late) / Ready to donate is a Planner conflict; Replace item changes only that piece', async () => {
    const e = (await api('post', '/events').send({ title: 'Presentation', date: day(2), time: '11:00', occasion: 'Work' })).body;
    await api('put', `/events/${e.id}/outfit`).send({ itemIds: [P.blouse.id, P.trousers.id, P.loafers.id, P.blazer.id] });
    await api('post', `/items/${P.blazer.id}/care`).send({ kind: 'repair', reason: 'Torn lining' });
    let c = (await api('get', '/intelligence/conflicts')).body.conflicts.find((x) => x.itemId === P.blazer.id);
    expect(c.message).toMatch(/black blazer is waiting for a repair/);
    await api('post', `/items/${P.blazer.id}/care/tailor`).send({ expectedBack: day(6) });
    c = (await api('get', '/intelligence/conflicts')).body.conflicts.find((x) => x.itemId === P.blazer.id);
    expect(c.message).toMatch(/at the tailor until/);
    const fix = await api('post', `/intelligence/conflicts/${e.id}/fix`).send({ itemId: P.blazer.id });
    expect(fix.status).toBe(200);
    const ids = fix.body.event.plannedOutfit.itemIds || fix.body.event.plannedOutfit.pieces.map((p) => p.id);
    expect(ids).not.toContain(P.blazer.id);
    expect(ids).toEqual(expect.arrayContaining([P.blouse.id, P.trousers.id, P.loafers.id]));
    // back in time is not a conflict
    await api('post', `/items/${P.blazer.id}/care/done`).send({});
    await api('put', `/events/${e.id}/outfit`).send({ itemIds: [P.blouse.id, P.trousers.id, P.loafers.id, P.blazer.id] });
    await api('post', `/items/${P.blazer.id}/care`).send({ kind: 'repair', reason: 'Button' });
    await api('post', `/items/${P.blazer.id}/care/tailor`).send({ expectedBack: day(1) });
    expect((await api('get', '/intelligence/conflicts')).body.conflicts.some((x) => x.itemId === P.blazer.id)).toBe(false);
  });
  test('LC-04 rules: a piece in the laundry cannot go for repair; the tailor needs a reason first; return before sending → 400; another user’s piece → 404', async () => {
    await api('patch', `/items/${P.tee.id}/status`).send({ status: 'Laundry' });
    expect((await api('post', `/items/${P.tee.id}/care`).send({ kind: 'repair', reason: 'Hole' })).status).toBe(409);
    expect((await api('post', `/items/${P.shirt.id}/care/tailor`).send({ expectedBack: day(3) })).status).toBe(409);
    await api('post', `/items/${P.shirt.id}/care`).send({ kind: 'repair', reason: 'Collar' });
    expect((await api('post', `/items/${P.shirt.id}/care/tailor`).send({ sentOn: day(3), expectedBack: day(1) })).status).toBe(400);
    expect((await api('post', `/items/${P.shirt.id}/care`).send({ kind: 'mend', reason: 'x' })).status).toBe(400);
    expect((await api('post', `/items/${P.shirt.id}/care`).send({ kind: 'repair' })).status).toBe(400);
    const other = await registerUser(app, 'nour@example.com');
    expect((await api('post', `/items/${P.shirt.id}/care/done`, other.token).send({})).status).toBe(404);
    expect((await api('get', '/care', other.token)).body.needsRepair).toHaveLength(0);
  });
});

describe('Borrow & lend', () => {
  test('LC-10 Lend item → Borrowed everywhere (Closet, Style me, Planner, Borrow & lend, Ask) → Mark returned → Available, history kept', async () => {
    const l = await api('post', `/items/${P.blazer.id}/lend`).send({ person: 'Nour', lentOn: day(0), dueOn: day(7), note: 'Graduation' });
    expect(l.body).toMatchObject({ status: 'Borrowed', loan: { person: 'Nour', lentOn: day(0), dueOn: day(7), note: 'Graduation' } });
    expect(await recommendedAnywhere(P.blazer.id)).toBe(false);
    const e = (await api('post', '/events').send({ title: 'Dinner', date: day(3), time: '20:00', occasion: 'Dinner' })).body;
    await api('put', `/events/${e.id}/outfit`).send({ itemIds: [P.blouse.id, P.skirt.id, P.loafers.id, P.blazer.id] });
    expect((await api('get', '/intelligence/conflicts')).body.conflicts.find((x) => x.itemId === P.blazer.id).message).toMatch(/lent out until/);
    const lending = (await api('get', '/lending')).body;
    expect(lending.current[0]).toMatchObject({ id: P.blazer.id, loan: { person: 'Nour' }, overdueDays: 0 });
    expect((await chat('Who has my black blazer?')).body.reply).toMatch(/with Nour/);
    expect((await api('post', `/items/${P.blazer.id}/return`).send({})).body.status).toBe('Available');
    const after = (await api('get', '/lending')).body;
    expect(after.current).toHaveLength(0);
    expect(after.history[0]).toMatchObject({ name: 'Black blazer', person: 'Nour', lentOn: day(0), returnedOn: day(0) });
    expect((await api('get', '/intelligence/conflicts')).body.conflicts.some((x) => x.itemId === P.blazer.id)).toBe(false);
  });
  test('LC-11 overdue: “7 days overdue”, BORROW_RETURN notice; return date before the lending date → 400; not lent → 409', async () => {
    await api('post', `/items/${P.blazer.id}/lend`).send({ person: 'Nour', lentOn: day(-12), dueOn: day(-7) });
    const c = (await api('get', '/lending')).body;
    expect(c).toMatchObject({ overdue: 1, current: [{ overdueDays: 7, daysOut: 12 }] });
    expect((await api('get', '/notifications')).body.notifications.some((n) => n.type === 'BORROW_RETURN' && /12 days/.test(n.text))).toBe(true);
    expect((await api('post', `/items/${P.tee.id}/lend`).send({ person: 'Salma', lentOn: day(3), dueOn: day(1) })).status).toBe(400);
    expect((await api('post', `/items/${P.tee.id}/lend`).send({ person: 'Salma' })).status).toBe(400);
    expect((await api('post', `/items/${P.tee.id}/return`).send({})).status).toBe(409);
  });
  test('LC-12 Ask Closet “Lend my black blazer to Nour until Friday” records the loan with the person; Undo returns it', async () => {
    const r = (await chat('Lend my black blazer to Nour until Friday')).body;
    expect(r).toMatchObject({ function: 'lend_piece' });
    expect((await api('get', `/items/${P.blazer.id}`)).body).toMatchObject({ status: 'Borrowed', loan: { person: 'Nour' } });
    await api('post', `/chat/undo/${r.undoId}`).send({});
    expect((await api('get', `/items/${P.blazer.id}`)).body.status).toBe('Available');
  });
});

describe('One lifecycle for every module', () => {
  test('LC-20 multi-day plans skip pieces in care, lent, packed or ready to donate', async () => {
    await api('post', `/items/${P.blazer.id}/care`).send({ kind: 'alteration', reason: 'Sleeves' });
    await api('post', `/items/${P.loafers.id}/lend`).send({ person: 'Nour', dueOn: day(20) });
    await api('post', `/items/${P.skirt.id}/donate`).send({});
    await api('patch', `/items/${P.sneakers.id}/status`).send({ status: 'Packed', until: day(20) });
    const plan = (await api('post', '/intelligence/plan-days').send({ days: 3 })).body;
    const used = plan.days.flatMap((d) => (d.outfit ? d.outfit.itemIds : []));
    for (const id of [P.blazer.id, P.loafers.id, P.skirt.id, P.sneakers.id]) expect(used).not.toContain(id);
  });
  test('LC-21 Home status counts come from the one lifecycle (closet filter counts every state)', async () => {
    await api('patch', `/items/${P.tee.id}/status`).send({ status: 'Laundry' });
    await api('post', `/items/${P.blazer.id}/care`).send({ kind: 'alteration', reason: 'Sleeves' });
    await api('post', `/items/${P.blazer.id}/care/tailor`).send({ expectedBack: day(3) });
    await api('post', `/items/${P.shirt.id}/care`).send({ kind: 'repair', reason: 'Collar' });
    await api('post', `/items/${P.loafers.id}/lend`).send({ person: 'Nour', dueOn: day(5) });
    await api('post', `/items/${P.denim.id}/donate`).send({});
    const s = (await api('get', '/items')).body.counts.status;
    expect(s).toMatchObject({ Laundry: 1, 'At tailor': 1, 'Needs repair': 1, Borrowed: 1, 'Ready to donate': 1, Available: 6 });
  });
  test('LC-22 a piece waiting for donation or repair is not counted as owned for duplicates / purchase impact; the simulation never creates a piece', async () => {
    const before = (await api('get', '/items')).body.total;
    const dup = (await api('post', '/shopping/impact').send({ category: 'Top', colour: 'Black', name: 'fitted top', styles: ['Minimal'], dressCodes: [1, 2, 3] })).body;
    expect(dup.similarOwned).toBeGreaterThanOrEqual(1);
    const useful = (await api('post', '/shopping/impact').send({ category: 'Shoes', colour: 'White', name: 'loafers', styles: ['Classic'], dressCodes: [2, 3] })).body;
    expect(useful.newCombinations).toBeGreaterThan(dup.newCombinations);
    expect(Object.keys(useful)).toEqual(expect.arrayContaining(['newCombinations', 'similarOwned', 'fillsGap', 'occasions', 'recommendation']));
    await api('post', `/items/${P.ribbed.id}/donate`).send({});
    const after = (await api('post', '/shopping/impact').send({ category: 'Top', colour: 'Black', name: 'fitted top', styles: ['Minimal'], dressCodes: [1, 2, 3] })).body;
    expect(after.similarOwned).toBeLessThan(dup.similarOwned);
    expect((await api('get', '/items')).body.total).toBe(before);
  });
  test('LC-23 event rescue: the wardrobe first — three Available looks for an interview tomorrow, no shopping; a real gap only when it cannot', async () => {
    const r = (await api('post', '/intelligence/rescue').send({ occasion: 'Interview', date: day(1) })).body;
    expect(r).toMatchObject({ solved: true, shopping: false, gap: null });
    expect(r.outfits).toHaveLength(3);
    for (const o of r.outfits) for (const p of o.pieces) expect(p.status).toBe('Available');
    for (const id of [P.blouse.id, P.shirt.id, P.ribbed.id, P.tee.id]) await api('patch', `/items/${id}/status`).send({ status: 'Laundry' });
    await api('post', `/items/${P.trousers.id}/lend`).send({ person: 'Nour', dueOn: day(9) });
    const none = (await api('post', '/intelligence/rescue').send({ occasion: 'Interview', date: day(1) })).body;
    expect(none).toMatchObject({ solved: false, outfits: [] });
  });
});

describe('Ask Closet reads the current lifecycle (no canned answers)', () => {
  test('LC-30 the required prompts route to the right function and answer from real state', async () => {
    await api('post', `/items/${P.blazer.id}/care`).send({ kind: 'alteration', reason: 'Sleeves too long' });
    await api('post', `/items/${P.blazer.id}/care/tailor`).send({ tailor: 'Hany', expectedBack: day(3) });
    await api('post', `/items/${P.denim.id}/donate`).send({});
    const cases = [
      ['What needs repair?', 'care_list', /black blazer is at the tailor \(Hany\)/i],
      ['When is my black blazer back from the tailor?', 'availability', new RegExp(`at the tailor \\(Hany\\) for an alteration: sleeves too long\\. Expected back ${day(3)}`)],
      ['What clothes are ready to donate?', 'donation_list', /1 piece is ready to donate: denim jacket/],
      ['What could I donate?', 'donate_candidates', /./],
      ['Would black loafers add anything to my wardrobe?', 'buy_check', /Simulated/],
      ['I have a wedding tomorrow and nothing to wear.', 'event_rescue', /Not enough Available pieces for Formal/], // this small test closet has no formal pieces: an honest gap, never a canned answer
      ['Is tomorrow’s outfit still okay?', 'plan_check', /./],
      ['What has my best cost per wear?', 'value', /./],
      ['Do I need to do laundry before Monday?', 'laundry_risk', /./],
      ["What haven't I packed?", 'unpacked', /./],
    ];
    for (const [q, fn, re] of cases) {
      const r = (await chat(q)).body;
      expect([q, r.function]).toEqual([q, fn]);
      expect(r.reply).toMatch(re);
    }
    await api('post', `/items/${P.blazer.id}/care/done`).send({});
    expect((await chat('When is my black blazer back from the tailor?')).body.reply).toMatch(/isn’t at the tailor — it is clean and at home/);
  });
});
