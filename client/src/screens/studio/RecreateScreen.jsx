// Recreate this look — v3.0, editorial design: inspiration → the closest pieces you own, honestly rated.
import React, { useState } from 'react';
import { api } from '../../api.js';
import { pieceName, useApp } from '../../ui.jsx';
import { ACCENT, Cover, Drop, Fineprint, LookStrip, Spread, Step } from './editorial.jsx';
import { go } from '../../App.jsx';

export default function RecreateScreen() {
  const { toast } = useApp();
  const [photo, setPhoto] = useState(null);
  const [text, setText] = useState('');
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try { setRes(await api.recreate({ text, ...(photo && { photo: { base64: photo.base64, mime: photo.mime } }) })); } catch (e) { toast(e.message, true); } finally { setBusy(false); }
  }
  const found = res ? res.matches.filter((m) => m.level === 'Exact' || m.level === 'Close').length : 0;
  return (
    <div className="ed" style={{ '--acc': ACCENT.recreate }}>
      <Cover feature="recreate" no={6} kicker="Get the look" title="Recreate this look" pick={['Black blazer', 'Ivory silk blouse', 'Light-wash jeans']}
        dek="Saw an outfit you love? We find the closest pieces in your own closet — and tell you honestly what is missing." />
      <Step n={1} title="The inspiration">
        <div className="ed-vs" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 0 }}>
          <Drop label="Drop an inspiration photo" value={photo} onChange={setPhoto} onError={(m) => toast(m, true)} />
          <textarea className="input" rows={5} value={text} maxLength={500} onChange={(e) => setText(e.target.value)} aria-label="Describe the look" placeholder="…or describe it: black blazer, white shirt, blue jeans, silver heels" />
        </div>
        <div className="ed-actions"><button type="button" className="ed-cta" disabled={busy || (!text.trim() && !photo)} onClick={run}>{busy ? 'Matching…' : 'Find it in my closet'}</button></div>
      </Step>

      {res && (res.matches.length ? (
        <>
          <Spread label="Your version" headline={`${found} of ${res.matches.length} pieces`} sub="are already in your closet." pieces={res.matches.filter((m) => m.match).map((m) => m.match)}>
            {res.score && <div className="ed-meta"><b>{res.score.compatibility}%</b> match · rule score {res.score.score}/100</div>}
            {res.itemIds?.length >= 2 && <div className="ed-actions"><button type="button" className="ed-cta" onClick={() => go(`/mix?ids=${res.itemIds.join(',')}`)}>Open in Mix & Match</button></div>}
          </Spread>
          <Step n={2} title="Piece by piece">
            {res.matches.map((m, i) => (
              <div key={i} className="ed-match">
                {m.match ? <img src={m.match.photoUrl} alt={pieceName(m.match)} /> : <div className="ed-ph">?</div>}
                <div>
                  <div style={{ fontFamily: 'var(--serif)', fontSize: 20 }}>{m.target.description || `${m.target.colour} ${m.target.category.toLowerCase()}`}<span className={`ed-tag ${m.level}`}>{m.level}</span></div>
                  <div className="ed-meta">{m.match ? `Yours: ${pieceName(m.match)} · ${m.match.similarity}% similar` : 'Nothing like it in your closet'}</div>
                  {m.friend && <div className="ed-meta">Or borrow <b>{m.friend.owner}’s {m.friend.name.toLowerCase()}</b> <button type="button" className="ed-link" onClick={async () => { try { await api.borrow(m.friend.ownerId, m.friend.id); toast(`Request sent to ${m.friend.owner}`); } catch (e) { toast(e.message, true); } }}>Ask to borrow</button></div>}
                </div>
                {(m.level === 'Missing' || m.level === 'Alternative') ? <button type="button" className="ed-link" onClick={async () => { try { await api.recreateToList(m.target); toast('Added to your shopping list'); } catch (e) { toast(e.message, true); } }}>Shopping list</button> : <span />}
              </div>
            ))}
            <Fineprint>{res.source === 'ai' ? 'The photo was described by AI; matching and scores are Closet’s rules.' : 'Matched by Closet’s rules (no AI needed).'} Exact ≥ 90 % · Close ≥ 60 % · same category required.</Fineprint>
          </Step>
        </>
      ) : <Spread label="Hmm" headline="We couldn’t read that" sub={res.message} />)}
      {!res && <Fineprint>Tip: name each piece with its colour — “cream knit, black midi skirt, white sneakers”.</Fineprint>}
      {res && res.matches.length === 0 && <LookStrip pieces={[]} />}
    </div>
  );
}
