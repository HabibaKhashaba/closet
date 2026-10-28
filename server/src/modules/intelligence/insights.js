// Wardrobe Insights (Milestone 2 final, "Closet becomes proactive"). ONE shared, pure domain layer
// used by the API services, Ask Closet, the Notification Center and the offline demo, so a rule is
// written once. Nothing here reads the database or changes state: callers pass the current pieces
// (with their ONE authoritative status), wear history, events and weather, and act on the result.
//
//   forgottenCandidates   long-unworn pieces the user may style again, keep or donate (user decides)
//   seasonalRotation      what could be stored for the season / brought back (never automatic)
//   laundryRisk           high-use pieces for an upcoming event are all in the laundry
//   planDays              several days of outfits that avoid unrealistic reuse
//   repeatInsight         "you wore almost this look" / "you loved this look — repeat it?"
//   memoryMatches         outfit memory: what was worn, where, at what temperature, how rated
//   memorySignals         a bounded ranking boost from highly rated looks in a similar context
//   weatherShift          a planned outfit whose forecast changed materially
//   costPerWear / valueInsights
//   gapConfidence         HIGH / MEDIUM / LOW with reasons, never a gap the user already covers
//   purchaseImpact        what a piece you might buy adds — simulated, never saved
//   tripCapsule           a compact packing list with intentional reuse and a baggage limit
//   explainHealth         what raises / lowers the Wardrobe Health score
const engine = require('../recommendation/engine');
const { DRESS_CODES, OCCASIONS } = require('../../shared/vocabulary');

const DAY = 86400000;
const daysBetween = (a, b) => Math.floor((new Date(b) - new Date(a)) / DAY);
const label = (p) => (p.name || `${p.colour} ${p.category}`).toLowerCase();
const isAvailable = (p) => p.status === 'Available' && !p.rehome;

// ---------- seasons: weather first, calendar second ----------
// Current season from the temperature the user will actually feel (bands are documented in SDD 5.14).
function seasonFromWeather(tempC) {
  if (tempC === undefined || tempC === null) return null;
  if (tempC >= 27) return 'Summer';
  if (tempC <= 17) return 'Winter';
  return 'Spring / Autumn';
}
// Northern-hemisphere calendar season (Closet's launch market is Cairo); used only together with weather.
function seasonFromMonth(date) {
  const m = new Date(date).getMonth();
  if (m === 11 || m <= 1) return 'Winter';
  if (m >= 5 && m <= 7) return 'Summer';
  return 'Spring / Autumn';
}
// Is it fair to judge a seasonal piece now? A winter coat is never judged in summer heat.
function inSeason(p, { today, tempC }) {
  if (!p.season || p.season === 'All seasons') return true;
  const cal = seasonFromMonth(today);
  const felt = seasonFromWeather(tempC);
  if (p.season === 'Winter') return cal === 'Winter' && (tempC === undefined || tempC < 22);
  if (p.season === 'Summer') return (cal === 'Summer' || felt === 'Summer') && (tempC === undefined || tempC >= 22);
  return cal === 'Spring / Autumn' || felt === 'Spring / Autumn';
}

// ---------- 1. long-unworn pieces: style it, keep it, or donate it ----------
// Thresholds by kind of piece (configurable; deterministic, no machine learning):
const INACTIVITY_DAYS = { everyday: 90, special: 180 };
const NEW_PIECE_DAYS = 30; // a piece added in the last 30 days is never judged
const isSpecial = (p) => (p.dressCodes || []).length > 0 && Math.min(...p.dressCodes) >= 4; // formal / evening only
function inactivity(p, today) {
  const since = p.lastWornAt || p.createdAt;
  return since ? daysBetween(since, today) : null;
}
// snoozes: Map(itemId → ISO date until which the user asked Closet not to suggest it), from "Keep it".
function forgottenCandidates(pieces, { today = new Date(), tempC, snoozes = new Map(), thresholds = INACTIVITY_DAYS } = {}) {
  const out = [];
  for (const p of pieces) {
    if (!isAvailable(p)) continue; // Laundry, Borrowed, Packed, Unavailable or already being rehomed: not now
    if (p.createdAt && daysBetween(p.createdAt, today) < NEW_PIECE_DAYS) continue;
    const until = snoozes.get(p.id);
    if (until && new Date(until) > today) continue;
    if (!inSeason(p, { today, tempC })) continue;
    const days = inactivity(p, today);
    const limit = isSpecial(p) ? thresholds.special : thresholds.everyday;
    if (days === null || days < limit) continue;
    const why = p.wearCount > 0
      ? `Last worn ${days} days ago${isSpecial(p) ? ' (special-occasion pieces get 180 days)' : ''}; it is in season now.`
      : `Never worn since you added it ${days} days ago.`;
    out.push({ id: p.id, piece: p, days, threshold: limit, kind: isSpecial(p) ? 'special' : 'everyday', reason: why,
      message: `You haven’t worn your ${label(p)} in ${days} days. Would you like to style it again, keep it, or donate it to someone who may need it?` });
  }
  return out.sort((a, b) => b.days - a.days || a.id.localeCompare(b.id));
}

