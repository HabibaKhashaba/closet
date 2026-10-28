// Proactive intelligence in the web app (v1.5). One small set of components reused by Home, Closet,
// Analytics, Planner and the piece page — no separate screen per feature, and every button calls a
// real endpoint and then re-reads the state (no success toast without a state change).
import React, { useState } from 'react';
import { api } from '../api.js';
import { Icon, Modal, SprintTag, Tile, fmtDate, pieceName, relDay, useApp, useLoad } from '../ui.jsx';
import { go } from '../App.jsx';

const KEEP_REASONS = ['Still love it', 'Sentimental', 'Seasonal', 'Special occasion', 'Other'];
const METHODS = [
  { m: 'donate', title: 'Donate', sub: 'To someone who may need it', icon: 'heart' },
  { m: 'give', title: 'Give to someone', sub: 'A friend or family member', icon: 'user' },
  { m: 'sell', title: 'Sell / rehome', sub: 'Find it a new home', icon: 'bag' },
];

// "Donate this item?" — two steps, nothing leaves the closet until the user confirms it has gone.
export function DonateFlow({ piece, onClose, onChanged }) {
  const { toast, refresh } = useApp();
  const [step, setStep] = useState(piece.rehome ? 'ready' : 'choose');
  const [current, setCurrent] = useState(piece);
  const [busy, setBusy] = useState(false);
  async function mark(method) {
    setBusy(true);
    try { const p = await api.rehome(piece.id, method); setCurrent(p); setStep('ready'); toast(`${pieceName(p)}: ${p.rehome.label.toLowerCase()}`); onChanged && onChanged(p); } catch (e) { toast(e.message, true); } finally { setBusy(false); }
  }
  async function done() {
    setBusy(true);
    try { const r = await api.rehomeDone(piece.id); toast(r.effect); refresh(); onChanged && onChanged(null); onClose(); go('/closet'); } catch (e) { toast(e.message, true); } finally { setBusy(false); }
  }
  async function cancel() {
    try { const p = await api.cancelRehome(piece.id); toast('Back in your rotation'); onChanged && onChanged(p); onClose(); } catch (e) { toast(e.message, true); }
  }
  const since = current.lastWornAt ? Math.floor((Date.now() - new Date(current.lastWornAt)) / 86400000) : null;
  return (
    <Modal title={step === 'choose' ? 'Donate this item?' : current.rehome ? current.rehome.label : 'Ready'} sub={step === 'choose' ? 'Closet will keep it in your closet until you confirm it has left.' : 'It stays in your closet, left out of new outfits, until it has actually gone.'} onClose={onClose}>
      <div className="donate-head">
        <Tile piece={current} status={false} />
        <div><b>{pieceName(current)}</b><span className="small muted">{since === null ? 'Never worn' : `Last worn ${since} days ago`}{current.wearCount ? ` · worn ${current.wearCount}×` : ''}</span></div>
      </div>
      {step === 'choose' ? (
        <>
          <div className="reason-cards" role="radiogroup" aria-label="How it leaves">
            {METHODS.map(({ m, title, sub, icon }) => (
              <button key={m} type="button" className="reason-card" disabled={busy} onClick={() => mark(m)}><i><Icon name={icon} size={18} /></i><b>{title}</b><span>{sub}</span></button>
            ))}
          </div>
          <p className="tiny muted" style={{ marginTop: 10 }}>Closet isn’t connected to charities or marketplaces — this keeps your closet accurate. No replacement is added to your shopping bag.</p>
          <div className="row end" style={{ marginTop: 16 }}><button type="button" className="btn line" onClick={onClose}>Cancel</button></div>
        </>
      ) : (
        <div className="row end" style={{ marginTop: 18 }}>
          <button type="button" className="btn ghost" onClick={cancel}>Keep it after all</button>
          <button type="button" className="btn" disabled={busy} onClick={done}><Icon name="check" size={15} />{current.rehome?.method === 'give' ? 'Mark as given away' : current.rehome?.method === 'sell' ? 'Mark as rehomed' : 'Mark as donated'}</button>
        </div>
      )}
    </Modal>
  );
}

