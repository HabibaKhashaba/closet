// Unit tests of the Recommendation Engine (filter → combine → score → explain), the builder check
// and change-one-piece. Black-box: equivalence classes of pieces, weather boundaries at 19 and 26 °C.
const engine = require('../../src/modules/recommendation/engine');

let n = 0;
const piece = (category, colour, extra = {}) => ({
  id: `00000000-0000-0000-0000-${String(++n).padStart(12, '0')}`,
  category, colour, fabric: 'Cotton', season: 'All seasons', styles: ['Chic'], dressCodes: [1, 2, 3], modest: true, status: 'Available', wearCount: 1, lastWornAt: new Date(Date.now() - 10 * 86400000), ...extra,
});
const closet = () => {
  n = 0;
  return [
    piece('Top', 'White'), piece('Top', 'Pink'), piece('Top', 'Navy', { fabric: 'Wool', season: 'Winter' }),
    piece('Bottom', 'Black'), piece('Bottom', 'Beige'), piece('Bottom', 'Red', { dressCodes: [1] }),
    piece('Dress', 'Blue', { dressCodes: [2, 4, 5], styles: ['Elegant'] }),
    piece('Shoes', 'White'), piece('Shoes', 'Brown', { dressCodes: [1] }), piece('Shoes', 'Black', { dressCodes: [2, 3, 4, 5] }),
    piece('Layer', 'Navy', { fabric: 'Wool', season: 'Winter' }), piece('Extra', 'Grey', { dressCodes: [1, 2] }),
  ];
};
const mild = { tempC: 22 };

describe('Filter step', () => {
  test('RE-01 unavailable pieces are never used (US-17)', () => {
    const c = closet(); c[0].status = 'Laundry'; c[1].status = 'Borrowed';
    const r = engine.recommend(c, { occasion: 'Dinner', weather: mild });
    expect(r.outfits.every((o) => !o.itemIds.includes(c[0].id) && !o.itemIds.includes(c[1].id))).toBe(true);
  });
  test('RE-02 every main piece suits the occasion level (US-21)', () => {
    const c = closet();
    const r = engine.recommend(c, { occasion: 'Work', weather: mild }); // level 3
    const byId = new Map(c.map((p) => [p.id, p]));
    expect(r.outfits.length).toBeGreaterThan(0);
    expect(r.outfits.every((o) => o.itemIds.map((id) => byId.get(id)).filter((p) => p.category !== 'Layer').every((p) => p.dressCodes.includes(3)))).toBe(true);
  });
  test('RE-03 modest on → no non-modest piece appears (US-21)', () => {
    const c = closet(); c[1].modest = false;
    const r = engine.recommend(c, { occasion: 'Dinner', weather: mild, prefs: { modest: true } });
    expect(r.outfits.some((o) => o.itemIds.includes(c[1].id))).toBe(false);
  });
  test('RE-04 hidden pieces are skipped for 7 days (US-61)', () => {
    const c = closet();
    const r = engine.recommend(c, { occasion: 'Dinner', weather: mild, hiddenIds: [c[0].id] });
    expect(r.outfits.some((o) => o.itemIds.includes(c[0].id))).toBe(false);
  });
});

describe('Weather rules (BVA at 19 and 26 °C, US-20)', () => {
  const warmUsed = (r, c) => r.outfits.some((o) => o.itemIds.some((id) => engine.isWarm(c.find((p) => p.id === id))));
  test('RE-05 25 °C: warm pieces allowed', () => {
    const c = closet();
    expect(engine.filterPieces(c, { level: 1, weather: { tempC: 25 } }).some(engine.isWarm)).toBe(true);
  });
  test('RE-06 26 °C: no warm piece at all', () => {
    const c = closet();
    expect(warmUsed(engine.recommend(c, { occasion: 'Everyday', weather: { tempC: 26 } }), c)).toBe(false);
  });
  test('RE-07 18 °C: every outfit has a warm layer', () => {
    const c = closet();
    const r = engine.recommend(c, { occasion: 'Everyday', weather: { tempC: 18 } });
    expect(r.outfits.length).toBeGreaterThan(0);
    expect(r.outfits.every((o) => o.itemIds.some((id) => c.find((p) => p.id === id).category === 'Layer'))).toBe(true);
  });
  test('RE-08 19 °C: no layer required', () => {
    const c = closet();
    expect(engine.criteria([c[0], c[3], c[7]], { level: 1, weather: { tempC: 19 } })[3].pass).toBe(true);
    expect(engine.criteria([c[0], c[3], c[7]], { level: 1, weather: { tempC: 18 } })[3].pass).toBe(false);
  });
});

