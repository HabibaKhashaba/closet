// Recreate this look — v3.0: an inspiration photo or description → the closest pieces YOU own.
import React, { useState } from 'react';
import { api } from '../../api.js';
import { Icon, PageHead, SprintNote, Tile, pieceName, useApp } from '../../ui.jsx';
import { MiniLook, PhotoInput, Source } from './common.jsx';
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
  return (
    <>
      <PageHead title="Recreate this look" sub="Saw an outfit you love? Closet finds the closest pieces in your own closet — and says honestly what is missing." />
      <div className="studio">
        <section className="table-board stack lg">
          <PhotoInput label="Inspiration photo" value={photo} onChange={setPhoto} onError={(m) => toast(m, true)} />
          <textarea className="input" rows={3} value={text} maxLength={500} onChange={(e) => setText(e.target.value)} aria-label="Describe the look" placeholder="…or describe it: black blazer, white shirt, blue jeans, silver heels" />
          <div className="row"><button type="button" className="btn rose" disabled={busy || (!text.trim() && !photo)} onClick={run}><Icon name="wand" size={15} />{busy ? 'Matching…' : 'Find it in my closet'}</button></div>
        </section>
        <section className="verdict-card stack lg" aria-live="polite">
          {!res ? <p className="muted">Matches appear here.</p> : (
            <>
              <div className="big-verdict" style={{ fontSize: 24 }}>{res.summary || res.message}</div>
              {res.matches.map((m, i) => (
                <div key={i} className="row" style={{ gap: 12, alignItems: 'center' }}>
                  {m.match ? <Tile piece={m.match} status={false} style={{ width: 64 }} /> : <div className="tile" style={{ width: 64 }} />}
                  <div className="grow">
                    <div className="small"><b>{m.target.description || `${m.target.colour} ${m.target.category.toLowerCase()}`}</b> <span className={`match-level ${m.level}`}>{m.level}</span></div>
                    <div className="tiny muted">{m.match ? `Yours: ${pieceName(m.match)} · ${m.match.similarity}% similar` : 'Nothing like it in your closet'}</div>
                    {m.friend && <div className="tiny">Borrow from {m.friend.owner}: {m.friend.name} <button type="button" className="btn ghost sm" onClick={async () => { try { await api.borrow(m.friend.ownerId, m.friend.id); toast(`Request sent to ${m.friend.owner}`); } catch (e) { toast(e.message, true); } }}>Ask to borrow</button></div>}
                  </div>
                  {(m.level === 'Missing' || m.level === 'Alternative') && <button type="button" className="btn line sm" onClick={async () => { try { await api.recreateToList(m.target); toast('Added to your shopping list'); } catch (e) { toast(e.message, true); } }}><Icon name="bag" size={13} />Shopping list</button>}
                </div>
              ))}
              {res.itemIds?.length >= 2 && (
                <>
                  <MiniLook pieces={res.matches.filter((m) => m.match).map((m) => m.match)} />
                  {res.score && <div className="small"><b>{res.score.compatibility}%</b> compatible · rule score {res.score.score}/100</div>}
                  <button type="button" className="btn line sm" onClick={() => go(`/mix?ids=${res.itemIds.join(',')}`)}>Open in Mix & Match</button>
                </>
              )}
              <Source source={res.source} />
            </>
          )}
        </section>
      </div>
      <div style={{ marginTop: 20 }}><SprintNote n={5} /></div>
    </>
  );
}
