// Repository: the only code that reads or writes accounts.users.
function identityRepository(db) {
  const columns = 'id, email, password_hash, google_id, role, account_status, token_version, failed_logins, locked_until';
  return {
    async findByEmail(email) {
      const { rows } = await db.query(`SELECT ${columns} FROM accounts.users WHERE email = $1`, [email]);
      return rows[0] || null;
    },
    async findById(id) {
      const { rows } = await db.query(`SELECT ${columns} FROM accounts.users WHERE id = $1`, [id]);
      return rows[0] || null;
    },
    async findByGoogleId(googleId) {
      const { rows } = await db.query(`SELECT ${columns} FROM accounts.users WHERE google_id = $1`, [googleId]);
      return rows[0] || null;
    },
    async create({ email, passwordHash = null, googleId = null }) {
      const { rows } = await db.query(
        `INSERT INTO accounts.users (email, password_hash, google_id) VALUES ($1, $2, $3) RETURNING ${columns}`,
        [email, passwordHash, googleId],
      );
      return rows[0];
    },
    async linkGoogle(id, googleId) {
      await db.query('UPDATE accounts.users SET google_id = $2 WHERE id = $1', [id, googleId]);
    },
    async recordFailure(id, maxFailures, lockMinutes) {
      // After the 5th failure in a row the account is locked for 15 minutes.
      const { rows } = await db.query(
        `UPDATE accounts.users
            SET failed_logins = failed_logins + 1,
                locked_until = CASE WHEN failed_logins + 1 >= $2 THEN now() + ($3 || ' minutes')::interval ELSE locked_until END
          WHERE id = $1 RETURNING failed_logins, locked_until`,
        [id, maxFailures, String(lockMinutes)],
      );
      return rows[0];
    },
    async resetFailures(id) {
      await db.query('UPDATE accounts.users SET failed_logins = 0, locked_until = NULL WHERE id = $1', [id]);
    },
    async bumpTokenVersion(id) {
      await db.query('UPDATE accounts.users SET token_version = token_version + 1 WHERE id = $1', [id]);
    },
    async delete(id) {
      await db.query('DELETE FROM accounts.users WHERE id = $1', [id]);
    },
  };
}

module.exports = { identityRepository };
