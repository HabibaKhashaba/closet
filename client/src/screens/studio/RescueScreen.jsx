// Emergency rescue — v3.0: "I spilled coffee on my shirt" → the smallest change that saves the look.
import React, { useState } from 'react';
import { api } from '../../api.js';
import { Chips, Icon, PageHead, SprintNote, Tile, pieceName, useApp, useLoad } from '../../ui.jsx';
import { MiniLook, PiecePicker, Source } from './common.jsx';
import { go } from '../../App.jsx';

export default function RescueScreen() {
  const { vocab, toast, refresh } = useApp();
  const closet = useLoad(() => api.items(), []);
  const [ids, setIds] = useState([]);
  const [picking, setPicking] = useState(false);
  const [problem, setProblem] = useState('');
  const [occasion, setOccasion] = useState('Everyday');
  const [apply, setApply] = useState(true);
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const items = closet.data?.items || [];
  const chosen = ids.map((id) => items.find((p) => p.id === id)).filter(Boolean);

  async function run() {
    setBusy(true); setRes(null);
    try { setRes(await api.rescue({ itemIds: ids, problem, occasion, apply })); if (apply) { refresh(); closet.reload(true); } } catch (e) { toast(e.message, true); } finally { setBusy(false); }
  }
  async function wear() { try { await api.wear(res.fix.itemIds, null, { occasion, note: 'Emergency rescue' }); toast('Saved as today’s outfit'); refresh(); } catch (e) { toast(e.message, true); } }
  return (
    <>
      <PageHead title="Emergency rescue" sub="Something went wrong with your outfit? Tell Closet what happened and get the smallest change that saves the look." />
      <div className="studio">
        <section className="table-board stack lg">
          <div>
            <div className="small" style={{ fontWeight: 600, marginBottom: 8 }}>1. What are you wearing?</div>
            {chosen.length ? <MiniLook pieces={chosen} /> : <p className="small muted">No outfit chosen yet.</p>}
            <button type="button" className="btn line sm" style={{ marginTop: 8 }} onClick={() => setPicking(true)}><Icon name="grid" size={14} />{chosen.length ? 'Change' : 'Choose pieces'}</button>
          </div>
          <div>
            <div className="small" style={{ fontWeight: 600, marginBottom: 8 }}>2. What happened?</div>
            <textarea className="input" rows={2} value={problem} maxLength={300} onChange={(e) => setProblem(e.target.value)} placeholder="I spilled coffee on my shirt" aria-label="What happened" style={{ width: '100%' }} />
            <div className="row" style={{ gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              {['I spilled coffee on my shirt', 'My heel broke', 'I’m too underdressed', 'It’s colder than I thought'].map((x) => <button key={x} type="button" className="btn ghost sm" onClick={() => setProblem(x)}>{x}</button>)}
            </div>
          </div>
          <Chips options={Object.keys(vocab.OCCASIONS)} value={occasion} multiple={false} onChange={(v) => setOccasion(v || occasion)} />
          <label className="row small"><input type="checkbox" checked={apply} onChange={(e) => setApply(e.target.checked)} /> Move a stained piece to Laundry (or a broken one to Needs repair)</label>
          <div className="row"><button type="button" className="btn rose" disabled={busy || ids.length < 2 || !problem.trim()} onClick={run}><Icon name="bolt" size={15} />{busy ? 'Finding a fix…' : 'Rescue me'}</button></div>
        </section>
        <section className="verdict-card stack lg" aria-live="polite">
          {!res ? <p className="muted">Your quick fix appears here.</p> : (
            <>
              <div><div className="big-verdict">{res.problemLabel}</div>{res.affected.length > 0 && <div className="small muted">Affected: {res.affected.map(pieceName).join(', ')}{res.marked.length ? ' · status updated' : ''}</div>}</div>
              {res.fix ? (
                <>
                  <p style={{ fontFamily: 'var(--serif)', fontSize: 17 }}>{res.message}</p>
                  {res.fix.swaps.map((s) => (
                    <div key={s.out.id} className="row" style={{ gap: 10, alignItems: 'center' }}>
                      <Tile piece={s.out} status={false} style={{ width: 70 }} /><Icon name="swap" size={18} />{s.in ? <Tile piece={s.in} status={false} style={{ width: 70 }} /> : <span className="small muted">Leave it off</span>}
                      <span className="small">{pieceName(s.out)} → {s.in ? pieceName(s.in) : 'nothing'}</span>
                    </div>
                  ))}
                  <MiniLook pieces={res.fix.pieces} />
                  <div className="small"><b>{res.fix.compatibility}%</b> compatible · rule score {res.fix.score}/100</div>
                  <div className="row"><button type="button" className="btn" onClick={wear}><Icon name="check" size={15} />Wear the fix</button><button type="button" className="btn line" onClick={() => go(`/mix?ids=${res.fix.itemIds.join(',')}`)}>Fine-tune</button></div>
                </>
              ) : <p>{res.message}</p>}
              <Source source={res.source} />
            </>
          )}
        </section>
      </div>
      <div style={{ marginTop: 20 }}><SprintNote n={5} /></div>
      {picking && <PiecePicker items={items.filter((p) => p.status === 'Available' || ids.includes(p.id))} value={ids} title="What are you wearing?" onClose={() => setPicking(false)} onChange={(v) => { setIds(v); setPicking(false); }} />}
    </>
  );
}
