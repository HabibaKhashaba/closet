// Fallback intent parser for Ask Closet: maps a message to ONE whitelisted Closet function.
// Used when no language model is configured, or when it is slow or down (NFR-06).
const { OCCASIONS, STYLES, COLOURS, STATUSES } = require('../../shared/vocabulary');

const FUNCTIONS = ['recommend', 'change_piece', 'set_status', 'wash_done', 'forgotten', 'style_piece', 'closet_needs', 'buy_check', 'add_to_shopping', 'similar_owned', 'weather', 'hide_piece', 'plan_event', 'help'];

const OCCASION_WORDS = [
  [/\b(wedding|engagement|katb ?ketab)\b/, 'Wedding'], [/\binterview\b/, 'Interview'], [/\b(work|office|meeting|internship)\b/, 'Work'],
  [/\b(party|birthday|graduation)\b/, 'Party'], [/\bdate\b(?! ?night)|\bdate night\b/, 'Date night'], [/\b(dinner|restaurant|lunch)\b/, 'Dinner'],
  [/\b(uni|university|class|college|campus|lecture|presentation)\b/, 'University'], [/\b(travel|trip|flight|airport)\b/, 'Travel'], [/\b(everyday|errands|casual day|today)\b/, 'Everyday'],
];
const COLOUR_WORDS = { cream: 'Beige', camel: 'Beige', tan: 'Beige', nude: 'Beige', peach: 'Orange', gray: 'Grey', 'dark blue': 'Navy', burgundy: 'Red', olive: 'Green', khaki: 'Green', violet: 'Purple', lilac: 'Purple', gold: 'Yellow', mustard: 'Yellow' };
const CATEGORY_WORDS = [
  [/\b(t-?shirts?|tees?|tops?|shirts?|blouses?|cami|turtleneck|henley|sweaters?|jumpers?)\b/, 'Top'],
  [/\b(jeans|trousers|pants|skirts?|shorts|bottoms?)\b/, 'Bottom'], [/\b(dress(es)?|gowns?)\b/, 'Dress'],
  [/\b(jackets?|coats?|parkas?|blazers?|cardigans?|layers?)\b/, 'Layer'], [/\b(shoes|sneakers|trainers|boots|flats|heels|sandals|loafers)\b/, 'Shoes'],
  [/\b(bags?|handbags?|totes?|clutch|purse)\b/, 'Bag'],
  [/\b(hat|cap|beanie|scarf|earrings?|necklace|sunglasses|belt|accessory|accessories|extra)\b/, 'Extra'],
];
const SLOT_WORDS = [[/\bshoes?|sneakers|boots|flats|heels\b/, 2], [/\b(top|shirt|blouse|dress)\b/, 0], [/\b(bottom|jeans|trousers|pants|skirt|layer|jacket|coat)\b/, 1], [/\b(extra|hat|cap|accessory|bag)\b/, 3]];
const STATUS_WORDS = [[/\b(laundry|wash|washing|dirty)\b/, 'Laundry'], [/\b(lent|lend|borrowed|gave)\b/, 'Borrowed'], [/\b(packed|pack|suitcase)\b/, 'Packed'],
  [/\b(unavailable|repair|tailor|broken|torn)\b/, 'Unavailable'], [/\b(back|available|returned|clean|got back)\b/, 'Available']];
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function parseDate(text, now = new Date()) {
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const iso = (x) => x.toISOString().slice(0, 10);
  if (/\btomorrow\b/.test(text)) { d.setUTCDate(d.getUTCDate() + 1); return iso(d); }
  if (/\b(today|tonight|now)\b/.test(text)) return iso(d);
  const day = DAYS.findIndex((n) => new RegExp(`\\b${n}\\b`).test(text));
  if (day >= 0) { const add = ((day - d.getUTCDay() + 7) % 7) || 7; d.setUTCDate(d.getUTCDate() + add); return iso(d); }
  return null;
}

// Describes a piece the user mentioned: "my blue jeans" → { colour: 'Blue', category: 'Bottom', fabric: 'Denim' }
function pieceQuery(text) {
  const q = {};
  for (const [w, c] of Object.entries(COLOUR_WORDS)) if (new RegExp(`\\b${w}\\b`).test(text)) q.colour = c;
  for (const c of COLOURS) if (new RegExp(`\\b${c.toLowerCase()}\\b`).test(text)) q.colour = c;
  for (const [re, cat] of CATEGORY_WORDS) if (re.test(text)) { q.category = cat; break; }
  if (/\bjeans|denim\b/.test(text)) q.fabric = 'Denim';
  const m = text.match(/\b(silk|linen|wool|knit|cotton|leather)\b/);
  if (m) q.fabric = m[1][0].toUpperCase() + m[1].slice(1);
  return Object.keys(q).length ? q : null;
}

