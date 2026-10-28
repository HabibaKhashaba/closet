// The details form shared by "Add a piece" (US-09) and "Edit a piece" (US-71).
import React from 'react';
import { CATEGORY_ONE, Chips, Field, Toggle, useApp, dressName } from '../ui.jsx';

export const emptyDetails = { name: '', category: '', colour: '', fabric: '', season: '', size: '', styles: [], dressCodes: [], modest: false };

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
    </>
  );
}

// Only send fields that have a value; required ones are checked by the server too.
export function cleanDetails(d) {
  const out = { category: d.category, colour: d.colour, dressCodes: d.dressCodes, styles: d.styles, modest: d.modest };
  for (const k of ['name', 'fabric', 'season', 'size']) if (d[k]) out[k] = d[k].trim ? d[k].trim() : d[k];
  return out;
}
