// Ask Closet (Sprint 3 product preview). A message becomes ONE whitelisted Closet function —
// chosen by the language model when one is configured, otherwise by the keyword parser — and
// runs only through the other modules. Every change can be undone.
import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { Icon, SprintNote, SprintTag, Tile, pieceName, useApp } from '../ui.jsx';
import OutfitCard from './OutfitCard.jsx';

const EXAMPLES = ['What should I wear to university tomorrow?', 'I want to buy beige trousers. Do I need them?', 'Put beige trousers on my shopping list', 'Add a replacement for my torn loafers', 'What is missing from my wardrobe?', 'Style my blue skirt', 'Put my light-wash jeans in the laundry', 'Weather on Friday?'];
const FN_LABEL = { recommend: 'Recommendation Engine', change_piece: 'Recommendation Engine · swap', set_status: 'Availability', wash_done: 'Availability · wash done', forgotten: 'Analytics · forgotten', style_piece: 'Recommendation Engine · style a piece', closet_needs: 'Smart Shopping', buy_check: 'Smart Shopping · do I need it?', add_to_shopping: 'Smart Shopping · shopping list', similar_owned: 'Wardrobe · similar pieces', weather: 'Weather adapter', hide_piece: 'Outfits · hide', plan_event: 'Planner', help: 'Help' };

function Pieces({ list, styleIt, onStyle }) {
  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10, marginTop: 10 }}>
      {list.map((p) => (
        <div key={p.id} className="stack" style={{ gap: 6 }}>
          <a href={`#/closet/${p.id}`}><Tile piece={p} /></a>
          <span className="tiny" style={{ fontWeight: 600 }}>{pieceName(p)}{p.daysSince ? <span className="muted"> · {p.daysSince}d</span> : null}{p.similarity ? <span className="muted"> · {p.similarity}% similar</span> : null}</span>
          {styleIt && <button type="button" className="btn line sm" onClick={() => onStyle(p)}>Style this piece</button>}
        </div>
      ))}
    </div>
  );
}

