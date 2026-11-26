// Editorial design system for the v3.0 Studio screens (fashion-magazine look):
// one accent colour per feature, a cover with real pieces from the closet, big serif type,
// numbered steps instead of form boxes, and results shown as a "spread".
import React, { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { pieceName } from '../../ui.jsx';
import { readPhoto } from './common.jsx';

// One quiet accent everywhere (the app's rose), so Studio matches the rest of Closet.
const ROSE = '#652F3C'; // burgundy
export const ACCENT = { buy: ROSE, cher: ROSE, rescue: ROSE, invitation: ROSE, mood: ROSE, recreate: ROSE, fit: ROSE, battle: ROSE, wrapped: ROSE, friends: ROSE };

let closetCache = null;
export function useClosetPhotos() {
  const [items, setItems] = useState(closetCache || []);
  useEffect(() => {
    if (closetCache) return;
    api.items().then((r) => { closetCache = r.items.filter((p) => p.photoUrl); setItems(closetCache); }).catch(() => {});
  }, []);
  return items;
}

// Cover: a quiet, text-led header — issue line, title, one-line dek and the feature's own large numeral.
// (No photo collage: every feature would look the same.)
export function Cover({ no, kicker, title, dek }) {
  return (
    <header className="ed-cover ed-cover-text-only">
      <div className="ed-cover-text">
        <div className="ed-kicker">{kicker}</div>
        <h1 className="ed-title">{title}</h1>
        <p className="ed-dek">{dek}</p>
      </div>
      <div className="ed-numeral" aria-hidden="true">{String(no).padStart(2, '0')}</div>
    </header>
  );
}

// A numbered step ("01 — What are you wearing?") instead of a boxed form.
export function Step({ n, title, children, aside }) {
  return (
    <section className="ed-step">
      <div className="ed-step-n">{typeof n === 'number' ? String(n).padStart(2, '0') : n}</div>
      <div className="ed-step-body">
        <div className="ed-step-head"><h2>{title}</h2>{aside}</div>
        {children}
      </div>
    </section>
  );
}

// Big result block: headline + giant number + photo spread.
export function Spread({ label, headline, big, bigUnit, sub, pieces = [], children, tone }) {
  return (
    <section className={`ed-spread ${tone || ''}`} aria-live="polite">
      <div className="ed-spread-text">
        {label && <div className="ed-label">{label}</div>}
        {headline && <h2 className="ed-headline">{headline}</h2>}
        {big !== undefined && big !== null && <div className="ed-big">{big}{bigUnit && <small>{bigUnit}</small>}</div>}
        {sub && <p className="ed-sub">{sub}</p>}
        {children}
      </div>
      {pieces.length > 0 && <LookStrip pieces={pieces} />}
    </section>
  );
}

// Pieces laid out like a magazine flat-lay, with captions.
export function LookStrip({ pieces, small }) {
  return (
    <div className={`ed-strip ${small ? 'small' : ''} n${Math.min(pieces.filter(Boolean).length, 5)}`}>
      {pieces.filter(Boolean).map((p) => (
        <figure key={p.id} className={`ed-piece ${p.category || ''}`}>
          {p.photoUrl ? <img src={p.photoUrl} alt={pieceName(p)} loading="lazy" /> : <div className="ed-piece-new">{p.virtual ? 'The new piece' : pieceName(p)}</div>}
          <figcaption>{pieceName(p)}</figcaption>
        </figure>
      ))}
    </div>
  );
}

// A compact look card used in grids of results (mood, battle, invitation).
export function LookPanel({ eyebrow, title, quote, look, meta, children }) {
  return (
    <article className="ed-panel">
      {eyebrow && <div className="ed-label">{eyebrow}</div>}
      <h3 className="ed-panel-title">{title}</h3>
      <LookStrip pieces={look.pieces} small />
      {quote && <p className="ed-quote">“{quote}”</p>}
      <div className="ed-meta"><b>{look.compatibility}%</b> match · rule score {look.score}/100{meta ? ` · ${meta}` : ''}</div>
      {children && <div className="ed-actions">{children}</div>}
    </article>
  );
}

// Segmented choice in editorial style (occasions, moods, dress codes).
export function Choice({ options, value, onChange, render = (o) => o, label }) {
  return (
    <div className="ed-choice" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button type="button" key={o} role="radio" aria-checked={value === o} className={value === o ? 'on' : ''} onClick={() => onChange(o)}>{render(o)}</button>
      ))}
    </div>
  );
}

export const Fineprint = ({ children }) => <p className="ed-fine">{children}</p>;

// Photo drop zone (editorial). Reads the photo as base64 JSON (≤ 5 MB), see common.jsx readPhoto.
export function Drop({ label, value, onChange, onError }) {
  return (
    <label className="ed-drop">
      <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={async (e) => {
        try { onChange(await readPhoto(e.target.files[0])); } catch (err) { onError && onError(err.message); }
      }} />
      {value ? <img src={value.preview} alt="Chosen" /> : <span>{label}</span>}
    </label>
  );
}

// Inline piece shelf (instead of a modal picker). multiple → array of ids; otherwise one id.
export function Shelf({ items, value, onChange, multiple = false, max = 4 }) {
  const sel = multiple ? value : [value];
  const toggle = (id) => {
    if (!multiple) { onChange(id); return; }
    onChange(sel.includes(id) ? sel.filter((x) => x !== id) : sel.length >= max ? sel : [...sel, id]);
  };
  return (
    <div className="ed-shelf">
      {items.map((p) => (
        <button type="button" key={p.id} className={sel.includes(p.id) ? 'on' : ''} aria-pressed={sel.includes(p.id)} onClick={() => toggle(p.id)}>
          <img src={p.photoUrl} alt="" loading="lazy" /><span>{pieceName(p)}</span>
        </button>
      ))}
    </div>
  );
}
