// Feature 1 — Should I buy this? (+ What if I donate this?)
// Counts the valid outfits with and without a piece on a VIRTUAL closet (nothing is saved).
// Every number is computed here; the language model may only phrase one sentence from these numbers.
const C = require('../compatibility');
const { loadContext, brief, bad, photoOf, CATEGORIES, COLOURS, STYLES, FABRICS, errors } = require('../context');
const { tagPhoto } = require('../../ai/aiFeatures');
const { callClaudeJSON } = require('../claudeJson');

const DEFAULT_OCCASIONS = ['Everyday', 'University', 'Work', 'Dinner', 'Party', 'Wedding'];
const occasionsOf = (prefs) => [...new Set([...(prefs.occasions || []).filter((o) => DEFAULT_OCCASIONS.includes(o) || o), ...DEFAULT_OCCASIONS])].slice(0, 6);

function verdictFor(gain, twin) {
  if (twin) return { verdict: 'Skip', why: 'You already own almost the same piece.' };
  if (gain >= 3) return { verdict: 'Buy', why: `It adds ${gain} new outfits you can wear.` };
  if (gain === 0) return { verdict: 'Skip', why: 'It would not create any new outfit with what you own.' };
  return { verdict: 'Think about it', why: `It adds only ${gain} new outfit${gain === 1 ? '' : 's'}.` };
}

