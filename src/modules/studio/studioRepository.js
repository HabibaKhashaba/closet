// Studio repository (v3.0): friendships, lendable pieces, borrow requests and battle votes.
// PostgreSQL version + an in-memory version with the same methods (offline demo, unit tests).
const pick = (r) => (r ? { ...r } : null);

function studioRepository(db) {
  const one = async (sql, args) => (await db.query(sql, args)).rows[0] || null;
  const all = async (sql, args) => (await db.query(sql, args)).rows;
  return {
    async userByEmail(email) { return one('SELECT id, email FROM accounts.users WHERE lower(email) = lower($1)', [email]); },
    async displayName(userId) {
      const r = await one('SELECT u.email, p.display_name FROM accounts.users u LEFT JOIN profile.profiles p ON p.user_id = u.id WHERE u.id = $1', [userId]);
      return r ? (r.display_name || r.email.split('@')[0].split('.')[0].replace(/^./, (c) => c.toUpperCase())) : null;
    },
    async friendships(userId) { return all('SELECT * FROM studio.friendships WHERE requester_id = $1 OR addressee_id = $1 ORDER BY created_at DESC', [userId]); },
    async pair(a, b) { return one('SELECT * FROM studio.friendships WHERE (requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1)', [a, b]); },
    async request(from, to) { return one('INSERT INTO studio.friendships (requester_id, addressee_id) VALUES ($1, $2) RETURNING *', [from, to]); },
    async accept(id, userId) { return one("UPDATE studio.friendships SET status = 'accepted', accepted_at = now() WHERE id = $1 AND addressee_id = $2 AND status = 'pending' RETURNING *", [id, userId]); },
    async remove(id, userId) { return one('DELETE FROM studio.friendships WHERE id = $1 AND (requester_id = $2 OR addressee_id = $2) RETURNING *', [id, userId]); },
    async setLendable(userId, itemId, on) {
      if (on) await db.query('INSERT INTO studio.lendable (item_id, user_id) VALUES ($1, $2) ON CONFLICT (item_id) DO NOTHING', [itemId, userId]);
      else await db.query('DELETE FROM studio.lendable WHERE item_id = $1 AND user_id = $2', [itemId, userId]);
    },
    async lendableIds(userId) { return (await all('SELECT item_id FROM studio.lendable WHERE user_id = $1', [userId])).map((r) => r.item_id); },
    async createBorrow(r) { return one('INSERT INTO studio.borrow_requests (item_id, owner_id, requester_id) VALUES ($1, $2, $3) RETURNING *', [r.itemId, r.ownerId, r.requesterId]); },
    async borrowRequests(userId) { return all('SELECT * FROM studio.borrow_requests WHERE owner_id = $1 OR requester_id = $1 ORDER BY created_at DESC LIMIT 50', [userId]); },
    async openBorrow(itemId, requesterId) { return one("SELECT * FROM studio.borrow_requests WHERE item_id = $1 AND requester_id = $2 AND status = 'pending'", [itemId, requesterId]); },
    async decideBorrow(id, ownerId, status) { return one("UPDATE studio.borrow_requests SET status = $3, decided_at = now() WHERE id = $1 AND owner_id = $2 AND status = 'pending' RETURNING *", [id, ownerId, status]); },
    async vote(userId, v) { return one('INSERT INTO studio.battle_votes (user_id, occasion, winner, item_ids) VALUES ($1, $2, $3, $4) RETURNING id', [userId, v.occasion, v.winner, v.itemIds]); },
    async cherFeedback(userId, f) { return one('INSERT INTO studio.cher_feedback (user_id, item_ids, score, action) VALUES ($1, $2, $3, $4) RETURNING id', [userId, f.itemIds, f.score, f.action]); },
    async votes(userId) { return all('SELECT winner, count(*)::int AS n FROM studio.battle_votes WHERE user_id = $1 GROUP BY winner', [userId]); },
  };
}

