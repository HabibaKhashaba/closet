// Garment illustrations and the try-on avatar (view layer). One drawing per garment type,
// coloured from the piece's colour, so the closet, the outfit boards and the avatar all match.
// Also used by server/seed/render-catalogue to make the demo closet's studio images.

export const COLOUR_HEX = {
  Black: '#26232A', White: '#F7F5F1', Grey: '#9A979C', Beige: '#D9C3A5', Brown: '#7A5136', Navy: '#26345A',
  Blue: '#7EA2CF', Green: '#8FAE8B', Red: '#B8323F', Pink: '#E7B3BF', Purple: '#8D6CA8', Yellow: '#E8C766',
  Orange: '#E39A6B', Multicolour: '#C9A2C8', Gold: '#C9A24A', Silver: '#BFC3C8',
};

// Garment types the user can pick in "Add a piece" (US-09 category/type), and the drawing for each.
export const TYPES = {
  Top: [['tee', 'T-shirt'], ['ribbed', 'Ribbed top'], ['stripe', 'Striped top'], ['shirt', 'Shirt'], ['blouse', 'Blouse'], ['sweater', 'Sweater']],
  Bottom: [['pants', 'Trousers'], ['wide', 'Wide-leg trousers'], ['jeans', 'Jeans'], ['skirt', 'Skirt']],
  Dress: [['dress', 'Midi dress'], ['floral', 'Floral dress'], ['gown', 'Evening dress']],
  Layer: [['blazer', 'Blazer'], ['trench', 'Trench coat'], ['jacket', 'Denim jacket'], ['cardigan', 'Cardigan']],
  Shoes: [['sneaker', 'Sneakers'], ['loafer', 'Loafers'], ['heel', 'Heels'], ['boot', 'Ankle boots']],
  Extra: [['bag', 'Structured bag'], ['tote', 'Tote bag'], ['scarf', 'Scarf'], ['earrings', 'Earrings'], ['necklace', 'Necklace'], ['sunglasses', 'Sunglasses']],
};
export const DEFAULT_TYPE = { Top: 'tee', Bottom: 'pants', Dress: 'dress', Layer: 'blazer', Shoes: 'sneaker', Bag: 'bag', Extra: 'scarf' };

// The drawing for a piece, guessed from its name ("Navy blazer" → blazer). Used by the try-on avatar.
const TYPE_WORDS = [
  [/cami|blouse/, 'blouse'], [/rib/, 'ribbed'], [/strip|breton/, 'stripe'], [/shirt|oxford/, 'shirt'], [/sweater|knit|jumper/, 'sweater'], [/tee|t-shirt/, 'tee'],
  [/wide/, 'wide'], [/jean/, 'jeans'], [/skirt/, 'skirt'], [/trouser|pant/, 'pants'],
  [/gown/, 'gown'], [/floral/, 'floral'], [/dress/, 'dress'],
  [/blazer/, 'blazer'], [/trench|coat/, 'trench'], [/jacket/, 'jacket'], [/cardigan/, 'cardigan'],
  [/sneaker|trainer/, 'sneaker'], [/loafer|sandal|flat/, 'loafer'], [/heel|pump/, 'heel'], [/boot/, 'boot'],
  [/tote/, 'tote'], [/bag|clutch|purse/, 'bag'], [/scarf/, 'scarf'], [/earring|hoop/, 'earrings'], [/necklace/, 'necklace'], [/sunglass/, 'sunglasses'],
];
export function inferType(p) {
  const n = (p.name || '').toLowerCase();
  const hit = TYPE_WORDS.find(([re]) => re.test(n));
  return p.itemType || (hit ? hit[1] : DEFAULT_TYPE[p.category] || 'tee');
}
export const BAG_TYPES = ['bag', 'tote'];

function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function shade(h, f) {
  const [r, g, b] = hexToRgb(h);
  const m = (c) => Math.round(f < 1 ? c * f : c + (255 - c) * (f - 1));
  return `#${[m(r), m(g), m(b)].map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0')).join('')}`;
}
const isDark = (h) => { const [r, g, b] = hexToRgb(h); return 0.299 * r + 0.587 * g + 0.114 * b < 110; };

