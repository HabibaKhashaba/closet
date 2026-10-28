// Recommendation Engine (Pipe & Filter): filter → combine → score → explain.
// Pure functions only, so every rule can be unit tested. The scorer is a Strategy:
// a learned scorer can replace ruleScorer later without changing the callers.
const { isLeaving } = require('../../shared/lifecycle');
const { DRESS_CODES, OCCASIONS } = require('../../shared/vocabulary');

const NEUTRALS = ['Black', 'White', 'Grey', 'Beige', 'Navy', 'Brown'];
const CLASHES = [['Red', 'Pink'], ['Red', 'Orange'], ['Orange', 'Pink'], ['Red', 'Green'], ['Purple', 'Yellow']];
const HOT = 26; // ≥ 26 °C: no warm pieces (US-20)
const COLD = 19; // < 19 °C: a warm layer is needed (US-20)
const SLOT_NAMES = ['Top or dress', 'Bottom or layer', 'Shoes', 'Extra'];

const isWarm = (p) => ['Wool', 'Knit'].includes(p.fabric) || p.season === 'Winter';
const isMain = (p) => ['Top', 'Dress', 'Bottom', 'Shoes'].includes(p.category);
const isAccent = (p) => p.category === 'Extra' || p.category === 'Bag';
const DAY = 86400000;
const levelOf = (occasion, level) => level || OCCASIONS[occasion] || 1;

// ---------- 1. filter ----------
function filterPieces(pieces, { level, prefs = {}, weather, hiddenIds = [], today = new Date() }) {
  const hidden = new Set(hiddenIds);
  const repeat = prefs.repeatDays || 0; // recycle time: do not repeat a piece worn in the last N days
  return pieces.filter((p) => {
    if (p.status !== 'Available') return false; // US-17: never an unavailable piece
    if (isLeaving(p)) return false; // ready to donate: the user decided it is leaving
    if (hidden.has(p.id)) return false; // US-61: hidden for 7 days
    if (prefs.modest && !p.modest) return false; // US-21: modest respected
    if ((isMain(p) || isAccent(p)) && !p.dressCodes.includes(level)) return false; // US-21: suits the dress code
    if (p.category === 'Layer' && !p.dressCodes.some((l) => l === level || l === level - 1)) return false; // no denim jacket over a formal dress
    // Recycle time: clothes worn in the last N days wait (shoes, bags and accessories repeat freely).
    if (repeat && ['Top', 'Dress', 'Bottom'].includes(p.category) && p.lastWornAt && (today - new Date(p.lastWornAt)) / DAY < repeat) return false;
    if (weather && weather.tempC >= HOT && isWarm(p)) return false; // US-20: no wool at 29°
    return true;
  });
}

// ---------- 2. combine ----------
function bySlot(pieces) {
  const g = (c) => pieces.filter((p) => c.includes(p.category));
  return { tops: g(['Top']), dresses: g(['Dress']), bottoms: g(['Bottom']), layers: g(['Layer']), shoes: g(['Shoes']), extras: g(['Extra', 'Bag']) };
}

function combine(pieces, { weather, fixedId, cap = 10, rankPiece = () => 0 }) {
  const s = bySlot(pieces);
  const top = (list) => [...list].sort((a, b) => rankPiece(b) - rankPiece(a) || String(a.name).localeCompare(String(b.name)) || a.id.localeCompare(b.id)).slice(0, cap);
  const needLayer = weather && weather.tempC < COLD;
  const fixed = fixedId && pieces.find((p) => p.id === fixedId);
  const pick = (list) => (fixed && list.some((p) => p.id === fixed.id) ? [fixed] : top(list));
  const out = [];
  const shoes = pick(s.shoes);
  const extras = [null, ...pick(s.extras)];
  const layers = pick(s.layers);
  for (const t of pick(s.tops)) {
    for (const b of pick(s.bottoms)) {
      for (const sh of shoes) {
        const fourth = needLayer || (fixed && fixed.category === 'Layer') ? layers : extras;
        for (const x of fourth.length ? fourth : [null]) out.push([t, b, sh, x].filter(Boolean));
      }
    }
  }
  for (const d of pick(s.dresses)) {
    for (const l of needLayer ? layers : [null, ...layers]) {
      for (const sh of shoes) {
        for (const x of extras) out.push([d, l, sh, x].filter(Boolean));
      }
    }
  }
  return fixed ? out.filter((o) => o.some((p) => p.id === fixed.id)) : out;
}

