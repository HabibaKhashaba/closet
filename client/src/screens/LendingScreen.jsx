// v1.6 Borrow & lend: everything that is lent out (who, since when, due, overdue), Mark returned,
// Remind me later, Lend an item, and the lending history. Data: GET /lending (the lifecycle is the source).
import React, { useState } from 'react';
import { api } from '../api.js';
import { Empty, Icon, Modal, PageHead, Skeleton, SprintTag, Tile, fmtDate, pieceName, useApp, useLoad } from '../ui.jsx';
import { LendModal } from './Lifecycle.jsx';

export default function LendingScreen() {
  const { toast, refresh } = useApp();
  const l = useLoad(() => api.lending(), []);
  const closet = useLoad(() => api.items({ status: 'Available' }), []);
  const [pick, setPick] = useState(false);
  const [lend, setLend] = useState(null);
  const reload = () => { l.reload(true); closet.reload(true); refresh(); };
  async function returned(p) { try { await api.returned(p.id); toast(`${pieceName(p)} is back — Available`); reload(); } catch (e) { toast(e.message, true); } }
  async function later(p) { try { const r = await api.remindLater(p.id, 3); toast(`Reminder moved to ${fmtDate(r.until)}`); reload(); } catch (e) { toast(e.message, true); } }
  return (
    <>
      <PageHead eyebrow="Wardrobe" title="Borrow & lend" sprint={3} sub="Who has what, since when, and when it comes back."
        actions={<button type="button" className="btn" onClick={() => setPick(true)}><Icon name="user" size={16} />Lend an item</button>} />
      {!l.data ? <Skeleton h={240} /> : (
        <div className="stack lg">
          <section className="card pad" aria-label="Currently lent">
            <div className="card-head"><div className="row"><h3>Currently lent</h3><SprintTag n={3} short /></div><span className="tiny muted">{l.data.current.length} out{l.data.overdue ? ` · ${l.data.overdue} overdue` : ''}</span></div>
            {!l.data.current.length && <Empty icon="user" title="Nothing is lent out">Open a piece → More actions → Lend item, or use “Lend an item”.</Empty>}
            {l.data.current.map((p) => (
              <div key={p.id} className={`care-row ${p.overdueDays ? 'late' : ''}`}>
                <a href={`#/closet/${p.id}`} className="care-pic"><Tile piece={p} status={false} /></a>
                <div className="grow">
                  <a href={`#/closet/${p.id}`}><b>{pieceName(p)}</b></a>
                  <div className="small">With <b>{p.loan.person}</b>{p.loan.lentOn && <> · lent {fmtDate(p.loan.lentOn)}</>}{p.loan.dueOn && <> · due {fmtDate(p.loan.dueOn)}</>}</div>
                  <div className="small muted">{p.overdueDays ? <span className="tag warn">{p.overdueDays} day{p.overdueDays === 1 ? '' : 's'} overdue</span> : p.dueToday ? <span className="tag">Due today</span> : `${p.daysOut ?? 0} day${p.daysOut === 1 ? '' : 's'} out`}{p.loan.note ? ` · ${p.loan.note}` : ''}</div>
                </div>
                <div className="row wrap end">
                  {(p.overdueDays > 0 || p.dueToday) && <button type="button" className="btn ghost sm" onClick={() => later(p)}>Remind me later</button>}
                  <button type="button" className="btn sm" onClick={() => returned(p)}><Icon name="check" size={14} />Mark returned</button>
                </div>
              </div>
            ))}
          </section>
          {l.data.history.length > 0 && (
            <section className="card pad">
              <h3 style={{ marginBottom: 8 }}>History</h3>
              {l.data.history.map((h, i) => <div key={i} className="row between small" style={{ padding: '6px 0', borderTop: i ? '1px solid var(--line)' : 0 }}><span><b>{h.name || 'A piece'}</b> · {h.person}</span><span className="muted">{fmtDate(h.lentOn)} → {fmtDate(h.returnedOn)}</span></div>)}
            </section>
          )}
        </div>
      )}
      {pick && (
        <Modal wide title="Lend an item" sub="Only Available pieces can be lent." onClose={() => setPick(false)}>
          <div className="closet-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
            {(closet.data?.items || []).map((p) => <button key={p.id} type="button" className="piece-pick" onClick={() => { setPick(false); setLend(p); }}><Tile piece={p} status={false} /><span className="small">{pieceName(p)}</span></button>)}
          </div>
        </Modal>
      )}
      {lend && <LendModal piece={lend} onClose={() => setLend(null)} onDone={reload} />}
    </>
  );
}
