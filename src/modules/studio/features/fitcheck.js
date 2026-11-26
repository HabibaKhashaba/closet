// Feature 7 — Fit check: a mirror selfie (or picked pieces) → which of MY pieces I'm wearing → score + one best swap.
// The model may only choose ids from the user's own candidate list (checked). On "Save my outfit" the
// normal wear flow runs (wear count, last worn, analytics). The photo itself is never stored.
const C = require('../compatibility');
const { loadContext, brief, bad, photoOf, pickOccasion, errors } = require('../context');
const { callClaudeJSON } = require('../claudeJson');

module.exports = function fitcheck(deps) {
  function bestSwap(ctx, pieces, c) {
    const base = C.scoreOutfit(pieces, c);
    let best = null;
    for (const p of pieces) {
      for (const alt of ctx.pieces.filter((x) => x.status === 'Available' && x.category === p.category && !pieces.some((q) => q.id === x.id))) {
        const next = pieces.map((q) => (q.id === p.id ? alt : q));
        const s = C.scoreOutfit(next, c);
        const gain = (s.score - base.score) * 2 + (s.compatibility - base.compatibility);
        if (gain > 0 && (!best || gain > best.gain)) best = { gain, out: brief(p), in: brief(alt), score: s.score, compatibility: s.compatibility, itemIds: next.map((q) => q.id) };
      }
    }
    return best && { out: best.out, in: best.in, score: best.score, compatibility: best.compatibility, itemIds: best.itemIds };
  }
  const methods = {
    async check(userId, body = {}) {
      const occasion = pickOccasion(body.occasion);
      const ctx = await loadContext(deps, userId, { occasion });
      const c = { occasion, prefs: ctx.prefs, weather: ctx.weather };
      const candidates = ctx.pieces.filter((p) => p.status === 'Available');
      let ids = Array.isArray(body.itemIds) ? body.itemIds : null;
      let source = 'manual';
      const photo = photoOf(body);
      if (!ids && photo) {
        const ai = await callClaudeJSON(deps.llm, {
          system: 'You see a mirror photo of a person. Match each visible clothing piece to the user\'s own pieces from the list. Return ONLY ids from the list; skip pieces you cannot match.',
          content: [{ type: 'image', mime: photo.mime, base64: photo.base64 }, { type: 'text', text: JSON.stringify(candidates.map((p) => ({ id: p.id, name: p.name, category: p.category, colour: p.colour }))) }],
          schema: { type: 'object', required: ['itemIds'], properties: { itemIds: { type: 'array', maxItems: 4, items: { type: 'string' } } } },
          name: 'match_pieces', allowedIds: candidates.map((p) => p.id), maxTokens: 200,
        });
        if (ai && ai.itemIds.length) { ids = [...new Set(ai.itemIds)]; source = 'ai'; }
      }
      if (!ids) return { source: 'none', detected: [], message: photo ? 'We could not match the photo to your pieces. Pick what you are wearing.' : 'Pick what you are wearing.', candidates: candidates.map(brief) };
      if (ids.length < 2 || ids.length > 4) throw bad('itemIds', 'Choose 2–4 pieces.');
      const pieces = ids.map((id) => ctx.pieces.find((p) => p.id === id));
      if (pieces.some((p) => !p)) throw errors.notFound('Piece');
      const s = C.scoreOutfit(pieces, c);
      return { source, detected: pieces.map(brief), itemIds: ids, score: s.score, compatibility: s.compatibility, reasons: s.reasons, problems: s.problems, levelName: s.levelName, swap: bestSwap(ctx, pieces, c) };
    },
    async save(userId, body = {}) {
      const ids = body.itemIds;
      if (!Array.isArray(ids) || ids.length < 2 || ids.length > 4) throw bad('itemIds', 'Choose 2–4 pieces.');
      const r = await deps.outfits().wear(userId, ids, null, { occasion: body.occasion || null, note: 'Fit check' });
      return { saved: true, wear: r };
    },
  };
  return { methods, routes: [['POST', '/fit-check', (r) => methods.check(r.userId, r.body)], ['POST', '/fit-check/save', (r) => methods.save(r.userId, r.body)]] };
};
