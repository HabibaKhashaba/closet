// State-transition testing of the garment lifecycle (US-56, US-15, US-16; v1.6 Care, Borrow & lend, Donation).
// All 81 (from, to) pairs of the 9 states are checked against the state diagram: 21 valid, 60 invalid
// (9 of which are "stay in the same state", handled as a no-op by the service).
const { ALLOWED, canMove, INITIAL } = require('../../src/modules/availability/statusMachine');
const { STATUSES } = require('../../src/shared/vocabulary');

const VALID = [
  ['Available', 'Laundry'], ['Available', 'Borrowed'], ['Available', 'Packed'], ['Available', 'Unavailable'],
  ['Available', 'Needs repair'], ['Available', 'Needs alteration'], ['Available', 'Ready to donate'],
  ['Laundry', 'Available'],
  ['Borrowed', 'Available'], ['Borrowed', 'Laundry'],
  ['Packed', 'Available'], ['Packed', 'Laundry'],
  ['Needs repair', 'Available'], ['Needs repair', 'At tailor'], ['Needs repair', 'Ready to donate'],
  ['Needs alteration', 'Available'], ['Needs alteration', 'At tailor'], ['Needs alteration', 'Ready to donate'],
  ['At tailor', 'Available'],
  ['Ready to donate', 'Available'],
  ['Unavailable', 'Available'],
];

describe('Item status state machine', () => {
  test('ST-01 a new piece starts as Available', () => expect(INITIAL).toBe('Available'));

  const pairs = STATUSES.flatMap((from) => STATUSES.map((to) => [from, to]));
  test.each(pairs)('ST-02 %s → %s follows the state diagram', (from, to) => {
    const expected = VALID.some(([a, b]) => a === from && b === to);
    expect(canMove(from, to)).toBe(expected);
  });

  test('ST-03 exactly 21 valid transitions, 9 states', () => {
    expect(Object.values(ALLOWED).flat()).toHaveLength(21);
    expect(STATUSES).toHaveLength(9);
  });
  test('ST-05 a piece in the laundry cannot be lent, packed, sent for repair or donated until it is clean', () => {
    for (const to of ['Borrowed', 'Packed', 'Needs repair', 'Needs alteration', 'At tailor', 'Ready to donate']) expect(canMove('Laundry', to)).toBe(false);
  });
  test('ST-06 the tailor is reached only from Needs repair / Needs alteration, and left only by collecting (→ Available)', () => {
    expect(STATUSES.filter((s) => canMove(s, 'At tailor')).sort()).toEqual(['Needs alteration', 'Needs repair']);
    expect(ALLOWED['At tailor']).toEqual(['Available']);
  });
  test('ST-04 unknown status cannot move', () => expect(canMove('Lost', 'Available')).toBe(false));
});
