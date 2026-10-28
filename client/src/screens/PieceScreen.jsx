// One piece: photo, details, availability (US-56) with return date and note, edit (US-71),
// delete with a reason (US-13), hide for 7 days (US-61), "Style this piece" (US-59).
import React, { useState } from 'react';
import { api, ApiError } from '../api.js';
import { CATEGORY_ONE, Field, Icon, Modal, PageHead, Spinner, SprintTag, STATUS_LABEL, Tile, daysSince, dressName, fmtDate, pieceName, useApp, useLoad, COLOUR_SWATCH } from '../ui.jsx';
import { go } from '../App.jsx';
import PieceForm, { cleanDetails } from './PieceForm.jsx';

const ALLOWED = {
  Available: ['Laundry', 'Borrowed', 'Packed', 'Unavailable'],
  Laundry: ['Available', 'Unavailable'],
  Borrowed: ['Available', 'Laundry'],
  Packed: ['Available', 'Laundry'],
  Unavailable: ['Available', 'Laundry'],
};
const STATUS_HELP = {
  Available: 'Clean and ready — can appear in outfits.',
  Laundry: 'In the basket. Comes back by itself after your laundry time.',
  Borrowed: 'Lent to someone. Add who has it and when it comes back.',
  Packed: 'In a suitcase. Add when you unpack.',
  Unavailable: 'At the tailor, needs repair, or put away.',
};
// US-13: exactly four reasons, each with a visible effect (SRS FR "delete reason", SDD 5.8).
const DELETE_REASONS = [
  { r: 'Torn / damaged', icon: 'alert', effect: 'A replacement goes on your shopping bag.' },
  { r: 'Became too small', icon: 'swap', effect: 'A replacement in the next size goes on your bag.' },
  { r: 'No longer my style', icon: 'eyeoff', effect: 'Never suggested again — Closet learns your taste.' },
  { r: 'Other', icon: 'more', effect: 'Closet just keeps the reason.' },
];

