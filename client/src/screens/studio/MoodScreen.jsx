// Mood styling — v3.0, editorial design. Every look still passes the five rules; the mood only ranks them.
import React, { useState } from 'react';
import { api } from '../../api.js';
import { useApp, useLoad } from '../../ui.jsx';
import { ACCENT, Choice, Cover, Fineprint, LookPanel, Shelf, Step } from './editorial.jsx';
import { go } from '../../App.jsx';

const MOOD_COLOUR = { confident: '#652F3C', cozy: '#652F3C', bold: '#652F3C', calm: '#652F3C', playful: '#652F3C', elegant: '#652F3C' };

export default function MoodScreen() {
  const { vocab, toast } = useApp();
  const moods = useLoad(() => api.moods(), []);
  const closet = useLoad(() => api.items(), []);
  const [tab, setTab] = useState('mood');
  const [mood, setMood] = useState(null);
  const [occasion, setOccasion] = useState('Everyday');
  const [pieceId, setPieceId] = useState(null);
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);

  async function run(next = {}) {
    const m = next.mood || mood; const occ = next.occasion || occasion;
    setBusy(true);
    try { setRes(tab === 'mood' ? await api.mood({ mood: m, occasion: occ }) : await api.restyle({ itemId: next.pieceId || pieceId })); } catch (e) { toast(e.message, true); } finally { setBusy(false); }
  }
  const list = moods.data?.moods || [];
  const acc = ACCENT.mood;
  return (
    <div className="ed" style={{ '--acc': acc }}>
      <Cover feature="mood" no={5} kicker="Dress the feeling" title="Mood styling" pick={['Cream knit sweater', 'Rose wrap dress', 'Camel cardigan']}
        dek="How do you want to feel today? Pick a mood — every look still passes Closet’s five style rules." />
      <Choice label="Mode" options={['mood', 'restyle']} value={tab} render={(t) => (t === 'mood' ? 'Style my mood' : 'One piece, every mood')} onChange={(t) => { setTab(t); setRes(null); }} />

      {tab === 'mood' ? (
        <>
          <Step n={1} title="How do you feel?">
            <div className="ed-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', marginTop: 0 }}>
              {list.map((m) => (
                <button type="button" key={m.key} aria-pressed={mood === m.key} onClick={() => { setMood(m.key); run({ mood: m.key }); }}
                  style={{ textAlign: 'left', cursor: 'pointer', border: 0, borderRadius: 18, padding: '20px 18px', minHeight: 132, background: mood === m.key ? 'var(--rose-soft)' : '#fff', color: 'var(--ink)', outline: mood === m.key ? '1.5px solid #652F3C' : 'none', boxShadow: '0 18px 36px -28px rgba(0,0,0,.5)', borderTop: 0 }}>
                  <div style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 600, lineHeight: 1 }}>{m.label}</div>
                  <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 14, marginTop: 10, opacity: .85 }}>{m.line}</div>
                </button>
              ))}
            </div>
          </Step>
          <Step n={2} title="Where to?">
            <Choice label="Occasion" options={Object.keys(vocab.OCCASIONS)} value={occasion} onChange={(o) => { setOccasion(o); if (mood) run({ occasion: o }); }} />
          </Step>
        </>
      ) : (
        <Step n={1} title="Pick one piece">
          <Shelf items={(closet.data?.items || []).filter((p) => p.status === 'Available' && p.photoUrl)} value={pieceId} onChange={(id) => { setPieceId(id); run({ pieceId: id }); }} />
        </Step>
      )}
      {busy && <p className="ed-sub">Styling…</p>}

      {res && tab === 'mood' && (
        <Step n={3} title={`Three ${res.label.toLowerCase()} looks`} aside={<span className="ed-fine">{res.line}</span>}>
          {res.looks.length ? (
            <div className="ed-grid">
              {res.looks.map((l, i) => (
                <LookPanel key={l.itemIds.join()} eyebrow={`${res.label} · ${l.moodFit}% mood fit`} title={l.name} look={l} quote={l.moodReasons[0]} meta={i === 0 ? 'best match' : null}>
                  <button type="button" className="ed-link" onClick={() => go(`/mix?ids=${l.itemIds.join(',')}`)}>Open in Mix & Match</button>
                </LookPanel>
              ))}
            </div>
          ) : <p className="ed-sub">{res.message}</p>}
        </Step>
      )}
      {res && tab === 'restyle' && (
        <Step n={2} title="Same piece, six moods">
          <div className="ed-grid">
            {res.moods.map((m) => (
              <div key={m.mood} style={{ '--acc': MOOD_COLOUR[m.mood] }}>
                <LookPanel eyebrow={`${res.occasion} · ${m.look.moodFit}% mood fit`} title={m.label} look={m.look}>
                  <button type="button" className="ed-link" onClick={() => go(`/mix?ids=${m.look.itemIds.join(',')}`)}>Open in Mix & Match</button>
                </LookPanel>
              </div>
            ))}
            {!res.moods.length && <p className="ed-sub">No valid look with this piece right now.</p>}
          </div>
        </Step>
      )}
      <Fineprint>Mood fit = how many pieces share the mood’s styles, colours and fabrics. The match % and rule score are the same rules as Style me.</Fineprint>
    </div>
  );
}
