const fs = require('fs');
const path = require('path');
const config = require('./config');
const { createApp } = require('./app');
const { migrate } = require('./db/migrate');

async function main() {
  await migrate();
  const webDir = path.join(__dirname, '..', '..', 'client', 'dist');
  const app = createApp({ webDir: fs.existsSync(webDir) ? webDir : undefined });
  app.listen(config.port, () => console.log(`Closet API on http://localhost:${config.port}`));
}

main().catch((e) => { console.error(e); process.exit(1); });
