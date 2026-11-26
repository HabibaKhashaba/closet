// Fit check — v3.0, editorial design: a mirror selfie (or picked pieces) → score + one best swap.
// The photo is only sent for matching and is never stored.
import React, { useState } from 'react';
import { api } from '../../api.js';
import { pieceName, useApp, useLoad } from '../../ui.jsx';
import { ACCENT, Choice, Cover, Drop, Fineprint, Shelf, Spread, Step } from './editorial.jsx';

export default function FitCheckScreen() {
  const { vocab, toast, refresh } = useApp();
  const closet = useLoad(() => api.items(), []);
  const [photo, setPhoto] = useState(null);
  const [ids, setIds] = useState([]);
  const [occasion, setOccasion] = useState('Everyday');
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const items = (closet.data?.items || []).filter((p) => p.status === 'Available' && p.photoUrl);
  async function check(body) {
    setBusy(true);
    try { setRes(await api.fitCheck({ occasion, ...body })); } catch (e) { toast(e.message, true); } finally { setBusy(false); }
  }
  async function save(itemIds) {
    try { await api.fitSave({ itemIds, occasion }); toast('Saved as today’s outfit'); refresh(); closet.reload(true); } catch (e) { toast(e.message, true); }
  }
  const verdict = res && res.source !== 'none' ? (res.score === 100 ? 'Good to go' : res.score >= 83 ? 'Almost there' : 'Needs a change') : null;
  return (
    <div className="ed" style={{ '--acc': ACCENT.fit }}>
      <Cover feature="fit" no={7} kicker="Before you leave" title="Fit check" pick={['Breton striped top', 'Beige wide-leg trousers', 'White sneakers']}
        dek="One mirror selfie. We recognise your pieces, score the outfit and suggest the one swap that makes it better." />
      <Step n={1} title="Your mirror selfie" aside={<span className="ed-fine">never stored</span>}>
        <Drop label="Drop a mirror selfie" value={photo} onChange={setPhoto} onError={(m) => toast(m, true)} />
        <div className="ed-actions"><button type="button" className="ed-cta" disabled={busy || !photo} onClick={() => check({ photo: { base64: photo.base64, mime: photo.mime } })}>{busy ? 'Checking…' : 'Check my fit'}</button></div>
      </Step>
      <Step n={2} title="…or tap what you’re wearing" aside={<span className="ed-fine">{ids.length}/4</span>}>
        <Shelf items={items} value={ids} onChange={setIds} multiple />
        <div style={{ marginTop: 16 }}><Choice label="Occasion" options={Object.keys(vocab.OCCASIONS)} value={occasion} onChange={setOccasion} /></div>
        <div className="ed-actions"><button type="button" className="ed-cta" disabled={busy || ids.length < 2} onClick={() => check({ itemIds: ids })}>Score this outfit</button></div>
      </Step>

      {res && res.source === 'none' && <Spread tone="bad" label="Hmm" headline="We couldn’t match the photo" sub={res.message} />}
      {verdict && (
        <Spread tone={res.score === 100 ? 'good' : res.score < 83 ? 'bad' : ''} label={`${res.levelName} · rule score ${res.score}/100`} headline={verdict} big={res.compatibility} bigUnit="% match" pieces={res.detected}>
          <ul className="ed-list">{[...res.problems, ...res.reasons].slice(0, 4).map((x) => <li key={x}>{x}</li>)}</ul>
          {res.swap ? (
            <>
              <div className="ed-label" style={{ marginTop: 22 }}>One swap → {res.swap.compatibility}% · {res.swap.score}/100</div>
              <div className="ed-swap">
                <figure className="from" style={{ margin: 0 }}><img src={res.swap.out.photoUrl} alt={pieceName(res.swap.out)} /></figure>
                <div className="arrow">→</div>
                <figure style={{ margin: 0 }}><img src={res.swap.in.photoUrl} alt={pieceName(res.swap.in)} /></figure>
                <div className="ed-meta">{pieceName(res.swap.out)} → <b>{pieceName(res.swap.in)}</b></div>
              </div>
            </>
          ) : <p className="ed-sub">No single swap makes it better — nice.</p>}
          <div className="ed-actions">
            <button type="button" className="ed-cta" onClick={() => save(res.itemIds)}>Save my outfit</button>
            {res.swap && <button type="button" className="ed-link" onClick={() => save(res.swap.itemIds)}>Swap and save</button>}
          </div>
          <Fineprint>{res.source === 'ai' ? 'Pieces recognised by AI from your own closet only; the score is Closet’s rules.' : 'Scored by Closet’s rules.'}</Fineprint>
        </Spread>
      )}
    </div>
  );
}
