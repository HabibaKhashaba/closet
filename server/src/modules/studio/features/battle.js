// Feature 8 — Stylist battle: two stylist personas each build their best look for the same occasion.
//   Classic        ranks neutrals and Classic / Minimal / Elegant pieces
//   Rule breaker   ranks Bold / Streetwear pieces and accent colours
// Both looks are scored by CompatibilityService (same rules); the user votes, and the vote is stored.
// A language model may add one line per persona — never numbers.
const C = require('../compatibility');
const engine = require('../../recommendation/engine');
const { loadContext, bad, look, pickOccasion } = require('../context');
const { callClaudeJSON } = require('../claudeJson');

const PERSONAS = {
  classic: { name: 'The Classic', rank: (p) => (engine.NEUTRALS.includes(p.colour) ? 3 : 0) + ((p.styles || []).some((s) => ['Classic', 'Minimal', 'Elegant'].includes(s)) ? 3 : 0), line: 'Timeless neutrals and clean lines. Nothing to prove.' },
  rebel: { name: 'The Rule Breaker', rank: (p) => (!engine.NEUTRALS.includes(p.colour) ? 3 : 0) + ((p.styles || []).some((s) => ['Bold', 'Streetwear'].includes(s)) ? 3 : 0) + (p.category === 'Extra' ? 1 : 0), line: 'One brave piece makes the whole look.' },
};

module.exports = function battle(deps) {
  const methods = {
    async battle(userId, body = {}) {
      const occasion = pickOccasion(body.occasion);
      const ctx = await loadContext(deps, userId, { occasion });
      const c = { occasion, prefs: ctx.prefs, weather: ctx.weather, cap: 8 };
      const best = (key) => C.enumerateOutfits(ctx.pieces, { ...c, rankPiece: PERSONAS[key].rank })
        .map((l) => ({ ...l, persona: l.pieces.reduce((t, p) => t + PERSONAS[key].rank(p), 0) }))
        .sort((a, b) => b.persona - a.persona || b.score - a.score);
      const a = best('classic')[0];
      const b = best('rebel').find((l) => !a || l.itemIds.filter((id) => a.itemIds.includes(id)).length < 2);
      if (!a || !b) return { occasion, looks: [], message: 'Not enough available pieces for two different looks. Check your laundry basket.' };
      const lines = { classic: PERSONAS.classic.line, rebel: PERSONAS.rebel.line };
      const ai = await callClaudeJSON(deps.llm, {
        system: 'Two stylist personas each defend their outfit in ONE playful sentence (max 20 words), in sentence case. The Classic is calm and refined; the Rule Breaker is bold and witty. No numbers.',
        content: [{ type: 'text', text: JSON.stringify({ occasion, classic: a.pieces.map((p) => p.name), rebel: b.pieces.map((p) => p.name) }) }],
        schema: { type: 'object', required: ['classic', 'rebel'], properties: { classic: { type: 'string' }, rebel: { type: 'string' } } },
        name: 'persona_lines', maxTokens: 150, validate: (o) => !/\d/.test(o.classic + o.rebel) && o.classic.length < 160 && o.rebel.length < 160,
      });
      if (ai) Object.assign(lines, ai);
      const votes = Object.fromEntries((await deps.repo.votes(userId)).map((v) => [v.winner, v.n]));
      return {
        occasion, ai: !!ai, votes: { classic: votes.classic || 0, rebel: votes.rebel || 0 },
        looks: [look(a, { persona: 'classic', name: PERSONAS.classic.name, line: lines.classic }), look(b, { persona: 'rebel', name: PERSONAS.rebel.name, line: lines.rebel })],
      };
    },
    async vote(userId, body = {}) {
      if (!PERSONAS[body.winner]) throw bad('winner', 'winner must be classic or rebel.');
      const ids = body.itemIds;
      if (!Array.isArray(ids) || ids.length < 2 || ids.length > 4) throw bad('itemIds', 'itemIds must be 2–4 piece ids.');
      const own = await deps.wardrobe().piecesByIds(userId, ids);
      if (own.length !== ids.length) throw require('../../../shared/errors').errors.notFound('Piece');
      await deps.repo.vote(userId, { occasion: pickOccasion(body.occasion), winner: body.winner, itemIds: ids });
      const votes = Object.fromEntries((await deps.repo.votes(userId)).map((v) => [v.winner, v.n]));
      return { stored: true, votes: { classic: votes.classic || 0, rebel: votes.rebel || 0 } };
    },
  };
  return { methods, routes: [['POST', '/battle', (r) => methods.battle(r.userId, r.body)], ['POST', '/battle/vote', (r) => methods.vote(r.userId, r.body)]] };
};
module.exports.PERSONAS = PERSONAS;