// "Still love it?" — a long-unworn piece with four choices. The user stays in control.
export function StillLoveIt({ candidate, onChanged, compact }) {
  const { toast } = useApp();
  const [keep, setKeep] = useState(false);
  const [donate, setDonate] = useState(false);
  const p = candidate.piece;
  async function doKeep(reason, days = 90) {
    try { const r = await api.keep(p.id, { days, ...(reason && { reason }) }); toast(r.message); setKeep(false); onChanged && onChanged(); } catch (e) { toast(e.message, true); }
  }
  return (
    <section className={`forgot still rise ${compact ? 'compact' : ''}`} aria-label="Still love it?">
      <div className="polaroid"><Tile piece={p} status={false} /><span>{candidate.days} days</span></div>
      <div className="stack" style={{ gap: 8 }}>
        <div className="row"><span className="kicker" style={{ color: 'var(--butter-ink)' }}>Still love it?</span><SprintTag n={3} short /></div>
        <h2 style={{ fontSize: compact ? 22 : 26 }}>Your {pieceName(p).toLowerCase()}</h2>
        <p className="small muted">Last worn {candidate.days} days ago. Give it another chance — or pass it on to someone who may need it.</p>
        <div className="row wrap">
          <a className="btn sm" href={`#/outfits?fixed=${p.id}`}><Icon name="wand" size={15} />Style it</a>
          <button type="button" className="btn line sm" onClick={() => setKeep(true)}><Icon name="heart" size={15} />Keep it</button>
          <button type="button" className="btn line sm" onClick={() => setDonate(true)}><Icon name="bag" size={15} />Donate</button>
          <button type="button" className="btn ghost sm" onClick={() => doKeep(null, 14)}>Not now</button>
        </div>
      </div>
      {keep && (
        <Modal title="Keep it" sub="Closet won’t ask again for 90 days. Why are you keeping it? (optional)" onClose={() => setKeep(false)}>
          <div className="chips">{KEEP_REASONS.map((r) => <button key={r} type="button" className="chip" onClick={() => doKeep(r)}>{r}</button>)}</div>
          <div className="row end" style={{ marginTop: 16 }}><button type="button" className="btn" onClick={() => doKeep(null)}>Just keep it</button></div>
        </Modal>
      )}
      {donate && <DonateFlow piece={p} onClose={() => setDonate(false)} onChanged={() => onChanged && onChanged()} />}
    </section>
  );
}

