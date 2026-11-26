// Shared helpers for the v3.0 Studio features: one context loader, piece summaries, keyword parsing,
// photo input and feature flags. No feature scores outfits itself — scoring is compatibility.js.
const { errors, AppError } = require('../../shared/errors');
const { OCCASIONS, COLOURS, CATEGORIES, STYLES, FABRICS, DRESS_CODES } = require('../../shared/vocabulary');
const { isOwned } = require('../../shared/lifecycle');

const FEATURES = ['buy', 'cher', 'rescue', 'invitation', 'mood', 'recreate', 'fitcheck', 'wrapped', 'friends'];
const featureFlags = (env = process.env) => {
  const off = String(env.FEATURES_OFF || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return Object.fromEntries(FEATURES.map((f) => [f, !off.includes(f)]));
};

const todayStr = () => new Date().toISOString().slice(0, 10);

// Everything a feature needs about the user, loaded through the module interfaces (never the tables).
async function loadContext(deps, userId, { date, occasion, level } = {}) {
  const [pieces, prefs] = await Promise.all([deps.wardrobe().allPieces(userId), deps.profile.preferences(userId)]);
  let weather = null;
  try { weather = await deps.weather.forDate(prefs.city, date || todayStr()); } catch { weather = null; }
  const lvl = level || OCCASIONS[occasion] || null;
  return { pieces: pieces.filter(isOwned), prefs: { ...prefs, modest: !!prefs.modest }, weather, level: lvl, occasion: occasion || null };
}

// What the client shows for a piece (never the owner's private fields).
const brief = (p) => (p ? { id: p.id, name: p.name, category: p.category, colour: p.colour, fabric: p.fabric || null, styles: p.styles || [], status: p.status, photoUrl: p.photoUrl || null, virtual: !!p.virtual } : null);
const look = (l, extra = {}) => ({ itemIds: l.itemIds, pieces: l.pieces.map(brief), score: l.score, compatibility: l.compatibility, reasons: l.reasons, problems: l.problems, level: l.level, levelName: l.levelName, ...extra });

// ---------- keyword fallbacks (used when no language model is set up, or it fails twice) ----------
const CATEGORY_WORDS = [
  [/\b(dress|gown|abaya|jumpsuit)\b/i, 'Dress'], [/\b(shirt|blouse|top|tee|t-shirt|sweater|jumper|cardigan|knit|hoodie)\b/i, 'Top'],
  [/\b(trousers|pants|jeans|skirt|shorts|culottes)\b/i, 'Bottom'], [/\b(blazer|jacket|coat|trench|layer)\b/i, 'Layer'],
  [/\b(shoes?|heels?|sneakers?|trainers?|loafers?|boots?|sandals?|flats)\b/i, 'Shoes'], [/\b(bag|tote|clutch|purse)\b/i, 'Bag'],
  [/\b(earrings|necklace|scarf|belt|sunglasses|watch|hat|jewell?ery)\b/i, 'Extra'],
];
const categoriesIn = (text) => CATEGORY_WORDS.filter(([re]) => re.test(text)).map(([, c]) => c);
const colourIn = (text) => COLOURS.find((c) => new RegExp(`\\b${c}\\b`, 'i').test(text)) || (/\bcream|ivory|nude|camel\b/i.test(text) ? 'Beige' : /\bsilver|charcoal\b/i.test(text) ? 'Grey' : /\bgold|mustard\b/i.test(text) ? 'Yellow' : /\bburgundy|maroon\b/i.test(text) ? 'Red' : /\bolive|emerald\b/i.test(text) ? 'Green' : null);
const styleIn = (text) => STYLES.filter((s) => new RegExp(`\\b${s}\\b`, 'i').test(text));
const fabricIn = (text) => FABRICS.find((f) => f !== 'Other' && new RegExp(`\\b${f}\\b`, 'i').test(text)) || null;

// "black tie" → 5 … "casual" → 1 (the five dress-code levels the whole app uses)
function levelFromText(text) {
  const t = String(text || '').toLowerCase();
  if (/black[ -]tie|white[ -]tie|gala|formal|wedding|soir[eé]e|evening wear/.test(t)) return 5;
  if (/cocktail|semi[- ]formal|party|engagement/.test(t)) return 4;
  if (/business casual|business|office|interview|work/.test(t)) return 3;
  if (/smart casual|dinner|date/.test(t)) return 2;
  if (/casual|picnic|brunch|beach|relaxed/.test(t)) return 1;
  return null;
}
const OCCASION_FOR_LEVEL = { 1: 'Everyday', 2: 'Dinner', 3: 'Work', 4: 'Party', 5: 'Wedding' };
function occasionFromText(text, level) {
  const hit = Object.keys(OCCASIONS).find((o) => new RegExp(`\\b${o}\\b`, 'i').test(text || ''));
  return hit || OCCASION_FOR_LEVEL[level] || 'Everyday';
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
function dateFromText(text, now = new Date()) {
  const t = String(text || '').toLowerCase();
  let m = t.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const y = now.getFullYear();
  const make = (d, mo) => { let yy = y; if (new Date(yy, mo, d) < new Date(now.getFullYear(), now.getMonth(), now.getDate())) yy += 1; return `${yy}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`; };
  m = t.match(/(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([a-z]+)/);
  if (m) { const mo = MONTHS.findIndex((x) => x.startsWith(m[2].slice(0, 3))); if (mo >= 0) return make(Number(m[1]), mo); }
  m = t.match(/([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?/);
  if (m) { const mo = MONTHS.findIndex((x) => x.startsWith(m[1].slice(0, 3))); if (mo >= 0 && m[1].length >= 3) return make(Number(m[2]), mo); }
  m = t.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (m) return make(Number(m[1]), Number(m[2]) - 1);
  return null;
}
function timeFromText(text) {
  const m = String(text || '').toLowerCase().match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/) || String(text || '').match(/\b(\d{1,2}):(\d{2})\b/);
  if (!m) return null;
  let h = Number(m[1]); const min = m[2] || '00';
  if (m[3] === 'pm' && h < 12) h += 12; if (m[3] === 'am' && h === 12) h = 0;
  return h < 24 ? `${String(h).padStart(2, '0')}:${min}` : null;
}

// optional photo in a JSON body: { base64, mime } (≤ 5 MB, jpeg/png/webp)
function photoOf(body) {
  const p = body && body.photo;
  if (!p) return null;
  if (typeof p.base64 !== 'string' || !['image/jpeg', 'image/png', 'image/webp'].includes(p.mime)) throw new AppError(400, 'VALIDATION', 'The photo must be a JPEG, PNG or WebP image.', [{ field: 'photo' }]);
  if (p.base64.length > 7_000_000) throw new AppError(413, 'TOO_LARGE', 'The photo is larger than 5 MB.');
  return { base64: p.base64.replace(/^data:[^,]+,/, ''), mime: p.mime };
}

const bad = (field, message) => new AppError(400, 'VALIDATION', message, [{ field }]);
const pickOccasion = (o) => { if (o && !OCCASIONS[o]) throw bad('occasion', 'Unknown occasion.'); return o || 'Everyday'; };

module.exports = {
  FEATURES, featureFlags, loadContext, brief, look, categoriesIn, colourIn, styleIn, fabricIn, levelFromText, occasionFromText, dateFromText, timeFromText,
  photoOf, bad, pickOccasion, OCCASION_FOR_LEVEL, todayStr, errors, CATEGORIES, COLOURS, STYLES, FABRICS, DRESS_CODES, OCCASIONS,
};
