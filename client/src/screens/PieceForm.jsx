// The details form shared by "Add a piece" (US-09) and "Edit a piece" (US-71).
import React from 'react';
import { CATEGORY_ONE, Chips, Field, Toggle, useApp, dressName } from '../ui.jsx';

export const emptyDetails = { name: '', category: '', colour: '', fabric: '', season: '', size: '', styles: [], dressCodes: [], modest: false, price: '', currency: 'EGP', purchaseDate: '' };

export default function PieceForm({ value, onChange, errors }) {
  const { vocab } = useApp();
  const set = (k) => (v) => onChange({ ...value, [k]: v });
  const err = (f) => errors?.find((d) => d.field === f)?.message;
  const select = (k, options, label, required, render = (o) => o) => (
    <Field label={`${label}${required ? ' *' : ''}`} error={err(k)}>
      <select value={value[k] || ''} onChange={(e) => set(k)(e.target.value)}>
        <option value="">{required ? 'Choose…' : '—'}</option>
        {options.map((o) => <option key={o} value={o}>{render(o)}</option>)}
      </select>
    </Field>
  );
  return (
    <>
      <Field label="Name" error={err('name')} hint="Optional — e.g. “Navy silk midi dress”">
        <input value={value.name || ''} maxLength={60} onChange={(e) => set('name')(e.target.value)} placeholder="Navy silk midi dress" />
      </Field>
      <div className="grid g2" style={{ gap: '0 14px' }}>
        {select('category', vocab.CATEGORIES, 'Category', true, (c) => CATEGORY_ONE[c])}
        {select('colour', vocab.COLOURS, 'Colour', true)}
        {select('fabric', vocab.FABRICS, 'Fabric')}
        {select('season', vocab.SEASONS, 'Season')}
        <Field label="Size" error={err('size')}><input value={value.size || ''} maxLength={10} onChange={(e) => set('size')(e.target.value)} placeholder="e.g. M, 38" /></Field>
      </div>
      <div className="field">
        <span>Dress-code levels * <small className="muted">(every level this piece suits)</small></span>
        <Chips options={[1, 2, 3, 4, 5]} value={value.dressCodes} onChange={(v) => set('dressCodes')([...v].sort())} render={(l) => dressName(vocab, l)} />
        {err('dressCodes') && <small className="err" role="alert">{err('dressCodes')}</small>}
      </div>
      <div className="field">
        <span>Style</span>
        <Chips options={vocab.STYLES} value={value.styles} onChange={set('styles')} />
      </div>
      <Toggle label="Modest piece" sub="Covered shoulders, longer hemline" value={value.modest} onChange={set('modest')} />
      <details className="purchase" open={Boolean(value.price)}>
        <summary className="small">Purchase details <span className="muted">(optional · for cost per wear)</span></summary>
        <div className="grid g3" style={{ gap: '0 12px', marginTop: 10 }}>
          <Field label="Price" error={err('price')}><input type="number" min="0" step="0.01" inputMode="decimal" value={value.price ?? ''} onChange={(e) => set('price')(e.target.value)} placeholder="2400" /></Field>
          <Field label="Currency" error={err('currency')}><select value={value.currency || 'EGP'} onChange={(e) => set('currency')(e.target.value)}>{(vocab.CURRENCIES || ['EGP']).map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Bought on" error={err('purchaseDate')}><input type="date" value={value.purchaseDate || ''} max={new Date().toISOString().slice(0, 10)} onChange={(e) => set('purchaseDate')(e.target.value)} /></Field>
        </div>
        <p className="tiny muted">Private to you. Leave empty if you prefer; you can remove it any time.</p>
      </details>
    </>
  );
}

// Only send fields that have a value; required ones are checked by the server too.
export function cleanDetails(d) {
  const out = { category: d.category, colour: d.colour, dressCodes: d.dressCodes, styles: d.styles, modest: d.modest };
  for (const k of ['name', 'fabric', 'season', 'size']) if (d[k]) out[k] = d[k].trim ? d[k].trim() : d[k];
  if (d.price !== '' && d.price !== null && d.price !== undefined) { out.price = Number(d.price); out.currency = d.currency || 'EGP'; }
  if (d.purchaseDate) out.purchaseDate = d.purchaseDate;
  return out;
}