// Closet noticed: at most TWO proactive notices on Home, highest priority first (no notice spam).
export function ClosetNoticed() {
  const { toast, refresh } = useApp();
  const monitor = useLoad(() => api.monitor(), []);
  const laundry = useLoad(() => api.laundryRisk(), []);
  const borrowed = useLoad(() => api.borrowed(), []);
  const seasonal = useLoad(() => api.seasonal(), []);
  const reloadAll = () => { monitor.reload(true); laundry.reload(true); borrowed.reload(true); seasonal.reload(true); refresh(); };
  async function adjust(a) {
    try { const r = await api.adjustPlanned(a.eventId, a.itemId); toast(`Changed only the ${pieceName(r.replaced).toLowerCase()} → ${pieceName(r.with).toLowerCase()}`); reloadAll(); } catch (e) { toast(e.message, true); }
  }
  async function ignore(a) { try { await api.ignoreAlert(a.key); reloadAll(); } catch (e) { toast(e.message, true); } }
  async function returned(b) { try { await api.setStatus(b.id, 'Available'); toast(`${pieceName(b.piece)} is back — Available`); reloadAll(); } catch (e) { toast(e.message, true); } }
  async function later(b) { try { await api.remindLater(b.id, 3); toast('Okay — reminder in 3 days'); reloadAll(); } catch (e) { toast(e.message, true); } }

  const cards = [];
  for (const a of monitor.data?.alerts || []) {
    cards.push({ key: a.key, level: 'HIGH', icon: a.kind === 'weather' ? 'cloud' : 'alert', title: a.kind === 'weather' ? `Weather changed · ${a.event.title}` : `Planned outfit · ${a.event.title}`, text: a.message,
      sub: `${relDay(a.event.date)} · ${a.event.time}`,
      actions: [
        a.itemId && <button key="a" type="button" className="btn sm" onClick={() => adjust(a)}><Icon name="swap" size={14} />{a.kind === 'weather' ? 'Adjust outfit' : 'Replace item'}</button>,
        a.kind === 'availability' && a.status === 'Laundry' && <a key="w" className="btn line sm" href="#/laundry">Wash first</a>,
        <button key="i" type="button" className="btn ghost sm" onClick={() => ignore(a)}>Ignore</button>,
      ] });
  }
  for (const w of laundry.data?.warnings || []) cards.push({ key: w.key, level: 'MEDIUM', icon: 'washer', title: 'Laundry may affect your plans', text: w.message, actions: [<a key="l" className="btn sm" href="#/laundry">Open laundry</a>] });
  for (const b of borrowed.data?.overdue || []) cards.push({ key: `b${b.id}`, level: 'MEDIUM', icon: 'clock', title: `Lent to ${b.borrowedBy || 'someone'}`, text: b.message, actions: [<button key="r" type="button" className="btn sm" onClick={() => returned(b)}><Icon name="check" size={14} />Mark returned</button>, <button key="l" type="button" className="btn ghost sm" onClick={() => later(b)}>Remind me later</button>] });
  if (seasonal.data?.headline) cards.push({ key: 'season', level: 'LOW', icon: 'sun', title: 'Seasonal rotation', text: seasonal.data.headline, actions: [<a key="v" className="btn line sm" href="#/analytics#seasonal">Review</a>] });
  const shown = cards.slice(0, 2);
  if (!shown.length) return null;
  return (
    <section className="noticed rise" aria-label="Closet noticed">
      <div className="row between"><span className="kicker"><Icon name="brain" size={13} /> Closet noticed</span>{cards.length > 2 && <span className="tiny muted">{cards.length - 2} more in notifications</span>}</div>
      <div className="noticed-grid">
        {shown.map((c) => (
          <div key={c.key} className={`notice-card ${c.level.toLowerCase()}`}>
            <span className="ni"><Icon name={c.icon} size={17} /></span>
            <div className="stack" style={{ gap: 6 }}>
              <b className="small">{c.title}</b>
              <span className="small">{c.text}</span>
              {c.sub && <span className="tiny muted">{c.sub}</span>}
              <div className="row wrap" style={{ gap: 6 }}>{c.actions.filter(Boolean)}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// Seasonal rotation review (Analytics → #seasonal). Nothing moves until the user chooses.
export function SeasonalReview() {
  const { toast, refresh } = useApp();
  const s = useLoad(() => api.seasonal(), []);
  const [picked, setPicked] = useState(null);
  if (!s.data) return null;
  const list = s.data.bringBack.length ? s.data.bringBack : s.data.pack;
  const mode = s.data.bringBack.length ? 'bring_back' : 'pack';
  const chosen = picked || list.map((p) => p.id);
  async function apply(action) {
    try { const r = await api.applySeasonal(action, chosen); toast(action === 'pack' ? `${r.changed.length} piece${r.changed.length === 1 ? '' : 's'} packed for the season` : action === 'bring_back' ? `${r.changed.length} back in rotation` : 'Okay — not now'); setPicked(null); s.reload(true); refresh(); } catch (e) { toast(e.message, true); }
  }
  return (
    <section className="card pad" id="seasonal">
      <div className="card-head"><div className="row"><h3>Seasonal rotation</h3><SprintTag n={3} short /></div><span className="tiny muted">{s.data.tempC} °C · feels like {String(s.data.season || '').toLowerCase()}</span></div>
      {!list.length ? <p className="small muted">Nothing to rotate right now. Closet decides by the temperature you’ll feel and each piece’s season, never by the calendar alone.</p> : (
        <>
          <p className="small" style={{ marginBottom: 12 }}>{s.data.headline}</p>
          <div className="mini-grid">{list.map((p) => (
            <label key={p.id} className={`pick ${chosen.includes(p.id) ? 'on' : ''}`}>
              <input type="checkbox" checked={chosen.includes(p.id)} onChange={(e) => setPicked(e.target.checked ? [...chosen, p.id] : chosen.filter((x) => x !== p.id))} />
              <Tile piece={p} status={false} /><span className="tiny">{pieceName(p)}</span>
            </label>
          ))}</div>
          <div className="row" style={{ marginTop: 12 }}>
            {mode === 'pack' ? <button type="button" className="btn sm" disabled={!chosen.length} onClick={() => apply('pack')}><Icon name="suitcase" size={14} />Pack for season</button>
              : <button type="button" className="btn sm" disabled={!chosen.length} onClick={() => apply('bring_back')}><Icon name="check" size={14} />Bring back</button>}
            <button type="button" className="btn line sm" onClick={() => apply('not_now')} disabled={!chosen.length}>Keep active</button>
            <button type="button" className="btn ghost sm" onClick={() => apply('not_now')} disabled={!chosen.length}>Not now</button>
          </div>
        </>
      )}
    </section>
  );
}

// Cost per wear on the piece page: optional price, only confirmed wears count.
export function CostPerWear({ piece }) {
  const c = piece.costPerWear;
  if (!c || !c.hasPrice) return <p className="tiny muted">Add a purchase price (optional) to see cost per wear. Only outfits you actually wore count.</p>;
  return (
    <div className="cpw">
      <b>{c.perWear === null ? '—' : `${c.currency} ${c.perWear.toLocaleString('en-US')}`}</b>
      <span className="small muted">{c.perWear === null ? c.text : `per wear · ${c.currency} ${c.price.toLocaleString('en-US')} ÷ ${c.wears} wears`}</span>
    </div>
  );
}

export function BorrowInfo({ piece, onChanged }) {
  const { toast } = useApp();
  if (piece.status !== 'Borrowed') return null;
  const since = piece.statusSince ? Math.max(0, Math.round((Date.now() - new Date(piece.statusSince)) / 86400000)) : null;
  const overdue = piece.statusUntil && piece.statusUntil < new Date().toISOString().slice(0, 10);
  async function later() { try { await api.remindLater(piece.id, 3); toast('Reminder in 3 days'); onChanged(); } catch (e) { toast(e.message, true); } }
  return (
    <div className={`notice ${overdue ? 'warn' : 'info'}`} style={{ display: 'block', marginTop: 12 }}>
      <b>Lent to {piece.statusNote || 'someone'}</b>{since !== null && <> · {since} day{since === 1 ? '' : 's'}</>}
      {piece.statusUntil && <> · expected {fmtDate(piece.statusUntil)}{overdue ? ' (overdue)' : ''}</>}
      {overdue && <div className="row" style={{ marginTop: 8 }}><button type="button" className="btn ghost sm" onClick={later}>Remind me later</button></div>}
    </div>
  );
}
