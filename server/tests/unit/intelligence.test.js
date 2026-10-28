// Unit tests for version 1.3 Closet Intelligence: explainable recommendations, Wardrobe Health,
// learned patterns, duplicate (similarity) detection and the packing planner. Pure functions only.
const engine = require('../../src/modules/recommendation/engine');
const { wardrobeHealth, potentialDuplicates, grade } = require('../../src/modules/intelligence/health');
const { detectPatterns, previousOf, confidence } = require('../../src/modules/intelligence/learning');
const { similarity, similarOwned, SIMILAR_AT } = require('../../src/modules/shopping/shoppingModule');
const { planTrip } = require('../../src/modules/packing/packingModule');
const { OCCASION_TEMPLATES, OCCASIONS, STYLES } = require('../../src/shared/vocabulary');

let n = 0;
const piece = (o) => ({ id: `00000000-0000-0000-0000-${String(++n).padStart(12, '0')}`, colour: 'Black', fabric: 'Cotton', season: 'All seasons', styles: ['Classic'], dressCodes: [1, 2, 3], modest: true, status: 'Available', wearCount: 0, lastWornAt: null, ...o });
const daysAgo = (d) => new Date(Date.now() - d * 86400000).toISOString();
const closet = () => [
  piece({ name: 'White tee', category: 'Top', colour: 'White', styles: ['Minimal'], dressCodes: [1, 2] }),
  piece({ name: 'Blue shirt', category: 'Top', colour: 'Blue', styles: ['Classic'] }),
  piece({ name: 'Black trousers', category: 'Bottom', styles: ['Classic', 'Minimal'] }),
  piece({ name: 'Jeans', category: 'Bottom', colour: 'Blue', fabric: 'Denim', styles: ['Casual'], dressCodes: [1, 2] }),
  piece({ name: 'White sneakers', category: 'Shoes', colour: 'White', styles: ['Casual', 'Minimal'], dressCodes: [1, 2] }),
  piece({ name: 'Black loafers', category: 'Shoes', styles: ['Classic'], dressCodes: [2, 3] }),
  piece({ name: 'Navy blazer', category: 'Layer', colour: 'Navy', fabric: 'Wool', season: 'Winter', styles: ['Classic'], dressCodes: [2, 3, 4] }),
  piece({ name: 'Beige trench', category: 'Layer', colour: 'Beige', styles: ['Classic'], dressCodes: [1, 2, 3] }),
];

