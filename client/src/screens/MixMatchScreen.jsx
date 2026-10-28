// Mix & Match (Sprint 2 early start, US-42/43/66): build a look slot by slot and see live how
// well it works — compatibility %, a breakdown (colour, style, formality, weather), the 5-rule
// check and one paragraph of explanation. "Suggest a fix" swaps the weakest piece.
import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { CATEGORY_ONE, Chips, CountUp, Criteria, Icon, Meters, Modal, PageHead, SprintNote, Tile, WeatherPill, matchWord, pieceName, useApp, useLoad } from '../ui.jsx';
import { go } from '../App.jsx';

const SLOTS = [
  ['Top or dress', ['Top', 'Dress']],
  ['Bottom or outerwear', ['Bottom', 'Layer']],
  ['Shoes', ['Shoes']],
  ['Bag or accessory', ['Bag', 'Extra']],
];
const slotOf = (p) => SLOTS.findIndex(([, cats]) => cats.includes(p.category));

export default function MixMatchScreen({ query }) {
  const { vocab, toast, refresh } = useApp();
  const closet = useLoad(() => api.items(), []);
  const [slots, setSlots] = useState([null, null, null, null]);
  const [occasion, setOccasion] = useState(query.occasion || 'Everyday');
  const [picking, setPicking] = useState(null);
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const [result, setResult] = useState(null);
  const [fixing, setFixing] = useState(false);
  const [fixed, setFixed] = useState(null);   // { from, to, changes } — shown after Suggest a fix

  useEffect(() => {
    if (!closet.data || !query.ids) return;
    const next = [null, null, null, null];
    for (const id of query.ids.split(',')) {
      const p = closet.data.items.find((x) => x.id === id);
      if (!p) continue;
      let s = slotOf(p);
      if (p.category === 'Layer' && next[1]) s = 3;
      if (next[s] === null) next[s] = p;
    }
    setSlots(next);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closet.data]);

  const chosen = slots.filter(Boolean);
  const ids = chosen.map((p) => p.id);
  useEffect(() => {
    if (!chosen.length) { setResult(null); return; }
    api.check({ itemIds: ids, occasion }).then(setResult).catch((e) => toast(e.message, true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(), occasion]);

  const options = useMemo(() => {
    if (picking === null || !closet.data) return [];
    return closet.data.items.filter((p) => SLOTS[picking][1].includes(p.category) && (!onlyAvailable || p.status === 'Available'));
  }, [picking, closet.data, onlyAvailable]);

  async function startFromPick() {
    try {
      const r = await api.recommend({ occasion });
      const o = r.outfits[0];
      if (!o) { toast(r.note || 'No suggestion right now'); return; }
      const next = [null, null, null, null];
      for (const p of o.pieces) { let s = slotOf(p); if (p.category === 'Layer' && next[1]) s = 3; if (next[s] === null) next[s] = p; }
      setSlots(next);
    } catch (e) { toast(e.message, true); }
  }
  const put = (p) => { const n = [...slots]; n[picking] = p; setSlots(n); setPicking(null); };
  const clear = (i) => { const n = [...slots]; n[i] = null; setSlots(n); };

  // Swaps the weakest piece, up to three times, until every rule passes (or nothing improves).
  async function suggestFix() {
    setFixing(true);
    try {
      let current = [...slots];
      let score = { ruleScore: result.ruleScore, compatibility: result.compatibility };
      const changes = [];
      const better = (x, y) => x.ruleScore > y.ruleScore || (x.ruleScore === y.ruleScore && x.compatibility > y.compatibility);
      for (let round = 0; round < 3 && score.ruleScore < 100; round += 1) {
        const pieces = current.filter(Boolean);
        let best = null;
        for (let i = 0; i < pieces.length; i += 1) {
          const r = await api.swap({ itemIds: pieces.map((p) => p.id), slot: i, occasion });
          if (r.outfit && (!best || better(r.outfit, best.outfit))) best = { ...r, slot: i };
        }
        if (!best || !better(best.outfit, score)) break;
        const oldP = pieces[best.slot]; const newP = best.outfit.pieces[best.slot];
        current = current.map((p) => (p && p.id === oldP.id ? newP : p));
        changes.push(`${pieceName(oldP).toLowerCase()} → ${pieceName(newP).toLowerCase()}`);
        score = best.outfit;
      }
      if (!changes.length) { toast('This is already the best combination of these pieces'); return; }
      setSlots(current);
      setFixed({ from: result.compatibility, to: score.compatibility, changes });
      setTimeout(() => setFixed(null), 6000);
      toast(`Fixed: ${changes.join(', ')} · ${result.compatibility}% → ${score.compatibility}%`);
    } catch (e) { toast(e.message, true); } finally { setFixing(false); }
  }
  async function save(favorite) {
    try { await api.saveOutfit({ itemIds: ids, occasion, ruleScore: result.ruleScore, reasons: [result.explanation], source: 'built', favorite }); toast(favorite ? 'Saved to favourites' : 'Saved to your looks'); } catch (e) { toast(e.message, true); }
  }
  async function wear() {
    try { await api.wear(ids); toast('Marked as worn today'); refresh(); closet.reload(true); } catch (e) { toast(e.message, true); }
  }

  const c = result?.compatibility ?? 0;
  const TILT = ['-1.5deg', '1.2deg', '1.4deg', '-1deg'];
  return (
    <>
      <PageHead title="Mix & Match" sprint={2} sub="Lay pieces on the styling table. Closet checks the look live and tells you exactly what works and what to change." actions={<WeatherPill w={result?.forecast} />} />
      <div className="studio">
        <section className="table-board">
          <div className="row between" style={{ marginBottom: 18 }}>
            <Chips options={Object.keys(vocab.OCCASIONS)} value={occasion} multiple={false} onChange={(v) => setOccasion(v || occasion)} />
          </div>
          <div className="slots">
            {SLOTS.map(([label], i) => (
              <div key={label} className="stack" style={{ gap: 8 }}>
                <button type="button" className={`slot ${slots[i] ? 'filled' : ''}`} style={{ '--r': TILT[i] }} onClick={() => setPicking(i)} aria-label={`Choose ${label}`}>
                  {slots[i] ? <Tile piece={slots[i]} /> : <span className="stack" style={{ alignItems: 'center', gap: 6 }}><Icon name="plus" size={22} />{label}</span>}
                </button>
                <div className="row between nowrap" style={{ minHeight: 30 }}>
                  <span className="slot-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{slots[i] ? pieceName(slots[i]) : <span className="muted">{label}</span>}</span>
                  {slots[i] && <button type="button" className="btn ghost sm" style={{ padding: '4px 8px' }} onClick={() => clear(i)} aria-label="Remove"><Icon name="x" size={14} /></button>}
                </div>
              </div>
            ))}
          </div>
          <div className="row" style={{ marginTop: 22 }}>
            <button type="button" className="btn" disabled={chosen.length < 2 || (result && result.unavailable.length > 0)} onClick={wear}><Icon name="check" size={15} />Wear this</button>
            <button type="button" className="btn line" disabled={chosen.length < 2} onClick={() => go(`/tryon?ids=${ids.join(',')}`)}><Icon name="mirror" size={15} />Try it on</button>
            <button type="button" className="btn line" disabled={chosen.length < 2 || !result} onClick={() => save(false)}><Icon name="bookmark" size={15} />Save</button>
            <button type="button" className="btn line" disabled={chosen.length < 2 || !result} onClick={() => save(true)}><Icon name="heart" size={15} />Favourite</button>
            <span className="grow" />
            <button type="button" className="btn ghost" onClick={() => setSlots([null, null, null, null])}>Start over</button>
          </div>
        </section>

        <section className="verdict-card">
          {!result ? (
            <div className="center" style={{ padding: '30px 0' }}>
              <div className="big-num">–</div>
              <div className="word" style={{ marginTop: 10 }}>Pick a few pieces</div>
              <p className="small" style={{ marginTop: 10 }}>Start with a top or a dress — the check updates with every piece you lay on the table.</p>
              <button type="button" className="btn rose" style={{ marginTop: 16 }} onClick={startFromPick}><Icon name="sparkle" size={15} />Start from a suggested look</button>
            </div>
          ) : (
            <div className="stack lg">
              <div>
                <div className="muted small">{result.title} · {result.levelName}</div>
                {fixed && <div className="fix-delta"><Icon name="wand" size={14} />{fixed.from}% → {fixed.to}% · {fixed.changes.join(', ')}</div>}
                <div className="big-num" style={{ marginTop: 4 }}><CountUp value={c} from={fixed ? fixed.from : 0} ms={fixed ? 1200 : 650} /><small>%</small></div>
                <div className="word">{result.ruleScore === 100 ? matchWord(c) : result.ruleScore >= 83 ? 'Almost there' : 'Needs a change'}</div>
              </div>
              <Meters o={result} />
              <p style={{ fontSize: 14.5, fontFamily: 'var(--serif)' }}>{result.explanation}</p>
              <details><summary className="small muted" style={{ cursor: 'pointer' }}>Rule check · {result.ruleScore}/100</summary><div style={{ marginTop: 10 }}><Criteria list={result.criteria} compact /></div></details>
              {result.unavailable.length > 0 && <div className="notice warn small" style={{ color: 'var(--ink)' }}>One of these pieces isn’t available right now, so you can save the look but not wear it today.</div>}
              {(result.ruleScore < 100 || c < 90) && chosen.length >= 2 && <button type="button" className="btn rose" onClick={suggestFix} disabled={fixing}><Icon name="wand" size={15} />{fixing ? 'Looking…' : 'Suggest a fix'}</button>}
              <p className="tiny muted">Match % = average of the four part scores. Each part is a fixed rule (e.g. Formality: full credit for the exact dress code, half for one level away) — transparent, not a trained model.</p>
            </div>
          )}
        </section>
      </div>
      <div style={{ marginTop: 20 }}><SprintNote n={2} /></div>

      {picking !== null && (
        <Modal wide title={`Choose ${SLOTS[picking][0].toLowerCase()}`} sub={SLOTS[picking][1].map((x) => CATEGORY_ONE[x]).join(' · ')} onClose={() => setPicking(null)}>
          <label className="row small" style={{ marginBottom: 14, cursor: 'pointer' }}><input type="checkbox" checked={onlyAvailable} onChange={(e) => setOnlyAvailable(e.target.checked)} /> Only pieces that are available now</label>
          <div className="picker">
            {options.map((p) => (
              <button type="button" key={p.id} className={slots[picking]?.id === p.id ? 'on' : ''} onClick={() => put(p)}>
                <Tile piece={p} />
                <div className="tiny" style={{ fontWeight: 600, marginTop: 6, padding: '0 2px' }}>{pieceName(p)}</div>
              </button>
            ))}
          </div>
          {!options.length && <p className="muted">Nothing here yet.</p>}
        </Modal>
      )}
    </>
  );
}
