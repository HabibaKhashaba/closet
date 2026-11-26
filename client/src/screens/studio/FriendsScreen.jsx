// Friends' closet — v3.0. Request access to a friend's closet with their Closet email; once they give access
// you see their whole closet and can ask to borrow any available piece. The server enforces every rule
// (403 for anyone who is not a confirmed friend; only available pieces can be borrowed; only the owner approves).
import React, { useState } from 'react';
import { api } from '../../api.js';
import { fmtDate, pieceName, relDay, useApp, useLoad } from '../../ui.jsx';
import { ACCENT, Choice, Cover, Fineprint, Step } from './editorial.jsx';

const CATS = ['All', 'Top', 'Dress', 'Bottom', 'Layer', 'Shoes', 'Bag', 'Extra'];
const CAT_LABEL = { All: 'All', Top: 'Tops', Dress: 'Dresses', Bottom: 'Bottoms', Layer: 'Outerwear', Shoes: 'Shoes', Bag: 'Bags', Extra: 'Accessories' };

export default function FriendsScreen({ query = {} }) {
  const { toast, refresh } = useApp();
  const f = useLoad(() => api.friends(), []);
  const reqs = useLoad(() => api.borrowRequests(), []);
  const [tab, setTab] = useState(query.tab === 'requests' ? 'requests' : 'friends');
  const [email, setEmail] = useState('');
  const [open, setOpen] = useState(null);
  const [cat, setCat] = useState('All');
  const reload = () => { f.reload(true); reqs.reload(true); refresh(); };
  const run = async (fn, msg) => { try { const r = await fn(); if (msg) toast(msg); reload(); return r; } catch (e) { toast(e.message, true); return null; } };
  const data = f.data || { friends: [], incoming: [], outgoing: [] };
  const all = reqs.data?.requests || [];
  const incomingBorrow = all.filter((r) => r.direction === 'incoming' && r.status === 'pending');
  const nReq = data.incoming.length + incomingBorrow.length;
  async function openCloset(fr) {
    if (open && open.friend.userId === fr.userId) { setOpen(null); return; }
    try { setOpen(await api.friendCloset(fr.userId)); setCat('All'); } catch (e) { toast(e.message, true); }
  }
  async function borrow(p) {
    const r = await run(() => api.borrow(open.friend.userId, p.id), `Request sent to ${open.friend.name}`);
    if (r) setOpen(await api.friendCloset(open.friend.userId));
  }
  const pending = (id) => all.some((r) => r.direction === 'outgoing' && r.status === 'pending' && r.piece && r.piece.id === id);
  const shown = open ? open.items.filter((p) => cat === 'All' || p.category === cat) : [];

  return (
    <div className="ed" style={{ '--acc': ACCENT.friends }}>
      <Cover feature="friends" no={9} kicker="Share the wardrobe" title="Friends’ closet"
        dek="Ask a friend for access to her closet. Once she says yes, you can see everything she owns and ask to borrow a piece." />
      <Choice label="Section" options={['friends', 'requests']} value={tab} onChange={setTab}
        render={(t) => (t === 'friends' ? `Closets · ${data.friends.length}` : `Requests${nReq ? ` · ${nReq}` : ''}`)} />

      {tab === 'friends' && (
        <>
          {(reqs.data?.borrowing || []).length > 0 && (
            <Step n="↙" title="Borrowed from friends" aside={<span className="ed-fine">{reqs.data.borrowing.length} with you now</span>}>
              {reqs.data.borrowing.map((r) => (
                <div key={r.id} className="ed-match">
                  {r.piece ? <img src={r.piece.photoUrl} alt={pieceName(r.piece)} /> : <div className="ed-ph">?</div>}
                  <div><div style={{ fontFamily: 'var(--serif)', fontSize: 20 }}>{r.piece ? r.piece.name : 'A piece'}</div>
                    <div className="ed-meta">From <b>{r.with}</b>{r.dueOn ? ` · give it back by ${fmtDate(r.dueOn, { weekday: 'short', day: 'numeric', month: 'short' })}` : ''}</div></div>
                  <span className="ed-fine">{r.with} marks it returned</span>
                </div>
              ))}
            </Step>
          )}
          <Step n="+" title="Request access to a closet">
            <form className="ed-row" onSubmit={async (e) => { e.preventDefault(); await run(() => api.friendRequest(email), 'Request sent. She will see it in her notifications.'); setEmail(''); }}>
              <input className="input" style={{ flex: 1, minWidth: 220 }} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Her Closet email, e.g. nour.demo@closet.app" aria-label="Friend’s Closet email" />
              <button type="submit" className="ed-cta" disabled={!email}>Request access</button>
            </form>
            {data.outgoing.length > 0 && <p className="ed-fine">Waiting for access from: {data.outgoing.map((o) => o.name).join(', ')}</p>}
          </Step>

          {data.friends.length === 0 && <p className="ed-sub" style={{ marginTop: 10 }}>No shared closets yet. Request access above — when your friend gives it, her closet appears here.</p>}
          {data.friends.map((fr) => {
            const isOpen = open && open.friend.userId === fr.userId;
            return (
              <Step key={fr.id} n={fr.name.charAt(0)} title={`${fr.name}’s closet`}
                aside={<span className="ed-row"><button type="button" className="ed-cta" onClick={() => openCloset(fr)}>{isOpen ? 'Close' : 'Open closet'}</button><button type="button" className="ed-link" style={{ borderColor: 'transparent', color: 'var(--muted)' }} onClick={() => { setOpen(null); run(() => api.friendRemove(fr.id), 'Access removed for both of you'); }}>Remove</button></span>}>
                {!isOpen && <p className="ed-fine">Shared since {relDay(String(fr.since).slice(0, 10))}. You can both see each other’s closet.</p>}
                {isOpen && (
                  <>
                    <p className="ed-sub" style={{ marginTop: 0 }}>{open.items.length} pieces · {open.available} available to borrow</p>
                    <div style={{ margin: '14px 0 18px' }}><Choice label="Category" options={CATS.filter((c) => c === 'All' || open.items.some((p) => p.category === c))} value={cat} onChange={setCat} render={(c) => CAT_LABEL[c]} /></div>
                    <div className="ed-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}>
                      {shown.map((p) => (
                        <figure key={p.id} className={`ed-piece ${p.category}`} style={{ margin: 0, opacity: p.available ? 1 : 0.5 }}>
                          <img src={p.photoUrl} alt={p.name} />
                          <figcaption>{p.name}</figcaption>
                          {p.available
                            ? (pending(p.id) ? <span className="ed-fine">Request sent</span> : <button type="button" className="ed-link" style={{ marginTop: 8 }} onClick={() => borrow(p)}>Ask to borrow</button>)
                            : <span className="ed-fine">Not available right now</span>}
                        </figure>
                      ))}
                    </div>
                  </>
                )}
              </Step>
            );
          })}
        </>
      )}

      {tab === 'requests' && (
        <>
          <Step n={nReq} title={nReq ? 'Waiting for you' : 'Nothing waiting for you'}>
            {data.incoming.map((r) => (
              <div key={r.id} className="ed-match" style={{ gridTemplateColumns: '1fr auto' }}>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 20 }}><b>{r.name}</b> requested access to your closet<div className="ed-fine" style={{ marginTop: 2 }}>Giving access lets you both see each other’s closet.</div></div>
                <div className="ed-row"><button type="button" className="ed-cta" onClick={() => run(() => api.friendAccept(r.id), `${r.name} can now see your closet`)}>Give access</button><button type="button" className="ed-link" onClick={() => run(() => api.friendRemove(r.id), 'Request declined')}>Decline</button></div>
              </div>
            ))}
            {incomingBorrow.map((r) => (
              <div key={r.id} className="ed-match">
                {r.piece ? <img src={r.piece.photoUrl} alt={pieceName(r.piece)} /> : <div className="ed-ph">?</div>}
                <div style={{ fontFamily: 'var(--serif)', fontSize: 20 }}><b>{r.with}</b> asks to borrow your {r.piece ? pieceName(r.piece).toLowerCase() : 'piece'}<div className="ed-fine" style={{ marginTop: 2 }}>Approving moves it to Borrow & lend for 7 days.</div></div>
                <div className="ed-row"><button type="button" className="ed-cta" onClick={() => run(() => api.decideBorrow(r.id, 'approve'), `Approved — lent to ${r.with}`)}>Approve</button><button type="button" className="ed-link" onClick={() => run(() => api.decideBorrow(r.id, 'decline'), 'Declined')}>Decline</button></div>
              </div>
            ))}
          </Step>
          <Step n="↗" title="Your requests">
            {data.outgoing.length === 0 && !all.some((r) => r.direction === 'outgoing') && <p className="ed-fine">You haven’t asked anyone yet.</p>}
            <ul className="ed-list">
              {data.outgoing.map((o) => <li key={o.id}>Access to {o.name}’s closet · waiting</li>)}
              {all.filter((r) => r.direction === 'outgoing').map((r) => <li key={r.id}>Borrow {r.piece ? pieceName(r.piece).toLowerCase() : 'a piece'} from {r.with} · <b>{r.borrowedNow ? 'with you now' : r.status}</b></li>)}
            </ul>
          </Step>
        </>
      )}
      <Fineprint>Friends see a piece’s photo, name, category, colour and whether it is available — never wear history, notes or prices.</Fineprint>
    </div>
  );
}