// ---------- 3. score (Strategy: rule-based scorer) ----------
function criteria(outfit, { level, prefs = {}, weather, style }) {
  const main = outfit.filter(isMain);
  const has = (c) => outfit.some((p) => c.includes(p.category));
  const complete = has(['Shoes']) && (has(['Dress']) || (has(['Top']) && has(['Bottom'])));
  const accents = [...new Set(outfit.map((p) => p.colour).filter((c) => !NEUTRALS.includes(c)))];
  const clash = CLASHES.find(([a, b]) => accents.includes(a) && accents.includes(b)) || (accents.includes('Multicolour') && accents.length > 1 ? ['Multicolour', accents.find((c) => c !== 'Multicolour')] : null);
  const colourOk = accents.length <= 2 && !clash;
  const codeOk = main.every((p) => p.dressCodes.includes(level));
  let weatherOk = true;
  let weatherWhy = 'no forecast';
  if (weather) {
    const warmPieces = outfit.filter(isWarm);
    if (weather.tempC >= HOT && warmPieces.length) { weatherOk = false; weatherWhy = `${warmPieces[0].colour.toLowerCase()} ${warmPieces[0].fabric ? warmPieces[0].fabric.toLowerCase() : 'winter piece'} is too warm for ${weather.tempC} °C`; }
    else if (weather.tempC < COLD && !outfit.some((p) => p.category === 'Layer' || isWarm(p))) { weatherOk = false; weatherWhy = `it is ${weather.tempC} °C and nothing in it is warm`; }
    else weatherWhy = `fits ${weather.tempC} °C`;
  }
  const target = style ? [style] : (prefs.styles || []);
  const styled = main.filter((p) => !target.length || p.styles.some((x) => target.includes(x))).length;
  const styleOk = (!target.length || styled >= Math.min(2, main.length)) && (!prefs.modest || outfit.every((p) => p.modest));
  return [
    { name: 'Complete outfit', pass: complete, detail: complete ? 'top or dress, bottom, shoes' : 'needs a top and bottom (or a dress) and shoes' },
    { name: 'Colour harmony', pass: colourOk, detail: clash ? `${clash[0].toLowerCase()} and ${clash[1].toLowerCase()} clash` : accents.length > 2 ? `${accents.length} accent colours, the limit is 2` : accents.length ? `neutrals with ${accents.join(' and ').toLowerCase()}` : 'all neutral colours' },
    { name: 'Dress code', pass: codeOk, detail: codeOk ? `every main piece suits ${DRESS_CODES[level]}` : `${main.find((p) => !p.dressCodes.includes(level)).colour.toLowerCase()} ${main.find((p) => !p.dressCodes.includes(level)).category.toLowerCase()} is not ${DRESS_CODES[level]}` },
    { name: 'Weather fit', pass: weatherOk, detail: weatherWhy },
    { name: 'Style consistency', pass: styleOk, detail: !styleOk && prefs.modest && !outfit.every((p) => p.modest) ? 'one piece is not modest' : styleOk ? (target.length ? `${target.join(' / ').toLowerCase()} pieces` : 'no style preference set') : `only ${styled} piece matches ${target.join(' / ').toLowerCase()}` },
  ];
}

// Rule score = 100 − 17 per failed criterion (requirements §3.1). Always labelled "rule score".
const ruleScore = (crit) => 100 - 17 * crit.filter((c) => !c.pass).length;

function mismatchSentence(crit) {
  const f = crit.find((c) => !c.pass);
  return f ? `${f.name}: ${f.detail}.` : 'Every criterion passes.';
}

