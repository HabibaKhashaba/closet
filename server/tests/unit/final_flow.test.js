// Unit tests (final pass): editorial look names, Style-this-piece with a warm layer, the wider
// replace tray, and where the photo try-on preview places each kind of piece.
const engine = require('../../src/modules/recommendation/engine');

let n = 0;
const piece = (category, colour, extra = {}) => ({
  id: `00000000-0000-0000-0000-${String(++n).padStart(12, '0')}`,
  category, colour, fabric: 'Cotton', season: 'All seasons', styles: ['Classic'], dressCodes: [1, 2], modest: true, status: 'Available', wearCount: 1, lastWornAt: new Date(Date.now() - 10 * 86400000), ...extra,
});

describe('Final pass — recommendation details', () => {
  test('RE-30 three looks that share pieces still get three different names', () => {
    const t = piece('Top', 'Navy', { name: 'Breton striped top' }); const b1 = piece('Bottom', 'Beige', { name: 'Beige wide-leg trousers' });
    const b2 = piece('Bottom', 'Black', { name: 'Black midi skirt', styles: ['Chic'] }); const s = piece('Shoes', 'White', { name: 'White sneakers' });
    const names = engine.lookNames([[t, b1, s], [t, b2, s], [t, b1, s]], { occasion: 'University', level: 1 });
    expect(new Set(names).size).toBe(3);
    expect(names[0]).toBe('Campus Stripes');
  });
  test('RE-31 Style this piece: a warm layer at 30 °C is still in every look', () => {
    n = 0;
    const c = [piece('Top', 'White'), piece('Top', 'Navy'), piece('Bottom', 'Black'), piece('Bottom', 'Beige'), piece('Shoes', 'White'),
      piece('Layer', 'Brown', { name: 'Camel cardigan', fabric: 'Knit', season: 'Winter' })];
    const r = engine.recommend(c, { occasion: 'University', weather: { tempC: 30 }, fixedId: c[5].id });
    expect(r.outfits.length).toBeGreaterThan(0);
    for (const o of r.outfits) expect(o.itemIds).toContain(c[5].id);
  });
  test('RE-32 Style this piece refuses a piece that is not Available', () => {
    n = 0;
    const c = [piece('Top', 'White', { status: 'Laundry' }), piece('Bottom', 'Black'), piece('Shoes', 'White')];
    const r = engine.recommend(c, { occasion: 'University', weather: { tempC: 22 }, fixedId: c[0].id });
    expect(r.outfits).toHaveLength(0);
    expect(r.note).toMatch(/not Available/);
  });
  test('RE-34 same closet, new database ids → same looks and same tray order (a reseeded demo repeats itself)', () => {
    const build = (ids) => {
      n = 0;
      const c = [piece('Top', 'White', { name: 'White tee' }), piece('Top', 'Blue', { name: 'Blue shirt' }), piece('Top', 'Green', { name: 'Sage shirt' }),
        piece('Bottom', 'Beige', { name: 'Beige trousers' }), piece('Bottom', 'Black', { name: 'Black skirt' }), piece('Shoes', 'White', { name: 'White sneakers' })];
      c.forEach((p, k) => { p.id = ids[k]; });
      const r = engine.recommend(c, { occasion: 'University', weather: { tempC: 22 } });
      const first = r.outfits[0];
      const t = engine.swap(c, first.itemIds, 0, { occasion: 'University', weather: { tempC: 22 } });
      const name = (id) => c.find((p) => p.id === id).name;
      return { looks: r.outfits.map((o) => o.itemIds.map(name)), tray: t.options.map((o) => name(o.itemId)) };
    };
    const ids = (seed) => Array.from({ length: 6 }, (_, k) => `00000000-0000-0000-0000-${String(((k * seed) % 7) + 1).padStart(12, '0')}`);
    expect(build(ids(3))).toEqual(build(ids(5)));
  });
  test('RE-33 replace tray: with fewer than 3 exact-level pieces, pieces one level away are offered after them', () => {
    n = 0;
    const c = [piece('Top', 'White', { dressCodes: [1] }), piece('Top', 'Navy', { dressCodes: [1] }), piece('Top', 'Blue', { dressCodes: [2] }),
      piece('Bottom', 'Black', { dressCodes: [1, 2] }), piece('Shoes', 'White', { dressCodes: [1, 2] })];
    const r = engine.swap(c, [c[0].id, c[3].id, c[4].id], 0, { occasion: 'University', weather: { tempC: 22 } });
    expect(r.options.map((o) => o.itemId)).toEqual([c[1].id, c[2].id]);
    expect(r.options[1].outfit.ruleScore).toBeLessThan(r.options[0].outfit.ruleScore);
  });
});

describe('Final pass — photo try-on preview placement (client/src/photoTryOn.js)', () => {
  let region;
  beforeAll(async () => { ({ region } = await import('../../../client/src/photoTryOn.js')); });
  test('TO-01 body order: top above bottom above shoes; shoes at the feet', () => {
    const top = region({ category: 'Top' }); const bottom = region({ category: 'Bottom' }); const shoes = region({ category: 'Shoes' });
    expect(top.top).toBeLessThan(bottom.top); expect(bottom.top).toBeLessThan(shoes.top); expect(shoes.top).toBeGreaterThan(0.85);
  });
  test('TO-02 layering: outerwear is drawn over the top, the top over the bottom', () => {
    expect(region({ category: 'Layer' }).z).toBeGreaterThan(region({ category: 'Top' }).z);
    expect(region({ category: 'Top' }).z).toBeGreaterThan(region({ category: 'Bottom' }).z);
  });
  test('TO-03 accessories go where they are worn: sunglasses at the head, a bag at the side', () => {
    expect(region({ category: 'Extra', name: 'Tortoise sunglasses' }).top).toBeLessThan(0.1);
    expect(region({ category: 'Bag', name: 'Structured black bag' }).cx).toBeGreaterThan(0.7);
  });
});
