// Friends' closet — v3.0, editorial design. Confirmed friends only; you choose what they may borrow.
// The server enforces every rule (403 for non-friends, only lendable + Available pieces, safe fields only).
import React, { useState } from 'react';
import { api } from '../../api.js';
import { pieceName, useApp, useLoad } from '../../ui.jsx';
import { ACCENT, Choice, Cover, Fineprint, Shelf, Step } from './editorial.jsx';

export default function FriendsScreen() {
  const { toast, refresh } = useApp();
  const f = useLoad(() => api.friends(), []);
  const reqs = useLoad(() => api.borrowRequests(), []);
  const closet = useLoad(() => api.items(), []);
  const [tab, setTab] = useState('friends');
  const [email, setEmail] = useState('');
  const [open, setOpen] = useState(null);
  const run = async (fn, msg) => { try { await fn(); if (msg) toast(msg); f.reload(true); reqs.reload(true); closet.reload(true); refresh(); } catch (e) { toast(e.message, true); } };
  const data = f.data || { friends: [], incoming: [], outgoing: [], lendableIds: [] };
  const incomingBorrow = (reqs.data?.requests || []).filter((r) => r.direction === 'incoming' && r.status === 'pending');
  const outgoing = (reqs.data?.requests || []).filter((r) => r.direction === 'outgoing');
  const nReq = data.incoming.length + incomingBorrow.length;
  return (
    <div className="ed" style={{ '--acc': ACCENT.friends }}>
      <Cover feature="friends" no={10} kicker="Share the wardrobe" title="Friends’ closet"
        dek="Borrow from friends instead of buying. Only confirmed friends see only the pieces you choose to lend." />
      <Choice label="Section" options={['friends', 'requests', 'mine']} value={tab} onChange={setTab}
        render={(t) => (t === 'friends' ? `Friends · ${data.friends.length}` : t === 'requests' ? `Requests · ${nReq}` : 'What I lend')} />

      {tab === 'friends' && (
        <>
          {data.friends.map((fr) => (
            <Step key={fr.id} n={fr.name.charAt(0)} title={`${fr.name}’s closet`} aside={<span className="ed-row"><button type="button" className="ed-link" onClick={async () => { try { setOpen(open && open.friend.userId === fr.userId ? null : await api.friendCloset(fr.userId)); } catch (e) { toast(e.message, true); } }}>{open && open.friend.userId === fr.userId ? 'Close' : 'Open closet'}</button><button type="button" className="ed-link" style={{ borderColor: 'transparent', color: 'var(--muted)' }} onClick={() => run(() => api.friendRemove(fr.id), 'Friend removed')}>Remove</button></span>}>
              {open && open.friend.userId === fr.userId && (open.items.length ? (
                <div className="ed-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }}>
                  {open.items.map((p) => (
                    <figure key={p.id} className={`ed-piece ${p.category}`} style={{ margin: 0 }}>
                      <img src={p.photoUrl} alt={p.name} />
                      <figcaption>{p.name}</figcaption>
                      <button type="button" className="ed-link" style={{ marginTop: 8 }} onClick={() => run(() => api.borrow(open.friend.userId, p.id), `Request sent to ${open.friend.name}`)}>Ask to borrow</button>
                    </figure>
                  ))}
                </div>
              ) : <p className="ed-sub">Nothing to borrow right now.</p>)}
            </Step>
          ))}
          <Step n="+" title="Add a friend">
            <form className="ed-row" onSubmit={(e) => { e.preventDefault(); run(() => api.friendRequest(email), 'If they have an account, they’ll see your request.'); setEmail(''); }}>
              <input className="input" style={{ flex: 1, fontFamily: 'var(--serif)', fontSize: 19, border: 0, borderBottom: '2px solid var(--ink)', borderRadius: 0, background: 'transparent' }} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="friend@email.com" aria-label="Friend’s email" />
              <button type="submit" className="ed-cta" disabled={!email}>Send request</button>
            </form>
            {data.outgoing.length > 0 && <p className="ed-fine">Waiting for: {data.outgoing.map((o) => o.name).join(', ')}</p>}
          </Step>
        </>
      )}

      {tab === 'requests' && (
        <Step n={nReq} title={nReq ? 'Waiting for you' : 'No new requests'}>
          {data.incoming.map((r) => <div key={r.id} className="ed-match" style={{ gridTemplateColumns: '1fr auto' }}><div style={{ fontFamily: 'var(--serif)', fontSize: 20 }}><b>{r.name}</b> wants to be friends</div><button type="button" className="ed-cta" onClick={() => run(() => api.friendAccept(r.id), 'You are now friends')}>Accept</button></div>)}
          {incomingBorrow.map((r) => (
            <div key={r.id} className="ed-match">
              {r.piece ? <img src={r.piece.photoUrl} alt={pieceName(r.piece)} /> : <div className="ed-ph">?</div>}
              <div style={{ fontFamily: 'var(--serif)', fontSize: 20 }}><b>{r.with}</b> asks to borrow your {r.piece ? pieceName(r.piece).toLowerCase() : 'piece'}</div>
              <div className="ed-row"><button type="button" className="ed-cta" onClick={() => run(() => api.decideBorrow(r.id, 'approve'), 'Approved — it’s in Borrow & lend now')}>Approve</button><button type="button" className="ed-link" onClick={() => run(() => api.decideBorrow(r.id, 'decline'), 'Declined')}>Decline</button></div>
            </div>
          ))}
          {outgoing.length > 0 && <ul className="ed-list">{outgoing.map((r) => <li key={r.id}>You asked {r.with} to borrow a piece · {r.status}</li>)}</ul>}
        </Step>
      )}

      {tab === 'mine' && (
        <Step n={data.lendableIds.length} title="Pieces friends may borrow" aside={<span className="ed-fine">tap to switch on or off</span>}>
          <Shelf items={(closet.data?.items || []).filter((p) => p.photoUrl)} value={data.lendableIds} multiple max={999}
            onChange={(next) => { const added = next.find((id) => !data.lendableIds.includes(id)); const removed = data.lendableIds.find((id) => !next.includes(id)); const id = added || removed; if (id) run(() => api.setLendable(id, !!added)); }} />
          <Fineprint>Friends see only the photo, name, category and colour — and only while the piece is Available.</Fineprint>
        </Step>
      )}
    </div>
  );
}
