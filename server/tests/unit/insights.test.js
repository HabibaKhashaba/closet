// Unit tests for the proactive Wardrobe Insights layer (v1.5). Pure functions, deterministic dates.
// Techniques: EP (eligible / not eligible classes), BVA (thresholds 89/90 days, 4/5 °C, 29/30 days new),
// ST (rehome lifecycle in the API tests), and decision tables for gap confidence and purchase impact.
const ins = require('../../src/modules/intelligence/insights');
const health = require('../../src/modules/intelligence/health');
const { demoPieces } = require('../../src/db/seedData');

const TODAY = new Date('2026-10-28T12:00:00'); // autumn (calendar), 30 °C in the seeded estimate
const DAY = 86400000;
const ago = (d) => new Date(TODAY.getTime() - d * DAY).toISOString();
let n = 0;
const piece = (o) => ({ id: `p${++n}`, name: `Piece ${n}`, category: 'Top', colour: 'Black', fabric: 'Cotton', season: 'All seasons', styles: ['Classic'], dressCodes: [1, 2], status: 'Available', wearCount: 3, lastWornAt: ago(5), createdAt: ago(400), ...o });

describe('Long-unworn pieces: style it, keep it or donate it (user decides)', () => {
  test('IN-01 BVA: 90 days unworn → candidate; 89 days → not', () => {
    const a = piece({ lastWornAt: ago(90) }); const b = piece({ lastWornAt: ago(89) });
    const ids = ins.forgottenCandidates([a, b], { today: TODAY, tempC: 24 }).map((c) => c.id);
    expect(ids).toEqual([a.id]);
  });
  test('IN-02 recently worn and newly added pieces are never candidates', () => {
    const recent = piece({ lastWornAt: ago(3) });
    const fresh = piece({ wearCount: 0, lastWornAt: null, createdAt: ago(20) });
    expect(ins.forgottenCandidates([recent, fresh], { today: TODAY, tempC: 24 })).toHaveLength(0);
  });
  test.each(['Laundry', 'Borrowed', 'Packed', 'Unavailable'])('IN-03 a %s piece does not trigger (only Available pieces)', (status) => {
    expect(ins.forgottenCandidates([piece({ status, lastWornAt: ago(200) })], { today: TODAY, tempC: 24 })).toHaveLength(0);
  });
  test('IN-04 a heavy winter piece is not judged after summer days (season context)', () => {
    const coat = piece({ category: 'Layer', season: 'Winter', fabric: 'Wool', lastWornAt: ago(200) });
    expect(ins.forgottenCandidates([coat], { today: TODAY, tempC: 30 })).toHaveLength(0);
    expect(ins.forgottenCandidates([coat], { today: new Date('2027-01-15T12:00:00'), tempC: 14 })).toHaveLength(1);
  });
  test('IN-05 special-occasion pieces get 180 days, everyday pieces 90', () => {
    const gown = piece({ category: 'Dress', dressCodes: [4, 5], lastWornAt: ago(120) });
    const tee = piece({ lastWornAt: ago(120) });
    expect(ins.forgottenCandidates([gown, tee], { today: TODAY, tempC: 24 }).map((c) => c.id)).toEqual([tee.id]);
  });
  test('IN-06 Keep it snoozes the suggestion until the chosen date', () => {
    const tee = piece({ lastWornAt: ago(120) });
    const snoozes = new Map([[tee.id, '2027-01-26']]);
    expect(ins.forgottenCandidates([tee], { today: TODAY, tempC: 24, snoozes })).toHaveLength(0);
    expect(ins.forgottenCandidates([tee], { today: new Date('2027-02-01T12:00:00'), tempC: 24, snoozes: new Map([[tee.id, '2027-01-26']]) })).toHaveLength(1);
  });
  test('IN-07 wearing the piece resets the clock; a piece being donated is not suggested again', () => {
    const tee = piece({ lastWornAt: ago(0) });
    const leaving = piece({ lastWornAt: ago(150), rehome: { method: 'donate' } });
    expect(ins.forgottenCandidates([tee, leaving], { today: TODAY, tempC: 24 })).toHaveLength(0);
  });
  test('IN-08 seeded closet: the denim jacket (104 days) is the candidate and the message is warm, not judgmental', () => {
    const c = ins.forgottenCandidates(demoPieces(TODAY), { today: TODAY, tempC: 30 });
    expect(c[0]).toMatchObject({ id: 'denim_jacket', days: 104 });
    expect(c[0].message).toMatch(/style it again, keep it, or donate it to someone who may need it/);
    expect(c[0].message).not.toMatch(/get rid|don.t need|throw/i);
    expect(c.some((x) => x.id === 'cream_knit_sweater')).toBe(false); // winter knit at 30 °C: not judged
  });
});

