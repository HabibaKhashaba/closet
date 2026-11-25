// Feature 9 — Closet wrapped: the user's style story for a period, as swipeable cards + a share card.
// EVERY number comes from the wear history and the closet (counted here). The persona name is rule-based;
// a language model may only write one tagline from the computed facts, never a number.
const { loadContext, brief, bad } = require('../context');
const { callClaudeJSON } = require('../claudeJson');

const PERSONA = {
  Classic: 'The Timeless Classic', Minimal: 'The Quiet Minimalist', Elegant: 'The Evening Elegant', Chic: 'The Effortless Chic', Casual: 'The Easy-Going Original',
  Comfortable: 'The Comfort Curator', Bold: 'The Colour Rebel', Streetwear: 'The Street Stylist', Sporty: 'The Active Achiever',
};
const top = (counts) => Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);

module.exports = function wrapped(deps) {
  const methods = {
    async wrapped(userId, query = {}) {
      const days = Number(query.days || 30);
      if (![30, 90, 365].includes(days)) throw bad('days', 'days must be 30, 90 or 365.');
      const from = isoDay(Date.now() - days * 86400000);
      const [ctx, hist, health] = await Promise.all([loadContext(deps, userId), deps.outfits().history(userId, { from }), deps.intelligence().health(userId)]);
      const wears = hist.wears || [];
      const pieceCount = {}; const colour = {}; const occasion = {}; const style = {}; const looks = {};
      for (const w of wears) {
        if (w.occasion) occasion[w.occasion] = (occasion[w.occasion] || 0) + 1;
        const key = w.pieces.map((p) => p.id).sort().join('+');
        looks[key] = (looks[key] || 0) + 1;
        for (const p of w.pieces) {
          pieceCount[p.id] = (pieceCount[p.id] || 0) + 1;
          colour[p.colour] = (colour[p.colour] || 0) + 1;
          (p.styles || []).forEach((s) => { style[s] = (style[s] || 0) + 1; });
        }
      }
      const wornPieces = Object.values(pieceCount).reduce((a, b) => a + b, 0);
      const byId = new Map(ctx.pieces.map((p) => [p.id, p]));
      const mostWorn = top(pieceCount)[0];
      const topLook = top(looks).find(([, n]) => n >= 2);
      const colours = top(colour).slice(0, 3).map(([c, n]) => ({ colour: c, share: Math.round((n / wornPieces) * 100) }));
      const styleTop = top(style)[0];
      const persona = PERSONA[styleTop && styleTop[0]] || 'The Closet Explorer';
      const facts = {
        days, outfitsWorn: wears.length, differentPieces: Object.keys(pieceCount).length, closetSize: ctx.pieces.length,
        rotation: ctx.pieces.length ? Math.round((Object.keys(pieceCount).length / ctx.pieces.length) * 100) : 0,
        mostWorn: mostWorn && byId.get(mostWorn[0]) ? { piece: brief(byId.get(mostWorn[0])), times: mostWorn[1] } : null,
        topColours: colours, topOccasion: top(occasion)[0] ? { occasion: top(occasion)[0][0], times: top(occasion)[0][1] } : null,
        favouriteLook: topLook ? { pieces: topLook[0].split('+').map((id) => brief(byId.get(id))).filter(Boolean), times: topLook[1] } : null,
        forgotten: health.stats ? health.stats.forgotten : 0, health: health.score ?? null, grade: health.grade || null, topStyle: styleTop ? styleTop[0] : null,
      };
      let tagline = facts.outfitsWorn ? `${facts.outfitsWorn} outfits, ${facts.differentPieces} different pieces — your closet worked hard.` : 'Log a few outfits and your story will appear here.';
      const ai = facts.outfitsWorn ? await callClaudeJSON(deps.llm, {
        system: 'Write ONE warm, witty tagline (max 18 words, sentence case) for a personal style recap, using only these facts. Do not write any numbers.',
        content: [{ type: 'text', text: JSON.stringify({ persona, topStyle: facts.topStyle, topColours: colours.map((c) => c.colour), topOccasion: facts.topOccasion && facts.topOccasion.occasion, mostWorn: facts.mostWorn && facts.mostWorn.piece.name }) }],
        schema: { type: 'object', required: ['tagline'], properties: { tagline: { type: 'string' } } }, name: 'wrapped_tagline', maxTokens: 80,
        validate: (o) => !/\d/.test(o.tagline) && o.tagline.length < 140,
      }) : null;
      if (ai) tagline = ai.tagline;
      return { ...facts, persona, tagline, ai: !!ai, from, to: isoDay(Date.now()) };
    },
  };
  return { methods, routes: [['GET', '/wrapped', (r) => methods.wrapped(r.userId, r.query)]] };
};