// Ranking adds personal taste on top of the rule score (it never changes the rule score itself).
function makeRanker({ prefs = {}, style, today = new Date(), signals, level }) {
  const daysSince = (d) => (d ? (today - new Date(d)) / 86400000 : null);
  return (p) => {
    let r = 0;
    if ((prefs.colours || []).includes(p.colour)) r += 4;
    if (style ? p.styles.includes(style) : p.styles.some((x) => (prefs.styles || []).includes(x))) r += 3;
    const since = daysSince(p.lastWornAt);
    if (since !== null && since < 3) r -= 8; // worn very recently
    if (p.wearCount > 0 && since !== null && since >= 40) r += 6; // a forgotten piece gets a chance
    if (signals && level) { // learned from rejections (US-60): lean more relaxed or sharper
      const rc = signals.rejectCounts || {};
      if ((rc['Too formal'] || 0) >= 2 && p.dressCodes.some((l) => l < level)) r += 2;
      if ((rc['Too casual'] || 0) >= 2 && p.dressCodes.some((l) => l > level)) r += 2;
    }
    if (signals && (signals.favouriteIds || []).includes(p.id)) r += 1;
    // Outfit memory (bounded at +3 by insights.memorySignals): pieces from highly rated looks in a similar context.
    if (signals && signals.memoryBoost && typeof signals.memoryBoost.get === 'function') r += signals.memoryBoost.get(p.id) || 0;
    // Learned from deletions (US-34): styles the user confirmed they let go of rank lower.
    if ((prefs.avoidStyles || []).length && (p.styles || []).some((x) => prefs.avoidStyles.includes(x))) r -= 3;
    return r;
  };
}

// ---------- 4. explain ----------
function explain(outfit, crit, { level, occasion, weather, prefs = {}, today = new Date() }) {
  const reasons = [];
  const name = (p) => (p.name ? p.name.toLowerCase() : `${p.colour.toLowerCase()} ${p.category === 'Extra' ? 'accessory' : p.category.toLowerCase()}`);
  reasons.push(`Every piece suits ${DRESS_CODES[level]}${occasion ? ` for ${occasion.toLowerCase()}` : ''}.`);
  if (weather) {
    const layer = outfit.find((p) => p.category === 'Layer');
    if (weather.tempC < COLD && layer) reasons.push(`The ${name(layer)} keeps you warm at ${weather.tempC} °C.`);
    else if (weather.tempC >= HOT) reasons.push(`Light pieces only: it will be ${weather.tempC} °C.`);
    else reasons.push(`Comfortable for ${weather.tempC} °C.`);
  }
  reasons.push(`Colours: ${crit[1].detail}.`);
  const fav = outfit.find((p) => (prefs.colours || []).includes(p.colour));
  if (fav) reasons.push(`Uses ${fav.colour.toLowerCase()}, one of your favourite colours.`);
  const forgotten = outfit.find((p) => p.wearCount > 0 && p.lastWornAt && (today - new Date(p.lastWornAt)) / 86400000 >= 40);
  if (forgotten) reasons.push(`Brings back your ${name(forgotten)}, not worn for ${Math.floor((today - new Date(forgotten.lastWornAt)) / 86400000)} days.`);
  if (prefs.modest) reasons.push('Modest: covered shoulders and longer hemlines.');
  return reasons.slice(0, 5);
}

