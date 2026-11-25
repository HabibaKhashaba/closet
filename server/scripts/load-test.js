// T-34 / NFR-01 load test: three outfits for a 300-piece closet (engine only, 30 runs over 6 occasions).
// Run: node scripts/load-test.js
const engine = require('../src/modules/recommendation/engine');
const { demoPieces } = require('../src/db/seedData');
const base = demoPieces();
const pieces = []; for (let i = 0; i < 300; i++) { const p = base[i % base.length]; pieces.push({ ...p, id: `${p.id}-${i}`, status: 'Available' }); }
const times = [];
for (const occ of ['Everyday', 'University', 'Work', 'Dinner', 'Party', 'Wedding']) for (let r = 0; r < 5; r++) {
  const t = process.hrtime.bigint(); const out = engine.recommend(pieces, { occasion: occ, prefs: {}, weather: { tempC: 22 }, hiddenIds: [], today: new Date(), signals: {} });
  times.push(Number(process.hrtime.bigint() - t) / 1e6); if (out.outfits.length !== 3) console.log('not 3', occ, out.outfits.length);
}
times.sort((a, b) => a - b); console.log('runs', times.length, 'median ms', times[15].toFixed(1), 'p95', times[28].toFixed(1), 'max', times[29].toFixed(1));