describe('Seasonal rotation (suggest, never automatic)', () => {
  test('IN-10 a summer-only piece becomes a candidate when it turns cold; a winter coat is not packed in the cold', () => {
    const linen = piece({ season: 'Summer', fabric: 'Linen', lastWornAt: ago(40) });
    const coat = piece({ category: 'Layer', season: 'Winter', lastWornAt: ago(40) });
    const cold = ins.seasonalRotation([linen, coat], { tempC: 12, today: TODAY });
    expect(cold.pack.map((p) => p.id)).toEqual([linen.id]);
  });
  test('IN-11 an already Packed piece is not suggested again; Bring back lists seasonal storage only', () => {
    const stored = piece({ season: 'Summer', status: 'Packed', statusNote: ins.SEASONAL_NOTE });
    const trip = piece({ season: 'Summer', status: 'Packed', statusNote: 'Sahel weekend' });
    const hot = ins.seasonalRotation([stored, trip], { tempC: 31, today: TODAY });
    expect(hot.pack).toHaveLength(0);
    expect(hot.bringBack.map((p) => p.id)).toEqual([stored.id]);
  });
  test('IN-12 a piece worn in the last 3 weeks is not packed away; Not now hides it', () => {
    const knit = piece({ season: 'Winter', lastWornAt: ago(5) });
    const boots = piece({ category: 'Shoes', season: 'Winter', lastWornAt: ago(60) });
    expect(ins.seasonalRotation([knit, boots], { tempC: 30, today: TODAY }).pack.map((p) => p.id)).toEqual([boots.id]);
    expect(ins.seasonalRotation([boots], { tempC: 30, today: TODAY, snoozes: new Map([[boots.id, '2026-11-20']]) }).pack).toHaveLength(0);
  });
});

describe('Laundry intelligence', () => {
  const ev = (o) => ({ id: 'e1', title: 'Monday meeting', date: '2026-11-02', occasion: 'Work', dressCode: 3, ...o });
  const tops = () => [piece({ id: 'w1', wearCount: 20, dressCodes: [3] }), piece({ id: 'w2', wearCount: 15, dressCodes: [3] }), piece({ id: 'w3', wearCount: 12, dressCodes: [3] }), piece({ id: 'w4', wearCount: 2, dressCodes: [3] })];
  test('IN-20 high-use Work tops in the laundry before a Work event → one warning', () => {
    const t = tops(); t[0].status = 'Laundry'; t[1].status = 'Laundry';
    const w = ins.laundryRisk(t, [ev()], { today: TODAY });
    expect(w).toHaveLength(1);
    expect(w[0].message).toMatch(/2 of your 3 most-worn business casual tops are in the laundry/);
  });
  test('IN-21 irrelevant laundry (a casual piece, or no event) does not warn', () => {
    const t = tops(); t[3].status = 'Laundry';
    expect(ins.laundryRisk(t, [ev()], { today: TODAY })).toHaveLength(0);
    const u = tops(); u[0].status = 'Laundry'; u[1].status = 'Laundry';
    expect(ins.laundryRisk(u, [], { today: TODAY })).toHaveLength(0);
  });
  test('IN-22 Wash done removes the warning', () => {
    const t = tops(); t[0].status = 'Laundry'; t[1].status = 'Laundry';
    expect(ins.laundryRisk(t, [ev()], { today: TODAY })).toHaveLength(1);
    t.forEach((p) => { p.status = 'Available'; });
    expect(ins.laundryRisk(t, [ev()], { today: TODAY })).toHaveLength(0);
  });
  test('IN-23 a multi-day plan never reuses a top, bottom or dress before a wash; allowRepeats respects the user', () => {
    const pieces = demoPieces(TODAY);
    const days = ['2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'].map((date) => ({ date, occasion: 'University', weather: { tempC: 28 } }));
    const r = ins.planDays(pieces, days, { prefs: { styles: ['Classic'] } });
    expect(r.days.every((d) => d.outfit)).toBe(true);
    // repeats happen only when the closet runs out, and are named
    const clothes = r.days.flatMap((d) => (d.outfit ? d.outfit.itemIds.filter((id) => !d.repeated.includes(id)) : [])).filter((id) => ['Top', 'Dress', 'Bottom'].includes(pieces.find((p) => p.id === id).category));
    expect(new Set(clothes).size).toBe(clothes.length);
    r.days.filter((d) => d.repeated.length).forEach((d) => expect(d.note).toMatch(/^Repeats your .* wash it first or swap it/));
    expect(r.days.slice(0, 3).every((d) => d.repeated.length === 0)).toBe(true);
    expect(r.days.every((d) => d.outfit && d.outfit.itemIds.every((id) => pieces.find((p) => p.id === id).status === 'Available'))).toBe(true);
    expect(ins.planDays(pieces, days, { allowRepeats: true }).repeatsAllowed).toBe(true);
  });
});

