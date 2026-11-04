// Shared view components (the "V" in MVC): icons, sprint tags, garment tiles, outfit boards,
// score meters, rings, modals, toasts. Screens are built only from these.
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

export const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

// ---------- icons (24px line icons) ----------
const ICONS = {
  home: 'M3 11.5 12 4l9 7.5M5.5 10v10h13V10M10 20v-6h4v6',
  closet: 'M12 4.5a2 2 0 0 1 2 2c0 1.1-.9 1.6-2 2.3V10l8.2 5.2c1 .7.6 2.3-.7 2.3H4.5c-1.3 0-1.7-1.6-.7-2.3L12 10',
  sparkle: 'M12 3v4M12 17v4M3 12h4M17 12h4M12 8.5l1.2 2.3 2.3 1.2-2.3 1.2L12 15.5l-1.2-2.3L8.5 12l2.3-1.2z',
  chat: 'M4 5.5h16v10H9l-5 4z M8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01',
  calendar: 'M4 6h16v14H4zM4 10h16M8.5 3v5M15.5 3v5',
  laundry: 'M5 3h14v18H5zM5 7h14M12 10a4 4 0 1 0 0 8 4 4 0 0 0 0-8M8 5h1',
  chart: 'M4 20V10M10 20V4M16 20v-7M21 20H3',
  bag: 'M5 8h14l-1 12H6zM9 8V6.5a3 3 0 0 1 6 0V8',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20c1.2-3.6 4-5 7.5-5s6.3 1.4 7.5 5',
  plus: 'M12 5v14M5 12h14',
  back: 'M15 5l-7 7 7 7',
  next: 'M9 5l7 7-7 7',
  camera: 'M4 8h4l2-3h4l2 3h4v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  heart: 'M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z',
  bookmark: 'M6.5 4h11v16l-5.5-4-5.5 4z',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  x: 'M6 6l12 12M18 6L6 18',
  swap: 'M7 7h11l-3-3M17 17H6l3 3',
  refresh: 'M19 8a7.5 7.5 0 1 0 .5 6M19 3v5h-5',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4',
  cloud: 'M7 18h10a4 4 0 0 0 .6-8A6 6 0 0 0 6.2 9.3 4.4 4.4 0 0 0 7 18z',
  bell: 'M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  eyeoff: 'M3 3l18 18M10.6 6.2A9.6 9.6 0 0 1 12 6c5 0 8.5 4.5 9 6-.3.9-1.3 2.4-2.9 3.8M6.5 7.6C4.6 8.9 3.4 10.7 3 12c.5 1.5 4 6 9 6 1.5 0 2.9-.4 4.1-1M9.9 10a3 3 0 0 0 4.1 4.1',
  trash: 'M4 7h16M9.5 7V4.5h5V7M6 7l1 13h10l1-13',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  person: 'M12 7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM8 22l1-8H7.5l1.5-5h6l1.5 5H15l1 8',
  shield: 'M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z M9 12l2 2 4-4',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  send: 'M4 12l16-8-6 16-2.5-6.5z',
  undo: 'M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  upload: 'M12 16V4M7 9l5-5 5 5M4 16v4h16v-4',
  star: 'M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.8z',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  wand: 'M5 19 15 9M14 4v2M19 9h2M17.5 5.5l1.5-1.5M18 13l1.5 1.5M11 6.5 9.5 5',
  tag: 'M3 12V4h8l10 10-8 8zM7.5 8.5h.01',
  pin: 'M12 21s-6-5.5-6-11a6 6 0 1 1 12 0c0 5.5-6 11-6 11zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  filter: 'M4 5h16l-6 7.5V19l-4 2v-8.5z',
  suitcase: 'M4 8h16v12H4zM9 8V5h6v3M4 13h16M9 13v2M15 13v2',
  washer: 'M5 3h14v18H5zM5 7h14M8 5h.01M11 5h.01M12 10a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9M9.5 15c1-1 2-1 3 0s2 1 3 0',
  bolt: 'M13 3 5 14h6l-1 7 8-11h-6z',
  plane: 'M3 14l7-2 3-8 2 1-1 7 6 2v2l-6-1-2 5h-2l.5-5-6.5 1z',
  book: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11',
  briefcase: 'M4 8h16v11H4zM9 8V5h6v3M4 13h16',
  ring: 'M12 9a6 6 0 1 0 0 12 6 6 0 0 0 0-12M9.5 4h5L12 8z',
  dinner: 'M7 3v8a2 2 0 0 0 2 2v8M5 3v5M9 3v5M16 21V3c2 1 3 4 3 8h-3',
  history: 'M3 12a9 9 0 1 0 3-6.7M3 4v4h4M12 8v4l3 2',
  lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  activity: 'M3 12h4l3-7 4 14 3-7h4',
  mirror: 'M12 3c4 0 6 3 6 7v11H6V10c0-4 2-7 6-7zM9 18h6',
  brain: 'M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 6 1V5a2 2 0 0 0-3-1zM15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-6 1',
  alert: 'M12 4 2.5 20h19zM12 10v4.5M12 17.5h.01',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7.5 19.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.6 14H3.5a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 5 7.5l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 3.6V3.5a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.6 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.6h.1a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.1.9z',
};
export function Icon({ name, size = 18, fill = 'none', stroke = 1.8, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}>
      <path d={ICONS[name] || ICONS.more} />
    </svg>
  );
}

