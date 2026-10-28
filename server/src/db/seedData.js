// Deterministic demo seed data (single source of truth). Used by `npm run seed` (through the real API)
// and by the offline demo (tools/offline_demo), so both start from exactly the same closet.
// [photo, name, details, timesWorn, lastWornDaysAgo]
const PIECES = [
  ['white_fitted_tee', 'White fitted tee', { category: 'Top', colour: 'White', fabric: 'Cotton', season: 'All seasons', size: 'S', styles: ['Minimal', 'Casual'], dressCodes: [1, 2], modest: false }, 16, 2],
  ['red_cropped_tee', 'Red cropped tee', { category: 'Top', colour: 'Red', fabric: 'Cotton', season: 'Summer', size: 'S', styles: ['Streetwear', 'Bold'], dressCodes: [1], modest: false }, 3, 20],
  ['black_ribbed_top', 'Black ribbed top', { category: 'Top', colour: 'Black', fabric: 'Knit', season: 'All seasons', size: 'S', styles: ['Minimal', 'Chic'], dressCodes: [1, 2, 3], modest: false }, 11, 6],
  ['blue_oxford_shirt', 'Blue Oxford shirt', { category: 'Top', colour: 'Blue', fabric: 'Cotton', season: 'All seasons', size: 'M', styles: ['Classic', 'Minimal'], dressCodes: [1, 2, 3], modest: true }, 9, 4],
  ['cream_knit_sweater', 'Cream knit sweater', { category: 'Top', colour: 'Beige', fabric: 'Knit', season: 'Winter', size: 'M', styles: ['Classic', 'Comfortable'], dressCodes: [1, 2, 3], modest: true }, 5, 190],
  ['ivory_silk_blouse', 'Ivory silk blouse', { category: 'Top', colour: 'White', fabric: 'Silk', season: 'All seasons', size: 'S', styles: ['Elegant', 'Chic'], dressCodes: [2, 3, 4], modest: true }, 6, 9],
  ['breton_striped_top', 'Breton striped top', { category: 'Top', colour: 'Navy', fabric: 'Cotton', season: 'Spring / Autumn', size: 'S', styles: ['Classic', 'Casual'], dressCodes: [1, 2], modest: true }, 7, 12],
  ['blush_satin_cami', 'Blush satin cami', { category: 'Top', colour: 'Pink', fabric: 'Silk', season: 'Summer', size: 'S', styles: ['Chic', 'Elegant'], dressCodes: [2, 4], modest: false }, 3, 47],
  ['sage_linen_shirt', 'Sage linen shirt', { category: 'Top', colour: 'Green', fabric: 'Linen', season: 'Summer', size: 'M', styles: ['Casual', 'Minimal'], dressCodes: [1, 2], modest: true }, 2, 18],
  ['black_tailored_trousers', 'Black tailored trousers', { category: 'Bottom', colour: 'Black', fabric: 'Polyester', season: 'All seasons', size: '38', styles: ['Classic', 'Minimal', 'Chic'], dressCodes: [2, 3, 4], modest: true }, 14, 3],
  ['light_wash_jeans', 'Light-wash jeans', { category: 'Bottom', colour: 'Blue', fabric: 'Denim', season: 'All seasons', size: '28', styles: ['Casual', 'Minimal'], dressCodes: [1, 2], modest: true }, 18, 1],
  ['beige_wide_leg_trousers', 'Beige wide-leg trousers', { category: 'Bottom', colour: 'Beige', fabric: 'Linen', season: 'Summer', size: '38', styles: ['Chic', 'Minimal', 'Elegant'], dressCodes: [1, 2, 3], modest: true }, 8, 5],
  ['cream_pleated_skirt', 'Cream pleated skirt', { category: 'Bottom', colour: 'Beige', fabric: 'Polyester', season: 'All seasons', size: 'S', styles: ['Elegant', 'Chic'], dressCodes: [1, 2, 3, 4], modest: true }, 4, 52],
  ['black_midi_skirt', 'Black midi skirt', { category: 'Bottom', colour: 'Black', fabric: 'Polyester', season: 'All seasons', size: 'S', styles: ['Classic', 'Chic'], dressCodes: [1, 2, 3, 4], modest: true }, 6, 15],
  ['navy_silk_midi_dress', 'Navy silk midi dress', { category: 'Dress', colour: 'Navy', fabric: 'Silk', season: 'All seasons', size: 'S', styles: ['Elegant', 'Classic'], dressCodes: [2, 4, 5], modest: true }, 4, 20],
  ['rose_wrap_dress', 'Rose wrap dress', { category: 'Dress', colour: 'Pink', fabric: 'Polyester', season: 'Spring / Autumn', size: 'S', styles: ['Chic', 'Elegant'], dressCodes: [2, 4], modest: true }, 3, 26],
  ['navy_blazer', 'Navy blazer', { category: 'Layer', colour: 'Navy', fabric: 'Wool', season: 'Spring / Autumn', size: 'M', styles: ['Classic', 'Chic'], dressCodes: [2, 3, 4], modest: true }, 10, 8],
  ['beige_trench_coat', 'Beige trench coat', { category: 'Layer', colour: 'Beige', fabric: 'Cotton', season: 'Spring / Autumn', size: 'M', styles: ['Classic', 'Elegant'], dressCodes: [1, 2, 3, 4], modest: true }, 6, 33],
  ['denim_jacket', 'Denim jacket', { category: 'Layer', colour: 'Blue', fabric: 'Denim', season: 'Spring / Autumn', size: 'M', styles: ['Casual', 'Streetwear'], dressCodes: [1, 2], modest: true }, 5, 104],
  ['camel_cardigan', 'Camel cardigan', { category: 'Layer', colour: 'Brown', fabric: 'Knit', season: 'Winter', size: 'M', styles: ['Comfortable', 'Classic'], dressCodes: [1, 2], modest: true }, 7, 61],
  ['white_sneakers', 'White sneakers', { category: 'Shoes', colour: 'White', fabric: 'Leather', season: 'All seasons', size: '39', styles: ['Casual', 'Minimal', 'Sporty'], dressCodes: [1, 2] }, 22, 1],
  ['black_loafers', 'Black loafers', { category: 'Shoes', colour: 'Black', fabric: 'Leather', season: 'All seasons', size: '39', styles: ['Classic', 'Minimal', 'Chic'], dressCodes: [1, 2, 3, 4] }, 12, 4],
  ['nude_heels', 'Nude heels', { category: 'Shoes', colour: 'Beige', fabric: 'Leather', season: 'All seasons', size: '38', styles: ['Elegant', 'Chic'], dressCodes: [3, 4, 5] }, 4, 20],
  ['tan_sandals', 'Tan sandals', { category: 'Shoes', colour: 'Brown', fabric: 'Leather', season: 'Summer', size: '39', styles: ['Casual', 'Comfortable'], dressCodes: [1, 2] }, 9, 13],
  ['brown_ankle_boots', 'Brown ankle boots', { category: 'Shoes', colour: 'Brown', fabric: 'Leather', season: 'Winter', size: '39', styles: ['Classic'], dressCodes: [1, 2, 3] }, 5, 200],
  ['structured_black_bag', 'Structured black bag', { category: 'Bag', colour: 'Black', fabric: 'Leather', season: 'All seasons', styles: ['Classic', 'Chic', 'Minimal'], dressCodes: [2, 3, 4, 5] }, 15, 3],
  ['tan_leather_tote', 'Tan leather tote', { category: 'Bag', colour: 'Brown', fabric: 'Leather', season: 'All seasons', styles: ['Casual', 'Classic'], dressCodes: [1, 2, 3] }, 13, 2],
  ['silk_scarf', 'Silk scarf', { category: 'Extra', colour: 'Navy', fabric: 'Silk', season: 'All seasons', styles: ['Classic', 'Elegant'], dressCodes: [2, 3, 4] }, 2, 58],
  ['gold_hoop_earrings', 'Gold hoop earrings', { category: 'Extra', colour: 'Yellow', fabric: 'Other', season: 'All seasons', styles: ['Chic', 'Elegant', 'Minimal'], dressCodes: [1, 2, 3, 4, 5] }, 17, 3],
  ['tortoise_sunglasses', 'Tortoise sunglasses', { category: 'Extra', colour: 'Brown', fabric: 'Other', season: 'Summer', styles: ['Chic', 'Casual'], dressCodes: [1, 2] }, 8, 10],
];
// [photo, status, daysAgo, until(days from now), note]
const STATUSES = [
  ['white_fitted_tee', 'Laundry', 1],
  ['light_wash_jeans', 'Laundry', 1],
  ['black_ribbed_top', 'Laundry', 0],
  ['rose_wrap_dress', 'Borrowed', 12, -5, 'Nour'],   // lent 12 days ago, was due back 5 days ago (borrow reminder)
  ['tan_sandals', 'Packed', 0, 6, 'Sahel weekend'],
];
// Outfits worn in the last 30 days (feed utilization, wear history and outfit memory):
// [daysAgo, pieces, rating, occasion, tempC, condition, eventTitle?]
const WEARS = [
  [1, ['light_wash_jeans', 'white_fitted_tee', 'white_sneakers', 'tan_leather_tote'], 5, 'University', 27, 'Clear'],
  [2, ['white_fitted_tee', 'beige_wide_leg_trousers', 'white_sneakers', 'gold_hoop_earrings'], 4, 'Everyday', 28, 'Clear'],
  [3, ['blue_oxford_shirt', 'black_tailored_trousers', 'black_loafers', 'structured_black_bag'], 5, 'Work', 27, 'Mostly clear'],
  [4, ['blue_oxford_shirt', 'light_wash_jeans', 'white_sneakers', 'tan_leather_tote'], 4, 'University', 29, 'Clear'],
  [6, ['black_ribbed_top', 'black_midi_skirt', 'black_loafers', 'gold_hoop_earrings'], 5, 'Dinner', 27, 'Clear', 'Salma’s birthday'],
  [8, ['ivory_silk_blouse', 'black_tailored_trousers', 'navy_blazer', 'black_loafers'], 5, 'Interview', 24, 'Partly cloudy'],
  [10, ['breton_striped_top', 'light_wash_jeans', 'white_sneakers', 'tortoise_sunglasses'], 4, 'Everyday', 29, 'Clear'],
  [12, ['breton_striped_top', 'beige_wide_leg_trousers', 'tan_sandals', 'tan_leather_tote'], 5, 'University', 30, 'Clear'],
  [15, ['black_ribbed_top', 'black_midi_skirt', 'white_sneakers', 'structured_black_bag'], 3, 'University', 30, 'Clear'],
  [20, ['navy_silk_midi_dress', 'nude_heels', 'structured_black_bag', 'gold_hoop_earrings'], 5, 'Wedding', 31, 'Clear'],
  [26, ['rose_wrap_dress', 'nude_heels', 'gold_hoop_earrings'], 4, 'Date night', 32, 'Clear'],
];
// Rejected looks (feed "Closet has learned"): [daysAgo, pieces, reason]
const REJECTS = [
  [3, ['ivory_silk_blouse', 'black_tailored_trousers', 'nude_heels'], 'Too formal'],
  [9, ['navy_silk_midi_dress', 'nude_heels', 'structured_black_bag'], 'Too formal'],
  [17, ['ivory_silk_blouse', 'cream_pleated_skirt', 'nude_heels'], 'Too formal'],
  [21, ['black_ribbed_top', 'black_midi_skirt', 'white_sneakers'], 'Wore this recently'],
];
// Pieces that left the closet, deleted through the real API so each reason has its real effect (US-13, US-33, US-34):
//   Became too small / Torn / damaged → a replacement appears on the shopping list
//   No longer my style (twice, both streetwear) → never re-suggested; "Closet has learned" offers to avoid streetwear
const REMOVED = [
  ['black_tailored_trousers', 'Black straight jeans', { category: 'Bottom', colour: 'Black', fabric: 'Denim', season: 'All seasons', size: '27', styles: ['Casual', 'Minimal'], dressCodes: [1, 2] }, 14, 'Became too small'],
  ['nude_heels', 'Black ballet flats', { category: 'Shoes', colour: 'Black', fabric: 'Leather', season: 'All seasons', size: '38', styles: ['Classic', 'Minimal'], dressCodes: [1, 2, 3] }, 31, 'Torn / damaged'],
  ['breton_striped_top', 'Oversized graphic hoodie', { category: 'Top', colour: 'Grey', fabric: 'Cotton', season: 'Winter', size: 'L', styles: ['Streetwear', 'Sporty'], dressCodes: [1] }, 4, 'No longer my style'],
  ['light_wash_jeans', 'Cargo joggers', { category: 'Bottom', colour: 'Green', fabric: 'Cotton', season: 'All seasons', size: 'M', styles: ['Streetwear', 'Comfortable'], dressCodes: [1] }, 2, 'No longer my style'],
];

