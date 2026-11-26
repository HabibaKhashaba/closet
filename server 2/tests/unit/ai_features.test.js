// v2.1 AI features: the language-model client, grounded Ask Closet replies, AI stylist notes,
// photo tagging, and remove-with-confirmation. A fake model stands in for the provider here
// (no network, no key); the real provider is exercised by hand with a key (see the Test Report).
const { createLlm } = require('../../src/shared/llm');
const { composeReply, stylistNotes, tagPhoto } = require('../../src/modules/ai/aiFeatures');
const { parse } = require('../../src/modules/assistant/keywordParser');
const { createLocalApi, TOKEN } = require('../../../tools/offline_demo/localApi');

const AUTH = `Bearer ${TOKEN}`;
// A fake model: text() and tool() answer from scripted functions and record what they were sent.
function fakeLlm({ text, tool } = {}) {
  const sent = [];
  return {
    enabled: true, provider: 'fake', model: 'fake-1', label: 'Fake · test model', sent,
    text: async (system, input) => { sent.push({ kind: 'text', system, input }); if (text instanceof Error) throw text; return typeof text === 'function' ? text(input) : text; },
    tool: async (system, content, t) => { sent.push({ kind: 'tool', system, content, tool: t.name }); if (tool instanceof Error) throw tool; return typeof tool === 'function' ? tool(content) : tool; },
  };
}
const okJson = (body) => ({ ok: true, status: 200, json: async () => body });

describe('Language-model client', () => {
  test('AI-01 no key → disabled, and a call is refused (callers fall back to rules)', async () => {
    const llm = createLlm({ env: {} });
    expect(llm.enabled).toBe(false);
    expect(llm.label).toBeNull();
    await expect(llm.text('s', 'x')).rejects.toBeInstanceOf(Error);
  });
  test('AI-02 Anthropic: key in the header only, default model, tool answer returned as an object', async () => {
    const calls = [];
    const llm = createLlm({ env: { ANTHROPIC_API_KEY: 'sk-test' }, fetchImpl: async (url, opt) => { calls.push({ url, opt }); return okJson({ content: [{ type: 'tool_use', input: { notes: ['a'] } }] }); } });
    expect(llm.label).toBe('Anthropic · claude-haiku-4-5');
    expect(await llm.tool('sys', [{ type: 'text', text: 'hi' }], { name: 'n', description: 'd', schema: {} })).toEqual({ notes: ['a'] });
    expect(calls[0].url).toBe('https://api.anthropic.com/v1/messages');
    expect(calls[0].opt.headers['x-api-key']).toBe('sk-test');
    expect(calls[0].opt.body).not.toMatch(/sk-test/);
  });
  test('AI-03 OpenAI: images go as data URLs; text answers are trimmed; LLM_MODEL overrides', async () => {
    let body;
    const llm = createLlm({ env: { OPENAI_API_KEY: 'k', LLM_MODEL: 'gpt-x' }, fetchImpl: async (_u, opt) => { body = JSON.parse(opt.body); return okJson({ choices: [{ message: { content: '  Hello  ' } }] }); } });
    expect(await llm.text('sys', 'q')).toBe('Hello');
    expect(body.model).toBe('gpt-x');
    const llm2 = createLlm({ env: { OPENAI_API_KEY: 'k' }, fetchImpl: async (_u, opt) => { body = JSON.parse(opt.body); return okJson({ choices: [{ message: { tool_calls: [{ function: { arguments: '{"isClothing":true}' } }] } }] }); } });
    await llm2.tool('sys', [{ type: 'image', mime: 'image/png', base64: 'QUJD' }], { name: 't', description: 'd', schema: {} });
    expect(body.messages[1].content[0].image_url.url).toBe('data:image/png;base64,QUJD');
  });
  test('AI-04 a provider error (HTTP 500) is an error, so the caller falls back', async () => {
    const llm = createLlm({ env: { ANTHROPIC_API_KEY: 'k' }, fetchImpl: async () => ({ ok: false, status: 500, json: async () => ({}) }) });
    await expect(llm.text('s', 'x')).rejects.toBeInstanceOf(Error);
  });
});

