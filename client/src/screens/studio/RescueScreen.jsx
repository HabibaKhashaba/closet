// Emergency rescue — v3.0, editorial design: "I spilled coffee on my shirt" → the smallest change that saves the look.
import React, { useState } from 'react';
import { api } from '../../api.js';
import { pieceName, useApp, useLoad } from '../../ui.jsx';
import { ACCENT, Choice, Cover, Fineprint, Shelf, Spread, Step } from './editorial.jsx';
import { go } from '../../App.jsx';

const QUICK = ['I spilled coffee on my shirt', 'My heel broke', 'I’m too underdressed', 'It’s colder than I thought'];

export default function RescueScreen() {
  const { vocab, toast, refresh } = useApp();
  const closet = useLoad(() => api.items(), []);
  const [ids, setIds] = useState([]);
  const [problem, setProblem] = useState('');
  const [occasion, setOccasion] = useState('Work');
  const [apply, setApply] = useState(true);
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const items = (closet.data?.items || []).filter((p) => (p.status === 'Available' || ids.includes(p.id)) && p.photoUrl);

  async function run() {
    setBusy(true); setRes(null);
    try { setRes(await api.emergencyRescue({ itemIds: ids, problem, occasion, apply })); if (apply) { refresh(); closet.reload(true); } } catch (e) { toast(e.message, true); } finally { setBusy(false); }
  }
  async function wear() { try { await api.wear(res.fix.itemIds, null, { occasion, note: 'Emergency rescue' }); toast('Saved as today’s outfit'); refresh(); } catch (e) { toast(e.message, true); } }
  return (
    <div className="ed" style={{ '--acc': ACCENT.rescue }}>
      <Cover feature="rescue" no={3} kicker="Style SOS" title="Emergency rescue" pick={['Ivory silk blouse', 'Black tailored trousers', 'Black loafers']}
        dek="A stain, a broken heel, the wrong dress code. Tell us what happened — we change as little as possible." />
      <Step n={1} title="What are you wearing?" aside={<span className="ed-fine">{ids.length}/4 chosen</span>}>
        <Shelf items={items} value={ids} onChange={setIds} multiple />
      </Step>
      <Step n={2} title="What happened?">
        <textarea className="input" rows={2} value={problem} maxLength={300} onChange={(e) => setProblem(e.target.value)} placeholder="I spilled coffee on my shirt…" aria-label="What happened" />
        <div className="ed-quick">{QUICK.map((x) => <button key={x} type="button" onClick={() => setProblem(x)}>{x}</button>)}</div>
      </Step>
      <Step n={3} title="Where are you going?">
        <Choice label="Occasion" options={Object.keys(vocab.OCCASIONS)} value={occasion} onChange={setOccasion} />
        <label className="ed-row" style={{ marginTop: 14, fontSize: 14 }}><input type="checkbox" checked={apply} onChange={(e) => setApply(e.target.checked)} /> Send a stained piece to the laundry (or a broken one to repair)</label>
      </Step>
      <div className="ed-actions"><button type="button" className="ed-cta" disabled={busy || ids.length < 2 || !problem.trim()} onClick={run}>{busy ? 'Finding a fix…' : 'Rescue me'}</button></div>

      {res && (res.fix ? (
        <Spread tone="good" label={res.problemLabel} headline={res.message} big={res.fix.changed} bigUnit={res.fix.changed === 1 ? 'piece changed' : 'pieces changed'}
          sub={res.affected.length ? `${res.affected.map(pieceName).join(', ')}${res.marked.length ? ' is off to be cared for.' : ' is out.'}` : null} pieces={res.fix.pieces}>
          {res.fix.swaps.map((s) => (
            <div key={s.out.id} className="ed-swap">
              <figure className="from" style={{ margin: 0 }}><img src={s.out.photoUrl} alt={pieceName(s.out)} /></figure>
              <div className="arrow">→</div>
              <figure style={{ margin: 0 }}>{s.in ? <img src={s.in.photoUrl} alt={pieceName(s.in)} /> : null}</figure>
              <div className="ed-meta">{pieceName(s.out)} → <b>{s.in ? pieceName(s.in) : 'leave it off'}</b></div>
            </div>
          ))}
          <div className="ed-meta"><b>{res.fix.compatibility}%</b> match · rule score {res.fix.score}/100</div>
          <div className="ed-actions"><button type="button" className="ed-cta" onClick={wear}>Wear the fix</button><button type="button" className="ed-link" onClick={() => go(`/mix?ids=${res.fix.itemIds.join(',')}`)}>Fine-tune</button></div>
          <Fineprint>{res.source === 'ai' ? 'Understood by AI; the fix and score come from Closet’s rules.' : 'Understood by Closet’s keyword rules (no AI needed).'}</Fineprint>
        </Spread>
      ) : (
        <Spread tone="bad" label={res.problemLabel} headline="No quick fix right now" sub={res.message} />
      ))}
    </div>
  );
}