// ---------- sprint honesty ----------
export const SPRINT = {
  1: { cls: 's1', short: 'Sprint 1', label: 'Sprint 1 · Implemented', note: 'Graded in Milestone 2.' },
  2: { cls: 's2', short: 'Sprint 2', label: 'Sprint 2 · Early preview', note: 'Working on real data, built ahead of Sprint 2. Not part of Sprint 1 grading.' },
  3: { cls: 's3', short: 'Sprint 3', label: 'Sprint 3 · Product preview', note: 'A preview of the full product. Not part of Sprint 1 grading.' },
  4: { cls: 's4', short: 'Stretch', label: 'Stretch goal · Concept preview', note: 'A stretch / future feature shown as a working concept. Not committed for December 1 and not part of Sprint 1 grading.' },
};
export function SprintTag({ n, short }) {
  const s = SPRINT[n];
  return <span className={`tag ${s.cls}`} title={s.note}><span className={`dot ${s.cls}`} style={{ width: 6, height: 6, borderRadius: 9 }} />{short ? s.short : s.label}</span>;
}
export function SprintNote({ n, children }) {
  return (
    <div className="sprint-note"><SprintTag n={n} /><span>{children || SPRINT[n].note}</span></div>
  );
}

export function PageHead({ title, sub, sprint, actions, eyebrow }) {
  return (
    <div className="page-head">
      <div className="stack" style={{ gap: 8 }}>
        <div className="row">{eyebrow && <span className="eyebrow">{eyebrow}</span>}{sprint && <SprintTag n={sprint} />}</div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </div>
  );
}

// ---------- garments ----------
export const CATEGORY_LABEL = { Top: 'Tops', Bottom: 'Bottoms', Dress: 'Dresses', Layer: 'Outerwear', Shoes: 'Shoes', Bag: 'Bags', Extra: 'Accessories' };
export const CATEGORY_ONE = { Top: 'Top', Bottom: 'Bottom', Dress: 'Dress', Layer: 'Outerwear', Shoes: 'Shoes', Bag: 'Bag', Extra: 'Accessory' };
// The garment lifecycle (server: shared/lifecycle.js; the allowed moves come from GET /vocabulary).
export const STATUS_LABEL = { Available: 'Available', Laundry: 'In laundry', Borrowed: 'Borrowed', Packed: 'Packed', 'Needs repair': 'Needs repair', 'Needs alteration': 'Needs alteration', 'At tailor': 'At tailor', 'Ready to donate': 'Ready to donate', Unavailable: 'Unavailable' };
// CSS class for a status badge: "At tailor" → "At-tailor" (one class, no spaces).
export const statusClass = (s) => `status ${String(s || 'Available').replace(/\s+/g, '-')}`;
export const COLOUR_SWATCH = {
  Black: '#26232a', White: '#f8f6f2', Grey: '#a3a0a4', Beige: '#dcc7aa', Brown: '#7b5538', Navy: '#28365c', Blue: '#86a7d1', Green: '#94b090',
  Red: '#b8323f', Pink: '#e8b4c0', Purple: '#8f6eaa', Yellow: '#e3c062', Orange: '#e39a6b', Multicolour: 'conic-gradient(#e8b4c0,#e3c062,#94b090,#86a7d1,#8f6eaa,#e8b4c0)',
};
const NOUN = { Top: 'top', Dress: 'dress', Bottom: 'bottom', Layer: 'layer', Shoes: 'shoes', Bag: 'bag', Extra: 'accessory' };
export const pieceName = (p) => (p ? p.name || [p.colour, p.fabric && p.fabric !== 'Other' ? p.fabric.toLowerCase() : null, NOUN[p.category] || p.category.toLowerCase()].filter(Boolean).join(' ') : '');
export const dressName = (vocab, level) => vocab?.DRESS_CODES?.[level] || `Level ${level}`;
export const daysSince = (d) => (d ? Math.floor((Date.now() - new Date(d)) / 86400000) : null);
export const fmtDate = (iso, opts = { weekday: 'short', day: 'numeric', month: 'short' }) => (iso ? new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString('en-GB', opts) : '');
export const relDay = (iso) => {
  const d = Math.round((new Date(`${iso}T12:00:00`) - new Date(new Date().toISOString().slice(0, 10) + 'T12:00:00')) / 86400000);
  return d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : d === -1 ? 'Yesterday' : d > 1 && d < 7 ? fmtDate(iso, { weekday: 'long' }) : fmtDate(iso);
};

