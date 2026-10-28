// Demo preflight: `npm run demo:check` (server running, right after `npm run seed`).
// Checks the seeded demo account read-only, then tries the deletion rules on a throwaway account
// that it deletes again. With --save it stores today's three looks etc. as the expected result;
// later runs compare against it, so a changed demo is noticed before the talk, not during it.
// Exit code 0 = ready; 1 = something to fix (each failed line says what).
const fs = require('fs');
const path = require('path');

const B = (process.env.CLOSET_URL || 'http://localhost:4000') + '/api/v1';
const EXPECTED = path.join(__dirname, 'demo-expected.json');
const SAVE = process.argv.includes('--save');
let failed = 0;
const ok = (cond, what, detail = '') => { console.log(`${cond ? '  ✓' : '  ✗'} ${what}${detail ? ` — ${detail}` : ''}`); if (!cond) failed += 1; return cond; };

async function call(token, method, url, body, form) {
  const r = await fetch(B + url, { method, headers: { ...(token && { Authorization: `Bearer ${token}` }), ...(body && !form && { 'Content-Type': 'application/json' }) }, body: form || (body && JSON.stringify(body)) });
  const text = await r.text(); let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: r.status, data };
}

(async () => {
  console.log(`Closet demo preflight → ${B}`);
  const health = await fetch(B + '/health').then((r) => r.ok).catch(() => false);
  if (!ok(health, 'server is up')) process.exit(1);

  // ---------- the demo account (read-only) ----------
  const login = await call(null, 'POST', '/auth/login', { email: 'demo@closet.app', password: 'Closet2026!' });
  if (!ok(login.status === 200, 'demo user demo@closet.app signs in', login.status === 200 ? '' : 'run `npm run seed` first')) process.exit(1);
  const T = login.data.token; const api = (m, u, b) => call(T, m, u, b);
  const items = (await api('GET', '/items')).data.items;
  const by = (n) => items.find((p) => p.name === n);
  ok(items.length === 30, 'the seeded closet has 30 pieces', `${items.length}`);
  for (const n of ['Navy blazer', 'Silk scarf', 'Denim jacket', 'Red cropped tee', 'Beige wide-leg trousers', 'Breton striped top', 'Ivory silk blouse'])
    ok(Boolean(by(n)), `piece “${n}” exists`);
  ok(by('Navy blazer')?.status === 'Available', 'Navy blazer is Available (Act 2 moves it to the laundry)', by('Navy blazer')?.status);
  ok(by('Silk scarf')?.status === 'Available', 'Silk scarf is Available (Act 6 deletes it)');
  const laundry = (await api('GET', '/laundry')).data;
  const inWash = (laundry.items || laundry.basket || []).map((p) => p.name);
  ok(inWash.length === 3, 'three pieces wait in the laundry basket', inWash.join(', '));
  const ins = (await api('GET', '/insights')).data;
  ok(ins.forgotten.some((p) => p.name === 'Denim jacket'), 'Denim jacket is a forgotten piece (Act 4)', ins.forgotten.map((p) => p.name).join(', '));
  const prof = (await api('GET', '/profile')).data;
  ok((prof.avoidStyles || []).length === 0, 'no learned preference is confirmed yet (Act 8 confirms and undoes one)');

  const rec = (await api('POST', '/recommendations', { occasion: 'University' })).data;
  const looks = rec.outfits.map((o) => ({ name: o.title, pieces: o.pieces.map((p) => p.name), match: o.compatibility }));
  ok(rec.outfits.length === 3, 'Style me → University gives exactly three looks');
  ok(new Set(looks.map((l) => l.name)).size === 3, 'the three looks have three different names', looks.map((l) => l.name).join(' · '));
  // v1.5: three genuinely different looks — any two share at most ONE major garment (top, dress, bottom, layer, shoes)
  const MAJOR = ['Top', 'Dress', 'Bottom', 'Layer', 'Shoes'];
  let shared = 0;
  for (let i = 0; i < 3; i += 1) for (let j = i + 1; j < 3; j += 1) {
    const a = rec.outfits[i].pieces.filter((p) => MAJOR.includes(p.category)).map((p) => p.id); const b2 = rec.outfits[j].pieces.filter((p) => MAJOR.includes(p.category)).map((p) => p.id);
    shared = Math.max(shared, a.filter((x) => b2.includes(x)).length);
  }
  ok(shared <= 1, 'the three looks are different styling directions (≤ 1 shared major garment)', `max shared: ${shared}`);
  ok(rec.weather.source === 'estimate', 'weather is the seasonal estimate (start the server with WEATHER_MODE=estimate for a repeatable demo)', `${rec.weather.tempC} °C · ${rec.weather.source}`);
  const first = rec.outfits[0];
  const sw = (await api('POST', '/recommendations/swap', { itemIds: first.itemIds, slot: 0, occasion: 'University' })).data;
  ok((sw.options || []).length === 3, 'clicking the top of LOOK 01 offers three alternatives', (sw.options || []).map((o) => `${o.piece.name} ${o.outfit.compatibility}%`).join(', '));

  const denim = by('Denim jacket');
  const fx = (await api('POST', '/recommendations', { occasion: 'University', fixedId: denim.id })).data;
  ok(fx.outfits.length === 3 && fx.outfits.every((o) => o.itemIds.includes(denim.id)), 'Another chance → three looks, every one with the denim jacket');

  const work = (await api('POST', '/recommendations', { occasion: 'Work' })).data.outfits[0];
  const good = (await api('POST', '/recommendations/check', { itemIds: work.itemIds, occasion: 'Work' })).data;
  const topSlot = work.pieces.findIndex((p) => p.category === 'Top' || p.category === 'Dress');
  const weakIds = work.itemIds.map((id, i) => (i === topSlot ? by('Red cropped tee').id : id));
  const weak = (await api('POST', '/recommendations/check', { itemIds: weakIds, occasion: 'Work' })).data;
  let best = null;
  for (let s = 0; s < weakIds.length; s += 1) {
    const r = (await api('POST', '/recommendations/swap', { itemIds: weakIds, slot: s, occasion: 'Work' })).data.outfit;
    if (r && (!best || r.ruleScore > best.ruleScore || (r.ruleScore === best.ruleScore && r.compatibility > best.compatibility))) best = r;
  }
  ok(weak.compatibility < good.compatibility, 'Mix & Match: the red cropped tee lowers the Work look', `${good.compatibility}% → ${weak.compatibility}%`);
  ok(best && best.compatibility > weak.compatibility && !best.itemIds.includes(by('Red cropped tee').id), 'Suggest a fix replaces the tee and raises the score', best ? `${weak.compatibility}% → ${best.compatibility}%` : '');

  const list = (await api('GET', '/shopping/list')).data.items;
  ok(list.some((i) => i.source === 'replacement'), 'the shopping bag already holds replacements from earlier deletions', list.map((i) => i.title).join(', '));
  ok(!list.some((i) => /silk scarf/i.test(i.title)), 'no silk-scarf replacement yet (Act 6 adds it)');
  const buy = (await api('POST', '/chat', { message: 'I want to buy beige trousers. Do I need them?' })).data;
  ok(buy.function === 'buy_check', 'Ask Closet answers “Do I need beige trousers?”', `${buy.function} · ${String(buy.reply).slice(0, 70)}…`);
  // v1.5: different questions → different functions (no replayed answer)
  const qs = ['What should I wear to university tomorrow?', 'Is my blazer clean?', 'What could I donate?', 'Who has my rose wrap dress?', 'Do I need to do laundry before Monday?',
    'What did I wear to Salma’s birthday?', 'Why is my wardrobe health low?', 'Is tomorrow’s outfit still okay for the weather?', 'Pack me for 5 days in Paris', 'Tell me a joke'];
  const fns = [];
  for (const q of qs) fns.push((await api('POST', '/chat', { message: q })).data);
  ok(new Set(fns.map((r) => r.function)).size === qs.length, 'Ask Closet: 10 different questions → 10 different functions', fns.map((r) => r.function).join(', '));
  ok(new Set(fns.map((r) => r.reply)).size === qs.length && fns.every((r) => !/beige trousers/i.test(r.reply)), 'Ask Closet: 10 different answers, none about beige trousers');
  const f2 = (await api('GET', '/intelligence/forgotten')).data;
  ok(f2.top && f2.top.piece.name === 'Denim jacket' && f2.top.days === 104, '“Still love it?” → Denim jacket, 104 days', f2.top ? `${f2.top.piece.name} · ${f2.top.days} days` : 'none');
  const mon = (await api('GET', '/intelligence/monitor')).data.alerts;
  ok(mon.some((a) => a.kind === 'weather' && /navy blazer/.test(a.message)), 'Planner monitor: tomorrow’s planned blazer is too warm (24 → 30 °C)', mon.map((a) => a.kind).join(', '));
  const bor = (await api('GET', '/intelligence/borrowed')).data;
  ok(bor.overdue.some((x) => x.borrowedBy === 'Nour'), 'Borrow tracker: the rose wrap dress is overdue (with Nour)');
  const sea = (await api('GET', '/intelligence/seasonal')).data;
  ok(sea.pack.length >= 1, 'Seasonal rotation suggests cold-weather pieces at 30 °C (nothing moves until you confirm)', sea.pack.map((p) => p.name).join(', '));
  const learned = (await api('GET', '/intelligence/learned')).data;
  const pats = learned.patterns || learned.learned || learned;
  ok(Array.isArray(pats) && pats.length >= 3, 'Closet has learned shows patterns with evidence', Array.isArray(pats) ? pats.map((p) => p.key).join(', ') : '');

  // ---------- deletion rules on a throwaway account ----------
  const email = `preflight.${Date.now()}@closet.app`; const pw = 'Preflight2026!';
  const reg = await call(null, 'POST', '/auth/register', { email, password: pw });
  if (ok(reg.status === 201, 'a throwaway account for the deletion check')) {
    const t = reg.data.token;
    const photo = new Blob([fs.readFileSync(path.join(__dirname, '..', 'seed', 'photos', 'silk_scarf.jpg'))], { type: 'image/jpeg' });
    const add = async (name, colour) => { const f = new FormData(); f.append('photo', photo, 'p.jpg'); f.append('details', JSON.stringify({ name, category: 'Extra', colour, dressCodes: [2], styles: ['Classic'] })); return (await call(t, 'POST', '/items', null, f)).data; };
    const a = await add('Test scarf A', 'Navy'); const b = await add('Test scarf B', 'Beige');
    const da = await call(t, 'DELETE', `/items/${a.id}`, { reason: 'No longer my style' });
    const db = await call(t, 'DELETE', `/items/${b.id}`, { reason: 'Torn / damaged' });
    const l2 = (await call(t, 'GET', '/shopping/list')).data.items;
    ok(da.status === 200 && !l2.some((i) => /scarf a/i.test(i.title)), '“No longer my style” creates no replacement');
    ok(db.status === 200 && l2.some((i) => i.source === 'replacement' && /scarf b/i.test(i.title)), '“Torn / damaged” puts a replacement in the bag');
    // Save then Favourite → one record (defect D-10)
    const c = await add('Test scarf C', 'Black'); const d = await add('Test scarf D', 'White');
    const s1 = await call(t, 'POST', '/outfits', { itemIds: [c.id, d.id] }); const s2 = await call(t, 'POST', '/outfits', { itemIds: [d.id, c.id], favorite: true });
    const all = (await call(t, 'GET', '/outfits')).data.outfits; const fav = (await call(t, 'GET', '/outfits?favorites=true')).data.outfits;
    ok(s1.data.id === s2.data.id && all.length === 1 && fav.length === 1, 'Save then Favourite keeps ONE look, and it is in Favourites');
    const gone = await call(t, 'DELETE', '/account', { confirm: 'DELETE MY ACCOUNT', password: pw });
    ok(gone.status === 200 || gone.status === 204, 'the throwaway account is deleted again');
  }

  // ---------- same result as last time? ----------
  const snapshot = { looks, fixed: fx.outfits.map((o) => o.title), mix: [good.compatibility, weak.compatibility, best && best.compatibility], tray: (sw.options || []).map((o) => o.piece.name), ask: fns.map((r) => r.function) };
  if (SAVE) { fs.writeFileSync(EXPECTED, JSON.stringify(snapshot, null, 2)); console.log(`  • saved the expected demo results to ${path.basename(EXPECTED)}`); }
  else if (fs.existsSync(EXPECTED)) ok(JSON.stringify(JSON.parse(fs.readFileSync(EXPECTED, 'utf8'))) === JSON.stringify(snapshot), 'the demo gives the same looks, tray and scores as the saved run');
  console.log(failed ? `\n${failed} check(s) failed — fix them before presenting.` : '\nReady: every demo check passed.');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('Preflight crashed:', e.message); process.exit(1); });