describe('Grounded replies, stylist notes, photo tagging', () => {
  test('AI-10 composeReply sends ONLY the facts and the last turns; returns the model text', async () => {
    const llm = fakeLlm({ text: 'Your navy blazer is in the laundry right now.' });
    const out = await composeReply(llm, { message: 'is my blazer clean?', history: [{ who: 'me', text: 'hi' }, { who: 'ai', text: 'Hi!' }], draft: 'Your navy blazer is In the laundry.', facts: { pieces: ['Navy blazer'] } });
    expect(out).toBe('Your navy blazer is in the laundry right now.');
    expect(llm.sent[0].input).toMatch(/Pieces shown: Navy blazer/);
    expect(llm.sent[0].input).toMatch(/User: hi/);
    expect(llm.sent[0].system).toMatch(/use ONLY the facts/i);
  });
  test('AI-11 composeReply: no model, a model error or an empty answer → null (rules wording is kept)', async () => {
    expect(await composeReply(null, { message: 'x', draft: 'y' })).toBeNull();
    expect(await composeReply(fakeLlm({ text: new Error('down') }), { message: 'x', draft: 'y' })).toBeNull();
    expect(await composeReply(fakeLlm({ text: ' ' }), { message: 'x', draft: 'y' })).toBeNull();
  });
  const looks = [{ pieces: ['Navy blazer', 'White fitted tee', 'Black loafers'] }, { pieces: ['Rose wrap dress', 'Nude heels'] }];
  test('AI-12 stylist notes are accepted only when each names a piece of ITS look', async () => {
    const good = await stylistNotes(fakeLlm({ tool: { notes: ['The navy blazer sharpens the white tee for class.', 'Let the wrap dress lead; nude heels lengthen the line.'] } }), { occasion: 'University', outfits: looks });
    expect(good).toHaveLength(2);
    expect(await stylistNotes(fakeLlm({ tool: { notes: ['Add a red scarf for colour.', 'Wear a leather jacket.'] } }), { outfits: looks })).toBeNull(); // not grounded
    expect(await stylistNotes(fakeLlm({ tool: { notes: ['The navy blazer works.'] } }), { outfits: looks })).toBeNull(); // wrong count
    expect(await stylistNotes(fakeLlm({ tool: new Error('x') }), { outfits: looks })).toBeNull();
  });
  test('AI-13 photo tagging keeps only values from Closet\'s vocabulary', async () => {
    const r = await tagPhoto(fakeLlm({ tool: { isClothing: true, name: 'Navy wool blazer', category: 'Layer', colour: 'Navy', fabric: 'Wool', season: 'Winter', styles: ['Classic', 'Glam'], dressCodes: [3, 4, 9] } }), { base64: 'x', mime: 'image/jpeg' });
    expect(r).toEqual({ isClothing: true, name: 'Navy wool blazer', category: 'Layer', colour: 'Navy', fabric: 'Wool', season: 'Winter', styles: ['Classic'], dressCodes: [3, 4] });
    const bad = await tagPhoto(fakeLlm({ tool: { isClothing: true, category: 'Jacket', colour: 'Teal' } }), { base64: 'x', mime: 'image/jpeg' });
    expect(bad.category).toBeUndefined();
    expect(bad.colour).toBeUndefined();
    expect(await tagPhoto(fakeLlm({ tool: { isClothing: false } }), { base64: 'x', mime: 'image/jpeg' })).toEqual({ isClothing: false });
  });
});

describe('Ask Closet: remove a piece asks first', () => {
  test('AI-20 keyword parser: "remove my red tee, it no longer fits" → remove_piece with a reason; shopping-list removal is not', () => {
    expect(parse('Remove my red tee, it no longer fits')).toMatchObject({ fn: 'remove_piece', args: { piece: { colour: 'Red', category: 'Top' }, reason: 'Became too small' } });
    expect(parse('delete the torn black blazer')).toMatchObject({ fn: 'remove_piece', args: { reason: 'Torn / damaged' } });
    expect(parse('remove beige trousers from my shopping list').fn).not.toBe('remove_piece');
  });
  test('AI-21 the assistant only proposes: nothing is deleted until DELETE /items/:id', async () => {
    const local = createLocalApi(); await local.ready;
    const before = (await local.handle('GET', '/items', null, AUTH)).data.total;
    const r = (await local.handle('POST', '/chat', { message: 'remove my red cropped tee, it no longer fits' }, AUTH)).data;
    expect(r.function).toBe('remove_piece');
    expect(r.confirmDelete).toMatchObject({ name: 'Red cropped tee', reason: 'Became too small' });
    expect((await local.handle('GET', '/items', null, AUTH)).data.total).toBe(before);
    expect((await local.handle('DELETE', `/items/${r.confirmDelete.pieceId}`, { reason: r.confirmDelete.reason }, AUTH)).status).toBe(200);
    expect((await local.handle('GET', '/items', null, AUTH)).data.total).toBe(before - 1);
  });
});

