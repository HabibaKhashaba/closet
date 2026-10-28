// US-12: browse the closet as visual cards; filter by category and status; search by name.
import React, { useMemo, useState } from 'react';
import { api } from '../api.js';
import { CATEGORY_LABEL, Chips, Empty, Icon, Modal, PageHead, PieceCard, Skeleton, SprintTag, STATUS_LABEL, Tabs, useApp, useLoad } from '../ui.jsx';

export default function ClosetScreen({ query: q = {} }) {
  const { vocab } = useApp();
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState(q.status || '');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('new');
  const all = useLoad(() => api.items(), []);
  const [gapsOpen, setGapsOpen] = useState(false);

  const items = useMemo(() => {
    if (!all.data) return [];
    let list = all.data.items.filter((p) => (!category || p.category === category) && (!status || p.status === status));
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((p) => [p.name, p.colour, p.fabric, p.category, CATEGORY_LABEL[p.category], ...(p.styles || [])].filter(Boolean).join(' ').toLowerCase().includes(q));
    }
    if (sort === 'worn') list = [...list].sort((a, b) => b.wearCount - a.wearCount);
    if (sort === 'least') list = [...list].sort((a, b) => a.wearCount - b.wearCount);
    return list;
  }, [all.data, category, status, query, sort]);

  const counts = all.data?.counts;
  const tabs = [['', `All ${all.data ? all.data.total : ''}`], ...vocab.CATEGORIES.map((c) => [c, `${CATEGORY_LABEL[c]} ${counts ? counts.category[c] : ''}`])];

  return (
    <>
      <PageHead title="My closet" sprint={1} sub="Your dressing room — every piece, with its status."
        actions={<><button type="button" className="btn line" onClick={() => setGapsOpen(true)}><Icon name="chart" size={16} />Closet gaps</button><a className="btn" href="#/closet/new"><Icon name="plus" size={16} />Add a piece</a></>} />
      <div className="row" style={{ marginBottom: 14, gap: 12 }}>
        <div style={{ overflowX: 'auto', maxWidth: '100%' }}><Tabs options={tabs} value={category} onChange={setCategory} /></div>
      </div>
      <div className="row between" style={{ marginBottom: 22 }}>
        <Chips options={vocab.STATUSES} value={status} multiple={false} onChange={setStatus} render={(s) => STATUS_LABEL[s]} counts={counts?.status} />
        <div className="row">
          <label className="search"><Icon name="search" size={16} /><input placeholder="Search “black”, “silk”, “blazer”…" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
          <select className="input" style={{ width: 'auto', borderRadius: 99 }} value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
            <option value="new">Newest</option><option value="worn">Most worn</option><option value="least">Least worn</option>
          </select>
        </div>
      </div>
      {all.loading ? <div className="closet-grid">{Array.from({ length: 10 }, (_, i) => <Skeleton key={i} h={260} />)}</div>
        : !all.data.total ? <Empty title="Your closet is empty" action={<a className="btn" href="#/closet/new">Add your first piece</a>}>Take a photo of a piece on a plain background to start.</Empty>
          : !items.length ? <Empty icon="search" title="Nothing matches">Try another filter.</Empty>
            : !category && !status && !query.trim() ? (
              <div className="wardrobe dressing-env rise">
                <div className="led-strip" aria-hidden="true" />
                {vocab.CATEGORIES.filter((c) => items.some((p) => p.category === c)).map((c) => (
                  <div key={c} className={`rail-section ${["Shoes", "Bag", "Extra"].includes(c) ? "shelf" : ""}`}>
                    <h4>{CATEGORY_LABEL[c]} · {items.filter((p) => p.category === c).length}</h4>
                    <div className="rail">{items.filter((p) => p.category === c).map((p) => <PieceCard key={p.id} piece={p} href={`#/closet/${p.id}`} />)}</div>
                  </div>
                ))}
              </div>
            ) : <div className="closet-grid">{items.map((p) => <PieceCard key={p.id} piece={p} href={`#/closet/${p.id}`} />)}</div>}
      {gapsOpen && <GapsModal onClose={() => setGapsOpen(false)} />}
    </>
  );
}

// US-64 closet gaps (Sprint 1): pieces per group and dress-code level; a gap is ≤ 1 piece at a level you dress for.
function GapsModal({ onClose }) {
  const { vocab } = useApp();
  const { data } = useLoad(() => api.gaps(), []);
  const smart = useLoad(() => api.smartGaps(), []); // v1.6: the same gaps with confidence, priority and reasons
  const conf = (g) => (smart.data?.gaps || []).find((x) => x.group === g.group && x.level === g.level);
  return (
    <Modal wide title="Closet gaps" sub="How many pieces you have at each dress-code level. A gap is one piece or fewer at a level you dress for." onClose={onClose}>
      <div className="row" style={{ marginBottom: 14 }}><SprintTag n={1} /><span className="small muted">US-64 · levels you dress for: {data ? data.levels.map((l) => l.name).join(', ') : '…'}</span></div>
      {!data ? <Skeleton h={200} /> : (
        <>
          <table className="table">
            <thead><tr><th>Group</th>{[1, 2, 3, 4, 5].map((l) => <th key={l} style={{ textAlign: 'center' }}>{vocab.DRESS_CODES[l]}</th>)}</tr></thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.group}><td><b>{r.group}</b></td>{[1, 2, 3, 4, 5].map((l) => {
                  const gap = data.gaps.some((g) => g.group === r.group && g.level === l);
                  return <td key={l} style={{ textAlign: 'center' }}><span className={gap ? 'tag rose' : data.levels.some((x) => x.level === l) ? 'tag s1' : 'tag plain'}>{r.counts[l]}</span></td>;
                })}</tr>
              ))}
            </tbody>
          </table>
          <div className="stack" style={{ marginTop: 16, gap: 8 }}>
            {!data.gaps.length ? <div className="notice ok small">No gaps: at least two pieces of each kind for every level you dress for.</div>
              : data.gaps.map((g) => { const c = conf(g); return (
                <div key={g.group + g.level} className="notice warn small" style={{ display: 'block' }}>
                  <div className="row" style={{ gap: 8 }}><Icon name="tag" size={16} /><span className="grow">Gap: {g.message}</span>{c && <span className={`tag ${c.confidence === 'HIGH' ? 'rose' : c.confidence === 'MEDIUM' ? 'warn' : 'plain'}`}>{c.confidence} confidence · {c.priority}</span>}</div>
                  {c && c.reasons?.length > 0 && <ul className="tiny muted" style={{ margin: '6px 0 0 24px' }}>{c.reasons.slice(0, 3).map((x) => <li key={x}>{x}</li>)}</ul>}
                </div>); })}
          </div>
          <a className="btn line sm" href="#/shopping" style={{ marginTop: 14 }} onClick={onClose}><Icon name="bag" size={14} />What should I buy? <SprintTag n={3} short /></a>
        </>
      )}
    </Modal>
  );
}
