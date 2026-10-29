// Demo data for the live demo. Pieces, quiz, statuses and events go through the real API
// (same validation, photo storage and events as a user). Wear history is back-dated with SQL
// so that forgotten pieces, utilization and "recycle time" have something to show.
// Usage: npm run seed   →  demo@closet.app / Closet2026!   (admin: admin@closet.app / Closet2026!)
// Weather: the seed uses the same WEATHER_MODE as the server (both read server/.env), so planned outfits
// store the same kind of forecast the server compares them with (defect D-27: CI seeded live, served estimate).
//  - WEATHER_MODE=estimate → repeatable demo: the seasonal estimate everywhere (CI uses this).
//  - no WEATHER_MODE      → real forecast from Open-Meteo everywhere; if the service is unreachable the
//                            app falls back to the estimate and labels it.
const fs = require('fs');
const path = require('path');
const http = require('http');
const { createApp } = require('../app');
const { migrate } = require('./migrate');
const { pool } = require('./pool');

const { weatherAdapter } = require('../modules/recommendation/weatherAdapter');

// The presentation is "planned last week" at a cooler forecast, so the Planner shows the weather-change alert.
// Estimate mode: the fixed 24 °C from seedData. Live mode: 6 °C below the REAL forecast for that day, so the
// alert quotes true numbers; on a day under 24 °C no warm-weather alert would be honest, so none is planted.
async function plannedSnapshot(e) {
  if (!e.plannedWeather) return null;
  if (process.env.WEATHER_MODE === 'estimate') return e.plannedWeather;
  const w = await weatherAdapter().forDate('Cairo', e.date);
  if (w.source === 'estimate') return e.plannedWeather;   // service unreachable → same as estimate mode
  return w.tempC >= 24 ? { tempC: w.tempC - 6, condition: e.plannedWeather.condition } : null;
}

const EMAIL = 'demo@closet.app';
const ADMIN = 'admin@closet.app';
const PASSWORD = 'Closet2026!';
const PHOTOS = path.join(__dirname, '..', '..', 'seed', 'photos');

const { PIECES, STATUSES, WEARS, REJECTS, REMOVED, EVENTS, PRICES, inDays } = require('./seedData');

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
      // The demo closet has existed for a while (new pieces are never judged as "forgotten").
      await pool.query("UPDATE wardrobe.items SET created_at = now() - interval '400 days' WHERE id = $1", [piece.id]);
    }
    for (const [file, status, daysAgo, until, note] of STATUSES) {
      // Through the same endpoints the app uses: Lend item (person, date lent, due date), Repair / Alter, or a plain status change.
      if (status === 'Borrowed') await call('POST', `/items/${ids[file]}/lend`, { person: note, lentOn: inDays(-daysAgo), dueOn: inDays(until) }, token);
      else if (/^Needs /.test(status)) await call('POST', `/items/${ids[file]}/care`, { kind: status === 'Needs repair' ? 'repair' : 'alteration', reason: note }, token);
      else await call('PATCH', `/items/${ids[file]}/status`, { status, ...(until > 0 && { until: inDays(until) }), ...(note && { note }) }, token);
      await pool.query("UPDATE availability.item_status SET changed_at = now() - ($2 || ' days')::interval WHERE item_id = $1", [ids[file], String(daysAgo)]);
    }
    for (const [d, files, rating, occasion, tempC, condition, eventTitle] of WEARS) {
      await pool.query("INSERT INTO outfits.wears (user_id, item_ids, worn_on, rating, occasion, temp_c, conditions, event_title) VALUES ($1, $2, CURRENT_DATE - ($3 || ' days')::interval, $4, $5, $6, $7, $8)", [user.id, files.map((f) => ids[f]), String(d), rating, occasion, tempC, condition, eventTitle || null]);
    }
    for (const [file, price] of Object.entries(PRICES)) await call('PATCH', `/items/${ids[file]}`, { price, currency: 'EGP' }, token);
    const save = (files, o) => call('POST', '/outfits', { itemIds: files.map((f) => ids[f]), ...o }, token);
    await save(['ivory_silk_blouse', 'black_tailored_trousers', 'navy_blazer', 'black_loafers'], { occasion: 'Work', ruleScore: 100, favorite: true, reasons: ['Every piece suits Business Casual for work.', 'Colours: all neutral colours.', 'The navy blazer adds structure without feeling stiff.'] });
    await save(['breton_striped_top', 'beige_wide_leg_trousers', 'white_sneakers', 'tan_leather_tote'], { occasion: 'University', ruleScore: 100, favorite: true, reasons: ['Every piece suits Casual for university.', 'Colours: neutrals with navy stripes.', 'Comfortable for a long campus day.'] });
    await save(['navy_silk_midi_dress', 'nude_heels', 'structured_black_bag', 'gold_hoop_earrings'], { occasion: 'Wedding', ruleScore: 100, reasons: ['Every piece suits Formal for a wedding.', 'Silk and gold read as evening wear.'] });
    await save(['blue_oxford_shirt', 'light_wash_jeans', 'white_sneakers', 'tortoise_sunglasses'], { occasion: 'Everyday', ruleScore: 100, source: 'built', reasons: ['Built in Mix & Match.'] });

    for (const e of EVENTS) {
      const ev = await call('POST', '/events', { title: e.title, date: e.date, time: e.time, occasion: e.occasion }, token);
      if (e.plan) await call('PUT', `/events/${ev.id}/outfit`, { itemIds: e.plan.map((f) => ids[f]), ruleScore: 100, reasons: e.reasons }, token);
      const planned = await plannedSnapshot(e);
      if (planned) await pool.query('UPDATE planner.events SET planned_temp_c = $2, planned_condition = $3 WHERE id = $1', [ev.id, planned.tempC, planned.condition]);
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
