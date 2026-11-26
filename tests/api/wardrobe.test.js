// API tests: add a piece by photo, details, browse/filter, edit, photo privacy, ownership (US-08, 09, 11, 12, 71).
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { makeApp, resetDb, pool, registerUser, addPiece, auth, jpegWithExif, PNG, photoDir } = require('../helpers');

const app = makeApp();
let salma;
beforeEach(async () => { await resetDb(); salma = await registerUser(app); });
afterAll(() => pool.end());

describe('Add a piece (US-08, US-09, US-11)', () => {
  test('API-W01 photo + details → 201, saved once, status Available', async () => {
    const res = await addPiece(app, salma.token, { category: 'Dress', colour: 'Navy', fabric: 'Silk', season: 'Summer', size: 'M', styles: ['Elegant'], dressCodes: [4, 5], modest: true });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ category: 'Dress', colour: 'Navy', dressCodes: [4, 5], modest: true, status: 'Available' });
    const { rows } = await pool.query('SELECT status FROM availability.item_status WHERE item_id = $1', [res.body.id]);
    expect(rows[0].status).toBe('Available');
  });
  test('API-W02 the photo is stored and shown through its signed URL', async () => {
    const res = await addPiece(app, salma.token);
    const photo = await request(app).get(res.body.photoUrl);
    expect(photo.status).toBe(200);
    expect(photo.headers['content-type']).toMatch(/image\/jpeg/);
  });
  test('API-W03 location (EXIF) data is removed before the photo is stored', async () => {
    await addPiece(app, salma.token);
    const [file] = fs.readdirSync(photoDir).filter((f) => f.endsWith('.jpg')).map((f) => path.join(photoDir, f))
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    expect(fs.readFileSync(file).toString('latin1')).not.toContain('GPS');
  });
  test('API-W04 PNG is accepted', async () => {
    const res = await request(app).post('/api/v1/items').set(auth(salma.token))
      .field('details', JSON.stringify({ category: 'Shoes', colour: 'White', dressCodes: [1] }))
      .attach('photo', PNG, { filename: 'shoes.png', contentType: 'image/png' });
    expect(res.status).toBe(201);
  });
  test('API-W05 no photo → 400 and nothing saved', async () => {
    const res = await request(app).post('/api/v1/items').set(auth(salma.token))
      .field('details', JSON.stringify({ category: 'Top', colour: 'Black', dressCodes: [1] }));
    expect(res.status).toBe(400);
    expect((await pool.query('SELECT count(*)::int AS n FROM wardrobe.items')).rows[0].n).toBe(0);
  });
  test('API-W06 a PDF renamed to .jpg → 415', async () => {
    const res = await request(app).post('/api/v1/items').set(auth(salma.token))
      .field('details', JSON.stringify({ category: 'Top', colour: 'Black', dressCodes: [1] }))
      .attach('photo', Buffer.from('%PDF-1.7 not an image at all'), { filename: 'top.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(415);
  });
  test('API-W07 photo of exactly 10 MB is accepted (boundary)', async () => {
    const tenMb = jpegWithExif(10 * 1024 * 1024 - jpegWithExif().length);
    expect(tenMb.length).toBe(10 * 1024 * 1024);
    expect((await addPiece(app, salma.token, {}, tenMb)).status).toBe(201);
  });
  test('API-W08 photo of 10 MB + 1 byte → 413 (boundary)', async () => {
    const tooBig = jpegWithExif(10 * 1024 * 1024 - jpegWithExif().length + 1);
    expect((await addPiece(app, salma.token, {}, tooBig)).status).toBe(413);
  });
  test('API-W09 missing category and no dress-code level → 400, photo not kept', async () => {
    const before = fs.readdirSync(photoDir).length;
    const res = await addPiece(app, salma.token, { category: undefined, dressCodes: [] });
    expect(res.status).toBe(400);
    expect(res.body.details.map((d) => d.field).sort()).toEqual(['category', 'dressCodes']);
    expect(fs.readdirSync(photoDir).length).toBe(before);
  });
  test('API-W10 details that are not JSON → 400', async () => {
    const res = await request(app).post('/api/v1/items').set(auth(salma.token))
      .field('details', '{not json').attach('photo', jpegWithExif(), 'a.jpg');
    expect(res.status).toBe(400);
  });
});

