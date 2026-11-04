// US-118 Virtual Try-On (image-based, one garment): providers, image checks and the service rules.
// Runs without a database or network: in-memory repository, fake storage, fake wardrobe/outfits, fake fetch.
const { virtualTryOnService } = require('../../src/modules/tryon/virtualTryOnService');
const { fashnProvider } = require('../../src/modules/tryon/providers/fashnProvider');
const { mockProvider } = require('../../src/modules/tryon/providers/mockProvider');
const { createProvider } = require('../../src/modules/tryon/providers');
const { ProviderError, STATUS, assertProvider } = require('../../src/modules/tryon/providers/VirtualTryOnProvider');
const { imageSize, checkImage, supportedCategories } = require('../../src/modules/tryon/imageChecks');
const { memoryRepositories } = require('../../src/db/memoryRepositories');
const { AppError } = require('../../src/shared/errors');

// A PNG header with real IHDR width/height (enough for the type and size checks).
function png(w = 800, h = 1200) {
  const b = Buffer.alloc(64, 0);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]).copy(b, 0);
  b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20);
  return b;
}
const pdf = Buffer.from('%PDF-1.4 not an image at all');
const reply = (status, body) => ({ ok: status < 400, status, json: async () => body, arrayBuffer: async () => png(768, 1024) });

const ALICE = '00000000-0000-4000-8000-0000000a11ce';
const BOB = '00000000-0000-4000-8000-000000000b0b';
const TOP = '00000000-0000-4000-8000-0000000000a1';
const SHOES = '00000000-0000-4000-8000-0000000000a2';
const TINY = '00000000-0000-4000-8000-0000000000a3';
const NOPHOTO = '00000000-0000-4000-8000-0000000000a4';
const DRESS = '00000000-0000-4000-8000-0000000000a5';

function world({ provider = mockProvider({ delayMs: 0 }), settings = {}, fetchImpl } = {}) {
  let t = Date.parse('2026-11-02T10:00:00Z');
  const clock = { now: () => t, advance: (ms) => { t += ms; } };
  const files = new Map();
  let n = 0;
  const storage = {
    async save(buf, mime) { n += 1; const key = `k${n}.${mime.split('/')[1]}`; files.set(key, buf); return key; },
    async read(key) { if (!files.has(key)) throw new Error('ENOENT'); return files.get(key); },
    async remove(key) { files.delete(key); },
    signedUrl: (key) => `/api/v1/photos/${key}?exp=1&sig=x`,
  };
  files.set('top.png', png(600, 800)); files.set('shoes.png', png(600, 600)); files.set('tiny.png', png(90, 90)); files.set('dress.png', png(500, 900));
  const pieces = {
    [TOP]: { id: TOP, user: ALICE, name: 'White blouse', category: 'Top', colour: 'White', key: 'top.png' },
    [SHOES]: { id: SHOES, user: ALICE, name: 'Loafers', category: 'Shoes', colour: 'Black', key: 'shoes.png' },
    [TINY]: { id: TINY, user: ALICE, name: 'Tiny photo top', category: 'Top', colour: 'Red', key: 'tiny.png' },
    [NOPHOTO]: { id: NOPHOTO, user: ALICE, name: 'Lost photo jacket', category: 'Layer', colour: 'Beige', key: 'missing.png' },
    [DRESS]: { id: DRESS, user: BOB, name: 'Bob’s dress', category: 'Dress', colour: 'Navy', key: 'dress.png' },
  };
  const notFound = (w) => new AppError(404, 'NOT_FOUND', `${w} not found.`);
  const wardrobe = {
    async getPiece(u, id) { const p = pieces[id]; if (!p || p.user !== u) throw notFound('Piece'); return { ...p, photoUrl: storage.signedUrl(p.key) }; },
    async photoKey(u, id) { const p = pieces[id]; if (!p || p.user !== u) throw notFound('Piece'); return p.key; },
  };
  const outfits = { async get(u, id) { if (id === '00000000-0000-4000-8000-00000000f001' && u === ALICE) return { id }; throw notFound('Outfit'); } };
  const repo = memoryRepositories().virtualTryOn;
  const svc = virtualTryOnService({ repo, provider, wardrobe: () => wardrobe, outfits: () => outfits, storage, now: clock.now, fetchImpl,
    settings: { dailyLimit: 5, maxActive: 2, timeoutMs: 180000, minCheckMs: 0, maxPhotoBytes: 10e6, maxResultBytes: 15e6, minPhotoSide: 300, minGarmentSide: 200, categories: ['Top', 'Layer', 'Dress'], ...settings } });
  return { svc, files, clock, repo };
}
const photo = (w, h) => ({ buffer: png(w, h) });
const start = (svc, extra = {}) => svc.create(ALICE, { wardrobeItemId: TOP, file: photo(800, 1200), consent: true, ...extra });

