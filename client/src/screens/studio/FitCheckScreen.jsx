// Fit check — v3.0: a mirror selfie (or picked pieces) → score + one best swap → "Save my outfit".
// The photo is only sent for matching and is never stored.
import React, { useState } from 'react';
import { api } from '../../api.js';
import { Chips, Icon, PageHead, SprintNote, Tile, pieceName, useApp, useLoad } from '../../ui.jsx';
import { MiniLook, PhotoInput, PiecePicker, Source } from './common.jsx';

export default function FitCheckScreen() {
  const { vocab, toast, refresh } = useApp();
  const closet = useLoad(() => api.items(), []);
  const [photo, setPhoto] = useState(null);
  const [occasion, setOccasion] = useState('Everyday');
  const [res, setRes] = useState(null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const items = closet.data?.items || [];
  async function check(body) {
    setBusy(true);
    try { const r = await api.fitCheck({ occasion, ...body }); setRes(r); if (r.source === 'none') setPicking(true); } catch (e) { toast(e.message, true); } finally { setBusy(false); }
  }
  async function save(ids) {
    try { await api.fitSave({ itemIds: ids, occasion }); toast('Saved as today’s outfit'); refresh(); closet.reload(true); } catch (e) { toast(e.message, true); }
  }
  return (
    <>
      <PageHead title="Fit check" sub="Take a mirror selfie before you leave. Closet recognises your pieces, scores the outfit and suggests one swap." />
      <div className="studio">
        <section className="table-board stack lg">
          <PhotoInput label="Mirror selfie (never stored)" value={photo} onChange={setPhoto} onError={(m) => toast(m, true)} />
          <Chips options={Object.keys(vocab.OCCASIONS)} value={occasion} multiple={false} onChange={(v) => setOccasion(v || occasion)} />
          <div className="row">
            <button type="button" className="btn rose" disabled={busy || !photo} onClick={() => check({ photo: { base64: photo.base64, mime: photo.mime } })}><Icon name="camera" size={15} />{busy ? 'Checking…' : 'Check my fit'}</button>
            <button type="button" className="btn line" onClick={() => setPicking(true)}>Pick pieces instead</button>
          </div>
        </section>
        <section className="verdict-card stack lg" aria-live="polite">
          {!res || res.source === 'none' ? <p className="muted">{res ? res.message : 'Your score appears here.'}</p> : (
            <>
              <div><div className="big-verdict">{res.score === 100 ? 'Good to go' : res.score >= 83 ? 'Almost there' : 'Needs a change'}</div><div className="small muted">{res.levelName} · {res.compatibility}% compatible · rule score {res.score}/100</div></div>
              <MiniLook pieces={res.detected} />
              <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>{[...res.problems, ...res.reasons].slice(0, 4).map((x) => <li key={x}>{x}</li>)}</ul>
              {res.swap ? (
                <div className="studio-card stack">
                  <b>One swap: {pieceName(res.swap.out)} → {pieceName(res.swap.in)}</b>
                  <div className="row" style={{ gap: 10 }}><Tile piece={res.swap.out} status={false} style={{ width: 70 }} /><Icon name="swap" size={18} /><Tile piece={res.swap.in} status={false} style={{ width: 70 }} /></div>
                  <div className="small">Then: {res.swap.compatibility}% · rule score {res.swap.score}/100</div>
                  <button type="button" className="btn line sm" onClick={() => save(res.swap.itemIds)}>Swap and save my outfit</button>
                </div>
              ) : <p className="small">No single swap makes it better — nice.</p>}
              <div className="row"><button type="button" className="btn" onClick={() => save(res.itemIds)}><Icon name="check" size={15} />Save my outfit</button></div>
              <Source source={res.source} />
            </>
          )}
        </section>
      </div>
      <div style={{ marginTop: 20 }}><SprintNote n={5} /></div>
      {picking && <PiecePicker items={items.filter((p) => p.status === 'Available')} title="What are you wearing?" onClose={() => setPicking(false)} onChange={(ids) => { setPicking(false); check({ itemIds: ids }); }} />}
    </>
  );
}
