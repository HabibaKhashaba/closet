// v1.6 garment lifecycle actions, shared by the piece page, Care, Borrow & lend and Donation.
// Every form calls the real endpoint and the caller re-reads the state afterwards (no optimistic copies).
import React, { useState } from 'react';
import { api, ApiError } from '../api.js';
import { Field, Icon, Modal, Tile, fmtDate, pieceName, useApp } from '../ui.jsx';

const today = () => new Date().toISOString().slice(0, 10);
const inDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const errFor = (errs, f) => (errs.find((e) => e.field === f) || {}).message;

// Repair / Alter → Needs repair | Needs alteration (reason, optional notes)
export function RepairModal({ piece, onClose, onDone }) {
  const { toast, refresh } = useApp();
  const [kind, setKind] = useState(piece.status === 'Needs repair' ? 'repair' : 'alteration');
  const [reason, setReason] = useState(piece.care?.reason || '');
  const [notes, setNotes] = useState(piece.care?.notes || '');
  const [errs, setErrs] = useState([]);
  async function save() {
    try {
      const p = await api.needsCare(piece.id, { kind, reason: reason.trim(), ...(notes.trim() && { notes: notes.trim() }) });
      toast(`${pieceName(p)}: ${kind === 'repair' ? 'needs repair' : 'needs alteration'} — it’s under Care and out of your outfits`);
      refresh(); onDone && onDone(p); onClose();
    } catch (e) { if (e instanceof ApiError) setErrs(e.details || []); toast(e.message, true); }
  }
  return (
    <Modal title="Repair / Alter" sub="Closet keeps it in your closet, shows it under Care and leaves it out of outfits until it’s fixed." onClose={onClose}>
      <div className="donate-head"><Tile piece={piece} status={false} /><div><b>{pieceName(piece)}</b><span className="small muted">What does it need?</span></div></div>
      <div className="reason-cards" role="radiogroup" aria-label="What it needs">
        {[['repair', 'Needs repair', 'Torn seam, loose button, broken zip', 'alert'], ['alteration', 'Needs alteration', 'Sleeves too long, take in, hem', 'swap']].map(([k, t, s, icon]) => (
          <button key={k} type="button" role="radio" aria-checked={kind === k} className={`reason-card ${kind === k ? 'on' : ''}`} onClick={() => setKind(k)}><i><Icon name={icon} size={18} /></i><b>{t}</b><span>{s}</span></button>
        ))}
      </div>
      <Field label="Reason" error={errFor(errs, 'reason')}><input value={reason} maxLength={80} onChange={(e) => setReason(e.target.value)} placeholder={kind === 'alteration' ? 'Sleeves too long' : 'Loose button'} aria-label="Reason" /></Field>
      <Field label="Notes (optional)" error={errFor(errs, 'notes')}><textarea rows={2} value={notes} maxLength={200} onChange={(e) => setNotes(e.target.value)} placeholder="Shorten by 2 cm" aria-label="Notes" /></Field>
      <div className="row end"><button type="button" className="btn line" onClick={onClose}>Cancel</button><button type="button" className="btn" disabled={!reason.trim()} onClick={save}><Icon name="check" size={15} />Save</button></div>
    </Modal>
  );
}

// Send to tailor (from Needs repair / Needs alteration): tailor (optional), date sent, expected return, cost (optional)
export function TailorModal({ piece, onClose, onDone }) {
  const { toast, refresh } = useApp();
  const [f, setF] = useState({ tailor: '', sentOn: today(), expectedBack: inDays(5), cost: '' });
  const [errs, setErrs] = useState([]);
  async function save() {
    try {
      const p = await api.sendToTailor(piece.id, { ...(f.tailor.trim() && { tailor: f.tailor.trim() }), sentOn: f.sentOn, expectedBack: f.expectedBack, ...(f.cost !== '' && { cost: Number(f.cost) }) });
      toast(`${pieceName(p)} is at the tailor — back ${fmtDate(p.statusUntil)}`); refresh(); onDone && onDone(p); onClose();
    } catch (e) { if (e instanceof ApiError) setErrs(e.details || []); toast(e.message, true); }
  }
  return (
    <Modal title="Send to tailor" sub={`${pieceName(piece)} · ${piece.care ? `${piece.care.kind === 'alteration' ? 'Alteration' : 'Repair'}: ${piece.care.reason}` : ''}`} onClose={onClose}>
      <div className="grid g2" style={{ gap: '0 12px' }}>
        <Field label="Tailor (optional)" error={errFor(errs, 'tailor')}><input value={f.tailor} maxLength={60} onChange={(e) => setF({ ...f, tailor: e.target.value })} placeholder="Hany Tailoring" aria-label="Tailor" /></Field>
        <Field label="Cost (optional)" error={errFor(errs, 'cost')}><input type="number" min="0" step="0.01" value={f.cost} onChange={(e) => setF({ ...f, cost: e.target.value })} placeholder="150" aria-label="Cost" /></Field>
        <Field label="Date sent" error={errFor(errs, 'sentOn')}><input type="date" value={f.sentOn} onChange={(e) => setF({ ...f, sentOn: e.target.value })} aria-label="Date sent" /></Field>
        <Field label="Expected return" error={errFor(errs, 'expectedBack')}><input type="date" value={f.expectedBack} min={f.sentOn} onChange={(e) => setF({ ...f, expectedBack: e.target.value })} aria-label="Expected return" /></Field>
      </div>
      <p className="tiny muted">On the expected day Closet reminds you: “should be ready from the tailor today” — Mark collected or Remind me later.</p>
      <div className="row end"><button type="button" className="btn line" onClick={onClose}>Cancel</button><button type="button" className="btn" onClick={save}><Icon name="arrow" size={15} />Send to tailor</button></div>
    </Modal>
  );
}

