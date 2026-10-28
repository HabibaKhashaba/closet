// Analytics & insights (Sprint 3 product preview), laid out like an editorial fashion page:
// utilisation (US-69), most / least worn (US-52), forgotten pieces (US-54), Wardrobe Health (US-89),
// "Closet has learned" (US-40) and the outfit history timeline (US-91, Sprint 2 foundation).
import React, { useMemo, useState } from 'react';
import { api } from '../api.js';
import { CATEGORY_LABEL, CountUp, Icon, PageHead, Ring, Skeleton, SprintNote, SprintTag, Stars, Tile, fmtDate, pieceName, useApp, useLoad } from '../ui.jsx';
import { DonateFlow, SeasonalReview, StillLoveIt } from './Proactive.jsx';

const BAR = ['#e8b4c0', '#b9cde4', '#d3c3e3', '#bcd4b8', '#ecd59c'];
const NEUTRAL = ['Black', 'White', 'Grey', 'Beige', 'Navy', 'Brown'];
const since = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

const SRC_ICON = { Rejections: 'x', Favourites: 'heart', 'Wear history': 'history', 'Deleted pieces': 'trash' };

// "Closet has learned" as flip cards: the front only says where the insight comes from;
// tapping it reveals the insight, its evidence and what confirming would change.
export function LearnedCard({ p, onDecide, startFlipped = false }) {
  const [open, setOpen] = useState(startFlipped);
  return (
    <div className={`flip learn-flip ${open ? 'flipped' : ''}`}>
      <div className="flip-inner">
        <button type="button" className="face front learn-front" onClick={() => setOpen(true)} aria-hidden={open} tabIndex={open ? -1 : 0}>
          <span className="learn-orb"><Icon name={SRC_ICON[p.source] || 'brain'} size={22} /></span>
          <span className="eyebrow">Closet has learned</span>
          <b>from your {p.source.toLowerCase()}</b>
          <span className="tiny muted">{p.count} signals · {p.confidence}% confidence</span>
          <span className="tap">Tap to reveal <Icon name="next" size={12} /></span>
        </button>
        <div className="face back learn-back" aria-hidden={!open}>
          <span className="tag plain" style={{ alignSelf: 'flex-start' }}>{p.source}</span>
          <h4>{p.text}</h4>
          <span className="tiny muted">{p.evidence}</span>
          <span className="conf" style={{ '--w': `${p.confidence}%` }}><i />{p.confidence}% confidence</span>
          <span className="small"><b>If you confirm:</b> {p.effect}</span>
          <div className="row" style={{ marginTop: 'auto' }}><button type="button" className="btn sm" onClick={() => onDecide(p.key, 'confirm')}><Icon name="check" size={14} />Confirm</button><button type="button" className="btn line sm" onClick={() => onDecide(p.key, 'dismiss')}>Not accurate</button><button type="button" className="iconbtn" onClick={() => setOpen(false)} aria-label="Flip back"><Icon name="undo" size={14} /></button></div>
        </div>
      </div>
    </div>
  );
}