// Explainable recommendation (US-57, version 1.3): every factor that shaped the look, in plain words.
// Each factor is a fact the engine actually used (filter, rule or ranker) — nothing is invented.
// ctx.signals (optional) = { favouriteIds, rejectCounts: { 'Too formal': n, … }, total, availableCount }
function why(outfit, crit, { level, occasion, weather, prefs = {}, style, today = new Date(), signals = {} }) {
  const name = (p) => (p.name ? p.name.toLowerCase() : `${p.colour.toLowerCase()} ${p.category === 'Extra' ? 'accessory' : p.category.toLowerCase()}`);
  const f = [];
  const main = outfit.filter(isMain);
  f.push({ factor: 'Occasion', text: `${occasion || 'Everyday'} calls for ${DRESS_CODES[level]}; ${crit[2].pass ? 'every main piece is tagged for it' : crit[2].detail}.` });
  const target = style ? [style] : (prefs.styles || []);
  const styled = main.find((p) => p.styles.some((x) => target.includes(x)));
  if (target.length && styled) f.push({ factor: 'Style', text: `The ${name(styled)} matches your ${styled.styles.find((x) => target.includes(x)).toLowerCase()} preference.` });
  if (prefs.modest) f.push({ factor: 'Modesty', text: 'Every piece is marked modest, as your profile asks.' });
  if (weather) {
    const layer = outfit.find((p) => p.category === 'Layer');
    const where = weather.place ? ` in ${weather.place}` : '';
    let t;
    if (weather.tempC < COLD) t = layer ? `The ${name(layer)} adds warmth for ${weather.tempC} °C${where}.` : `${weather.tempC} °C${where}: ${crit[3].detail}.`;
    else if (weather.tempC >= HOT) t = `Only light fabrics: ${weather.tempC} °C${where}.`;
    else t = `${weather.tempC} °C${where}${weather.condition ? `, ${weather.condition.toLowerCase()}` : ''}${layer ? ` — the ${name(layer)} is an easy light layer` : ''}.`;
    f.push({ factor: 'Weather', text: t });
  }
  if (signals.total) {
    const away = signals.total - (signals.availableCount ?? signals.total);
    f.push({ factor: 'Availability', text: away > 0 ? `Built only from Available pieces; ${away} piece${away === 1 ? ' is' : 's are'} in the laundry, lent or packed.` : 'Built only from Available pieces.' });
  }
  const forgotten = outfit.find((p) => p.wearCount > 0 && p.lastWornAt && (today - new Date(p.lastWornAt)) / DAY >= 40);
  if (forgotten) f.push({ factor: 'Wear history', text: `Brings back your ${name(forgotten)}, not worn for ${Math.floor((today - new Date(forgotten.lastWornAt)) / DAY)} days.` });
  else if (prefs.repeatDays) f.push({ factor: 'Wear history', text: `Nothing worn in the last ${prefs.repeatDays} days (your recycle time).` });
  const favIds = new Set(signals.favouriteIds || []);
  const fav = outfit.find((p) => favIds.has(p.id));
  const favColour = outfit.find((p) => (prefs.colours || []).includes(p.colour));
  if (fav) f.push({ factor: 'Favourites', text: `The ${name(fav)} is in one of your favourite looks.` });
  else if (favColour) f.push({ factor: 'Favourites', text: `Uses ${favColour.colour.toLowerCase()}, one of your favourite colours.` });
  const mem = signals.memorySource;
  if (mem && mem.pieces && outfit.filter((p) => mem.pieces.some((q) => q.id === p.id)).length >= 2) {
    f.push({ factor: 'Outfit memory', text: `You rated a similar look ${mem.rating}/5${mem.eventTitle ? ` at “${mem.eventTitle}”` : mem.occasion ? ` for ${mem.occasion.toLowerCase()}` : ''}${mem.weather ? ` (${mem.weather.tempC} °C)` : ''}.` });
  }
  const rc = signals.rejectCounts || {};
  if ((rc['Too formal'] || 0) >= 2 && level <= 3) f.push({ factor: 'Your feedback', text: `You rejected ${rc['Too formal']} looks as too formal, so relaxed pieces rank higher.` });
  else if ((rc['Too casual'] || 0) >= 2) f.push({ factor: 'Your feedback', text: `You rejected ${rc['Too casual']} looks as too casual, so sharper pieces rank higher.` });
  else if ((rc['Don’t like these colours'] || 0) >= 2) f.push({ factor: 'Your feedback', text: 'You rejected some colour mixes, so this look keeps colours simple.' });
  else if ((prefs.avoidStyles || []).length && !outfit.some((p) => (p.styles || []).some((x) => prefs.avoidStyles.includes(x)))) f.push({ factor: 'Your feedback', text: `It leaves out ${prefs.avoidStyles.join(' and ').toLowerCase()} pieces, which you let go of.` });
  return f;
}
// One sentence for the card: "Recommended because …" built from the three most specific factors.
function explanationSentence(factors) {
  const order = ['Style', 'Modesty', 'Weather', 'Outfit memory', 'Wear history', 'Your feedback', 'Favourites', 'Occasion', 'Availability'];
  const picked = order.map((k) => factors.find((x) => x.factor === k)).filter(Boolean).slice(0, 3);
  const low = (t) => t.replace(/\.$/, '').replace(/^([A-Z])(?![A-Z0-9])/, (m) => m.toLowerCase());
  return picked.length ? `Recommended because ${picked.map((x) => low(x.text)).join('; ')}.` : 'Recommended for this occasion.';
}

