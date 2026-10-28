// Style me — the heart of Closet (Sprint 2 core, built early): choose the occasion → Closet generates
// THREE complete looks from Available pieces and the forecast → change any piece → try it on in the
// dressing room → wear, save, favourite, rate or reject with a reason. Every action is feedback.
// Also "Style this piece" (?fixed=<id>) — every look is built around one piece.
import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { CATEGORY_ONE, Chips, Icon, Modal, PageHead, Skeleton, SprintTag, Tile, WeatherPill, fmtDate, pieceName, useApp } from '../ui.jsx';
import OutfitCard from './OutfitCard.jsx';

const iso = (d) => d.toISOString().slice(0, 10);
const nextDays = () => Array.from({ length: 7 }, (_, i) => iso(new Date(Date.now() + i * 86400000)));
const STEPS = ['Occasion', 'Three looks', 'Change a piece', 'Try it on', 'Wear · save · rate'];

export function FlowRail({ at }) {
  return (
    <ol className="flow-rail" aria-label="How Style me works">
      {STEPS.map((s, i) => <li key={s} className={i < at ? 'done' : i === at ? 'on' : ''}><b>{i + 1}</b><span>{s}</span></li>)}
    </ol>
  );
}

export function storedLooks() {
  try { return JSON.parse(sessionStorage.getItem('closet.looks') || 'null'); } catch { return null; }
}

// v1.6 Event rescue — "I have nothing to wear": the wardrobe first (Available pieces, weather, dress code),
// a genuine gap only when the closet cannot do it. Same service as Ask Closet (POST /intelligence/rescue).
function Rescue({ occasion, date }) {
  const { toast } = useApp();
  const [r, setR] = useState(null);
  const [busy, setBusy] = useState(false);
  async function run() { setBusy(true); try { setR(await api.rescue({ occasion, ...(date && { date }) })); } catch (e) { toast(e.message, true); } finally { setBusy(false); } }
  return (
    <section className="card pad rescue" aria-label="Nothing to wear" style={{ marginTop: 18 }}>
      <div className="row between wrap">
        <div><div className="eyebrow">Nothing to wear?</div><p className="small muted" style={{ marginTop: 4 }}>For {occasion.toLowerCase()}{date ? ` on ${fmtDate(date)}` : ''}: Closet checks what’s Available, the forecast and the dress code before it ever suggests buying.</p></div>
        <button type="button" className="btn line" disabled={busy} onClick={run}><Icon name="wand" size={16} />{busy ? 'Checking…' : 'Rescue me'}</button>
      </div>
      {r && (
        <div style={{ marginTop: 14 }}>
          <p className="small"><b>{r.solved ? 'Your closet can do this.' : 'A real gap.'}</b> {r.message}</p>
          {r.solved && <div className="grid g3 looks" style={{ marginTop: 12, alignItems: 'stretch' }}>{r.outfits.map((o, i) => <OutfitCard key={o.itemIds.join()} outfit={o} index={i} occasion={occasion} date={`${r.levelName} · ${r.weather.tempC}°`} weather={r.weather} />)}</div>}
          {!r.solved && r.shopping && <a className="btn sm" href="#/shopping" style={{ marginTop: 10 }}><Icon name="bag" size={14} />See what would fill it</a>}
        </div>
      )}
    </section>
  );
}