describe('Providers (VirtualTryOnProvider contract)', () => {
  test('VT-01 FASHN: submits the person photo + garment with the category and returns the job id', async () => {
    const calls = [];
    const p = fashnProvider({ apiKey: 'k', fetchImpl: async (url, o) => { calls.push([url, o]); return reply(200, { id: 'job-1', error: null }); } });
    expect(p.enabled).toBe(true);
    expect(await p.generateTryOn({ personImage: 'data:image/png;base64,AA', garmentImage: 'data:image/png;base64,BB', category: 'tops' })).toEqual({ jobId: 'job-1' });
    expect(calls[0][0]).toBe('https://api.fashn.ai/v1/run');
    expect(calls[0][1].headers.Authorization).toBe('Bearer k');
    expect(JSON.parse(calls[0][1].body)).toEqual({ model_name: 'tryon-v1.6', inputs: { model_image: 'data:image/png;base64,AA', garment_image: 'data:image/png;base64,BB', category: 'tops' } });
  });
  test('VT-02 FASHN: status maps processing → PROCESSING, completed → COMPLETED + result URL, failed → FAILED', async () => {
    const answers = [{ status: 'in_queue' }, { status: 'completed', output: ['https://cdn.fashn.ai/out.png'] }, { status: 'failed', error: { message: 'pose not detected' } }];
    const p = fashnProvider({ apiKey: 'k', fetchImpl: async () => reply(200, answers.shift()) });
    expect(await p.getStatus('j')).toEqual({ status: STATUS.PROCESSING });
    expect(await p.getStatus('j')).toEqual({ status: STATUS.COMPLETED });
    expect(await p.getResult('j')).toEqual({ imageUrl: 'https://cdn.fashn.ai/out.png' });
    expect(await p.getStatus('j2')).toMatchObject({ status: STATUS.FAILED, error: { message: 'pose not detected' } });
  });
  test('VT-03 FASHN: no key → disabled; bad key, rate limit and network errors become typed ProviderErrors', async () => {
    await expect(fashnProvider({ apiKey: '' }).generateTryOn({})).rejects.toMatchObject({ code: 'TRYON_DISABLED' });
    await expect(fashnProvider({ apiKey: 'k', fetchImpl: async () => reply(401, {}) }).getStatus('j')).rejects.toMatchObject({ code: 'TRYON_PROVIDER_AUTH' });
    await expect(fashnProvider({ apiKey: 'k', fetchImpl: async () => reply(429, {}) }).getStatus('j')).rejects.toMatchObject({ code: 'TRYON_PROVIDER_BUSY', retryable: true });
    await expect(fashnProvider({ apiKey: 'k', fetchImpl: async () => { throw new Error('ECONNRESET'); } }).getStatus('j')).rejects.toMatchObject({ code: 'TRYON_NETWORK', retryable: true });
  });
  test('VT-04 provider choice comes from the environment; mock only when asked for; every provider has the full contract', () => {
    expect(createProvider({}).enabled).toBe(false);
    expect(createProvider({ FASHN_API_KEY: 'k' }).name).toBe('fashn');
    expect(createProvider({ TRYON_PROVIDER: 'mock' }).name).toBe('mock');
    expect(createProvider({ TRYON_PROVIDER: 'fashn' }).enabled).toBe(false); // fashn without a key stays off
    let err = null; try { assertProvider({ name: 'x', generateTryOn() {} }); } catch (e) { err = e; }
    expect(err === null).toBe(false);
  });
});

