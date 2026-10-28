// US-15 laundry basket, US-16 "Wash done" (Sprint 1). Version 1.2: laundry basket time — each piece
// shows when it will be back, and comes back on its own if auto-return is on (US-84, Sprint 2 early).
// Version 1.3: the basket is drawn as a real hamper; "Wash done" is a visible moment — the clothes lift
// out of the basket, the counter runs down, and they land back in the closet as Available.
import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Icon, PageHead, Ring, Skeleton, SprintNote, SprintTag, Tile, fmtDate, pieceName, relDay, useApp, useLoad } from '../ui.jsx';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SPOTS = [[8, 46, -14], [96, 18, 6], [178, 40, 15], [52, 78, -5], [138, 88, 9], [214, 92, -10]];

function HamperFront({ count, label }) {
  return (
    <svg className="front" viewBox="0 0 340 220" aria-hidden="true">
      <defs>
        <pattern id="weave" width="22" height="16" patternUnits="userSpaceOnUse">
          <rect width="22" height="16" fill="#cfa577" />
          <rect x="0" y="0" width="11" height="8" rx="3" fill="#dcb88c" />
          <rect x="11" y="8" width="11" height="8" rx="3" fill="#dcb88c" />
          <path d="M0 8h22M11 0v16" stroke="#b88b5b" strokeWidth="1" opacity=".55" />
        </pattern>
        <linearGradient id="shade" x1="0" x2="1"><stop offset="0" stopColor="#000" stopOpacity=".18" /><stop offset=".25" stopColor="#000" stopOpacity="0" /><stop offset=".75" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".2" /></linearGradient>
        <linearGradient id="liner" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f3d9d5" /><stop offset="1" stopColor="#e4bdb7" /></linearGradient>
      </defs>
      <path d="M14 34 Q170 52 326 34 L318 58 Q170 74 22 58 Z" fill="url(#liner)" />
      <path d="M22 50 L318 50 L292 212 Q170 222 48 212 Z" fill="url(#weave)" />
      <path d="M22 50 L318 50 L292 212 Q170 222 48 212 Z" fill="url(#shade)" />
      <rect x="10" y="40" width="320" height="22" rx="11" fill="#b8875a" />
      <rect x="10" y="40" width="320" height="10" rx="5" fill="#d2a272" opacity=".8" />
      <ellipse cx="50" cy="96" rx="16" ry="7" fill="#7c5a3b" opacity=".55" />
      <ellipse cx="290" cy="96" rx="16" ry="7" fill="#7c5a3b" opacity=".55" />
      <g transform="translate(170 150)">
        <rect x="-62" y="-34" width="124" height="62" rx="14" fill="#fffaf6" opacity=".92" />
        <text x="0" y="0" textAnchor="middle" fontFamily="Lora, Georgia, serif" fontSize="34" fill="#2a2626">{count}</text>
        <text x="0" y="18" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="9.5" fontWeight="700" letterSpacing="1.6" fill="#8a807c">{label}</text>
      </g>
    </svg>
  );
}