let uid = 0;
export function garmentSVG(piece, attrs = '') {
  const type = piece.itemType || inferType(piece);
  const base = COLOUR_HEX[piece.colour] || '#C9C3C0';
  const id = `g${(uid += 1)}`;
  const light = shade(base, 1.18);
  const dark = shade(base, 0.8);
  const edge = isDark(base) ? shade(base, 0.6) : shade(base, 0.66);
  const det = isDark(base) ? 'rgba(255,255,255,.22)' : 'rgba(40,30,30,.22)';
  const fill = `fill="url(#${id}f)" stroke="${edge}" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"`;
  const line = `fill="none" stroke="${det}" stroke-width="1.1" stroke-linecap="round"`;
  const fold = `fill="none" stroke="${isDark(base) ? 'rgba(255,255,255,.10)' : 'rgba(40,30,30,.10)'}" stroke-width="2.4" stroke-linecap="round"`;
  const texture = {
    denim: `<pattern id="${id}t" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="3" height="3" fill="none"/><path d="M0 0V3" stroke="rgba(255,255,255,.18)" stroke-width="1"/></pattern>`,
    knit: `<pattern id="${id}t" width="5" height="4" patternUnits="userSpaceOnUse"><path d="M0 0 L2.5 3 L5 0" fill="none" stroke="${det}" stroke-width=".6"/></pattern>`,
    rib: `<pattern id="${id}t" width="2.6" height="10" patternUnits="userSpaceOnUse"><path d="M1.3 0V10" stroke="${det}" stroke-width=".7"/></pattern>`,
  };
  const tex = { jeans: 'denim', jacket: 'denim', sweater: 'knit', cardigan: 'knit', ribbed: 'rib' }[type];
  const defs = `<defs><linearGradient id="${id}f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${light}"/><stop offset=".55" stop-color="${base}"/><stop offset="1" stop-color="${dark}"/></linearGradient>
    <linearGradient id="${id}s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>${tex ? texture[tex] : ''}</defs>`;
  const overlay = (d) => (tex ? `<path d="${d}" fill="url(#${id}t)"/>` : '');
  const sheen = (d) => `<path d="${d}" fill="url(#${id}s)" opacity=".7"/>`;
  const longSleeve = 'M42 18 Q34 20 27 25 L15 70 Q15 74 19 75 L26 76 L35 48 L35 103 Q60 106 85 103 L85 48 L94 76 L101 75 Q105 74 105 70 L93 25 Q86 20 78 18 Q60 28 42 18 Z';
  const teeBody = 'M42 19 Q34 21 27 26 L14 42 Q13 45 15 47 L25 55 L34 48 L34 101 Q60 104 86 101 L86 48 L95 55 L105 47 Q107 45 106 42 L93 26 Q86 21 78 19 Q60 31 42 19 Z';
  const S = {
    tee: `<path ${fill} d="${teeBody}"/><path ${line} d="M45 21 Q60 30 75 21"/><path ${fold} d="M48 60 Q52 80 47 98 M72 62 Q69 82 74 98"/><path ${line} d="M26 52 L33 46 M94 52 L87 46"/>`,
    stripe: `<path ${fill} d="${teeBody}"/><clipPath id="${id}c"><path d="${teeBody}"/></clipPath><g clip-path="url(#${id}c)">${[38, 48, 58, 68, 78, 88, 98].map((y) => `<rect x="0" y="${y}" width="120" height="4" fill="#26345A" opacity=".85"/>`).join('')}</g><path ${line} d="M45 21 Q60 30 75 21"/>`,
    ribbed: `<path ${fill} d="${longSleeve}"/>${overlay(longSleeve)}<path ${line} d="M46 20 Q60 27 74 20 M36 98 H84"/><path ${fold} d="M50 56 Q47 78 52 99"/>`,
    shirt: `<path ${fill} d="${longSleeve}"/><path ${fill} d="M42 18 L60 30 L52 38 L44 26 Z M78 18 L60 30 L68 38 L76 26 Z"/><path ${line} d="M60 31 V103 M18 70 L25 72 M102 70 L95 72"/>${[46, 60, 74, 88].map((y) => `<circle cx="63" cy="${y}" r="1.5" fill="${edge}"/>`).join('')}<path ${line} d="M40 52 H52 V60"/><path ${fold} d="M47 66 Q51 84 46 100 M75 66 Q71 84 76 100"/>`,
    blouse: `<path ${fill} d="${longSleeve}"/>${sheen('M38 30 Q48 60 40 100 L50 100 Q58 60 50 30 Z')}<path ${line} d="M46 19 Q60 40 74 19"/><path ${line} d="M36 60 Q60 68 84 60"/><path ${fold} d="M52 70 Q56 86 52 101 M70 70 Q66 86 70 101"/>`,
    sweater: `<path ${fill} d="${longSleeve}"/>${overlay(longSleeve)}<path ${line} d="M46 20 Q60 28 74 20 M46 24 Q60 32 74 24 M35 96 H85 M35 99 H85 M16 66 L26 69 M104 66 L94 69"/>`,
    cardigan: `<path ${fill} d="${longSleeve}"/>${overlay(longSleeve)}<path ${fill} d="M46 19 L60 58 L74 19"/><path ${line} d="M60 58 V103"/>${[66, 78, 90].map((y) => `<circle cx="56" cy="${y}" r="1.9" fill="${edge}"/>`).join('')}`,
    blazer: `<path ${fill} d="${longSleeve}"/><path ${fill} d="M42 18 L57 60 L50 64 L38 34 Z M78 18 L63 60 L70 64 L82 34 Z"/><path ${line} d="M60 60 V103 M39 84 H52 M68 84 H81 M42 48 H52"/><circle cx="61" cy="72" r="2" fill="${edge}"/><circle cx="61" cy="84" r="2" fill="${edge}"/><path ${fold} d="M45 70 Q48 88 44 101"/>`,
    trench: `<path ${fill} d="M42 14 Q33 17 26 23 L13 78 L25 80 L34 50 L32 112 Q60 116 88 112 L86 50 L95 80 L107 78 L94 23 Q87 17 78 14 Q60 24 42 14 Z"/><path ${fill} d="M42 14 L56 40 L48 46 L36 26 Z M78 14 L64 40 L72 46 L84 26 Z"/><path ${fill} d="M32 66 H88 V72 H32 Z"/><rect x="56" y="64" width="8" height="10" rx="1.5" fill="none" stroke="${edge}" stroke-width="1.4"/>${[[52, 50], [68, 50], [52, 58], [68, 58], [52, 82], [68, 82]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.7" fill="${edge}"/>`).join('')}<path ${line} d="M60 74 V112 M17 74 L24 76 M103 74 L96 76"/><path ${fold} d="M44 80 Q42 96 46 111 M76 80 Q78 96 74 111"/>`,
    jacket: `<path ${fill} d="M42 20 Q34 22 27 27 L15 72 L26 75 L35 50 L35 96 Q60 99 85 96 L85 50 L94 75 L105 72 L93 27 Q86 22 78 20 Q60 30 42 20 Z"/>${overlay('M42 20 Q34 22 27 27 L15 72 L26 75 L35 50 L35 96 Q60 99 85 96 L85 50 L94 75 L105 72 L93 27 Q86 22 78 20 Q60 30 42 20 Z')}<path ${fill} d="M42 20 L52 34 L60 30 L68 34 L78 20"/><path fill="none" stroke="#E2B26B" stroke-width="1" stroke-dasharray="2 2" d="M60 32 V96 M38 52 H54 V64 H38 Z M66 52 H82 V64 H66 Z M35 86 H85"/>${[44, 58, 72, 86].map((y) => `<circle cx="63" cy="${y}" r="1.7" fill="#B8894A"/>`).join('')}`,
    pants: `<path ${fill} d="M35 14 L85 14 L92 106 L66 106 L60 46 L54 106 L28 106 Z"/><path ${line} d="M35 22 H85 M60 22 V40 M46 30 L43 104 M74 30 L77 104"/><path ${fold} d="M40 60 Q42 80 38 104"/>`,
    wide: `<path ${fill} d="M37 14 L83 14 L100 106 L66 106 L60 48 L54 106 L20 106 Z"/><path ${line} d="M37 22 H83 M60 22 V42 M46 30 L36 104 M74 30 L84 104"/><path ${fold} d="M30 70 Q28 88 26 104 M90 70 Q92 88 94 104"/>`,
    jeans: `<path ${fill} d="M37 14 L83 14 L84 106 L65 106 L60 46 L55 106 L36 106 Z"/>${overlay('M37 14 L83 14 L84 106 L65 106 L60 46 L55 106 L36 106 Z')}${sheen('M42 30 L50 30 L49 100 L42 100 Z')}${sheen('M70 30 L78 30 L78 100 L71 100 Z')}<path fill="none" stroke="#E2B26B" stroke-width="1" stroke-dasharray="2 1.6" d="M37 22 H83 M43 22 Q45 34 54 35 M77 22 Q75 34 66 35 M60 22 V40"/><circle cx="60" cy="18" r="1.6" fill="#B8894A"/>`,
    skirt: `<path ${fill} d="M38 22 L82 22 L100 98 Q60 104 20 98 Z"/><path ${line} d="M38 30 H82"/>${[0, 1, 2, 3, 4, 5, 6].map((i) => { const x = 42 + i * 6; const xb = 26 + i * 11.3; return `<path ${line} d="M${x} 30 L${xb} 99"/>`; }).join('')}`,
    dress: `<path ${fill} d="M47 10 L51 10 Q60 20 69 10 L73 10 L80 22 L74 28 L71 50 L88 108 Q60 113 32 108 L49 50 L46 28 L40 22 Z"/>${sheen('M52 52 L58 52 L50 106 L42 106 Z')}<path ${line} d="M49 50 Q60 55 71 50"/><path ${fold} d="M58 60 Q56 84 56 108 M66 60 Q70 84 74 107"/>`,
    floral: `<path ${fill} d="M47 10 L51 10 Q60 20 69 10 L73 10 L80 22 L74 28 L71 50 L88 108 Q60 113 32 108 L49 50 L46 28 L40 22 Z"/><clipPath id="${id}c"><path d="M47 10 L51 10 Q60 20 69 10 L73 10 L80 22 L74 28 L71 50 L88 108 Q60 113 32 108 L49 50 L46 28 L40 22 Z"/></clipPath><g clip-path="url(#${id}c)">${[[54, 24], [66, 34], [50, 62], [64, 70], [76, 92], [44, 94], [58, 100], [68, 52], [40, 80], [58, 84], [82, 104]].map(([x, y]) => `<g transform="translate(${x} ${y})">${[0, 72, 144, 216, 288].map((a) => `<circle cx="${(2.6 * Math.cos((a * Math.PI) / 180)).toFixed(2)}" cy="${(2.6 * Math.sin((a * Math.PI) / 180)).toFixed(2)}" r="1.9" fill="#FFF7E6" opacity=".9"/>`).join('')}<circle r="1.2" fill="#E8C766"/></g>`).join('')}</g><path ${line} d="M49 50 Q60 55 71 50"/>`,
    gown: `<path ${fill} d="M49 8 L53 8 Q60 16 67 8 L71 8 L72 40 L68 50 Q80 80 96 114 Q60 119 24 114 Q40 80 52 50 L48 40 Z"/>${sheen('M53 52 L59 52 L44 112 L34 112 Z')}<path ${line} d="M52 50 Q60 54 68 50"/><path ${fold} d="M60 58 Q58 88 56 114 M66 58 Q72 88 80 114"/>`,
    sneaker: `<path ${fill} d="M14 76 Q15 58 30 55 L48 49 Q58 62 78 64 L100 70 Q108 74 106 82 L14 82 Z"/><path fill="#FBFAF7" stroke="${shade('#D9D4CC', 0.8)}" stroke-width="1.4" d="M12 82 L108 82 Q108 90 104 92 L16 92 Q12 90 12 82 Z"/><path ${line} d="M42 56 L48 64 M48 53 L55 61 M54 51 L61 59 M18 72 Q40 70 60 74"/><path fill="none" stroke="${edge}" stroke-width="1" d="M80 66 Q90 70 102 72"/>`,
    loafer: `<path ${fill} d="M12 80 Q14 60 38 60 L70 58 Q98 60 106 78 L106 84 L12 84 Z"/>${sheen('M30 62 L54 60 L52 68 L30 70 Z')}<path fill="${shade(base, 0.55)}" d="M12 84 H106 V90 Q60 93 12 90 Z"/><path ${line} d="M56 64 Q72 61 86 68 M60 70 H76"/>`,
    heel: `<path ${fill} d="M16 84 Q20 62 40 58 Q62 72 86 52 L98 52 L98 64 L92 66 L92 98 L87 98 L84 72 Q60 90 26 90 Z"/>${sheen('M30 62 L48 62 L44 70 L28 72 Z')}<path ${line} d="M38 62 Q50 72 64 69"/>`,
    boot: `<path ${fill} d="M40 18 L72 18 L74 62 Q96 66 104 80 L104 92 L22 92 L24 70 Q34 64 38 52 Z"/><path fill="${shade(base, 0.55)}" d="M22 92 H104 V98 H22 Z"/><path ${line} d="M42 26 H70 M56 26 V60 M40 52 Q56 56 72 52"/>`,
    bag: `<path fill="none" stroke="${edge}" stroke-width="3.2" d="M42 50 Q42 22 60 22 Q78 22 78 50"/><path ${fill} d="M22 50 L98 50 L92 104 Q60 107 28 104 Z"/><path ${fill} d="M22 50 L98 50 L94 72 Q60 80 26 72 Z"/>${sheen('M30 54 L44 54 L40 100 L32 100 Z')}<rect x="55" y="70" width="10" height="8" rx="1.5" fill="#D9B45A" stroke="${shade('#D9B45A', 0.7)}" stroke-width="1"/>`,
    tote: `<path fill="none" stroke="${edge}" stroke-width="3" d="M40 42 Q40 16 50 16 Q60 16 60 42 M60 42 Q60 16 70 16 Q80 16 80 42"/><path ${fill} d="M24 42 L96 42 L91 106 Q60 109 29 106 Z"/><path ${line} d="M28 54 H92"/><path ${fold} d="M42 60 Q40 84 44 104"/>`,
    scarf: `<path ${fill} d="M26 20 Q60 34 94 20 L90 44 Q60 56 30 44 Z"/><path ${fill} d="M68 46 L84 106 L68 106 L58 50 Z"/>${[[40, 30], [58, 36], [76, 30], [72, 70], [76, 92]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="#F7F5F1" opacity=".75"/><circle cx="${x}" cy="${y}" r="1.2" fill="#26345A" opacity=".6"/>`).join('')}<path ${line} d="M70 100 V108 M75 100 V108 M80 100 V108"/>`,
    earrings: `<path fill="none" stroke="#B48A35" stroke-width="2" stroke-linecap="round" d="M34 26 Q34 18 40 18 M86 26 Q86 18 92 18"/><circle cx="34" cy="56" r="24" fill="none" stroke="#C9A24A" stroke-width="5"/><circle cx="34" cy="56" r="24" fill="none" stroke="#F3DC94" stroke-width="1.6" stroke-dasharray="14 60"/><circle cx="86" cy="56" r="24" fill="none" stroke="#C9A24A" stroke-width="5"/><circle cx="86" cy="56" r="24" fill="none" stroke="#F3DC94" stroke-width="1.6" stroke-dasharray="14 60"/>`,
    necklace: `<path fill="none" stroke="#C9A24A" stroke-width="2.4" d="M24 18 Q28 76 60 84 Q92 76 96 18"/><circle cx="60" cy="92" r="7" fill="#C9A24A" stroke="#9E7B2C" stroke-width="1.2"/><circle cx="58" cy="90" r="2" fill="#F3DC94"/>`,
    sunglasses: `<rect ${fill} x="12" y="44" width="42" height="30" rx="14"/><rect ${fill} x="66" y="44" width="42" height="30" rx="14"/><path fill="none" stroke="${edge}" stroke-width="3" d="M54 54 Q60 48 66 54 M12 50 L4 44 M108 50 L116 44"/><path fill="none" stroke="rgba(255,255,255,.4)" stroke-width="3" stroke-linecap="round" d="M20 52 L30 62 M74 52 L84 62"/>`,
  };
  return `<svg viewBox="0 0 120 120" aria-hidden="true" ${attrs}>${defs}${S[type] || S.tee}</svg>`;
}