// Mix & Match breakdown: the same criteria, graded 0–100 so the user sees how close a look is.
function breakdown(outfit, { level, prefs = {}, weather, style }) {
  const main = outfit.filter(isMain);
  const accents = [...new Set(outfit.map((p) => p.colour).filter((c) => !NEUTRALS.includes(c)))];
  const clash = CLASHES.some(([a, b]) => accents.includes(a) && accents.includes(b));
  const colour = clash ? 40 : accents.length > 2 ? 55 : accents.length === 2 ? 88 : accents.length === 1 ? 96 : 92;
  const fit = (p) => (p.dressCodes.includes(level) ? 1 : p.dressCodes.some((l) => Math.abs(l - level) === 1) ? 0.5 : 0);
  const formality = main.length ? Math.round((main.reduce((t, p) => t + fit(p), 0) / main.length) * 100) : 0;
  const target = style ? [style] : (prefs.styles || []);
  const styleScore = !main.length ? 0 : !target.length ? 85 : Math.round((main.filter((p) => p.styles.some((x) => target.includes(x))).length / main.length) * 100);
  let weatherScore = 80;
  if (weather) {
    const warm = outfit.filter(isWarm).length;
    if (weather.tempC >= HOT) weatherScore = warm ? Math.max(30, 90 - warm * 30) : 98;
    else if (weather.tempC < COLD) weatherScore = outfit.some((p) => p.category === 'Layer' || isWarm(p)) ? 96 : 45;
    else weatherScore = 95;
  }
  const parts = { colour, style: styleScore, formality, weather: weatherScore };
  return { ...parts, compatibility: Math.round((colour + styleScore + formality + weatherScore) / 4) };
}

const LEVEL_WORD = { 1: 'Easy', 2: 'Polished', 3: 'Sharp', 4: 'Evening', 5: 'Formal' };
function outfitTitle(outfit, level) {
  const key = outfit.find((p) => p.category === 'Dress') || outfit.find((p) => p.category === 'Layer') || outfit.find((p) => p.category === 'Top') || outfit[0];
  if (!key) return 'New look';
  const words = (key.name || `${key.colour} ${key.category}`).split(/\s+/).slice(-2).map((w) => w[0].toUpperCase() + w.slice(1));
  return `${LEVEL_WORD[level] || 'Everyday'} ${words.join(' ')}`;
}

// Editorial names for the three looks: each look gets its own name (never two alike), from the
// occasion, the look's main style and the piece that makes it different from the other looks.
const OCC_WORD = { University: 'Campus', Work: 'Office', Dinner: 'Dinner', Wedding: 'Celebration', 'Casual outing': 'Weekend', 'Formal event': 'Gala', Travel: 'Travel', Gym: 'Active', Interview: 'Interview', Everyday: 'Everyday', 'Date night': 'Date-Night', Party: 'Party' };
const STYLE_WORD = { Classic: 'Classic', Minimal: 'Clean', Chic: 'Soft', Elegant: 'Refined', Casual: 'Relaxed', Sporty: 'Sport', Streetwear: 'Street', Comfortable: 'Easy', Bold: 'Bold' };
const NOUNS = [[/blazer|suit/i, 'Tailoring'], [/trench/i, 'Trench'], [/cardigan|knit|sweater/i, 'Knit'], [/denim|jean/i, 'Denim'], [/linen/i, 'Linen'],
  [/silk|satin|cami/i, 'Silk'], [/strip|breton/i, 'Stripes'], [/wrap/i, 'Wrap'], [/pleat/i, 'Pleats'], [/midi/i, 'Midi'], [/oxford/i, 'Oxford'], [/leather/i, 'Leather'], [/boot/i, 'Boots'], [/wide/i, 'Wide-Leg']];