describe('Combine and score', () => {
  test('RE-09 three outfits, each complete, no two share more than 2 pieces (US-19)', () => {
    const c = closet();
    const r = engine.recommend(c, { occasion: 'Everyday', weather: mild });
    expect(r.outfits).toHaveLength(3);
    for (const o of r.outfits) expect(o.criteria[0].pass).toBe(true);
    for (let i = 0; i < 3; i += 1) for (let j = i + 1; j < 3; j += 1) {
      expect(r.outfits[i].itemIds.filter((id) => r.outfits[j].itemIds.includes(id)).length <= 2).toBe(true);
    }
  });
  test('RE-10 rule score = 100 − 17 per failed criterion (§3.1)', () => {
    const crit = [{ pass: true }, { pass: false }, { pass: false }, { pass: true }, { pass: true }];
    expect(engine.ruleScore(crit)).toBe(66);
    expect(engine.ruleScore(crit.map(() => ({ pass: true })))).toBe(100);
  });
  test('RE-11 colour harmony: red + pink clash; 3 accents fail; neutrals pass', () => {
    const c = closet();
    const red = piece('Bottom', 'Red'); const green = piece('Extra', 'Green');
    expect(engine.criteria([c[1], red, c[7]], { level: 1 })[1].pass).toBe(false); // pink + red
    expect(engine.criteria([c[1], piece('Bottom', 'Blue'), piece('Shoes', 'Yellow'), green], { level: 1 })[1].pass).toBe(false);
    expect(engine.criteria([c[0], c[3], c[7]], { level: 1 })[1].pass).toBe(true);
  });
  test('RE-12 every outfit has 3–5 reasons and a rule score (US-57)', () => {
    const r = engine.recommend(closet(), { occasion: 'Dinner', weather: mild, prefs: { colours: ['Pink'] } });
    for (const o of r.outfits) { expect(o.reasons.length >= 3 && o.reasons.length <= 5).toBe(true); expect(typeof o.ruleScore).toBe('number'); }
  });
  test('RE-13 “Style this piece”: all 3 outfits contain it (US-59)', () => {
    const c = closet();
    const r = engine.recommend(c, { occasion: 'Everyday', weather: mild, fixedId: c[1].id });
    expect(r.outfits.length).toBeGreaterThan(0);
    expect(r.outfits.every((o) => o.itemIds.includes(c[1].id))).toBe(true);
  });
  test('RE-14 a forgotten piece is ranked up and named in the reasons (US-54)', () => {
    const c = closet(); c[1].lastWornAt = new Date(Date.now() - 50 * 86400000);
    const r = engine.recommend(c, { occasion: 'Everyday', weather: mild });
    expect(r.outfits[0].itemIds).toContain(c[1].id);
    expect(r.outfits[0].reasons.join(' ')).toMatch(/not worn for 50 days/);
  });
  test('RE-15 not enough pieces → no outfit and a clear note', () => {
    const r = engine.recommend([piece('Top', 'White')], { occasion: 'Wedding', weather: mild });
    expect(r.outfits).toHaveLength(0);
    expect(r.note).toMatch(/Not enough Available pieces for Formal/);
  });
  test('RE-16 a look rejected as “Not in the mood today” is not suggested again this week', () => {
    const c = closet();
    const first = engine.recommend(c, { occasion: 'Everyday', weather: mild }).outfits[0].itemIds;
    const again = engine.recommend(c, { occasion: 'Everyday', weather: mild, rejectedLooks: [first] });
    expect(again.outfits.some((o) => o.itemIds.length === first.length && o.itemIds.every((id) => first.includes(id)))).toBe(false);
  });
});

describe('Change one piece and the outfit builder', () => {
  test('RE-17 swap changes only that slot, with an Available alternative (US-24)', () => {
    const c = closet();
    const ids = [c[0].id, c[3].id, c[7].id];
    const r = engine.swap(c, ids, 2, { occasion: 'Everyday', weather: mild });
    expect(r.outfit.itemIds[0]).toBe(c[0].id);
    expect(r.outfit.itemIds[1]).toBe(c[3].id);
    expect(r.outfit.itemIds[2]).not.toBe(c[7].id);
    expect(c.find((p) => p.id === r.outfit.itemIds[2]).category).toBe('Shoes');
  });
  test('RE-18 swap with no alternative returns null', () => {
    const only = [piece('Top', 'White'), piece('Bottom', 'Black'), piece('Shoes', 'White')];
    expect(engine.swap(only, only.map((p) => p.id), 2, { occasion: 'Everyday' }).outfit).toBeNull();
  });
  test('RE-19 builder: pass/fail per criterion and one sentence naming the failure (US-43, US-66)', () => {
    const c = closet();
    const r = engine.check([c[0], c[5], c[8]], { occasion: 'Work', weather: mild }); // red bottom and brown shoes are level 1 only
    expect(r.criteria.map((x) => x.name)).toEqual(['Complete outfit', 'Colour harmony', 'Dress code', 'Weather fit', 'Style consistency']);
    expect(r.ruleScore).toBe(83);
    expect(r.sentence).toMatch(/^Dress code: .* is not Business Casual\.$/);
  });
  test('RE-20 builder: incomplete outfit fails “Complete outfit”', () => {
    const c = closet();
    expect(engine.check([c[0], c[3]], { occasion: 'Everyday' }).criteria[0].pass).toBe(false);
  });
});

