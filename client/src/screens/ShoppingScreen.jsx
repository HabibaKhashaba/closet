// Shopping bag (Sprint 3 product preview, built early).
//   The bag = the shopping list (US-36). Items come from Ask Closet ("put beige trousers on my
//   shopping list"), from deleted pieces (Torn / damaged, Became too small → replacement, US-33),
//   from wardrobe gaps and from smart suggestions. A piece deleted as "No longer my style" is never
//   suggested again (US-34). Every item warns when you already own something similar (US-65).
import React, { useState } from 'react';
import { api } from '../api.js';
import { CATEGORY_ONE, COLOUR_SWATCH, Chips, Icon, PageHead, Skeleton, Tile, pieceName, useApp, useLoad } from '../ui.jsx';

const TAG = { 'Added by Ask Closet': 'tag lilac', Replacement: 'tag rose', 'Wardrobe gap': 'tag s2', 'Smart suggestion': 'tag plain', 'Added by you': 'tag plain' };
const TINT = { Top: '#efe7f1', Bottom: '#f5eddc', Dress: '#f6e3e2', Layer: '#e4ebf3', Shoes: '#e4ece2', Bag: '#f1e6da', Extra: '#ece8ef' };

function BagItem({ item, onBought, onRemove }) {
  const [open, setOpen] = useState(false);
  return (
    <article className={`bag-item ${item.status === 'bought' ? 'bought' : ''}`}>
      <div className="bag-swatch" style={{ background: TINT[item.category] }}><i style={{ background: COLOUR_SWATCH[item.colour] || '#ddd' }} /></div>
      <div className="bag-body">
        <div className="row" style={{ gap: 6 }}>{item.tags.map((t) => <span key={t} className={TAG[t] || 'tag plain'}>{t}</span>)}</div>
        <b className="bag-title">{item.title}</b>
        {item.reason && <span className="tiny muted">{item.reason}</span>}
        {item.warning && (
          <button type="button" className="dup-chip" onClick={() => setOpen(!open)} aria-expanded={open}><Icon name="alert" size={13} />{item.warning}</button>
        )}
        {open && <div className="mini-tiles" style={{ marginTop: 6 }}>{item.similarOwned.map((p) => <a key={p.id} href={`#/closet/${p.id}`} title={`${pieceName(p)} · ${p.similarity}% similar`}><Tile piece={p} status={false} /></a>)}</div>}
      </div>
      <div className="bag-actions">
        <button type="button" className={`iconbtn ${item.status === 'bought' ? 'on' : ''}`} onClick={() => onBought(item)} aria-label={item.status === 'bought' ? 'Back to buy' : 'Bought it'} title={item.status === 'bought' ? 'Back to buy' : 'Bought it'}><Icon name="check" size={16} /></button>
        <button type="button" className="iconbtn" onClick={() => onRemove(item)} aria-label="Remove from bag" title="Remove"><Icon name="x" size={16} /></button>
      </div>
    </article>
  );
}

function Suggestion({ s, onAdd }) {
  return (
    <article className="sugg">
      <div className="bag-swatch sm" style={{ background: TINT[s.category] }}><i style={{ background: COLOUR_SWATCH[s.colour] }} /></div>
      <div className="grow">
        <span className={s.source === 'Gap' ? 'tag s2' : 'tag plain'}>{s.source === 'Gap' ? 'Wardrobe gap' : 'Smart suggestion'}</span>
        <b style={{ display: 'block', marginTop: 4 }}>{s.title}</b>
        <span className="tiny muted">+{s.outfitsUnlocked} new outfit{s.outfitsUnlocked === 1 ? '' : 's'} · {CATEGORY_ONE[s.category]} · {s.levelName}</span>
      </div>
      <button type="button" className="btn sm" onClick={() => onAdd(s)}><Icon name="plus" size={14} />Bag</button>
    </article>
  );
}

