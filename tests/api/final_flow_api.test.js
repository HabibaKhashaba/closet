// API tests (final pass): the heart of Closet as demonstrated — three looks with their own names,
// change one piece from a tray of real alternatives, style a forgotten piece (every look contains
// it), and Mix & Match with "Suggest a fix". Sprint 2 / Sprint 3 stories built early — not Sprint 1.
const request = require('supertest');
const { makeApp, resetDb, pool, registerUser, addPiece, auth, weatherState } = require('../helpers');

const app = makeApp();
let u;
const P = {};
async function closet() {
  const add = async (key, d) => { P[key] = (await addPiece(app, u.token, d)).body; };
  await add('tee', { name: 'White fitted tee', category: 'Top', colour: 'White', dressCodes: [1, 2], styles: ['Minimal'] });
  await add('stripe', { name: 'Breton striped top', category: 'Top', colour: 'Navy', dressCodes: [1, 2], styles: ['Classic'] });
  await add('shirt', { name: 'Blue Oxford shirt', category: 'Top', colour: 'Blue', dressCodes: [1, 2, 3], styles: ['Classic'] });
  await add('blouse', { name: 'Ivory silk blouse', category: 'Top', colour: 'White', fabric: 'Silk', dressCodes: [2, 3, 4], styles: ['Elegant'] });
  await add('red', { name: 'Red cropped tee', category: 'Top', colour: 'Red', dressCodes: [1], styles: ['Streetwear'] });
  await add('beige', { name: 'Beige wide-leg trousers', category: 'Bottom', colour: 'Beige', dressCodes: [1, 2, 3], styles: ['Classic'] });
  await add('midi', { name: 'Black midi skirt', category: 'Bottom', colour: 'Black', dressCodes: [1, 2, 3, 4], styles: ['Chic'] });
  await add('tailored', { name: 'Black tailored trousers', category: 'Bottom', colour: 'Black', dressCodes: [2, 3, 4], styles: ['Classic'] });
  await add('sneakers', { name: 'White sneakers', category: 'Shoes', colour: 'White', dressCodes: [1, 2], styles: ['Casual'] });
  await add('loafers', { name: 'Black loafers', category: 'Shoes', colour: 'Black', dressCodes: [1, 2, 3, 4], styles: ['Classic'] });
  await add('bag', { name: 'Structured black bag', category: 'Bag', colour: 'Black', dressCodes: [2, 3, 4, 5], styles: ['Classic'] });
  await add('cardigan', { name: 'Camel cardigan', category: 'Layer', colour: 'Brown', fabric: 'Knit', season: 'Winter', dressCodes: [1, 2], styles: ['Classic'] });
}
const api = (method, url) => request(app)[method](`/api/v1${url}`).set(auth(u.token));
beforeEach(async () => { await resetDb(); weatherState.tempC = 22; u = await registerUser(app); await closet(); });
afterAll(() => pool.end());

describe('Three looks, change one piece (US-19, US-24)', () => {
  test('API-CF03 the three looks each have their own editorial name', async () => {
    const r = await api('post', '/recommendations').send({ occasion: 'University' });
    expect(r.body.outfits).toHaveLength(3);
    const names = r.body.outfits.map((o) => o.title);
    expect(new Set(names).size).toBe(3);
    for (const n of names) expect(n).toMatch(/^[A-Z][\w-]+ [A-Z][\w-]+$/);
  });
  test('API-CF04 the replace tray: up to 3 Available alternatives, each with its re-scored look and only that slot changed', async () => {
    const o = (await api('post', '/recommendations').send({ occasion: 'University' })).body.outfits[0];
    const slot = o.pieces.findIndex((p) => p.category === 'Top');
    const r = await api('post', '/recommendations/swap').send({ occasion: 'University', itemIds: o.itemIds, slot });
    expect(r.status).toBe(200);
    expect(r.body.options.length).toBeGreaterThan(1);
    expect(r.body.options.length).toBeLessThan(4);
    for (const opt of r.body.options) {
      expect(opt.piece.category).toBe('Top');
      expect(opt.piece.status).toBe('Available');
      expect(opt.outfit.itemIds[slot]).toBe(opt.piece.id);
      expect(opt.outfit.itemIds.filter((id, i) => i !== slot)).toEqual(o.itemIds.filter((id, i) => i !== slot));
      expect(typeof opt.outfit.compatibility).toBe('number');
    }
  });
});

describe('Style a forgotten piece (US-54, US-59)', () => {
  test('API-FP01 a piece not worn for 50 days is "forgotten"; Style this piece gives 3 looks that all contain it — even a warm layer at 30 °C', async () => {
    weatherState.tempC = 30;
    await pool.query("UPDATE wardrobe.items SET wear_count = 3, last_worn_at = now() - interval '50 days' WHERE id = $1", [P.cardigan.id]);
    const ins = await api('get', '/insights');
    expect(ins.body.forgotten.map((p) => p.id)).toContain(P.cardigan.id);
    const r = await api('post', '/recommendations').send({ occasion: 'University', fixedId: P.cardigan.id });
    expect(r.status).toBe(200);
    expect(r.body.outfits).toHaveLength(3);
    for (const o of r.body.outfits) expect(o.itemIds).toContain(P.cardigan.id);
    expect(new Set(r.body.outfits.map((o) => o.itemIds.join())).size).toBe(3);
  });
  test('API-FP02 a forgotten piece that is in the laundry cannot be styled: no looks, a plain note', async () => {
    await api('patch', `/items/${P.cardigan.id}/status`).send({ status: 'Laundry' });
    const r = await api('post', '/recommendations').send({ occasion: 'University', fixedId: P.cardigan.id });
    expect(r.body.outfits).toHaveLength(0);
    expect(r.body.note).toMatch(/not Available|Laundry/);
  });
});

describe('Mix & Match and Suggest a fix (US-42, US-43, US-66)', () => {
  test('API-MM01 a strong look scores high; a weak piece drops the score; the best single swap (Suggest a fix) raises it again', async () => {
    const good = [P.blouse.id, P.tailored.id, P.loafers.id, P.bag.id];
    const a = await api('post', '/recommendations/check').send({ itemIds: good, occasion: 'Work' });
    expect(a.body.ruleScore).toBe(100);
    const weak = [P.red.id, P.tailored.id, P.loafers.id, P.bag.id];
    const b = await api('post', '/recommendations/check').send({ itemIds: weak, occasion: 'Work' });
    expect(b.body.compatibility).toBeLessThan(a.body.compatibility);
    expect(b.body.ruleScore).toBeLessThan(100);
    expect(b.body.explanation).toMatch(/To improve/);
    let best = null;
    for (let slot = 0; slot < weak.length; slot += 1) {
      const s = await api('post', '/recommendations/swap').send({ itemIds: weak, slot, occasion: 'Work' });
      if (s.body.outfit && (!best || s.body.outfit.ruleScore > best.ruleScore || (s.body.outfit.ruleScore === best.ruleScore && s.body.outfit.compatibility > best.compatibility))) best = s.body.outfit;
    }
    expect(best.ruleScore).toBe(100);
    expect(best.compatibility).toBeGreaterThan(b.body.compatibility);
    expect(best.itemIds).not.toContain(P.red.id);
  });
});