describe('Version 1.2: recycle time, bags, Mix & Match breakdown, titles', () => {
  test('RE-21 recycle time: a top worn 1 day ago waits when repeatDays = 3', () => {
    const c = closet(); c[0].lastWornAt = new Date(Date.now() - 1 * 86400000);
    expect(engine.filterPieces(c, { level: 1, prefs: { repeatDays: 3 } }).some((p) => p.id === c[0].id)).toBe(false);
    expect(engine.filterPieces(c, { level: 1, prefs: { repeatDays: 0 } }).some((p) => p.id === c[0].id)).toBe(true);
  });
  test('RE-22 recycle time BVA: worn exactly N days ago is allowed again', () => {
    const c = closet(); const now = new Date('2026-10-25T12:00:00');
    c[0].lastWornAt = new Date('2026-10-22T12:00:00');
    expect(engine.filterPieces(c, { level: 1, prefs: { repeatDays: 3 }, today: now }).some((p) => p.id === c[0].id)).toBe(true);
    c[0].lastWornAt = new Date('2026-10-22T13:00:00');
    expect(engine.filterPieces(c, { level: 1, prefs: { repeatDays: 3 }, today: now }).some((p) => p.id === c[0].id)).toBe(false);
  });
  test('RE-23 recycle time never blocks shoes, bags or accessories', () => {
    const c = closet(); c[7].lastWornAt = new Date(); // white shoes worn today
    expect(engine.filterPieces(c, { level: 1, prefs: { repeatDays: 3 } }).some((p) => p.id === c[7].id)).toBe(true);
  });
  test('RE-24 a bag fills the fourth slot and must suit the level', () => {
    const c = closet(); const bag = piece('Bag', 'Black', { dressCodes: [3] });
    const r = engine.recommend([...c, bag], { occasion: 'Work', weather: mild });
    expect(r.outfits.some((o) => o.itemIds.includes(bag.id))).toBe(true);
    expect(engine.filterPieces([bag], { level: 1 })).toHaveLength(0);
  });
  test('RE-25 breakdown: all-pass look scores high; a clash drops colour to 40', () => {
    const c = closet();
    const good = engine.breakdown([c[0], c[3], c[7]], { level: 1, weather: mild });
    expect(good).toMatchObject({ colour: 92, formality: 100, weather: 95 });
    const clash = engine.breakdown([c[1], piece('Bottom', 'Red'), c[7]], { level: 1 });
    expect(clash.colour).toBe(40);
    expect(clash.weather).toBe(80); // no forecast
  });
  test('RE-26 breakdown: one level off gives half credit for formality', () => {
    const c = closet();
    expect(engine.breakdown([c[0], c[5], c[7]], { level: 2 }).formality).toBe(83); // red bottom is level 1 only
  });
  test('RE-27 breakdown weather: warm piece at 30 °C, no layer at 12 °C', () => {
    const c = closet();
    expect(engine.breakdown([c[2], c[3], c[7]], { level: 1, weather: { tempC: 30 } }).weather).toBe(60);
    expect(engine.breakdown([c[0], c[3], c[7]], { level: 1, weather: { tempC: 12 } }).weather).toBe(45);
  });
  test('RE-28 outfit title uses the level and the key piece name', () => {
    const d = piece('Dress', 'Navy', { name: 'Navy silk midi dress' });
    expect(engine.outfitTitle([d], 4)).toBe('Evening Midi Dress');
    expect(engine.outfitTitle([piece('Top', 'White')], 1)).toBe('Easy White Top');
    expect(engine.outfitTitle([], 1)).toBe('New look');
  });
  test('RE-29 Mix & Match explanation names what to improve', () => {
    const c = closet();
    const r = engine.check([c[0], c[5], c[8]], { occasion: 'Work', weather: mild });
    expect(r.explanation).toMatch(/To improve: dress code: red bottom is not Business Casual\./);
    expect(engine.explainMix([], [], {}, {})).toMatch(/Pick pieces/);
  });
});