const ORDER = { Layer: 0, Dress: 1, Top: 2, Bottom: 3, Shoes: 4, Bag: 5, Extra: 6 };
const nounOf = (p) => { const hit = NOUNS.find(([re]) => re.test(`${p.name || ''} ${p.fabric || ''}`)); return hit ? hit[1] : ({ Layer: 'Layers', Dress: 'Dress', Top: 'Top', Bottom: 'Separates', Shoes: 'Steps', Bag: 'Carry', Extra: 'Details' })[p.category]; };
function lookNames(looks, { occasion, level }) {
  const used = new Set(); const seen = new Set();
  return looks.map((pieces, i) => {
    const byWeight = [...pieces].sort((a, b) => ORDER[a.category] - ORDER[b.category]);
    const own = byWeight.filter((p) => !seen.has(p.id));
    pieces.forEach((p) => seen.add(p.id));
    const nouns = [...new Set([...own, ...byWeight].map(nounOf))];
    const counts = {}; pieces.forEach((p) => (p.styles || []).forEach((x) => { counts[x] = (counts[x] || 0) + 1; }));
    const styles = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).map((x) => STYLE_WORD[x]).filter(Boolean);
    const adjs = [[OCC_WORD[occasion] || LEVEL_WORD[level] || 'Everyday', ...styles], [...styles, OCC_WORD[occasion] || 'Everyday'], [...styles.slice(1), ...styles, LEVEL_WORD[level] || 'Easy']][i % 3];
    const options = [];
    for (const n of nouns) for (const a of adjs) if (a !== n) options.push(`${a} ${n}`);
    adjs.forEach((a) => styles.forEach((b) => a !== b && options.push(`${a} ${b}`)));
    const name = options.find((o) => !used.has(o)) || `${outfitTitle(pieces, level)} ${i + 1}`;
    used.add(name); return name;
  });
}

const explained = (pieces, crit, ctx) => { const w = why(pieces, crit, ctx); return { why: w, explanation: explanationSentence(w) }; };

// ---------- 5. diversity-aware selection (US-19, Milestone 2 fix) ----------
// Three looks must read as three styling directions, not one look with a different accessory.
// Major garments (top, dress, bottom, layer, shoes) weigh 1; a bag or accessory weighs 0.5.
// The piece the user asked to style (fixedId) is in every look by design and is not counted.
const MAJOR_CATS = ['Top', 'Dress', 'Bottom', 'Layer', 'Shoes'];
const isMajor = (p) => MAJOR_CATS.includes(p.category);
const DIVERSITY_WEIGHT = 6; // rank points lost per shared garment (a failed rule costs 17)
function sharedMajor(a, b, fixedId) {
  return a.filter((p) => isMajor(p) && p.id !== fixedId && b.some((q) => q.id === p.id)).length;
}
function weightedOverlap(a, b, fixedId) {
  return a.filter((p) => p.id !== fixedId && b.some((q) => q.id === p.id)).reduce((t, p) => t + (isMajor(p) ? 1 : 0.5), 0);
}
const silhouette = (o) => (o.some((p) => p.category === 'Dress') ? 'dress' : 'separates');
// Greedy: the best look first, then the look that maximises rank − weight × overlap with the looks
// already chosen. Tier 1 allows at most ONE shared major garment between any two looks and keeps
// quality within one failed criterion of the best look; later tiers relax only when the closet is small.
function pickDiverse(scored, { fixedId, n = 3 } = {}) {
  if (!scored.length) return [];
  const bestRule = Math.max(...scored.map((o) => o.rule));
  const tiers = [{ max: 1, minRule: bestRule - 17 }, { max: 2, minRule: bestRule - 17 }, { max: 3, minRule: 0 }, { max: 4, minRule: 0 }];
  for (const tier of tiers) {
    const chosen = [scored[0]];
    while (chosen.length < n) {
      let best = null; let bestVal = -Infinity;
      for (const o of scored) {
        if (chosen.includes(o) || o.rule < tier.minRule) continue;
        if (chosen.some((c) => sharedMajor(o.pieces, c.pieces, fixedId) > tier.max)) continue;
        if (chosen.some((c) => c.pieces.length === o.pieces.length && c.pieces.every((p) => o.pieces.includes(p)))) continue;
        const overlap = chosen.reduce((t, c) => t + weightedOverlap(o.pieces, c.pieces, fixedId), 0);
        const newShape = chosen.every((c) => silhouette(c.pieces) !== silhouette(o.pieces)) ? 3 : 0;
        const val = o.rank - DIVERSITY_WEIGHT * overlap + newShape;
        if (val > bestVal) { bestVal = val; best = o; }
      }
      if (!best) break;
      chosen.push(best);
    }
    if (chosen.length === n || tier.max === 4) return chosen;
  }
  return [scored[0]];
}

