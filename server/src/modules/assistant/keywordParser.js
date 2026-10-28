// Fallback intent parser for Ask Closet: maps a message to ONE whitelisted Closet function.
// Used when no language model is configured, or when it is slow or down (NFR-06).
const { OCCASIONS, STYLES, COLOURS, STATUSES } = require('../../shared/vocabulary');

const FUNCTIONS = ['recommend', 'change_piece', 'set_status', 'wash_done', 'forgotten', 'style_piece', 'closet_needs', 'buy_check', 'add_to_shopping', 'similar_owned', 'weather', 'hide_piece', 'plan_event',
  // Milestone 2 final: wardrobe questions that read state, and the proactive-intelligence intents.
  'availability', 'laundry_list', 'laundry_risk', 'week_plan', 'borrowed', 'donate_candidates', 'keep_piece', 'rehome_piece', 'rehome_done',
  'seasonal', 'memory', 'repeat_check', 'health', 'plan_check', 'event_rescue', 'trip_pack', 'value', 'help'];

const OCCASION_WORDS = [
  [/\b(wedding|engagement|katb ?ketab)\b/, 'Wedding'], [/\binterview\b/, 'Interview'], [/\b(work|office|meeting|internship)\b/, 'Work'],
  [/\b(party|birthday|graduation)\b/, 'Party'], [/\bdate\b(?! ?night)|\bdate night\b/, 'Date night'], [/\b(dinner|restaurant|lunch)\b/, 'Dinner'],
  [/\b(uni|university|class|college|campus|lecture|presentation)\b/, 'University'], [/\b(travel|trip|flight|airport)\b/, 'Travel'], [/\b(everyday|errands|casual day|today)\b/, 'Everyday'],
];
const COLOUR_WORDS = { rose: 'Pink', blush: 'Pink', ivory: 'White', sage: 'Green', cream: 'Beige', camel: 'Beige', tan: 'Beige', nude: 'Beige', peach: 'Orange', gray: 'Grey', 'dark blue': 'Navy', burgundy: 'Red', olive: 'Green', khaki: 'Green', violet: 'Purple', lilac: 'Purple', gold: 'Yellow', mustard: 'Yellow' };
const CATEGORY_WORDS = [
  [/\b(t-?shirts?|tees?|tops?|shirts?|blouses?|cami|turtleneck|henley|sweaters?|jumpers?)\b/, 'Top'],
  [/\b(jeans|trousers|pants|skirts?|shorts|bottoms?)\b/, 'Bottom'], [/\b(dress(es)?|gowns?)\b/, 'Dress'],
  [/\b(jackets?|coats?|parkas?|blazers?|cardigans?|layers?)\b/, 'Layer'], [/\b(shoes|sneakers|trainers|boots|flats|heels|sandals|loafers)\b/, 'Shoes'],
  [/\b(bags?|handbags?|totes?|clutch|purse)\b/, 'Bag'],
  [/\b(hat|cap|beanie|scarf|earrings?|necklace|sunglasses|belt|accessory|accessories|extra)\b/, 'Extra'],
];
// Specific garment words that also appear in piece names ("my blazer" → the Navy blazer, not every layer).
const NAME_WORDS = ['blazer', 'trench', 'cardigan', 'loafers', 'sneakers', 'boots', 'sandals', 'heels', 'scarf', 'tote', 'blouse', 'sweater', 'cami', 'skirt', 'trousers', 'earrings', 'sunglasses', 'coat', 'tee', 'oxford', 'hoodie'];
const nameWord = (text) => NAME_WORDS.find((w) => new RegExp(`\\b${w}\\b`).test(text)) || null;
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
  const n = nameWord(text);
  if (n) q.name = n;
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

  const it = /\b(it|this|that|this one|this piece)\b/.test(t);
  const days = (t.match(/\b(\d{1,2}|two|three|four|five|six|seven)\s+days?\b/) || [])[1];
  const NUM = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7 };
  const nDays = days ? (NUM[days] || Number(days)) : null;

  // Donation / rehoming (user always decides): candidates, keep, mark for donation, donated.
  if (/\b(donate|donation|give away|giving away|give it away|pass on|rehome|charity)\b/.test(t) && /\b(what|which|could|should|anything|show)\b/.test(t) && !/\bi (donated|gave)\b/.test(t)) return { fn: 'donate_candidates', args: {} };
  if (/\b(i (donated|gave away|gave)|been donated|is donated|was donated|i sold)\b/.test(t) && (piece || it)) return { fn: 'rehome_done', args: { piece, useContext: !piece, how: /\bsold\b/.test(t) ? 'sell' : /\bgave\b/.test(t) ? 'give' : 'donate' } };
  if (/\b(mark|set|put)\b.*\b(for donation|to donate|as donation|for donating|to give away|ready to donate)\b/.test(t)) return { fn: 'rehome_piece', args: { piece, useContext: !piece, how: /give away/.test(t) ? 'give' : 'donate' } };
  if (/\b(keep|keeping)\b/.test(t) && (piece || it) && !/\b(keep me|keeps)\b/.test(t)) return { fn: 'keep_piece', args: { piece, useContext: !piece } };

  // Borrowed: who has it / what have I lent out (questions; "I lent my … to Salma" is a status change below).
  if (/\bwho has\b/.test(t) || (/\b(lent out|have i lent|borrowed from me|lent to|lend out)\b/.test(t) && /\b(what|which|who)\b/.test(t))) return { fn: 'borrowed', args: { piece } };

  // Availability questions read state and never change it ("Is my blazer clean?", "Are my black loafers available?").
  if (piece && /^\s*(is|are|where( is| are|s)?|can i wear|do i have .* available)\b/.test(t) && /\b(clean|available|free|ready|washed|wearable|where|dirty|in the laundry|at home|back)\b/.test(t)) return { fn: 'availability', args: { piece } };

  // Laundry intelligence
  if (/\b(which|what)\b.*\b(need to wash|to wash|in the laundry|in my laundry|is dirty|are dirty|laundry basket)\b/.test(t)) return { fn: 'laundry_list', args: {} };
  if (/\b(do (the )?laundry|laundry|wash)\b/.test(t) && /\b(before|by|should i|do i need to|need to do)\b/.test(t) && !piece) return { fn: 'laundry_risk', args: { date } };

  // Planning several days / a trip / an urgent event
  if (/\b(pack|packing|bring|carry-?on|suitcase|luggage)\b/.test(t) && (/\b(trip|days? in|in [a-z]+|to [a-z]+ next|business trip|carry-?on|for \d+ days|weekend in|travel)\b/.test(t)) && !/\b(pack away|packed away)\b/.test(t)) {
    const dest = (t.match(/\b(?:in|to)\s+([a-z][a-z ]{2,20}?)(?=\s+(?:next|for|this|on|in|with|from)\b|[?.!,]|\s*$)/) || [])[1];
    return { fn: 'trip_pack', args: { destination: dest ? dest.trim().replace(/\b\w/g, (c) => c.toUpperCase()) : null, days: nDays, carryOn: /carry-?on|cabin|hand luggage/.test(t), business: /business/.test(t), date } };
  }
  if (/\b(plan|schedule)\b.*\b(outfits|week|next \d+|next (two|three|four|five|six|seven))\b/.test(t)) return { fn: 'week_plan', args: { days: nDays || 5 } };
  if (/\b(need something for|nothing to wear|in (an hour|\d+ hours?|two hours)|urgent|last minute|emergency|right now|asap)\b/.test(t) || (/\bi have (a|an)\b/.test(t) && occasion && /\b(today|tonight|tomorrow|in)\b/.test(t))) return { fn: 'event_rescue', args: { occasion: occasion || 'Everyday', date: date || null, soon: /\b(hours?|tonight|today|now)\b/.test(t) } };

  // Seasonal rotation
  if (/\b(pack away|put away|store away|out of season|bring back|back into rotation|season(al)? (rotation|change)|off-season)\b/.test(t)) return { fn: 'seasonal', args: { direction: /\bbring back|back into\b/.test(t) ? 'bring_back' : 'pack', season: (t.match(/\b(summer|winter|spring|autumn|fall)\b/) || [])[1] || null } };

  // Outfit memory and repeats
  if (/\b(what did i wear|what i wore|wore (to|at|for|last)|similar to what i wore|like most|liked most|loved most|best rated|favourite outfits|highest rated)\b/.test(t)) return { fn: 'memory', args: { text: t.trim(), similar: /\b(similar|like what|something like)\b/.test(t), best: /\b(most|best|highest)\b/.test(t) } };
  if (/\b(repeat|wear (it|that|the same|this) again|same outfit|wore yesterday|yesterday s outfit|yesterdays outfit)\b/.test(t)) return { fn: 'repeat_check', args: { yesterday: /yesterday/.test(t) } };

  // Wardrobe Health, value / cost per wear
  if (/\b(wardrobe|closet) health\b|\bhealth score\b/.test(t)) return { fn: 'health', args: {} };
  if (/\b(cost per wear|per wear|best value|best-value|worth it|worth the money|least used expensive|least-used expensive|expensive purchase|value for money)\b/.test(t)) return { fn: 'value', args: { piece, worth: /\bworth it\b|worth the money/.test(t) } };

  // Planned outfit vs current weather / availability
  if (/\b(tomorrow s|tomorrows|planned|my) outfit\b.*\b(still|okay|ok|fine|weather|work)\b/.test(t) || /\bstill (ok|okay|fine)\b.*\bweather\b/.test(t)) return { fn: 'plan_check', args: {} };

  // Shopping list (US-36): "put beige trousers on my shopping list", "add this to my list", "add a replacement for my torn loafers"
  const toList = /\b(add|put|save)\b/.test(t) && /\b(shopping list|shopping bag|my list|the list|to buy list|wishlist)\b/.test(t);
  if (toList || /\breplacement for\b/.test(t)) {
    return { fn: 'add_to_shopping', args: { piece, word: pieceWord(t), replacement: /\breplace(ment)?\b/.test(t), damaged: /\b(torn|damaged|broken|ripped|worn out)\b/.test(t), small: /\btoo small\b/.test(t), useContext: !piece && /\b(this|it|that|them)\b/.test(t) } };
  }
  if (/\b(wash done|washing is done|laundry is done|finished (the )?laundry|did (the )?laundry|everything is clean)\b/.test(t)) return { fn: 'wash_done', args: {} };
  if (/\b(change|swap|replace|different)\b/.test(t) && (SLOT_WORDS.find(([re]) => re.test(t)))) return { fn: 'change_piece', args: { slot: SLOT_WORDS.find(([re]) => re.test(t))[1] } };
  if (/\b(hide|dont show|do not show|skip)\b/.test(t) && piece) return { fn: 'hide_piece', args: { piece } };
  if (/\b(similar|already (have|own)|do i (have|own)|own anything like|own something like)\b/.test(t) && piece) return { fn: 'similar_owned', args: { piece } };
  const impact = /\b(what would .* add|would (this|these|a|an) .* (be useful|add)|how many outfits could i make|add to my wardrobe|is (this|it) (purchase )?worth)\b/.test(t);
  if ((/\b(buy|buying|purchase|get a|getting|need another|need a new|need new|need a|do i need|do i actually need|should i get)\b/.test(t) || impact) && piece && piece.category) return { fn: 'buy_check', args: { piece, word: pieceWord(t), impact } };
  const status = (STATUS_WORDS.find(([re]) => re.test(t)) || [])[1];
  if (status && piece && /\b(put|move|mark|set|lent|lend|gave|packed|pack|got|is|are|in the|back|took)\b/.test(t)) return { fn: 'set_status', args: { piece, status } };
  if (/\b(forgot|forgotten|havent( i)? worn|have not( i)? worn|never wear|not worn|haven t worn|lately)\b/.test(t)) return { fn: 'forgotten', args: {} };
  if (/\b(need|buy|shopping|missing|gaps?|lacking)\b/.test(t)) return { fn: 'closet_needs', args: {} };
  if (/\b(weather|temperature|hot|cold|rain)\b/.test(t) && !/\b(wear|outfit)\b/.test(t)) return { fn: 'weather', args: { date } };
  if (/\b(style|go with|goes with|match|pair)\b/.test(t) && piece) return { fn: 'style_piece', args: { piece, occasion, date } };
  if (/\b(plan|planned)\b/.test(t) || /\bmy next event\b/.test(t)) return { fn: 'plan_event', args: { text: t.trim() } };
  if (/\b(wear|outfit|dress for|what to put on|look|ideas?)\b/.test(t) || occasion) return { fn: 'recommend', args: { occasion: occasion || 'Everyday', style, date } };
  const asking = /\b(help|what can you do|how do you work|what do you do|commands|examples)\b/.test(t);
  return { fn: 'help', args: asking ? {} : { outOfScope: true } };
}

// Guesses an occasion from free text (calendar import, chat).
const guessOccasion = (text) => (OCCASION_WORDS.find(([re]) => re.test(` ${String(text).toLowerCase()} `)) || [])[1] || null;

module.exports = { parse, pieceQuery, pieceWord, nameWord, parseDate, guessOccasion, FUNCTIONS, STATUSES };