describe('Explainable recommendations (US-57, v1.3)', () => {
  const prefs = { styles: ['Classic'], colours: ['Navy'], modest: true, repeatDays: 3, dressCode: 2 };
  test('EX-01 every outfit has "why" factors and a "Recommended because" sentence', () => {
    const r = engine.recommend(closet(), { occasion: 'Work', prefs, weather: { tempC: 22, place: 'Cairo', condition: 'Clear' } });
    expect(r.outfits.length).toBeGreaterThan(0);
    for (const o of r.outfits) {
      expect(o.explanation).toMatch(/^Recommended because /);
      const factors = o.why.map((f) => f.factor);
      expect(factors).toEqual(expect.arrayContaining(['Occasion', 'Style', 'Modesty', 'Weather']));
    }
  });
  test('EX-02 the explanation names the real context: occasion, dress code, weather and city', () => {
    const r = engine.recommend(closet(), { occasion: 'Work', prefs, weather: { tempC: 22, place: 'Cairo', condition: 'Clear' } });
    const w = r.outfits[0].why;
    expect(w.find((f) => f.factor === 'Occasion').text).toMatch(/Work calls for Business Casual/);
    expect(w.find((f) => f.factor === 'Weather').text).toMatch(/22 °C in Cairo/);
    expect(w.find((f) => f.factor === 'Modesty').text).toMatch(/modest/);
  });
  test('EX-03 availability, favourites and rejection patterns appear when they shaped the look', () => {
    const pieces = closet();
    pieces[3].status = 'Laundry';
    const fav = pieces[2].id;
    const r = engine.recommend(pieces, { occasion: 'Dinner', prefs: { ...prefs, modest: false }, weather: { tempC: 22 }, signals: { total: pieces.length, availableCount: 7, favouriteIds: [fav], rejectCounts: { 'Too formal': 3 } } });
    const all = r.outfits.flatMap((o) => o.why);
    expect(all.find((f) => f.factor === 'Availability').text).toMatch(/1 piece is in the laundry, lent or packed/);
    expect(all.some((f) => f.factor === 'Your feedback' && /3 looks as too formal/.test(f.text))).toBe(true);
    expect(r.outfits.some((o) => o.itemIds.includes(fav) && o.why.some((f) => f.factor === 'Favourites'))).toBe(true);
  });
  test('EX-04 a piece in Laundry or Packed is never recommended (conflict rule)', () => {
    const pieces = closet();
    pieces[2].status = 'Laundry'; pieces[6].status = 'Packed';
    for (const occasion of Object.keys(OCCASIONS)) {
      const r = engine.recommend(pieces, { occasion, prefs: {}, weather: { tempC: 15 } });
      for (const o of r.outfits) expect(o.itemIds.includes(pieces[2].id) || o.itemIds.includes(pieces[6].id)).toBe(false);
    }
  });
  test('EX-05 "Too formal" feedback makes relaxed pieces rank higher, never changing the rule score', () => {
    const rank0 = engine.makeRanker({ prefs: {}, level: 3 });
    const rank1 = engine.makeRanker({ prefs: {}, level: 3, signals: { rejectCounts: { 'Too formal': 2 } } });
    const relaxed = piece({ category: 'Top', dressCodes: [1, 2, 3] });
    const sharp = piece({ category: 'Top', dressCodes: [3, 4] });
    expect(rank1(relaxed) - rank0(relaxed)).toBe(2);
    expect(rank1(sharp) - rank0(sharp)).toBe(0);
  });
  test('EX-06 explanationSentence picks at most three factors and ends with a full stop', () => {
    const s = engine.explanationSentence([{ factor: 'Occasion', text: 'Work calls for X.' }, { factor: 'Style', text: 'The blazer matches your classic preference.' }, { factor: 'Weather', text: '22 °C in Cairo.' }, { factor: 'Modesty', text: 'Every piece is marked modest.' }]);
    expect(s).toBe('Recommended because the blazer matches your classic preference; every piece is marked modest; 22 °C in Cairo.');
    expect(engine.explanationSentence([])).toBe('Recommended for this occasion.');
  });
});

