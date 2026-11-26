// Feature 6 — Recreate this look: an inspiration photo (or a description) → the closest pieces YOU own.
// The language model only DESCRIBES the inspiration pieces (category, colour, style, fabric); matching is ours:
//   same category required · colour 50 · style 25 · fabric 25  →  Exact ≥ 90 · Close ≥ 60 · Alternative > 0 · Missing
// Missing pieces: add to the shopping list, or borrow from a friend who marked a match as lendable.
const { loadContext, brief, bad, photoOf, categoriesIn, colourIn, styleIn, fabricIn, CATEGORIES, COLOURS, STYLES, FABRICS } = require('../context');
const { callClaudeJSON } = require('../claudeJson');
const C = require('../compatibility');

const SCHEMA = {
  type: 'object', required: ['pieces'],
  properties: { pieces: { type: 'array', maxItems: 6, items: { type: 'object', required: ['category', 'colour'], properties: {
    category: { type: 'string', enum: CATEGORIES }, colour: { type: 'string', enum: COLOURS }, style: { type: 'string', enum: STYLES }, fabric: { type: 'string', enum: FABRICS }, description: { type: 'string' },
  } } } },
};

const NEAR = { Beige: ['Brown', 'White'], Brown: ['Beige'], White: ['Beige', 'Grey'], Grey: ['White', 'Black'], Black: ['Navy', 'Grey'], Navy: ['Black', 'Blue'], Blue: ['Navy'], Red: ['Pink', 'Orange'], Pink: ['Red', 'Purple'] };
function matchScore(target, p) {
  if (p.category !== target.category) return 0;
  let s = 0;
  if (p.colour === target.colour) s += 50; else if ((NEAR[target.colour] || []).includes(p.colour)) s += 25;
  if (!target.style || (p.styles || []).includes(target.style)) s += 25;
  if (!target.fabric || p.fabric === target.fabric) s += 25;
  return s;
}
const levelOf = (s) => (s >= 90 ? 'Exact' : s >= 60 ? 'Close' : s > 0 ? 'Alternative' : 'Missing');

function fromText(text) {
  // "black blazer, white shirt and blue jeans" → one target per comma/and-part that names a category
  return String(text || '').split(/,|\band\b|\bwith\b|\+|\n/i).map((part) => {
    const cat = categoriesIn(part)[0];
    if (!cat) return null;
    return { category: cat, colour: colourIn(part) || 'Black', style: styleIn(part)[0] || null, fabric: fabricIn(part), description: part.trim().slice(0, 60) };
  }).filter(Boolean).slice(0, 6);
}

module.exports = function recreate(deps) {
  const methods = {
    async recreate(userId, body = {}) {
      const photo = photoOf(body);
      const text = String(body.text || '').slice(0, 500);
      let targets = Array.isArray(body.pieces) ? body.pieces.filter((t) => CATEGORIES.includes(t.category) && COLOURS.includes(t.colour)).slice(0, 6) : [];
      let source = targets.length ? 'manual' : null;
      if (!targets.length && photo) {
        const ai = await callClaudeJSON(deps.llm, {
          system: 'You describe the clothing pieces worn in an outfit photo: one entry per visible piece (top, bottom, dress, outer layer, shoes, bag, accessory). Use only the allowed values.',
          content: [{ type: 'image', mime: photo.mime, base64: photo.base64 }, { type: 'text', text: text || 'Describe the outfit.' }], schema: SCHEMA, name: 'describe_outfit', maxTokens: 500,
          validate: (o) => o.pieces.length > 0,
        });
        if (ai) { targets = ai.pieces; source = 'ai'; }
      }
      if (!targets.length && text.trim()) { targets = fromText(text); source = 'keywords'; }
      if (!targets.length) return { source: 'none', matches: [], message: photo ? 'We could not read the photo. Describe the look, for example “black blazer, white shirt, blue jeans”.' : 'Describe the look, for example “black blazer, white shirt, blue jeans”.' };

      const ctx = await loadContext(deps, userId);
      const mine = ctx.pieces.filter((p) => p.status === 'Available');
      const friendPieces = deps.friends ? await deps.friends().borrowable(userId) : [];
      const used = new Set();
      const matches = targets.map((t) => {
        const ranked = mine.filter((p) => !used.has(p.id)).map((p) => ({ p, s: matchScore(t, p) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
        const best = ranked[0];
        if (best) used.add(best.p.id);
        const level = best ? levelOf(best.s) : 'Missing';
        // a friend's lendable piece is offered when it matches better than anything the user owns
        const friend = level === 'Exact' ? null
          : friendPieces.map((f) => ({ f, s: matchScore(t, { ...f, styles: [] }) })).filter((x) => x.s >= 60 && x.s > (best ? best.s : 0)).sort((a, b) => b.s - a.s)[0] || null;
        return { target: t, level, match: best ? { ...brief(best.p), similarity: best.s } : null, alternatives: ranked.slice(1, 3).map((x) => ({ ...brief(x.p), similarity: x.s })), friend: friend ? friend.f : null };
      });
      const own = matches.filter((m) => m.match).map((m) => m.match.id);
      const pieces = mine.filter((p) => own.includes(p.id));
      const score = pieces.length >= 2 ? C.scoreOutfit(pieces, { prefs: ctx.prefs, weather: ctx.weather, level: pieces.reduce((l, p) => Math.max(l, Math.min(...(p.dressCodes || [1]))), 1) }) : null;
      const found = matches.filter((m) => m.level === 'Exact' || m.level === 'Close').length;
      return { source, matches, itemIds: own, score: score && { score: score.score, compatibility: score.compatibility, reasons: score.reasons, problems: score.problems },
        summary: `You can recreate ${found} of ${matches.length} piece${matches.length === 1 ? '' : 's'} with your closet.` };
    },
    async addMissing(userId, body = {}) {
      const t = body.target || {};
      if (!CATEGORIES.includes(t.category) || !COLOURS.includes(t.colour)) throw bad('target', 'Choose a category and colour.');
      return deps.shopping().addToList(userId, { title: t.description || `${t.colour} ${t.category.toLowerCase()}`, category: t.category, colour: t.colour, source: 'manual', reason: 'To recreate a look' });
    },
  };
  return { methods, routes: [['POST', '/recreate', (r) => methods.recreate(r.userId, r.body)], ['POST', '/recreate/shopping-list', (r) => methods.addMissing(r.userId, r.body)]] };
};
module.exports.matchScore = matchScore;
module.exports.fromText = fromText;
