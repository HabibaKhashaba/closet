// Home: one look for today (editorial flat lay, explained), Wardrobe Health, the main features as
// doors into the product, a forgotten piece to give another chance, what Closet has learned,
// and what's coming up — with a warning when a planned piece is not available.
import React from 'react';
import { api } from '../api.js';
import { CountUp, Icon, Look, Ring, Skeleton, SprintTag, Tile, matchWord, pieceName, relDay, useApp, useLoad, fmtDate } from '../ui.jsx';
import { go } from '../App.jsx';
import { LearnedCard } from './AnalyticsScreen.jsx';

const hello = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; };

function todaysOccasion(profile, events) {
  const today = new Date().toISOString().slice(0, 10);
  const ev = events.find((e) => e.date === today);
  if (ev) return ev.occasion;
  const weekday = ![5, 6].includes(new Date().getDay()); // Egypt: Friday & Saturday weekend
  if (weekday && profile.occasions.includes('University')) return 'University';
  if (weekday && profile.occasions.includes('Work')) return 'Work';
  return 'Everyday';
}

function Launch({ items }) {
  const pick = (cat, i = 0) => items.filter((p) => p.category === cat)[i];
  const DOORS = [
    ['#/outfits', 'Style me', '3 looks · change · try on', 2, pick('Top', 4) || pick('Top'), 'var(--rose-soft)'],
    ['#/ask', 'Ask Closet', 'Your wardrobe’s brain', 3, null, '#2b2626'],
    ['#/mix', 'Mix & Match', 'A styling table', 2, pick('Shoes', 1) || pick('Shoes'), 'var(--butter)'],
    ['#/tryon', 'Virtual try-on', 'The dressing room', 3, pick('Dress') || pick('Top'), '#f3e1dc'],
    ['#/planner', 'Planner', 'Outfits on your calendar', 1, pick('Layer') || pick('Top'), 'var(--sky)'],
    ['#/analytics', 'Wear analytics', 'What you really wear', 3, pick('Bottom', 2) || pick('Bottom'), 'var(--sage)'],
    ['#/shopping', 'Shopping bag', 'Replacements · gaps · Ask Closet', 3, pick('Bag') || pick('Extra'), 'var(--lilac)'],
    ['#/packing', 'Packing', 'Pack for a trip', 4, pick('Extra', 2) || pick('Shoes'), '#ece6df'],
  ];
  return (
    <div className="launch">
      {DOORS.map(([href, title, sub, s, p, bg], i) => (
        <a key={href} href={href} className={`tilt rise d${i % 4}`}>
          <SprintTag n={s} short />
          <span className="art" style={{ background: bg }}>{p ? <img src={p.photoUrl} alt="" /> : <span className="orb" style={{ width: 54, height: 54, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, #fff, #f1cfc9 30%, #c48a86 65%, #7d4b48)', boxShadow: '0 0 30px rgba(232,180,175,.5)' }} />}</span>
          <b>{title}</b><small>{sub}</small>
        </a>
      ))}
    </div>
  );
}

function Health({ h }) {
  if (!h) return <Skeleton h={330} />;
  const color = h.score >= 80 ? 'var(--ok)' : h.score >= 65 ? '#7f9f6a' : h.score >= 50 ? '#dba65e' : 'var(--bad)';
  return (
    <section className="health rise d1">
      <div className="row between"><span className="kicker">Wardrobe health</span><SprintTag n={3} short /></div>
      <div className="health-top" style={{ marginTop: 10 }}>
        <Ring value={h.score} size={118} stroke={12} color={color} label={<CountUp value={h.score} />} />
        <div>
          <h2 style={{ fontSize: 30 }}>{h.grade}</h2>
          <p className="small muted">{h.empty ? 'Add pieces to get a score.' : `${h.stats.utilisation}% worn this month · ${h.stats.forgotten} forgotten · ${h.stats.duplicates} near-duplicates`}</p>
        </div>
      </div>
      {!h.empty && (
        <div className="health-parts">
          {[...h.parts, ...h.penalties].map((p) => <div key={p.key} title={p.detail}><span>{p.label}</span><b className={p.points < 0 ? 'neg' : 'pos'}>{p.points > 0 ? '+' : ''}{p.points}</b></div>)}
        </div>
      )}
      <div className="notice small" style={{ marginTop: 12, background: 'var(--rose-wash)', borderColor: '#f1dfdb' }}><Icon name="wand" size={16} style={{ flex: 'none' }} />{h.actions[0]}</div>
    </section>
  );
}

export default function HomeScreen() {
  const { profile, user, weather, toast, refresh } = useApp();
  const name = profile.displayName || user.email.split('@')[0];
  const closet = useLoad(() => api.items(), []);
  const insights = useLoad(() => api.insights(), []);
  const events = useLoad(() => api.upcoming(), []);
  const health = useLoad(() => api.health(), []);
  const learned = useLoad(() => api.learned(), []);
  const conflicts = useLoad(() => api.conflicts(), []);
  const occasion = events.data ? todaysOccasion(profile, events.data.events) : null;
  const pick = useLoad(() => (occasion ? api.recommend({ occasion }) : null), [occasion]);

  const counts = closet.data?.counts.status || {};
  const total = closet.data?.total || 0;
  const forgotten = insights.data?.forgotten?.[0];
  const next = events.data?.events?.[0];
  const outfit = pick.data?.outfits?.[0];
  const lesson = learned.data?.patterns?.[0];
  const conflictBy = new Map((conflicts.data?.conflicts || []).filter((c) => c.kind === 'unavailable').map((c) => [c.eventId, c]));

  async function wear() {
    try { await api.wear(outfit.itemIds, null, { occasion, tempC: pick.data.weather.tempC, condition: pick.data.weather.condition }); toast('Marked as worn today — wear counts and history updated'); refresh(); insights.reload(true); health.reload(true); } catch (e) { toast(e.message, true); }
  }
  async function decide(key, decision) {
    try { const r = await api.decideLearned(key, decision); toast(decision === 'confirm' ? r.effect : 'Okay — Closet won’t suggest that again', false, { label: 'Undo', run: () => api.undoLearned(key).then(() => learned.reload(true)) }); learned.reload(true); } catch (e) { toast(e.message, true); }
  }
  async function fix(c) {
    try { const r = await api.fixConflict(c.eventId, c.itemId); toast(`Swapped the ${pieceName(r.replaced).toLowerCase()} for the ${pieceName(r.with).toLowerCase()}`); conflicts.reload(true); events.reload(true); refresh(); } catch (e) { toast(e.message, true); }
  }

  return (
    <>
      <div className="hero">
        <div>
          <span className="eyebrow">{fmtDate(new Date().toISOString(), { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          <h1 style={{ marginTop: 6 }}>{hello()}, {name}</h1>
          <p className="muted" style={{ marginTop: 8, fontSize: 16 }}>
            {weather ? `${weather.tempC}° and ${weather.condition.toLowerCase()} in ${weather.place || profile.city || 'your city'}.` : 'Checking the weather…'}
            {next ? ` Next up: ${next.title}, ${relDay(next.date).toLowerCase()}.` : ''}
          </p>
        </div>
        <div className="row">{profile.styles.slice(0, 3).map((s) => <span key={s} className="chip">{s}</span>)}{profile.colours.slice(0, 2).map((c) => <span key={c} className="chip"><Icon name="heart" size={12} fill="currentColor" />{c}</span>)}</div>
      </div>

      <div className="home-hero">
        <section className="today-card rise">
          <div className="stack" style={{ gap: 12, alignSelf: 'center' }}>
            <div className="row"><span className="kicker">Today’s look</span><SprintTag n={2} short /></div>
            {pick.loading || !occasion ? <Skeleton h={260} /> : !outfit ? <p className="muted">{pick.data?.note || 'Add a few pieces to get outfit ideas.'}</p> : (
              <>
                <h2 style={{ fontSize: 34, lineHeight: 1.05 }}>{outfit.title}</h2>
                <div className="small muted">{occasion} · {pick.data.levelName} · {pick.data.weather.tempC}°{pick.data.weather.source === 'estimate' ? ' (estimate)' : ''}</div>
                <div className="row" style={{ alignItems: 'baseline', gap: 10 }}>
                  <span className="big-num" style={{ fontSize: 58 }}><CountUp value={outfit.compatibility} />%</span>
                  <span className="kicker" style={{ color: 'var(--ok)' }}>{matchWord(outfit.compatibility)}</span>
                </div>
                <p className="serif" style={{ fontSize: 15, lineHeight: 1.5 }}>{outfit.explanation}</p>
                <div className="row">
                  <button type="button" className="btn" onClick={wear}><Icon name="check" size={15} />Wear this</button>
                  <button type="button" className="btn line" onClick={() => go(`/tryon?ids=${outfit.itemIds.join(',')}`)}><Icon name="mirror" size={15} />Try on</button>
                  <a className="btn ghost" href={`#/outfits?occasion=${encodeURIComponent(occasion)}`}>Style me · 3 looks <Icon name="arrow" size={14} /></a>
                </div>
              </>
            )}
          </div>
          {outfit ? <Look pieces={outfit.pieces} labels /> : <Skeleton h={380} />}
        </section>
        <Health h={health.data} />
      </div>

      {closet.data && <Launch items={closet.data.items} />}

      <div className="dash">
        <div className="stack lg">
          {forgotten && (
            <section className="forgot rise">
              <div className="polaroid"><Tile piece={forgotten} status={false} /><span>{forgotten.daysSince} days</span></div>
              <div className="stack" style={{ gap: 8 }}>
                <div className="row"><span className="kicker" style={{ color: 'var(--butter-ink)' }}>Forgotten in your closet</span><SprintTag n={3} short /></div>
                <h2 style={{ fontSize: 26 }}>Your {pieceName(forgotten).toLowerCase()}</h2>
                <p className="small muted">Last worn {forgotten.daysSince} days ago.</p>
                <div className="row"><a className="btn sm" href={`#/outfits?fixed=${forgotten.id}`}><Icon name="wand" size={15} />Give it another chance</a><a className="btn ghost sm" href="#/analytics">All forgotten pieces</a></div>
              </div>
            </section>
          )}
          {lesson && (
            <section className="learn-card rise d1">
              <div className="row between" style={{ marginBottom: 12 }}><span className="kicker" style={{ color: 'var(--lilac-ink)' }}><Icon name="brain" size={13} /> Closet has learned</span><a className="link small" href="#/analytics#learned">{learned.data.patterns.length} insights</a></div>
              <div className="learn-grid two">{learned.data.patterns.slice(0, 2).map((p) => <LearnedCard key={p.key} p={p} onDecide={decide} />)}</div>
            </section>
          )}
        </div>

        <div className="stack lg">
          <section className="card pad">
            <div className="card-head"><div className="row"><h3>Coming up</h3><SprintTag n={1} short /></div><a href="#/planner">Planner</a></div>
            {events.loading ? <Skeleton h={160} /> : !events.data.events.length ? <p className="muted small">No events in the next two weeks. <a className="link" href="#/planner">Add one</a></p> : (
              <div className="list">
                {events.data.events.slice(0, 4).map((e) => {
                  const d = new Date(`${e.date}T12:00:00`);
                  const c = conflictBy.get(e.id);
                  return (
                    <div key={e.id}>
                      <div className="event-mini">
                        <div className="datebox"><span>{d.toLocaleDateString('en-GB', { weekday: 'short' })}</span><b>{d.getDate()}</b></div>
                        <div><div style={{ fontWeight: 600 }}>{e.title}</div><div className="small muted">{relDay(e.date)} · {e.time} · {e.occasion}{e.weather ? ` · ${e.weather.tempC}°` : ''}</div></div>
                        {e.plannedOutfit ? <span className="thumbs">{e.plannedOutfit.pieces.map((p) => <Tile key={p.id} piece={p} status={false} />)}</span> : <a className="btn line sm" href={`#/planner?event=${e.id}`}>Plan outfit</a>}
                      </div>
                      {c && (
                        <div className="conflict" style={{ marginBottom: 8 }}>
                          <span className="ico"><Icon name="alert" size={16} /></span>
                          <span className="small grow">{c.message}</span>
                          {c.replacement && <button type="button" className="btn sm" onClick={() => fix(c)}><Icon name="swap" size={14} />Use {pieceName(c.replacement.piece).toLowerCase()}</button>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="card pad">
            <div className="card-head"><div className="row"><h3>Your closet today</h3><SprintTag n={1} short /></div><a href="#/closet">Open</a></div>
            <div className="stat-row" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
              <div className="stat"><b><CountUp value={total} /></b><span>pieces</span></div>
              <div className="stat"><b style={{ color: 'var(--ok)' }}>{counts.Available ?? '–'}</b><span>ready to wear</span></div>
              <a className="stat" href="#/laundry"><b style={{ color: '#3e6a9a' }}>{counts.Laundry ?? '–'}</b><span>in the laundry</span></a>
              <div className="stat"><b style={{ color: '#9a6326' }}>{(counts.Borrowed || 0) + (counts.Packed || 0) + (counts.Unavailable || 0)}</b><span>borrowed / packed</span></div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