function BuyCheck({ onAdded }) {
  const { vocab, toast } = useApp();
  const [q, setQ] = useState({ category: 'Shoes', colour: 'Black', name: 'loafers', styles: ['Classic'] });
  const [r, setR] = useState(null);
  const [im, setIm] = useState(null);
  // "Do I need this?" (similarity) and "What would it add?" (purchase simulation) run together; nothing is saved.
  async function run() { try { const [a, b] = await Promise.all([api.buyCheck({ category: q.category, colour: q.colour, styles: q.styles, ...(q.name && q.name.trim() && { name: q.name.trim().slice(0, 60) }) }), api.impact({ category: q.category, colour: q.colour, styles: q.styles, ...(q.name && q.name.trim() && { name: q.name.trim().slice(0, 60) }) })]); setR(a); setIm(b); } catch (e) { toast(e.message, true); } }
  async function addAnyway() {
    try { await api.addToList({ title: `${q.colour} ${CATEGORY_ONE[q.category].toLowerCase()}`, category: q.category, colour: q.colour, source: 'manual', reason: r ? `Checked first: ${r.verdict.toLowerCase()}.` : undefined }); toast('Added to your bag'); onAdded(); } catch (e) { toast(e.message, true); }
  }
  const tone = r ? { 'Good buy': 'tint-sage', Optional: 'tint-butter', Skip: 'tint-rose', 'Think twice': 'tint-rose', 'Not yet': 'tint-sky' }[r.verdict] : '';
  return (
    <section className={`card pad-lg ${tone}`}>
      <div className="eyebrow">Before you buy</div>
      <h3 style={{ margin: '4px 0 14px' }}>Do I need this? What would it add?</h3>
      <div className="grid g2" style={{ gap: 10 }}>
        <select className="input" value={q.category} onChange={(e) => setQ({ ...q, category: e.target.value })} aria-label="Category">{vocab.CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_ONE[c]}</option>)}</select>
        <select className="input" value={q.colour} onChange={(e) => setQ({ ...q, colour: e.target.value })} aria-label="Colour">{vocab.COLOURS.map((c) => <option key={c}>{c}</option>)}</select>
      </div>
      <input className="input" style={{ marginTop: 10 }} value={q.name || ''} maxLength={60} onChange={(e) => setQ({ ...q, name: e.target.value })} placeholder="What is it? e.g. loafers, fitted top (optional)" aria-label="What is it" />
      <div style={{ marginTop: 10 }}><Chips options={vocab.STYLES.slice(0, 6)} value={q.styles} onChange={(v) => setQ({ ...q, styles: v.slice(0, 4) })} /></div>
      <button type="button" className="btn block" style={{ marginTop: 12 }} onClick={run}><Icon name="search" size={15} />Check my closet</button>
      {r && (
        <div className="stack" style={{ marginTop: 16, gap: 10 }}>
          <div className="verdict">{r.verdict}</div>
          <p className="small">{r.advice}</p>
          {im && (
            <div className="impact-blocks" aria-label="Purchase impact">
              <div className="eyebrow">Purchase impact · simulated, not added</div>
              <div className="impact">
                <div><span className="tiny muted">New outfit combinations</span><b>{im.newCombinations}</b><span className="tiny muted">with {im.compatiblePieces} piece{im.compatiblePieces === 1 ? '' : 's'} you own</span></div>
                <div><span className="tiny muted">Similar items owned</span><b>{im.similarOwned}</b><span className="tiny muted">{im.similar.length ? im.similar.slice(0, 2).map((x) => x.name).join(', ') : 'none'}</span></div>
                <div><span className="tiny muted">Wardrobe gap</span><b style={{ fontSize: 15 }}>{im.fillsGap ? `${im.fillsGap.confidence}` : '—'}</b><span className="tiny muted">{im.fillsGap ? `fills a ${im.fillsGap.levelName.toLowerCase()} gap` : 'fills no gap'}</span></div>
                <div><span className="tiny muted">Main occasions</span><b style={{ fontSize: 15 }}>{im.occasions.length ? im.occasions.slice(0, 2).join(', ') : '—'}</b><span className="tiny muted">{im.occasions.length > 2 ? `+${im.occasions.length - 2} more` : ''}</span></div>
              </div>
              <p className="small" style={{ marginTop: 8 }}><span className="tiny muted">RECOMMENDATION · </span><b>{im.recommendation}.</b> {im.sentence}</p>
            </div>
          )}
          {r.duplicate && (
            <div className="dup-warn">
              <b className="small" style={{ display: 'block', marginBottom: 6 }}><Icon name="alert" size={14} /> {r.duplicate.message}</b>
              {r.similarOwned.slice(0, 3).map((p) => (
                <a key={p.id} className="sim-row" href={`#/closet/${p.id}`}><Tile piece={p} status={false} /><span className="small"><b>{pieceName(p)}</b></span><b className="pct">{p.similarity}%</b></a>
              ))}
            </div>
          )}
          <div className="row" style={{ gap: 6 }}>
            <a className="btn line sm" href={`#/ask?q=${encodeURIComponent(`Do I need ${q.colour.toLowerCase()} ${CATEGORY_ONE[q.category].toLowerCase()}?`)}`}><Icon name="brain" size={14} />Ask Closet</a>
            <button type="button" className="btn ghost sm" onClick={addAnyway}><Icon name="bag" size={14} />{r.duplicate ? 'Buy anyway' : 'Add to bag'}</button>
          </div>
        </div>
      )}
    </section>
  );
}