describe('Wardrobe Health (US-89)', () => {
  test('WH-01 empty wardrobe: score 0, flagged empty, one action', () => {
    const h = wardrobeHealth({ pieces: [] });
    expect(h).toMatchObject({ score: 0, empty: true });
    expect(h.actions[0]).toMatch(/Add your first pieces/);
  });
  test('WH-02 perfect closet reaches exactly 100 (every part at its maximum, no penalties)', () => {
    const pieces = closet().map((p) => ({ ...p, dressCodes: [1, 2], styles: [p.id] }));
    const h = wardrobeHealth({ pieces, worn30: new Set(pieces.map((p) => p.id)), gaps: { gaps: [], levels: [{ level: 1 }] }, missingBasics: [] });
    expect(h.score).toBe(100);
    expect(h.grade).toBe('Excellent');
    expect(h.parts.map((p) => p.points)).toEqual([35, 20, 20, 15, 10]);
  });
  test('WH-03 the score is the sum of the parts minus the penalties (formula is transparent)', () => {
    const pieces = closet();
    pieces[0].wearCount = 4; pieces[0].lastWornAt = daysAgo(60);
    pieces[1].status = 'Laundry';
    const h = wardrobeHealth({ pieces, worn30: new Set([pieces[2].id, pieces[4].id]), gaps: { gaps: [{}, {}], levels: [{}, {}] }, missingBasics: ['White button-down shirt', 'Nude or black heels'] });
    const sum = h.parts.reduce((t, p) => t + p.points, 0) + h.penalties.reduce((t, p) => t + p.points, 0);
    expect(h.score).toBe(sum);
    expect(h.parts.find((p) => p.key === 'utilisation').points).toBe(Math.round(35 * 2 / 8));
    expect(h.penalties.find((p) => p.key === 'forgotten').points).toBe(-1);
    expect(h.actions).toEqual(expect.arrayContaining(['Style 1 forgotten piece this week.', 'Consider adding a white button-down shirt.']));
  });
  test('WH-04 penalties are capped at −10 each and the score never goes below 0', () => {
    const pieces = Array.from({ length: 30 }, () => piece({ category: 'Top', colour: 'Black', styles: ['Classic'], wearCount: 3, lastWornAt: daysAgo(90), status: 'Laundry', dressCodes: [1] }));
    const h = wardrobeHealth({ pieces, gaps: { gaps: Array(6).fill({}), levels: [{}, {}] }, missingBasics: Array(7).fill('x') });
    expect(h.penalties.map((p) => p.points)).toEqual([-10, -10]);
    expect(h.score).toBe(0);
    expect(grade(h.score)).toBe('Needs care');
  });
  test('WH-05 potential duplicates: same category and colour with a shared style', () => {
    const a = piece({ category: 'Layer', colour: 'Black', styles: ['Classic'] });
    const b = piece({ category: 'Layer', colour: 'Black', styles: ['Classic', 'Chic'] });
    const c = piece({ category: 'Layer', colour: 'Black', styles: ['Sporty'] });
    const d = potentialDuplicates([a, b, c]);
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ category: 'Layer', colour: 'Black', count: 1 });
    expect(potentialDuplicates([a, c])).toHaveLength(0);
  });
});

describe('Closet has learned (US-40)', () => {
  const prefs = { dressCode: 3, styles: ['Classic'], colours: ['Black'] };
  test('LR-01 two "Too formal" rejections → lower usual dress code, with evidence and confidence', () => {
    const p = detectPatterns({ prefs, rejectCounts: { 'Too formal': 4 } });
    expect(p[0]).toMatchObject({ key: 'less-formal', change: { dressCode: 2 }, count: 4, confidence: 67 });
    expect(p[0].effect).toBe('Your usual dress code moves from Business Casual to Smart Casual.');
  });
  test('LR-02 one rejection is not enough evidence', () => {
    expect(detectPatterns({ prefs, rejectCounts: { 'Too formal': 1 } })).toHaveLength(0);
  });
  test('LR-03 favourite looks reveal a style the profile lacks', () => {
    const favs = [{ pieces: [piece({ styles: ['Elegant'] })] }, { pieces: [piece({ styles: ['Elegant', 'Classic'] })] }, { pieces: [piece({ styles: ['Classic'] })] }];
    const p = detectPatterns({ prefs, favourites: favs });
    expect(p[0]).toMatchObject({ key: 'style-elegant', change: { styles: ['Classic', 'Elegant'] } });
    expect(p[0].evidence).toBe('2 of your 3 favourite looks include elegant pieces');
  });
  test('LR-04 neutral wear history adds the most-worn missing neutral', () => {
    const wears = [{ pieces: [piece({ colour: 'Beige' }), piece({ colour: 'Beige' }), piece({ colour: 'White' }), piece({ colour: 'Black' })] }, { pieces: [piece({ colour: 'Beige' }), piece({ colour: 'Navy' }), piece({ colour: 'Red' }), piece({ colour: 'Black' })] }];
    const p = detectPatterns({ prefs, wears });
    expect(p[0]).toMatchObject({ key: 'neutral-beige', text: 'You prefer neutral colours.' });
    expect(p[0].change.colours).toEqual(['Black', 'Beige']);
  });
  test('LR-05 rarely worn colour; previousOf keeps the exact values for Undo', () => {
    const pieces = [piece({ colour: 'Pink', lastWornAt: daysAgo(80), wearCount: 1 }), piece({ colour: 'Pink' })];
    const p = detectPatterns({ prefs: { ...prefs, colours: ['Black', 'Pink'] }, pieces });
    expect(p[0]).toMatchObject({ key: 'rarely-pink', change: { colours: ['Black'] } });
    expect(previousOf({ colours: ['Black', 'Pink'], dressCode: 3 }, p[0].change)).toEqual({ colours: ['Black', 'Pink'] });
    expect(previousOf(prefs, null)).toBe(null);
    expect(confidence(2)).toBe(50);
  });
});