// The laundry room around the basket: tiled wall, a front-loading washer (its drum turns while
// "Wash done" runs), a shelf with detergent and folded towels, an ironing board with an iron, and a
// rail of clean shirts. Decorative only (aria-hidden).
function LaundryRoom({ washing }) {
  return (
    <svg className="laundry-scene" viewBox="0 0 640 600" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <pattern id="subway" width="40" height="20" patternUnits="userSpaceOnUse"><rect width="40" height="20" fill="#f7fafc" /><path d="M0 19.5H40M20 0V10M0 10H40M0 0V10M40 10V20" stroke="#dbe5ec" strokeWidth="1" /></pattern>
        <pattern id="planks" width="120" height="24" patternUnits="userSpaceOnUse"><rect width="120" height="24" fill="#e8d8c4" /><path d="M0 23.5H120M60 0V24" stroke="#d6c1a8" strokeWidth="1.2" /></pattern>
        <radialGradient id="glass" cx=".4" cy=".35" r=".75"><stop offset="0" stopColor="#e9f4fb" /><stop offset=".6" stopColor="#a9cbe2" /><stop offset="1" stopColor="#6f98b8" /></radialGradient>
        <linearGradient id="window" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fffdf6" /><stop offset="1" stopColor="#e3eef6" /></linearGradient>
      </defs>
      <rect width="640" height="600" fill="#eaf1f6" />
      <rect x="0" y="250" width="640" height="270" fill="url(#subway)" />
      <rect x="420" y="40" width="170" height="150" rx="10" fill="url(#window)" stroke="#d3dde5" strokeWidth="6" />
      <path d="M505 40V190M420 115H590" stroke="#d3dde5" strokeWidth="4" />
      <rect x="0" y="512" width="640" height="88" fill="url(#planks)" />
      {/* shelf with detergent and folded towels */}
      <rect x="12" y="196" width="230" height="10" rx="3" fill="#c9a882" />
      <rect x="26" y="146" width="34" height="50" rx="8" fill="#bcd4b8" /><rect x="34" y="136" width="18" height="14" rx="4" fill="#8fb08a" />
      <rect x="68" y="158" width="30" height="38" rx="7" fill="#d3c3e3" /><rect x="76" y="150" width="14" height="10" rx="3" fill="#ad97c8" />
      <rect x="118" y="178" width="96" height="18" rx="6" fill="#f3d6d2" /><rect x="122" y="162" width="88" height="17" rx="6" fill="#fdf7ef" /><rect x="126" y="147" width="80" height="16" rx="6" fill="#cfe0ee" />
      {/* washing machine */}
      <g transform="translate(14 300)">
        <rect width="164" height="212" rx="14" fill="#fdfdfd" stroke="#d9e2e9" strokeWidth="2" />
        <rect x="0" y="0" width="164" height="38" rx="14" fill="#f1f5f8" />
        <circle cx="26" cy="19" r="7" fill="#dfe7ee" /><circle cx="46" cy="19" r="4" fill="#c48a86" /><rect x="96" y="12" width="52" height="14" rx="4" fill="#2a2626" opacity=".85" /><text x="122" y="23" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="9" fill="#9fe0b8">{washing ? 'WASH' : '00:00'}</text>
        <circle cx="82" cy="122" r="60" fill="#e7edf2" stroke="#cbd6df" strokeWidth="4" />
        <circle cx="82" cy="122" r="47" fill="url(#glass)" />
        <g className={washing ? 'drum spin' : 'drum'} style={{ transformOrigin: '82px 122px' }}>
          <path d="M40 128 Q60 112 82 126 T124 124 L124 160 Q82 176 40 160 Z" fill="#7aa9cc" opacity=".55" />
          <rect x="58" y="128" width="26" height="16" rx="6" fill="#c48a86" opacity=".85" transform="rotate(-18 71 136)" />
          <rect x="84" y="134" width="24" height="14" rx="6" fill="#f6efe9" opacity=".9" transform="rotate(14 96 141)" />
        </g>
        <path d="M50 92 A40 40 0 0 1 96 84" stroke="#fff" strokeWidth="5" fill="none" opacity=".7" strokeLinecap="round" />
      </g>
      {/* rail of clean shirts */}
      <path d="M408 228H616" stroke="#b9a48e" strokeWidth="5" strokeLinecap="round" />
      {[[440, '#f6efe9'], [500, '#cfe0ee'], [560, '#f3d6d2']].map(([x, c]) => (
        <g key={x} transform={`translate(${x} 228)`}>
          <path d="M0 0v8M-18 22l18-12 18 12" stroke="#9c8a78" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M-22 22h44l6 54h-56z" fill={c} stroke="#e1d6cc" strokeWidth="1.5" />
        </g>
      ))}
      {/* ironing board and iron */}
      <g transform="translate(470 392)">
        <path d="M-6 10 L150 0 Q172 2 164 14 L-2 24 Q-14 20 -6 10Z" fill="#c48a86" />
        <path d="M-4 14 L150 5" stroke="#e9c9c4" strokeWidth="3" strokeDasharray="6 6" />
        <path d="M30 20 L110 122M110 20 L30 122" stroke="#9aa6b0" strokeWidth="5" strokeLinecap="round" />
        <path d="M58 -14 h46 q14 0 16 12 h-70 z" fill="#f4f6f8" stroke="#aab4bd" strokeWidth="2" />
        <path d="M66 -14 q6 -16 26 -14" stroke="#7d8a95" strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M80 -32 q-6 -8 0 -16 M92 -30 q-6 -8 0 -16" stroke="#fff" strokeWidth="3" fill="none" opacity=".9" strokeLinecap="round" className="steam" />
      </g>
    </svg>
  );
}