export default function ShoppingScreen() {
  const { toast } = useApp();
  const list = useLoad(() => api.shoppingList(), []);
  const sug = useLoad(() => api.shopping(), []);
  const reload = () => { list.reload(true); sug.reload(true); };
  async function bought(item) {
    try { await api.setListStatus(item.id, item.status === 'bought' ? 'to_buy' : 'bought'); toast(item.status === 'bought' ? 'Back in your bag' : 'Bought — add it to your closet when it arrives'); reload(); } catch (e) { toast(e.message, true); }
  }
  async function remove(item) { try { await api.removeFromList(item.id); toast('Removed from your bag'); reload(); } catch (e) { toast(e.message, true); } }
  async function add(s) {
    try { await api.addToList({ title: s.title, category: s.category, colour: s.colour, source: s.source === 'Gap' ? 'gap' : 'suggestion', reason: s.reason, suggestionKey: s.key }); toast('Added to your bag'); reload(); } catch (e) { toast(e.message, true); }
  }
  const items = list.data?.items || [];
  const toBuy = items.filter((i) => i.status === 'to_buy');
  const done = items.filter((i) => i.status === 'bought');
  return (
    <>
      <PageHead title="Shopping bag" sprint={3} sub="What to buy next — and why. Never what you let go of." />
      <div className="shop">
        <section className="bag-scene">
          <div className="bag-handles" aria-hidden="true"><svg viewBox="0 0 300 90"><path d="M70 88 C70 10, 130 4, 150 4 C170 4, 230 10, 230 88" fill="none" stroke="#9c5f5b" strokeWidth="10" strokeLinecap="round" /><path d="M70 88 C70 10, 130 4, 150 4 C170 4, 230 10, 230 88" fill="none" stroke="#c48a86" strokeWidth="5" strokeLinecap="round" /></svg></div>
          <div className="bag">
            <div className="bag-top"><span className="bag-brand">closet<span>.</span></span><span className="bag-count"><b>{list.loading ? '…' : toBuy.length}</b> to buy</span></div>
            {list.loading ? <Skeleton h={260} /> : !toBuy.length ? (
              <div className="bag-empty"><Icon name="bag" size={28} /><b>Your bag is empty</b><span className="small muted">Add a suggestion, or tell Ask Closet “put beige trousers on my shopping list”.</span></div>
            ) : <div className="bag-items">{toBuy.map((it) => <BagItem key={it.id} item={it} onBought={bought} onRemove={remove} />)}</div>}
            {done.length > 0 && <details className="bag-bought"><summary className="small">{done.length} bought</summary><div className="bag-items">{done.map((it) => <BagItem key={it.id} item={it} onBought={bought} onRemove={remove} />)}</div></details>}
          </div>
          <a className="ask-hint" href="#/ask?q=Put%20beige%20trousers%20on%20my%20shopping%20list"><Icon name="brain" size={16} /><span>Say <b>“put beige trousers on my shopping list”</b> to Ask Closet</span><Icon name="next" size={14} /></a>
        </section>
        <div className="stack lg">
          <section className="card pad">
            <div className="row between" style={{ marginBottom: 10 }}><h3>Closet suggests</h3><span className="tiny muted">only real gaps</span></div>
            {sug.loading ? <Skeleton h={160} /> : !sug.data.suggestions.length ? <p className="small muted">Nothing missing for the occasions you dress for.</p>
              : <div className="stack" style={{ gap: 8 }}>{sug.data.suggestions.slice(0, 4).map((s) => <Suggestion key={s.key} s={s} onAdd={add} />)}</div>}
            {sug.data && sug.data.avoid.length > 0 && (
              <details className="avoid"><summary className="tiny muted"><Icon name="eyeoff" size={13} /> Never suggested again ({sug.data.avoid.length})</summary>
                <div className="chips" style={{ marginTop: 8 }}>{sug.data.avoid.map((a) => <span key={`${a.category}${a.colour}`} className="chip">{a.name || `${a.colour} ${CATEGORY_ONE[a.category]}`} · no longer my style</span>)}</div>
              </details>
            )}
          </section>
          <BuyCheck onAdded={reload} />
        </div>
      </div>
    </>
  );
}
