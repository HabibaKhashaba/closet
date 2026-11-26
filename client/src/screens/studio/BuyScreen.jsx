// Should I buy this? (+ What if I donate this?) — v3.0, editorial design.
// Outfit counts before/after come from the server rules on a copy of the closet.
import React, { useState } from 'react';
import { api } from '../../api.js';
import { pieceName, useApp, useLoad } from '../../ui.jsx';
import { ACCENT, Choice, Cover, Drop, Fineprint, LookStrip, Shelf, Spread, Step } from './editorial.jsx';

const LEVELS = [1, 2, 3, 4, 5];

function Bars({ rows }) {
  const max = Math.max(1, ...rows.map((r) => Math.max(r.after, r.before)));
  return (
    <div className="ed-bars">
      {rows.map((r) => (
        <div className="ed-bar" key={r.occasion}>
          <span>{r.occasion}</span>
          <span className="t" aria-label={`${r.occasion}: ${r.before} before, ${r.after} after`}>
            <span className="o" style={{ width: `${(Math.min(r.before, r.after) / max) * 100}%` }} />
            {r.gain > 0 && <span className="g" style={{ width: `${(r.gain / max) * 100}%` }} />}
          </span>
          <b>{r.before}→{r.after}</b>
        </div>
      ))}
    </div>
  );
}

export default function BuyScreen() {
  const { vocab, toast } = useApp();
  const closet = useLoad(() => api.items(), []);
  const [mode, setMode] = useState('Buy');
  const [photo, setPhoto] = useState(null);
  const [piece, setPiece] = useState({ category: 'Bottom', colour: 'Navy', dressCodes: [3, 4], styles: ['Classic'] });
  const [donateId, setDonateId] = useState(null);
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setPiece((p) => ({ ...p, [k]: v }));
  const toggleLevel = (l) => set('dressCodes', piece.dressCodes.includes(l) ? piece.dressCodes.filter((x) => x !== l) : [...piece.dressCodes, l].sort());

  async function run() {
    setBusy(true); setRes(null);
    try { setRes(mode === 'Buy' ? await api.studioBuy({ piece, ...(photo && { photo: { base64: photo.base64, mime: photo.mime } }) }) : await api.buyDonate(donateId)); } catch (e) { toast(e.message, true); } finally { setBusy(false); }
  }
  const owned = (closet.data?.items || []).filter((p) => p.status !== 'Ready to donate' && p.photoUrl);
  const tone = res && (/Buy|Safe/.test(res.verdict) ? 'good' : /Skip/.test(res.verdict) ? 'bad' : '');
  return (
    <div className="ed" style={{ '--acc': ACCENT.buy }}>
      <Cover feature="buy" no={1} kicker="The smart shopper" title={mode === 'Buy' ? 'Should I buy this?' : 'What if I let it go?'}
        dek="Before you pay — or give away — see exactly how many complete outfits it adds to your closet." />
      <Choice label="Mode" options={['Buy', 'Donate']} value={mode} render={(m) => (m === 'Buy' ? 'Should I buy this?' : 'What if I donate this?')} onChange={(m) => { setMode(m); setRes(null); }} />

      {mode === 'Buy' ? (
        <>
          <Step n={1} title="Show us the piece" aside={<span className="ed-fine">optional — AI fills in the details</span>}>
            <Drop label="Drop a photo from the shop, or describe it below" value={photo} onChange={setPhoto} onError={(m) => toast(m, true)} />
          </Step>
          <Step n={2} title="What is it?">
            <Choice label="Category" options={vocab.CATEGORIES} value={piece.category} onChange={(v) => set('category', v)} />
            <div style={{ height: 12 }} />
            <Choice label="Colour" options={vocab.COLOURS} value={piece.colour} onChange={(v) => set('colour', v)} />
          </Step>
          <Step n={3} title="Where would you wear it?" aside={<span className="ed-fine">pick one or more</span>}>
            <div className="ed-choice">
              {LEVELS.map((l) => <button type="button" key={l} className={piece.dressCodes.includes(l) ? 'on' : ''} aria-pressed={piece.dressCodes.includes(l)} onClick={() => toggleLevel(l)}>{vocab.DRESS_CODES[l]}</button>)}
            </div>
          </Step>
        </>
      ) : (
        <Step n={1} title="Which piece might go?">
          <Shelf items={owned} value={donateId} onChange={setDonateId} />
        </Step>
      )}
      <div className="ed-actions" style={{ marginTop: 6 }}>
        <button type="button" className="ed-cta" disabled={busy || (mode === 'Donate' && !donateId)} onClick={run}>{busy ? 'Counting outfits…' : 'Count my outfits'}</button>
      </div>

      {res && (
        <>
          <Spread tone={tone} label={mode === 'Buy' ? 'The verdict' : 'If you donate it'} headline={res.verdict}
            big={mode === 'Buy' ? (res.gain > 0 ? `+${res.gain}` : '0') : `−${res.lost}`} bigUnit="outfits" sub={res.sentence}
            pieces={mode === 'Buy' ? (res.examples[0]?.pieces || [res.piece]) : [res.piece]}>
            <Bars rows={res.byOccasion} />
            <Fineprint>Your closet: {res.before} → {res.after} complete outfits. Counted by Closet’s rules on a copy of your closet — nothing is saved.{res.aiSentence ? ' The sentence was phrased by AI from these numbers.' : ''}</Fineprint>
          </Spread>
          {res.similar?.length > 0 && (
            <Step n="✓" title="You already own something similar"><LookStrip pieces={res.similar} /></Step>
          )}
          {res.examples?.length > 1 && (
            <Step n="+" title="New looks it would unlock">
              <div className="ed-grid">{res.examples.map((x) => <div key={x.occasion}><div className="ed-label">{x.occasion}</div><LookStrip pieces={x.pieces} small /></div>)}</div>
            </Step>
          )}
          {res.hardToStyle?.length > 0 && (
            <Step n="!" title="These would become hard to style">
              <ul className="ed-list">{res.hardToStyle.map((h) => <li key={h.piece.id}>{pieceName(h.piece)}: {h.before} → {h.after} outfits</li>)}</ul>
            </Step>
          )}
        </>
      )}
    </div>
  );
}
