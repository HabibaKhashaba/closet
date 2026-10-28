// Item status as a state machine (US-56). Every piece has exactly one status.
// Rules: a piece always goes back through Available, except that a borrowed or packed
// piece may come back dirty and go straight to Laundry. A piece in the laundry cannot
// be lent or packed until it is clean.
const ALLOWED = {
  Available: ['Laundry', 'Borrowed', 'Packed', 'Unavailable'],
  Laundry: ['Available'],
  Borrowed: ['Available', 'Laundry'],
  Packed: ['Available', 'Laundry'],
  Unavailable: ['Available'],
};

const INITIAL = 'Available';

function canMove(from, to) {
  return Boolean(ALLOWED[from]) && ALLOWED[from].includes(to);
}

module.exports = { ALLOWED, INITIAL, canMove };
