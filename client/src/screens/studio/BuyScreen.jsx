// Should I buy this? (+ What if I donate this?) — v3.0. Outfit counts before/after come from the server rules.
import React, { useState } from 'react';
import { api } from '../../api.js';
import { Chips, Field, Icon, PageHead, SprintNote, Tabs, Tile, pieceName, useApp, useLoad } from '../../ui.jsx';
import { MiniLook, PhotoInput } from './common.jsx';

function Bars({ rows }) {
  const max = Math.max(1, ...rows.map((r) => Math.max(r.after, r.before)));
  return (
    <div className="occ-bars">
      {rows.map((r) => (
        <div className="occ-bar" key={r.occasion}>
          <span>{r.occasion}</span>
          <span className="track" aria-label={`${r.occasion}: ${r.before} before, ${r.after} after`}>
            <span className="old" style={{ width: `${(Math.min(r.before, r.after) / max) * 100}%` }} />
            {r.gain > 0 && <span className="new" style={{ width: `${(r.gain / max) * 100}%` }} />}
          </span>
          <span className="small">{r.before} → <b>{r.after}</b></span>
        </div>
      ))}
    </div>
  );
}

export default function BuyScreen() {
  const { vocab, toast } = useApp();
  const closet = useLoad(() => api.items(), []);
  const [mode, setMode] = useState('buy');
  const [photo, setPhoto] = useState(null);
  const [piece, setPiece] = useState({ category: 'Bottom', colour: 'Black', dressCodes: [2, 3], styles: [] });
  const [donateId, setDonateId] = useState(null);
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setPiece((p) => ({ ...p, [k]: v }));

  async function run() {
    setBusy(true); setRes(null);
    try { setRes(mode === 'buy' ? await api.buyCheck({ piece, ...(photo && { photo: { base64: photo.base64, mime: photo.mime } }) }) : await api.buyDonate(donateId)); } catch (e) { toast(e.message, true); } finally { setBusy(false); }
  }
  const owned = (closet.data?.items || []).filter((p) => !['Ready to donate'].includes(p.status));
  return (
    <>
      <PageHead title={mode === 'buy' ? 'Should I buy this?' : 'What if I donate this?'} sub="See how many complete outfits a piece adds to — or removes from — your closet, before you decide." />
      <Tabs options={[['buy', 'Should I buy this?'], ['donate', 'What if I donate this?']]} value={mode} onChange={(m) => { setMode(m); setRes(null); }} />
      <div className="studio" style={{ marginTop: 16 }}>
        <section className="table-board stack lg">
          {mode === 'buy' ? (
            <>
              <PhotoInput label="Photo of the piece (optional — AI fills in the details)" value={photo} onChange={setPhoto} onError={(m) => toast(m, true)} />
              <Field label="Category"><Chips options={vocab.CATEGORIES} value={piece.category} multiple={false} onChange={(v) => set('category', v || piece.category)} /></Field>
              <Field label="Colour"><Chips options={vocab.COLOURS} value={piece.colour} multiple={false} onChange={(v) => set('colour', v || piece.colour)} /></Field>
              <Field label="Dress codes"><Chips options={[1, 2, 3, 4, 5]} render={(l) => vocab.DRESS_CODES[l]} value={piece.dressCodes} onChange={(v) => set('dressCodes', v)} /></Field>
              <Field label="Style (optional)"><Chips options={vocab.STYLES} value={piece.styles} onChange={(v) => set('styles', v.slice(0, 3))} /></Field>
            </>
          ) : (
            <div className="picker">
              {owned.map((p) => (
                <button type="button" key={p.id} className={donateId === p.id ? 'on' : ''} onClick={() => setDonateId(p.id)}>
                  <Tile piece={p} /><div className="tiny" style={{ fontWeight: 600, marginTop: 6 }}>{pieceName(p)}</div>
                </button>
              ))}
            </div>
          )}
          <div className="row"><button type="button" className="btn rose" disabled={busy || (mode === 'donate' && !donateId)} onClick={run}><Icon name="sparkle" size={15} />{busy ? 'Counting outfits…' : 'Check it'}</button></div>
        </section>
        <section className="verdict-card stack lg" aria-live="polite">
          {!res ? <p className="muted">{mode === 'buy' ? 'Describe the piece you are thinking about, then press Check it.' : 'Choose a piece you might give away.'}</p> : (
            <>
              <div>
                <div className={`big-verdict ${res.verdict.split(' ')[0]}`}>{res.verdict}</div>
                <p style={{ fontFamily: 'var(--serif)', fontSize: 16 }}>{res.sentence}</p>
                <div className="small muted">Your closet: {res.before} outfits → {res.after} outfits</div>
              </div>
              <Bars rows={res.byOccasion} />
              {res.similar?.length > 0 && <div><div className="small" style={{ fontWeight: 600 }}>Similar pieces you own</div><MiniLook pieces={res.similar} /></div>}
              {res.examples?.length > 0 && res.examples.map((x) => <div key={x.occasion}><div className="small muted">New look for {x.occasion}</div><MiniLook pieces={x.pieces} /></div>)}
              {res.hardToStyle?.length > 0 && (
                <div><div className="small" style={{ fontWeight: 600 }}>These become hard to style</div>
                  {res.hardToStyle.map((h) => <div key={h.piece.id} className="small">{pieceName(h.piece)}: {h.before} → {h.after} outfits</div>)}
                </div>
              )}
              <p className="tiny muted">Counts come from the same rules as Style me and Mix & Match, on a copy of your closet. Nothing is saved.{res.aiSentence ? ' The sentence was phrased by AI from these numbers.' : ''}</p>
            </>
          )}
        </section>
      </div>
      <div style={{ marginTop: 20 }}><SprintNote n={5} /></div>
    </>
  );
}