// ---------- the pipeline ----------
function recommend(pieces, opts) {
  const level = levelOf(opts.occasion, opts.level);
  const ctx = { ...opts, level };
  const pool = filterPieces(pieces, ctx);
  // "Style this piece" (US-59): the chosen piece is in every look, even if the weather or the
  // recycle time would normally leave it out — it still has to be Available.
  const fixed = opts.fixedId && pieces.find((p) => p.id === opts.fixedId);
  if (fixed && fixed.status === 'Available' && !pool.includes(fixed)) pool.push(fixed);
  if (opts.fixedId && (!fixed || fixed.status !== 'Available')) return { level, levelName: DRESS_CODES[level], outfits: [], note: 'This piece is not Available right now.', poolSize: pool.length };
  const rank = makeRanker(ctx);
  const combos = combine(pool, { weather: opts.weather, fixedId: opts.fixedId, rankPiece: rank });
  const scored = combos
    .filter((o) => !(opts.rejectedLooks || []).some((ids) => ids.length === o.length && o.every((p) => ids.includes(p.id))))
    // a finished look (with a bag or accessory) ranks a little higher than the same look without one
    .map((o) => { const crit = criteria(o, ctx); return { pieces: o, crit, rule: ruleScore(crit), rank: ruleScore(crit) + o.reduce((t, p) => t + rank(p), 0) + (o.some(isAccent) ? 2 : 0) }; })
    .sort((a, b) => b.rank - a.rank || a.pieces.map((p) => p.name).join().localeCompare(b.pieces.map((p) => p.name).join()) || a.pieces.map((p) => p.id).join().localeCompare(b.pieces.map((p) => p.id).join()));
  const chosen = pickDiverse(scored, { fixedId: opts.fixedId });
  const names = lookNames(chosen.map((o) => o.pieces), ctx);
  const outfits = chosen.map((o, i) => ({
    itemIds: o.pieces.map((p) => p.id),
    title: names[i],
    ruleScore: o.rule,
    ...breakdown(o.pieces, ctx),
    criteria: o.crit,
    reasons: explain(o.pieces, o.crit, ctx),
    ...explained(o.pieces, o.crit, ctx),
  }));
  let note = null;
  if (!outfits.length) note = `Not enough Available pieces for ${DRESS_CODES[level]}${opts.weather ? ` at ${opts.weather.tempC} °C` : ''}. Add pieces or bring some back from the laundry.`;
  return { level, levelName: DRESS_CODES[level], outfits, note, poolSize: pool.length };
}