// Optional purchase prices (demo values, EGP) for cost per wear. Price is never required.
const PRICES = {
  white_sneakers: 2200, black_loafers: 2400, navy_blazer: 3200, white_fitted_tee: 450, light_wash_jeans: 1300,
  ivory_silk_blouse: 1900, navy_silk_midi_dress: 4200, denim_jacket: 1600, nude_heels: 2100, structured_black_bag: 3500, beige_trench_coat: 3800,
};

function inDays(n) {
  const m = new Date();
  m.setDate(m.getDate() + n);
  return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-${String(m.getDate()).padStart(2, '0')}`;
}
const EVENTS = [
  // plannedWeather = the forecast when the outfit was chosen; today's estimate is warmer, so Closet warns (weather monitor).
  { title: 'Software Engineering presentation', date: inDays(1), time: '11:00', occasion: 'University', plannedWeather: { tempC: 24, condition: 'Partly cloudy' }, plan: ['blue_oxford_shirt', 'black_tailored_trousers', 'navy_blazer', 'black_loafers'], reasons: ['Every piece suits Casual for university, sharpened for presenting.', 'The navy blazer adds structure for the presentation.', 'Colours: neutrals with blue.'] },
  { title: 'Dinner with family', date: inDays(3), time: '20:00', occasion: 'Dinner', plan: ['ivory_silk_blouse', 'cream_pleated_skirt', 'black_loafers', 'structured_black_bag'], reasons: ['Every piece suits Smart Casual for dinner.', 'Ivory and cream keep it soft; the black bag grounds it.'] },
  { title: 'Internship interview', date: inDays(2), time: '10:00', occasion: 'Interview' },
  { title: "Nour's wedding", date: inDays(9), time: '19:30', occasion: 'Wedding' },
];


module.exports = { EMAIL: 'demo@closet.app', ADMIN: 'admin@closet.app', PASSWORD: 'Closet2026!', PIECES, STATUSES, WEARS, REJECTS, REMOVED, EVENTS, PRICES, inDays };

// The seeded closet as domain pieces (the shape IWardrobe.allPieces returns), for pure tests and the
// offline demo. ids are stable, readable keys (the file name of the photo).
function demoPieces(today = new Date()) {
  const DAY = 86400000;
  const status = Object.fromEntries(STATUSES.map(([f, s, daysAgo, until, note]) => [f, { s, daysAgo, until, note }]));
  return PIECES.map(([file, name, d, worn, lastDays]) => ({
    id: file, name, ...d, styles: d.styles || [], dressCodes: d.dressCodes, modest: Boolean(d.modest),
    status: status[file] ? status[file].s : 'Available',
    statusNote: status[file] && status[file].note ? status[file].note : null,
    statusSince: status[file] ? new Date(today.getTime() - status[file].daysAgo * DAY).toISOString() : null,
    statusUntil: status[file] && status[file].until !== undefined ? new Date(today.getTime() + status[file].until * DAY).toISOString().slice(0, 10) : null,
    price: PRICES[file] ?? null, currency: PRICES[file] ? 'EGP' : null, rehome: null,
    wearCount: worn, lastWornAt: worn && lastDays !== null ? new Date(today.getTime() - lastDays * DAY).toISOString() : null,
    createdAt: new Date(today.getTime() - 400 * DAY).toISOString(),
  }));
}
module.exports.demoPieces = demoPieces;