export default function LaundryScreen({ embedded = false }) {
  const { toast, refresh } = useApp();
  const { data, loading, reload } = useLoad(() => api.laundry(), []);
  const closet = useLoad(() => api.items(), []);
  const [phase, setPhase] = useState('idle'); // idle → washing → done
  const [washed, setWashed] = useState([]);
  const [count, setCount] = useState(0);
  const [cleaned, setCleaned] = useState([]);

  useEffect(() => { if (data && phase === 'idle') setCount(data.count); }, [data, phase]);

  async function washDone() {
    const pieces = data.items;
    setPhase('washing');
    try {
      const [r] = await Promise.all([api.washDone(), new Promise((res) => setTimeout(res, 1300))]);
      for (let n = pieces.length; n >= 0; n -= 1) setTimeout(() => setCount(n), (pieces.length - n) * 120);
      setWashed(pieces);
      setPhase('done');
      toast(`All clean — ${r.returned} piece${r.returned === 1 ? ' is' : 's are'} Available again.`);
      refresh(); closet.reload(true);
    } catch (e) { setPhase('idle'); toast(e.message, true); }
  }
  async function back(p) {
    try {
      setCleaned((c) => [...c, p.id]);
      await api.setStatus(p.id, 'Available');
      toast(`${pieceName(p)} is clean and Available`);
      setTimeout(() => { reload(true); setCleaned([]); }, 350);
      refresh(); closet.reload(true);
    } catch (e) { setCleaned((c) => c.filter((x) => x !== p.id)); toast(e.message, true); }
  }
  const total = closet.data?.total || 0;
  const available = closet.data?.counts.status.Available || 0;
  const inBasket = phase === 'done' ? [] : (data?.items || []);

  return (
    <>
      {!embedded && <PageHead title="Laundry room" sprint={1} sub="What’s in the wash — and when it’s back." />}
      <div className="laundry-room">
        <section className="hamper-stage">
          <LaundryRoom washing={phase === 'washing'} />
          <span className="stage-label tag dark"><Icon name="washer" size={13} />{phase === 'washing' ? 'Washing…' : phase === 'done' ? 'Clean' : `${count} waiting for wash`}</span>
          {data && data.count > 0 && phase === 'idle' && (
            <button type="button" className="btn lg wash-btn float" onClick={washDone}><Icon name="check" size={17} />Wash done</button>
          )}
          {phase === 'washing' && <div className="bubbles">{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ left: `${18 + ((i * 37) % 64)}%`, animationDelay: `${(i % 7) * 0.12}s`, width: 10 + (i % 4) * 6, height: 10 + (i % 4) * 6 }} />)}</div>}
          {loading ? <Skeleton h={300} style={{ width: 340 }} /> : (
            <div className="hamper">
              <div className="clothes">
                {(phase === 'idle' ? data.items : washed).slice(0, 6).map((p, i) => (
                  <div key={p.id} className={`g ${phase !== 'idle' ? 'out' : ''}`} style={{ left: SPOTS[i][0], top: SPOTS[i][1], transform: `rotate(${SPOTS[i][2]}deg)`, transitionDelay: `${i * 0.09}s` }}>
                    <img src={p.photoUrl} alt={pieceName(p)} />
                  </div>
                ))}
              </div>
              <HamperFront count={count} label={count === 1 ? 'PIECE WAITING' : count ? 'PIECES WAITING' : 'ALL CLEAN'} />
            </div>
          )}
        </section>

        <div className="stack lg">
          {phase === 'done' ? (
            <section className="all-clean rise">
              <h3><Icon name="check" size={20} />All clean — {washed.length} piece{washed.length === 1 ? ' is' : 's are'} Available again.</h3>
              <p className="small muted" style={{ margin: '6px 0 14px' }}>Outfits can use them again right away.</p>
              <div className="clean-rail">{washed.map((p, i) => <a key={p.id} href={`#/closet/${p.id}`} title={pieceName(p)}><Tile piece={{ ...p, status: 'Available' }} style={{ animationDelay: `${i * 0.12}s` }} /></a>)}</div>
              <div className="row" style={{ marginTop: 16 }}><a className="btn sm" href="#/closet"><Icon name="closet" size={15} />Back in your closet</a><a className="btn line sm" href="#/outfits"><Icon name="sparkle" size={15} />Outfit ideas</a></div>
            </section>
          ) : (
            <section className="card pad">
              <div className="card-head"><h3>In the basket</h3><span className="tag plain">{inBasket.length}</span></div>
              {loading ? <Skeleton h={220} /> : !inBasket.length ? (
                <div className="all-clean"><h3><Icon name="check" size={18} />Everything is clean</h3><p className="small muted" style={{ marginTop: 6 }}>Mark a piece “In laundry” from your closet, or ask Closet: “put my jeans in the laundry”.</p></div>
              ) : (
                <div className="basket-list">
                  {inBasket.map((p) => (
                    <div className={`basket-item ${cleaned.includes(p.id) ? 'clean' : ''}`} key={p.id}>
                      <a href={`#/closet/${p.id}`}><Tile piece={p} status={false} /></a>
                      <div>
                        <div style={{ fontWeight: 600 }}>{pieceName(p)}</div>
                        <div className="small muted">Since {fmtDate(p.statusSince)} · back {p.expectedBack ? relDay(p.expectedBack).toLowerCase() : 'soon'}</div>
                      </div>
                      <button type="button" className="btn line sm" onClick={() => back(p)}>Clean now</button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
          <section className="card pad tint-sky">
            <div className="row nowrap" style={{ gap: 18 }}>
              <Ring value={total ? Math.round((available / total) * 100) : 0} size={96} stroke={10} color="#5f8fbf" />
              <div><span className="eyebrow">Ready to wear</span><h3 style={{ marginTop: 4 }}>{available} of {total} pieces are clean and at home.</h3></div>
            </div>
          </section>
          <section className="card pad">
            <div className="card-head"><h3>Your laundry rules</h3><SprintTag n={2} short /></div>
            <dl className="kv">
              <dt>Basket time</dt><dd>{data ? `${data.laundryDays} day${data.laundryDays === 1 ? '' : 's'}` : '…'}</dd>
              <dt>Auto-return</dt><dd>{data ? (data.autoReturn ? 'On — pieces come back by themselves' : 'Off — press Wash done') : '…'}</dd>
              <dt>Laundry day</dt><dd>{data ? (data.laundryWeekday === null ? 'No fixed day' : DAYS[data.laundryWeekday]) : '…'}</dd>
            </dl>
            <a className="btn line sm" href="#/profile" style={{ marginTop: 14 }}><Icon name="settings" size={15} />Change in settings</a>
          </section>
          <SprintNote n={1}>The basket and “Wash done” are Sprint 1 (US-15, US-16). Basket time, auto-return and laundry day (US-84) were asked for in the Milestone 1 review and are a Sprint 2 early preview.</SprintNote>
        </div>
      </div>
    </>
  );
}
