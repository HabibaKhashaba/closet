// v3.0 Studio features — unit tests. Pure functions (CompatibilityService, weighted sampling, the strict-JSON
// gate, keyword fallbacks) plus every feature through the offline demo (the REAL services on in-memory data).
const C = require('../../src/modules/studio/compatibility');
const { callClaudeJSON, checkSchema } = require('../../src/modules/studio/claudeJson');
const cher = require('../../src/modules/studio/features/cher');
const rescue = require('../../src/modules/studio/features/rescue');
const invitation = require('../../src/modules/studio/features/invitation');
const recreate = require('../../src/modules/studio/features/recreate');
const { featureFlags, levelFromText, dateFromText, timeFromText } = require('../../src/modules/studio/context');
const { demoPieces } = require('../../src/db/seedData');
const { createLocalApi, TOKEN } = require('../../../tools/offline_demo/localApi');

const pieces = demoPieces();
const seeded = (seed) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

describe('CompatibilityService (one scorer for every v3.0 feature)', () => {
  test('ST-01 scoreOutfit = the engine rules: a matching work look scores 100, a mismatched one less', () => {
    const by = (id) => pieces.find((p) => p.id === id);
    expect(C.scoreOutfit([by('ivory_silk_blouse'), by('black_tailored_trousers'), by('black_loafers')], { occasion: 'Work' }).score).toBe(100);
    expect(C.scoreOutfit([by('red_cropped_tee'), by('light_wash_jeans'), by('white_sneakers')], { occasion: 'Wedding' }).score).toBeLessThan(100);
  });
  test('ST-02 enumerateOutfits uses only Available pieces, keeps locked pieces, never repeats a look', () => {
    const looks = C.enumerateOutfits(pieces, { occasion: 'Everyday', locked: ['black_tailored_trousers'] });
    expect(looks.length).toBeGreaterThan(0);
    for (const l of looks) {
      expect(l.itemIds).toContain('black_tailored_trousers');
      expect(l.pieces.every((p) => p.status === 'Available')).toBe(true);
      expect(l.score).toBeGreaterThanOrEqual(C.VALID_SCORE);
    }
    const keys = looks.map((l) => l.pieces.filter((p) => C.MAIN.includes(p.category)).map((p) => p.id).sort().join('+'));
    expect(new Set(keys).size).toBe(keys.length);
  });
  test('ST-03 the virtual closet never changes the real list, and one new formal bottom adds outfits', () => {
    const before = pieces.length;
    const hyp = { id: 'virtual-x', category: 'Bottom', colour: 'Navy', dressCodes: [3, 4], styles: ['Classic'] };
    const a = C.countValidOutfits(pieces, {}, ['Work']).total;
    const b = C.countValidOutfits(C.virtualCloset(pieces, { add: [hyp] }), {}, ['Work']).total;
    expect(pieces.length).toBe(before);
    expect(b).toBeGreaterThan(a);
  });
  test('ST-04 modest-only is respected: no non-modest piece in any look', () => {
    const looks = C.enumerateOutfits(pieces, { occasion: 'Dinner', prefs: { modest: true } });
    expect(looks.every((l) => l.pieces.every((p) => p.modest))).toBe(true);
  });
});

describe('Strict JSON from the language model (callClaudeJSON)', () => {
  const schema = { type: 'object', required: ['itemIds'], properties: { itemIds: { type: 'array', items: { type: 'string' } } } };
  const fake = (answers) => ({ enabled: true, calls: 0, async tool() { return answers[this.calls++]; } });
  test('ST-05 an invented garment id is rejected, retried once, then the caller falls back (null)', async () => {
    const llm = fake([{ itemIds: ['someone-elses'] }, { itemIds: ['also-fake'] }]);
    expect(await callClaudeJSON(llm, { system: '', content: [], schema, allowedIds: ['a', 'b'] })).toBeNull();
    expect(llm.calls).toBe(2);
  });
  test('ST-06 a bad shape is retried and the valid second answer is used', async () => {
    const llm = fake([{ wrong: 1 }, { itemIds: ['a'] }]);
    expect(await callClaudeJSON(llm, { system: '', content: [], schema, allowedIds: ['a', 'b'] })).toEqual({ itemIds: ['a'] });
  });
  test('ST-07 no model → null without a call; checkSchema names the problem', async () => {
    expect(await callClaudeJSON(null, { schema })).toBeNull();
    expect(checkSchema({ itemIds: 'x' }, schema)[0]).toMatch(/list/);
  });
});

