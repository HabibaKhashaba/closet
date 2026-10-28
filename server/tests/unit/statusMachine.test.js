// State-transition testing of item status (US-56, US-15, US-16).
// All 25 (from, to) pairs are checked against the state diagram: 10 valid, 15 invalid
// (5 of which are "stay in the same state", handled as a no-op by the service).
const { ALLOWED, canMove, INITIAL } = require('../../src/modules/availability/statusMachine');
const { STATUSES } = require('../../src/shared/vocabulary');

const VALID = [
  ['Available', 'Laundry'], ['Available', 'Borrowed'], ['Available', 'Packed'], ['Available', 'Unavailable'],
  ['Laundry', 'Available'],
  ['Borrowed', 'Available'], ['Borrowed', 'Laundry'],
  ['Packed', 'Available'], ['Packed', 'Laundry'],
  ['Unavailable', 'Available'],
];

describe('Item status state machine', () => {
  test('ST-01 a new piece starts as Available', () => expect(INITIAL).toBe('Available'));

  const pairs = STATUSES.flatMap((from) => STATUSES.map((to) => [from, to]));
  test.each(pairs)('ST-02 %s → %s follows the state diagram', (from, to) => {
    const expected = VALID.some(([a, b]) => a === from && b === to);
    expect(canMove(from, to)).toBe(expected);
  });

  test('ST-03 exactly 10 valid transitions', () => {
    expect(Object.values(ALLOWED).flat()).toHaveLength(10);
  });
  test('ST-04 unknown status cannot move', () => expect(canMove('Lost', 'Available')).toBe(false));
});