// ---------- 2. seasonal rotation (suggest only; the user confirms) ----------
const SEASONAL_NOTE = 'Seasonal storage';
function seasonalRotation(pieces, { tempC, today = new Date(), snoozes = new Map() } = {}) {
  const season = seasonFromWeather(tempC);
  const opposite = season === 'Summer' ? 'Winter' : season === 'Winter' ? 'Summer' : null;
  const notNow = (p) => { const u = snoozes.get(p.id); return u && new Date(u) > today; };
  const recentlyWorn = (p) => p.lastWornAt && daysBetween(p.lastWornAt, today) < 21;
  const pack = opposite ? pieces.filter((p) => isAvailable(p) && p.season === opposite && !recentlyWorn(p) && !notNow(p)) : [];
  const bringBack = pieces.filter((p) => p.status === 'Packed' && p.statusNote === SEASONAL_NOTE && p.season !== opposite);
  const word = (s) => (s === 'Summer' ? 'warm-weather' : 'cold-weather');
  let headline = null;
  if (bringBack.length) headline = `${season === 'Winter' ? 'Temperatures are dropping' : 'The season has turned'}. ${bringBack.length} stored piece${bringBack.length === 1 ? ' is' : 's are'} ready to come back into rotation.`;
  else if (pack.length) headline = `It’s ${tempC} °C. ${pack.length} ${word(opposite)} piece${pack.length === 1 ? '' : 's'} could be stored until the season changes.`;
  return { season, tempC, pack, bringBack, headline, actions: ['Pack for season', 'Bring back', 'Keep active', 'Not now'], note: SEASONAL_NOTE };
}