describe('Duplicate purchase warning (US-65)', () => {
  const blazer = piece({ category: 'Layer', colour: 'Black', styles: ['Classic', 'Chic'], dressCodes: [2, 3, 4], season: 'All seasons' });
  test('DU-01 a near-identical piece scores ≥ 70 and lists what matched', () => {
    const r = similarity(blazer, { category: 'Layer', colour: 'Black', styles: ['Classic'], dressCodes: [3], season: 'Winter' });
    expect(r.score).toBeGreaterThanOrEqual(SIMILAR_AT);
    expect(r.matched).toEqual(['category', 'colour', 'style', 'formality', 'season']);
  });
  test('DU-02 a different category never counts; a different colour falls below the threshold', () => {
    expect(similarity(blazer, { category: 'Top', colour: 'Black' }).score).toBe(0);
    expect(similarOwned([blazer], { category: 'Layer', colour: 'Red', styles: ['Sporty'], dressCodes: [1] })).toHaveLength(0);
  });
});

describe('Ask Closet routes the duplicate question (US-65)', () => {
  const { parse } = require('../../src/modules/assistant/keywordParser');
  test('DU-03 “Do I need another white top?” → buy_check, not the general shopping list', () => {
    expect(parse('Do I need another white top?')).toMatchObject({ fn: 'buy_check', args: { piece: { colour: 'White', category: 'Top' } } });
    expect(parse('What is missing from my wardrobe?').fn).toBe('closet_needs');
  });
});

describe('Packing planner and occasion templates', () => {
  const days = (n, weather) => Array.from({ length: n }, (_, i) => ({ date: `2026-11-1${i}`, occasion: 'Travel', weather }));
  test('PK-01 one outfit per day, pieces re-used, counts add up', () => {
    const r = planTrip(closet(), { days: days(3, { tempC: 22, condition: 'Clear' }), prefs: {} });
    expect(r.counts).toMatchObject({ outfits: 3, days: 3, missing: 0 });
    expect(r.counts.pieces).toBe(r.itemIds.length);
    expect(r.counts.pieces).toBeLessThan(3 * 4);
  });
  test('PK-02 never packs an unavailable piece; rain with no coat → waterproof warning', () => {
    const pieces = closet().filter((p) => p.category !== 'Layer');
    pieces[0].status = 'Laundry';
    const r = planTrip(pieces, { days: days(2, { tempC: 20, condition: 'Rain' }), prefs: {} });
    expect(r.itemIds.includes(pieces[0].id)).toBe(false);
    expect(r.warnings[0]).toMatch(/waterproof outer layer/);
  });
  test('PK-03 a day with no possible outfit is reported as missing', () => {
    const r = planTrip(closet(), { days: [{ date: '2026-11-10', occasion: 'Wedding', weather: { tempC: 22 } }], prefs: {} });
    expect(r.counts.missing).toBe(1);
    expect(r.missing[0].text).toMatch(/No complete formal outfit for wedding/);
  });
  test('OT-01 nine occasion templates, each mapped to a real occasion, level and style', () => {
    expect(OCCASION_TEMPLATES).toHaveLength(9);
    for (const t of OCCASION_TEMPLATES) {
      expect(Object.keys(OCCASIONS)).toContain(t.occasion);
      expect(t.level).toBeGreaterThanOrEqual(1);
      expect(t.level).toBeLessThan(6);
      expect(STYLES).toContain(t.style);
    }
  });
});