export default function AskScreen({ query }) {
  const { toast, refresh } = useApp();
  const [log, setLog] = useState([{ who: 'ai', reply: 'Hi! I know your closet, what’s in the laundry, the weather and your calendar. Ask me anything about what to wear.' }]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [ctx, setCtx] = useState(null);
  const [model, setModel] = useState(null);
  const end = useRef(null);
  const hour = new Date().getHours();
  const contextual = [hour >= 16 ? 'What should I wear tonight?' : 'What should I wear today?', 'Do I need beige trousers?', 'Put beige trousers on my shopping list', 'Style my navy blazer', 'What haven’t I worn lately?'];

  useEffect(() => { api.chatInfo().then((r) => setModel(r.languageModel)).catch(() => {}); }, []);
  useEffect(() => { const el = end.current?.parentElement; if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }); }, [log, busy]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (query.q) send(query.q); }, []);

  async function send(message, pieceId) {
    if (!message.trim() || busy) return;
    setLog((l) => [...l, { who: 'me', text: message }]);
    setText('');
    setBusy(true);
    try {
      const r = await api.chat(message, ctx, pieceId);
      if (r.outfits && r.outfits[0]) setCtx({ itemIds: r.outfits[0].itemIds, ...(r.context || {}) });
      else if (r.context) setCtx((c) => ({ ...(c || {}), ...r.context }));
      setLog((l) => [...l, { who: 'ai', ...r }]);
      if (r.undoId) refresh();
    } catch (e) { setLog((l) => [...l, { who: 'ai', reply: e.message }]); } finally { setBusy(false); }
  }
  async function undo(id, idx) {
    try { await api.undo(id); setLog((l) => l.map((m, i) => (i === idx ? { ...m, undone: true } : m))); toast('Undone'); refresh(); } catch (e) { toast(e.message, true); }
  }

  return (
    <>
      <section className="ask-hero rise">
        <div>
          <SprintTag n={3} />
          <h1 style={{ marginTop: 10 }}>Ask Closet</h1>
          <p>Your wardrobe knows more than you think.</p>
        </div>
        <div className="orb" aria-hidden="true" />
        <div className="ask-prompts">{contextual.map((q) => <button type="button" key={q} onClick={() => send(q)}>{q}</button>)}</div>
      </section>
      <div className="chat">
        <section className="card chat-main">
          <div className="chat-log">
            {log.map((m, i) => (m.who === 'me' ? <div key={i} className="msg me">{m.text}</div> : (
              <div key={i} className="msg ai">
                {m.reply}
                {m.outfits && m.outfits.length > 0 && (
                  <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 12, marginTop: 12 }}>
                    {m.outfits.slice(0, 3).map((o, j) => <OutfitCard key={j} outfit={o} compact occasion={m.context?.occasion} onReject={false} />)}
                  </div>
                )}
                {m.pieces && m.pieces.length > 0 && <>{m.piecesTitle && <div className="eyebrow" style={{ marginTop: 12 }}>{m.piecesTitle}</div>}<Pieces list={m.pieces} styleIt={m.styleIt} onStyle={(p) => send(`Style my ${pieceName(p).toLowerCase()}`, p.id)} /></>}
                {m.choices && <Pieces list={m.choices} styleIt={false} />}
                {m.listItem && (
                  <a className="bag-chip" href="#/shopping">
                    <span className="bag-mini" aria-hidden="true"><Icon name="bag" size={18} /></span>
                    <span><b>{m.listItem.title}</b><span className="tiny muted"> · {m.listItem.tags.join(' · ')}</span><br /><span className="tiny">Open your shopping bag →</span></span>
                  </a>
                )}
                {m.shopping && <div className="stack" style={{ gap: 6, marginTop: 10 }}><a className="btn line sm" href="#/shopping" style={{ alignSelf: 'flex-start' }}><Icon name="bag" size={14} />Open Smart Shopping</a></div>}
                {m.suggestions && <div className="chips" style={{ marginTop: 10 }}>{m.suggestions.map((s) => <button type="button" key={s} className="chip" onClick={() => send(s)}>{s}</button>)}</div>}
                {m.undoId && <div style={{ marginTop: 10 }}>{m.undone ? <span className="tag plain">Undone</span> : <button type="button" className="btn line sm" onClick={() => undo(m.undoId, i)}><Icon name="undo" size={14} />Undo</button>}</div>}
                {m.function && <span className="via">→ {FN_LABEL[m.function] || m.function} · understood by {m.via}</span>}
              </div>
            )))}
            {busy && <div className="msg ai"><span className="typing"><i /><i /><i /></span></div>}
            <div ref={end} />
          </div>
          <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send(text); }}>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask about your closet…" maxLength={500} aria-label="Message" />
            <button className="btn" disabled={busy || !text.trim()}><Icon name="send" size={16} />Send</button>
          </form>
        </section>
        <aside className="stack lg">
          <section className="card pad">
            <h3 style={{ marginBottom: 12 }}>Try asking</h3>
            <div className="prompts">{EXAMPLES.map((s) => <button type="button" key={s} onClick={() => send(s)}>{s}</button>)}</div>
          </section>
          <section className="card pad tint-lilac">
            <div className="eyebrow" style={{ marginBottom: 8 }}>How it works</div>
            <p className="small">The <b>language model</b> only picks one of 14 Closet functions and fills in its details. It never sees your photos or the database, and it can’t invent pieces.</p>
            <p className="small" style={{ marginTop: 8 }}>Now answering: <b>{model === 'anthropic' || model === 'openai' ? `${model} model` : 'keyword parser'}</b>{model && model !== 'anthropic' && model !== 'openai' ? ' (no API key set — same functions, simpler understanding).' : '.'}</p>
          </section>
          <SprintNote n={3} />
        </aside>
      </div>
    </>
  );
}
