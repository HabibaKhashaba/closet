// Mood styling — v3.0: "I feel cozy" → three different looks that fit the mood AND pass the rules.
import React, { useState } from 'react';
import { api } from '../../api.js';
import { Chips, Icon, PageHead, SprintNote, Tabs, Tile, pieceName, useApp, useLoad } from '../../ui.jsx';
import { LookCard } from './common.jsx';
import { go } from '../../App.jsx';

export default function MoodScreen() {
  const { vocab, toast } = useApp();
  const moods = useLoad(() => api.moods(), []);
  const closet = useLoad(() => api.items(), []);
  const [tab, setTab] = useState('mood');
  const [mood, setMood] = useState('confident');
  const [occasion, setOccasion] = useState('Everyday');
  const [pieceId, setPieceId] = useState(null);
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);

  async function run(m = mood) {
    setBusy(true);
    try { setRes(tab === 'mood' ? await api.mood({ mood: m, occasion }) : await api.restyle({ itemId: pieceId })); } catch (e) { toast(e.message, true); } finally { setBusy(false); }
  }
  const list = moods.data?.moods || [];
  return (
    <>
      <PageHead title="Mood styling" sub="Dress for how you feel. Every look still passes Closet’s five style rules — the mood only decides which valid looks come first." />
      <Tabs options={[['mood', 'Style my mood'], ['restyle', 'One piece, every mood']]} value={tab} onChange={(t) => { setTab(t); setRes(null); }} />
      <section className="table-board stack lg" style={{ marginTop: 16 }}>
        {tab === 'mood' ? (
          <>
            <div className="studio-grid">
              {list.map((m) => (
                <button type="button" key={m.key} className={`studio-card ${mood === m.key ? 'on' : ''}`} style={{ textAlign: 'left', border: mood === m.key ? '2px solid var(--rose)' : '2px solid transparent', cursor: 'pointer' }} onClick={() => { setMood(m.key); run(m.key); }} aria-pressed={mood === m.key}>
                  <b style={{ fontFamily: 'var(--serif)', fontSize: 18 }}>{m.label}</b><div className="small muted">{m.line}</div>
                </button>
              ))}
            </div>
            <Chips options={Object.keys(vocab.OCCASIONS)} value={occasion} multiple={false} onChange={(v) => setOccasion(v || occasion)} />
            <div className="row"><button type="button" className="btn rose" disabled={busy} onClick={() => run()}><Icon name="smile" size={15} />{busy ? 'Styling…' : 'Show my looks'}</button></div>
          </>
        ) : (
          <>
            <div className="picker">
              {(closet.data?.items || []).filter((p) => p.status === 'Available').map((p) => (
                <button type="button" key={p.id} className={pieceId === p.id ? 'on' : ''} onClick={() => setPieceId(p.id)}><Tile piece={p} /><div className="tiny" style={{ fontWeight: 600, marginTop: 6 }}>{pieceName(p)}</div></button>
              ))}
            </div>
            <div className="row"><button type="button" className="btn rose" disabled={busy || !pieceId} onClick={() => run()}><Icon name="smile" size={15} />{busy ? 'Styling…' : 'Restyle it'}</button></div>
          </>
        )}
      </section>
      <section style={{ marginTop: 20 }} aria-live="polite">
        {res && tab === 'mood' && (res.looks.length ? (
          <div className="studio-looks">
            {res.looks.map((l) => (
              <LookCard key={l.itemIds.join()} title={l.name} sub={`${res.label} fit ${l.moodFit}%`} look={l}>
                <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>{l.moodReasons.map((x) => <li key={x}>{x}</li>)}</ul>
                <button type="button" className="btn line sm" onClick={() => go(`/mix?ids=${l.itemIds.join(',')}`)}>Open in Mix & Match</button>
              </LookCard>
            ))}
          </div>
        ) : <p className="muted">{res.message}</p>)}
        {res && tab === 'restyle' && (
          <div className="studio-looks">
            {res.moods.map((m) => (
              <LookCard key={m.mood} title={m.label} sub={`${res.occasion} · mood fit ${m.look.moodFit}%`} look={m.look}>
                <button type="button" className="btn line sm" onClick={() => go(`/mix?ids=${m.look.itemIds.join(',')}`)}>Open in Mix & Match</button>
              </LookCard>
            ))}
            {!res.moods.length && <p className="muted">No valid look with this piece right now.</p>}
          </div>
        )}
      </section>
      <div style={{ marginTop: 20 }}><SprintNote n={5} /></div>
    </>
  );
}