describe('Cher mode weighted sampling', () => {
  const looks = [{ itemIds: ['a', 'b', 'c'], score: 100 }, { itemIds: ['d', 'e', 'f'], score: 66 }];
  test('ST-08 over many spins the high-score look is picked far more often (k = 8)', () => {
    const rand = seeded(7); let hi = 0;
    for (let i = 0; i < 2000; i++) if (cher.sample(looks, { k: 8 }, rand).score === 100) hi++;
    expect(hi / 2000).toBeGreaterThan(0.9);
  });
  test('ST-09 rediscovery multiplies the weight by 1 + 3 × forgotten pieces', () => {
    const forgotten = new Set(['d', 'e']);
    expect(cher.weightOf(looks[1], { k: 8, rediscovery: true, forgotten })).toBeCloseTo(Math.pow(0.66, 8) * 7, 10);
    const rand = seeded(11); let without = 0; let withIt = 0;
    for (let i = 0; i < 4000; i++) {
      if (cher.sample(looks, { k: 8 }, rand).score === 66) without++;
      if (cher.sample(looks, { k: 8, rediscovery: true, forgotten }, rand).score === 66) withIt++;
    }
    expect(withIt).toBeGreaterThan(without * 3);
  });
});

describe('Keyword fallbacks (work with no AI key)', () => {
  test('ST-10 invitation text → wedding, date, time, black tie = level 5', () => {
    const c = invitation.fromText('Join us for the wedding of Sara & Omar on 12 December at 7:30 pm. Dress code: black tie.');
    expect(c).toMatchObject({ title: 'Wedding', dressCodeLevel: 5, occasion: 'Wedding', time: '19:30' });
    expect(c.date).toMatch(/^\d{4}-12-12$/);
    expect(levelFromText('cocktail attire')).toBe(4);
    expect(levelFromText('business casual')).toBe(3);
    expect(dateFromText('2027-03-05')).toBe('2027-03-05');
    expect(timeFromText('starts 18:00')).toBe('18:00');
  });
  test('ST-11 rescue: "coffee on my shirt" is a stain on the top', () => {
    const outfit = [{ id: 't', category: 'Top' }, { id: 'b', category: 'Bottom' }, { id: 's', category: 'Shoes' }];
    expect(rescue.parseKeywords('I spilled coffee on my shirt', outfit)).toMatchObject({ problem: 'stain', affectedGarmentIds: ['t'] });
    expect(rescue.parseKeywords('my heel broke', outfit)).toMatchObject({ problem: 'damage', affectedGarmentIds: ['s'] });
  });
  test('ST-12 recreate: a description becomes target pieces; matching needs the same category', () => {
    const t = recreate.fromText('black blazer, white shirt and blue jeans');
    expect(t.map((x) => x.category)).toEqual(['Layer', 'Top', 'Bottom']);
    expect(recreate.matchScore({ category: 'Layer', colour: 'Black' }, { category: 'Top', colour: 'Black' })).toBe(0);
    expect(recreate.matchScore({ category: 'Layer', colour: 'Black' }, { category: 'Layer', colour: 'Black' })).toBe(100);
  });
  test('ST-13 feature flags: FEATURES_OFF turns single features off', () => {
    expect(featureFlags({ FEATURES_OFF: 'mood, Wrapped' })).toMatchObject({ mood: false, wrapped: false, buy: true, friends: true });
  });
});

