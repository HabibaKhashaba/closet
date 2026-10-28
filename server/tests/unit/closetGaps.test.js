// US-64: a gap is ≤ 1 piece at a dress-code level the user dresses for (BVA at 1 and 2 pieces).
const { closetGaps, levelsUserDressesFor } = require('../../src/modules/wardrobe/closetGaps');

const piece = (category, ...levels) => ({ category, dressCodes: levels });

describe('Closet gaps', () => {
  test('UT-G01 levels = usual dress code + each occasion default', () => {
    expect(levelsUserDressesFor({ dressCode: 1, occasions: ['Work', 'Wedding', 'University'] })).toEqual([1, 3, 5]);
  });

  test('UT-G02 0 pieces at a level is a gap', () => {
    const r = closetGaps([], { dressCode: 1, occasions: [] });
    expect(r.gaps.map((g) => g.group)).toEqual(['Tops & dresses', 'Bottoms & layers', 'Shoes']);
  });

  test('UT-G03 exactly 1 piece is still a gap (boundary)', () => {
    const r = closetGaps([piece('Top', 3)], { dressCode: 3, occasions: [] });
    expect(r.gaps.find((g) => g.group === 'Tops & dresses')).toMatchObject({ count: 1, levelName: 'Business Casual' });
  });

  test('UT-G04 2 pieces is not a gap (just above boundary)', () => {
    const r = closetGaps([piece('Top', 3), piece('Dress', 3)], { dressCode: 3, occasions: [] });
    expect(r.gaps.find((g) => g.group === 'Tops & dresses')).toBeUndefined();
  });

  test('UT-G05 levels the user never dresses for are not reported', () => {
    const r = closetGaps([], { dressCode: 1, occasions: [] });
    expect(r.gaps.every((g) => g.level === 1)).toBe(true);
  });

  test('UT-G06 a piece counts at every level it suits; message reads like the story example', () => {
    const items = [...Array(8)].map(() => piece('Top', 1)).concat([piece('Top', 1, 5)]);
    const r = closetGaps(items, { dressCode: 1, occasions: ['Wedding'] });
    expect(r.rows[0].counts[1]).toBe(9);
    expect(r.gaps.find((g) => g.group === 'Tops & dresses' && g.level === 5).message).toBe('1 formal tops & dresses');
  });

  test('UT-G07 Extra pieces are not part of any gap group', () => {
    const r = closetGaps([piece('Extra', 1), piece('Extra', 1)], { dressCode: 1, occasions: [] });
    expect(r.rows.every((row) => row.counts[1] === 0)).toBe(true);
  });
});
