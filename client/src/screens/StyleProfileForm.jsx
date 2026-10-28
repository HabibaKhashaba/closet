// Visual style profile (US-02 quiz, US-03 dress code and modesty, US-04 city):
// style cards, colour swatches, occasions, a dress-code slider and toggles.
import React from 'react';
import { Chips, COLOUR_SWATCH, Field, Toggle, useApp } from '../ui.jsx';

export const STYLE_CARDS = {
  Casual: ['Easy, everyday pieces', ['#dcc7aa', '#86a7d1', '#f8f6f2']],
  Chic: ['Polished but effortless', ['#26232a', '#e8b4c0', '#f3e8dc']],
  Minimal: ['Clean lines, neutrals', ['#f8f6f2', '#a3a0a4', '#26232a']],
  Elegant: ['Fluid fabrics, refined', ['#28365c', '#efe1d2', '#c9a24a']],
  Classic: ['Timeless tailoring', ['#28365c', '#dcc7aa', '#7b5538']],
  Sporty: ['Active and practical', ['#f8f6f2', '#94b090', '#26232a']],
  Streetwear: ['Relaxed, oversized', ['#26232a', '#b8323f', '#a3a0a4']],
  Comfortable: ['Soft and relaxed', ['#efe1d2', '#d9c9e4', '#c7d7c2']],
  Bold: ['Colour and statement', ['#b8323f', '#e3c062', '#8f6eaa']],
};

export default function StyleProfileForm({ value, onChange }) {
  const { vocab } = useApp();
  const set = (k) => (v) => onChange({ ...value, [k]: v });
  const toggleStyle = (s) => set('styles')(value.styles.includes(s) ? value.styles.filter((x) => x !== s) : [...value.styles, s]);
  return (
    <div className="stack lg">
      <section>
        <h3>Which styles feel like you?</h3>
        <p className="muted small" style={{ margin: '4px 0 14px' }}>Pick up to three. Closet ranks outfits with these first.</p>
        <div className="quiz-card">
          {vocab.STYLES.map((s) => (
            <button type="button" key={s} className={`style-card ${value.styles.includes(s) ? 'on' : ''}`} onClick={() => toggleStyle(s)} aria-pressed={value.styles.includes(s)}>
              <span className="swatch">{STYLE_CARDS[s][1].map((c) => <i key={c} style={{ background: c }} />)}</span>
              <b>{s}</b><small>{STYLE_CARDS[s][0]}</small>
            </button>
          ))}
        </div>
      </section>
      <section>
        <h3>Colours you love wearing</h3>
        <p className="muted small" style={{ margin: '4px 0 12px' }}>Outfits with these colours are suggested first.</p>
        <Chips options={vocab.COLOURS} value={value.colours} onChange={set('colours')} swatch />
      </section>
      <section>
        <h3>What do you usually dress for?</h3>
        <p className="muted small" style={{ margin: '4px 0 12px' }}>Used to find real gaps in your closet.</p>
        <Chips options={Object.keys(vocab.OCCASIONS)} value={value.occasions} onChange={set('occasions')} />
      </section>
      <section className="card flat pad" style={{ background: 'var(--bg-2)' }}>
        <div className="range-row" style={{ paddingTop: 0 }}>
          <div><div style={{ fontWeight: 600 }}>Your usual dress code</div><div className="small muted">From relaxed to formal</div></div>
          <output>{vocab.DRESS_CODES[value.dressCode]}</output>
          <input className="range" type="range" min={1} max={5} value={value.dressCode} onChange={(e) => set('dressCode')(Number(e.target.value))} style={{ gridColumn: '1 / -1' }} aria-label="Dress code" />
          <div className="row between tiny muted" style={{ gridColumn: '1 / -1' }}>{[1, 2, 3, 4, 5].map((l) => <span key={l}>{vocab.DRESS_CODES[l]}</span>)}</div>
        </div>
        <Toggle label="Modest outfits only" sub="Covered shoulders, longer hemlines. Non-modest pieces are never suggested." value={value.modest} onChange={set('modest')} />
        <div style={{ paddingTop: 12 }}>
          <Field label="Your city (for the weather)" hint="Weather comes from Open-Meteo."><input value={value.city || ''} onChange={(e) => set('city')(e.target.value)} placeholder="Cairo" maxLength={60} /></Field>
        </div>
      </section>
    </div>
  );
}

export const swatchOf = (c) => COLOUR_SWATCH[c];
