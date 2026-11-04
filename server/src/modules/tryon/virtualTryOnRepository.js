// PostgreSQL repository for Virtual Try-On (migration 008). Every query is scoped by user_id, so a user
// can never read or change another user's try-on: a wrong owner simply finds nothing (→ 404).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLS = { status: 'status', providerJobId: 'provider_job_id', errorCode: 'error_code', errorMessage: 'error_message', resultImageKey: 'result_image_key',
  resultRemoteUrl: 'result_remote_url', saved: 'saved', completedAt: 'completed_at', startedAt: 'started_at', attempts: 'attempts' };

function virtualTryOnRepository(db) {
  return {
    async insert(userId, r) {
      const { rows } = await db.query(
        `INSERT INTO tryon.virtual_try_ons (user_id, outfit_id, outfit_item_ids, wardrobe_item_id, garment_name, garment_category, user_image_key, garment_image_key, status, provider, started_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11, now())) RETURNING *`,
        [userId, r.outfitId || null, r.outfitItemIds || [], r.wardrobeItemId, r.garmentName || null, r.garmentCategory, r.userImageKey, r.garmentImageKey, r.status, r.provider, r.startedAt || null]);
      return rows[0];
    },
    async get(userId, id) {
      if (!UUID.test(String(id))) return null;
      const { rows } = await db.query('SELECT * FROM tryon.virtual_try_ons WHERE id = $1 AND user_id = $2', [id, userId]);
      return rows[0] || null;
    },
    async update(userId, id, changes) {
      const sets = []; const vals = [id, userId];
      for (const [k, col] of Object.entries(COLS)) if (k in changes) { vals.push(changes[k]); sets.push(`${col} = $${vals.length}`); }
      if (!sets.length) return this.get(userId, id);
      const { rows } = await db.query(`UPDATE tryon.virtual_try_ons SET ${sets.join(', ')}, updated_at = now() WHERE id = $1 AND user_id = $2 RETURNING *`, vals);
      return rows[0] || null;
    },
    async list(userId, { savedOnly = false, limit = 30 } = {}) {
      const { rows } = await db.query('SELECT * FROM tryon.virtual_try_ons WHERE user_id = $1 AND ($2::boolean IS FALSE OR saved) ORDER BY created_at DESC LIMIT $3', [userId, savedOnly, limit]);
      return rows;
    },
    async remove(userId, id) {
      if (!UUID.test(String(id))) return null;
      const { rows } = await db.query('DELETE FROM tryon.virtual_try_ons WHERE id = $1 AND user_id = $2 RETURNING *', [id, userId]);
      return rows[0] || null;
    },
    async countSince(userId, since) {
      const { rows } = await db.query('SELECT count(*)::int AS n FROM tryon.virtual_try_ons WHERE user_id = $1 AND started_at >= $2', [userId, since]);
      return rows[0].n;
    },
    async countActive(userId) {
      const { rows } = await db.query("SELECT count(*)::int AS n FROM tryon.virtual_try_ons WHERE user_id = $1 AND status IN ('PENDING', 'PROCESSING')", [userId]);
      return rows[0].n;
    },
    async keysOf(userId) {
      const { rows } = await db.query('SELECT user_image_key, result_image_key FROM tryon.virtual_try_ons WHERE user_id = $1', [userId]);
      const p = await db.query('SELECT photo_key FROM tryon.user_photos WHERE user_id = $1', [userId]);
      return [...rows.flatMap((r) => [r.user_image_key, r.result_image_key]), ...p.rows.map((r) => r.photo_key)].filter(Boolean);
    },
    // saved try-on photo
    async getPhoto(userId) {
      const { rows } = await db.query('SELECT * FROM tryon.user_photos WHERE user_id = $1', [userId]);
      return rows[0] || null;
    },
    async setPhoto(userId, photoKey) {
      const { rows } = await db.query(
        `INSERT INTO tryon.user_photos (user_id, photo_key, consent_at) VALUES ($1, $2, now())
         ON CONFLICT (user_id) DO UPDATE SET photo_key = EXCLUDED.photo_key, consent_at = now(), updated_at = now() RETURNING *`, [userId, photoKey]);
      return rows[0];
    },
    async deletePhoto(userId) {
      const { rows } = await db.query('DELETE FROM tryon.user_photos WHERE user_id = $1 RETURNING *', [userId]);
      return rows[0] || null;
    },
  };
}

module.exports = { virtualTryOnRepository };
