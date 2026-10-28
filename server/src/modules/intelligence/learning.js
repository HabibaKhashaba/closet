// "Closet has learned" (US-40, US-63): turns feedback into plain-word patterns the user can confirm.
// Pure functions. A pattern is only shown when the evidence is real; confirming it changes one
// profile preference (shown before the user decides) and can be undone exactly.
// Confidence = evidence ÷ (evidence + 2): 2 signals → 50 %, 4 → 67 %, 8 → 80 % (SDD 5.x).
const { DRESS_CODES } = require('../../shared/vocabulary');
const { NEUTRALS } = require('../recommendation/engine');
const { letGoStyles } = require('../../shared/deletionPolicy');

const confidence = (n) => Math.round((n / (n + 2)) * 100);
const MIN_REJECTS = 2;

// input: { prefs, rejectCounts: {reason: n}, favourites: [{pieces}], wears: [{pieces, rating}], pieces, today }
function detectPatterns({ prefs, rejectCounts = {}, favourites = [], wears = [], pieces = [], deletions = [], today = new Date() }) {
  const out = [];
  // Deletion reasons (US-13, US-34): two or more pieces let go of as "No longer my style" that share a style.
  const [letGo] = letGoStyles(deletions).filter((x) => !(prefs.avoidStyles || []).includes(x.style));
  if (letGo) {
    const s = letGo.style;
    out.push({
      key: `let-go-${s.toLowerCase()}`, kind: 'style', text: `You are moving away from ${s.toLowerCase()} pieces.`,
      evidence: `${letGo.count} ${s.toLowerCase()} pieces deleted as “No longer my style”`, count: letGo.count, confidence: confidence(letGo.count),
      change: { avoidStyles: [...(prefs.avoidStyles || []), s], styles: (prefs.styles || []).filter((x) => x !== s) },
      effect: `${s} pieces rank lower in your outfits and are never suggested to buy.`,
      source: 'Deleted pieces',
    });
  }
  const tooFormal = rejectCounts['Too formal'] || 0;
  const tooCasual = rejectCounts['Too casual'] || 0;
  if (tooFormal >= MIN_REJECTS && tooFormal > tooCasual && prefs.dressCode > 1) {
    out.push({
      key: 'less-formal', kind: 'formality', text: 'You often reject looks as too formal.',
      evidence: `${tooFormal} looks rejected as “Too formal” in the last 60 days`, count: tooFormal, confidence: confidence(tooFormal),
      change: { dressCode: prefs.dressCode - 1 }, effect: `Your usual dress code moves from ${DRESS_CODES[prefs.dressCode]} to ${DRESS_CODES[prefs.dressCode - 1]}.`,
      source: 'Rejections',
    });
  }
  if (tooCasual >= MIN_REJECTS && tooCasual > tooFormal && prefs.dressCode < 5) {
    out.push({
      key: 'more-formal', kind: 'formality', text: 'You often reject looks as too casual.',
      evidence: `${tooCasual} looks rejected as “Too casual” in the last 60 days`, count: tooCasual, confidence: confidence(tooCasual),
      change: { dressCode: prefs.dressCode + 1 }, effect: `Your usual dress code moves from ${DRESS_CODES[prefs.dressCode]} to ${DRESS_CODES[prefs.dressCode + 1]}.`,
      source: 'Rejections',
    });
  }
  // Favourites: a style present in at least half of the favourite looks (and ≥ 2 of them) that the profile lacks.
  if (favourites.length >= 2) {
    const counts = {};
    for (const o of favourites) for (const s of new Set(o.pieces.flatMap((p) => p.styles || []))) counts[s] = (counts[s] || 0) + 1;
    const [style, n] = Object.entries(counts).filter(([s]) => !(prefs.styles || []).includes(s)).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] || [];
    if (style && n >= 2 && n / favourites.length >= 0.5) {
      out.push({
        key: `style-${style.toLowerCase()}`, kind: 'style', text: `You often favourite ${style.toLowerCase()} looks.`,
        evidence: `${n} of your ${favourites.length} favourite looks include ${style.toLowerCase()} pieces`, count: n, confidence: confidence(n),
        change: { styles: [...(prefs.styles || []), style] }, effect: `${style} is added to your styles, so ${style.toLowerCase()} pieces rank higher.`,
        source: 'Favourites',
      });
    }
  }
  // Wear history: share of worn pieces in neutral colours.
  const worn = wears.flatMap((w) => w.pieces);
  if (worn.length >= 8) {
    const neutral = worn.filter((p) => NEUTRALS.includes(p.colour));
    const share = neutral.length / worn.length;
    const missing = [...new Set(neutral.map((p) => p.colour))].filter((c) => !(prefs.colours || []).includes(c));
    if (share >= 0.7 && missing.length) {
      const top = missing.sort((a, b) => neutral.filter((p) => p.colour === b).length - neutral.filter((p) => p.colour === a).length)[0];
      out.push({
        key: `neutral-${top.toLowerCase()}`, kind: 'colour', text: 'You prefer neutral colours.',
        evidence: `${Math.round(share * 100)} % of the pieces you wore recently were neutral; ${top.toLowerCase()} came up ${neutral.filter((p) => p.colour === top).length} times`, count: neutral.length, confidence: Math.min(95, Math.round(share * 100)),
        change: { colours: [...(prefs.colours || []), top] }, effect: `${top} is added to your favourite colours.`,
        source: 'Wear history',
      });
    }
  }
  // Rarely worn colour: ≥ 2 pieces of a non-neutral colour, none worn in 40 days.
  const byColour = {};
  for (const p of pieces) if (!NEUTRALS.includes(p.colour) && p.colour !== 'Multicolour') (byColour[p.colour] = byColour[p.colour] || []).push(p);
  for (const [colour, list] of Object.entries(byColour)) {
    if (list.length < 2) continue;
    const recent = list.filter((p) => p.lastWornAt && (today - new Date(p.lastWornAt)) / 86400000 < 40);
    if (!recent.length) {
      const inPrefs = (prefs.colours || []).includes(colour);
      out.push({
        key: `rarely-${colour.toLowerCase()}`, kind: 'colour', text: `You rarely wear ${colour.toLowerCase()} pieces.`,
        evidence: `${list.length} ${colour.toLowerCase()} pieces, none worn in the last 40 days`, count: list.length, confidence: confidence(list.length),
        change: inPrefs ? { colours: (prefs.colours || []).filter((c) => c !== colour) } : null,
        effect: inPrefs ? `${colour} is removed from your favourite colours.` : 'Nothing changes in your profile; these pieces appear under Forgotten pieces.',
        source: 'Wear history',
      });
    }
  }
  return out;
}

// The profile values a change would overwrite, so Undo can restore them exactly.
function previousOf(prefs, change) {
  if (!change) return null;
  return Object.fromEntries(Object.keys(change).map((k) => [k, prefs[k]]));
}

module.exports = { detectPatterns, previousOf, confidence, MIN_REJECTS };
