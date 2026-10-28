// Demo data for the live demo. Pieces, quiz, statuses and events go through the real API
// (same validation, photo storage and events as a user). Wear history is back-dated with SQL
// so that forgotten pieces, utilization and "recycle time" have something to show.
// Usage: npm run seed   →  demo@closet.app / Closet2026!   (admin: admin@closet.app / Closet2026!)
const fs = require('fs');
const path = require('path');
const http = require('http');
const { createApp } = require('../app');
const { migrate } = require('./migrate');
const { pool } = require('./pool');

const EMAIL = 'demo@closet.app';
const ADMIN = 'admin@closet.app';
const PASSWORD = 'Closet2026!';
const PHOTOS = path.join(__dirname, '..', '..', 'seed', 'photos');

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
  ['sage_linen_shirt', 'Sage linen shirt', { category: 'Top', colour: 'Green', fabric: 'Linen', season: 'Summer', size: 'M', styles: ['Casual', 'Minimal'], dressCodes: [1, 2], modest: true }, 0, null],
  ['black_tailored_trousers', 'Black tailored trousers', { category: 'Bottom', colour: 'Black', fabric: 'Polyester', season: 'All seasons', size: '38', styles: ['Classic', 'Minimal', 'Chic'], dressCodes: [2, 3, 4], modest: true }, 14, 3],
  ['light_wash_jeans', 'Light-wash jeans', { category: 'Bottom', colour: 'Blue', fabric: 'Denim', season: 'All seasons', size: '28', styles: ['Casual', 'Minimal'], dressCodes: [1, 2], modest: true }, 18, 1],
  ['beige_wide_leg_trousers', 'Beige wide-leg trousers', { category: 'Bottom', colour: 'Beige', fabric: 'Linen', season: 'Summer', size: '38', styles: ['Chic', 'Minimal', 'Elegant'], dressCodes: [1, 2, 3], modest: true }, 8, 5],
  ['cream_pleated_skirt', 'Cream pleated skirt', { category: 'Bottom', colour: 'Beige', fabric: 'Polyester', season: 'All seasons', size: 'S', styles: ['Elegant', 'Chic'], dressCodes: [2, 3, 4], modest: true }, 4, 52],
  ['black_midi_skirt', 'Black midi skirt', { category: 'Bottom', colour: 'Black', fabric: 'Polyester', season: 'All seasons', size: 'S', styles: ['Classic', 'Chic'], dressCodes: [1, 2, 3, 4], modest: true }, 6, 15],
  ['navy_silk_midi_dress', 'Navy silk midi dress', { category: 'Dress', colour: 'Navy', fabric: 'Silk', season: 'All seasons', size: 'S', styles: ['Elegant', 'Classic'], dressCodes: [2, 4, 5], modest: true }, 4, 20],
  ['rose_wrap_dress', 'Rose wrap dress', { category: 'Dress', colour: 'Pink', fabric: 'Polyester', season: 'Spring / Autumn', size: 'S', styles: ['Chic', 'Elegant'], dressCodes: [2, 4], modest: true }, 3, 26],
  ['navy_blazer', 'Navy blazer', { category: 'Layer', colour: 'Navy', fabric: 'Wool', season: 'Spring / Autumn', size: 'M', styles: ['Classic', 'Chic'], dressCodes: [2, 3, 4], modest: true }, 10, 8],
  ['beige_trench_coat', 'Beige trench coat', { category: 'Layer', colour: 'Beige', fabric: 'Cotton', season: 'Spring / Autumn', size: 'M', styles: ['Classic', 'Elegant'], dressCodes: [1, 2, 3, 4], modest: true }, 6, 33],
  ['denim_jacket', 'Denim jacket', { category: 'Layer', colour: 'Blue', fabric: 'Denim', season: 'Spring / Autumn', size: 'M', styles: ['Casual', 'Streetwear'], dressCodes: [1, 2], modest: true }, 5, 45],
  ['camel_cardigan', 'Camel cardigan', { category: 'Layer', colour: 'Brown', fabric: 'Knit', season: 'Winter', size: 'M', styles: ['Comfortable', 'Classic'], dressCodes: [1, 2], modest: true }, 7, 61],
  ['white_sneakers', 'White sneakers', { category: 'Shoes', colour: 'White', fabric: 'Leather', season: 'All seasons', size: '39', styles: ['Casual', 'Minimal', 'Sporty'], dressCodes: [1, 2] }, 22, 1],
  ['black_loafers', 'Black loafers', { category: 'Shoes', colour: 'Black', fabric: 'Leather', season: 'All seasons', size: '39', styles: ['Classic', 'Minimal', 'Chic'], dressCodes: [2, 3, 4] }, 12, 4],
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
  ['rose_wrap_dress', 'Borrowed', 4, 1, 'Nour'],
  ['tan_sandals', 'Packed', 0, 6, 'Sahel weekend'],
];
// Outfits worn in the last 30 days (feed utilization and wear history): [daysAgo, pieces, rating]
const WEARS = [
  [1, ['light_wash_jeans', 'white_fitted_tee', 'white_sneakers', 'tan_leather_tote'], 5, 'University', 27, 'Clear'],
  [2, ['white_fitted_tee', 'beige_wide_leg_trousers', 'white_sneakers', 'gold_hoop_earrings'], 4, 'Everyday', 28, 'Clear'],
  [3, ['blue_oxford_shirt', 'black_tailored_trousers', 'black_loafers', 'structured_black_bag'], 5, 'Work', 27, 'Mostly clear'],
  [4, ['blue_oxford_shirt', 'light_wash_jeans', 'white_sneakers', 'tan_leather_tote'], 4, 'University', 29, 'Clear'],
  [6, ['black_ribbed_top', 'black_midi_skirt', 'black_loafers', 'gold_hoop_earrings'], 4, 'Dinner', 25, 'Clear'],
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

function inDays(n) {
  const m = new Date();
  m.setDate(m.getDate() + n);
  return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-${String(m.getDate()).padStart(2, '0')}`;
}
const EVENTS = [
  { title: 'Software Engineering presentation', date: inDays(1), time: '11:00', occasion: 'University', plan: ['blue_oxford_shirt', 'black_tailored_trousers', 'navy_blazer', 'black_loafers'], reasons: ['Every piece suits Casual for university, sharpened for presenting.', 'The navy blazer adds structure for the presentation.', 'Colours: neutrals with blue.'] },
  { title: 'Dinner with family', date: inDays(3), time: '20:00', occasion: 'Dinner', plan: ['ivory_silk_blouse', 'cream_pleated_skirt', 'black_loafers', 'structured_black_bag'], reasons: ['Every piece suits Smart Casual for dinner.', 'Ivory and cream keep it soft; the black bag grounds it.'] },
  { title: 'Internship interview', date: inDays(2), time: '10:00', occasion: 'Interview' },
  { title: "Nour's wedding", date: inDays(9), time: '19:30', occasion: 'Wedding' },
];

async function main() {
  await migrate();
  await pool.query('DELETE FROM accounts.users WHERE email = ANY($1)', [[EMAIL, ADMIN, 'salma.demo@closet.app']]);
  const server = http.createServer(createApp()).listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;
  const call = async (method, url, body, token, form) => {
    const res = await fetch(base + url, {
      method,
      headers: { ...(token && { Authorization: `Bearer ${token}` }), ...(!form && body && { 'Content-Type': 'application/json' }) },
      body: form || (body && JSON.stringify(body)),
    });
    if (!res.ok) throw new Error(`${method} ${url} → ${res.status} ${await res.text()}`);
    return res.status === 204 ? null : res.json();
  };
  const upload = async (token, file, name, details) => {
    const form = new FormData();
    form.append('photo', new Blob([fs.readFileSync(path.join(PHOTOS, `${file}.jpg`))], { type: 'image/jpeg' }), `${file}.jpg`);
    form.append('details', JSON.stringify({ ...details, name }));
    return call('POST', '/items', null, token, form);
  };
  try {
    const { token, user } = await call('POST', '/auth/register', { email: EMAIL, password: PASSWORD });
    await call('PUT', '/profile/quiz', {
      styles: ['Chic', 'Classic', 'Minimal'], colours: ['Beige', 'Navy', 'Black', 'White'],
      occasions: ['University', 'Work', 'Dinner', 'Wedding'], dressCode: 2, modest: false, city: 'Cairo',
    }, token);
    await call('PUT', '/profile', { displayName: 'Habiba', laundryDays: 2, laundryAutoReturn: true, laundryWeekday: 4, repeatDays: 3, reminders: true, reminderHour: 20 }, token);

    // The removed pieces first (so they are the oldest), then deleted with their reasons through the API.
    for (const [file, name, details, worn, reason] of REMOVED) {
      const old = await upload(token, file, name, details);
      await pool.query('UPDATE wardrobe.items SET wear_count = $2 WHERE id = $1', [old.id, worn]);
      await call('DELETE', `/items/${old.id}`, { reason }, token);
    }

    const ids = {};
    for (const [file, name, details, worn, lastDays] of PIECES) {
      const piece = await upload(token, file, name, details);
      ids[file] = piece.id;
      if (worn) await pool.query("UPDATE wardrobe.items SET wear_count = $2, last_worn_at = now() - ($3 || ' days')::interval WHERE id = $1", [piece.id, worn, String(lastDays)]);
    }
    for (const [file, status, daysAgo, until, note] of STATUSES) {
      await call('PATCH', `/items/${ids[file]}/status`, { status, ...(until && { until: inDays(until) }), ...(note && { note }) }, token);
      await pool.query("UPDATE availability.item_status SET changed_at = now() - ($2 || ' days')::interval WHERE item_id = $1", [ids[file], String(daysAgo)]);
    }
    for (const [d, files, rating, occasion, tempC, condition] of WEARS) {
      await pool.query("INSERT INTO outfits.wears (user_id, item_ids, worn_on, rating, occasion, temp_c, conditions) VALUES ($1, $2, CURRENT_DATE - ($3 || ' days')::interval, $4, $5, $6, $7)", [user.id, files.map((f) => ids[f]), String(d), rating, occasion, tempC, condition]);
    }
    const save = (files, o) => call('POST', '/outfits', { itemIds: files.map((f) => ids[f]), ...o }, token);
    await save(['ivory_silk_blouse', 'black_tailored_trousers', 'navy_blazer', 'black_loafers'], { occasion: 'Work', ruleScore: 100, favorite: true, reasons: ['Every piece suits Business Casual for work.', 'Colours: all neutral colours.', 'The navy blazer adds structure without feeling stiff.'] });
    await save(['breton_striped_top', 'beige_wide_leg_trousers', 'white_sneakers', 'tan_leather_tote'], { occasion: 'University', ruleScore: 100, favorite: true, reasons: ['Every piece suits Casual for university.', 'Colours: neutrals with navy stripes.', 'Comfortable for a long campus day.'] });
    await save(['navy_silk_midi_dress', 'nude_heels', 'structured_black_bag', 'gold_hoop_earrings'], { occasion: 'Wedding', ruleScore: 100, reasons: ['Every piece suits Formal for a wedding.', 'Silk and gold read as evening wear.'] });
    await save(['blue_oxford_shirt', 'light_wash_jeans', 'white_sneakers', 'tortoise_sunglasses'], { occasion: 'Everyday', ruleScore: 100, source: 'built', reasons: ['Built in Mix & Match.'] });

    for (const e of EVENTS) {
      const ev = await call('POST', '/events', { title: e.title, date: e.date, time: e.time, occasion: e.occasion }, token);
      if (e.plan) await call('PUT', `/events/${ev.id}/outfit`, { itemIds: e.plan.map((f) => ids[f]), ruleScore: 100, reasons: e.reasons }, token);
    }
    // Rejected looks with reasons, back-dated, so "Closet has learned" has real evidence.
    for (const [d, files, reason] of REJECTS) {
      await pool.query("INSERT INTO outfits.feedback (user_id, kind, item_ids, reason, created_at) VALUES ($1, 'reject', $2, $3, now() - ($4 || ' days')::interval)", [user.id, files.map((f) => ids[f]), reason, String(d)]);
    }
    // A saved packing list (Packing Mode preview): a city break inside the 16-day forecast window.
    await call('POST', '/packing/trips', { destination: 'Paris', startDate: inDays(12), endDate: inDays(15), tripType: 'Travel', activities: ['Travel', 'Dinner', 'Everyday'] }, token);

    // Admin account (Sprint 3 early start: Admin page)
    const a = await call('POST', '/auth/register', { email: ADMIN, password: PASSWORD });
    await pool.query("UPDATE accounts.users SET role = 'admin' WHERE id = $1", [a.user.id]);

    console.log(`Seeded ${PIECES.length} pieces, ${REMOVED.length} deleted with reasons, ${WEARS.length} worn outfits, ${REJECTS.length} rejections, ${EVENTS.length} events (2 planned), 4 saved outfits, 1 packing list for ${EMAIL} / ${PASSWORD}; admin ${ADMIN}`);
  } finally {
    server.close();
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
