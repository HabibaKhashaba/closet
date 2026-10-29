// The one garment lifecycle (shared/lifecycle.js) and the v1.6 Ask Closet prompts (equivalence classes).
const L = require('../../src/shared/lifecycle');
const { parse } = require('../../src/modules/assistant/keywordParser');
const ins = require('../../src/modules/intelligence/insights');
const { demoPieces } = require('../../src/db/seedData');

const NOW = new Date('2026-10-28T10:00:00');
describe('LF lifecycle helpers', () => {
  test('LF-01 only Available can be worn; Ready to donate is leaving; everything else is still owned', () => {
    expect(L.LIFECYCLE.filter((s) => L.isWearable({ status: s }))).toEqual(['Available']);
    expect(L.LIFECYCLE.filter((s) => L.isLeaving({ status: s }))).toEqual(['Ready to donate']);
    expect(L.LIFECYCLE.filter((s) => L.isOwned({ status: s }))).toHaveLength(8);
  });
  test('LF-02 care = laundry, needs repair / alteration, at the tailor; every state has a label and a sentence', () => {
    expect(L.LIFECYCLE.filter((s) => L.inCare({ status: s })).sort()).toEqual(['At tailor', 'Laundry', 'Needs alteration', 'Needs repair']);
    for (const s of L.LIFECYCLE) { expect(L.LABEL[s]).toBeTruthy(); expect(L.WHERE[s]).toBeTruthy(); expect(L.GROUP[s]).toBeTruthy(); }
  });
  test('LF-03 a piece with no status is Available (new pieces)', () => {
    expect(L.statusOf({})).toBe('Available');
    expect(L.isWearable({})).toBe(true);
  });
  test('LF-04 Donated is not a state: the piece leaves the active closet (archived with reason Donated)', () => {
    expect(L.LIFECYCLE).not.toContain('Donated');
    expect(L.ALLOWED['Ready to donate']).toEqual(['Available']);
  });
  test('LF-05 the seeded closet: the camel cardigan waits for a repair and is not a forgotten-piece candidate', () => {
    const pieces = demoPieces(NOW);
    const cardigan = pieces.find((p) => p.id === 'camel_cardigan');
    expect(cardigan).toMatchObject({ status: 'Needs repair', care: { kind: 'repair', reason: 'Loose button' } });
    expect(ins.forgottenCandidates(pieces, { today: NOW, tempC: 12 }).some((c) => c.id === 'camel_cardigan')).toBe(false);
    expect(pieces.find((p) => p.id === 'rose_wrap_dress').loan).toMatchObject({ person: 'Nour' });
  });
  test('LF-06 message wording (D-23): plural garments take “are”, dates read as a day, never as ISO', () => {
    expect(['black loafers', 'light-wash jeans', 'brown ankle boots'].map(L.isAre)).toEqual(['are', 'are', 'are']);
    expect(['navy blazer', 'rose wrap dress', 'silk scarf'].map(L.isAre)).toEqual(['is', 'is', 'is']);
    expect(L.onDay('2026-11-02')).toBe('Mon 2 Nov');
    expect(L.onDay('2026-10-24T00:00:00.000Z')).toBe('Sat 24 Oct');
    expect(L.onDay(null)).toBe('');
  });
});

describe('LF-10 v1.6 Ask Closet prompts route to the function that owns the question', () => {
  test.each([
    ['What needs repair?', 'care_list'],
    ['What is at the tailor?', 'care_list'],
    ['Anything that needs an alteration?', 'care_list'],
    ['When is my black blazer back from the tailor?', 'availability'],
    ['Is my black blazer ready at the tailor?', 'availability'],
    ['Who has my black blazer?', 'borrowed'],
    ['What clothes are ready to donate?', 'donation_list'],
    ['Show me what is waiting to be donated', 'donation_list'],
    ['What could I donate?', 'donate_candidates'],
    ['Mark the denim jacket for donation.', 'donate_piece'],
    ['I donated the denim jacket.', 'donate_done'],
    ["What haven't I packed?", 'unpacked'],
    ['Pack me for 5 days in Paris with a carry-on.', 'trip_pack'],
    ['What should I bring back for winter?', 'seasonal'],
    ['Do I need to do laundry before Monday?', 'laundry_risk'],
    ['Is tomorrow’s outfit still okay?', 'plan_check'],
    ['What did I wear to Salma’s birthday?', 'memory'],
    ['What has my best cost per wear?', 'value'],
    ['Would black loafers add anything to my wardrobe?', 'buy_check'],
    ['I have a wedding tomorrow and nothing to wear.', 'event_rescue'],
    ['Lend my black blazer to Nour until Friday', 'lend_piece'],
    ['My black blazer sleeves are too long', 'set_status'],
  ])('“%s” → %s', (q, fn) => expect(parse(q, NOW).fn).toBe(fn));
  test('LF-11 the arguments carry what the answer needs', () => {
    expect(parse('Lend my black blazer to Nour until Friday', NOW).args).toMatchObject({ person: 'Nour', date: '2026-10-30', piece: { colour: 'Black', name: 'blazer' } });
    expect(parse('My black blazer sleeves are too long', NOW).args).toMatchObject({ status: 'Needs alteration', reason: 'My black blazer sleeves are too long' });
    expect(parse('When is my black blazer back from the tailor?', NOW).args.tailor).toBe(true);
    expect(parse('What should I bring back for winter?', NOW).args).toMatchObject({ direction: 'bring_back', season: 'winter' });
  });
  test('LF-12 give / sell are not donation choices any more (donate only)', () => {
    expect(parse('I gave away the denim jacket', NOW).fn).toBe('donate_done');
    expect(parse('Sell my denim jacket', NOW).fn).not.toMatch(/donate|rehome/);
  });
});
