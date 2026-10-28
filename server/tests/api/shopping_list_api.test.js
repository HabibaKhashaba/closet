// API tests (version 1.4): the core outfit flow, deletion reasons that drive shopping and learning,
// and the shopping list with Ask Closet. Sprint 2 / Sprint 3 stories built early (US-13, US-19, US-24,
// US-26, US-23, US-60, US-62, US-33, US-34, US-36) — not Sprint 1 work.
const request = require('supertest');
const { makeApp, resetDb, pool, registerUser, addPiece, auth, weatherState } = require('../helpers');

const app = makeApp();
let u;
const P = {};
async function closet() {
  const add = async (key, d) => { P[key] = (await addPiece(app, u.token, d)).body; };
  await add('tee', { name: 'White fitted tee', category: 'Top', colour: 'White', dressCodes: [1, 2], styles: ['Minimal'] });
  await add('shirt', { name: 'Blue Oxford shirt', category: 'Top', colour: 'Blue', dressCodes: [1, 2, 3], styles: ['Classic'] });
  await add('hoodie', { name: 'Grey graphic hoodie', category: 'Top', colour: 'Grey', dressCodes: [1], styles: ['Streetwear'] });
  await add('jeans', { name: 'Light-wash jeans', category: 'Bottom', colour: 'Blue', fabric: 'Denim', dressCodes: [1, 2], styles: ['Casual'] });
  await add('beige', { name: 'Beige wide-leg trousers', category: 'Bottom', colour: 'Beige', dressCodes: [1, 2, 3], styles: ['Classic', 'Minimal'] });
  await add('cargo', { name: 'Green cargo joggers', category: 'Bottom', colour: 'Green', dressCodes: [1], styles: ['Streetwear'] });
  await add('sneakers', { name: 'White sneakers', category: 'Shoes', colour: 'White', dressCodes: [1, 2], styles: ['Casual'] });
  await add('loafers', { name: 'Black loafers', category: 'Shoes', colour: 'Black', dressCodes: [1, 2, 3], styles: ['Classic'] });
  await add('trench', { name: 'Beige trench coat', category: 'Layer', colour: 'Beige', dressCodes: [1, 2, 3], styles: ['Classic'] });
}
const api = (method, url, token = u.token) => request(app)[method](`/api/v1${url}`).set(auth(token));
const ask = (message, context) => api('post', '/chat').send(context ? { message, context } : { message });
beforeEach(async () => { await resetDb(); weatherState.tempC = 22; u = await registerUser(app); await closet(); });
afterAll(() => pool.end());

describe('Core outfit flow: 3 outfits → change a piece → save → wear → feedback (UC-09, UC-12)', () => {
  test('API-CF01 three complete outfits, then change one piece: only that slot changes and the look still passes the rules', async () => {
    const r = await api('post', '/recommendations').send({ occasion: 'University' });
    expect(r.body.outfits).toHaveLength(3);
    for (const o of r.body.outfits) { expect(typeof o.title).toBe('string'); expect(o.explanation).toMatch(/^Recommended because/); }
    const first = r.body.outfits[0];
    const slot = first.pieces.findIndex((p) => p.category === 'Shoes');
    const s = await api('post', '/recommendations/swap').send({ occasion: 'University', itemIds: first.itemIds, slot });
    expect(s.status).toBe(200);
    expect(s.body.outfit.itemIds[slot]).not.toBe(first.itemIds[slot]);
    expect(s.body.outfit.itemIds.filter((id, i) => i !== slot)).toEqual(first.itemIds.filter((id, i) => i !== slot));
    expect(s.body.outfit.pieces[slot].status).toBe('Available');
  });
  test('API-CF02 save as favourite, wear with a rating, reject another look with a reason — each is stored as feedback', async () => {
    const r = await api('post', '/recommendations').send({ occasion: 'University' });
    const [a, b] = r.body.outfits;
    const saved = await api('post', '/outfits').send({ itemIds: a.itemIds, occasion: 'University', ruleScore: a.ruleScore, favorite: true });
    expect(saved.status).toBe(201);
    expect((await api('get', '/outfits?favorites=true')).body.outfits).toHaveLength(1);
    const worn = await api('post', '/outfits/wear').send({ itemIds: a.itemIds, rating: 5, occasion: 'University' });
    expect(worn.status).toBe(201);
    expect((await api('get', '/outfits/history?minRating=5')).body.wears).toHaveLength(1);
    expect((await api('post', '/outfits/reject').send({ itemIds: b.itemIds, reason: 'Too casual' })).status).toBe(200);
    expect((await api('post', '/outfits/reject').send({ itemIds: b.itemIds, reason: 'Boring' })).status).toBe(400);
  });
});

