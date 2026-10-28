// v1.6 Donation: the home for pieces the user decided to donate to someone who may need them.
// Ready to donate (still in the closet, left out of outfits) → Mark as donated (archived, wear history kept,
// no replacement in the shopping bag) or Cancel donation. Data: GET /donation.
import React from 'react';
import { api } from '../api.js';
import { Empty, Icon, PageHead, Skeleton, SprintTag, Tile, fmtDate, pieceName, useApp, useLoad } from '../ui.jsx';

export default function DonationScreen() {
  const { toast, refresh } = useApp();
  const d = useLoad(() => api.donation(), []);
  const reload = () => { d.reload(true); refresh(); };
  async function done(p) { try { const r = await api.donationDone(p.id); toast(r.effect); reload(); } catch (e) { toast(e.message, true); } }
  async function cancel(p) { try { await api.cancelDonation(p.id); toast(`${pieceName(p)} is back in your outfits`); reload(); } catch (e) { toast(e.message, true); } }
  return (
    <>
      <PageHead eyebrow="Wardrobe" title="Donation" sprint={3} sub="Pieces you chose to donate to someone who may need them."
        actions={<a className="btn line" href="#/analytics#forgotten"><Icon name="wand" size={16} />What could I donate?</a>} />
      {!d.data ? <Skeleton h={240} /> : (
        <div className="stack lg">
          <div className="stat-row" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 220px))' }}>
            <div className="stat"><b>{d.data.ready.length}</b><span>ready to donate</span></div>
            <div className="stat"><b>{d.data.count}</b><span>donated so far</span></div>
          </div>
          <section className="card pad" aria-label="Ready to donate">
            <div className="card-head"><div className="row"><h3>Ready to donate</h3><SprintTag n={3} short /></div><span className="tiny muted">Still in your closet until you confirm</span></div>
            {!d.data.ready.length && <Empty icon="heart" title="Nothing is waiting to be donated">When Closet asks “Still love it?” you can choose Donate — the piece waits here.</Empty>}
            {d.data.ready.map((p) => (
              <div key={p.id} className="care-row">
                <a href={`#/closet/${p.id}`} className="care-pic"><Tile piece={p} status={false} /></a>
                <div className="grow">
                  <a href={`#/closet/${p.id}`}><b>{pieceName(p)}</b></a>
                  <div className="small muted">{p.daysSinceWorn === null ? 'Never worn' : `Last worn ${p.daysSinceWorn} days ago`} · marked {fmtDate(p.markedOn, { day: 'numeric', month: 'long' })}</div>
                </div>
                <div className="row wrap end">
                  <button type="button" className="btn line sm" onClick={() => cancel(p)}>Cancel donation</button>
                  <button type="button" className="btn sm" onClick={() => done(p)}><Icon name="check" size={14} />Mark as donated</button>
                </div>
              </div>
            ))}
            <p className="tiny muted" style={{ marginTop: 10 }}>Mark as donated once it has actually left. It leaves your active closet, its wear history stays in your outfit memory, and no replacement is added to your shopping bag.</p>
          </section>
          {d.data.donated.length > 0 && (
            <section className="card pad">
              <h3 style={{ marginBottom: 8 }}>Donated</h3>
              {d.data.donated.map((x, i) => <div key={i} className="row between small" style={{ padding: '6px 0', borderTop: i ? '1px solid var(--line)' : 0 }}><span><b>{x.name || `${x.colour} ${x.category}`.toLowerCase()}</b> · worn {x.wearCount}×</span><span className="muted">{fmtDate(x.donatedAt)}</span></div>)}
            </section>
          )}
        </div>
      )}
    </>
  );
}