// ---------- 3. laundry intelligence ----------
// A warning only when it matters: an event in the next `horizon` days AND at least two of the user's
// three most-worn pieces of one kind (tops, bottoms) that suit that event are in the laundry.
const KINDS = { tops: ['Top', 'Dress'], bottoms: ['Bottom'] };
function laundryRisk(pieces, events, { today = new Date(), horizon = 7 } = {}) {
  const out = [];
  const soon = events.filter((e) => { const d = daysBetween(today.toISOString().slice(0, 10), e.date); return d >= 0 && d <= horizon; })
    .sort((a, b) => a.date.localeCompare(b.date));
  const seen = new Set();
  for (const e of soon) {
    const level = e.dressCode || OCCASIONS[e.occasion] || 1;
    for (const [kind, cats] of Object.entries(KINDS)) {
      const key = `${level}:${kind}`;
      if (seen.has(key)) continue;
      const fit = pieces.filter((p) => cats.includes(p.category) && (p.dressCodes || []).includes(level) && !p.rehome);
      const top3 = [...fit].sort((a, b) => b.wearCount - a.wearCount || a.id.localeCompare(b.id)).slice(0, 3);
      const dirty = top3.filter((p) => p.status === 'Laundry');
      if (dirty.length >= 2) {
        seen.add(key);
        const when = daysBetween(today.toISOString().slice(0, 10), e.date);
        const day = when === 0 ? 'today' : when === 1 ? 'tomorrow' : `before ${new Date(`${e.date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long' })}`;
        out.push({ key: `laundry-risk:${e.id}:${kind}`, eventId: e.id, event: e.title, date: e.date, kind, pieces: dirty, cleanLeft: fit.filter(isAvailable).length,
          message: `${dirty.length} of your 3 most-worn ${DRESS_CODES[level].toLowerCase()} ${kind} are in the laundry. You may want to wash them ${day} for “${e.title}”.` });
      }
    }
  }
  return out;
}

// Several days of outfits (Ask Closet "plan my next 4 days", trips): tops, bottoms and dresses are not
// reused before a wash unless the user allows repeats; shoes, bags and accessories repeat freely.
function planDays(pieces, days, { prefs = {}, allowRepeats = false, maxWears = 1, today = new Date() } = {}) {
  const used = new Map();
  const plan = [];
  for (const d of days) {
    const blocked = allowRepeats ? [] : [...used.entries()].filter(([, n]) => n >= maxWears).map(([id]) => id);
    const r = engine.recommend(pieces, { occasion: d.occasion, level: d.level, prefs: { ...prefs, repeatDays: 0 }, weather: d.weather, hiddenIds: blocked, today: new Date(`${d.date}T12:00:00`) });
    const best = r.outfits[0] || null;
    if (best) for (const id of best.itemIds) {
      const p = pieces.find((x) => x.id === id);
      if (['Top', 'Dress', 'Bottom'].includes(p.category)) used.set(id, (used.get(id) || 0) + 1);
    }
    plan.push({ ...d, outfit: best, note: best ? null : r.note });
  }
  return { days: plan, repeatsAllowed: allowRepeats, reusedPieces: [...used.entries()].filter(([, n]) => n > 1).map(([id]) => id) };
}

// ---------- 4. repeat intelligence (repeating is fine; the user decides) ----------
const MAINS = ['Top', 'Dress', 'Bottom', 'Layer', 'Shoes'];
function similarLook(aIds, bIds, pieces) {
  const main = (ids) => ids.filter((id) => { const p = pieces.find((x) => x.id === id); return p && MAINS.includes(p.category); });
  const a = main(aIds); const b = main(bIds);
  const shared = a.filter((x) => b.includes(x)).length;
  return { shared, of: Math.max(a.length, b.length), similar: shared >= 3 || (a.length > 0 && shared === a.length && a.length === b.length) };
}
function repeatInsight(itemIds, wears, pieces, { today = new Date(), allowRepeats = false, windowDays = 7 } = {}) {
  const recent = wears.filter((w) => daysBetween(w.date, today) <= windowDays && daysBetween(w.date, today) >= 0)
    .map((w) => ({ w, s: similarLook(itemIds, w.pieces.map((p) => p.id), pieces) })).filter((x) => x.s.similar);
  const loved = wears.filter((w) => (w.rating || 0) >= 4).map((w) => ({ w, s: similarLook(itemIds, w.pieces.map((p) => p.id), pieces) })).filter((x) => x.s.similar)
    .sort((a, b) => b.w.rating - a.w.rating || b.w.date.localeCompare(a.w.date))[0];
  if (loved && (loved.w.rating >= 5 || !recent.length)) {
    return { kind: 'loved', wearId: loved.w.id, date: loved.w.date, rating: loved.w.rating,
      message: `You loved this look${loved.w.eventTitle ? ` at “${loved.w.eventTitle}”` : loved.w.occasion ? ` for ${loved.w.occasion.toLowerCase()}` : ''} (${'★'.repeat(loved.w.rating)}). Want to repeat it?`, actions: ['Wear again', 'Change one piece'] };
  }
  if (recent.length >= 1 && !allowRepeats) {
    return { kind: 'variety', count: recent.length, message: `You wore almost this exact look ${recent.length >= 2 ? `${recent.length} times` : 'once'} this week. Want a variation?`, actions: ['Keep it', 'Change one piece', 'Show an alternative'] };
  }
  return null;
}

// ---------- 5. outfit memory ----------
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const STOP = new Set(['what', 'did', 'wear', 'wore', 'give', 'something', 'similar', 'last', 'that', 'with', 'like', 'most', 'outfits', 'outfit', 'the', 'for', 'and', 'my', 'me', 'to', 'at', 'i']);
function memoryMatches(wears, text = '', { today = new Date(), best = false } = {}) {
  const t = String(text).toLowerCase().replace(/[’']/g, '');
  if (best) return [...wears].filter((w) => w.rating).sort((a, b) => b.rating - a.rating || b.date.localeCompare(a.date)).slice(0, 3);
  const wd = WEEKDAYS.findIndex((d) => new RegExp(`\\blast ${d}\\b`).test(t));
  if (wd >= 0) {
    const d = new Date(today); d.setDate(d.getDate() - (((d.getDay() - wd + 7) % 7) || 7));
    const day = d.toISOString().slice(0, 10);
    return wears.filter((w) => w.date === day);
  }
  const words = t.split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w)).map((w) => w.replace(/s$/, ''));
  if (!words.length) return [];
  const score = (w) => words.filter((x) => `${w.eventTitle || ''} ${w.occasion || ''} ${w.note || ''}`.toLowerCase().replace(/[’']/g, '').includes(x)).length;
  return wears.map((w) => ({ w, s: score(w) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s || b.w.date.localeCompare(a.w.date)).map((x) => x.w).slice(0, 3);
}
// One bounded signal for the ranker: pieces from looks rated ≥ 4 for the same occasion at a similar
// temperature (± 4 °C) get +1 each time, at most +3 — enough to tip a tie, never to dominate.
function memorySignals(wears, { occasion, tempC }) {
  const boost = new Map(); let source = null;
  for (const w of wears) {
    if ((w.rating || 0) < 4 || (occasion && w.occasion !== occasion)) continue;
    if (tempC !== undefined && w.weather && Math.abs(w.weather.tempC - tempC) > 4) continue;
    for (const p of w.pieces) boost.set(p.id, Math.min(3, (boost.get(p.id) || 0) + 1));
    if (!source || w.rating > source.rating) source = w;
  }
  return { boost, source };
}

// ---------- 6. planned outfit vs weather ----------
const TEMP_SHIFT = 5; // °C: smaller changes are not worth an alert
const RAIN = /rain|shower|drizzle|thunder|storm/i;
function weatherShift(planned, current, pieces) {
  if (!planned || planned.tempC === null || planned.tempC === undefined || !current) return null;
  const diff = current.tempC - planned.tempC;
  const rainNow = RAIN.test(current.condition || '') && !RAIN.test(planned.condition || '');
  if (Math.abs(diff) < TEMP_SHIFT && !rainNow) return null;
  let piece = null; let advice;
  if (diff >= TEMP_SHIFT) {
    piece = pieces.find((p) => engine.isWarm(p)) || pieces.find((p) => p.category === 'Layer');
    advice = piece ? `Your planned ${label(piece)} may be too warm.` : 'Your planned outfit should still work; light fabrics help.';
  } else if (diff <= -TEMP_SHIFT) {
    const hasWarm = pieces.some((p) => p.category === 'Layer' || engine.isWarm(p));
    piece = hasWarm ? null : (pieces.find((p) => p.category === 'Extra' || p.category === 'Bag') || null);
    advice = hasWarm ? 'Your planned layer should keep you warm.' : 'Nothing in the planned outfit is warm. Want me to add a layer?';
  } else {
    piece = pieces.find((p) => ['Silk', 'Linen'].includes(p.fabric) && ['Shoes', 'Layer'].includes(p.category)) || null;
    advice = 'Rain is now expected. Consider a layer you can rely on.';
  }
  const dir = diff > 0 ? 'warmer' : 'cooler';
  return { diff, rainNow, itemId: piece ? piece.id : null, piece,
    message: rainNow && Math.abs(diff) < TEMP_SHIFT ? `${current.condition} is now expected (it was ${planned.condition || 'dry'} when you planned). ${advice}`
      : `It’s now expected to be ${current.tempC} °C instead of ${planned.tempC} °C — ${Math.abs(diff)} °C ${dir}. ${advice}` };
}

// ---------- 7. cost per wear (confirmed wears only) ----------
function costPerWear(p) {
  if (p.price === null || p.price === undefined || p.price === '') return { hasPrice: false, text: null };
  const price = Number(p.price);
  if (!p.wearCount) return { hasPrice: true, price, currency: p.currency || 'EGP', wears: 0, perWear: null, text: 'Cost per wear will appear after the first wear.' };
  const perWear = Math.round((price / p.wearCount) * 100) / 100;
  return { hasPrice: true, price, currency: p.currency || 'EGP', wears: p.wearCount, perWear, text: `${p.currency || 'EGP'} ${fmt(perWear)} per wear (${fmt(price)} ÷ ${p.wearCount} wears)` };
}
const fmt = (n) => (Math.round(n) === n ? n.toLocaleString('en-US') : n.toLocaleString('en-US', { maximumFractionDigits: 2 }));
function valueInsights(pieces) {
  const priced = pieces.filter((p) => p.price !== null && p.price !== undefined).map((p) => ({ piece: p, ...costPerWear(p) }));
  const worn = priced.filter((x) => x.perWear !== null && x.wears >= 3).sort((a, b) => a.perWear - b.perWear);
  const prices = priced.map((x) => x.price).sort((a, b) => a - b);
  const median = prices.length ? prices[Math.floor(prices.length / 2)] : 0;
  const under = priced.filter((x) => x.price >= median).sort((a, b) => (b.perWear ?? b.price) - (a.perWear ?? a.price));
  return { priced: priced.length, of: pieces.length, bestValue: worn.slice(0, 3), underused: under.slice(0, 3),
    note: priced.length < 5 ? 'Add prices to more pieces for a fuller picture — a few prices are not enough for strong conclusions.' : null };
}

// ---------- 8. wardrobe gaps with confidence ----------
// HIGH  = nothing (0) at a level the user dresses for most AND pieces in the other groups are waiting for it
// MEDIUM = only one piece, or a secondary level
// LOW   = nice to have; never HIGH when equivalent pieces exist one level away
const GROUP_CATS = { 'Tops & dresses': ['Top', 'Dress'], 'Bottoms & layers': ['Bottom', 'Layer'], Shoes: ['Shoes'] };
function gapConfidence(gap, pieces, prefs = {}, { eventsAtLevel = 0 } = {}) {
  const cats = GROUP_CATS[gap.group] || [];
  const others = Object.entries(GROUP_CATS).filter(([g]) => g !== gap.group).map(([, c]) => pieces.filter((p) => c.includes(p.category) && (p.dressCodes || []).includes(gap.level)).length);
  const blocked = others.reduce((t, n) => t * Math.max(1, n), 1);
  const nearby = pieces.filter((p) => cats.includes(p.category) && (p.dressCodes || []).some((l) => Math.abs(l - gap.level) === 1)).length;
  const main = gap.level === prefs.dressCode || eventsAtLevel >= 2;
  const reasons = [`${gap.count === 0 ? 'No' : 'Only one'} ${DRESS_CODES[gap.level].toLowerCase()} ${gap.group.toLowerCase()}`];
  others.forEach((n, i) => n && reasons.push(`${n} ${DRESS_CODES[gap.level].toLowerCase()} ${Object.keys(GROUP_CATS).filter((g) => g !== gap.group)[i].toLowerCase()} waiting for it`));
  if (eventsAtLevel) reasons.push(`${eventsAtLevel} upcoming or recent ${DRESS_CODES[gap.level].toLowerCase()} occasion${eventsAtLevel === 1 ? '' : 's'}`);
  if (nearby) reasons.push(`${nearby} piece${nearby === 1 ? '' : 's'} one level away can stand in`);
  let confidence = 'LOW';
  if (gap.count === 0 && main && nearby < 2) confidence = 'HIGH';
  else if (gap.count === 0 || (gap.count === 1 && main)) confidence = nearby >= 3 ? 'LOW' : 'MEDIUM';
  const priority = { HIGH: 'Essential', MEDIUM: 'Useful', LOW: 'Optional' }[confidence];
  return { ...gap, confidence, priority, limits: gap.count === 0 ? blocked : 0, reasons };
}

// ---------- 9. purchase impact (simulation — nothing is saved) ----------
// Every owned piece counts (a piece in the laundry still belongs to the wardrobe), except pieces
// being donated. Combinations are counted with the same engine and rule threshold as recommendations.
function purchaseImpact(pieces, want, { prefs = {}, similar = [], gaps = [] } = {}) {
  const owned = pieces.filter((p) => !p.rehome).map((p) => ({ ...p, status: 'Available', lastWornAt: null }));
  const hyp = { id: 'hypothetical', name: want.name || null, category: want.category, colour: want.colour, fabric: want.fabric || 'Cotton', season: want.season || 'All seasons',
    styles: want.styles || prefs.styles || [], dressCodes: want.dressCodes || [prefs.dressCode || 2], modest: true, status: 'Available', wearCount: 0, lastWornAt: null };
  // Distinct outfits = distinct sets of MAJOR garments (+ the new piece); accessory variations of the same
  // outfit are not counted again, so the number is honest rather than inflated.
  const keys = new Set(); const partners = new Set(); const occasions = [];
  const keyOf = (o) => o.filter((p) => p.id === hyp.id || engine.MAJOR_CATS.includes(p.category)).map((p) => p.id).sort().join('|');
  for (const level of hyp.dressCodes) {
    const pool = engine.filterPieces([...owned, hyp], { level, prefs: { ...prefs, repeatDays: 0 } });
    if (!pool.includes(hyp)) continue;
    const list = engine.combine(pool, { fixedId: hyp.id, cap: 8 }).filter((o) => engine.ruleScore(engine.criteria(o, { level, prefs })) >= 83);
    if (list.length) occasions.push(DRESS_CODES[level]);
    list.forEach((o) => { keys.add(keyOf(o)); o.forEach((p) => p.id !== hyp.id && partners.add(p.id)); });
  }
  const combos = keys.size;
  const accessory = ['Bag', 'Extra'].includes(hyp.category);
  const fills = gaps.find((g) => (GROUP_CATS[g.group] || []).includes(hyp.category) && hyp.dressCodes.includes(g.level));
  const versatility = hyp.dressCodes.length >= 3 ? 'High' : hyp.dressCodes.length === 2 ? 'Medium' : 'Low';
  let recommendation;
  const twin = similar.find((p) => (p.matched || []).includes('type') && (p.matched || []).includes('colour'));
  if (similar.length >= 2 || twin) recommendation = 'Probably unnecessary';
  else if (accessory) recommendation = combos > 0 ? 'Optional' : 'Low wardrobe impact'; // nice to have, never essential
  else if (fills && fills.confidence !== 'LOW' && combos >= 4) recommendation = 'Useful purchase';
  else if (combos >= 8 && similar.length === 0) recommendation = 'Useful purchase';
  else if (combos > 0) recommendation = 'Optional';
  else recommendation = 'Low wardrobe impact';
  return { simulated: true, newCombinations: combos, compatiblePieces: partners.size, occasions, similarOwned: similar.length, twin: twin ? { id: twin.id, name: twin.name } : null, versatility,
    fillsGap: fills ? { group: fills.group, level: fills.level, levelName: DRESS_CODES[fills.level], confidence: fills.confidence } : null, recommendation };
}

// ---------- 10. trip capsule ----------
// Minimum useful pieces → maximum outfits. One outfit per day, preferring pieces already in the case;
// a top/bottom/dress is worn at most twice (three times if laundry is available); a carry-on holds
// at most 8 clothing pieces and 2 pairs of shoes.
const LIMITS = { carryOn: { clothing: 8, shoes: 2, extras: 3 }, checked: { clothing: 14, shoes: 4, extras: 5 } };
function tripCapsule(pieces, days, { prefs = {}, carryOn = false, laundryAvailable = false, exclude = [] } = {}) {
  const limit = carryOn ? LIMITS.carryOn : LIMITS.checked;
  const maxWears = laundryAvailable ? 3 : 2;
  const avail = pieces.filter((p) => isAvailable(p) && !exclude.includes(p.id)).map((p) => ({ ...p, lastWornAt: null }));
  const bag = new Map();
  const kind = (p) => (p.category === 'Shoes' ? 'shoes' : ['Bag', 'Extra'].includes(p.category) ? 'extras' : 'clothing');
  const count = (k) => [...bag.keys()].filter((id) => kind(avail.find((p) => p.id === id)) === k).length;
  const plan = []; const missing = [];
  for (const d of days) {
    const worn = [...bag.entries()].filter(([id, n]) => kind(avail.find((p) => p.id === id)) === 'clothing' && n >= maxWears).map(([id]) => id);
    const r = engine.recommend(avail, { occasion: d.occasion, prefs: { ...prefs, repeatDays: 0 }, weather: d.weather, hiddenIds: worn, today: new Date(`${d.date}T12:00:00`) });
    const fits = (o) => { const extra = { clothing: 0, shoes: 0, extras: 0 }; o.itemIds.forEach((id) => { if (!bag.has(id)) extra[kind(avail.find((p) => p.id === id))] += 1; }); return Object.keys(extra).every((k) => count(k) + extra[k] <= limit[k]); };
    const ranked = [...r.outfits].sort((a, b) => b.itemIds.filter((id) => bag.has(id)).length - a.itemIds.filter((id) => bag.has(id)).length || b.ruleScore - a.ruleScore);
    const best = ranked.find(fits) || null;
    if (!best) { missing.push({ date: d.date, occasion: d.occasion, text: `No outfit for ${d.occasion.toLowerCase()} on ${d.date} fits the ${carryOn ? 'carry-on' : 'suitcase'} limit.` }); plan.push({ ...d, outfit: null }); continue; }
    best.itemIds.forEach((id) => bag.set(id, (bag.get(id) || 0) + 1));
    plan.push({ ...d, outfit: { itemIds: best.itemIds, title: best.title, ruleScore: best.ruleScore, compatibility: best.compatibility } });
  }
  const items = [...bag.keys()].map((id) => avail.find((p) => p.id === id));
  // How many complete, rule-passing outfits the packed pieces can make for the trip's occasions.
  const levels = [...new Set(days.map((d) => OCCASIONS[d.occasion] || 1))];
  const combos = new Set();
  for (const level of levels) {
    const pool = engine.filterPieces(items, { level, prefs: { ...prefs, repeatDays: 0 }, weather: days[0] && days[0].weather });
    engine.combine(pool, { weather: days[0] && days[0].weather, cap: 12 }).filter((o) => engine.ruleScore(engine.criteria(o, { level, prefs, weather: days[0] && days[0].weather })) >= 83)
      .forEach((o) => combos.add(o.map((p) => p.id).sort().join('|')));
  }
  return {
    days: plan, items, itemIds: items.map((p) => p.id), missing, luggage: carryOn ? 'carry-on' : 'checked bag', limit, maxWears,
    counts: { clothing: count('clothing'), shoes: count('shoes'), extras: count('extras'), pieces: items.length, outfits: plan.filter((d) => d.outfit).length, combinations: combos.size, days: days.length },
    reuse: items.filter((p) => bag.get(p.id) > 1).map((p) => ({ id: p.id, name: p.name, outfits: bag.get(p.id) })),
    fitsLimit: count('clothing') <= limit.clothing && count('shoes') <= limit.shoes,
  };
}

// ---------- 11. what moves the Wardrobe Health score ----------
function explainHealth(h) {
  if (!h || h.empty) return { raising: [], lowering: [], summary: 'Add pieces to get a score.' };
  const parts = h.parts.map((p) => ({ ...p, lost: p.max - p.points }));
  const raising = parts.filter((p) => p.points >= p.max * 0.75).sort((a, b) => b.points - a.points).map((p) => `${p.label}: ${p.detail} (${p.points}/${p.max})`);
  const lowering = [
    ...parts.filter((p) => p.lost > 0).sort((a, b) => b.lost - a.lost).map((p) => ({ pts: p.lost, text: `${p.label}: ${p.detail} (−${p.lost} of ${p.max})` })),
    ...h.penalties.filter((p) => p.points < 0).map((p) => ({ pts: -p.points, text: `${p.label}: ${p.detail} (${p.points})` })),
  ].sort((a, b) => b.pts - a.pts).map((x) => x.text);
  return { raising, lowering: lowering.slice(0, 3), summary: `${h.score}/100 (${h.grade}). Biggest effect: ${lowering[0] || 'nothing is pulling it down'}.` };
}

module.exports = {
  seasonFromWeather, seasonFromMonth, inSeason, forgottenCandidates, INACTIVITY_DAYS, NEW_PIECE_DAYS,
  seasonalRotation, SEASONAL_NOTE, laundryRisk, planDays, similarLook, repeatInsight, memoryMatches, memorySignals,
  weatherShift, TEMP_SHIFT, costPerWear, valueInsights, gapConfidence, purchaseImpact, tripCapsule, LIMITS, explainHealth,
};