// The user's own word for the piece ("trousers", "loafers"), used to title a shopping-list item.
const pieceWord = (text) => { for (const [re] of CATEGORY_WORDS) { const m = text.match(re); if (m) return m[0]; } return null; };

function parse(message, now = new Date()) {
  const t = ` ${String(message).toLowerCase().replace(/[’']/g, '')} `;
  const occasion = (OCCASION_WORDS.find(([re]) => re.test(t)) || [])[1];
  const style = STYLES.find((s) => new RegExp(`\\b${s.toLowerCase()}\\b`).test(t));
  const date = parseDate(t, now);
  const piece = pieceQuery(t);

  // Shopping list (US-36): "put beige trousers on my shopping list", "add this to my list", "add a replacement for my torn loafers"
  const toList = /\b(add|put|save)\b/.test(t) && /\b(shopping list|shopping bag|my list|the list|to buy list|wishlist)\b/.test(t);
  if (toList || /\breplacement for\b/.test(t)) {
    return { fn: 'add_to_shopping', args: { piece, word: pieceWord(t), replacement: /\breplace(ment)?\b/.test(t), damaged: /\b(torn|damaged|broken|ripped|worn out)\b/.test(t), small: /\btoo small\b/.test(t), useContext: !piece && /\b(this|it|that|them)\b/.test(t) } };
  }
  if (/\b(wash done|washing is done|laundry is done|finished (the )?laundry|did (the )?laundry|everything is clean)\b/.test(t)) return { fn: 'wash_done', args: {} };
  if (/\b(change|swap|replace|different)\b/.test(t) && (SLOT_WORDS.find(([re]) => re.test(t)))) return { fn: 'change_piece', args: { slot: SLOT_WORDS.find(([re]) => re.test(t))[1] } };
  if (/\b(hide|dont show|do not show|skip)\b/.test(t) && piece) return { fn: 'hide_piece', args: { piece } };
  if (/\b(similar|already (have|own)|do i (have|own)|own anything like|own something like)\b/.test(t) && piece) return { fn: 'similar_owned', args: { piece } };
  if (/\b(buy|buying|purchase|get a|getting|need another|need a new|need new|need a|do i need|should i get)\b/.test(t) && piece && piece.colour && piece.category) return { fn: 'buy_check', args: { piece, word: pieceWord(t) } };
  const status = (STATUS_WORDS.find(([re]) => re.test(t)) || [])[1];
  if (status && piece && /\b(put|move|mark|set|lent|lend|gave|packed|pack|got|is|are|in the|back|took)\b/.test(t)) return { fn: 'set_status', args: { piece, status } };
  if (/\b(forgot|forgotten|havent( i)? worn|have not( i)? worn|never wear|not worn|haven t worn|lately)\b/.test(t)) return { fn: 'forgotten', args: {} };
  if (/\b(need|buy|shopping|missing|gaps?|lacking)\b/.test(t)) return { fn: 'closet_needs', args: {} };
  if (/\b(weather|temperature|hot|cold|rain)\b/.test(t) && !/\b(wear|outfit)\b/.test(t)) return { fn: 'weather', args: { date } };
  if (/\b(style|go with|goes with|match|pair)\b/.test(t) && piece) return { fn: 'style_piece', args: { piece, occasion, date } };
  if (/\b(plan|planned)\b/.test(t) || /\bmy next event\b/.test(t)) return { fn: 'plan_event', args: { text: t.trim() } };
  if (/\b(wear|outfit|dress for|what to put on|look|ideas?)\b/.test(t) || occasion) return { fn: 'recommend', args: { occasion: occasion || 'Everyday', style, date } };
  return { fn: 'help', args: {} };
}

// Guesses an occasion from free text (calendar import, chat).
const guessOccasion = (text) => (OCCASION_WORDS.find(([re]) => re.test(` ${String(text).toLowerCase()} `)) || [])[1] || null;

module.exports = { parse, pieceQuery, pieceWord, parseDate, guessOccasion, FUNCTIONS, STATUSES };