describe('Repeat intelligence and outfit memory', () => {
  const ps = [piece({ id: 'a', category: 'Top' }), piece({ id: 'b', category: 'Bottom' }), piece({ id: 'c', category: 'Shoes' }), piece({ id: 'd', category: 'Extra' }), piece({ id: 'e', category: 'Top' })];
  const wear = (o) => ({ id: 1, date: '2026-10-26', pieces: ps.filter((p) => ['a', 'b', 'c'].includes(p.id)), rating: 3, occasion: 'University', weather: { tempC: 27 }, ...o });
  test('IN-30 an identical look within the week suggests a variation (unless repeats are fine)', () => {
    const r = ins.repeatInsight(['a', 'b', 'c'], [wear()], ps, { today: TODAY });
    expect(r).toMatchObject({ kind: 'variety', actions: ['Keep it', 'Change one piece', 'Show an alternative'] });
    expect(ins.repeatInsight(['a', 'b', 'c'], [wear()], ps, { today: TODAY, allowRepeats: true })).toBeNull();
  });
  test('IN-31 a highly rated look is offered as a positive repeat', () => {
    expect(ins.repeatInsight(['a', 'b', 'c', 'd'], [wear({ rating: 5, eventTitle: 'Salma’s birthday' })], ps, { today: TODAY })).toMatchObject({ kind: 'loved', message: expect.stringMatching(/You loved this look at “Salma’s birthday”/) });
  });
  test('IN-32 a different look (only shoes shared) is not a repeat', () => {
    expect(ins.repeatInsight(['e', 'c'], [wear()], ps, { today: TODAY })).toBeNull();
  });
  test('IN-33 memory finds “Salma’s birthday” by its words, best-rated looks, and last Friday', () => {
    const wears = [wear({ id: 1, date: '2026-10-22', eventTitle: 'Salma’s birthday', rating: 5 }), wear({ id: 2, date: '2026-10-23', rating: 4 }), wear({ id: 3, date: '2026-10-10', rating: 2 })];
    expect(ins.memoryMatches(wears, 'what did i wear to salmas birthday?', { today: TODAY })[0].id).toBe(1);
    expect(ins.memoryMatches(wears, '', { best: true }).map((w) => w.id)).toEqual([1, 2, 3]);
    expect(ins.memoryMatches(wears, 'something like what i wore last friday', { today: TODAY }).map((w) => w.id)).toEqual([2]);
  });
  test('IN-34 memory is one bounded signal: +1 per rated look, never more than +3, same occasion ± 4 °C', () => {
    const wears = [1, 2, 3, 4, 5].map((i) => wear({ id: i, rating: 5 }));
    const m = ins.memorySignals([...wears, wear({ id: 9, rating: 5, occasion: 'Work' }), wear({ id: 10, rating: 5, weather: { tempC: 15 } })], { occasion: 'University', tempC: 28 });
    expect(m.boost.get('a')).toBe(3);
    expect(m.source.id).toBe(1);
  });
});

