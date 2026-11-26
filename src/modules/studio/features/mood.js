// Feature 5 — Mood styling: "I feel cozy" → three different looks that match the mood AND pass the rules.
// A mood is a set of piece weights (styles, colours, fabrics, formality) used to RANK valid looks;
// it never lowers the rule threshold. Restyle: one locked piece shown in every mood.
const C = require('../compatibility');
const engine = require('../../recommendation/engine');
const { loadContext, bad, look, pickOccasion, OCCASION_FOR_LEVEL } = require('../context');

const MOODS = {
  confident: { label: 'Confident', styles: ['Classic', 'Chic', 'Elegant'], colours: ['Black', 'Red', 'Navy', 'White'], fabrics: ['Leather', 'Wool', 'Silk'], structure: true, line: 'Sharp lines and strong colours.' },
  cozy: { label: 'Cozy', styles: ['Comfortable', 'Casual'], colours: ['Beige', 'Brown', 'Grey', 'White'], fabrics: ['Knit', 'Wool', 'Cotton'], structure: false, line: 'Soft fabrics and warm neutrals.' },
  bold: { label: 'Bold', styles: ['Bold', 'Streetwear'], colours: ['Red', 'Yellow', 'Orange', 'Pink', 'Green', 'Purple', 'Multicolour'], fabrics: ['Leather', 'Denim'], structure: false, line: 'Colour first, rules still checked.' },
  calm: { label: 'Calm', styles: ['Minimal', 'Classic'], colours: ['White', 'Beige', 'Grey', 'Blue'], fabrics: ['Linen', 'Cotton', 'Silk'], structure: false, line: 'Quiet colours and clean shapes.' },
  playful: { label: 'Playful', styles: ['Casual', 'Bold', 'Streetwear'], colours: ['Pink', 'Yellow', 'Blue', 'Multicolour', 'Green'], fabrics: ['Denim', 'Cotton'], structure: false, line: 'Prints, brights and easy pieces.' },
  elegant: { label: 'Elegant', styles: ['Elegant', 'Chic'], colours: ['Black', 'Navy', 'Beige', 'White'], fabrics: ['Silk', 'Wool'], structure: true, line: 'Refined fabrics and a polished finish.' },
};

const moodWeight = (m) => (p) => {
  let w = 0;
  if ((p.styles || []).some((s) => m.styles.includes(s))) w += 3;
  if (m.colours.includes(p.colour)) w += 2;
  if (m.fabrics.includes(p.fabric)) w += 2;
  if (m.structure && ['Layer', 'Bag'].includes(p.category)) w += 1;
  return w;
};
const moodFit = (m, pieces) => {
  const w = moodWeight(m);
  const max = pieces.length * 7;
  return Math.round((pieces.reduce((t, p) => t + w(p), 0) / max) * 100);
};
const moodReasons = (m, pieces) => {
  const out = [];
  const st = pieces.filter((p) => (p.styles || []).some((s) => m.styles.includes(s)));
  const col = pieces.filter((p) => m.colours.includes(p.colour));
  const fab = pieces.filter((p) => m.fabrics.includes(p.fabric));
  if (fab.length) out.push(`${fab.map((p) => p.fabric.toLowerCase()).filter((x, i, a) => a.indexOf(x) === i).join(' and ')} for a ${m.label.toLowerCase()} feel`);
  if (col.length) out.push(`${col.length} piece${col.length === 1 ? '' : 's'} in ${m.label.toLowerCase()} colours`);
  if (st.length) out.push(`${st.length} piece${st.length === 1 ? '' : 's'} with a ${m.label.toLowerCase()} style`);
  return out.map((s) => s.charAt(0).toUpperCase() + s.slice(1) + '.');
};

module.exports = function mood(deps) {
  async function looksFor(userId, moodKey, { occasion, lockedId, n = 3 }) {
    const m = MOODS[moodKey];
    if (!m) throw bad('mood', `Mood must be one of: ${Object.keys(MOODS).join(', ')}.`);
    const ctx = await loadContext(deps, userId, { occasion });
    if (lockedId && !ctx.pieces.some((p) => p.id === lockedId && p.status === 'Available')) throw bad('lockedId', 'Choose one of your available pieces.');
    const valid = C.enumerateOutfits(ctx.pieces, { occasion, prefs: ctx.prefs, weather: ctx.weather, rankPiece: moodWeight(m), locked: lockedId ? [lockedId] : [], cap: 8 });
    const scored = valid.map((l) => ({ ...l, fit: moodFit(m, l.pieces), rule: l.score, rank: l.score / 10 + moodFit(m, l.pieces) / 10 })).sort((a, b) => b.rank - a.rank);
    const chosen = engine.pickDiverse(scored, { fixedId: lockedId, n });
    const names = engine.lookNames(chosen.map((l) => l.pieces), { occasion, level: C.levelFor({ occasion }) });
    return { mood: moodKey, label: m.label, line: m.line, looks: chosen.map((l, i) => look(l, { name: names[i], moodFit: l.fit, moodReasons: moodReasons(m, l.pieces) })) };
  }
  const methods = {
    moods: () => ({ moods: Object.entries(MOODS).map(([key, m]) => ({ key, label: m.label, line: m.line })) }),
    async style(userId, body = {}) {
      const occasion = pickOccasion(body.occasion);
      const r = await looksFor(userId, body.mood, { occasion });
      return { ...r, occasion, message: r.looks.length ? null : 'No look passes the rules for this mood right now. Try another mood or occasion.' };
    },
    async restyle(userId, body = {}) {
      if (!body.itemId) throw bad('itemId', 'Choose a piece to restyle.');
      const piece = (await deps.wardrobe().allPieces(userId)).find((p) => p.id === body.itemId);
      if (!piece) throw require('../../../shared/errors').errors.notFound('Piece');
      // default occasion: the most casual one the piece is meant for
      const occasion = body.occasion ? pickOccasion(body.occasion) : OCCASION_FOR_LEVEL[Math.min(...(piece.dressCodes && piece.dressCodes.length ? piece.dressCodes : [1]))];
      const out = [];
      for (const key of Object.keys(MOODS)) {
        const r = await looksFor(userId, key, { occasion, lockedId: body.itemId, n: 1 });
        if (r.looks[0]) out.push({ mood: key, label: r.label, look: r.looks[0] });
      }
      return { itemId: body.itemId, occasion, moods: out };
    },
  };
  return { methods, routes: [['GET', '/mood', () => methods.moods()], ['POST', '/mood', (r) => methods.style(r.userId, r.body)], ['POST', '/mood/restyle', (r) => methods.restyle(r.userId, r.body)]] };
};
module.exports.MOODS = MOODS;
module.exports.moodFit = moodFit;
