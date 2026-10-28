// Stylised try-on avatar (view layer). A flat fashion figure; each piece is drawn as a garment
// shape fitted to the body, coloured from the piece and patterned from its name (stripes, denim,
// knit, pleats). Pure SVG string, no images — the real photo try-on is an external service.
import { inferType } from './garments.js';

export const SKIN_TONES = ['#F3D6C1', '#E6BFA0', '#C99A78', '#8D5B3E'];
const HEX = {
  Black: '#2b282d', White: '#f6f3ee', Grey: '#a19ea3', Beige: '#d8c2a2', Brown: '#7a5338', Navy: '#28375e', Blue: '#86a8d3', Green: '#9ab595',
  Red: '#b8323f', Pink: '#e9b6c1', Purple: '#8f6eaa', Yellow: '#d9b45a', Orange: '#e39a6b', Multicolour: '#c9a2c8',
};
const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
function shade(h, f) {
  const m = (c) => Math.round(f < 1 ? c * f : c + (255 - c) * (f - 1));
  return `#${rgb(h).map((c) => Math.max(0, Math.min(255, m(c))).toString(16).padStart(2, '0')).join('')}`;
}
const dark = (h) => { const [r, g, b] = rgb(h); return 0.299 * r + 0.587 * g + 0.114 * b < 110; };

let n = 0;
function paint(p) {
  const striped = /strip|breton/i.test(p.name || '');
  const base = striped ? '#f6f3ee' : p.colour === 'White' && /ivory|cream/i.test(p.name || '') ? '#efe6d6' : p.colour === 'Beige' && /cream/i.test(p.name || '') ? '#ebdfca' : HEX[p.colour] || '#c9c3c0';
  const id = `av${(n += 1)}`;
  const edge = shade(base, dark(base) ? 0.55 : 0.7);
  const detail = dark(base) ? 'rgba(255,255,255,.22)' : 'rgba(50,35,30,.22)';
  const name = (p.name || '').toLowerCase();
  let pattern = '';
  if (/strip|breton/.test(name)) pattern = `<pattern id="${id}p" width="10" height="11" patternUnits="userSpaceOnUse"><rect width="10" height="5" fill="${HEX[p.colour] && p.colour !== 'White' ? HEX[p.colour] : '#28375e'}"/></pattern>`;
  else if (/denim|jean/.test(name) || p.fabric === 'Denim') pattern = `<pattern id="${id}p" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><path d="M0 0V4" stroke="rgba(255,255,255,.16)" stroke-width="1.2"/></pattern>`;
  else if (/knit|sweater|cardigan|rib/.test(name) || p.fabric === 'Knit') pattern = `<pattern id="${id}p" width="5" height="6" patternUnits="userSpaceOnUse"><path d="M0 0 L2.5 4 L5 0" fill="none" stroke="${detail}" stroke-width=".7"/></pattern>`;
  else if (/scarf/.test(name)) pattern = `<pattern id="${id}p" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="7" cy="7" r="3.2" fill="none" stroke="#d1aa5e" stroke-width="1.6"/></pattern>`;
  const defs = `<defs><linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${shade(base, 0.86)}"/><stop offset=".45" stop-color="${shade(base, 1.08)}"/><stop offset="1" stop-color="${shade(base, 0.8)}"/></linearGradient>${pattern}</defs>`;
  const fill = (d) => `<path d="${d}" fill="url(#${id}g)" stroke="${edge}" stroke-width="1.6" stroke-linejoin="round"/>${pattern ? `<path d="${d}" fill="url(#${id}p)" opacity="${/strip|breton/.test(name) ? 0.95 : 1}"/>` : ''}`;
  const line = (d, w = 1.2) => `<path d="${d}" fill="none" stroke="${detail}" stroke-width="${w}" stroke-linecap="round"/>`;
  return { defs, fill, line, base, edge, id };
}

