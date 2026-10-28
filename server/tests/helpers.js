// Shared test helpers. API tests run against a real PostgreSQL test database
// (DATABASE_URL_TEST), which is emptied before every test.
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');
const { pool, transaction } = require('../src/db/pool');
const { migrate } = require('../src/db/migrate');
const { createApp } = require('../src/app');
const { localPhotoStorage } = require('../src/modules/wardrobe/photoStorage');
const { llmAdapter } = require('../src/modules/assistant/llmAdapter');

// A fake weather service: tests set the temperature they need (no network in tests).
const weatherState = { tempC: 24 };
const fakeWeather = { async forDate(city, date) { return { date, place: city || 'Test City', tempC: weatherState.tempC, high: weatherState.tempC, low: weatherState.tempC - 8, condition: 'Clear', source: 'test' }; } };

const photoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'closet-photos-'));
const storage = localPhotoStorage({ dir: photoDir, secret: 'test-photo-secret' });

// A fake Google verifier: the "credential" is just "google:<sub>:<email>".
const fakeGoogle = async (credential) => {
  const [kind, sub, email] = String(credential).split(':');
  return kind === 'google' && sub && email ? { sub, email } : null;
};

function makeApp() {
  return createApp({ db: { pool, transaction }, storage, googleVerifier: fakeGoogle, weather: fakeWeather, parser: llmAdapter({ env: {} }) });
}

async function resetDb() {
  await migrate(pool);
  await pool.query(`TRUNCATE accounts.users, profile.profiles, wardrobe.items, availability.item_status,
                    availability.status_history, planner.events CASCADE`);
}

// A tiny JPEG: SOI, an APP1 "Exif" block holding fake GPS text, a comment, SOS, image bytes, EOI.
function jpegWithExif(extraBytes = 0) {
  const exifPayload = Buffer.from('Exif\0\0GPS:30.0444N,31.2357E');
  const app1 = Buffer.concat([Buffer.from([0xff, 0xe1]), u16(exifPayload.length + 2), exifPayload]);
  const comment = Buffer.concat([Buffer.from([0xff, 0xfe]), u16(7), Buffer.from('hello')]);
  const sos = Buffer.from([0xff, 0xda, 0x00, 0x08, 1, 1, 0, 0, 0x3f, 0]);
  const body = Buffer.alloc(16 + extraBytes, 0x55);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app1, comment, sos, body, Buffer.from([0xff, 0xd9])]);
}
function u16(n) { const b = Buffer.alloc(2); b.writeUInt16BE(n); return b; }

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32, 1)]);

async function registerUser(app, email = 'salma@example.com', password = 'Closet2026!') {
  const res = await request(app).post('/api/v1/auth/register').send({ email, password });
  return { token: res.body.token, user: res.body.user, email, password };
}

function addPiece(app, token, details = {}, photo = jpegWithExif()) {
  const d = { category: 'Top', colour: 'Black', dressCodes: [1], ...details };
  return request(app).post('/api/v1/items').set('Authorization', `Bearer ${token}`)
    .field('details', JSON.stringify(d))
    .attach('photo', photo, { filename: 'piece.jpg', contentType: 'image/jpeg' });
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });

module.exports = { weatherState, makeApp, resetDb, pool, storage, photoDir, jpegWithExif, PNG, registerUser, addPiece, auth };
