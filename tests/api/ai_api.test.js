// API tests for the v2.1 AI features over HTTP on PostgreSQL. The model is a fake (no key, no
// network); a real key is only ever set in server/.env on the demo laptop.
const request = require('supertest');
const { makeApp, resetDb, pool, registerUser, addPiece, auth, PNG } = require('../helpers');

const fake = (over = {}) => ({
  enabled: true, label: 'Fake · test model',
  text: async () => 'Your navy blazer is clean and ready to wear.',
  tool: async (_s, content, t) => (t.name === 'describe_piece'
    ? { isClothing: true, category: 'Layer', colour: 'Navy', name: 'Navy blazer', dressCodes: [3] }
    : { notes: content[0].text.split('\n').filter((l) => l.startsWith('Outfit')).map((l) => `Let the ${l.split(': ')[1].split(', ')[0]} lead this look.`) }),
  ...over,
});
const plain = makeApp({ llm: null });
const withAi = makeApp({ llm: fake() });
let u;
const P = {};
beforeEach(async () => {
  await resetDb();
  u = await registerUser(plain);
  const add = async (k, d) => { P[k] = (await addPiece(plain, u.token, d)).body; };
  await add('blazer', { name: 'Navy blazer', category: 'Layer', colour: 'Navy', dressCodes: [1, 2, 3] });
  await add('tee', { name: 'White fitted tee', category: 'Top', colour: 'White', dressCodes: [1, 2] });
  await add('shirt', { name: 'Blue Oxford shirt', category: 'Top', colour: 'Blue', dressCodes: [1, 2, 3] });
  await add('jeans', { name: 'Light-wash jeans', category: 'Bottom', colour: 'Blue', dressCodes: [1, 2] });
  await add('trousers', { name: 'Beige trousers', category: 'Bottom', colour: 'Beige', dressCodes: [1, 2, 3] });
  await add('sneakers', { name: 'White sneakers', category: 'Shoes', colour: 'White', dressCodes: [1, 2] });
});
afterAll(() => pool.end());
const call = (app, method, url) => request(app)[method](`/api/v1${url}`).set(auth(u.token));

describe('AI features over HTTP', () => {
  test('API-AI01 GET /ai says which model answers (null without a key)', async () => {
    expect((await call(plain, 'get', '/ai')).body).toEqual({ languageModel: null });
    expect((await call(withAi, 'get', '/ai')).body).toEqual({ languageModel: 'Fake · test model' });
  });
  test('API-AI02 Ask Closet: rules reply without a model; grounded AI reply with one, rules answer kept beside it', async () => {
    const a = (await call(plain, 'post', '/chat').send({ message: 'Is my navy blazer clean?' })).body;
    expect(a.replyBy).toBe('Closet rules');
    const b = (await call(withAi, 'post', '/chat').send({ message: 'Is my navy blazer clean?', history: [{ who: 'me', text: 'hi' }, { who: 'x', text: 'ignored' }] })).body;
    expect(b).toMatchObject({ replyBy: 'Fake · test model', reply: 'Your navy blazer is clean and ready to wear.' });
    expect(b.ruleReply).toMatch(/blazer/i);
  });
  test('API-AI03 remove via Ask Closet only proposes; the piece is still there until DELETE', async () => {
    const r = (await call(withAi, 'post', '/chat').send({ message: 'remove my white fitted tee, it no longer fits' })).body;
    expect(r.function).toBe('remove_piece');
    expect(r.confirmDelete).toMatchObject({ pieceId: P.tee.id, reason: 'Became too small' });
    expect(r.reply).toMatch(/Nothing is removed until you confirm/); // confirmations are never rewritten
    expect((await call(plain, 'get', `/items/${P.tee.id}`)).status).toBe(200);
  });
  test('API-AI04 stylist notes for the real looks; null without a model; a foreign id is 404', async () => {
    const looks = (await call(plain, 'post', '/recommendations').send({ occasion: 'University' })).body.outfits.map((o) => o.itemIds);
    const r = (await call(withAi, 'post', '/recommendations/stylist').send({ looks, occasion: 'University' })).body;
    expect(r.notes).toHaveLength(looks.length);
    expect((await call(plain, 'post', '/recommendations/stylist').send({ looks })).body).toEqual({ notes: null, by: null });
    expect((await call(withAi, 'post', '/recommendations/stylist').send({ looks: [['00000000-0000-4000-8000-000000000999', P.tee.id]] })).status).toBe(404);
    expect((await call(withAi, 'post', '/recommendations/stylist').send({ looks: [] })).status).toBe(400);
  });
  test('API-AI05 photo tagging: proposes details with a model, explains itself without one, rejects non-images', async () => {
    const a = (await call(withAi, 'post', '/items/analyze').attach('photo', PNG, { filename: 'p.png', contentType: 'image/png' })).body;
    expect(a).toMatchObject({ suggestion: { category: 'Layer', colour: 'Navy' }, by: 'Fake · test model' });
    const b = (await call(plain, 'post', '/items/analyze').attach('photo', PNG, { filename: 'p.png', contentType: 'image/png' })).body;
    expect(b).toMatchObject({ suggestion: null, by: null });
    expect((await call(withAi, 'post', '/items/analyze').attach('photo', Buffer.from('not an image'), { filename: 'x.png', contentType: 'image/png' })).status).toBe(415);
    expect((await call(withAi, 'post', '/items/analyze')).status).toBe(400);
    expect((await request(withAi).post('/api/v1/items/analyze')).status).toBe(401);
  });
  test('API-AI06 donation reason is validated and kept', async () => {
    expect((await call(plain, 'post', `/items/${P.jeans.id}/donate`).send({ reason: 'Because' })).status).toBe(400);
    expect((await call(plain, 'post', `/items/${P.jeans.id}/donate`).send({ reason: 'Rarely worn' })).body.statusNote).toBe('Rarely worn');
    await call(plain, 'post', `/items/${P.jeans.id}/donate/done`).send({});
    expect((await call(plain, 'get', '/donation')).body.donated[0]).toMatchObject({ name: 'Light-wash jeans', reason: 'Rarely worn' });
  });
});