// ---------- the figure ----------
function figure(skin, hair) {
  const ln = `stroke="${shade(skin, 0.7)}" stroke-width="1.4" stroke-linejoin="round"`;
  return `
    <ellipse cx="150" cy="610" rx="78" ry="9" fill="rgba(60,40,35,.12)"/>
    <path d="M118 66 Q116 30 150 28 Q184 30 182 66 L186 150 Q170 162 150 160 Q130 162 114 150 Z" fill="${hair}"/>
    <path d="M106 128 L88 296 Q87 306 94 307 L104 305 L118 172 Z" fill="${skin}" ${ln}/>
    <path d="M194 128 L212 296 Q213 306 206 307 L196 305 L182 172 Z" fill="${skin}" ${ln}/>
    <path d="M116 270 L113 578 L137 578 L149 300 L151 300 L163 578 L187 578 L184 270 Z" fill="${skin}" ${ln}/>
    <path d="M106 128 Q150 112 194 128 L186 272 L114 272 Z" fill="${skin}" ${ln}/>
    <rect x="140" y="92" width="20" height="30" rx="6" fill="${skin}" ${ln}/>
    <ellipse cx="150" cy="70" rx="25" ry="30" fill="${skin}" ${ln}/>
    <path d="M124 62 Q130 34 152 36 Q174 38 178 64 Q168 48 150 50 Q134 50 124 62 Z" fill="${hair}"/>
    <path d="M140 72 h.01 M160 72 h.01" stroke="#2a2222" stroke-width="3.6" stroke-linecap="round"/>
    <path d="M137 64 q4 -3 8 0 M155 64 q4 -3 8 0" fill="none" stroke="${shade(hair, 1.1)}" stroke-width="1.4" stroke-linecap="round"/>
    <path d="M145 86 Q150 89 155 86" fill="none" stroke="#a14f5a" stroke-width="2" stroke-linecap="round"/>
    <circle cx="136" cy="80" r="5" fill="#e8a3a3" opacity=".25"/><circle cx="164" cy="80" r="5" fill="#e8a3a3" opacity=".25"/>`;
}