export default function OutfitsScreen({ query }) {
  const { vocab, profile, toast, weather } = useApp();
  // Coming back from the dressing room: show the same three looks (including any changed piece).
  const back = useRef(query.back === '1' ? storedLooks() : null);
  const [occasion, setOccasion] = useState(back.current?.occasion || query.occasion || (profile.occasions[0] || 'Everyday'));
  const [template, setTemplate] = useState(null);
  const [level, setLevel] = useState(null);
  const [style, setStyle] = useState(query.style || '');
  const [date, setDate] = useState(query.date || iso(new Date()));
  const [fixed, setFixed] = useState(query.fixed || query.piece || null);
  const [fixedPiece, setFixedPiece] = useState(null);
  const [requested, setRequested] = useState(Boolean(back.current || query.occasion || query.fixed || query.piece || query.style));
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [changed, setChanged] = useState(false);
  const [phase, setPhase] = useState('');
  const [tray, setTray] = useState(null);     // replace one piece: { i, slot, from, options }
  const [flash, setFlash] = useState(null);   // { i, id, from } — the piece that just came in, and the old match %

  async function load() {
    setLoading(true); setFlash(null);
    // A short, honest "generating" moment: what Closet is actually reading, then the three looks.
    let avail = null;
    try { avail = (await api.items()).items.filter((p) => p.status === 'Available').length; } catch { /* the count is only for the message */ }
    const steps = ['Reading your closet…', `Checking the weather in ${profile.city || 'your city'}…`, avail ? `Building from ${avail} available pieces…` : 'Building your looks…'];
    let k = 0; setPhase(steps[0]);
    const timer = setInterval(() => { k = Math.min(steps.length - 1, k + 1); setPhase(steps[k]); }, 520);
    try {
      const [r] = await Promise.all([api.recommend({ occasion, ...(style && { style }), ...(level && { level }), date, ...(fixed && { fixedId: fixed }) }), new Promise((ok) => setTimeout(ok, 1600))]);
      setResult(r); setChanged(false);
    } catch (e) { toast(e.message, true); } finally { clearInterval(timer); setLoading(false); }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!requested) return;
    if (back.current) { setResult(back.current.result); setChanged(Boolean(back.current.changed)); back.current = null; return; }
    load();
  }, [requested, occasion, style, date, fixed, level]);
  useEffect(() => { if (fixed) api.item(fixed).then(setFixedPiece).catch(() => setFixed(null)); else setFixedPiece(null); }, [fixed]);
  // The dressing room can flip between the same three looks.
  useEffect(() => {
    if (!result) return;
    try { sessionStorage.setItem('closet.looks', JSON.stringify({ occasion, changed, levelName: result.levelName, tempC: result.weather?.tempC, result })); } catch { /* storage is optional */ }
  }, [result, occasion, changed]);
  function applyTemplate(t) { setTemplate(t.key); setOccasion(t.occasion); setStyle(t.style); setLevel(t.level); }

  // Change one piece: open a small tray with the best Available alternatives and their real new match %.
  async function swap(i, slot) {
    const o = result.outfits[i];
    setTray({ i, slot, from: o.pieces[slot], options: null });
    try {
      const r = await api.swap({ itemIds: o.itemIds, slot, occasion, ...(style && { style }), ...(level && { level }), date });
      if (!r.options || !r.options.length) { setTray(null); return toast(r.note || 'No other Available piece fits here.'); }
      setTray({ i, slot, from: o.pieces[slot], options: r.options });
    } catch (e) { setTray(null); toast(e.message, true); }
    return null;
  }
  function choose(opt) {
    const { i, from } = tray; const o = result.outfits[i];
    setResult({ ...result, outfits: result.outfits.map((x, j) => (j === i ? { ...opt.outfit, title: x.title } : x)) });
    setChanged(true); setTray(null);
    setFlash({ i, id: opt.piece.id, from: o.compatibility });
    setTimeout(() => setFlash(null), 4200);
    toast(`${pieceName(from)} → ${pieceName(opt.piece)} · ${o.compatibility}% → ${opt.outfit.compatibility}%. The rest of the look stays.`);
  }
  const drop = (i) => setResult({ ...result, outfits: result.outfits.filter((_, j) => j !== i) });
  const today = iso(new Date());
  const dayLabel = date === today ? 'Today' : date === nextDays()[1] ? 'Tomorrow' : fmtDate(date);

  // ---------- before generating: the styling studio ----------
  if (!requested) {
    return (
      <>
        <PageHead title="Style me" sprint={2} sub="Three looks for your day — then change, try on and wear." />
        <FlowRail at={0} />
        <section className="style-studio rise">
          <div className="style-studio-head">
            <div><div className="eyebrow">Step 1</div><h2>What’s the occasion?</h2></div>
            <WeatherPill w={weather} />
          </div>
          <div className="occasion-grid">
            {vocab.OCCASION_TEMPLATES.map((t) => (
              <button type="button" key={t.key} className={`occ ${template === t.key ? 'on' : ''}`} onClick={() => applyTemplate(t)} aria-pressed={template === t.key}>
                <i><Icon name={t.icon} size={20} /></i><b>{t.label}</b><small>{vocab.DRESS_CODES[t.level]}</small>
              </button>
            ))}
          </div>
          <div className="row between style-studio-foot">
            <div className="chips">{nextDays().slice(0, 4).map((d, i) => <button type="button" key={d} className={`chip ${date === d ? 'on' : ''}`} onClick={() => setDate(d)}>{i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : fmtDate(d, { weekday: 'short', day: 'numeric' })}</button>)}</div>
            <button type="button" className="btn lg generate" onClick={() => setRequested(true)}><Icon name="sparkle" size={18} />Generate 3 looks</button>
          </div>
        </section>
        <Rescue occasion={occasion} date={date} />
      </>
    );
  }

  return (
    <>
      <PageHead title={fixedPiece ? `Style your ${pieceName(fixedPiece).toLowerCase()}` : 'Style me'} sprint={fixed ? 3 : 2}
        sub={fixedPiece ? 'Three looks built around one piece you own.' : 'Three looks from clean pieces, right for the weather.'}
        actions={<button type="button" className="btn line" onClick={load}><Icon name="refresh" size={16} />New ideas</button>} />
      <FlowRail at={changed ? 3 : 2} />

      <div className="style-bar">
        <div className="templates slim">
          {vocab.OCCASION_TEMPLATES.map((t) => (
            <button type="button" key={t.key} className={`template ${template === t.key || (!template && t.occasion === occasion && t.key !== 'gym' && t.key !== 'casual-outing' && t.key !== 'formal-event') ? 'on' : ''}`} onClick={() => applyTemplate(t)} aria-pressed={template === t.key}>
              <i><Icon name={t.icon} size={15} /></i><b>{t.label}</b>
            </button>
          ))}
        </div>
        <details className="tune">
          <summary><Icon name="filter" size={15} />{dayLabel} · {result?.levelName || '…'}{style ? ` · ${style}` : ''}</summary>
          <div className="tune-body card pad">
            <div className="eyebrow" style={{ marginBottom: 8 }}>Occasion</div>
            <Chips options={Object.keys(vocab.OCCASIONS)} value={occasion} multiple={false} onChange={(v) => { setOccasion(v || occasion); setTemplate(null); setLevel(null); }} />
            <div className="eyebrow" style={{ margin: '14px 0 8px' }}>Style</div>
            <Chips options={vocab.STYLES} value={style} multiple={false} onChange={(v) => { setStyle(v); setTemplate(null); }} />
            <div className="eyebrow" style={{ margin: '14px 0 8px' }}>Day</div>
            <div className="chips">{nextDays().map((d, i) => <button type="button" key={d} className={`chip ${date === d ? 'on' : ''}`} onClick={() => setDate(d)}>{i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : fmtDate(d, { weekday: 'short', day: 'numeric' })}</button>)}</div>
          </div>
        </details>
        <WeatherPill w={result?.weather} />
      </div>
      {fixedPiece && (
        <div className="row nowrap notice" style={{ padding: 8, marginBottom: 14, alignSelf: 'flex-start' }}>
          <Tile piece={fixedPiece} status={false} style={{ width: 46, height: 46, aspectRatio: 'auto', borderRadius: 12 }} />
          <span className="small">Built around <b>{pieceName(fixedPiece)}</b> · <button type="button" className="link" style={{ border: 0, background: 'none', padding: 0 }} onClick={() => setFixed(null)}>clear</button></span>
        </div>
      )}
      {result?.availabilityNote && <div className="notice info small" style={{ marginBottom: 14 }}><Icon name="clock" size={16} />{result.availabilityNote}</div>}

      {loading || !result ? (
        <div className="generating">
          <div className="gen-orb"><i /><i /><i /></div>
          <b>{phase || 'Building your looks…'}</b>
          <span className="small muted">Only clean, Available pieces · {occasion} · {dayLabel}</span>
        </div>
      )
        : !result.outfits.length ? <div className="card pad-lg center"><h3>No outfit fits right now</h3><p className="muted" style={{ marginTop: 8 }}>{result.note}</p><div className="row" style={{ justifyContent: 'center', marginTop: 16 }}><a className="btn line" href="#/laundry">Check the laundry</a><a className="btn" href="#/closet/new">Add a piece</a></div></div>
          : (
            <div className="grid g3 looks" style={{ alignItems: 'stretch' }}>
              {result.outfits.map((o, i) => (
                <div key={o.title} className="look-in" style={{ animationDelay: `${i * 260}ms` }}>
                  <OutfitCard key={o.itemIds.join()} outfit={o} index={i} occasion={occasion} style={style || undefined} date={`${result.levelName} · ${result.weather.tempC}°`} weather={result.weather} showBreakdown
                    onSwap={(slot) => swap(i, slot)} onReject={() => drop(i)} flash={flash && flash.i === i ? flash : null} />
                </div>
              ))}
            </div>
          )}
      {tray && (
        <Modal title={`Replace ${CATEGORY_ONE[tray.from.category].toLowerCase()}`} sub={`Instead of ${pieceName(tray.from).toLowerCase()} — the rest of LOOK 0${tray.i + 1} stays.`} onClose={() => setTray(null)}>
          {!tray.options ? <Skeleton h={180} /> : (
            <div className="tray">
              {tray.options.map((opt) => (
                <button type="button" key={opt.piece.id} className="tray-opt" onClick={() => choose(opt)}>
                  <Tile piece={opt.piece} status={false} />
                  <b>{pieceName(opt.piece)}</b>
                  <span className={opt.outfit.compatibility >= result.outfits[tray.i].compatibility ? 'up' : 'down'}>{result.outfits[tray.i].compatibility}% → {opt.outfit.compatibility}%</span>
                </button>
              ))}
            </div>
          )}
        </Modal>
      )}
      <p className="tiny muted" style={{ marginTop: 18, display: 'flex', gap: 8, alignItems: 'center' }}><SprintTag n={2} short />Match % = average of four defined part scores (colour, style, formality, weather) — flip a card to see them. Built ahead of Sprint 2; not part of Sprint 1 grading.</p>
    </>
  );
}
