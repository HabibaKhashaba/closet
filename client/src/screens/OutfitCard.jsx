// One look, as a flip card. Front: the garments (change any piece), match %, and the actions —
// Try on, Wear, Save, Favourite, Not for me (with a reason). Back: why Closet chose it — the factors,
// the four part scores behind the match % and the rule check. Wearing asks for a 1–5 rating.
import React, { useState } from 'react';
import { api } from '../api.js';
import { Board, CountUp, Icon, Look, Modal, Criteria, Score, Stars, Why, matchWord, useApp } from '../ui.jsx';
import { go } from '../App.jsx';

export const REJECT_REASONS = ['Too formal', 'Too casual', 'Don’t like these colours', 'Not comfortable', 'Wore this recently', 'Don’t like one piece', 'Not in the mood today'];

export default function OutfitCard({ outfit, occasion, style, date, index, onSwap, onReject, compact, saved, onChanged, extra, showBreakdown, hideActions, weather, flash }) {
  const { toast, refresh } = useApp();
  const [savedId, setSavedId] = useState(saved ? outfit.id : null);
  const [fav, setFav] = useState(Boolean(outfit.favorite));
  const [worn, setWorn] = useState(null);
  const [rating, setRating] = useState(0);
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const ids = outfit.pieces.map((p) => p.id);
  const wearable = outfit.pieces.every((p) => p.status === 'Available' || p.backBy);

  async function save() {
    if (savedId) return;
    try {
      const s = await api.saveOutfit({ itemIds: ids, occasion, style, ruleScore: outfit.ruleScore, reasons: outfit.reasons || [] });
      setSavedId(s.id); toast('Saved to your lookbook');
    } catch (e) { toast(e.message, true); }
  }
  async function favourite() {
    try {
      let id = savedId;
      if (!id) { const s = await api.saveOutfit({ itemIds: ids, occasion, style, ruleScore: outfit.ruleScore, reasons: outfit.reasons || [], favorite: true }); id = s.id; setSavedId(id); setFav(true); toast('Added to favourites — Closet learns from it'); return; }
      await api.favorite(id, !fav); setFav(!fav); toast(!fav ? 'Added to favourites — Closet learns from it' : 'Removed from favourites');
      onChanged && onChanged();
    } catch (e) { toast(e.message, true); }
  }
  async function wear() {
    setBusy(true);
    try { const w = await api.wear(ids, null, { ...(occasion && { occasion }), ...(weather && { tempC: weather.tempC, condition: weather.condition }) }); setWorn(w.wearId); toast('Worn today — wear counts updated'); refresh(); onChanged && onChanged(); } catch (e) { toast(e.message, true); } finally { setBusy(false); }
  }
  async function rate(n) {
    setRating(n);
    try { await api.rate(worn, n); toast('Thanks — rating saved'); } catch (e) { toast(e.message, true); }
  }
  async function reject(reason) {
    try {
      const r = await api.reject(ids, reason);
      setRejecting(false);
      toast(r.hiddenForAWeek ? 'Got it — this look won’t come back this week' : `Noted: “${reason}”. Closet learns from this.`);
      onReject && onReject(reason);
    } catch (e) { toast(e.message, true); }
  }
  const tryOn = () => go(`/tryon?ids=${ids.join(',')}${index !== undefined ? `&look=${index}` : ''}`);
  const hasMatch = outfit.compatibility !== undefined;

  if (compact) {
    return (
      <article className="edit-card outfit">
        <div className="outfit-head">
          <div><h3 style={{ fontSize: 18 }}>{outfit.title || 'Your look'}</h3>{occasion && <div className="ctx"><span>{occasion}</span></div>}</div>
          {hasMatch ? <Score value={outfit.compatibility} /> : outfit.ruleScore !== undefined && outfit.ruleScore !== null && <Score value={outfit.ruleScore} label="rule score" />}
        </div>
        <Board pieces={outfit.pieces} small />
        {extra}
        {!hideActions && <div className="row nowrap"><button type="button" className="btn sm grow" onClick={tryOn}><Icon name="mirror" size={15} />Try on</button><button type="button" className="btn line sm grow" onClick={wear} disabled={busy || !wearable}><Icon name="check" size={15} />Wear</button></div>}
      </article>
    );
  }

  return (
    <article className={`flip ${flipped ? 'flipped' : ''}`}>
      <div className="flip-inner">
        {/* ---------- front: the look ---------- */}
        <div className="face front edit-card outfit" aria-hidden={flipped}>
          <div className="outfit-head" style={{ paddingRight: hasMatch ? 96 : 0 }}>
            <div>
              {index !== undefined && <div className="look-no">LOOK 0{index + 1}</div>}
              <h3 style={{ marginTop: 2, fontSize: 23 }}>{outfit.title || 'Your look'}</h3>
              {(occasion || date) && <div className="ctx">{[occasion, date].filter(Boolean).map((x) => <span key={x}>{x}</span>)}</div>}
            </div>
          </div>
          {hasMatch ? <div className={`match-pill ${flash ? 'moved' : ''}`}><b><CountUp value={outfit.compatibility} from={flash?.from} ms={flash ? 1100 : 650} />%</b><span>{flash ? `was ${flash.from}%` : matchWord(outfit.compatibility)}</span></div>
            : outfit.ruleScore !== undefined && outfit.ruleScore !== null && <div className="match-pill"><b>{outfit.ruleScore}</b><span>rule score</span></div>}
          <Look pieces={outfit.pieces} onSwap={onSwap} labels highlight={flash?.id} />
          {outfit.explanation && <p className="why-line">{outfit.explanation}</p>}
          {extra}
          {hideActions ? null : worn ? (
            <div className="notice ok row between"><span className="small"><b>Worn today.</b> How did it feel?</span><Stars value={rating} onChange={rate} /></div>
          ) : (
            <>
              <div className="row nowrap">
                <button type="button" className="btn sm grow" onClick={tryOn}><Icon name="mirror" size={15} />Try on</button>
                <button type="button" className="btn line sm grow" onClick={wear} disabled={busy || !wearable} title={wearable ? '' : 'A piece is not available'}><Icon name="check" size={15} />Wear this</button>
              </div>
              <div className="toolbar">
                <button type="button" className={savedId ? 'on' : ''} onClick={save} aria-label="Save"><Icon name="bookmark" size={15} fill={savedId ? 'currentColor' : 'none'} />{savedId ? 'Saved' : 'Save'}</button>
                <button type="button" className={fav ? 'on' : ''} onClick={favourite} aria-label="Favourite"><Icon name="heart" size={15} fill={fav ? 'currentColor' : 'none'} /></button>
                <button type="button" onClick={() => setFlipped(true)} className="why-btn"><Icon name="sparkle" size={15} />Why?</button>
                {onReject !== false && <button type="button" onClick={() => setRejecting(true)} style={{ marginLeft: 'auto' }}><Icon name="x" size={14} />Not for me</button>}
              </div>
            </>
          )}
        </div>
        {/* ---------- back: why it works ---------- */}
        <div className="face back edit-card outfit" aria-hidden={!flipped}>
          <div className="row between"><div className="look-no">WHY LOOK 0{(index ?? 0) + 1}</div><button type="button" className="iconbtn" onClick={() => setFlipped(false)} aria-label="Back to the look"><Icon name="undo" size={16} /></button></div>
          <h3 style={{ fontSize: 21 }}>{outfit.title || 'Your look'}</h3>
          <Why outfit={outfit} max={5} />
          {showBreakdown && outfit.colour !== undefined && (
            <div className="parts">{[['Colour', outfit.colour], ['Style', outfit.style], ['Formality', outfit.formality], ['Weather', outfit.weather]].map(([k, v]) => <div key={k}><b>{v}</b><span>{k}</span></div>)}</div>
          )}
          {showBreakdown && outfit.criteria && <details><summary className="small muted" style={{ cursor: 'pointer' }}>Rule check · {outfit.ruleScore}/100</summary><div style={{ marginTop: 10 }}><Criteria list={outfit.criteria} compact /></div></details>}
          <p className="tiny muted">Match % = the average of the four part scores above. Rule score = 100 − 17 per failed rule.</p>
          <button type="button" className="btn line sm" onClick={() => setFlipped(false)} style={{ marginTop: 'auto' }}><Icon name="back" size={14} />Back to the look</button>
        </div>
      </div>
      {rejecting && (
        <Modal title="Not for you?" sub="Pick a reason — the next looks will fit better." onClose={() => setRejecting(false)}>
          <div className="reason-grid">
            {REJECT_REASONS.map((r) => <button key={r} type="button" className="chip lg" onClick={() => reject(r)}>{r}</button>)}
          </div>
          <p className="tiny muted" style={{ marginTop: 12 }}>“Not in the mood today” hides this look for a week without counting as a dislike.</p>
        </Modal>
      )}
    </article>
  );
}