// Change one piece (US-24): keep the others, find the best Available alternatives for that slot.
function swap(pieces, currentIds, slotIndex, opts) {
  const level = levelOf(opts.occasion, opts.level);
  const ctx = { ...opts, level };
  const current = currentIds.map((id) => pieces.find((p) => p.id === id)).filter(Boolean);
  const old = current[slotIndex];
  if (!old) return { outfit: null, alternatives: [] };
  const sameSlot = (p) => (old.category === 'Top' || old.category === 'Dress' ? p.category === old.category : p.category === old.category);
  const fits = (c) => filterPieces(pieces, c).filter((p) => sameSlot(p) && p.id !== old.id && !currentIds.includes(p.id));
  // Exact dress code first; if that leaves fewer than 3, pieces one level away are offered too
  // (their lower formality score shows in the new match %).
  let pool = fits(ctx);
  if (pool.length < 3) for (const l of [level + 1, level - 1]) if (l >= 1 && l <= 5) pool = [...pool, ...fits({ ...ctx, level: l }).filter((p) => !pool.includes(p))];
  const rank = makeRanker(ctx);
  const options = pool.map((p) => {
    const o = current.map((c, i) => (i === slotIndex ? p : c));
    const crit = criteria(o, ctx);
    return { piece: p, pieces: o, crit, rule: ruleScore(crit), rank: ruleScore(crit) + rank(p) };
  }).sort((a, b) => b.rank - a.rank || String(a.piece.name).localeCompare(String(b.piece.name)) || a.piece.id.localeCompare(b.piece.id));
  const toOutfit = (o) => ({ itemIds: o.pieces.map((p) => p.id), title: outfitTitle(o.pieces, level), ruleScore: o.rule, ...breakdown(o.pieces, ctx), criteria: o.crit, reasons: explain(o.pieces, o.crit, ctx), ...explained(o.pieces, o.crit, ctx) });
  return { outfit: options[0] ? toOutfit(options[0]) : null, alternatives: options.slice(0, 4).map((o) => ({ itemId: o.piece.id, ruleScore: o.rule })),
    options: options.slice(0, 3).map((o) => ({ itemId: o.piece.id, outfit: toOutfit(o) })) };
}

// Outfit builder check (US-42, US-43, US-66): pass/fail per criterion, rule score, one sentence.
function check(outfit, opts) {
  const level = levelOf(opts.occasion, opts.level);
  const crit = criteria(outfit, { ...opts, level });
  const ctx = { ...opts, level };
  const b = breakdown(outfit, ctx);
  return {
    level, levelName: DRESS_CODES[level], title: outfitTitle(outfit, level), criteria: crit, ruleScore: ruleScore(crit), ...b,
    sentence: mismatchSentence(crit), explanation: explainMix(outfit, crit, b, ctx), unavailable: outfit.filter((p) => p.status !== 'Available').map((p) => p.id),
  };
}

// One short paragraph for Mix & Match: what works, then what to fix.
function explainMix(outfit, crit, b, { level, weather }) {
  if (!outfit.length) return 'Pick pieces to see how well they work together.';
  const good = [];
  if (crit[1].pass) good.push(`the colours work (${crit[1].detail})`);
  if (crit[2].pass) good.push(`every main piece suits ${DRESS_CODES[level]}`);
  if (weather && crit[3].pass) good.push(`it ${crit[3].detail}`);
  const bad = crit.filter((c) => !c.pass).map((c) => `${c.name.toLowerCase()}: ${c.detail}`);
  const first = good.length ? `${good[0][0].toUpperCase()}${good.slice(0, 3).join(', ').slice(1)}.` : '';
  return `${first}${bad.length ? `${first ? ' ' : ''}To improve: ${bad.join('; ')}.` : ' A strong, complete look.'}`.trim();
}

module.exports = { pickDiverse, sharedMajor, weightedOverlap, MAJOR_CATS, lookNames, why, explanationSentence, recommend, swap, check, filterPieces, combine, criteria, ruleScore, explain, mismatchSentence, makeRanker, breakdown, outfitTitle, explainMix, isWarm, HOT, COLD, NEUTRALS, SLOT_NAMES };
