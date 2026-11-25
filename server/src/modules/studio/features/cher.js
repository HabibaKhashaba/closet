// Feature 2 — Cher mode ("Spin for me" inside Mix & Match), after the rotating wardrobe in Clueless.
// The server picks ONE look by weighted random sampling BEFORE any animation; the rings only animate to it.
//   weight = (score / 100) ^ k            (k = 8 by default, CHER_K to change)
//   rediscovery: weight × (1 + 3 × forgotten pieces in the look)
// Forgotten = the same rule as Insights (worn before, not in the last 40 days).
// Scores, verdicts and reasons all come from CompatibilityService.
const C = require('../compatibility');
const { loadContext, brief, bad, pickOccasion } = require('../context');

const DAY = 86400000;
const FORGOTTEN_DAYS = 40;
const MATCH_AT = 75;
const MIN_SCORE = 66; // candidates may have up to two soft rule failures, so a spin can honestly land on a mismatch
const SLOT = (p) => (p.category === 'Dress' ? 'top' : p.category === 'Top' ? 'top' : p.category === 'Bottom' ? 'bottom' : p.category === 'Shoes' ? 'shoes' : null);
const isForgotten = (p, now = Date.now()) => p.wearCount > 0 && !!p.lastWornAt && (now - new Date(p.lastWornAt)) / DAY >= FORGOTTEN_DAYS;

function weightOf(l, { k = 8, rediscovery = false, forgotten = new Set() } = {}) {
  let w = Math.pow(l.score / 100, k);
  if (rediscovery) w *= 1 + 3 * l.itemIds.filter((id) => forgotten.has(id)).length;
  return w;
}
function sample(looks, opts = {}, rand = Math.random) {
  const ws = looks.map((l) => weightOf(l, opts));
  const total = ws.reduce((a, b) => a + b, 0);
  if (!total) return null;
  let r = rand() * total;
  for (let i = 0; i < looks.length; i++) { r -= ws[i]; if (r <= 0) return looks[i]; }
  return looks[looks.length - 1];
}
// one look = top (or dress) + bottom (unless dress) + shoes; accessories are left to the user
const threePiece = (pieces) => pieces.filter((p) => SLOT(p));

module.exports = function cher(deps, { k = Number(process.env.CHER_K) || 8, rand = Math.random } = {}) {
  const methods = {
    async spin(userId, body = {}) {
      const occasion = pickOccasion(body.occasion);
      const locks = body.lockedGarmentIds || {};
      if (typeof locks !== 'object' || Array.isArray(locks)) throw bad('lockedGarmentIds', 'lockedGarmentIds must be { top, bottom, shoes }.');
      const ctx = await loadContext(deps, userId, { occasion });
      const avail = ctx.pieces.filter((p) => p.status === 'Available' && SLOT(p));
      const lockedIds = ['top', 'bottom', 'shoes'].map((s) => locks[s]).filter(Boolean);
      for (const id of lockedIds) if (!avail.some((p) => p.id === id)) throw bad('lockedGarmentIds', 'A locked piece is not one of your available pieces.');
      const forgotten = new Set(avail.filter((p) => isForgotten(p)).map((p) => p.id));
      // a warm day: no outer layer needed; the engine still checks weather in its criteria
      const all = C.enumerateOutfits(avail, { occasion, prefs: ctx.prefs, weather: ctx.weather && ctx.weather.tempC < 19 ? { ...ctx.weather, tempC: 19 } : ctx.weather, locked: lockedIds, threshold: MIN_SCORE, cap: 14 });
      const seen = new Set();
      const looks = [];
      for (const l of all) {
        const pieces = threePiece(l.pieces);
        const key = pieces.map((p) => p.id).sort().join('+');
        if (seen.has(key) || !lockedIds.every((id) => key.includes(id))) continue;
        seen.add(key);
        const s = C.scoreOutfit(pieces, { occasion, prefs: ctx.prefs, weather: ctx.weather });
        if (s.score >= MIN_SCORE) looks.push({ pieces, itemIds: pieces.map((p) => p.id), ...s });
      }
      if (!looks.length) return { outfit: null, message: 'Not enough available pieces — check your laundry basket.', candidates: 0 };
      const pick = sample(looks, { k, rediscovery: !!body.rediscovery, forgotten }, rand);
      const card = (p) => (p ? { ...brief(p), thumbnailUrl: p.photoUrl || null, isForgotten: forgotten.has(p.id) } : null);
      const dress = pick.pieces.find((p) => p.category === 'Dress');
      const outfit = { top: card(dress || pick.pieces.find((p) => p.category === 'Top')), bottom: dress ? null : card(pick.pieces.find((p) => p.category === 'Bottom')), shoes: card(pick.pieces.find((p) => p.category === 'Shoes')), dress: !!dress };
      // the rings: up to 12 cards each — every piece of the result, then the rest of that slot
      const ring = (slot) => {
        const own = avail.filter((p) => SLOT(p) === slot && (slot !== 'bottom' || p.category === 'Bottom'));
        const chosen = outfit[slot] ? own.filter((p) => p.id === outfit[slot].id) : [];
        const rest = own.filter((p) => !chosen.includes(p)).sort((a, b) => a.id.localeCompare(b.id)).slice(0, 12 - chosen.length);
        return [...chosen, ...rest].sort((a, b) => a.name.localeCompare(b.name)).map(card);
      };
      return {
        outfit, itemIds: pick.itemIds, score: pick.score, compatibility: pick.compatibility, reasons: pick.reasons, problems: pick.problems,
        verdict: pick.score >= MATCH_AT ? 'match' : 'mismatch', forgottenCount: pick.itemIds.filter((id) => forgotten.has(id)).length,
        occasion, levelName: pick.levelName, candidates: looks.length, rings: { top: ring('top'), bottom: ring('bottom'), shoes: ring('shoes') },
      };
    },

    async feedback(userId, body = {}) {
      const ids = body.garmentIds;
      if (!Array.isArray(ids) || ids.length < 2 || ids.length > 4) throw bad('garmentIds', 'garmentIds must be 2–4 piece ids.');
      if (!['accepted', 'rejected', 'fine_tuned'].includes(body.action)) throw bad('action', 'action must be accepted, rejected or fine_tuned.');
      const score = Number.isFinite(body.score) ? Math.round(body.score) : null;
      // learned style patterns: accepted → a favourite look; rejected → a reject signal (both checked for ownership)
      if (body.action === 'accepted') await deps.outfits().save(userId, { itemIds: ids, occasion: body.occasion || 'Everyday', ruleScore: score || 100, favorite: true, reasons: ['Picked in Cher mode.'] });
      else if (body.action === 'rejected') await deps.outfits().reject(userId, ids, 'Don’t like one piece');
      else { const own = await deps.wardrobe().piecesByIds(userId, ids); if (own.length !== ids.length) throw require('../../../shared/errors').errors.notFound('Piece'); }
      await deps.repo.cherFeedback(userId, { itemIds: ids, score, action: body.action });
      return { stored: true, action: body.action };
    },
  };
  return {
    methods,
    routes: [
      ['POST', '/cher-mode/spin', (r) => methods.spin(r.userId, r.body)],
      ['POST', '/cher-mode/feedback', (r) => methods.feedback(r.userId, r.body)],
    ],
  };
};
module.exports.sample = sample;
module.exports.weightOf = weightOf;
module.exports.isForgotten = isForgotten;
module.exports.MATCH_AT = MATCH_AT;