describe('Deletion reasons drive shopping and learning (US-13, US-33, US-34)', () => {
  test('API-DR01 Torn / damaged → the replacement is on the shopping list at once, and the reply says so', async () => {
    const r = await api('delete', `/items/${P.loafers.id}`).send({ reason: 'Torn / damaged' });
    expect(r.body).toMatchObject({ deleted: true, effect: 'A replacement is added to your shopping list.', addedToShoppingList: { title: 'Black loafers', tags: ['Replacement'] } });
    const list = await api('get', '/shopping/list');
    expect(list.body).toMatchObject({ toBuy: 1, items: [{ title: 'Black loafers', source: 'replacement', sourceLabel: 'Replacement', replaces: 'black loafers' }] });
  });
  test('API-DR02 Became too small → a replacement in the next size', async () => {
    await api('delete', `/items/${P.jeans.id}`).send({ reason: 'Became too small' });
    const list = await api('get', '/shopping/list');
    expect(list.body.items[0]).toMatchObject({ title: 'Light-wash jeans · next size', category: 'Bottom', colour: 'Blue' });
    expect(list.body.items[0].reason).toMatch(/too small/);
  });
  test('API-DR03 No longer my style → nothing on the list, never suggested, and a buy check says think twice', async () => {
    const r = await api('delete', `/items/${P.cargo.id}`).send({ reason: 'No longer my style' });
    expect(r.body).toMatchObject({ addedToShoppingList: null, effect: 'Closet will not suggest it again and learns from it.' });
    expect((await api('get', '/shopping/list')).body.items).toHaveLength(0);
    const s = await api('get', '/shopping');
    expect(s.body.suggestions.some((x) => x.category === 'Bottom' && x.colour === 'Green')).toBe(false);
    expect(s.body.avoid).toEqual([{ category: 'Bottom', colour: 'Green', name: 'Green cargo joggers' }]);
    const c = await api('post', '/shopping/check').send({ category: 'Bottom', colour: 'Green' });
    expect(c.body.verdict).toBe('Think twice');
  });
  test('API-DR04 two streetwear pieces let go → “Closet has learned”; confirm avoids streetwear in outfits; Undo restores the profile exactly', async () => {
    await api('put', '/profile/quiz').send({ styles: ['Classic', 'Streetwear'], dressCode: 1, city: 'Cairo' });
    await api('delete', `/items/${P.cargo.id}`).send({ reason: 'No longer my style' });
    expect((await api('get', '/intelligence/learned')).body.patterns.some((p) => p.key.startsWith('let-go'))).toBe(false); // one is not enough
    await api('delete', `/items/${P.hoodie.id}`).send({ reason: 'No longer my style' });
    const l = await api('get', '/intelligence/learned');
    const p = l.body.patterns.find((x) => x.key === 'let-go-streetwear');
    expect(p).toMatchObject({ source: 'Deleted pieces', count: 2 });
    await api('post', '/intelligence/learned/let-go-streetwear').send({ decision: 'confirm' });
    expect((await api('get', '/profile')).body).toMatchObject({ styles: ['Classic'], avoidStyles: ['Streetwear'] });
    await api('delete', '/intelligence/learned/let-go-streetwear');
    expect((await api('get', '/profile')).body).toMatchObject({ styles: ['Classic', 'Streetwear'], avoidStyles: [] });
  });
  test('API-DR05 the reason is required and must be one of the four (old reasons are refused); Other changes nothing', async () => {
    for (const reason of ['Torn or damaged', 'Gave it away', 'Became too big', '']) expect((await api('delete', `/items/${P.tee.id}`).send({ reason })).status).toBe(400);
    const r = await api('delete', `/items/${P.tee.id}`).send({ reason: 'Other', note: 'Gave it to my sister' });
    expect(r.body).toMatchObject({ deleted: true, addedToShoppingList: null });
    expect((await api('get', '/shopping/list')).body.items).toHaveLength(0);
  });
});

