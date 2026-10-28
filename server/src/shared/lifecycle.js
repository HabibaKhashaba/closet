// The ONE garment lifecycle (v1.6). Every module asks these helpers instead of comparing status strings,
// so "can I wear it", "is it still mine", "why is it unavailable" mean the same everywhere
// (Style Me, Planner conflicts, packing, Ask Closet, Care, Borrow & Lend, Donation, Analytics, Home).
//
//   Available ↔ Laundry · Borrowed · Packed · Needs repair · Needs alteration · At tailor
//   Available → Ready to donate → Donated (archived: leaves the active closet, wear history kept)
//
// A piece always has exactly one status. Rules:
//   - a piece in the laundry cannot be lent, packed or sent to the tailor until it is clean;
//   - a borrowed or packed piece may come back dirty and go straight to Laundry;
//   - a repair / alteration either goes to the tailor, is fixed at home (→ Available) or the user gives up and donates it;
//   - a piece at the tailor comes back only by being collected (→ Available);
//   - Ready to donate can be cancelled (→ Available); Donated is final (the piece is archived with reason Donated).
const LIFECYCLE = ['Available', 'Laundry', 'Borrowed', 'Packed', 'Needs repair', 'Needs alteration', 'At tailor', 'Ready to donate', 'Unavailable'];

const ALLOWED = {
  Available: ['Laundry', 'Borrowed', 'Packed', 'Needs repair', 'Needs alteration', 'Ready to donate', 'Unavailable'],
  Laundry: ['Available'],
  Borrowed: ['Available', 'Laundry'],
  Packed: ['Available', 'Laundry'],
  'Needs repair': ['Available', 'At tailor', 'Ready to donate'],
  'Needs alteration': ['Available', 'At tailor', 'Ready to donate'],
  'At tailor': ['Available'],
  'Ready to donate': ['Available'],
  Unavailable: ['Available'],
};

// What each state means for the rest of Closet.
const GROUP = {
  Available: 'wearable', Laundry: 'care', 'Needs repair': 'care', 'Needs alteration': 'care', 'At tailor': 'care',
  Borrowed: 'away', Packed: 'away', Unavailable: 'away', 'Ready to donate': 'leaving',
};
// Short badge text and the phrase used in sentences ("your black blazer is at the tailor").
const LABEL = {
  Available: 'Available', Laundry: 'In laundry', Borrowed: 'Borrowed', Packed: 'Packed', 'Needs repair': 'Needs repair',
  'Needs alteration': 'Needs alteration', 'At tailor': 'At tailor', 'Ready to donate': 'Ready to donate', Unavailable: 'Unavailable',
};
const WHERE = {
  Available: 'clean and at home', Laundry: 'in the laundry', Borrowed: 'lent out', Packed: 'packed',
  'Needs repair': 'waiting for a repair', 'Needs alteration': 'waiting for an alteration', 'At tailor': 'at the tailor',
  'Ready to donate': 'ready to donate', Unavailable: 'unavailable',
};
const CARE_KIND = { 'Needs repair': 'repair', 'Needs alteration': 'alteration' };
const NEEDS = { repair: 'Needs repair', alteration: 'Needs alteration' };

const canMove = (from, to) => Boolean(ALLOWED[from]) && ALLOWED[from].includes(to);
const statusOf = (p) => (p && p.status) || 'Available';
// Can be put into an outfit today (Style Me, Mix & Match suggestions, trips, plans).
const isWearable = (p) => statusOf(p) === 'Available';
// The user decided it is leaving: not counted as "owned" for duplicates, gaps, purchase impact or health.
const isLeaving = (p) => statusOf(p) === 'Ready to donate';
// Still part of the wardrobe (whatever its state): counts for duplicates and "what would this add".
const isOwned = (p) => !isLeaving(p);
const inCare = (p) => GROUP[statusOf(p)] === 'care';
const needsCare = (p) => ['Needs repair', 'Needs alteration'].includes(statusOf(p));
// Comes back by itself on a date (planner: not a conflict if it is back in time)?
const returnsOnDate = (p) => ['Laundry', 'Borrowed', 'Packed', 'At tailor', 'Unavailable'].includes(statusOf(p));

module.exports = { LIFECYCLE, ALLOWED, GROUP, LABEL, WHERE, CARE_KIND, NEEDS, canMove, statusOf, isWearable, isLeaving, isOwned, inCare, needsCare, returnsOnDate };
