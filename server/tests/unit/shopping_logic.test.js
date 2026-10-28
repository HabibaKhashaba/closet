// Unit tests (version 1.4): deletion reasons → learning and shopping (US-13, US-33, US-34), Ask Closet → shopping list (US-36).
const { EFFECTS, effectOf, replacementFor, isAvoided, letGoStyles } = require('../../src/shared/deletionPolicy');
const { DELETE_REASONS } = require('../../src/shared/vocabulary');
const { detectPatterns, previousOf } = require('../../src/modules/intelligence/learning');
const { makeRanker } = require('../../src/modules/recommendation/engine');
const { parse } = require('../../src/modules/assistant/keywordParser');

const del = (o) => ({ name: null, category: 'Top', colour: 'Grey', wearCount: 3, styles: [], dressCodes: [1], ...o });

describe('Deletion reasons (US-13)', () => {
  test('DR-01 exactly four reasons, each with a defined effect; only Torn / damaged and Became too small ask for a replacement', () => {
    expect(DELETE_REASONS).toEqual(['Torn / damaged', 'No longer my style', 'Became too small', 'Other']);
    for (const r of DELETE_REASONS) expect(EFFECTS[r]).toBeDefined();
    expect(DELETE_REASONS.filter((r) => effectOf(r).replacement)).toEqual(['Torn / damaged', 'Became too small']);
    expect(DELETE_REASONS.filter((r) => effectOf(r).learn)).toEqual(['No longer my style']);
  });
  test('DR-02 replacementFor: torn → same piece; too small → next size; no longer my style and other → nothing', () => {
    expect(replacementFor(del({ name: 'Black ballet flats', category: 'Shoes', colour: 'Black', reason: 'Torn / damaged' })))
      .toMatchObject({ title: 'Black ballet flats', category: 'Shoes', colour: 'Black', source: 'replacement', replaces: 'black ballet flats', reason: 'Your black ballet flats were torn or damaged.' });
    expect(replacementFor(del({ name: 'Black straight jeans', category: 'Bottom', colour: 'Black', reason: 'Became too small' })).title).toBe('Black straight jeans · next size');
    expect(replacementFor(del({ reason: 'No longer my style' }))).toBeNull();
    expect(replacementFor(del({ reason: 'Other' }))).toBeNull();
  });
  test('DR-03 US-34: a suggestion is avoided only when category AND colour match a “No longer my style” deletion', () => {
    const ds = [del({ category: 'Bottom', colour: 'Green', reason: 'No longer my style' }), del({ category: 'Shoes', colour: 'Black', reason: 'Torn / damaged' })];
    expect(isAvoided(ds, { category: 'Bottom', colour: 'Green' })).toBe(true);
    expect(isAvoided(ds, { category: 'Bottom', colour: 'Black' })).toBe(false); // different colour
    expect(isAvoided(ds, { category: 'Top', colour: 'Green' })).toBe(false); // different category
    expect(isAvoided(ds, { category: 'Shoes', colour: 'Black' })).toBe(false); // torn is not a dislike
  });
  test('DR-04 a style is "let go" only after two or more “No longer my style” deletions share it (boundary 1 / 2)', () => {
    const one = [del({ styles: ['Streetwear'], reason: 'No longer my style' })];
    expect(letGoStyles(one)).toEqual([]);
    const two = [...one, del({ category: 'Bottom', colour: 'Green', styles: ['Streetwear', 'Comfortable'], reason: 'No longer my style' }), del({ styles: ['Streetwear'], reason: 'Torn / damaged' })];
    expect(letGoStyles(two)).toEqual([{ style: 'Streetwear', count: 2 }]);
  });
});

describe('Learning from deletions (US-34 → UC-22)', () => {
  const prefs = { dressCode: 2, styles: ['Classic', 'Streetwear'], colours: [], avoidStyles: [] };
  const deletions = [del({ styles: ['Streetwear'], reason: 'No longer my style' }), del({ category: 'Bottom', colour: 'Green', styles: ['Streetwear'], reason: 'No longer my style' })];
  test('DR-05 two let-go streetwear pieces → a pattern with evidence; confirming avoids the style and removes it from the profile; Undo keeps the old values', () => {
    const p = detectPatterns({ prefs, deletions }).find((x) => x.key === 'let-go-streetwear');
    expect(p).toMatchObject({ source: 'Deleted pieces', count: 2, confidence: 50, change: { avoidStyles: ['Streetwear'], styles: ['Classic'] } });
    expect(previousOf(prefs, p.change)).toEqual({ avoidStyles: [], styles: ['Classic', 'Streetwear'] });
    expect(detectPatterns({ prefs: { ...prefs, avoidStyles: ['Streetwear'] }, deletions }).some((x) => x.key === 'let-go-streetwear')).toBe(false);
  });
  test('DR-06 the ranker lowers pieces in an avoided style (rank only — the rule score is not involved)', () => {
    const piece = (styles) => ({ id: 'x', colour: 'Grey', styles, dressCodes: [1], wearCount: 0, lastWornAt: null });
    const rank = makeRanker({ prefs: { avoidStyles: ['Streetwear'], styles: [], colours: [] } });
    expect(rank(piece(['Streetwear']))).toBe(rank(piece(['Classic'])) - 3);
  });
});

describe('Ask Closet → shopping list (US-36)', () => {
  test('SL-01 “Put beige trousers on my shopping list” → add_to_shopping with the piece and the user’s word', () => {
    expect(parse('Put beige trousers on my shopping list')).toEqual({ fn: 'add_to_shopping', args: { piece: { colour: 'Beige', category: 'Bottom' }, word: 'trousers', replacement: false, damaged: false, small: false, useContext: false } });
  });
  test('SL-02 “add this to my shopping list” uses the last item; “Add a replacement for my torn loafers” is a replacement', () => {
    expect(parse('add this to my shopping list').args).toMatchObject({ piece: null, useContext: true });
    expect(parse('Add a replacement for my torn loafers')).toMatchObject({ fn: 'add_to_shopping', args: { piece: { category: 'Shoes' }, word: 'loafers', replacement: true, damaged: true } });
    expect(parse('I want to buy beige trousers. Do I need them?').fn).toBe('buy_check'); // asking is not adding
  });
});