// Lend item: person, date lent, expected return, optional note → Borrowed (history kept)
export function LendModal({ piece, onClose, onDone }) {
  const { toast, refresh } = useApp();
  const [f, setF] = useState({ person: '', lentOn: today(), dueOn: inDays(7), note: '' });
  const [errs, setErrs] = useState([]);
  async function save() {
    try {
      const p = await api.lend(piece.id, { person: f.person.trim(), lentOn: f.lentOn, dueOn: f.dueOn, ...(f.note.trim() && { note: f.note.trim() }) });
      toast(`${pieceName(p)} lent to ${f.person.trim()} — due ${fmtDate(f.dueOn)}`); refresh(); onDone && onDone(p); onClose();
    } catch (e) { if (e instanceof ApiError) setErrs(e.details || []); toast(e.message, true); }
  }
  return (
    <Modal title="Lend item" sub="It stays in your closet as Borrowed and is left out of outfits and plans until it’s back." onClose={onClose}>
      <div className="donate-head"><Tile piece={piece} status={false} /><div><b>{pieceName(piece)}</b><span className="small muted">Who is borrowing it?</span></div></div>
      <div className="grid g2" style={{ gap: '0 12px' }}>
        <Field label="Person" error={errFor(errs, 'person')}><input value={f.person} maxLength={60} onChange={(e) => setF({ ...f, person: e.target.value })} placeholder="Nour" aria-label="Person" /></Field>
        <Field label="Note (optional)" error={errFor(errs, 'note')}><input value={f.note} maxLength={120} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="For her graduation" aria-label="Note" /></Field>
        <Field label="Date lent" error={errFor(errs, 'lentOn')}><input type="date" value={f.lentOn} onChange={(e) => setF({ ...f, lentOn: e.target.value })} aria-label="Date lent" /></Field>
        <Field label="Expected return" error={errFor(errs, 'dueOn')}><input type="date" value={f.dueOn} min={f.lentOn} onChange={(e) => setF({ ...f, dueOn: e.target.value })} aria-label="Expected return" /></Field>
      </div>
      <div className="row end"><button type="button" className="btn line" onClick={onClose}>Cancel</button><button type="button" className="btn" disabled={!f.person.trim()} onClick={save}><Icon name="user" size={15} />Lend item</button></div>
    </Modal>
  );
}

// The state card on the piece page: what is going on with this piece and the one or two actions that fit.
export function LifecycleInfo({ piece, onChanged, onTailor }) {
  const { toast, refresh } = useApp();
  const p = piece;
  async function collected() { try { const r = await api.careDone(p.id); toast(r.message); refresh(); onChanged(); } catch (e) { toast(e.message, true); } }
  async function returned() { try { await api.returned(p.id); toast(`${pieceName(p)} is back — Available`); refresh(); onChanged(); } catch (e) { toast(e.message, true); } }
  if (p.status === 'Needs repair' || p.status === 'Needs alteration') {
    return (
      <div className="notice warn" style={{ display: 'block', marginTop: 12 }}>
        <b>{p.status}</b>{p.care && <> · {p.care.reason}</>}{p.care?.notes && <span className="small muted"> · {p.care.notes}</span>}
        <div className="row" style={{ marginTop: 8 }}>
          <button type="button" className="btn sm" onClick={onTailor}><Icon name="arrow" size={14} />Send to tailor</button>
          <button type="button" className="btn line sm" onClick={collected}><Icon name="check" size={14} />Fixed at home</button>
        </div>
      </div>
    );
  }
  if (p.status === 'At tailor') {
    const due = p.statusUntil && p.statusUntil <= today();
    return (
      <div className={`notice ${due ? 'warn' : 'info'}`} style={{ display: 'block', marginTop: 12 }}>
        <b>At tailor</b>{p.care?.tailor && <> · {p.care.tailor}</>}{p.care && <> · {p.care.kind === 'alteration' ? 'Alteration' : 'Repair'}: {p.care.reason}</>}
        {p.statusUntil && <> · expected {fmtDate(p.statusUntil)}{due ? ' — should be ready' : ''}</>}{p.care?.cost != null && <> · {p.care.cost}</>}
        <div className="row" style={{ marginTop: 8 }}><button type="button" className="btn sm" onClick={collected}><Icon name="check" size={14} />Mark collected</button></div>
      </div>
    );
  }
  if (p.status === 'Borrowed') {
    const l = p.loan || { person: p.statusNote, dueOn: p.statusUntil };
    const overdue = l.dueOn && l.dueOn < today();
    return (
      <div className={`notice ${overdue ? 'warn' : 'info'}`} style={{ display: 'block', marginTop: 12 }}>
        <b>Lent to {l.person || 'someone'}</b>{l.lentOn && <> · since {fmtDate(l.lentOn)}</>}{l.dueOn && <> · due {fmtDate(l.dueOn)}{overdue ? ' (overdue)' : ''}</>}{l.note && <span className="small muted"> · {l.note}</span>}
        <div className="row" style={{ marginTop: 8 }}><button type="button" className="btn sm" onClick={returned}><Icon name="check" size={14} />Mark returned</button><a className="btn ghost sm" href="#/lending">Borrow &amp; lend</a></div>
      </div>
    );
  }
  if (p.status === 'Ready to donate') {
    return (
      <div className="notice" style={{ display: 'block', marginTop: 12 }}>
        <b>Ready to donate</b> · it’s waiting under Donation and left out of new outfits.
        <div className="row" style={{ marginTop: 8 }}><a className="btn sm" href="#/donation"><Icon name="heart" size={14} />Open Donation</a></div>
      </div>
    );
  }
  return null;
}
