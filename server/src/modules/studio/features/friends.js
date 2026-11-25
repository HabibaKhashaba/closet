// Feature 10 — Friends' closet (security-critical).
// Rules, all enforced HERE on the server:
//   · friendship is mutual: a request must be accepted by the other person
//   · a friend sees ONLY pieces the owner marked lendable AND that are Available right now
//   · a friend sees only photo, category, colour, name and the owner's first name — never wear history,
//     status notes, prices, other pieces or anything else
//   · every other access → 403 (not friends) or 404 (no such piece / not lendable)
//   · approving a borrow request runs the existing Borrow & lend flow (the piece becomes Lent)
//   · security log: friend actions go to the activity log, without garment details
const { bad, errors } = require('../context');

const shared = (p, ownerName) => ({ id: p.id, name: p.name, category: p.category, colour: p.colour, photoUrl: p.photoUrl || null, owner: ownerName });

module.exports = function friends(deps) {
  const repo = deps.repo;
  const log = (userId, action) => deps.activity().record(userId, action).catch(() => {});
  async function friendIds(userId) {
    return (await repo.friendships(userId)).filter((f) => f.status === 'accepted').map((f) => (f.requester_id === userId ? f.addressee_id : f.requester_id));
  }
  async function mustBeFriends(userId, friendId) {
    const f = typeof friendId === 'string' && /^[0-9a-f-]{36}$/i.test(friendId) && friendId !== userId ? await repo.pair(userId, friendId) : null;
    if (!f || f.status !== 'accepted') { await log(userId, 'Friends: access denied'); throw errors.forbidden(); }
  }
  async function lendableOf(ownerId) {
    const ids = new Set(await repo.lendableIds(ownerId));
    if (!ids.size) return [];
    return (await deps.wardrobe().allPieces(ownerId)).filter((p) => ids.has(p.id) && p.status === 'Available');
  }

  const methods = {
    async list(userId) {
      const rows = await repo.friendships(userId);
      const out = { friends: [], incoming: [], outgoing: [] };
      for (const f of rows) {
        const other = f.requester_id === userId ? f.addressee_id : f.requester_id;
        const row = { id: f.id, userId: other, name: await repo.displayName(other), since: f.accepted_at || f.created_at };
        if (f.status === 'accepted') out.friends.push(row);
        else if (f.addressee_id === userId) out.incoming.push(row);
        else out.outgoing.push(row);
      }
      out.lendableIds = await repo.lendableIds(userId);
      return out;
    },
    async request(userId, body = {}) {
      const email = String(body.email || '').trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw bad('email', 'Enter your friend’s email.');
      const other = await repo.userByEmail(email);
      // the same answer whether or not the account exists (no account discovery)
      if (other && other.id !== userId && !(await repo.pair(userId, other.id))) await repo.request(userId, other.id);
      await log(userId, 'Friends: request sent');
      return { sent: true, message: 'If this person has a Closet account, they will see your request.' };
    },
    async accept(userId, id) {
      const f = await repo.accept(id, userId);
      if (!f) throw errors.notFound('Friend request');
      await log(userId, 'Friends: request accepted');
      return { accepted: true };
    },
    async remove(userId, id) {
      if (!(await repo.remove(id, userId))) throw errors.notFound('Friend');
      await log(userId, 'Friends: removed');
      return { removed: true };
    },
    async setLendable(userId, itemId, on) {
      const own = await deps.wardrobe().piecesByIds(userId, [itemId]);
      if (!own.length) throw errors.notFound('Piece');
      await repo.setLendable(userId, itemId, !!on);
      return { itemId, lendable: !!on };
    },
    async closet(userId, friendId) {
      await mustBeFriends(userId, friendId);
      const name = (await repo.displayName(friendId) || 'Friend').split(' ')[0];
      return { friend: { userId: friendId, name }, items: (await lendableOf(friendId)).map((p) => shared(p, name)) };
    },
    // every piece the user's friends can lend right now (used by Recreate this look)
    async borrowable(userId) {
      const out = [];
      for (const fid of await friendIds(userId)) {
        const name = (await repo.displayName(fid) || 'Friend').split(' ')[0];
        out.push(...(await lendableOf(fid)).map((p) => ({ ...shared(p, name), ownerId: fid })));
      }
      return out;
    },
    async borrow(userId, body = {}) {
      const { friendId, itemId } = body;
      await mustBeFriends(userId, friendId);
      if (!(await lendableOf(friendId)).some((p) => p.id === itemId)) throw errors.notFound('Piece');
      const open = await repo.openBorrow(itemId, userId);
      if (open) return { request: { id: open.id, status: open.status }, existing: true };
      const r = await repo.createBorrow({ itemId, ownerId: friendId, requesterId: userId });
      await log(userId, 'Friends: borrow requested');
      return { request: { id: r.id, status: r.status }, existing: false };
    },
    async requests(userId) {
      const rows = await repo.borrowRequests(userId);
      const out = [];
      for (const r of rows) {
        const mine = r.owner_id === userId;
        const piece = mine ? (await deps.wardrobe().piecesByIds(userId, [r.item_id]))[0] : null;
        const other = mine ? r.requester_id : r.owner_id;
        out.push({ id: r.id, direction: mine ? 'incoming' : 'outgoing', status: r.status, with: (await repo.displayName(other) || 'Friend').split(' ')[0], createdAt: r.created_at,
          piece: mine ? (piece && shared(piece, null)) : null });
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
        const name = (await repo.displayName(row.requester_id)) || 'A friend';
        const due = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
        await deps.availability.lend(userId, row.item_id, { person: name, dueOn: body.dueOn || due, note: 'Borrowed through Friends’ closet' });
      }
      await repo.decideBorrow(id, userId, body.decision === 'approve' ? 'approved' : 'declined');
      await log(userId, `Friends: borrow ${body.decision === 'approve' ? 'approved' : 'declined'}`);
      return { id, status: body.decision === 'approve' ? 'approved' : 'declined' };
    },
  };
  return {
    methods,
    routes: [
      ['GET', '/friends', (r) => methods.list(r.userId)],
      ['POST', '/friends', (r) => methods.request(r.userId, r.body)],
      ['POST', '/friends/:id/accept', (r) => methods.accept(r.userId, r.params.id)],
      ['DELETE', '/friends/:id', (r) => methods.remove(r.userId, r.params.id)],
      ['PUT', '/friends/lendable/:itemId', (r) => methods.setLendable(r.userId, r.params.itemId, r.body && r.body.lendable !== false)],
      ['GET', '/friends/:friendId/closet', (r) => methods.closet(r.userId, r.params.friendId)],
      ['GET', '/friends/requests', (r) => methods.requests(r.userId)],
      ['POST', '/friends/borrow', (r) => methods.borrow(r.userId, r.body)],
      ['POST', '/friends/requests/:id', (r) => methods.decide(r.userId, r.params.id, r.body)],
    ],
  };
};
