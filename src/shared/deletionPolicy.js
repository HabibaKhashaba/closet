// What Closet does with the reason a piece was deleted (US-13, US-33, US-34). Pure functions.
//
//   Torn / damaged      → a replacement goes on the shopping list (same category and colour)
//   Became too small    → a replacement goes on the shopping list (same piece, next size up)
//   No longer my style  → never a replacement; never suggested again (category + colour);
//                         two or more with a shared style → "Closet has learned" offers to avoid that style
//   Other               → recorded only
const NOUN = { Top: 'top', Dress: 'dress', Bottom: 'bottom', Layer: 'layer', Shoes: 'shoes', Bag: 'bag', Extra: 'accessory' };

const EFFECTS = {
  'Torn / damaged': { replacement: true, learn: false, effect: 'A replacement is added to your shopping list.' },
  'Became too small': { replacement: true, learn: false, effect: 'A replacement in the next size is added to your shopping list.' },
  'No longer my style': { replacement: false, learn: true, effect: 'Closet will not suggest it again and learns from it.' },
  Other: { replacement: false, learn: false, effect: 'Closet keeps the reason only.' },
  // Intentional exit (v1.6: donation only). History kept, no replacement.
  // 'Given away' and 'Sold / rehomed' are kept only to read deletions recorded by build v1.5.
  Donated: { replacement: false, learn: false, effect: 'Thank you for passing it on. Closet keeps it in your history and adds no replacement.' },
  'Given away': { replacement: false, learn: false, effect: 'Closet keeps it in your history and adds no replacement.' },
  'Sold / rehomed': { replacement: false, learn: false, effect: 'Closet keeps it in your history and adds no replacement.' },
};
const PASSED_ON = ['Donated', 'Given away', 'Sold / rehomed'];

const effectOf = (reason) => EFFECTS[reason] || EFFECTS.Other;
const pieceTitle = (d) => d.name || `${d.colour} ${NOUN[d.category]}`;

// The shopping-list item a deletion creates, or null when the reason does not ask for one.
function replacementFor(d) {
  if (!effectOf(d.reason).replacement) return null;
  const name = pieceTitle(d);
  const tooSmall = d.reason === 'Became too small';
  return {
    title: `${name.charAt(0).toUpperCase()}${name.slice(1)}${tooSmall ? ' · next size' : ''}`.slice(0, 80),
    category: d.category, colour: d.colour, source: 'replacement',
    replaces: name.toLowerCase(),
    reason: tooSmall ? `Your ${name.toLowerCase()} became too small — same piece, next size up.` : `Your ${name.toLowerCase()} ${/s$/.test(name) ? 'were' : 'was'} torn or damaged.`,
  };
}

// "No longer my style" deletions the user never wants to re-buy.
const avoided = (deletions) => deletions.filter((d) => d.reason === 'No longer my style');
// US-34: a suggestion matches an avoided piece when category and colour are the same.
const isAvoided = (deletions, s) => avoided(deletions).some((d) => d.category === s.category && d.colour === s.colour);
// Styles let go of at least twice ("No longer my style"), most frequent first.
function letGoStyles(deletions, min = 2) {
  const counts = {};
  for (const d of avoided(deletions)) for (const s of new Set(d.styles || [])) counts[s] = (counts[s] || 0) + 1;
  return Object.entries(counts).filter(([, n]) => n >= min).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([style, count]) => ({ style, count }));
}

module.exports = { PASSED_ON, EFFECTS, effectOf, replacementFor, isAvoided, avoided, letGoStyles, pieceTitle };