describe('Browse and filter (US-12)', () => {
  beforeEach(async () => {
    const ids = [];
    for (const [category, colour] of [['Top', 'Black'], ['Top', 'White'], ['Bottom', 'Blue'], ['Shoes', 'Black']]) {
      ids.push((await addPiece(app, salma.token, { category, colour })).body.id);
    }
    await request(app).patch(`/api/v1/items/${ids[0]}/status`).set(auth(salma.token)).send({ status: 'Laundry' });
  });
  test('API-W11 all pieces with counts', async () => {
    const res = await request(app).get('/api/v1/items').set(auth(salma.token));
    expect(res.body.total).toBe(4);
    expect(res.body.counts.category).toMatchObject({ Top: 2, Bottom: 1, Shoes: 1, Dress: 0 });
    expect(res.body.counts.status).toMatchObject({ Available: 3, Laundry: 1 });
  });
  test('API-W12 filters combine: Top AND Available', async () => {
    const res = await request(app).get('/api/v1/items?category=Top&status=Available').set(auth(salma.token));
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({ category: 'Top', colour: 'White', status: 'Available' });
    expect(res.body.counts.status.Laundry).toBe(1); // counts update with the category filter
    expect(res.body.counts.category.Top).toBe(1); // ...and with the status filter
  });
  test('API-W13 invalid filter value → 400', async () => {
    expect((await request(app).get('/api/v1/items?status=Lost').set(auth(salma.token))).status).toBe(400);
  });
});

describe('Edit later (US-71)', () => {
  test('API-W14 edit changes the details and appears in filters', async () => {
    const { id } = (await addPiece(app, salma.token, { category: 'Top', colour: 'Black', size: 'M' })).body;
    const res = await request(app).patch(`/api/v1/items/${id}`).set(auth(salma.token)).send({ colour: 'Red', dressCodes: [2, 3], size: null });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ colour: 'Red', dressCodes: [2, 3], size: null, category: 'Top' });
    const list = await request(app).get('/api/v1/items?category=Top').set(auth(salma.token));
    expect(list.body.items[0].colour).toBe('Red');
  });
  test('API-W15 invalid edit → 400 and nothing changes', async () => {
    const { id } = (await addPiece(app, salma.token)).body;
    expect((await request(app).patch(`/api/v1/items/${id}`).set(auth(salma.token)).send({ dressCodes: [] })).status).toBe(400);
    expect((await request(app).get(`/api/v1/items/${id}`).set(auth(salma.token))).body.dressCodes).toEqual([1]);
  });
});

describe('Ownership and photo privacy (NFR-04, NFR-05)', () => {
  test('API-W16 another user cannot read, edit or change the status of my piece (404)', async () => {
    const { id } = (await addPiece(app, salma.token)).body;
    const karim = await registerUser(app, 'karim@example.com');
    expect((await request(app).get(`/api/v1/items/${id}`).set(auth(karim.token))).status).toBe(404);
    expect((await request(app).patch(`/api/v1/items/${id}`).set(auth(karim.token)).send({ colour: 'Red' })).status).toBe(404);
    expect((await request(app).patch(`/api/v1/items/${id}/status`).set(auth(karim.token)).send({ status: 'Borrowed' })).status).toBe(404);
    expect((await request(app).get('/api/v1/items').set(auth(karim.token))).body.total).toBe(0);
    expect((await request(app).get(`/api/v1/items/${id}`).set(auth(salma.token))).body.colour).toBe('Black');
  });
  test('API-W17 photo URL with a changed signature or no signature → 404', async () => {
    const { photoUrl } = (await addPiece(app, salma.token)).body;
    expect((await request(app).get(photoUrl.replace(/sig=.{4}/, 'sig=AAAA'))).status).toBe(404);
    expect((await request(app).get(photoUrl.split('?')[0])).status).toBe(404);
  });
  test('API-W18 a malformed piece id → 404, not a server error', async () => {
    expect((await request(app).get('/api/v1/items/1%27%20OR%201=1').set(auth(salma.token))).status).toBe(404);
  });
});