describe('Planned outfit vs weather (monitor)', () => {
  const blazer = piece({ id: 'blz', category: 'Layer', fabric: 'Wool', season: 'Spring / Autumn' });
  const shirt = piece({ id: 'sh', category: 'Top' });
  test('IN-40 BVA: +6 °C warns about the warm piece; +4 °C does not', () => {
    expect(ins.weatherShift({ tempC: 24 }, { tempC: 30, condition: 'Clear' }, [shirt, blazer])).toMatchObject({ itemId: 'blz', message: expect.stringMatching(/30 °C instead of 24 °C.*navy|blazer|may be too warm/) });
    expect(ins.weatherShift({ tempC: 24 }, { tempC: 28, condition: 'Clear' }, [shirt, blazer])).toBeNull();
  });
  test('IN-41 rain appearing warns even without a big temperature change', () => {
    expect(ins.weatherShift({ tempC: 20, condition: 'Clear' }, { tempC: 21, condition: 'Rain' }, [shirt, blazer]).message).toMatch(/Rain is now expected/);
  });
  test('IN-42 no snapshot → no alert (the monitor never guesses)', () => {
    expect(ins.weatherShift(null, { tempC: 30 }, [shirt])).toBeNull();
  });
});

describe('Cost per wear (confirmed wears only)', () => {
  test('IN-50 price ÷ wears; zero wears never divides; no price works normally', () => {
    expect(ins.costPerWear({ price: 2400, currency: 'EGP', wearCount: 12 })).toMatchObject({ perWear: 200, text: 'EGP 200 per wear (2,400 ÷ 12 wears)' });
    expect(ins.costPerWear({ price: 2400, wearCount: 0 })).toMatchObject({ perWear: null, text: 'Cost per wear will appear after the first wear.' });
    expect(ins.costPerWear({ price: null, wearCount: 9 })).toEqual({ hasPrice: false, text: null });
  });
  test('IN-51 currency is shown as stored; an edit recalculates', () => {
    expect(ins.costPerWear({ price: 90, currency: 'USD', wearCount: 3 }).text).toBe('USD 30 per wear (90 ÷ 3 wears)');
    expect(ins.costPerWear({ price: 120, currency: 'USD', wearCount: 3 }).perWear).toBe(40);
  });
  test('IN-52 best value needs at least 3 wears; few prices give a cautious note', () => {
    const v = ins.valueInsights([piece({ price: 2200, wearCount: 22 }), piece({ price: 450, wearCount: 2 }), piece({ price: null })]);
    expect(v.bestValue).toHaveLength(1);
    expect(v.note).toMatch(/not enough for strong conclusions/);
  });
});

describe('Gap confidence and purchase impact', () => {
  const base = () => [
    ...[1, 2, 3, 4, 5, 6].map((i) => piece({ id: `t${i}`, category: 'Top', colour: ['White', 'Blue', 'Black', 'Navy', 'Grey', 'Beige'][i - 1], dressCodes: [3] })),
    piece({ id: 's1', category: 'Shoes', dressCodes: [3] }),
  ];
  test('IN-60 HIGH: no neutral formal bottoms at the user’s main level, with tops waiting for them', () => {
    const g = ins.gapConfidence({ group: 'Bottoms & layers', level: 3, count: 0 }, base(), { dressCode: 3 });
    expect(g).toMatchObject({ confidence: 'HIGH', priority: 'Essential' });
    expect(g.reasons.join(' ')).toMatch(/6 business casual tops & dresses waiting/);
    expect(g.limits).toBeGreaterThan(0);
  });
  test('IN-61 never HIGH when equivalents exist one level away; one piece at a secondary level is LOW/MEDIUM', () => {
    const near = [...base(), piece({ category: 'Bottom', dressCodes: [2] }), piece({ category: 'Bottom', dressCodes: [4] }), piece({ category: 'Bottom', dressCodes: [2, 4] })];
    expect(ins.gapConfidence({ group: 'Bottoms & layers', level: 3, count: 0 }, near, { dressCode: 3 }).confidence).not.toBe('HIGH');
    expect(ins.gapConfidence({ group: 'Shoes', level: 5, count: 1 }, base(), { dressCode: 2 }).confidence).toBe('LOW');
  });
  test('IN-62 a missing useful piece creates many new combinations; a near-duplicate is “Probably unnecessary”', () => {
    const pieces = demoPieces(TODAY);
    const useful = ins.purchaseImpact(pieces, { category: 'Dress', colour: 'Black', dressCodes: [4, 5] }, { prefs: { styles: ['Classic'] } });
    expect(useful.newCombinations).toBeGreaterThan(5);
    const dupe = ins.purchaseImpact(pieces, { category: 'Top', colour: 'Black', dressCodes: [1, 2] }, { prefs: {}, similar: [{ id: 'x' }, { id: 'y' }, { id: 'z' }] });
    expect(dupe.recommendation).toBe('Probably unnecessary');
  });
  test('IN-63 the simulation never adds the piece and counts every OWNED piece (laundry does not distort it)', () => {
    const pieces = demoPieces(TODAY);
    const before = pieces.length;
    const a = ins.purchaseImpact(pieces, { category: 'Shoes', colour: 'Beige', dressCodes: [2, 3] }, {});
    const clean = pieces.map((p) => ({ ...p, status: 'Available' }));
    const b = ins.purchaseImpact(clean, { category: 'Shoes', colour: 'Beige', dressCodes: [2, 3] }, {});
    expect(pieces).toHaveLength(before);
    expect(a.simulated).toBe(true);
    expect(a.newCombinations).toBe(b.newCombinations);
  });
});

