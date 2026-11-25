// Cher mode — "Spin for me" inside Mix & Match (v3.0), after the rotating computer wardrobe in Clueless.
// Phase 1: three CSS 3D rings (tops · bottoms · shoes). The SERVER picks the look first (weighted random,
// scored by CompatibilityService); the rings only animate to the returned pieces, one after another.
import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { Icon, Toggle, pieceName, useApp } from '../ui.jsx';
import { go } from '../App.jsx';

const RINGS = [['top', 'Tops & dresses'], ['bottom', 'Bottoms'], ['shoes', 'Shoes']];
const CARD = 112;
const TURNS = 3;
const STAGGER = 0.4;
const SPIN_S = 2.4;

const reducedMotion = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
function say(text) { try { const u = new SpeechSynthesisUtterance(text); u.rate = 1.05; window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); } catch { /* no voice: silent */ } }

function Ring({ slot, label, cards, angle, locked, onLock, chosenId, done, delay, spinning, dressNote, reduce }) {
  const n = Math.max(cards.length, 1);
  const step = 360 / n;
  const radius = Math.round((CARD / 2) / Math.tan(Math.PI / Math.max(n, 3)) + 26);
  return (
    <div className={`cher-ring-row ${locked ? 'locked' : ''}`}>
      <div className="cher-ring-label">
        <b>{label}</b>
        <button type="button" className={`btn sm ${locked ? 'rose' : 'line'}`} onClick={onLock} disabled={!chosenId || spinning} aria-pressed={locked} aria-label={`${locked ? 'Unlock' : 'Lock'} ${label.toLowerCase()}`}>
          <Icon name="lock" size={13} />{locked ? 'Locked' : 'Lock'}
        </button>
      </div>
      <div className="cher-stage" style={{ height: CARD * 1.45 }}>
        {dressNote ? <div className="cher-empty small muted">{dressNote}</div> : (
          <div className="cher-ring" style={{ transform: `translateZ(${-radius}px) rotateY(${angle}deg)`, transition: reduce || !spinning ? 'none' : `transform ${SPIN_S}s cubic-bezier(.12,.72,.16,1) ${delay}s` }}>
            {cards.map((c, i) => (
              <div key={c.id} className={`cher-card ${done && c.id === chosenId ? 'chosen' : ''}`}
                style={{ transform: `rotateY(${i * step}deg) translateZ(${radius + (done && c.id === chosenId ? 28 : 0)}px) ${done && c.id === chosenId ? 'scale(1.1)' : ''}`, width: CARD }}>
                <div className="cher-img">{c.photoUrl ? <img src={c.photoUrl} alt="" loading="lazy" /> : null}</div>
                <div className="cher-name">{pieceName(c)}</div>
                {c.isForgotten && <span className="cher-badge">Rediscovered</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CherMode({ occasion, onFineTune }) {
  const { toast } = useApp();
  const [rings, setRings] = useState(null);
  const [angles, setAngles] = useState({ top: 0, bottom: 0, shoes: 0 });
  const [locks, setLocks] = useState({});
  const [rediscovery, setRediscovery] = useState(false);
  const [voice, setVoice] = useState(false);
  const [result, setResult] = useState(null);
  const [phase, setPhase] = useState('idle'); // idle · spinning · done
  const [message, setMessage] = useState(null);
  const logged = useRef(false);
  const reduce = reducedMotion();

  // first view: the user's available pieces on the rings (no spin yet)
  useEffect(() => {
    api.items({ status: 'Available' }).then((r) => {
      const slot = (p) => (['Top', 'Dress'].includes(p.category) ? 'top' : p.category === 'Bottom' ? 'bottom' : p.category === 'Shoes' ? 'shoes' : null);
      const out = { top: [], bottom: [], shoes: [] };
      for (const p of r.items) if (slot(p) && p.status === 'Available' && out[slot(p)].length < 12) out[slot(p)].push(p);
      for (const k of Object.keys(out)) out[k].sort((a, b) => pieceName(a).localeCompare(pieceName(b)));
      setRings((cur) => cur || out);
    }).catch(() => setRings({ top: [], bottom: [], shoes: [] }));
  }, []);

  const feedback = async (action) => {
    if (!result || logged.current) return;
    logged.current = true;
    try { await api.cherFeedback({ garmentIds: result.itemIds, score: result.score, action, occasion }); } catch { /* feedback is best effort */ }
  };

  async function spin() {
    if (phase === 'spinning') return;
    if (result && phase === 'done') await feedback('rejected');
    setMessage(null);
    let r;
    try {
      r = await api.cherSpin({ occasion, rediscovery, lockedGarmentIds: Object.fromEntries(Object.entries(locks).filter(([, v]) => v)) });
    } catch (e) { toast(e.message, true); return; }
    if (!r.outfit) { setMessage(r.message); setResult(null); setPhase('idle'); return; }
    logged.current = false;
    setRings(r.rings);
    setResult(r);
    setPhase('spinning');
    // land each ring exactly on the returned piece: −(i × 360/n) − (turns × 360)
    setAngles((cur) => {
      const next = { ...cur };
      for (const [slot] of RINGS) {
        const list = r.rings[slot]; const chosen = r.outfit[slot];
        if (!chosen || !list.length) continue;
        const i = Math.max(0, list.findIndex((c) => c.id === chosen.id));
        const step = 360 / list.length;
        const whole = Math.ceil(-cur[slot] / 360);
        next[slot] = locks[slot] ? -(i * step) - whole * 360 : -(i * step) - (whole + TURNS) * 360;
      }
      return next;
    });
    const total = reduce ? 0 : (SPIN_S + STAGGER * 2) * 1000;
    setTimeout(() => {
      setPhase('done');
      if (voice) say(r.verdict === 'match' ? `Match. ${r.compatibility} percent.` : 'Mismatch. Spin again.');
    }, total + 60);
  }

  const toggleLock = (slot) => setLocks((l) => ({ ...l, [slot]: l[slot] ? null : result && result.outfit[slot] ? result.outfit[slot].id : null }));
  const done = phase === 'done' && result;
  const pieces = result ? [result.outfit.top, result.outfit.bottom, result.outfit.shoes].filter(Boolean) : [];

  return (
    <div className="cher">
      <div className="cher-controls row">
        <button type="button" className="btn rose" onClick={spin} disabled={phase === 'spinning' || !rings} aria-label="Spin the wardrobe"><Icon name="sparkle" size={15} />{phase === 'spinning' ? 'Spinning…' : result ? 'Spin again' : 'Spin'}</button>
        <div className="cher-toggle"><Toggle label="Rediscovery" sub="Forgotten pieces come up more often" value={rediscovery} onChange={setRediscovery} /></div>
        <div className="cher-toggle"><Toggle label="Voice" sub="Says the verdict out loud" value={voice} onChange={setVoice} /></div>
      </div>
      {message && <div className="notice warn small" style={{ color: 'var(--ink)', marginTop: 12 }}>{message}</div>}
      <div className="cher-rings">
        {RINGS.map(([slot, label], k) => (
          <Ring key={slot} slot={slot} label={label} cards={(rings && rings[slot]) || []} angle={angles[slot]} locked={!!locks[slot]} onLock={() => toggleLock(slot)}
            chosenId={result && result.outfit[slot] && result.outfit[slot].id} done={!!done} delay={locks[slot] ? 0 : k * STAGGER} spinning={phase === 'spinning'} reduce={reduce}
            dressNote={slot === 'bottom' && result && result.outfit.dress && phase !== 'idle' ? 'A dress — no bottom needed.' : null} />
        ))}
      </div>
      <div className="cher-verdict" aria-live="polite">
        {done && (
          <div className={`cher-panel ${result.verdict}`}>
            <div className="row between">
              <div>
                <div className="cher-word">{result.verdict === 'match' ? 'Match' : 'Mismatch'}</div>
                <div className="small muted">{result.levelName} · rule score {result.score}/100 · {result.compatibility}% compatible{result.forgottenCount ? ` · ${result.forgottenCount} rediscovered` : ''}</div>
              </div>
              <div className="cher-score">{result.compatibility}<small>%</small></div>
            </div>
            <ul className="small" style={{ margin: '10px 0 0', paddingLeft: 18 }}>
              {(result.verdict === 'match' ? result.reasons : [...result.problems, ...result.reasons]).slice(0, 4).map((x) => <li key={x}>{x}</li>)}
            </ul>
            <div className="row" style={{ marginTop: 14 }}>
              {result.verdict === 'match' && <button type="button" className="btn" onClick={async () => { await feedback('accepted'); toast('Saved to favourites'); go(`/virtual-try-on?ids=${result.itemIds.join(',')}`); }}><Icon name="mirror" size={15} />Try it on</button>}
              {result.verdict === 'match' && <button type="button" className="btn line" onClick={async () => { await feedback('accepted'); toast('Saved to favourites'); }}><Icon name="heart" size={15} />Keep this look</button>}
              <button type="button" className="btn line" onClick={async () => { await feedback('fine_tuned'); onFineTune(pieces); }}><Icon name="wand" size={15} />Fine-tune</button>
              <button type="button" className="btn ghost" onClick={spin}>Spin again</button>
            </div>
          </div>
        )}
        {!result && !message && phase === 'idle' && <p className="small muted" style={{ marginTop: 12 }}>Press Spin. Closet picks a look from your available pieces first, then the rails turn to it. Lock a rail to keep that piece.</p>}
      </div>
    </div>
  );
}
