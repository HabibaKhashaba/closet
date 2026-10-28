// The offline demo runs the REAL services on in-memory repositories (tools/offline_demo/localApi.js).
// These tests drive it like the web app does (fetch-shaped calls) and check that state changes stick:
// the old offline demo replayed recorded responses, so these flows used to "succeed" without changing anything.
const { createLocalApi, TOKEN } = require('../../../tools/offline_demo/localApi');
const { serializeStore } = require('../../src/db/memoryRepositories');

const AUTH = `Bearer ${TOKEN}`;
let local;
const call = async (method, url, body) => {
  const r = await local.handle(method, url, body, AUTH);
  if (r.status >= 500) throw new Error(`${method} ${url} → ${r.status} ${JSON.stringify(r.data)}`);
  return r;
};
const get = async (url) => (await call('GET', url)).data;
const byName = async (name) => (await get('/items')).items.find((p) => p.name === name);
beforeEach(async () => { local = createLocalApi(); await local.ready; });

describe('Offline demo = real services on in-memory data', () => {
  test('OF-01 seeded like npm run seed: 30 pieces, 3 in the laundry, the denim jacket forgotten for 104 days', async () => {
    const items = await get('/items');
    expect(items.total).toBe(30);
    expect(items.counts.status.Laundry).toBe(3);
    expect((await get('/intelligence/forgotten')).top).toMatchObject({ days: 104, piece: { name: 'Denim jacket' } });
  });
  test('OF-02 without the session token every protected call is 401', async () => {
    expect((await local.handle('GET', '/items', null, null)).status).toBe(401);
    expect((await local.handle('POST', '/auth/login', { email: 'demo@closet.app', password: 'nope' })).status).toBe(401);
  });
  test('OF-03 Laundry propagates everywhere and Wash done brings it back', async () => {
    const blazer = await byName('Navy blazer');
    await call('PATCH', `/items/${blazer.id}/status`, { status: 'Laundry' });
    expect((await get('/laundry')).items.map((p) => p.name)).toContain('Navy blazer');
    expect((await byName('Navy blazer')).status).toBe('Laundry');
    const looks = (await call('POST', '/recommendations', { occasion: 'Work' })).data.outfits;
    expect(looks.some((o) => o.itemIds.includes(blazer.id))).toBe(false);
    await call('POST', '/laundry/wash-done');
    expect((await byName('Navy blazer')).status).toBe('Available');
    expect((await get('/laundry')).count).toBe(0);
  });
  test('OF-04 an invalid transition is refused by the same state machine (409)', async () => {
    const tee = await byName('White fitted tee'); // in the laundry
    expect((await call('PATCH', `/items/${tee.id}/status`, { status: 'Borrowed' })).status).toBe(409);
  });
  test('OF-05 Favourite and Save reach ONE record, visible in Favourites', async () => {
    const look = (await call('POST', '/recommendations', { occasion: 'University' })).data.outfits[0];
    const a = (await call('POST', '/outfits', { itemIds: look.itemIds, favorite: true })).data;
    const b = (await call('POST', '/outfits', { itemIds: [...look.itemIds].reverse() })).data;
    expect(b.id).toBe(a.id);
    expect((await get('/outfits?favorites=true')).outfits.some((o) => o.id === a.id)).toBe(true);
  });
  test('OF-06 Ask Closet: different questions, different functions, follow-up “this” updates the bag', async () => {
    const say = async (message, context) => (await call('POST', '/chat', { message, context })).data;
    const r1 = await say('Do I need beige trousers?');
    const r2 = await say('Add this to my shopping list.', r1.context);
    expect(r2.function).toBe('add_to_shopping');
    expect((await get('/shopping/list')).items.some((i) => i.title === 'Beige trousers' && i.source === 'ask')).toBe(true);
    const fns = [];
    for (const q of ['Is my blazer clean?', 'What could I donate?', 'Who has my rose wrap dress?', 'What has the best cost per wear?', 'Tell me a joke']) fns.push((await say(q)).function);
    expect(fns).toEqual(['availability', 'donate_candidates', 'borrowed', 'value', 'help']);
  });
  test('OF-07 Donate: mark → done → gone from the closet, no replacement, history kept', async () => {
    const denim = await byName('Denim jacket');
    const bag = (await get('/shopping/list')).items.length;
    await call('POST', `/items/${denim.id}/rehome`, { method: 'donate' });
    expect((await call('POST', `/items/${denim.id}/rehome/done`)).data.reason).toBe('Donated');
    expect(await byName('Denim jacket')).toBeUndefined();
    expect((await get('/shopping/list')).items).toHaveLength(bag);
    expect(local.store.deletions.some((d) => d.name === 'Denim jacket' && d.reason === 'Donated')).toBe(true);
  });
  test('OF-08 state survives a page refresh in the same tab (serialize → restore)', async () => {
    const blazer = await byName('Navy blazer');
    await call('PATCH', `/items/${blazer.id}/status`, { status: 'Laundry' });
    const saved = serializeStore(local.store);
    local = createLocalApi({ saved }); await local.ready;
    expect((await byName('Navy blazer')).status).toBe('Laundry');
    expect((await get('/items')).total).toBe(30);
  });
  test('OF-09 the planned-outfit monitor sees the warmer forecast on the seeded presentation outfit', async () => {
    const a = (await get('/intelligence/monitor')).alerts;
    expect(a.some((x) => x.kind === 'weather' && /navy blazer/.test(x.message))).toBe(true);
  });
});
