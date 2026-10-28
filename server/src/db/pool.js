const { Pool, types } = require('pg');
const config = require('../config');

// Keep DATE columns as 'YYYY-MM-DD' text so time zones never shift an event's day.
types.setTypeParser(1082, (value) => value);

const pool = new Pool({
  connectionString: config.databaseUrl,
  // Hosted databases need TLS; a local database does not.
  ssl: /sslmode=require/.test(config.databaseUrl) ? { rejectUnauthorized: false } : undefined,
});

// Runs fn inside one transaction; rolls back if anything throws.
async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { pool, transaction };