describe('Image checks', () => {
  test('VT-05 real type and pixel size are read from the file header; non-images are refused', () => {
    expect(imageSize(png(640, 960))).toEqual({ width: 640, height: 960 });
    expect(checkImage(png(640, 960), { minSide: 300, what: 'photo' })).toMatchObject({ ok: true, mime: 'image/png' });
    expect(checkImage(png(200, 960), { minSide: 300, what: 'photo' })).toMatchObject({ ok: false, code: 'PHOTO_TOO_SMALL' });
    expect(checkImage(pdf, { minSide: 1, what: 'photo' })).toMatchObject({ ok: false, code: 'UNSUPPORTED_FILE' });
    expect(supportedCategories({})).toEqual(['Top', 'Layer', 'Dress']);
    expect(supportedCategories({ TRYON_CATEGORIES: 'Top,Bottom,Shoes' })).toEqual(['Top', 'Bottom']);
  });
});

describe('VirtualTryOnService', () => {
  test('VT-10 successful try-on: PENDING → PROCESSING → COMPLETED, result stored privately, original garment photo untouched', async () => {
    const { svc, files } = world();
    const created = await start(svc, { outfitItemIds: [TOP, SHOES] });
    expect(created).toMatchObject({ status: 'PROCESSING', provider: 'mock', garment: { id: TOP, name: 'White blouse', category: 'Top' }, outfitItemIds: [TOP, SHOES], resultImageUrl: null, error: null });
    const done = await svc.get(ALICE, created.tryOnId);
    expect(done.status).toBe('COMPLETED');
    expect(done.resultImageUrl.startsWith('/api/v1/photos/')).toBe(true);
    expect(done.resultImageUrl.includes('top.png')).toBe(false);
    expect(files.get('top.png').equals(png(600, 800))).toBe(true);
  });
  test('VT-11 an async provider is polled through GET: still PROCESSING until the job finishes', async () => {
    let t = 0;
    const { svc } = world({ provider: mockProvider({ delayMs: 10000, now: () => t }) });
    const a = await start(svc);
    expect((await svc.get(ALICE, a.tryOnId)).status).toBe('PROCESSING');
    t = 10001;
    expect((await svc.get(ALICE, a.tryOnId)).status).toBe('COMPLETED');
  });
  test('VT-12 invalid or someone else’s wardrobe item → 400 / 404 (nothing is sent)', async () => {
    const { svc } = world();
    await expect(svc.create(ALICE, { wardrobeItemId: 'nope', file: photo(800, 1200), consent: true })).rejects.toMatchObject({ status: 400 });
    await expect(svc.create(ALICE, { wardrobeItemId: DRESS, file: photo(800, 1200), consent: true })).rejects.toMatchObject({ status: 404 });
  });
  test('VT-13 unsupported garment type (shoes) → 422 UNSUPPORTED_GARMENT', async () => {
    const { svc } = world();
    await expect(svc.create(ALICE, { wardrobeItemId: SHOES, file: photo(800, 1200), consent: true })).rejects.toMatchObject({ status: 422, code: 'UNSUPPORTED_GARMENT' });
  });
  test('VT-14 missing images: no user photo → PHOTO_REQUIRED; piece without a usable photo → GARMENT_IMAGE_MISSING / UNSUITABLE', async () => {
    const { svc } = world();
    await expect(svc.create(ALICE, { wardrobeItemId: TOP, consent: true })).rejects.toMatchObject({ status: 400, code: 'PHOTO_REQUIRED' });
    await expect(svc.create(ALICE, { wardrobeItemId: TOP, useSavedPhoto: true, consent: true })).rejects.toMatchObject({ code: 'PHOTO_REQUIRED' });
    await expect(svc.create(ALICE, { wardrobeItemId: NOPHOTO, file: photo(800, 1200), consent: true })).rejects.toMatchObject({ status: 422, code: 'GARMENT_IMAGE_MISSING' });
    await expect(svc.create(ALICE, { wardrobeItemId: TINY, file: photo(800, 1200), consent: true })).rejects.toMatchObject({ status: 422, code: 'GARMENT_IMAGE_UNSUITABLE' });
  });
  test('VT-15 user photo validation: not an image → 415, too small → 422, no consent → 400', async () => {
    const { svc } = world();
    await expect(svc.create(ALICE, { wardrobeItemId: TOP, file: { buffer: pdf }, consent: true })).rejects.toMatchObject({ status: 415 });
    await expect(svc.create(ALICE, { wardrobeItemId: TOP, file: photo(120, 200), consent: true })).rejects.toMatchObject({ status: 422, code: 'PHOTO_TOO_SMALL' });
    await expect(svc.create(ALICE, { wardrobeItemId: TOP, file: photo(800, 1200), consent: false })).rejects.toMatchObject({ status: 400, code: 'CONSENT_REQUIRED' });
  });
  test('VT-16 provider failure → the try-on is FAILED with a friendly message, and Retry starts it again', async () => {
    let fail = true;
    const base = mockProvider({ delayMs: 0 });
    const flaky = { ...base, name: 'mock', enabled: true, async generateTryOn(x) { if (fail) throw new ProviderError('TRYON_PROVIDER', 'raw provider text'); return base.generateTryOn(x); } };
    const { svc } = world({ provider: flaky });
    const a = await start(svc);
    expect(a.status).toBe('FAILED');
    expect(a.error.code).toBe('TRYON_PROVIDER');
    expect(a.error.message.includes('raw provider text')).toBe(false);
    fail = false;
    const r = await svc.retry(ALICE, a.tryOnId);
    expect(r.attempts).toBe(2);
    expect((await svc.get(ALICE, a.tryOnId)).status).toBe('COMPLETED');
  });
  test('VT-17 timeout, failed job and empty result all end as FAILED (never stuck, never blank)', async () => {
    const slow = world({ provider: mockProvider({ delayMs: 10 ** 9, now: () => 0 }) });
    const a = await start(slow.svc);
    slow.clock.advance(181000);
    expect((await slow.svc.get(ALICE, a.tryOnId)).error.code).toBe('TRYON_TIMEOUT');
    const bad = world({ provider: mockProvider({ delayMs: 0, fail: 'process' }) });
    expect((await bad.svc.get(ALICE, (await start(bad.svc)).tryOnId)).status).toBe('FAILED');
    const empty = world({ provider: mockProvider({ delayMs: 0, fail: 'empty' }) });
    expect((await empty.svc.get(ALICE, (await start(empty.svc)).tryOnId)).error.code).toBe('TRYON_NO_RESULT');
  });
  test('VT-18 a temporary network error while polling keeps it PROCESSING (the next poll tries again)', async () => {
    const base = mockProvider({ delayMs: 0 });
    let down = true;
    const p = { ...base, name: 'mock', enabled: true, async getStatus(j) { if (down) throw new ProviderError('TRYON_NETWORK', 'x', { retryable: true }); return base.getStatus(j); } };
    const { svc } = world({ provider: p });
    const a = await start(svc);
    expect((await svc.get(ALICE, a.tryOnId)).status).toBe('PROCESSING');
    down = false;
    expect((await svc.get(ALICE, a.tryOnId)).status).toBe('COMPLETED');
  });
  test('VT-19 status retrieval and isolation: another user can neither read, save, retry nor delete my try-on', async () => {
    const { svc } = world();
    const a = await start(svc);
    expect((await svc.get(ALICE, a.tryOnId)).tryOnId).toBe(a.tryOnId);
    await expect(svc.get(BOB, a.tryOnId)).rejects.toMatchObject({ status: 404 });
    await expect(svc.setSaved(BOB, a.tryOnId, true)).rejects.toMatchObject({ status: 404 });
    await expect(svc.retry(BOB, a.tryOnId)).rejects.toMatchObject({ status: 404 });
    await expect(svc.remove(BOB, a.tryOnId)).rejects.toMatchObject({ status: 404 });
    expect((await svc.list(BOB)).tryOns.length).toBe(0);
  });
  test('VT-20 save result, list saved, delete removes the stored images', async () => {
    const { svc, files } = world();
    const a = await start(svc);
    const done = await svc.get(ALICE, a.tryOnId);
    expect((await svc.setSaved(ALICE, a.tryOnId, true)).saved).toBe(true);
    expect((await svc.list(ALICE, { savedOnly: true })).tryOns.map((x) => x.tryOnId)).toEqual([a.tryOnId]);
    const before = files.size;
    await svc.remove(ALICE, a.tryOnId);
    expect(files.size).toBe(before - 2); // the person copy and the result; the wardrobe photo stays
    expect(files.has('top.png')).toBe(true);
    void done;
  });
  test('VT-21 saved try-on photo: save, reuse, replace, delete', async () => {
    const { svc, files } = world();
    expect((await svc.getPhoto(ALICE)).photo).toBe(null);
    await expect(svc.savePhoto(ALICE, photo(800, 1200), false)).rejects.toMatchObject({ code: 'CONSENT_REQUIRED' });
    const first = await svc.savePhoto(ALICE, photo(800, 1200), true);
    expect(first.photo.url.startsWith('/api/v1/photos/')).toBe(true);
    const t = await svc.create(ALICE, { wardrobeItemId: TOP, useSavedPhoto: true, consent: true });
    expect(t.status).toBe('PROCESSING');
    const firstKey = first.photo.url.split('/photos/')[1].split('?')[0];
    await svc.savePhoto(ALICE, photo(900, 1300), true);
    expect(files.has(firstKey)).toBe(false); // the replaced photo is deleted
    expect((await svc.deletePhoto(ALICE)).deleted).toBe(true);
    expect((await svc.getPhoto(ALICE)).photo).toBe(null);
  });
  test('VT-22 uploading with "save this photo" also stores it for next time', async () => {
    const { svc } = world();
    await start(svc, { savePhoto: true });
    expect((await svc.getPhoto(ALICE)).photo === null).toBe(false);
  });
  test('VT-23 limits: daily quota and at most two running at once → 429', async () => {
    const { svc } = world({ provider: mockProvider({ delayMs: 10 ** 9 }) });
    await start(svc); await start(svc);
    await expect(start(svc)).rejects.toMatchObject({ status: 429, code: 'TRYON_BUSY' });
    const q = world({ settings: { dailyLimit: 1 } });
    await start(q.svc);
    await expect(start(q.svc)).rejects.toMatchObject({ status: 429, code: 'TRYON_LIMIT' });
  });
  test('VT-24 provider not configured → 503 TRYON_DISABLED and status says enabled: false', async () => {
    const { svc } = world({ provider: createProvider({}) });
    expect(svc.status()).toMatchObject({ enabled: false, supportedCategories: ['Top', 'Layer', 'Dress'] });
    await expect(start(svc)).rejects.toMatchObject({ status: 503, code: 'TRYON_DISABLED' });
  });
  test('VT-25 a saved look links the try-on to the outfit; someone else’s look is 404', async () => {
    const { svc } = world();
    const a = await start(svc, { outfitId: '00000000-0000-4000-8000-00000000f001' });
    expect(a.outfitId).toBe('00000000-0000-4000-8000-00000000f001');
    await expect(start(svc, { outfitId: '00000000-0000-4000-8000-00000000f999' })).rejects.toMatchObject({ status: 404 });
  });
  test('VT-26 an https result from the provider is copied into private storage', async () => {
    const urls = [];
    const p = fashnProvider({ apiKey: 'k', fetchImpl: async (url) => { urls.push(url); if (url.endsWith('/run')) return reply(200, { id: 'j1' }); return reply(200, { status: 'completed', output: ['https://cdn.fashn.ai/r.png'] }); } });
    const { svc } = world({ provider: p, fetchImpl: async (url) => { urls.push(url); return reply(200, {}); } });
    const a = await start(svc);
    const done = await svc.get(ALICE, a.tryOnId);
    expect(done.status).toBe('COMPLETED');
    expect(done.resultImageUrl.startsWith('/api/v1/photos/')).toBe(true);
    expect(urls.includes('https://cdn.fashn.ai/r.png')).toBe(true);
  });
  test('VT-27 account deletion removes every try-on file of the user', async () => {
    const { svc, files } = world();
    await start(svc, { savePhoto: true });
    await svc.deleteFilesOf(ALICE);
    expect([...files.keys()].filter((k) => k.startsWith('k')).length).toBe(0); // person copy + saved photo gone
    expect(files.has('top.png')).toBe(true);                                       // wardrobe photo untouched
  });
});