export default function PieceScreen({ id }) {
  const { vocab, toast, refresh } = useApp();
  const { data: p, error, reload, setData } = useLoad(() => api.item(id), [id]);
  const [editing, setEditing] = useState(null);
  const [errors, setErrors] = useState([]);
  const [moving, setMoving] = useState(null);
  const [until, setUntil] = useState('');
  const [note, setNote] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [reason, setReason] = useState('');
  const [hidden, setHidden] = useState(false);

  if (error) return <div className="card pad">This piece doesn’t exist or isn’t yours. <a className="link" href="#/closet">Back to closet</a></div>;
  if (!p) return <Spinner />;

  async function move(to, extra) {
    try {
      await api.setStatus(p.id, to, extra);
      toast(`${pieceName(p)} is now ${STATUS_LABEL[to].toLowerCase()}`);
      setMoving(null); setUntil(''); setNote('');
      refresh(); reload(true);
    } catch (e) { toast(e.message, true); }
  }
  async function saveEdit() {
    try {
      const body = cleanDetails(editing);
      for (const k of ['name', 'fabric', 'season', 'size']) if (!editing[k]) body[k] = null;
      setData(await api.editItem(p.id, body)); setEditing(null); toast('Changes saved');
    } catch (e) { if (e instanceof ApiError) setErrors(e.details); toast(e.message, true); }
  }
  async function remove() {
    try { const r = await api.deleteItem(p.id, reason); toast(r.addedToShoppingList ? `Removed. “${r.addedToShoppingList.title}” is now in your shopping bag.` : `Removed. ${r.effect}`); refresh(); go(r.addedToShoppingList ? '/shopping' : '/closet'); } catch (e) { toast(e.message, true); }
  }
  async function hide() {
    try { if (hidden) { await api.unhide(p.id); setHidden(false); toast('It can be suggested again'); } else { await api.hide(p.id); setHidden(true); toast('Hidden from suggestions for 7 days'); } } catch (e) { toast(e.message, true); }
  }
  const since = daysSince(p.lastWornAt);

  return (
    <>
      <a href="#/closet" className="small muted row" style={{ gap: 4, marginTop: 8 }}><Icon name="back" size={14} /> My closet</a>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 420px) minmax(0, 1fr)', gap: 28, marginTop: 14, alignItems: 'start' }}>
        <div className="stack">
          <Tile piece={p} style={{ borderRadius: 28 }} />
          <div className="row">
            <a className="btn grow" href={`#/outfits?fixed=${p.id}`}><Icon name="wand" size={16} />Style this piece</a>
            <a className="btn line" href={`#/mix?ids=${p.id}`}><Icon name="grid" size={16} />Mix</a>
          </div>
          <div className="row small muted" style={{ justifyContent: 'center', gap: 6 }}><SprintTag n={3} short /> Style this piece · <SprintTag n={2} short /> Mix & Match</div>
        </div>
        <div className="stack lg">
          <PageHead eyebrow={CATEGORY_ONE[p.category]} title={pieceName(p)} sprint={1}
            actions={<><button type="button" className="btn line sm" onClick={() => { setEditing({ ...p, name: p.name || '', fabric: p.fabric || '', season: p.season || '', size: p.size || '' }); setErrors([]); }}><Icon name="edit" size={15} />Edit</button>
              <button type="button" className="btn line sm" onClick={() => setDeleting(true)} title="Sprint 2 · built early"><Icon name="trash" size={15} />Remove</button></>} />

          <section className="card pad">
            <div className="card-head"><h3>Availability</h3><span className={`status ${p.status}`} style={{ background: 'var(--bg-2)' }}>{STATUS_LABEL[p.status]}</span></div>
            <p className="small muted" style={{ marginBottom: 14 }}>
              {STATUS_HELP[p.status]}
              {p.statusNote && <> With <b>{p.statusNote}</b>.</>}
              {p.expectedBack && <> Back <b>{fmtDate(p.expectedBack)}</b>.</>}
            </p>
            <div className="row">
              {ALLOWED[p.status].map((s) => (
                <button key={s} type="button" className="btn line sm" onClick={() => (['Borrowed', 'Packed', 'Unavailable'].includes(s) ? setMoving(s) : move(s))}>
                  {s === 'Available' ? <Icon name="check" size={14} /> : s === 'Laundry' ? <Icon name="laundry" size={14} /> : <Icon name="arrow" size={14} />}{s === 'Available' ? 'Mark available' : STATUS_LABEL[s]}
                </button>
              ))}
            </div>
            {moving && (
              <div className="notice" style={{ marginTop: 14, display: 'block' }}>
                <div className="grid g2" style={{ gap: '0 12px' }}>
                  <Field label={moving === 'Borrowed' ? 'Who has it?' : 'Note'}><input value={note} maxLength={60} onChange={(e) => setNote(e.target.value)} placeholder={moving === 'Borrowed' ? 'Nour' : moving === 'Packed' ? 'Sahel weekend' : 'At the tailor'} /></Field>
                  <Field label={moving === 'Packed' ? 'Unpack on' : 'Back on'}><input type="date" value={until} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setUntil(e.target.value)} /></Field>
                </div>
                <div className="row end"><button type="button" className="btn ghost sm" onClick={() => setMoving(null)}>Cancel</button><button type="button" className="btn sm" onClick={() => move(moving, { ...(until && { until }), ...(note && { note }) })}>Mark {STATUS_LABEL[moving].toLowerCase()}</button></div>
              </div>
            )}
          </section>

          <div className="grid g2">
            <section className="card pad">
              <h3 style={{ marginBottom: 14 }}>Details</h3>
              <dl className="kv">
                <dt>Colour</dt><dd className="row" style={{ gap: 8 }}><span className="swatch-dot" style={{ background: COLOUR_SWATCH[p.colour] }} />{p.colour}</dd>
                <dt>Fabric</dt><dd>{p.fabric || '—'}</dd>
                <dt>Season</dt><dd>{p.season || '—'}</dd>
                <dt>Size</dt><dd>{p.size || '—'}</dd>
                <dt>Dress code</dt><dd>{p.dressCodes.map((l) => dressName(vocab, l)).join(', ')}</dd>
                <dt>Style</dt><dd>{p.styles.join(', ') || '—'}</dd>
                <dt>Modest</dt><dd>{p.modest ? 'Yes' : 'No'}</dd>
              </dl>
            </section>
            <section className="card pad tint-sage">
              <h3 style={{ marginBottom: 14 }}>Wear history</h3>
              <div className="stat-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="stat" style={{ background: 'rgba(255,255,255,.6)' }}><b>{p.wearCount}×</b><span>worn</span></div>
                <div className="stat" style={{ background: 'rgba(255,255,255,.6)' }}><b>{since === null ? '—' : since === 0 ? 'Today' : `${since}d`}</b><span>since last worn</span></div>
              </div>
              {since !== null && since >= 40 && <p className="small" style={{ marginTop: 12 }}>Forgotten for {since} days — <a className="link" href={`#/outfits?fixed=${p.id}`}>style it</a>.</p>}
              <div className="divider" />
              <button type="button" className="btn line sm" onClick={hide}><Icon name="eyeoff" size={15} />{hidden ? 'Show in suggestions again' : 'Hide from suggestions for 7 days'}</button>
              <p className="tiny muted" style={{ marginTop: 8 }}>Hiding does not count as a dislike. <SprintTag n={2} short /></p>
            </section>
          </div>
        </div>
      </div>

      {editing && (
        <Modal title="Edit piece" onClose={() => setEditing(null)}>
          <PieceForm value={editing} onChange={setEditing} errors={errors} />
          <div className="row end" style={{ marginTop: 18 }}><button type="button" className="btn line" onClick={() => setEditing(null)}>Cancel</button><button type="button" className="btn" onClick={saveEdit}>Save changes</button></div>
        </Modal>
      )}
      {deleting && (
        <Modal title={`Remove ${pieceName(p).toLowerCase()}?`} sub="Why is it leaving? Closet uses the reason." onClose={() => setDeleting(false)}>
          <div className="reason-cards" role="radiogroup" aria-label="Deletion reason">
            {DELETE_REASONS.map(({ r, icon, effect }) => (
              <button key={r} type="button" role="radio" aria-checked={reason === r} className={`reason-card ${reason === r ? 'on' : ''}`} onClick={() => setReason(r)}>
                <i><Icon name={icon} size={18} /></i><b>{r}</b><span>{effect}</span>
              </button>
            ))}
          </div>
          <p className="tiny muted" style={{ marginTop: 10 }}>US-13 · Sprint 2, built early</p>
          <div className="row end" style={{ marginTop: 18 }}><button type="button" className="btn line" onClick={() => setDeleting(false)}>Keep it</button><button type="button" className="btn danger" disabled={!reason} onClick={remove}>Remove piece</button></div>
        </Modal>
      )}
    </>
  );
}