describe('Studio features through the offline demo (real services, in-memory data)', () => {
  let local;
  const call = (method, url, body) => local.handle(method, url, body, `Bearer ${TOKEN}`);
  const ok = async (method, url, body) => { const r = await call(method, url, body); if (r.status !== 200) throw new Error(`${url} → ${r.status} ${JSON.stringify(r.data)}`); return r.data; };
  let items; const by = (n) => items.find((p) => p.name === n).id;
  beforeEach(async () => { local = createLocalApi(); await local.ready; items = (await ok('GET', '/items')).items; });

  test('ST-14 Should I buy this: before/after counts per occasion come from our code; a twin is a Skip', async () => {
    const r = await ok('POST', '/studio/buy/check', { piece: { category: 'Bottom', colour: 'Black', dressCodes: [3, 4], styles: ['Classic'], name: 'Black formal trousers' } });
    expect(r.after - r.before).toBe(r.gain);
    expect(r.byOccasion.length).toBeGreaterThan(2);
    expect(r.verdict).toBe('Skip'); // she already owns black tailored trousers
    const d = await ok('POST', '/studio/buy/donate', { itemId: by('Navy blazer') });
    expect(d.before - d.after).toBe(d.lost);
  });
  test('ST-15 Cher mode: only her Available pieces, locked top never changes, feedback stored', async () => {
    const mine = new Set(items.filter((p) => p.status === 'Available').map((p) => p.id));
    const a = await ok('POST', '/cher-mode/spin', { occasion: 'Everyday' });
    expect(a.itemIds.every((id) => mine.has(id))).toBe(true);
    expect(['match', 'mismatch']).toContain(a.verdict);
    for (let i = 0; i < 5; i++) expect((await ok('POST', '/cher-mode/spin', { occasion: 'Everyday', lockedGarmentIds: { top: a.outfit.top.id } })).outfit.top.id).toBe(a.outfit.top.id);
    expect((await call('POST', '/cher-mode/spin', { lockedGarmentIds: { top: 'not-mine' } })).status).toBe(400);
    expect((await ok('POST', '/cher-mode/feedback', { garmentIds: a.itemIds, score: a.score, action: 'accepted' })).stored).toBe(true);
  });
  test('ST-16 Emergency rescue changes the fewest pieces and never re-uses the stained one', async () => {
    const outfit = [by('Ivory silk blouse'), by('Black tailored trousers'), by('Black loafers')];
    const r = await ok('POST', '/studio/rescue', { itemIds: outfit, problem: 'I spilled coffee on my blouse', occasion: 'Work' });
    expect(r.problem).toBe('stain');
    expect(r.fix.itemIds).not.toContain(by('Ivory silk blouse'));
    expect(r.fix.changed).toBe(1);
    expect(r.fix.score).toBeGreaterThanOrEqual(83);
  });
  test('ST-17 Invitation: decode → confirm creates a Planner event and returns looks for that dress code', async () => {
    const d = await ok('POST', '/studio/invitation/decode', { text: 'Gala dinner on 2 December at 8 pm. Black tie.' });
    expect(d.card.dressCodeLevel).toBe(5);
    const c = await ok('POST', '/studio/invitation/confirm', { card: d.card });
    expect(c.event).toMatchObject({ title: d.card.title, dressCode: 5 });
  });
  test('ST-18 Mood, restyle, recreate, fit check and wrapped all answer from her own closet', async () => {
    const m = await ok('POST', '/studio/mood', { mood: 'cozy', occasion: 'University' });
    expect(m.looks.length).toBeGreaterThan(0);
    expect(m.looks.every((l) => l.score >= 83)).toBe(true);
    expect((await call('POST', '/studio/mood', { mood: 'angry' })).status).toBe(400);
    expect((await ok('POST', '/studio/mood/restyle', { itemId: by('Black blazer') })).moods.length).toBeGreaterThan(2);
    const rc = await ok('POST', '/studio/recreate', { text: 'black blazer, white shirt, silver heels' });
    expect(rc.matches[0]).toMatchObject({ level: 'Exact', match: { name: 'Black blazer' } });
    const f = await ok('POST', '/studio/fit-check', { itemIds: [by('Breton striped top'), by('Light-wash jeans'), by('White sneakers')] });
    expect(typeof f.score).toBe('number');
    const w = await ok('GET', '/studio/wrapped?days=90');
    expect(w.outfitsWorn).toBeGreaterThan(0);
    expect(w.topColours.reduce((t, c) => t + c.share, 0)).toBeLessThanOrEqual(100);
  });
  test('ST-19 Friends’ closet: request → notification → give access → full closet → borrow → owner notified → approve', async () => {
    const { NOUR_TOKEN } = require('../../../tools/offline_demo/localApi');
    const asNour = (method, url, body) => local.handle(method, url, body, `Bearer ${NOUR_TOKEN}`);
    const nourId = '00000000-0000-4000-8000-000000000010';
    expect((await call('GET', `/studio/friends/${nourId}/closet`)).status).toBe(403); // not friends yet
    await ok('POST', '/studio/friends', { email: 'nour.demo@closet.app' });
    expect((await call('GET', `/studio/friends/${nourId}/closet`)).status).toBe(403); // pending is not enough
    const notes = (await asNour('GET', '/notifications')).data.notifications;
    expect(notes.some((n) => n.type === 'CLOSET_ACCESS_REQUEST' && /Habiba requested access to your closet/.test(n.text))).toBe(true);
    const inc = (await asNour('GET', '/studio/friends')).data.incoming[0];
    expect((await asNour('POST', `/studio/friends/${inc.id}/accept`)).status).toBe(200);
    const cl = await ok('GET', `/studio/friends/${nourId}/closet`);
    expect(cl.items.length).toBe(10);
    expect(Object.keys(cl.items[0]).sort()).toEqual(['available', 'category', 'colour', 'id', 'name', 'owner', 'photoUrl']);
    const dress = cl.items.find((p) => p.name === 'Black slip dress');
    expect((await ok('POST', '/studio/friends/borrow', { friendId: nourId, itemId: dress.id })).request.status).toBe('pending');
    expect((await asNour('GET', '/notifications')).data.notifications.some((n) => n.type === 'BORROW_REQUEST' && /Habiba asks to borrow your black slip dress/.test(n.text))).toBe(true);
    const req = (await asNour('GET', '/studio/friends/requests')).data.requests.find((r) => r.direction === 'incoming');
    expect((await call('POST', `/studio/friends/requests/${req.id}`, { decision: 'approve' })).status).toBe(404); // only the owner decides
    const ap = await asNour('POST', `/studio/friends/requests/${req.id}`, { decision: 'approve' }); if (ap.status !== 200) console.log(JSON.stringify(ap.data)); expect(ap.data.status).toBe('approved');
    expect((await ok('GET', `/studio/friends/${nourId}/closet`)).items.find((p) => p.id === dress.id).available).toBe(false);
    expect((await ok('GET', '/notifications')).notifications.some((n) => n.type === 'BORROW_ANSWER' && /Nour approved/.test(n.text))).toBe(true);
    expect((await call('GET', '/studio/friends/00000000-0000-4000-8000-000000000011/closet')).status).toBe(403); // Karim: not a friend
  });
});