function memoryStudioRepository(S) {
  S.friendships = S.friendships || []; S.lendable = S.lendable || []; S.borrowRequests = S.borrowRequests || []; S.battleVotes = S.battleVotes || [];
  const uuid = () => { S.seq.uuid = (S.seq.uuid || 0) + 1; return `00000000-0000-4000-8000-${String(S.seq.uuid).padStart(12, '0')}`; };
  const pairOf = (a, b) => S.friendships.find((f) => (f.requester_id === a && f.addressee_id === b) || (f.requester_id === b && f.addressee_id === a)) || null;
  return {
    async userByEmail(email) { const u = S.users.find((x) => x.email.toLowerCase() === String(email).toLowerCase()); return u ? { id: u.id, email: u.email } : null; },
    async displayName(userId) {
      const u = S.users.find((x) => x.id === userId); if (!u) return null;
      const p = S.profiles.get(userId);
      return (p && p.display_name) || u.email.split('@')[0].split('.')[0].replace(/^./, (c) => c.toUpperCase());
    },
    async friendships(userId) { return S.friendships.filter((f) => f.requester_id === userId || f.addressee_id === userId).map(pick); },
    async pair(a, b) { return pick(pairOf(a, b)); },
    async request(from, to) { if (pairOf(from, to)) throw Object.assign(new Error('duplicate'), { code: '23505' }); const r = { id: uuid(), requester_id: from, addressee_id: to, status: 'pending', created_at: new Date(), accepted_at: null }; S.friendships.push(r); return pick(r); },
    async accept(id, userId) { const f = S.friendships.find((x) => x.id === id && x.addressee_id === userId && x.status === 'pending'); if (!f) return null; f.status = 'accepted'; f.accepted_at = new Date(); return pick(f); },
    async remove(id, userId) { const i = S.friendships.findIndex((x) => x.id === id && (x.requester_id === userId || x.addressee_id === userId)); if (i < 0) return null; return pick(S.friendships.splice(i, 1)[0]); },
    async setLendable(userId, itemId, on) {
      const i = S.lendable.findIndex((x) => x.item_id === itemId && x.user_id === userId);
      if (on && i < 0) S.lendable.push({ item_id: itemId, user_id: userId, created_at: new Date() });
      if (!on && i >= 0) S.lendable.splice(i, 1);
    },
    async lendableIds(userId) { return S.lendable.filter((x) => x.user_id === userId && S.items.some((it) => it.id === x.item_id)).map((x) => x.item_id); },
    async createBorrow(r) { const row = { id: uuid(), item_id: r.itemId, owner_id: r.ownerId, requester_id: r.requesterId, status: 'pending', created_at: new Date(), decided_at: null }; S.borrowRequests.push(row); return pick(row); },
    async borrowRequests(userId) { return S.borrowRequests.filter((x) => x.owner_id === userId || x.requester_id === userId).sort((a, b) => b.created_at - a.created_at).slice(0, 50).map(pick); },
    async openBorrow(itemId, requesterId) { return pick(S.borrowRequests.find((x) => x.item_id === itemId && x.requester_id === requesterId && x.status === 'pending')); },
    async decideBorrow(id, ownerId, status) { const r = S.borrowRequests.find((x) => x.id === id && x.owner_id === ownerId && x.status === 'pending'); if (!r) return null; r.status = status; r.decided_at = new Date(); return pick(r); },
    async vote(userId, v) { const r = { id: S.battleVotes.length + 1, user_id: userId, occasion: v.occasion, winner: v.winner, item_ids: v.itemIds, created_at: new Date() }; S.battleVotes.push(r); return { id: r.id }; },
    async cherFeedback(userId, f) { S.cherFeedback = S.cherFeedback || []; S.cherFeedback.push({ id: S.cherFeedback.length + 1, user_id: userId, item_ids: f.itemIds, score: f.score, action: f.action, created_at: new Date() }); return { id: S.cherFeedback.length }; },
    async votes(userId) { const c = {}; S.battleVotes.filter((x) => x.user_id === userId).forEach((x) => { c[x.winner] = (c[x.winner] || 0) + 1; }); return Object.entries(c).map(([winner, n]) => ({ winner, n })); },
  };
}

module.exports = { studioRepository, memoryStudioRepository };