describe('Trip capsule (Packing Mode)', () => {
  const days = (tempC, n = 5) => Array.from({ length: n }, (_, i) => ({ date: `2026-11-0${i + 2}`, occasion: ['Travel', 'Everyday', 'Dinner', 'University', 'Everyday'][i % 5], weather: { tempC } }));
  test('IN-70 carry-on: at most 8 clothing pieces and 2 pairs of shoes; pieces are reused', () => {
    const r = ins.tripCapsule(demoPieces(TODAY), days(24), { carryOn: true });
    expect(r.counts.clothing).toBeLessThanOrEqual(8);
    expect(r.counts.shoes).toBeLessThanOrEqual(2);
    expect(r.reuse.length).toBeGreaterThan(0);
    expect(r.counts.combinations).toBeGreaterThanOrEqual(r.counts.outfits);
  });
  test('IN-71 unavailable pieces are never packed; no physical piece appears twice', () => {
    const r = ins.tripCapsule(demoPieces(TODAY), days(24), {});
    expect(r.items.every((p) => p.status === 'Available')).toBe(true);
    expect(new Set(r.itemIds).size).toBe(r.itemIds.length);
  });
  test('IN-72 the weather changes the choices (cold trip → a warm layer)', () => {
    const cold = ins.tripCapsule(demoPieces(TODAY), days(12, 3), {});
    const hot = ins.tripCapsule(demoPieces(TODAY), days(31, 3), {});
    expect(cold.items.some((p) => p.category === 'Layer')).toBe(true);
    expect(hot.items.some((p) => ['Wool', 'Knit'].includes(p.fabric))).toBe(false);
  });
  test('IN-73 a top is worn at most twice without laundry, three times with it; Remove excludes a piece', () => {
    const r = ins.tripCapsule(demoPieces(TODAY), days(24, 6), {});
    expect(r.maxWears).toBe(2);
    expect(ins.tripCapsule(demoPieces(TODAY), days(24, 6), { laundryAvailable: true }).maxWears).toBe(3);
    const drop = r.itemIds.find((id) => demoPieces(TODAY).find((p) => p.id === id).category === 'Top');
    expect(ins.tripCapsule(demoPieces(TODAY), days(24, 6), { exclude: [drop] }).itemIds).not.toContain(drop);
  });
});

describe('Wardrobe Health is explainable', () => {
  test('IN-80 the same wardrobe gives the same score, and the explanation names what lowers it', () => {
    const pieces = demoPieces(TODAY);
    const h1 = health.wardrobeHealth({ pieces, worn30: new Set(['white_sneakers']), today: TODAY });
    const h2 = health.wardrobeHealth({ pieces, worn30: new Set(['white_sneakers']), today: TODAY });
    expect(h1.score).toBe(h2.score);
    const e = ins.explainHealth(h1);
    expect(e.lowering[0]).toMatch(/Utilisation/);
    expect(e.summary).toMatch(new RegExp(`^${h1.score}/100`));
  });
});