export function Tile({ piece, status = true, children, className = '', dim, onClick, style }) {
  if (!piece) return <div className={`tile ${className}`} style={style} />;
  return (
    <div className={`tile ${piece.category} ${dim || (status && piece.status !== 'Available') ? 'dim' : ''} ${className}`} onClick={onClick} style={style}>
      <img src={piece.photoUrl} alt={pieceName(piece)} loading="lazy" />
      {status && piece.status && piece.status !== 'Available' && <span className={statusClass(piece.status)}>{STATUS_LABEL[piece.status]}</span>}
      {children}
    </div>
  );
}

export function PieceCard({ piece, onClick, children, href }) {
  const meta = piece.status && piece.status !== 'Available' ? STATUS_LABEL[piece.status] : 'Available';  // progressive disclosure: details live on the piece page
  const body = (
    <>
      <Tile piece={piece}>{children}</Tile>
      <div><div className="name">{pieceName(piece)}</div><div className="meta">{meta}</div></div>
    </>
  );
  if (href) return <a className="piece-card" href={href}>{body}</a>;
  return <div className="piece-card" onClick={onClick} role={onClick ? 'button' : undefined} style={{ cursor: onClick ? 'pointer' : undefined }}>{body}</div>;
}

// The four pieces of an outfit as a 2×2 board.
export function Board({ pieces, onSwap, labels = true, small }) {
  const list = pieces.filter(Boolean);
  if (small) return <div className="mini-tiles">{list.map((p) => <Tile key={p.id} piece={p} status={false} />)}</div>;
  return (
    <div className="board">
      {list.map((p, i) => (
        <Tile key={p.id} piece={p} status>
          {labels && <span className="label">{pieceName(p)}</span>}
          {onSwap && <button type="button" className="slot-btn" onClick={() => onSwap(i)}><Icon name="swap" size={13} /> Change</button>}
        </Tile>
      ))}
    </div>
  );
}

// An outfit as an editorial flat lay: garments laid out on a board, overlapping a little,
// with a soft shadow under each — not a grid of rectangles.
const SPOT = {
  dress: { left: '6%', top: '3%', width: '54%', z: 3 },
  top: { left: '5%', top: '3%', width: '47%', z: 3 },
  bottom: { left: '40%', top: '27%', width: '45%', z: 2 },
  layer: { left: '50%', top: '1%', width: '46%', z: 1 },
  layer2: { left: '40%', top: '27%', width: '45%', z: 2 },
  shoes: { left: '8%', top: '63%', width: '33%', z: 4 },
  extra: { left: '63%', top: '66%', width: '30%', z: 5 },
};
export function Look({ pieces, onSwap, labels = false, className = '', style, animate = true, highlight }) {
  const list = pieces.filter(Boolean);
  const hasBottom = list.some((p) => p.category === 'Bottom');
  const placed = list.map((p, i) => {
    const kind = p.category === 'Dress' ? 'dress' : p.category === 'Top' ? 'top' : p.category === 'Bottom' ? 'bottom' : p.category === 'Layer' ? (hasBottom ? 'layer' : 'layer2') : p.category === 'Shoes' ? 'shoes' : 'extra';
    return { p, i, s: SPOT[kind] };
  });
  return (
    <div className={`look ${animate ? 'anim' : ''} ${className}`} style={style}>
      {placed.map(({ p, i, s }) => (
        <div key={p.id} className={`look-piece ${p.status && p.status !== 'Available' && !p.backBy ? 'away' : ''} ${onSwap ? 'can-swap' : ''} ${highlight === p.id ? 'just-in' : ''}`} style={{ left: s.left, top: s.top, width: s.width, zIndex: s.z, animationDelay: `${i * 70}ms` }}>
          <img src={p.photoUrl} alt={pieceName(p)} loading="lazy" onClick={onSwap ? () => onSwap(i) : undefined} title={onSwap ? `Replace ${pieceName(p).toLowerCase()}` : undefined} />
          {labels && <span className="look-label">{pieceName(p)}</span>}
          {onSwap && <button type="button" className="slot-btn" onClick={() => onSwap(i)}><Icon name="swap" size={13} /> Change</button>}
          {p.status && p.status !== 'Available' && !p.backBy && <span className={statusClass(p.status)}>{STATUS_LABEL[p.status]}</span>}
        </div>
      ))}
    </div>
  );
}

