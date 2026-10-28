// Packing Mode (US-68 — stretch goal, shown as a working concept preview). Weather + style profile +
// Available pieces + planner events → one outfit per day, re-using pieces, drawn as an open suitcase.
// "Mark as packed" moves every piece to Packed through Availability, so they leave normal outfits.
import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { Chips, Icon, PageHead, Skeleton, SprintNote, Tile, fmtDate, pieceName, useApp, useLoad } from '../ui.jsx';

const iso = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

export default function PackingScreen() {
  const { vocab, toast, refresh } = useApp();
  const trips = useLoad(() => api.trips(), []);
  const closet = useLoad(() => api.items(), []);
  const [form, setForm] = useState({ destination: 'Paris', startDate: iso(12), endDate: iso(15), tripType: 'Travel', activities: ['Travel', 'Dinner', 'Everyday'] });
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState(null); // a saved trip
  const byId = useMemo(() => new Map((closet.data?.items || []).map((p) => [p.id, p])), [closet.data]);

  useEffect(() => { if (trips.data && !current && !plan && trips.data.trips[0]) setCurrent(trips.data.trips[0]); }, [trips.data, current, plan]);

  async function propose() {
    setBusy(true);
    try { setPlan(await api.packPlan(form)); setCurrent(null); } catch (e) { toast(e.message, true); } finally { setBusy(false); }
  }
  async function save() {
    try { const t = await api.saveTrip(form); toast(`Packing list for ${t.destination} saved`); setPlan(null); setCurrent(t); trips.reload(true); } catch (e) { toast(e.message, true); }
  }
  async function pack() {
    try {
      const r = await api.pack(current.id);
      setCurrent(r.trip); trips.reload(true); closet.reload(true); refresh();
      toast(`${r.packed} pieces marked as Packed${r.skipped.length ? ` · ${r.skipped.length} skipped (not available)` : ''}`);
    } catch (e) { toast(e.message, true); }
  }
  async function unpack() {
    try { const r = await api.unpack(current.id); setCurrent(r.trip); trips.reload(true); closet.reload(true); refresh(); toast(`${r.unpacked} pieces back to Available`); } catch (e) { toast(e.message, true); }
  }

  const view = plan ? { ...plan, days: plan.days, itemIds: plan.itemIds, counts: plan.counts, warnings: plan.warnings, missing: plan.missing }
    : current ? { ...current, ...current.plan, itemIds: current.itemIds } : null;
  const pieces = view ? view.itemIds.map((id) => byId.get(id)).filter(Boolean) : [];
  const temps = view ? view.days.filter((d) => d.weather).map((d) => d.weather.tempC) : [];

  return (
    <>
      <PageHead title="Pack for a trip" sprint={4} sub="Tell Closet where and when. It reads the destination forecast, your style and what is clean, and fills a suitcase with outfits that re-use the same pieces." />
      <div className="pack-room">
        <div className="stack lg">
          {!view || closet.loading ? <Skeleton h={520} /> : (
            <section className={`suitcase ${view.packed ? 'packed' : ''}`}>
              <div className="tagline">
                <div>
                  <span className="kicker" style={{ color: '#e9c9c4' }}>{plan ? 'Proposed packing list' : view.packed ? 'Packed' : 'Saved packing list'}</span>
                  <div><b>{view.destination}</b></div>
                  <span className="small" style={{ color: '#cbbfb8' }}>{fmtDate(view.startDate)} – {fmtDate(view.endDate)}{temps.length ? ` · ${Math.min(...temps)}–${Math.max(...temps)} °C` : ''}{view.days[0]?.weather?.source === 'estimate' ? ' (seasonal estimate)' : view.days[0]?.weather ? ` · ${view.days[0].weather.condition}` : ''}</span>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  {plan && <button type="button" className="btn rose" onClick={save}><Icon name="plus" size={15} />Add to packing list</button>}
                  {!plan && current && !current.packed && <button type="button" className="btn rose" onClick={pack}><Icon name="suitcase" size={15} />Mark as packed</button>}
                  {!plan && current && current.packed && <button type="button" className="btn line" style={{ background: 'transparent', color: '#fff', borderColor: 'rgba(255,255,255,.3)' }} onClick={unpack}>Unpack</button>}
                </div>
              </div>
              <div className="lining">
                {pieces.map((p, i) => <a key={p.id} href={`#/closet/${p.id}`} title={pieceName(p)}><Tile piece={p} status={false} style={{ animationDelay: `${i * 50}ms` }} /></a>)}
              </div>
              <div className="straps" />
              <div className="trip-stats">
                <div><b>{view.counts.pieces}</b><span>pieces</span></div>
                <div><b>{view.counts.outfits}</b><span>outfits</span></div>
                <div><b>{view.counts.days}</b><span>days</span></div>
                <div><b>{view.counts.missing}</b><span>missing</span></div>
              </div>
            </section>
          )}
          {view && (view.warnings.length > 0 || view.missing.length > 0) && (
            <section className="stack" style={{ gap: 8 }}>
              {view.warnings.map((w) => <div key={w} className="conflict"><span className="ico"><Icon name="alert" size={16} /></span><span className="small"><b>Closet warning.</b> {w}</span></div>)}
              {view.missing.map((m) => <div key={m.date} className="notice warn small"><Icon name="tag" size={16} />{m.text}</div>)}
            </section>
          )}
          {view && (
            <section className="card pad">
              <h3 style={{ marginBottom: 12 }}>Day by day</h3>
              <div className="day-strip">
                {view.days.map((d) => (
                  <div key={d.date} className="day-row">
                    <div><b style={{ fontFamily: 'var(--serif)' }}>{fmtDate(d.date, { weekday: 'short', day: 'numeric' })}</b><div className="tiny muted">{d.event || d.occasion}{d.weather ? ` · ${d.weather.tempC}°` : ''}</div></div>
                    {d.outfit ? <div className="mini-tiles">{d.outfit.itemIds.map((id) => byId.get(id)).filter(Boolean).map((p) => <Tile key={p.id} piece={p} status={false} />)}</div> : <span className="small muted">No complete outfit — see the warning above.</span>}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="stack lg">
          <section className="card pad-lg">
            <h3 style={{ marginBottom: 14 }}>Where are you going?</h3>
            <label className="field"><span>Destination</span><input value={form.destination} maxLength={60} onChange={(e) => setForm({ ...form, destination: e.target.value })} /></label>
            <div className="grid g2" style={{ gap: '0 12px' }}>
              <label className="field"><span>First day</span><input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></label>
              <label className="field"><span>Last day</span><input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></label>
            </div>
            <div className="field"><span>Trip type</span><Chips options={['Travel', 'Work', 'Wedding', 'Everyday']} value={form.tripType} multiple={false} onChange={(v) => setForm({ ...form, tripType: v || form.tripType })} /></div>
            <div className="field"><span>Activities (one per day, in turn)</span><Chips options={Object.keys(vocab.OCCASIONS)} value={form.activities} onChange={(v) => setForm({ ...form, activities: v.slice(0, 6) })} /></div>
            <button type="button" className="btn block lg" onClick={propose} disabled={busy || form.destination.trim().length < 2}><Icon name="wand" size={16} />{busy ? 'Packing…' : 'Plan my suitcase'}</button>
          </section>
          {trips.data && trips.data.trips.length > 0 && (
            <section className="card pad">
              <h3 style={{ marginBottom: 10 }}>Packing lists</h3>
              <div className="list">
                {trips.data.trips.map((t) => (
                  <button type="button" key={t.id} className="li" style={{ border: 0, background: 'none', textAlign: 'left', borderBottom: '1px solid var(--line-2)' }} onClick={() => { setPlan(null); setCurrent(t); }}>
                    <span className="avatar"><Icon name="suitcase" size={16} /></span>
                    <span className="grow"><b>{t.destination}</b><br /><span className="small muted">{fmtDate(t.startDate)} – {fmtDate(t.endDate)} · {t.itemIds.length} pieces</span></span>
                    <span className={t.packed ? 'tag s1' : 'tag plain'}>{t.packed ? 'Packed' : 'Not packed'}</span>
                  </button>
                ))}
              </div>
            </section>
          )}
          <SprintNote n={4}>Packing Mode is a stretch goal (US-68). It runs on real data through existing interfaces — Weather, Recommendation Engine, Planner and Availability — to show how the modules work together. Not part of Sprint 1 grading.</SprintNote>
        </div>
      </div>
    </>
  );
}