describe('AI on the real services (offline demo stack with a fake model)', () => {
  test('AI-30 with a model, Ask Closet replies in natural language and keeps the rules answer beside it', async () => {
    const llm = fakeLlm({ text: (input) => (/Pieces shown: .*Navy blazer/.test(input) ? 'Good news — your Navy blazer is clean and ready.' : 'ok') });
    const local = createLocalApi({ llm }); await local.ready;
    const r = (await local.handle('POST', '/chat', { message: 'is my navy blazer clean?', history: [{ who: 'me', text: 'hello' }] }, AUTH)).data;
    expect(r.replyBy).toBe('Fake · test model');
    expect(r.reply).toBe('Good news — your Navy blazer is clean and ready.');
    expect(r.ruleReply).toMatch(/blazer/i);
    expect(llm.sent[0].input).toMatch(/User: hello/);
  });
  test('AI-31 without a model the reply is the rules answer, labelled as such', async () => {
    const local = createLocalApi(); await local.ready;
    const r = (await local.handle('POST', '/chat', { message: 'is my navy blazer clean?' }, AUTH)).data;
    expect(r.replyBy).toBe('Closet rules');
    expect(r.ruleReply).toBeUndefined();
    expect((await local.handle('GET', '/ai', null, AUTH)).data).toEqual({ languageModel: null });
  });
  test('AI-32 stylist endpoint: notes for the real looks, or null without a model; another user\'s id is 404', async () => {
    const llm = fakeLlm({ tool: (content) => ({ notes: content[0].text.split('\n').filter((l) => l.startsWith('Outfit')).map((l) => `Wear the ${l.split(': ')[1].split(', ')[0]} with confidence today.`) }) });
    const local = createLocalApi({ llm }); await local.ready;
    const looks = (await local.handle('POST', '/recommendations', { occasion: 'University' }, AUTH)).data.outfits;
    const r = (await local.handle('POST', '/recommendations/stylist', { looks: looks.map((o) => o.itemIds), occasion: 'University' }, AUTH)).data;
    expect(r.notes).toHaveLength(looks.length);
    expect(r.by).toBe('Fake · test model');
    expect((await local.handle('POST', '/recommendations/stylist', { looks: [['00000000-0000-4000-8000-000000000999']] }, AUTH)).status).toBe(404);
    const plain = createLocalApi(); await plain.ready;
    expect((await plain.handle('POST', '/recommendations/stylist', { looks: looks.map((o) => o.itemIds) }, AUTH)).data).toEqual({ notes: null, by: null });
  });
  test('AI-33 analyze: proposes details from a photo with a model; explains itself without one', async () => {
    const png = `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]).toString('base64')}`;
    const local = createLocalApi({ llm: fakeLlm({ tool: { isClothing: true, category: 'Top', colour: 'White', name: 'White tee' } }) }); await local.ready;
    expect((await local.handle('POST', '/items/analyze', { photo: png }, AUTH)).data).toMatchObject({ suggestion: { category: 'Top', colour: 'White' }, by: 'Fake · test model' });
    const plain = createLocalApi(); await plain.ready;
    expect((await plain.handle('POST', '/items/analyze', { photo: png }, AUTH)).data).toMatchObject({ suggestion: null, by: null });
  });
  test('AI-34 donation keeps its reason from Ready to donate to the donated history', async () => {
    const local = createLocalApi(); await local.ready;
    const p = (await local.handle('GET', '/items', null, AUTH)).data.items.find((x) => x.status === 'Available');
    expect((await local.handle('POST', `/items/${p.id}/donate`, { reason: 'Rarely worn' }, AUTH)).data.statusNote).toBe('Rarely worn');
    expect((await local.handle('POST', `/items/${p.id}/donate`, { reason: 'Because' }, AUTH)).status).toBe(400);
    expect((await local.handle('GET', '/donation', null, AUTH)).data.ready.find((x) => x.id === p.id).reason).toBe('Rarely worn');
    await local.handle('POST', `/items/${p.id}/donate/done`, {}, AUTH);
    expect((await local.handle('GET', '/donation', null, AUTH)).data.donated[0].reason).toBe('Rarely worn');
  });
});
