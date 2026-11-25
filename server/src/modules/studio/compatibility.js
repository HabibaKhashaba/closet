// CompatibilityService (v3.0 foundation): ONE place that scores and enumerates outfits for every
// v3.0 feature. It wraps the existing Recommendation Engine (engine.criteria / breakdown / filterPieces)
// so all numbers shown to the user come from the same rules as Style me and Mix & Match.
// Works on a "virtual" closet (real pieces + temporary pieces − removed pieces) without touching the database.
const engine = require('../recommendation/engine');
const { OCCASIONS, DRESS_CODES } = require('../../shared/vocabulary');
const { isOwned } = require('../../shared/lifecycle');

const VALID_SCORE = 83; // a look is "valid" with at most one soft criterion failing (rule score 100 or 83)
const levelFor = (c = {}) => c.level || OCCASIONS[c.occasion] || 1;
const MAIN = ['Top', 'Dress', 'Bottom', 'Layer', 'Shoes'];

// virtual closet: never written anywhere
function virtualCloset(pieces, { add = [], remove = [] } = {}) {
  const gone = new Set(remove);
  return [...pieces.filter((p) => !gone.has(p.id)), ...add.map((p, i) => ({ status: 'Available', styles: [], dressCodes: [1], modest: false, wearCount: 0, ...p, id: p.id || `virtual-${i + 1}`, virtual: true }))];
}

// scoreOutfit(items) → { score, compatibility, reasons, criteria }
function scoreOutfit(items, c = {}) {
  const level = levelFor(c);
  const ctx = { level, prefs: c.prefs || {}, weather: c.weather, style: c.style };
  const crit = engine.criteria(items, ctx);
  const b = engine.breakdown(items, ctx);
  return { score: engine.ruleScore(crit), compatibility: b.compatibility, parts: b, criteria: crit, reasons: crit.filter((x) => x.pass).map((x) => `${x.name}: ${x.detail}`), problems: crit.filter((x) => !x.pass).map((x) => `${x.name}: ${x.detail}`), level, levelName: DRESS_CODES[level] };
}

// all complete outfits from Available pieces that satisfy the constraints
// constraints: occasion | level, weather, prefs (modest, styles), locked ids, excluded ids, threshold, cap
function enumerateOutfits(pieces, c = {}) {
  const level = levelFor(c);
  const prefs = c.prefs || {};
  const excluded = new Set(c.excluded || []);
  let pool = engine.filterPieces(pieces.filter((p) => !excluded.has(p.id) && isOwned(p)), { level, prefs: { ...prefs, repeatDays: 0 }, weather: c.weather, hiddenIds: [] });
  const locked = (c.locked || []).map((id) => pieces.find((p) => p.id === id)).filter((p) => p && p.status === 'Available');
  for (const l of locked) if (!pool.includes(l)) pool.push(l);
  const cap = c.cap || 40;
  const lockedSet = new Set(locked.map((l) => l.id));
  const rank = c.rankPiece || (() => 0);
  let combos = engine.combine(pool, { weather: c.weather, cap, rankPiece: (p) => (lockedSet.has(p.id) ? 1e6 : 0) + rank(p) }); // a locked piece is never cut by the cap
  if (locked.length) combos = combos.filter((o) => locked.every((l) => o.some((p) => p.id === l.id)));
  const threshold = c.threshold ?? VALID_SCORE;
  const seen = new Set();
  const out = [];
  for (const o of combos) {
    const s = scoreOutfit(o, { ...c, level });
    if (s.score < threshold) continue;
    const key = o.filter((p) => MAIN.includes(p.category)).map((p) => p.id).sort().join('+'); // accessories do not make a new outfit
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ pieces: o, itemIds: o.map((p) => p.id), ...s });
  }
  return out.sort((a, b) => b.score - a.score || b.compatibility - a.compatibility);
}

// countValidOutfits(items, constraints, groupBy = occasion) → { total, byOccasion: { University: n, … } }
function countValidOutfits(pieces, c = {}, occasions) {
  const list = occasions || [...new Set([...(c.prefs && c.prefs.occasions) || [], 'Everyday', 'Work', 'Dinner'])];
  const byOccasion = {};
  const all = new Set();
  for (const occ of list) {
    const looks = enumerateOutfits(pieces, { ...c, occasion: occ, level: undefined });
    byOccasion[occ] = looks.length;
    looks.forEach((l) => all.add(l.pieces.filter((p) => MAIN.includes(p.category)).map((p) => p.id).sort().join('+')));
  }
  return { total: all.size, byOccasion };
}

// the outfits that use one piece (for "unlocks N outfits")
const outfitsWith = (looks, id) => looks.filter((l) => l.itemIds.includes(id));

module.exports = { VALID_SCORE, virtualCloset, scoreOutfit, enumerateOutfits, countValidOutfits, outfitsWith, levelFor, MAIN };
