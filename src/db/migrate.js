// Applies every .sql file in /migrations once, in name order.
const fs = require('fs');
const path = require('path');
const { pool } = require('./pool');

async function migrate(db = pool) {
  await db.query('CREATE TABLE IF NOT EXISTS public.schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT now())');
  const dir = path.join(__dirname, '..', '..', 'migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const { rows } = await db.query('SELECT name FROM public.schema_migrations');
  const done = new Set(rows.map((r) => r.name));
  for (const file of files) {
    if (done.has(file)) continue;
    await db.query(fs.readFileSync(path.join(dir, file), 'utf8'));
    await db.query('INSERT INTO public.schema_migrations (name) VALUES ($1)', [file]);
    console.log(`applied ${file}`);
  }
}

if (require.main === module) {
  migrate().then(() => pool.end()).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { migrate };