function Learned({ data, reload }) {
  const { toast, setProfile } = useApp();
  async function decide(key, decision) {
    try { const r = await api.decideLearned(key, decision); if (r.profile) setProfile(r.profile); toast(decision === 'confirm' ? r.effect : 'Marked as not accurate'); reload(); } catch (e) { toast(e.message, true); }
  }
  async function undo(key) { try { const r = await api.undoLearned(key); setProfile(r.profile); toast('Undone — your profile is exactly as before'); reload(); } catch (e) { toast(e.message, true); } }
  return (
    <section className="learn-card" id="learned" style={{ marginBottom: 22 }}>
      <div className="row between" style={{ marginBottom: 14 }}>
        <div className="row"><h2>Closet has learned</h2><SprintTag n={3} short /></div>
        <div className="loop">{data.loop.map((x, i) => <React.Fragment key={x}>{i > 0 && <Icon name="next" size={11} />}<span>{x}</span></React.Fragment>)}</div>
      </div>
      {!data.patterns.length && <p className="small muted">No new patterns yet — wear, rate and react to looks.</p>}
      <div className="learn-grid">
        {data.patterns.map((p) => <LearnedCard key={p.key} p={p} onDecide={decide} />)}
      </div>
      {data.decided.length > 0 && (
        <details style={{ marginTop: 14 }}>
          <summary className="small muted" style={{ cursor: 'pointer' }}>{data.decided.length} decided · nothing changes without you, and Undo restores it exactly</summary>
          {data.decided.map((d) => <div key={d.key} className="row small" style={{ padding: '6px 0' }}><span className={d.state === 'confirmed' ? 'tag s1' : 'tag plain'}>{d.state}</span><span className="grow">{d.text} {d.state === 'confirmed' && <span className="muted">— {d.effect}</span>}</span><button type="button" className="btn ghost sm" onClick={() => undo(d.key)}><Icon name="undo" size={13} />Undo</button></div>)}
        </details>
      )}
    </section>
  );
}

