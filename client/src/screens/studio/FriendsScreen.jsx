// Friends' closet — v3.0: confirmed friends only; you choose which pieces they may borrow.
// The server enforces every rule (403 for non-friends, only lendable + Available pieces, safe fields only).
import React, { useState } from 'react';
import { api } from '../../api.js';
import { Empty, Icon, PageHead, SprintNote, Tabs, Tile, pieceName, useApp, useLoad } from '../../ui.jsx';

export default function FriendsScreen() {
  const { toast, refresh } = useApp();
  const f = useLoad(() => api.friends(), []);
  const reqs = useLoad(() => api.borrowRequests(), []);
  const closet = useLoad(() => api.items(), []);
  const [tab, setTab] = useState('friends');
  const [email, setEmail] = useState('');
  const [open, setOpen] = useState(null); // { friend, items }
  const run = async (fn, msg) => { try { await fn(); if (msg) toast(msg); f.reload(true); reqs.reload(true); closet.reload(true); refresh(); } catch (e) { toast(e.message, true); } };
  const data = f.data || { friends: [], incoming: [], outgoing: [], lendableIds: [] };
  const lendable = new Set(data.lendableIds);
  const incomingBorrow = (reqs.data?.requests || []).filter((r) => r.direction === 'incoming' && r.status === 'pending');
  return (
    <>
      <PageHead title="Friends’ closet" sub="Borrow from friends instead of buying. Only confirmed friends see only the pieces you mark as lendable." />
      <Tabs options={[['friends', `Friends (${data.friends.length})`], ['requests', `Requests (${data.incoming.length + incomingBorrow.length})`], ['mine', 'What I lend']]} value={tab} onChange={setTab} />
      <section className="table-board stack lg" style={{ marginTop: 16 }}>
        {tab === 'friends' && (
          <>
            <form className="row" onSubmit={(e) => { e.preventDefault(); run(() => api.friendRequest(email), 'If they have an account, they’ll see your request.'); setEmail(''); }}>
              <input className="input grow" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Friend’s email" aria-label="Friend’s email" />
              <button type="submit" className="btn" disabled={!email}><Icon name="users" size={15} />Add friend</button>
            </form>
            {!data.friends.length && <Empty icon="users" title="No friends yet">Add a friend by email. They confirm on their side.</Empty>}
            <div className="studio-grid">
              {data.friends.map((fr) => (
                <div key={fr.id} className="studio-card stack">
                  <b style={{ fontFamily: 'var(--serif)', fontSize: 18 }}>{fr.name}</b>
                  <div className="row">
                    <button type="button" className="btn sm" onClick={async () => { try { setOpen(await api.friendCloset(fr.userId)); } catch (e) { toast(e.message, true); } }}>Open closet</button>
                    <button type="button" className="btn ghost sm" onClick={() => run(() => api.friendRemove(fr.id), 'Friend removed')}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
            {data.outgoing.length > 0 && <p className="small muted">Waiting for: {data.outgoing.map((o) => o.name).join(', ')}</p>}
          </>
        )}
        {tab === 'requests' && (
          <>
            {data.incoming.map((r) => <div key={r.id} className="row between"><span><b>{r.name}</b> wants to be friends</span><button type="button" className="btn sm" onClick={() => run(() => api.friendAccept(r.id), 'You are now friends')}>Accept</button></div>)}
            {incomingBorrow.map((r) => (
              <div key={r.id} className="row between">
                <span className="row" style={{ gap: 10 }}>{r.piece && <Tile piece={r.piece} status={false} style={{ width: 56 }} />}<span><b>{r.with}</b> asks to borrow your {r.piece ? pieceName(r.piece).toLowerCase() : 'piece'}</span></span>
                <span className="row"><button type="button" className="btn sm" onClick={() => run(() => api.decideBorrow(r.id, 'approve'), 'Approved — it’s in Borrow & lend now')}>Approve</button><button type="button" className="btn ghost sm" onClick={() => run(() => api.decideBorrow(r.id, 'decline'), 'Declined')}>Decline</button></span>
              </div>
            ))}
            {(reqs.data?.requests || []).filter((r) => r.direction === 'outgoing').map((r) => <div key={r.id} className="small muted">You asked {r.with} to borrow a piece · {r.status}</div>)}
            {!data.incoming.length && !incomingBorrow.length && <p className="muted">No new requests.</p>}
          </>
        )}
        {tab === 'mine' && (
          <>
            <p className="small muted">Tap a piece to let friends borrow it. Friends see only its photo, name, category and colour — and only while it is Available.</p>
            <div className="picker">
              {(closet.data?.items || []).map((p) => (
                <button type="button" key={p.id} className={lendable.has(p.id) ? 'on' : ''} aria-pressed={lendable.has(p.id)} onClick={() => run(() => api.setLendable(p.id, !lendable.has(p.id)))}>
                  <Tile piece={p} /><div className="tiny" style={{ fontWeight: 600, marginTop: 6 }}>{pieceName(p)}{lendable.has(p.id) ? ' · lendable' : ''}</div>
                </button>
              ))}
            </div>
          </>
        )}
      </section>
      {open && (
        <section style={{ marginTop: 20 }} className="stack lg">
          <div className="row between"><h3 style={{ margin: 0 }}>{open.friend.name}’s closet</h3><button type="button" className="btn ghost sm" onClick={() => setOpen(null)}>Close</button></div>
          {!open.items.length && <p className="muted">Nothing to borrow right now.</p>}
          <div className="studio-grid">
            {open.items.map((p) => (
              <div key={p.id} className="studio-card stack">
                <Tile piece={p} status={false} />
                <b className="small">{p.name}</b>
                <button type="button" className="btn line sm" onClick={() => run(() => api.borrow(open.friend.userId, p.id), `Request sent to ${open.friend.name}`)}>Ask to borrow</button>
              </div>
            ))}
          </div>
        </section>
      )}
      <div style={{ marginTop: 20 }}><SprintNote n={5} /></div>
    </>
  );
}