// Counts up from 0 to the value (0.6 s), so scores feel computed rather than printed.
export function CountUp({ value, ms = 650, suffix = '', from: start = 0 }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf; const t0 = performance.now(); const from = Number(start) || 0; const to = Number(value) || 0;
    const step = (t) => { const k = Math.min(1, (t - t0) / ms); setN(Math.round(from + (to - from) * (1 - (1 - k) ** 3))); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ms, start]);
  return <>{n}{suffix}</>;
}

export const matchWord = (v) => (v >= 90 ? 'Great match' : v >= 80 ? 'Strong match' : v >= 66 ? 'Good match' : v >= 50 ? 'Needs a change' : 'Doesn’t work yet');

export function Why({ outfit, max = 4 }) {
  if (!outfit.why) return outfit.reasons ? <Reasons list={outfit.reasons.slice(0, max)} /> : null;
  return (
    <div className="why-box">
      {outfit.explanation && <p className="why-sentence">{outfit.explanation}</p>}
      <ul className="factors">
        {outfit.why.slice(0, max + 2).map((f) => <li key={f.factor}><b>{f.factor}</b><span>{f.text}</span></li>)}
      </ul>
    </div>
  );
}

export function Score({ value, label = 'match' }) {
  const cls = value >= 85 ? '' : value >= 66 ? 'mid' : 'low';
  return <span className={`score ${cls}`}>{value}% {label}</span>;
}

export function Ring({ value, size = 120, stroke = 12, color = 'var(--ok)', label }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#efe8e2" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${(c * Math.max(0, Math.min(100, value))) / 100} ${c}`} style={{ transition: 'stroke-dasharray .6s ease' }} />
      </svg>
      <b style={{ fontSize: size / 4.2 }}>{label ?? `${value}%`}</b>
    </div>
  );
}

export function Meters({ o }) {
  const rows = [['Colour', o.colour], ['Style', o.style], ['Formality', o.formality], ['Weather', o.weather]];
  return (
    <div className="meters">
      {rows.map(([k, v]) => (
        <div className="meter" key={k}><span className="muted">{k}</span><div className="bar"><i className={v >= 85 ? '' : v >= 66 ? 'mid' : 'low'} style={{ width: `${v}%` }} /></div><b>{v}%</b></div>
      ))}
    </div>
  );
}

export function Criteria({ list, compact }) {
  return (
    <ul className="crit stack" style={{ gap: compact ? 6 : 9 }}>
      {list.map((c) => (
        <li key={c.name}>
          <span className={c.pass ? 'ok-ico' : 'no-ico'}><Icon name={c.pass ? 'check' : 'x'} size={12} stroke={3} /></span>
          <span><b style={{ color: 'var(--ink)', fontWeight: 600 }}>{c.name}.</b> {c.detail[0].toUpperCase() + c.detail.slice(1)}.</span>
        </li>
      ))}
    </ul>
  );
}

export function Reasons({ list }) {
  return (
    <ul className="why">
      {list.map((r) => <li key={r}><span className="ok-ico"><Icon name="check" size={12} stroke={3} /></span><span>{r}</span></li>)}
    </ul>
  );
}

export function WeatherPill({ w, compact }) {
  if (!w) return <span className="weather"><span className="sun"><Icon name="sun" size={16} /></span><span className="muted">Weather…</span></span>;
  const warm = w.tempC >= 22;
  return (
    <span className="weather" title={w.source === 'estimate' ? `${w.note} — seasonal estimate` : `Live forecast · ${w.source}`}>
      <span className="sun" style={warm ? null : { background: 'var(--sky)', color: 'var(--sky-ink)' }}><Icon name={/rain|cloud|overcast|fog/i.test(w.condition) ? 'cloud' : 'sun'} size={16} /></span>
      <b>{w.tempC}°</b>{!compact && <span>{w.condition}{w.place ? ` · ${w.place}` : ''}</span>}
      <span className="tiny muted">{w.source === 'estimate' ? 'estimate' : 'Open-Meteo'}</span>
    </span>
  );
}