module.exports = function buy(deps) {
  const methods = {
    async check(userId, body) {
      const photo = photoOf(body);
      let piece = body.piece || {};
      let source = 'manual';
      if (photo) {
        const tags = await tagPhoto(deps.llm, photo);
        if (tags && tags.isClothing === false) throw bad('photo', 'This photo does not look like a clothing item.');
        if (tags) { piece = { ...tags, ...Object.fromEntries(Object.entries(piece).filter(([, v]) => v)) }; source = 'ai'; }
      }
      if (!CATEGORIES.includes(piece.category)) throw bad('piece.category', photo ? 'We could not read the photo. Choose the category and colour.' : 'Choose a category.');
      if (!COLOURS.includes(piece.colour)) throw bad('piece.colour', 'Choose a colour.');
      const hyp = {
        id: 'virtual-new', name: piece.name || `New ${piece.colour.toLowerCase()} ${piece.category.toLowerCase()}`, category: piece.category, colour: piece.colour,
        fabric: FABRICS.includes(piece.fabric) ? piece.fabric : null, styles: (piece.styles || []).filter((s) => STYLES.includes(s)).slice(0, 3),
        dressCodes: (piece.dressCodes || []).map(Number).filter((n) => n >= 1 && n <= 5), season: piece.season || 'All seasons', modest: !!piece.modest,
      };
      if (!hyp.dressCodes.length) hyp.dressCodes = piece.category === 'Dress' ? [2, 4, 5] : [1, 2, 3];
      const ctx = await loadContext(deps, userId);
      const occ = occasionsOf(ctx.prefs);
      const c = { prefs: ctx.prefs, weather: ctx.weather };
      const before = C.countValidOutfits(ctx.pieces, c, occ);
      const withIt = C.virtualCloset(ctx.pieces, { add: [hyp] });
      const after = C.countValidOutfits(withIt, c, occ);
      const byOccasion = occ.map((o) => ({ occasion: o, before: before.byOccasion[o], after: after.byOccasion[o], gain: after.byOccasion[o] - before.byOccasion[o] }));
      const gain = after.total - before.total;
      const impact = await deps.shopping().impact(userId, { category: hyp.category, colour: hyp.colour, styles: hyp.styles, dressCodes: hyp.dressCodes, fabric: hyp.fabric, name: piece.name });
      const twin = !!impact.twin;
      const v = verdictFor(gain, twin);
      // example looks that use the new piece (best of each occasion that gained)
      const examples = [];
      for (const o of byOccasion.filter((x) => x.gain > 0).slice(0, 3)) {
        const l = C.outfitsWith(C.enumerateOutfits(withIt, { ...c, occasion: o.occasion }), hyp.id)[0];
        if (l) examples.push({ occasion: o.occasion, itemIds: l.itemIds, pieces: l.pieces.map(brief), score: l.score });
      }
      let sentence = `${v.why} Before: ${before.total} outfits. After: ${after.total}.`;
      const ai = await callClaudeJSON(deps.llm, {
        system: 'You are a calm personal stylist. Write ONE short sentence (max 25 words) in sentence case explaining the verdict using ONLY the numbers given. Never invent numbers.',
        content: [{ type: 'text', text: JSON.stringify({ verdict: v.verdict, before: before.total, after: after.total, byOccasion, similarOwned: impact.similar.length }) }],
        schema: { type: 'object', required: ['sentence'], properties: { sentence: { type: 'string' } } }, name: 'verdict_sentence', maxTokens: 120,
        validate: (o) => o.sentence.length < 220 && (o.sentence.match(/\d+/g) || []).every((n) => [before.total, after.total, gain, impact.similar.length, ...byOccasion.flatMap((b) => [b.before, b.after, b.gain])].includes(Number(n))),
      });
      if (ai) sentence = ai.sentence;
      return { mode: 'buy', source, piece: brief({ ...hyp, virtual: true }), verdict: v.verdict, sentence, before: before.total, after: after.total, gain, byOccasion, similar: impact.similar, examples, aiSentence: !!ai };
    },

    async donate(userId, body) {
      const id = body.itemId;
      const ctx = await loadContext(deps, userId);
      const piece = ctx.pieces.find((p) => p.id === id);
      if (!piece) throw errors.notFound('Piece');
      const occ = occasionsOf(ctx.prefs);
      const c = { prefs: ctx.prefs, weather: ctx.weather };
      const avail = ctx.pieces.map((p) => ({ ...p, status: 'Available' })); // a piece in the laundry still counts as owned
      const looksBefore = occ.flatMap((o) => C.enumerateOutfits(avail, { ...c, occasion: o }));
      const without = C.virtualCloset(avail, { remove: [id] });
      const looksAfter = occ.flatMap((o) => C.enumerateOutfits(without, { ...c, occasion: o }));
      const before = C.countValidOutfits(avail, c, occ);
      const after = C.countValidOutfits(without, c, occ);
      const count = (looks, pid) => new Set(looks.filter((l) => l.itemIds.includes(pid)).map((l) => l.itemIds.filter((x) => avail.find((p) => p.id === x && C.MAIN.includes(p.category))).sort().join('+'))).size;
      const orphans = avail.filter((p) => p.id !== id && C.MAIN.includes(p.category))
        .map((p) => ({ piece: brief(p), before: count(looksBefore, p.id), after: count(looksAfter, p.id) }))
        .filter((x) => x.before > 0 && x.after <= 1 && x.after < x.before)
        .sort((a, b) => a.after - b.after || b.before - a.before).slice(0, 5);
      const lost = before.total - after.total;
      const verdict = lost === 0 ? 'Safe to donate' : orphans.length ? 'Think about it' : lost <= 2 ? 'Safe to donate' : 'Think about it';
      const sentence = lost === 0 ? 'Donating it does not remove any outfit you can make.'
        : `Donating it removes ${lost} outfit${lost === 1 ? '' : 's'}${orphans.length ? ` and leaves ${orphans.length} piece${orphans.length === 1 ? '' : 's'} hard to style` : ''}.`;
      return { mode: 'donate', piece: brief(piece), verdict, sentence, before: before.total, after: after.total, lost,
        byOccasion: occ.map((o) => ({ occasion: o, before: before.byOccasion[o], after: after.byOccasion[o], gain: after.byOccasion[o] - before.byOccasion[o] })), hardToStyle: orphans };
    },
  };
  return {
    methods,
    routes: [
      ['POST', '/buy/check', (r) => methods.check(r.userId, r.body)],
      ['POST', '/buy/donate', (r) => methods.donate(r.userId, r.body)],
    ],
  };
};
