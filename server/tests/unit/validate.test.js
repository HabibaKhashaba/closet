// Black-box tests of the request validator: equivalence partitioning (EP) and
// boundary-value analysis (BVA). Test IDs match the test case table in the testing report.
const { validate, isRealDate } = require('../../src/shared/validate');
const { registerSchema } = require('../../src/modules/identity/identityRoutes');
const { eventSchema } = require('../../src/modules/planner/plannerModule');
const { detailsSchema } = require('../../src/modules/wardrobe/wardrobeModule');
const { profileSchema } = require('../../src/modules/profile/profileModule');

const fails = (schema, input) => {
  try { validate(schema, input); return null; } catch (e) { return e; }
};

describe('Password length (BVA, US-01)', () => {
  const pw = (n) => ({ email: 'a@b.co', password: 'x'.repeat(n) });
  test('UT-V01 7 characters is rejected (just below minimum)', () => expect(fails(registerSchema, pw(7))).not.toBeNull());
  test('UT-V02 8 characters is accepted (minimum)', () => expect(fails(registerSchema, pw(8))).toBeNull());
  test('UT-V03 72 characters is accepted (maximum)', () => expect(fails(registerSchema, pw(72))).toBeNull());
  test('UT-V04 73 characters is rejected (just above maximum)', () => expect(fails(registerSchema, pw(73))).not.toBeNull());
  test('UT-V05 empty password is rejected', () => expect(fails(registerSchema, pw(0)).details[0].field).toBe('password'));
});

describe('Email (EP, US-01)', () => {
  test.each([
    ['UT-V06 valid email', 'habiba@aucegypt.edu', true],
    ['UT-V07 missing @', 'habiba.aucegypt.edu', false],
    ['UT-V08 missing domain ending', 'habiba@aucegypt', false],
    ['UT-V09 contains a space', 'hab iba@aucegypt.edu', false],
  ])('%s', (_id, email, ok) => {
    expect(fails(registerSchema, { email, password: 'Closet2026!' }) === null).toBe(ok);
  });
  test('UT-V10 email is lower-cased and trimmed', () => {
    expect(validate(registerSchema, { email: ' Salma@Example.COM ', password: 'Closet2026!' }).email).toBe('salma@example.com');
  });
});

describe('Piece details (EP + BVA, US-09)', () => {
  const ok = { category: 'Top', colour: 'Black', dressCodes: [1] };
  test('UT-V11 valid details pass', () => expect(fails(detailsSchema, ok)).toBeNull());
  test('UT-V12 category outside the list is rejected', () => expect(fails(detailsSchema, { ...ok, category: 'Hat' })).not.toBeNull());
  test('UT-V13 missing colour is rejected', () => expect(fails(detailsSchema, { category: 'Top', dressCodes: [1] }).details[0].field).toBe('colour'));
  test('UT-V14 zero dress-code levels is rejected (below 1)', () => expect(fails(detailsSchema, { ...ok, dressCodes: [] })).not.toBeNull());
  test('UT-V15 all five levels is accepted (maximum)', () => expect(fails(detailsSchema, { ...ok, dressCodes: [1, 2, 3, 4, 5] })).toBeNull());
  test('UT-V16 level 6 is rejected (outside 1–5)', () => expect(fails(detailsSchema, { ...ok, dressCodes: [6] })).not.toBeNull());
  test('UT-V17 size of 10 characters accepted, 11 rejected', () => {
    expect(fails(detailsSchema, { ...ok, size: 'x'.repeat(10) })).toBeNull();
    expect(fails(detailsSchema, { ...ok, size: 'x'.repeat(11) })).not.toBeNull();
  });
});

describe('Profile (EP + BVA, US-02 / US-03 / US-04)', () => {
  test.each([[0, false], [1, true], [5, true], [6, false]])('UT-V18 dress code %i accepted = %s', (level, ok) => {
    expect(fails(profileSchema, { dressCode: level }) === null).toBe(ok);
  });
  test('UT-V19 unknown style is rejected', () => expect(fails(profileSchema, { styles: ['Gothic'] })).not.toBeNull());
  test('UT-V20 city of 1 character rejected, 2 accepted', () => {
    expect(fails(profileSchema, { city: 'C' })).not.toBeNull();
    expect(fails(profileSchema, { city: 'Cairo' })).toBeNull();
  });
  test('UT-V21 modest must be true or false', () => expect(fails(profileSchema, { modest: 'maybe' })).not.toBeNull());
});

describe('Events (EP + BVA, US-46)', () => {
  const ok = { title: 'Wedding', date: '2026-11-12', time: '19:30', occasion: 'Wedding' };
  test('UT-V22 valid event passes', () => expect(fails(eventSchema, ok)).toBeNull());
  test('UT-V23 title of 80 characters accepted, 81 rejected', () => {
    expect(fails(eventSchema, { ...ok, title: 't'.repeat(80) })).toBeNull();
    expect(fails(eventSchema, { ...ok, title: 't'.repeat(81) })).not.toBeNull();
  });
  test.each([['2026-02-28', true], ['2026-02-29', false], ['2028-02-29', true], ['2026-13-01', false], ['12/11/2026', false]])(
    'UT-V24 date %s valid = %s', (d, ok2) => expect(isRealDate(d)).toBe(ok2),
  );
  test.each([['00:00', true], ['23:59', true], ['24:00', false], ['7:30', false]])('UT-V25 time %s valid = %s', (t, ok3) => {
    expect(fails(eventSchema, { ...ok, time: t }) === null).toBe(ok3);
  });
  test('UT-V26 occasion outside the list is rejected', () => expect(fails(eventSchema, { ...ok, occasion: 'Gym' })).not.toBeNull());
});
