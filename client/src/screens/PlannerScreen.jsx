// Planner. Sprint 1: events by hand in a month view (US-46). Version 1.2: the calendar also shows
// wardrobe dates (laundry day, pieces back from the wash, borrowed pieces due, packed pieces) and
// imports .ics calendars. Sprint 3 preview: 3 outfits per event with that day's forecast (US-47)
// and a planned outfit (US-48).
import React, { useMemo, useState } from 'react';
import { api } from '../api.js';
import { Field, Icon, Look, Modal, PageHead, Score, Skeleton, SprintNote, SprintTag, WeatherPill, fmtDate, pieceName, relDay, useApp, useLoad } from '../ui.jsx';
import OutfitCard from './OutfitCard.jsx';

const pad = (n) => String(n).padStart(2, '0');
const ym = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function AddEvent({ date, onClose, onSaved }) {
  const { vocab, toast } = useApp();
  const [e, setE] = useState({ title: '', date, time: '19:00', occasion: 'Dinner' });
  const [err, setErr] = useState(null);
  async function save() {
    try { await api.addEvent(e); toast('Event added'); onSaved(); onClose(); } catch (x) { setErr(x); }
  }
  return (
    <Modal title="New event" onClose={onClose}>
      <Field label="Title" error={err?.field('title')}><input value={e.title} maxLength={80} onChange={(x) => setE({ ...e, title: x.target.value })} placeholder="Dinner with friends" autoFocus /></Field>
      <div className="grid g2" style={{ gap: '0 12px' }}>
        <Field label="Date" error={err?.field('date')}><input type="date" value={e.date} onChange={(x) => setE({ ...e, date: x.target.value })} /></Field>
        <Field label="Time" error={err?.field('time')}><input type="time" value={e.time} onChange={(x) => setE({ ...e, time: x.target.value })} /></Field>
      </div>
      <Field label="Occasion" hint={`Dress code: ${vocab.DRESS_CODES[vocab.OCCASIONS[e.occasion]]}`}>
        <select value={e.occasion} onChange={(x) => setE({ ...e, occasion: x.target.value })}>{Object.keys(vocab.OCCASIONS).map((o) => <option key={o}>{o}</option>)}</select>
      </Field>
      {err && !err.details.length && <div className="form-error">{err.message}</div>}
      <div className="row end"><button type="button" className="btn line" onClick={onClose}>Cancel</button><button type="button" className="btn" onClick={save}>Add event</button></div>
    </Modal>
  );
}

function ConnectCalendar({ onClose, onDone }) {
  const { toast } = useApp();
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);
  async function file(f) { if (f) setText(await f.text()); }
  async function run() {
    try { const r = await api.importIcs(text); setResult(r); onDone(); toast(`${r.imported} event${r.imported === 1 ? '' : 's'} imported`); } catch (e) { toast(e.message, true); }
  }
  return (
    <Modal title="Connect your calendar" sub="Bring your events in, and Closet plans outfits for them. Sprint 2 · built early." onClose={onClose}>
      <div className="stack">
        <div className="notice">
          <Icon name="calendar" size={18} style={{ flex: 'none' }} />
          <div className="grow small"><b>Import a calendar file (.ics)</b> — works with Google Calendar, Outlook and Apple Calendar (Export → .ics). Only the title, date and time are read; the occasion is guessed from the title.</div>
        </div>
        <label className="drop" style={{ aspectRatio: 'auto', padding: 22, cursor: 'pointer' }}>
          <Icon name="upload" size={26} /><b style={{ color: 'var(--ink)' }}>{text ? 'Calendar file ready' : 'Choose a .ics file'}</b>
          <input type="file" accept=".ics,text/calendar" hidden onChange={(e) => file(e.target.files[0])} />
        </label>
        {result && <div className="notice ok small">Imported {result.imported} of {result.found} events{result.skipped ? ` (${result.skipped} past or already added)` : ''}.</div>}
        <div className="row between">
          <button type="button" className="btn line" disabled title="Live sync with Google Calendar comes with the Calendar Service integration (Sprint 3)"><Icon name="link" size={15} />Google Calendar sync <SprintTag n={3} short /></button>
          <button type="button" className="btn" disabled={!text} onClick={run}>Import events</button>
        </div>
      </div>
    </Modal>
  );
}

