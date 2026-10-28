// Recommendation diversity (US-19, Milestone 2 fix D-11): three looks must be three styling directions.
// These tests measure the ACTUAL garment overlap between the looks — not just that the titles differ.
const engine = require('../../src/modules/recommendation/engine');
const { demoPieces } = require('../../src/db/seedData');

const prefs = { styles: ['Chic', 'Classic', 'Minimal'], colours: ['Beige', 'Navy', 'Black', 'White'], dressCode: 2, repeatDays: 3 };
const TODAY = new Date('2026-10-28T12:00:00');
const closet = () => demoPieces(TODAY);
const byId = (pieces) => new Map(pieces.map((p) => [p.id, p]));
const majors = (o, map, fixedId) => o.itemIds.filter((id) => id !== fixedId && engine.MAJOR_CATS.includes(map.get(id).category));
function maxSharedMajor(outfits, map, fixedId) {
  let max = 0;
  for (let i = 0; i < outfits.length; i += 1) for (let j = i + 1; j < outfits.length; j += 1) {
    const a = majors(outfits[i], map, fixedId); const b = majors(outfits[j], map, fixedId);
    max = Math.max(max, a.filter((x) => b.includes(x)).length);
  }
  return max;
}

describe('Diversity-aware ranking on the seeded closet', () => {
  test.each([
    ['University', 29], ['University', 22], ['University', 15], ['Work', 29], ['Work', 15], ['Dinner', 29], ['Dinner', 22],
  ])('DV-01 %s at %d °C: exactly 3 looks, any two share at most ONE major garment', (occasion, tempC) => {
    const pieces = closet(); const map = byId(pieces);
    const r = engine.recommend(pieces, { occasion, prefs, weather: { tempC }, today: TODAY });
    expect(r.outfits).toHaveLength(3);
    expect(maxSharedMajor(r.outfits, map)).toBeLessThanOrEqual(1);
  });

  test('DV-02 the three University looks use three different tops and at least two different bottoms', () => {
    const pieces = closet(); const map = byId(pieces);
    const r = engine.recommend(pieces, { occasion: 'University', prefs, weather: { tempC: 29 }, today: TODAY });
    const tops = r.outfits.map((o) => o.itemIds.find((id) => ['Top', 'Dress'].includes(map.get(id).category)));
    const bottoms = r.outfits.map((o) => o.itemIds.find((id) => map.get(id).category === 'Bottom')).filter(Boolean);
    expect(new Set(tops).size).toBe(3);
    expect(new Set(bottoms).size).toBeGreaterThanOrEqual(2);
  });

  test('DV-03 no two looks are the same set of pieces, and every look keeps a passing quality', () => {
    const pieces = closet();
    const r = engine.recommend(pieces, { occasion: 'Work', prefs, weather: { tempC: 22 }, today: TODAY });
    const keys = r.outfits.map((o) => [...o.itemIds].sort().join('|'));
    expect(new Set(keys).size).toBe(3);
    const best = Math.max(...r.outfits.map((o) => o.ruleScore));
    expect(r.outfits.every((o) => o.ruleScore >= best - 17)).toBe(true);
  });

  test('DV-04 a slightly lower-ranked but different look beats a near-copy of the first look', () => {
    // hand-made ranking: B is a near copy of A (3 shared majors), C shares nothing with A
    const P = (id, category) => ({ id, category });
    const A = { pieces: [P('t1', 'Top'), P('b1', 'Bottom'), P('s1', 'Shoes')], rule: 100, rank: 120 };
    const B = { pieces: [P('t1', 'Top'), P('b1', 'Bottom'), P('s1', 'Shoes'), P('x1', 'Extra')], rule: 100, rank: 119 };
    const C = { pieces: [P('t2', 'Top'), P('b2', 'Bottom'), P('s2', 'Shoes')], rule: 100, rank: 110 };
    const D = { pieces: [P('t3', 'Top'), P('b3', 'Bottom'), P('s1', 'Shoes')], rule: 100, rank: 105 };
    const chosen = engine.pickDiverse([A, B, C, D]);
    expect(chosen).toEqual([A, C, D]);
  });

  test('DV-05 a tiny closet still returns looks (the constraint relaxes instead of failing)', () => {
    const pieces = closet().filter((p) => ['breton_striped_top', 'blue_oxford_shirt', 'sage_linen_shirt', 'beige_wide_leg_trousers', 'white_sneakers'].includes(p.id));
    const r = engine.recommend(pieces, { occasion: 'University', prefs, weather: { tempC: 22 }, today: TODAY });
    expect(r.outfits.length).toBe(3);
  });
});

describe('Style this piece / Another chance keeps the chosen piece in every look (regression D-06)', () => {
  test.each([['denim_jacket', 'University', 29], ['camel_cardigan', 'Everyday', 31], ['denim_jacket', 'Everyday', 15], ['cream_knit_sweater', 'University', 30]])(
    'DV-06 %s for %s at %d °C: 3 looks, all contain it, other majors still diverse', (fixedId, occasion, tempC) => {
      const pieces = closet(); const map = byId(pieces);
      const level = Math.min(...map.get(fixedId).dressCodes);
      const r = engine.recommend(pieces, { occasion, level, fixedId, prefs, weather: { tempC }, today: TODAY });
      expect(r.outfits).toHaveLength(3);
      expect(r.outfits.every((o) => o.itemIds.includes(fixedId))).toBe(true);
      expect(maxSharedMajor(r.outfits, map, fixedId)).toBeLessThanOrEqual(1);
    },
  );
  test('DV-07 a piece in the laundry cannot be styled: no looks and a clear note', () => {
    const pieces = closet();
    const r = engine.recommend(pieces, { occasion: 'University', fixedId: 'white_fitted_tee', prefs, weather: { tempC: 22 }, today: TODAY });
    expect(r.outfits).toHaveLength(0);
    expect(r.note).toMatch(/not Available/);
  });
});