function History() {
  const [range, setRange] = useState(30);
  const [occasion, setOccasion] = useState('');
  const [minRating, setMinRating] = useState(0);
  const h = useLoad(() => api.history({ from: since(range), ...(occasion && { occasion }), ...(minRating && { minRating }) }), [range, occasion, minRating]);
  const all = useLoad(() => api.history({ from: since(365) }), []);
  return (
    <section className="card pad-lg" style={{ marginBottom: 22 }}>
      <div className="row between" style={{ marginBottom: 14 }}>
        <div><div className="row"><h2>Outfit history</h2><SprintTag n={2} short /></div><p className="small muted" style={{ marginTop: 4 }}>Every “Wear this”, with the occasion, the weather and your rating.{h.data ? ` ${h.data.total} outfits${h.data.averageRating ? ` · average ${h.data.averageRating}★` : ''}.` : ''}</p></div>
        <div className="row">
          <select className="input" style={{ width: 'auto', borderRadius: 99 }} value={range} onChange={(e) => setRange(Number(e.target.value))} aria-label="Date range"><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select>
          <select className="input" style={{ width: 'auto', borderRadius: 99 }} value={occasion} onChange={(e) => setOccasion(e.target.value)} aria-label="Occasion"><option value="">All occasions</option>{(all.data?.occasions || []).map((o) => <option key={o}>{o}</option>)}</select>
          <select className="input" style={{ width: 'auto', borderRadius: 99 }} value={minRating} onChange={(e) => setMinRating(Number(e.target.value))} aria-label="Rating"><option value={0}>Any rating</option><option value={4}>4★ and up</option><option value={5}>5★ only</option></select>
        </div>
      </div>
      {h.loading ? <Skeleton h={240} /> : !h.data.wears.length ? <p className="muted small">No outfits match these filters.</p> : (
        <div className="timeline">
          {h.data.wears.slice(0, 8).map((w) => (
            <div key={w.id} className="tl-item">
              <div><b style={{ fontFamily: 'var(--serif)', fontSize: 16 }}>{fmtDate(w.date, { day: 'numeric', month: 'short' })}</b><div className="tiny muted">{w.eventTitle ? <b>{w.eventTitle} · </b> : null}{w.occasion || 'Outfit'}{w.weather ? ` · ${w.weather.tempC}°` : ''}</div></div>
              <div className="tl-pieces">{w.pieces.map((p) => <a key={p.id} href={`#/closet/${p.id}`} title={`${pieceName(p)} · worn ${p.wearCount}×`}><Tile piece={p} status={false} /></a>)}</div>
              <span>{w.rating ? <Stars value={w.rating} onChange={() => {}} /> : <span className="tiny muted">not rated</span>}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// v1.5 Long-unworn pieces: style it, keep it or donate it — plus pieces already marked to leave.
function StillLove() {
  const f = useLoad(() => api.forgotten(), []);
  const [donate, setDonate] = useState(null);
  if (!f.data) return null;
  const { candidates, pending, stats, thresholds } = f.data;
  return (
    <section className="card pad-lg" id="forgotten" style={{ marginBottom: 22 }}>
      <div className="card-head"><div><div className="row"><h2>Still love it?</h2><SprintTag n={3} short /></div><p className="small muted" style={{ marginTop: 4 }}>Pieces that haven’t made it into your rotation recently: everyday pieces after {thresholds.everyday} days, special-occasion pieces after {thresholds.special}. Seasonal pieces are only judged in their season; new, lent, packed or laundry pieces never.</p></div>
        <span className="tiny muted">{stats.passedOn} passed on · {stats.kept} kept</span></div>
      {!candidates.length ? <p className="small muted">Nothing to decide right now.</p> : (
        <div className="still-list">{candidates.slice(0, 3).map((c) => <StillLoveIt key={c.id} candidate={c} compact onChanged={() => f.reload(true)} />)}</div>
      )}
      {pending.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Ready to leave</div>
          <div className="row wrap">{pending.map((p) => <button key={p.id} type="button" className="pending-chip" onClick={() => setDonate(p)}><Tile piece={{ ...p, category: 'Top', status: 'Available' }} status={false} /><span className="small"><b>{p.name}</b><br /><span className="tiny muted">{p.rehome.label} · tap to confirm</span></span></button>)}</div>
        </div>
      )}
      {donate && <DonateFlow piece={donate} onClose={() => { setDonate(null); f.reload(true); }} onChanged={() => f.reload(true)} />}
    </section>
  );
}

function Value() {
  const v = useLoad(() => api.value(), []);
  if (!v.data || !v.data.priced) return null;
  const row = (x, tone) => (
    <a key={x.piece.id} className="bar-row" href={`#/closet/${x.piece.id}`} style={{ gridTemplateColumns: '44px 1fr auto' }}>
      <Tile piece={x.piece} status={false} /><span><b className="small">{x.piece.name}</b><br /><span className="tiny muted">{x.perWear === null ? 'Not worn yet' : `${x.wears} wears`}</span></span>
      <b className={tone}>{x.perWear === null ? `${x.currency} ${x.price.toLocaleString('en-US')}` : `${x.currency} ${x.perWear.toLocaleString('en-US')} / wear`}</b>
    </a>
  );
  return (
    <section className="card pad-lg" style={{ marginBottom: 22 }}>
      <div className="card-head"><div className="row"><h3>Cost per wear</h3><SprintTag n={3} short /></div><span className="tiny muted">{v.data.priced} of {v.data.of} pieces have a price · only outfits you wore count</span></div>
      <div className="grid g2" style={{ gap: 20 }}>
        <div><div className="eyebrow" style={{ marginBottom: 8 }}>Best value</div><div className="bars">{v.data.bestValue.map((x) => row(x, 'pos'))}</div></div>
        <div><div className="eyebrow" style={{ marginBottom: 8 }}>Least used for its price</div><div className="bars">{v.data.underused.map((x) => row(x, ''))}</div></div>
      </div>
      {v.data.note && <p className="tiny muted" style={{ marginTop: 10 }}>{v.data.note}</p>}
    </section>
  );
}

export default function AnalyticsScreen() {
  const ins = useLoad(() => api.insights(), []);
  const closet = useLoad(() => api.items(), []);
  const health = useLoad(() => api.health(), []);
  const learned = useLoad(() => api.learned(), []);
  const month = useLoad(() => api.history({ from: since(30) }), []);
  const rotation = useMemo(() => {
    if (!month.data) return null;
    const n = {};
    for (const w of month.data.wears) for (const p of w.pieces) n[p.id] = (n[p.id] || 0) + 1;
    const neutral = month.data.wears.filter((w) => w.pieces.every((p) => NEUTRAL.includes(p.colour))).length;
    const top = Object.entries(month.data.wears.reduce((t, w) => ({ ...t, [w.occasion || 'Other']: (t[w.occasion || 'Other'] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1])[0];
    return { heavy: Object.values(n).filter((x) => x >= 3).length, neutralShare: month.data.wears.length ? Math.round((neutral / month.data.wears.length) * 100) : 0, topOccasion: top, wears: month.data.wears.length };
  }, [month.data]);
  if (ins.loading || closet.loading) return <><PageHead title="Analytics & insights" sprint={3} /><Skeleton h={600} /></>;
  const i = ins.data;
  const max = Math.max(1, ...i.mostWorn.map((p) => p.wearCount));
  const byCat = Object.entries(closet.data.counts.category).filter(([, n]) => n > 0);
  const catMax = Math.max(1, ...byCat.map(([, n]) => n));
  const loved = i.mostWorn[0];
  const needs = i.forgotten[0];

  return (
    <>
      <PageHead title="Analytics & insights" sprint={3} sub="What you wear, what you forget, what Closet has learned — and what to do about it." />
      <div className="editorial rise">
        <div><div className="big-num"><CountUp value={i.utilization} />%</div><div className="label">Wardrobe utilised · 30 days</div></div>
        <div><div className="big-num"><CountUp value={i.wornLast30} /></div><div className="label">Pieces worn this month</div></div>
        <div><div className="big-num"><CountUp value={i.forgotten.length} /></div><div className="label">Forgotten pieces</div></div>
        <div><div className="big-num"><CountUp value={rotation ? rotation.heavy : 0} /></div><div className="label">In heavy rotation (3+ wears)</div></div>
      </div>
      {rotation && rotation.wears > 0 && (
        <p className="serif" style={{ fontSize: 22, lineHeight: 1.35, maxWidth: 900, margin: '0 0 24px' }}>
          Your current pattern: <b style={{ color: 'var(--rose-ink)', fontWeight: 600 }}>{rotation.neutralShare}%</b> of your outfits this month were all-neutral{rotation.topOccasion ? `, and ${rotation.topOccasion[0].toLowerCase()} was your most dressed-for occasion (${rotation.topOccasion[1]} of ${rotation.wears})` : ''}.
        </p>
      )}

      <div className="feature-pair">
        {loved && (
          <section className="feature tint-sage card">
            <Tile piece={loved} status={false} />
            <div className="stack" style={{ gap: 8 }}><span className="kicker" style={{ color: 'var(--sage-ink)' }}>Most loved</span><h2>{pieceName(loved)}</h2><p className="small muted">Worn {loved.wearCount} times — your most reliable piece.</p><a className="btn line sm" href={`#/outfits?fixed=${loved.id}`} style={{ alignSelf: 'flex-start' }}><Icon name="sparkle" size={14} />New ways to wear it</a></div>
          </section>
        )}
        {needs && (
          <section className="feature tint-butter card">
            <Tile piece={needs} status={false} />
            <div className="stack" style={{ gap: 8 }}><span className="kicker" style={{ color: 'var(--butter-ink)' }}>Needs some love</span><h2>{pieceName(needs)}</h2><p className="small muted">Not worn for {needs.daysSince} days.</p><a className="btn sm" href={`#/outfits?fixed=${needs.id}`} style={{ alignSelf: 'flex-start' }}><Icon name="wand" size={14} />Give it another chance</a></div>
          </section>
        )}
      </div>

      {health.data && !health.data.empty && (
        <section className="card pad-lg" style={{ marginBottom: 22 }}>
          <div className="grid" style={{ gridTemplateColumns: 'auto minmax(0, 1fr) minmax(0, 1fr)', gap: 28, alignItems: 'center' }}>
            <div className="center"><Ring value={health.data.score} size={150} stroke={14} label={<CountUp value={health.data.score} />} /><div className="kicker" style={{ marginTop: 8 }}>Wardrobe health · {health.data.grade}</div></div>
            <div className="health-parts" style={{ marginTop: 0 }}>
              {[...health.data.parts, ...health.data.penalties].map((p) => <div key={p.key}><span>{p.label} <span className="tiny muted">— {p.detail}</span></span><b className={p.points < 0 ? 'neg' : 'pos'}>{p.points > 0 ? '+' : ''}{p.points}{p.max ? <span className="tiny muted"> / {p.max}</span> : ''}</b></div>)}
            </div>
            <div className="stack" style={{ gap: 10 }}>
              {health.data.explain && health.data.explain.lowering.length > 0 && (<><span className="eyebrow">What lowers it</span>{health.data.explain.lowering.map((t) => <div key={t} className="tiny">{t}</div>)}</>)}
              <span className="eyebrow">What would raise it</span>
              {health.data.actions.map((a) => <div key={a} className="notice small"><Icon name="wand" size={16} style={{ flex: 'none' }} />{a}</div>)}
              <p className="tiny muted">Score = utilisation (35) + versatility (20) + balance (20) + readiness (15) + basics (10) − forgotten (≤10) − near-duplicates (≤10). Every part is listed, so the number is never a black box.</p>
            </div>
          </div>
        </section>
      )}

      <StillLove />
      {learned.data && <Learned data={learned.data} reload={() => learned.reload(true)} />}
      <div className="grid g2" style={{ marginBottom: 22, alignItems: 'start' }}><SeasonalReview /><Value /></div>
      <History />

      <div className="grid g2" style={{ marginBottom: 22, alignItems: 'start' }}>
        <section className="card pad-lg">
          <h3 style={{ marginBottom: 16 }}>Most worn</h3>
          <div className="bars">
            {i.mostWorn.map((p, k) => (
              <a className="bar-row" key={p.id} href={`#/closet/${p.id}`}>
                <Tile piece={p} status={false} /><span style={{ fontWeight: 500 }}>{pieceName(p)}</span>
                <span className="track"><i style={{ width: `${(p.wearCount / max) * 100}%`, background: BAR[k % BAR.length] }} /></span><b>{p.wearCount}×</b>
              </a>
            ))}
          </div>
        </section>
        <section className="card pad-lg">
          <h3 style={{ marginBottom: 16 }}>What your closet is made of</h3>
          <div className="bars">
            {byCat.map(([c, n], k) => (
              <div className="bar-row" key={c} style={{ gridTemplateColumns: '110px 1fr 30px' }}>
                <span style={{ fontWeight: 500 }}>{CATEGORY_LABEL[c]}</span>
                <span className="track" style={{ display: 'block' }}><i style={{ width: `${(n / catMax) * 100}%`, background: BAR[k % BAR.length] }} /></span><b>{n}</b>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="card pad-lg" style={{ marginBottom: 20 }}>
        <div className="card-head"><div><h3>Forgotten pieces</h3><p className="small muted">Worn before, but not in the last 40 days.</p></div></div>
        <div className="closet-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
          {i.forgotten.map((p) => (
            <div key={p.id} className="piece-card">
              <Tile piece={p}><span className="corner"><span className="tag dark">{p.daysSince}d</span></span></Tile>
              <div className="name">{pieceName(p)}</div>
              <a className="btn line sm" href={`#/outfits?fixed=${p.id}`}><Icon name="wand" size={14} />Another chance</a>
            </div>
          ))}
        </div>
      </section>
      <SprintNote n={3}>Every number comes from your real wear history (“Wear this”), rejections and favourites. Learned patterns are rules with stated evidence and confidence (evidence ÷ (evidence + 2)), not a trained model. Built ahead of Sprint 3 — not part of Sprint 1 grading.</SprintNote>
    </>
  );
}