export function Stars({ value, onChange }) {
  return (
    <span className="stars" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button type="button" key={n} className={n <= (value || 0) ? 'on' : ''} onClick={() => onChange(n)} aria-label={`${n} stars`}>
          <Icon name="star" size={18} fill={n <= (value || 0) ? 'currentColor' : 'none'} />
        </button>
      ))}
    </span>
  );
}

// ---------- form bits ----------
export function Field({ label, error, children, hint }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && !error && <small className="muted">{hint}</small>}
      {error && <small className="err" role="alert">{error}</small>}
    </label>
  );
}

export function Chips({ options, value, onChange, multiple = true, render = (o) => o, counts, swatch }) {
  const selected = multiple ? value : [value];
  const toggle = (o) => {
    if (!multiple) return onChange(value === o ? '' : o);
    return onChange(selected.includes(o) ? selected.filter((x) => x !== o) : [...selected, o]);
  };
  return (
    <div className="chips">
      {options.map((o) => (
        <button type="button" key={o} className={`chip ${selected.includes(o) ? 'on' : ''}`} aria-pressed={selected.includes(o)} onClick={() => toggle(o)}>
          {swatch && <span className="sw" style={{ background: COLOUR_SWATCH[o] }} />}
          {render(o)}{counts && <span className="n">{counts[o] ?? 0}</span>}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ label, sub, value, onChange }) {
  return (
    <div className="toggle" onClick={() => onChange(!value)} role="switch" aria-checked={value} tabIndex={0} onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && onChange(!value)}>
      <div><div style={{ fontWeight: 600 }}>{label}</div>{sub && <div className="small muted">{sub}</div>}</div>
      <span className={`switch ${value ? 'on' : ''}`} />
    </div>
  );
}

export function RangeRow({ label, sub, value, min, max, onChange, format = (v) => v }) {
  return (
    <div className="range-row">
      <div><div style={{ fontWeight: 600 }}>{label}</div>{sub && <div className="small muted">{sub}</div>}</div>
      <output>{format(value)}</output>
      <input className="range" type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ gridColumn: '1 / -1' }} aria-label={label} />
    </div>
  );
}

export function Tabs({ options, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {options.map(([k, label]) => <button key={k} type="button" role="tab" aria-selected={value === k} className={value === k ? 'on' : ''} onClick={() => onChange(k)}>{label}</button>)}
    </div>
  );
}

// ---------- feedback ----------
export function Spinner() { return <div className="spinner" role="status" aria-label="Loading" />; }
export function Skeleton({ h = 200, style }) { return <div className="skel" style={{ height: h, ...style }} />; }
export function Empty({ icon = 'closet', title, children, action }) {
  return (
    <div className="empty">
      <div className="ill"><Icon name={icon} size={28} /></div>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

export function Modal({ title, sub, children, onClose, wide }) {
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`card pad-lg modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <div><h2>{title}</h2>{sub && <p className="muted small" style={{ marginTop: 4 }}>{sub}</p>}</div>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function useToast() {
  const [toast, setToast] = useState(null);
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), toast.action ? 5000 : 2800);
    return () => clearTimeout(t);
  }, [toast]);
  const view = toast && (
    <div className={`toast ${toast.error ? 'error' : ''}`} role="status">
      {toast.text}
      {toast.action && <button type="button" onClick={() => { toast.action.run(); setToast(null); }}>{toast.action.label}</button>}
    </div>
  );
  const show = useCallback((text, error = false, action = null) => setToast({ text, error, action }), []);
  return [view, show];
}

// Loads data and reloads on demand: const { data, loading, error, reload } = useLoad(() => api.x(), [deps]).
export function useLoad(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const reload = useCallback(async (silent) => {
    if (!silent) setState((s) => ({ ...s, loading: true }));
    try { const data = await fnRef.current(); setState({ data, loading: false, error: null }); return data; } catch (error) { setState({ data: null, loading: false, error }); return null; }
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, deps);
  return { ...state, reload, setData: (d) => setState((s) => ({ ...s, data: typeof d === 'function' ? d(s.data) : d })) };
}
