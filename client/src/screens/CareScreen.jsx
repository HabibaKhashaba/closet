// v1.6 Care: Laundry + Repairs & alterations in one place (no extra top-level clutter).
// Repairs & alterations: Needs repair · Needs alteration · At tailor, with Send to tailor, Fixed at home,
// Mark collected and Remind me later. Every list is read from GET /care (the lifecycle is the source).
import React, { useState } from 'react';
import { api } from '../api.js';
import { Empty, Icon, Modal, PageHead, Skeleton, SprintNote, SprintTag, Tabs, Tile, fmtDate, pieceName, useApp, useLoad } from '../ui.jsx';
import { go } from '../App.jsx';
import LaundryScreen from './LaundryScreen.jsx';
import { RepairModal, TailorModal } from './Lifecycle.jsx';

function CareRow({ p, children, sub }) {
  return (
    <div className="care-row">
      <a href={`#/closet/${p.id}`} className="care-pic"><Tile piece={p} status={false} /></a>
      <div className="grow">
        <a href={`#/closet/${p.id}`}><b>{pieceName(p)}</b></a>
        <div className="small muted">{sub}</div>
      </div>
      <div className="row wrap end">{children}</div>
    </div>
  );
}

function Repairs() {
  const { toast, refresh } = useApp();
  const care = useLoad(() => api.care(), []);
  const closet = useLoad(() => api.items({ status: 'Available' }), []);
  const [tailor, setTailor] = useState(null);
  const [repair, setRepair] = useState(null);
  const [pick, setPick] = useState(false);
  const reload = () => { care.reload(true); closet.reload(true); refresh(); };
  async function done(p) { try { const r = await api.careDone(p.id); toast(`${pieceName(p)}: ${r.message}`); reload(); } catch (e) { toast(e.message, true); } }
  async function later(p) { try { const r = await api.tailorLater(p.id, 2); toast(`Reminder moved to ${fmtDate(r.until)}`); reload(); } catch (e) { toast(e.message, true); } }
  if (!care.data) return <Skeleton h={260} />;
  const c = care.data;
  const empty = !c.needsRepair.length && !c.needsAlteration.length && !c.atTailor.length;
  return (
    <div className="stack lg">
      <div className="row between wrap">
        <p className="small muted">Pieces here stay in your closet but are left out of Style me, Mix &amp; Match suggestions and plans until they’re back.</p>
        <button type="button" className="btn sm" onClick={() => setPick(true)}><Icon name="plus" size={15} />Repair / alter a piece</button>
      </div>
      {empty && <Empty icon="check" title="Nothing needs repair or alteration">Open a piece → More actions → Repair / Alter, or use the button above.</Empty>}
      {c.atTailor.length > 0 && (
        <section className="card pad" aria-label="At tailor">
          <div className="card-head"><h3>At tailor</h3><span className="tag">{c.atTailor.length}</span></div>
          {c.atTailor.map((p) => (
            <CareRow key={p.id} p={p} sub={<>{p.care?.kind === 'alteration' ? 'Alteration' : 'Repair'}: {p.care?.reason}{p.care?.tailor ? ` · ${p.care.tailor}` : ''} · sent {fmtDate(p.care?.sentOn)} · back <b>{fmtDate(p.statusUntil)}</b>{p.due ? <span className="tag warn" style={{ marginLeft: 6 }}>{p.daysLate ? `${p.daysLate} day${p.daysLate === 1 ? '' : 's'} late` : 'Ready today'}</span> : null}{p.care?.cost != null ? ` · cost ${p.care.cost}` : ''}</>}>
              {p.due && <button type="button" className="btn ghost sm" onClick={() => later(p)}>Remind me later</button>}
              <button type="button" className="btn sm" onClick={() => done(p)}><Icon name="check" size={14} />Mark collected</button>
            </CareRow>
          ))}
        </section>
      )}
      {[['Needs alteration', c.needsAlteration], ['Needs repair', c.needsRepair]].filter(([, l]) => l.length).map(([title, list]) => (
        <section key={title} className="card pad" aria-label={title}>
          <div className="card-head"><h3>{title}</h3><span className="tag">{list.length}</span></div>
          {list.map((p) => (
            <CareRow key={p.id} p={p} sub={<>{p.care?.reason || 'No reason given'}{p.care?.notes ? ` · ${p.care.notes}` : ''}{p.care?.createdAt ? ` · since ${fmtDate(p.care.createdAt)}` : ''}</>}>
              <button type="button" className="btn line sm" onClick={() => done(p)}>Fixed at home</button>
              <button type="button" className="btn sm" onClick={() => setTailor(p)}><Icon name="arrow" size={14} />Send to tailor</button>
            </CareRow>
          ))}
        </section>
      ))}
      {c.history.length > 0 && (
        <section className="card pad">
          <h3 style={{ marginBottom: 8 }}>History</h3>
          {c.history.map((h, i) => <div key={i} className="row between small" style={{ padding: '6px 0', borderTop: i ? '1px solid var(--line)' : 0 }}><span><b>{h.name || 'A piece'}</b> · {h.kind === 'alteration' ? 'alteration' : 'repair'}: {h.reason}{h.tailor ? ` · ${h.tailor}` : ''}</span><span className="muted">{h.outcome} {fmtDate(h.closedOn)}</span></div>)}
        </section>
      )}
      {pick && (
        <Modal wide title="Which piece needs care?" sub="Only Available pieces can go for a repair or alteration." onClose={() => setPick(false)}>
          <div className="closet-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
            {(closet.data?.items || []).map((p) => <button key={p.id} type="button" className="piece-pick" onClick={() => { setPick(false); setRepair(p); }}><Tile piece={p} status={false} /><span className="small">{pieceName(p)}</span></button>)}
          </div>
        </Modal>
      )}
      {repair && <RepairModal piece={repair} onClose={() => setRepair(null)} onDone={reload} />}
      {tailor && <TailorModal piece={tailor} onClose={() => setTailor(null)} onDone={reload} />}
    </div>
  );
}

export default function CareScreen({ tab }) {
  const { laundryCount } = useApp();
  const t = tab === 'repairs' ? 'repairs' : 'laundry';
  return (
    <>
      <PageHead eyebrow="Wardrobe" title="Care" sprint={1} sub="Laundry, repairs and alterations — everything that is being looked after." />
      <Tabs options={[['laundry', `Laundry${laundryCount ? ` · ${laundryCount}` : ''}`], ['repairs', 'Repairs & alterations']]} value={t} onChange={(k) => go(k === 'laundry' ? '/laundry' : '/care/repairs')} />
      <div style={{ marginTop: 18 }}>{t === 'laundry' ? <LaundryScreen embedded /> : <Repairs />}</div>
      {t === 'repairs' && <SprintNote n={3}>Repairs &amp; alterations (v1.6): one garment lifecycle shared by every screen — Needs repair / Needs alteration → At tailor → Available. <SprintTag n={3} short /></SprintNote>}
    </>
  );
}