export default function PlannerScreen({ query }) {
  const { toast, refresh } = useApp();
  const [month, setMonth] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [selected, setSelected] = useState(isoOf(new Date()));
  const [adding, setAdding] = useState(false);
  const [connect, setConnect] = useState(false);
  const [planning, setPlanning] = useState(query.event || null);
  const [options, setOptions] = useState(null);
  const cal = useLoad(() => api.calendar(ym(month)), [ym(month)]);
  const conf = useLoad(() => api.conflicts(), []);
  const conflictOf = (id) => (conf.data?.conflicts || []).find((c) => c.eventId === id);
  async function fix(c) {
    try { const r = await api.fixConflict(c.eventId, c.itemId); toast(`Replaced the ${pieceName(r.replaced).toLowerCase()} with the ${pieceName(r.with).toLowerCase()}`); conf.reload(true); cal.reload(true); refresh(); } catch (x) { toast(x.message, true); }
  }

  const grid = useMemo(() => {
    const first = new Date(month); const lead = (first.getDay() + 6) % 7;
    const start = new Date(first); start.setDate(1 - lead);
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  }, [month]);
  const events = cal.data?.events || [];
  const markers = cal.data?.markers || [];
  const dayEvents = events.filter((e) => e.date === selected);
  const dayMarkers = markers.filter((m) => m.date === selected);
  const today = isoOf(new Date());

  async function openPlan(e) {
    setPlanning(e.id); setOptions(null);
    try { setOptions(await api.eventRecommend(e.id)); } catch (x) { toast(x.message, true); }
  }
  // Deep link from Home: #/planner?event=<id>
  React.useEffect(() => {
    if (query.event && cal.data) { const e = cal.data.events.find((x) => x.id === query.event); if (e) { setSelected(e.date); openPlan(e); } }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cal.data]);
  async function choose(e, o) {
    try { await api.planOutfit(e.id, { itemIds: o.itemIds, ruleScore: o.ruleScore, reasons: o.reasons }); toast(`Outfit planned for ${e.title}`); setPlanning(null); setOptions(null); cal.reload(true); conf.reload(true); } catch (x) { toast(x.message, true); }
  }
  async function unplan(e) { try { await api.unplanOutfit(e.id); cal.reload(true); } catch (x) { toast(x.message, true); } }
  async function remove(e) { try { await api.deleteEvent(e.id); toast('Event deleted'); cal.reload(true); } catch (x) { toast(x.message, true); } }
  const shift = (n) => { const d = new Date(month); d.setMonth(d.getMonth() + n); setMonth(d); };
  const planEvent = events.find((e) => e.id === planning);

  return (
    <>
      <PageHead title="Planner" sprint={1} sub="Your events and your wardrobe on one calendar — with outfits planned for the weather of the day."
        actions={<><button type="button" className="btn line" onClick={() => setConnect(true)}><Icon name="link" size={16} />Connect calendar</button><button type="button" className="btn" onClick={() => setAdding(true)}><Icon name="plus" size={16} />New event</button></>} />
      {(conf.data?.conflicts || []).map((c) => (
        <div key={c.key} className="conflict rise" style={{ marginBottom: 12 }}>
          <span className="ico"><Icon name="alert" size={16} /></span>
          <span className="small grow"><b>{c.event.title} · {relDay(c.event.date)}.</b> {c.message} <SprintTag n={2} short /></span>
          {c.replacement ? <button type="button" className="btn sm" onClick={() => fix(c)}><Icon name="swap" size={14} />Replace with {pieceName(c.replacement.piece).toLowerCase()}</button> : <button type="button" className="btn line sm" onClick={() => { setSelected(c.event.date); }}>Open</button>}
        </div>
      ))}
      <div className="dash">
        <section className="card pad">
          <div className="row between" style={{ marginBottom: 14 }}>
            <h2>{month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</h2>
            <div className="row"><button type="button" className="iconbtn" onClick={() => shift(-1)} aria-label="Previous month"><Icon name="back" /></button><button type="button" className="btn line sm" onClick={() => { const d = new Date(); d.setDate(1); setMonth(d); setSelected(today); }}>Today</button><button type="button" className="iconbtn" onClick={() => shift(1)} aria-label="Next month"><Icon name="next" /></button></div>
          </div>
          {cal.loading ? <Skeleton h={560} /> : (
            <div className="cal">
              {DOW.map((d) => <div key={d} className="dow">{d}</div>)}
              {grid.map((d) => {
                const iso = isoOf(d); const evs = events.filter((e) => e.date === iso); const mks = markers.filter((m) => m.date === iso);
                return (
                  <button type="button" key={iso} className={`day ${d.getMonth() !== month.getMonth() ? 'out' : ''} ${iso === today ? 'today' : ''} ${iso === selected ? 'sel' : ''} ${evs.length ? 'has' : ''}`} onClick={() => setSelected(iso)}>
                    <span className="num">{d.getDate()}</span>
                    {evs.slice(0, 2).map((e) => <span key={e.id} className={`ev ${e.plannedOutfit ? 'planned' : ''}`} style={conflictOf(e.id) ? { background: '#f8dcc2', color: '#8a5a1e' } : null}>{conflictOf(e.id) ? '⚠ ' : e.plannedOutfit ? '✓ ' : ''}{e.title}</span>)}
                    {evs[0]?.plannedOutfit && <span className="thumbs" style={{ display: 'flex', marginTop: 'auto' }}>{evs[0].plannedOutfit.pieces.slice(0, 3).map((p) => <img key={p.id} src={p.photoUrl} alt="" style={{ width: 22, height: 22, borderRadius: 6, objectFit: 'cover', marginRight: 2, border: '1px solid #fff' }} />)}</span>}
                    {mks.slice(0, 2).map((m, k) => <span key={k} className={`mk mk-${m.kind}`}><i />{m.kind === 'laundry-day' ? 'Laundry day' : m.kind === 'laundry-back' ? 'Back from wash' : m.kind === 'borrowed-due' ? 'Due back' : m.kind === 'packed-back' ? 'Unpack' : 'Ready again'}</span>)}
                  </button>
                );
              })}
            </div>
          )}
          <div className="row small muted" style={{ marginTop: 14, gap: 16 }}>
            <span className="row" style={{ gap: 6 }}><span className="tag rose">Event</span></span><span className="row" style={{ gap: 6 }}><span className="tag s1">✓ Outfit planned</span></span>
            <span className="mk mk-laundry-day row" style={{ gap: 6 }}><i style={{ width: 8, height: 8, borderRadius: 9, display: 'inline-block' }} />Laundry</span>
            <span className="mk mk-borrowed-due row" style={{ gap: 6 }}><i style={{ width: 8, height: 8, borderRadius: 9, display: 'inline-block' }} />Borrowed due</span>
            <span className="mk mk-packed-back row" style={{ gap: 6 }}><i style={{ width: 8, height: 8, borderRadius: 9, display: 'inline-block' }} />Packed</span>
          </div>
        </section>

        <div className="stack lg">
          <section className="card pad">
            <div className="eyebrow">{relDay(selected)}</div>
            <h3 style={{ margin: '4px 0 14px' }}>{fmtDate(selected, { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
            {dayMarkers.map((m, k) => <div key={k} className={`mk mk-${m.kind} small row`} style={{ gap: 8, marginBottom: 6 }}><i style={{ width: 8, height: 8, borderRadius: 9, display: 'inline-block' }} />{m.label[0].toUpperCase() + m.label.slice(1)}</div>)}
            {!dayEvents.length && <p className="muted small" style={{ marginTop: 6 }}>No events. <button type="button" className="link" style={{ border: 0, background: 'none', padding: 0 }} onClick={() => setAdding(true)}>Add one</button></p>}
            {dayEvents.map((e) => (
              <div key={e.id} className="card flat pad" style={{ background: 'var(--bg-2)', marginTop: 10 }}>
                <div className="row between">
                  <div><div style={{ fontWeight: 600 }}>{e.title}</div><div className="small muted">{e.time} · {e.occasion}</div></div>
                  {e.weather && <WeatherPill w={e.weather} compact />}
                </div>
                {e.plannedOutfit ? (
                  <div style={{ marginTop: 12 }}>
                    <div className="row between" style={{ marginBottom: 8 }}><span className="tag s1"><Icon name="check" size={11} stroke={3} />Outfit planned</span>{e.plannedOutfit.ruleScore !== null && <Score value={e.plannedOutfit.ruleScore} label="rule score" />}</div>
                    <Look pieces={e.plannedOutfit.pieces} labels animate={false} style={{ maxWidth: 260 }} />
                    {conflictOf(e.id) && (
                      <div className="conflict" style={{ marginTop: 10 }}>
                        <span className="ico"><Icon name="alert" size={16} /></span>
                        <span className="small grow">{conflictOf(e.id).message}</span>
                        {conflictOf(e.id).replacement && <button type="button" className="btn sm" onClick={() => fix(conflictOf(e.id))}>Replace</button>}
                      </div>
                    )}
                    <div className="row" style={{ marginTop: 10 }}><button type="button" className="btn line sm" onClick={() => openPlan(e)}>Change</button><button type="button" className="btn ghost sm" onClick={() => unplan(e)}>Clear</button></div>
                  </div>
                ) : (
                  <div className="row" style={{ marginTop: 12 }}><button type="button" className="btn sm" onClick={() => openPlan(e)}><Icon name="sparkle" size={14} />Plan outfit</button><SprintTag n={3} short /></div>
                )}
                <button type="button" className="btn ghost sm" style={{ marginTop: 6, color: 'var(--bad)' }} onClick={() => remove(e)}><Icon name="trash" size={13} />Delete event</button>
              </div>
            ))}
          </section>
          <section className="card pad">
            <h3 style={{ marginBottom: 10 }}>Upcoming</h3>
            <div className="list">
              {events.filter((e) => e.date >= today).slice(0, 5).map((e) => (
                <button type="button" key={e.id} className="li" style={{ border: 0, background: 'none', textAlign: 'left', borderBottom: '1px solid var(--line-2)' }} onClick={() => setSelected(e.date)}>
                  <div className="datebox"><span>{fmtDate(e.date, { weekday: 'short' })}</span><b>{Number(e.date.slice(8))}</b></div>
                  <div className="grow"><div style={{ fontWeight: 600 }}>{e.title}</div><div className="small muted">{e.occasion}{e.weather ? ` · ${e.weather.tempC}°` : ''}</div></div>
                  {e.plannedOutfit && <Icon name="check" size={16} style={{ color: 'var(--ok)' }} />}
                </button>
              ))}
            </div>
          </section>
          <SprintNote n={1}>Events and the month view are Sprint 1. Calendar import and wardrobe dates on the calendar are Sprint 2 (built early); outfits for an event, with that day’s forecast and laundry back in time, are a Sprint 3 preview.</SprintNote>
        </div>
      </div>

      {planEvent && (
        <Modal wide title={`Outfits for ${planEvent.title}`} sub={`${fmtDate(planEvent.date, { weekday: 'long', day: 'numeric', month: 'long' })} · ${planEvent.occasion}${options ? ` · ${options.levelName} · ${options.weather.tempC}° ${options.weather.source === 'estimate' ? '(estimate)' : ''}` : ''}`} onClose={() => { setPlanning(null); setOptions(null); }}>
          {!options ? <Skeleton h={400} /> : !options.outfits.length ? <p className="muted">{options.note}</p> : (
            <>
              {options.availabilityNote && <div className="notice info small" style={{ marginBottom: 14 }}><Icon name="clock" size={16} />{options.availabilityNote}</div>}
              <div className="grid g3" style={{ alignItems: 'start' }}>
                {options.outfits.map((o, i) => (
                  <OutfitCard key={i} outfit={o} index={i} occasion={planEvent.occasion} compact onReject={false} hideActions
                    extra={<button type="button" className="btn block" onClick={() => choose(planEvent, o)}><Icon name="calendar" size={15} />Plan this outfit</button>} />
                ))}
              </div>
            </>
          )}
        </Modal>
      )}
      {adding && <AddEvent date={selected} onClose={() => setAdding(false)} onSaved={() => cal.reload(true)} />}
      {connect && <ConnectCalendar onClose={() => setConnect(false)} onDone={() => cal.reload(true)} />}
    </>
  );
}