// ---------- garments ----------
const TORSO = 'M106 128 Q126 120 140 118 Q150 128 160 118 Q174 120 194 128';
function top(p, t) {
  const g = paint(p);
  const long = ['shirt', 'blouse', 'sweater', 'ribbed'].includes(t) && !/cami/.test((p.name || '').toLowerCase());
  const cami = /cami/.test((p.name || '').toLowerCase());
  let s = g.defs;
  if (cami) {
    s += g.fill('M120 140 Q150 150 180 140 L186 262 Q150 268 114 262 Z');
    s += `<path d="M126 141 L132 120 M174 141 L168 120" stroke="${g.edge}" stroke-width="2"/>`;
    return s;
  }
  const sleeveL = long ? 'M106 128 L86 294 L104 298 L120 176' : 'M106 128 L94 184 L114 190 L120 160';
  const sleeveR = long ? 'M194 128 L214 294 L196 298 L180 176' : 'M194 128 L206 184 L186 190 L180 160';
  s += g.fill(`${sleeveL} Z`) + g.fill(`${sleeveR} Z`);
  s += g.fill(`${TORSO} L188 268 Q150 274 112 268 Z`);
  if (t === 'shirt') {
    s += g.line('M150 128 V268', 1.4) + [150, 176, 202, 228, 254].map((y) => `<circle cx="153" cy="${y}" r="1.8" fill="${g.edge}"/>`).join('');
    s += g.fill('M140 118 L150 134 L141 144 L132 124 Z') + g.fill('M160 118 L150 134 L159 144 L168 124 Z');
    s += `<path d="M86 288 L104 292 M214 288 L196 292" stroke="${g.edge}" stroke-width="3"/>`;
  } else if (t === 'blouse') {
    s += g.line('M138 120 Q150 150 162 120', 1.4) + g.line('M144 140 q6 8 12 0', 1);
  } else {
    s += g.line('M138 120 Q150 132 162 120', 1.6);
    if (t === 'sweater' || t === 'ribbed') s += g.line('M112 262 H188', 2.4) + g.line('M88 284 L104 288 M212 284 L196 288', 2.4);
  }
  return s;
}
function bottom(p, t) {
  const g = paint(p);
  let s = g.defs;
  if (t === 'skirt') {
    const pleated = /pleat/.test((p.name || '').toLowerCase());
    s += g.fill('M116 262 L184 262 L206 470 Q150 480 94 470 Z');
    s += g.fill('M116 262 L184 262 L185 276 L115 276 Z');
    if (pleated) s += [0, 1, 2, 3, 4, 5, 6, 7].map((i) => g.line(`M${122 + i * 8} 278 L${100 + i * 14.5} 472`, 1)).join('');
    else s += g.line('M136 290 Q130 380 118 466', 2) + g.line('M164 290 Q170 380 182 466', 2);
    return s;
  }
  const wide = t === 'wide';
  const legs = wide ? 'M114 262 L186 262 L204 580 L156 580 L150 312 L144 580 L96 580 Z' : 'M114 262 L186 262 L188 576 L160 576 L150 312 L140 576 L112 576 Z';
  s += g.fill(legs);
  s += g.fill('M114 262 L186 262 L186 276 L114 276 Z');
  s += g.line('M150 278 V306', 1.4);
  if (t === 'jeans') s += g.line('M120 282 Q128 296 140 284 M180 282 Q172 296 160 284', 1.4) + `<path d="M114 262 L186 262 L186 276 L114 276 Z" fill="none" stroke="#c7a15c" stroke-width="1" stroke-dasharray="3 3"/>`;
  else s += g.line(wide ? 'M128 300 L114 574 M172 300 L186 574' : 'M127 300 L126 572 M173 300 L174 572', 1.6);
  return s;
}
function dress(p) {
  const g = paint(p);
  let s = g.defs;
  const wrap = /wrap/.test((p.name || '').toLowerCase());
  s += g.fill('M106 128 L96 176 L116 182 L120 158 Z') + g.fill('M194 128 L204 176 L184 182 L180 158 Z');
  s += g.fill('M106 128 Q126 120 140 118 L150 148 L160 118 Q174 120 194 128 L184 242 L214 494 Q150 506 86 494 L116 242 Z');
  s += g.fill('M116 236 L184 236 L184 248 L116 248 Z');
  s += wrap ? g.line('M140 120 L166 236', 1.6) + g.line('M184 244 Q194 262 186 286', 2.2) : g.line('M150 250 Q146 380 136 490', 2) + g.line('M170 252 Q182 380 192 488', 1.6);
  s += `<path d="M126 170 Q132 220 128 236" fill="none" stroke="#fff" stroke-width="5" opacity=".14"/>`;
  return s;
}
function layer(p, t) {
  const g = paint(p);
  let s = g.defs;
  const hem = t === 'trench' ? 450 : t === 'blazer' ? 312 : t === 'cardigan' ? 300 : 276;
  const sleeves = 'M104 126 L82 298 L104 304 L120 178 Z|M196 126 L218 298 L196 304 L180 178 Z';
  sleeves.split('|').forEach((d) => { s += g.fill(d); });
  s += g.fill(`M104 126 Q122 118 138 116 L146 ${hem - 120} L142 ${hem} L${t === 'trench' ? 96 : 108} ${hem} Z`);
  s += g.fill(`M196 126 Q178 118 162 116 L154 ${hem - 120} L158 ${hem} L${t === 'trench' ? 204 : 192} ${hem} Z`);
  if (t === 'blazer' || t === 'trench') {
    s += g.fill('M138 116 L150 196 L136 204 L124 150 Z') + g.fill('M162 116 L150 196 L164 204 L176 150 Z');
    s += [228, 262].map((y) => `<circle cx="144" cy="${y}" r="2.6" fill="${g.edge}"/>`).join('');
    if (t === 'blazer') s += g.line('M114 270 H136 M164 270 H186', 1.6);
  }
  if (t === 'trench') s += g.fill('M104 262 L196 262 L196 274 L104 274 Z') + `<rect x="141" y="260" width="18" height="16" rx="2" fill="none" stroke="${g.edge}" stroke-width="2"/>`;
  if (t === 'jacket') s += g.line('M112 196 H140 M160 196 H188', 1.6) + [180, 210, 240].map((y) => `<circle cx="145" cy="${y}" r="2" fill="#c7a15c"/>`).join('');
  if (t === 'cardigan') s += [170, 206, 242, 278].map((y) => `<circle cx="144" cy="${y}" r="2.2" fill="${g.edge}"/>`).join('');
  return s;
}
function shoes(p, t) {
  const g = paint(p);
  let s = g.defs;
  const one = (x, flip) => {
    const k = flip ? -1 : 1;
    const X = (v) => x + v * k;
    if (t === 'boot') return g.fill(`M${X(-14)} 548 L${X(12)} 548 L${X(14)} 590 L${X(30)} 594 L${X(30)} 604 L${X(-16)} 604 Z`);
    if (t === 'heel') return g.fill(`M${X(-12)} 576 L${X(10)} 578 L${X(26)} 600 L${X(-4)} 600 Z`) + `<path d="M${X(-11)} 596 L${X(-11)} 608" stroke="${g.edge}" stroke-width="3"/>`;
    if (t === 'sneaker') return g.fill(`M${X(-14)} 574 L${X(10)} 574 L${X(30)} 592 L${X(30)} 600 L${X(-15)} 600 Z`) + `<path d="M${X(-15)} 600 L${X(30)} 600 L${X(30)} 605 L${X(-15)} 605 Z" fill="#fff" stroke="#d8d1c6"/>`;
    return g.fill(`M${X(-14)} 578 L${X(10)} 578 L${X(28)} 594 L${X(28)} 603 L${X(-15)} 603 Z`) + `<path d="M${X(2)} 584 L${X(16)} 590" stroke="#c7a15c" stroke-width="2"/>`;
  };
  s += one(126, true) + one(174, false);
  return s;
}
function bag(p, t) {
  const g = paint(p);
  let s = g.defs;
  if (t === 'tote') {
    s += `<path d="M196 132 Q236 210 228 300" fill="none" stroke="${g.edge}" stroke-width="4"/>`;
    s += g.fill('M204 296 L252 296 L258 360 L198 360 Z');
  } else {
    s += `<path d="M212 300 Q224 276 236 300" fill="none" stroke="${g.edge}" stroke-width="3.4"/>`;
    s += g.fill('M204 300 L246 300 L248 344 L202 344 Z') + g.fill('M204 300 L246 300 L247 318 L203 318 Z') + '<rect x="221" y="314" width="8" height="7" rx="1.5" fill="#d4af6a"/>';
  }
  return s;
}
function extra(p, t) {
  const g = paint(p);
  if (t === 'sunglasses') return `${g.defs}<rect x="131" y="64" width="17" height="12" rx="5" fill="#2c2420" stroke="#6b4428" stroke-width="2"/><rect x="152" y="64" width="17" height="12" rx="5" fill="#2c2420" stroke="#6b4428" stroke-width="2"/><path d="M148 69 h4" stroke="#6b4428" stroke-width="2"/>`;
  if (t === 'earrings') return '<circle cx="125" cy="86" r="5" fill="none" stroke="#c9a24a" stroke-width="2.2"/><circle cx="175" cy="86" r="5" fill="none" stroke="#c9a24a" stroke-width="2.2"/>';
  if (t === 'necklace') return '<path d="M138 120 Q150 146 162 120" fill="none" stroke="#c9a24a" stroke-width="1.8"/><circle cx="150" cy="140" r="3" fill="#c9a24a"/>';
  if (t === 'scarf') return `${g.defs}${g.fill('M132 112 Q150 128 168 112 L172 126 Q150 144 128 126 Z')}${g.fill('M154 132 L166 196 L152 198 L146 136 Z')}`;
  return '';
}

export function avatarSVG(pieces, skin = SKIN_TONES[1]) {
  n = 0;
  const list = pieces.filter(Boolean).map((p) => ({ ...p, t: inferType(p) }));
  const of = (c) => list.filter((p) => p.category === c);
  const [t] = of('Top'); const [b] = of('Bottom'); const [d] = of('Dress'); const [l] = of('Layer'); const [sh] = of('Shoes');
  const bags = of('Bag'); const extras = of('Extra');
  let g = figure(skin, '#3a2a25');
  if (sh) g += shoes(sh, sh.t);
  if (b && b.t !== 'skirt') g += bottom(b, b.t);
  if (t) g += top(t, t.t);
  if (b && b.t === 'skirt') g += bottom(b, b.t);
  if (d) g += dress(d);
  if (l) g += layer(l, l.t);
  for (const x of extras) g += extra(x, x.t);
  for (const x of bags) g += bag(x, x.t);
  return `<svg class="avatar-svg" viewBox="40 10 230 610" role="img" aria-label="Avatar wearing the look">${g}</svg>`;
}