// Stylised try-on avatar (prototype concept): the pieces are drawn on a figure in their own colours.
export const SKIN_TONES = ['#F3D6C1', '#E9C2A6', '#C99A78', '#8D5B3E'];
export function avatarSVG(pieces, tone = SKIN_TONES[1]) {
  const ln = 'stroke="#3A2E2E" stroke-width="1.6" stroke-linejoin="round"';
  const put = (p, x, y, w, h, keep) => garmentSVG(p, `x="${x}" y="${y}" width="${w}" height="${h}" ${keep ? '' : 'preserveAspectRatio="none"'}`);
  const hair = '#3B2A26';
  const body = `<ellipse cx="150" cy="574" rx="84" ry="10" fill="rgba(35,31,32,.10)"/>
    <ellipse cx="150" cy="74" rx="38" ry="44" fill="${hair}"/><path d="M112 80 Q106 150 124 168 L176 168 Q194 150 188 80 Z" fill="${hair}"/>
    <rect x="140" y="100" width="20" height="30" fill="${tone}" ${ln}/>
    <ellipse cx="150" cy="80" rx="28" ry="33" fill="${tone}" ${ln}/>
    <path d="M114 60 Q150 28 186 60 Q170 46 150 50 Q130 46 114 60Z" fill="${hair}"/>
    <path d="M140 84h.01M160 84h.01" stroke="#2A2222" stroke-width="4" stroke-linecap="round"/><path d="M144 98 Q150 102 156 98" fill="none" stroke="#9A4A55" stroke-width="2" stroke-linecap="round"/>
    <path d="M104 132 Q150 120 196 132 L204 288 L96 288 Z" fill="${tone}" ${ln}/>
    <path d="M104 134 L80 272 L94 276 L114 168" fill="${tone}" ${ln}/><path d="M196 134 L220 272 L206 276 L186 168" fill="${tone}" ${ln}/>
    <path d="M104 286 L196 286 L188 548 L160 548 L150 330 L140 548 L112 548 Z" fill="${tone}" ${ln}/>`;
  pieces = pieces.filter(Boolean).map((p) => ({ ...p, itemType: inferType(p) }));
  const byCat = (c) => pieces.filter((p) => p.category === c || (c === 'Extra' && p.category === 'Bag'));
  const top = byCat('Top')[0]; const dress = byCat('Dress')[0]; const bottom = byCat('Bottom')[0];
  const shoes = byCat('Shoes')[0]; const layer = byCat('Layer')[0]; const extras = byCat('Extra');
  let g = '';
  if (bottom) g += (bottom.itemType === 'skirt' ? put(bottom, 52, 236, 196, 290) : put(bottom, 58, 236, 184, 324));
  if (shoes) g += put(shoes, 90, 508, 66, 62, true) + put(shoes, 144, 508, 66, 62, true);
  if (dress) g += put(dress, 18, 64, 264, 476);
  if (top) g += put(top, 56, 92, 188, 236);
  if (layer) g += `<g opacity=".96">${put(layer, 50, 86, 200, layer.itemType === 'trench' ? 300 : 250)}</g>`;
  for (const x of extras) {
    const t = x.itemType || 'bag';
    if (t === 'bag') g += put(x, 198, 236, 92, 92, true);
    else if (t === 'tote') g += put(x, 194, 224, 104, 110, true);
    else if (t === 'necklace') g += put(x, 122, 108, 56, 52, true);
    else if (t === 'earrings') g += put(x, 116, 78, 68, 30);
    else if (t === 'sunglasses') g += put(x, 118, 66, 64, 38);
    else if (t === 'scarf') g += put(x, 104, 102, 92, 108, true);
  }
  return `<svg viewBox="0 0 300 600" role="img" aria-label="Avatar wearing the outfit">${body}${g}</svg>`;
}