describe('Shopping list and Ask Closet (US-36, US-65, US-88)', () => {
  test('API-SL01 “Put beige trousers on my shopping list” → on the list, “Added by Ask Closet”, with a similar-piece warning', async () => {
    const r = await ask('Put beige trousers on my shopping list');
    expect(r.body).toMatchObject({ function: 'add_to_shopping', listItem: { title: 'Beige trousers', tags: ['Added by Ask Closet'] } });
    expect(r.body.reply).toMatch(/^Added “Beige trousers” to your shopping list\. You already own a similar piece/);
    const list = await api('get', '/shopping/list');
    expect(list.body.items[0]).toMatchObject({ source: 'ask', warning: 'You already own a similar piece.' });
    expect(list.body.items[0].similarOwned.map((x) => x.name)).toEqual(['Beige wide-leg trousers']);
  });
  test('API-SL02 after “Do I need …?”, “add this to my shopping list” adds that item; asking twice does not duplicate it', async () => {
    const check = await ask('I want to buy navy trousers. Do I need them?');
    expect(check.body.context).toEqual({ buy: { category: 'Bottom', colour: 'Navy', word: 'trousers' } });
    const r = await ask('add this to my shopping list', check.body.context);
    expect(r.body.listItem).toMatchObject({ title: 'Navy trousers', category: 'Bottom' });
    const again = await ask('add this to my shopping list', check.body.context);
    expect(again.body.reply).toBe('“Navy trousers” is already on your shopping list.');
    expect((await api('get', '/shopping/list')).body.toBuy).toBe(1);
  });
  test('API-SL03 “Add a replacement for my torn loafers” → tagged Replacement and Added by Ask Closet, no duplicate warning', async () => {
    const r = await ask('Add a replacement for my torn loafers');
    expect(r.body.listItem).toMatchObject({ title: 'Black loafers', replaces: 'black loafers', tags: ['Added by Ask Closet', 'Replacement'], warning: null });
  });
  test('API-SL04 Undo removes what Ask Closet added; mark bought, remove; another user cannot touch my list', async () => {
    const r = await ask('Put a black bag on my shopping list');
    expect(r.body.listItem).toMatchObject({ title: 'Black bag', category: 'Bag' });
    await api('post', `/chat/undo/${r.body.undoId}`);
    expect((await api('get', '/shopping/list')).body.items).toHaveLength(0);
    const m = await api('post', '/shopping/list').send({ title: 'White shirt', category: 'Top', colour: 'White' });
    expect(m.status).toBe(201);
    const id = m.body.item.id;
    const other = await registerUser(app, 'karim.list@example.com');
    expect((await api('patch', `/shopping/list/${id}`, other.token).send({ status: 'bought' })).status).toBe(404);
    expect((await api('delete', `/shopping/list/${id}`, other.token)).status).toBe(404);
    expect((await api('patch', `/shopping/list/${id}`).send({ status: 'bought' })).body.status).toBe('bought');
    expect((await api('get', '/shopping/list')).body).toMatchObject({ toBuy: 0, bought: 1 });
    expect((await api('delete', `/shopping/list/${id}`)).body).toEqual({ removed: true });
    expect((await api('post', '/shopping/list').send({ title: '', category: 'Hat' })).status).toBe(400);
  });
  test('API-SL05 a suggestion added to the bag leaves the suggestions; removing it from the bag brings it back', async () => {
    const s = await api('get', '/shopping');
    const sg = s.body.suggestions[0];
    const add = await api('post', '/shopping/list').send({ title: sg.title, category: sg.category, colour: sg.colour, source: sg.source === 'Gap' ? 'gap' : 'suggestion', reason: sg.reason, suggestionKey: sg.key });
    expect(add.body.item.tags).toEqual([sg.source === 'Gap' ? 'Wardrobe gap' : 'Smart suggestion']);
    expect((await api('get', '/shopping')).body.suggestions.some((x) => x.key === sg.key)).toBe(false);
    await api('delete', `/shopping/list/${add.body.item.id}`);
    expect((await api('get', '/shopping')).body.suggestions.some((x) => x.key === sg.key)).toBe(true);
  });
});
