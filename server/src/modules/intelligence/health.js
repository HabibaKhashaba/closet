// Wardrobe Health score (US-89). Pure function: same inputs → same score, so every point is testable.
// Formula (SDD 5.x): five positive parts (max 100) minus two penalties, clamped to 0 – 100.
//   Utilisation  35 × (pieces worn in the last 30 days ÷ pieces owned)
//   Versatility  20 × (pieces that suit 2 or more dress-code levels ÷ pieces owned)
//   Balance      20 × (1 − closet gaps ÷ (3 groups × levels the user dresses for))
//   Readiness    15 × (Available pieces ÷ pieces owned)
//   Basics       10 × (capsule basics owned ÷ 7)
//   Forgotten    −1 per forgotten piece (worn before, not in 40 days), at most −10
//   Duplicates   −1 per potential duplicate (same category and colour and a shared style), at most −10
const NOUN = { Top: 'top', Dress: 'dress', Bottom: 'skirt or trousers', Layer: 'layer', Shoes: 'pair of shoes', Bag: 'bag', Extra: 'accessory' };
const FORGOTTEN_DAYS = 40;
const DAY = 86400000;

function potentialDuplicates(pieces) {
  const groups = new Map();
  for (const p of pieces) {
    const k = `${p.category}|${p.colour}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(p);
  }
  const out = [];
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    // a piece counts once if it shares a style with another piece of the same category and colour
    const dup = list.filter((p) => list.some((q) => q !== p && (q.styles || []).some((s) => (p.styles || []).includes(s))));
    if (dup.length >= 2) out.push({ category: list[0].category, colour: list[0].colour, pieces: dup, count: dup.length - 1 });
  }
  return out.sort((a, b) => b.count - a.count);
}

function grade(score) {
  if (score >= 80) return 'Excellent';
  if (score >= 65) return 'Good';
  if (score >= 50) return 'Fair';
  return 'Needs care';
}

// pieces: wardrobe pieces with status; worn30: Set of ids worn in the last 30 days;
// gaps: closetGaps(...) result; missingBasics: list of basic titles not owned (of 7).
function wardrobeHealth({ pieces, worn30 = new Set(), gaps = { gaps: [], levels: [] }, missingBasics = [], basicsTotal = 7, today = new Date() }) {
  const n = pieces.length;
  if (!n) {
    return { score: 0, grade: 'Needs care', empty: true, parts: [], penalties: [], stats: { pieces: 0 },
      actions: ['Add your first pieces to get a Wardrobe Health score.'] };
  }
  const worn = pieces.filter((p) => worn30.has(p.id)).length;
  const versatile = pieces.filter((p) => (p.dressCodes || []).length >= 2).length;
  const levels = Math.max(1, (gaps.levels || []).length);
  const gapCount = (gaps.gaps || []).length;
  const available = pieces.filter((p) => p.status === 'Available').length;
  const forgotten = pieces.filter((p) => p.wearCount > 0 && p.lastWornAt && (today - new Date(p.lastWornAt)) / DAY >= FORGOTTEN_DAYS);
  const dups = potentialDuplicates(pieces);
  const dupCount = dups.reduce((t, d) => t + d.count, 0);
  const owned = basicsTotal - missingBasics.length;

  const parts = [
    { key: 'utilisation', label: 'Utilisation', points: Math.round(35 * (worn / n)), max: 35, detail: `${worn} of ${n} pieces worn in the last 30 days` },
    { key: 'versatility', label: 'Versatility', points: Math.round(20 * (versatile / n)), max: 20, detail: `${versatile} pieces suit two or more dress codes` },
    { key: 'balance', label: 'Balance', points: Math.round(20 * Math.max(0, 1 - gapCount / (3 * levels))), max: 20, detail: gapCount ? `${gapCount} gap${gapCount === 1 ? '' : 's'} at the levels you dress for` : 'no gaps at the levels you dress for' },
    { key: 'readiness', label: 'Readiness', points: Math.round(15 * (available / n)), max: 15, detail: `${available} of ${n} pieces are Available now` },
    { key: 'basics', label: 'Basics', points: Math.round(10 * (owned / basicsTotal)), max: 10, detail: `${owned} of ${basicsTotal} capsule basics` },
  ];
  const penalties = [
    { key: 'forgotten', label: 'Forgotten pieces', points: -Math.min(10, forgotten.length), detail: `${forgotten.length} not worn in ${FORGOTTEN_DAYS}+ days` },
    { key: 'duplicates', label: 'Potential duplicates', points: -Math.min(10, dupCount), detail: `${dupCount} piece${dupCount === 1 ? '' : 's'} very like another` },
  ];
  const raw = parts.reduce((t, p) => t + p.points, 0) + penalties.reduce((t, p) => t + p.points, 0);
  const score = Math.max(0, Math.min(100, raw));

  const actions = [];
  if (forgotten.length) actions.push(`Style ${Math.min(3, forgotten.length)} forgotten piece${Math.min(3, forgotten.length) === 1 ? '' : 's'} this week.`);
  if (dups[0]) actions.push(`You may not need another ${dups[0].colour.toLowerCase()} ${NOUN[dups[0].category]}.`);
  if (missingBasics[0]) actions.push(`Consider adding a ${missingBasics[0].toLowerCase()}.`);
  const laundry = pieces.filter((p) => p.status === 'Laundry').length;
  if (laundry >= 3) actions.push(`Wash day: ${laundry} pieces are in the laundry basket.`);
  if (!actions.length) actions.push('Your closet is in great shape — keep rotating your pieces.');

  return {
    score, grade: grade(score), empty: false, parts, penalties, actions: actions.slice(0, 3),
    stats: { pieces: n, worn30: worn, utilisation: Math.round((worn / n) * 100), forgotten: forgotten.length, duplicates: dupCount, missingBasics: missingBasics.length, gaps: gapCount },
    forgotten: forgotten.map((p) => ({ id: p.id, name: p.name, days: Math.floor((today - new Date(p.lastWornAt)) / DAY) })).sort((a, b) => b.days - a.days),
    duplicates: dups.map((d) => ({ category: d.category, colour: d.colour, count: d.count, itemIds: d.pieces.map((p) => p.id) })),
  };
}

module.exports = { wardrobeHealth, potentialDuplicates, grade, FORGOTTEN_DAYS };
