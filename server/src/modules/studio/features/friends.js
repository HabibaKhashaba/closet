// Feature 10 — Friends' closet (security-critical).
// Flow: Habiba requests access to Nour's closet by her Closet email → Nour is notified and gives access
// (mutual) → each can open the other's whole closet → ask to borrow an Available piece → the owner is
// notified and approves (the existing Borrow & lend flow) or declines → the requester is notified.
// Rules, all enforced HERE on the server:
//   · only confirmed friends can open a closet (403 otherwise); a pending request is not enough
//   · a friend sees the pieces the owner still owns — photo, name, category, colour and whether it is
//     available — never wear history, notes, prices, care or loan details
//   · only an Available piece can be borrowed; only the owner can approve; pieces that are not theirs → 404
//   · the reply to a request is the same whether or not the email exists (no account discovery)
//   · friend actions go to the activity log without garment details
const { bad, errors } = require('../context');
const { isOwned } = require('../../../shared/lifecycle');

const UUID = /^[0-9a-f-]{36}$/i;
const first = (n) => String(n || 'Friend').split(' ')[0];
const shared = (p, owner) => ({ id: p.id, name: p.name, category: p.category, colour: p.colour, photoUrl: p.photoUrl || null, available: p.status === 'Available', owner });

module.exports = function friends(deps) {
  const repo = deps.repo;
  const log = (userId, action) => deps.activity().record(userId, action).catch(() => {});
  const nameOf = async (id) => first(await repo.displayName(id));
  async function friendIds(userId) {
    return (await repo.friendships(userId)).filter((f) => f.status === 'accepted').map((f) => (f.requester_id === userId ? f.addressee_id : f.requester_id));
  }
  async function mustBeFriends(userId, friendId) {
    const f = typeof friendId === 'string' && UUID.test(friendId) && friendId !== userId ? await repo.pair(userId, friendId) : null;
    if (!f || f.status !== 'accepted') { await log(userId, 'Friends: access denied'); throw errors.forbidden(); }
  }
  const closetOf = async (ownerId) => (await deps.wardrobe().allPieces(ownerId)).filter(isOwned);

  const methods = {
    async list(userId) {
      const out = { friends: [], incoming: [], outgoing: [] };
      for (const f of await repo.friendships(userId)) {
        const other = f.requester_id === userId ? f.addressee_id : f.requester_id;
        const row = { id: f.id, userId: other, name: await nameOf(other), since: f.accepted_at || f.created_at };
        if (f.status === 'accepted') out.friends.push(row);
        else if (f.addressee_id === userId) out.incoming.push(row);
        else out.outgoing.push(row);
      }
      return out;
    },
    async request(userId, body = {}) {
      const email = String(body.email || '').trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw bad('email', 'Enter their Closet email.');
      const other = await repo.userByEmail(email);
      if (other && other.id !== userId) {
        const existing = await repo.pair(userId, other.id);
        if (!existing) await repo.request(userId, other.id);
        else if (existing.status === 'pending' && existing.addressee_id === userId) await repo.accept(existing.id, userId); // they already asked you: now you are friends
      }
      await log(userId, 'Friends: access requested');
      return { sent: true, message: 'If this person has a Closet account, they will get your request.' };
    },
    async accept(userId, id) {
      const f = await repo.accept(id, userId);
      if (!f) throw errors.notFound('Request');
      await log(userId, 'Friends: access given');
      return { accepted: true };
    },
    async remove(userId, id) {
      if (!(await repo.remove(id, userId))) throw errors.notFound('Friend');
      await log(userId, 'Friends: removed');
      return { removed: true };
    },
    async closet(userId, friendId) {
      await mustBeFriends(userId, friendId);
      const name = await nameOf(friendId);
      const items = (await closetOf(friendId)).map((p) => shared(p, name)).sort((a, b) => Number(b.available) - Number(a.available) || a.category.localeCompare(b.category));
      return { friend: { userId: friendId, name }, items, available: items.filter((i) => i.available).length };
    },
    // every piece the user's friends could lend right now (used by Recreate this look)
    async borrowable(userId) {
      const out = [];
      for (const fid of await friendIds(userId)) {
        const name = await nameOf(fid);
        out.push(...(await closetOf(fid)).filter((p) => p.status === 'Available').map((p) => ({ ...shared(p, name), ownerId: fid })));
      }
      return out;
    },
    async borrow(userId, body = {}) {
      const { friendId, itemId } = body;
      await mustBeFriends(userId, friendId);
      const piece = (await closetOf(friendId)).find((p) => p.id === itemId);
      if (!piece) throw errors.notFound('Piece');
      if (piece.status !== 'Available') throw errors.conflict('NOT_AVAILABLE', 'This piece is not available right now.');
      const open = await repo.openBorrow(itemId, userId);
      if (open) return { request: { id: open.id, status: open.status }, existing: true };
      const r = await repo.createBorrow({ itemId, ownerId: friendId, requesterId: userId });
      await log(userId, 'Friends: borrow requested');
      return { request: { id: r.id, status: r.status }, existing: false };
    },
    async requests(userId) {
      const out = [];
      for (const r of await repo.borrowRequests(userId)) {
        const mine = r.owner_id === userId;
        const piece = (await deps.wardrobe().piecesByIds(r.owner_id, [r.item_id]))[0];
        out.push({ id: r.id, direction: mine ? 'incoming' : 'outgoing', status: r.status, with: await nameOf(mine ? r.requester_id : r.owner_id), createdAt: r.created_at, decidedAt: r.decided_at || null,
          piece: piece ? shared(piece, null) : null });
      }
      return { requests: out };
    },
    async decide(userId, id, body = {}) {
      if (!['approve', 'decline'].includes(body.decision)) throw bad('decision', 'decision must be approve or decline.');
      const row = (await repo.borrowRequests(userId)).find((r) => r.id === id && r.owner_id === userId);
      if (!row) throw errors.notFound('Borrow request');
      if (row.status !== 'pending') throw errors.conflict('DECIDED', 'This request was already answered.');
      if (body.decision === 'approve') {
        await mustBeFriends(userId, row.requester_id);
        const due = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
        await deps.availability.lend(userId, row.item_id, { person: (await repo.displayName(row.requester_id)) || 'A friend', dueOn: body.dueOn || due, note: 'Borrowed through Friends’ closet' });
      }
      await repo.decideBorrow(id, userId, body.decision === 'approve' ? 'approved' : 'declined');
      await log(userId, `Friends: borrow ${body.decision === 'approve' ? 'approved' : 'declined'}`);
      return { id, status: body.decision === 'approve' ? 'approved' : 'declined' };
    },
    // Notification Center entries (read by the intelligence module): requests for me, and answers to mine.
    async notices(userId) {
      const out = [];
      const day = (d) => new Date(d || Date.now()).toISOString().slice(0, 10);
      const recent = (d) => d && Date.now() - new Date(d).getTime() < 14 * 86400000;
      for (const f of await repo.friendships(userId)) {
        if (f.status === 'pending' && f.addressee_id === userId) {
          out.push({ key: `access:${f.id}`, kind: 'friends', type: 'CLOSET_ACCESS_REQUEST', priority: 5, title: 'Closet access request', text: `${await nameOf(f.requester_id)} requested access to your closet.`, link: '#/friends?tab=requests', date: day(f.created_at), action: { label: 'Review', link: '#/friends?tab=requests' } });
        }
        if (f.status === 'accepted' && f.requester_id === userId && recent(f.accepted_at)) {
          out.push({ key: `access-ok:${f.id}`, kind: 'friends', type: 'CLOSET_ACCESS_GIVEN', priority: 4, title: 'Access given', text: `${await nameOf(f.addressee_id)} gave you access to their closet.`, link: '#/friends', date: day(f.accepted_at), action: { label: 'Open closet', link: '#/friends' } });
        }
      }
      for (const r of (await this.requests(userId)).requests) {
        const what = r.piece ? r.piece.name.toLowerCase() : 'a piece';
        if (r.direction === 'incoming' && r.status === 'pending') out.push({ key: `borrow-req:${r.id}`, kind: 'friends', type: 'BORROW_REQUEST', priority: 5, title: 'Borrow request', text: `${r.with} asks to borrow your ${what}.`, link: '#/friends?tab=requests', date: day(r.createdAt), action: { label: 'Review', link: '#/friends?tab=requests' } });
        if (r.direction === 'outgoing' && r.status !== 'pending' && recent(r.decidedAt)) out.push({ key: `borrow-ans:${r.id}`, kind: 'friends', type: 'BORROW_ANSWER', priority: 4, title: r.status === 'approved' ? 'Borrow approved' : 'Borrow declined', text: `${r.with} ${r.status} your request to borrow the ${what}.`, link: '#/friends?tab=requests', date: day(r.decidedAt) });
      }
      return out;
    },
  };
  return {
    methods,
    routes: [
      ['GET', '/friends', (r) => methods.list(r.userId)],
      ['POST', '/friends', (r) => methods.request(r.userId, r.body)],
      ['POST', '/friends/:id/accept', (r) => methods.accept(r.userId, r.params.id)],
      ['DELETE', '/friends/:id', (r) => methods.remove(r.userId, r.params.id)],
      ['GET', '/friends/:friendId/closet', (r) => methods.closet(r.userId, r.params.friendId)],
      ['GET', '/friends/requests', (r) => methods.requests(r.userId)],
      ['POST', '/friends/borrow', (r) => methods.borrow(r.userId, r.body)],
      ['POST', '/friends/requests/:id', (r) => methods.decide(r.userId, r.params.id, r.body)],
    ],
  };
};
