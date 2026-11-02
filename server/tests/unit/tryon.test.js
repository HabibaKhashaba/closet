// US-118 AI try-on: adapter contract (FASHN run → poll) and the service rules, with the provider mocked.
const { fashnAdapter, TryOnError } = require('../../src/modules/tryon/fashnAdapter');
const { plan, dailyLimiter, tryOnService } = require('../../src/modules/tryon/tryonModule');

const reply = (status, body) => ({ ok: status < 400, status, json: async () => body });

describe('FASHN adapter', () => {
  test('TO-01 without a key it is disabled and refuses', async () => {
    const a = fashnAdapter({ apiKey: '' });
    expect(a.enabled).toBe(false);
    await expect(a.tryOn({ personImage: 'p', garmentImage: 'g' })).rejects.toMatchObject({ code: 'TRYON_DISABLED' });
  });

  test('TO-02 submits model + garment, polls, returns the first output image', async () => {
    const calls = [];
    const fetchImpl = async (url, opts) => {
      calls.push([url, opts]);
      if (url.endsWith('/run')) return reply(200, { id: 'abc', error: null });
      return calls.length < 3 ? reply(200, { id: 'abc', status: 'processing' }) : reply(200, { id: 'abc', status: 'completed', output: ['https://cdn/out.png'] });
    };
    const a = fashnAdapter({ apiKey: 'k', fetchImpl, sleep: async () => {} });
    const r = await a.tryOn({ personImage: 'data:image/jpeg;base64,AA', garmentImage: 'data:image/jpeg;base64,BB', category: 'tops' });
    expect(r.imageUrl).toBe('https://cdn/out.png');
    const body = JSON.parse(calls[0][1].body);
    expect(body).toEqual({ model_name: 'tryon-v1.6', inputs: { model_image: 'data:image/jpeg;base64,AA', garment_image: 'data:image/jpeg;base64,BB', category: 'tops' } });
    expect(calls[0][1].headers.Authorization).toBe('Bearer k');
    expect(calls[1][0]).toBe('https://api.fashn.ai/v1/status/abc');
  });

  test('TO-03 a failed prediction becomes a provider error', async () => {
    const fetchImpl = async (url) => (url.endsWith('/run') ? reply(200, { id: 'x' }) : reply(200, { status: 'failed', error: { message: 'no person found' } }));
    const a = fashnAdapter({ apiKey: 'k', fetchImpl, sleep: async () => {} });
    await expect(a.tryOn({ personImage: 'p', garmentImage: 'g' })).rejects.toMatchObject({ code: 'TRYON_PROVIDER', message: 'no person found' });
  });

  test('TO-04 it gives up after the timeout', async () => {
    let t = 0; const realNow = Date.now;
    Date.now = () => (t += 50000);
    try {
      const fetchImpl = async (url) => (url.endsWith('/run') ? reply(200, { id: 'x' }) : reply(200, { status: 'processing' }));
      const a = fashnAdapter({ apiKey: 'k', fetchImpl, sleep: async () => {}, timeoutMs: 90000 });
      await expect(a.tryOn({ personImage: 'p', garmentImage: 'g' })).rejects.toBeInstanceOf(TryOnError);
    } finally { Date.now = realNow; }
  });
});

describe('Try-on plan (which pieces are sent, in which order)', () => {
  const P = (id, category) => ({ id, category, name: id });
  test('TO-05 bottom before top, layer last; shoes and extras skipped', () => {
    const r = plan([P('t', 'Top'), P('s', 'Shoes'), P('l', 'Layer'), P('b', 'Bottom'), P('x', 'Extra')]);
    expect(r.use.map((p) => p.id)).toEqual(['b', 't', 'l']);
    expect(r.skipped.map((p) => p.id)).toEqual(['s', 'x']);
  });
  test('TO-06 a dress replaces top and bottom', () => {
    const r = plan([P('d', 'Dress'), P('t', 'Top'), P('l', 'Layer')]);
    expect(r.use.map((p) => p.id)).toEqual(['d', 'l']);
    expect(r.skipped.map((p) => p.id)).toEqual(['t']);
  });
});

describe('Daily limit (BVA)', () => {
  test('TO-07 the 20th try-on is allowed, the 21st refused, a new day resets', () => {
    let now = Date.parse('2026-11-01T10:00:00Z');
    const l = dailyLimiter(20, () => now);
    for (let k = 0; k < 20; k += 1) expect(l.take('u')).toBe(true);
    expect(l.take('u')).toBe(false);
    expect(l.take('other')).toBe(true);
    now = Date.parse('2026-11-02T00:00:01Z');
    expect(l.take('u')).toBe(true);
  });
});

describe('Try-on service', () => {
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(20)]);
  const pieces = { a: { id: 'a', category: 'Top', name: 'Tee', photoUrl: '/api/v1/photos/a.jpg?exp=1&sig=s' } };
  const wardrobe = () => ({ getPiece: async (_u, id) => { if (!pieces[id]) { const e = new Error('nf'); e.status = 404; throw e; } return pieces[id]; } });
  const storage = { filePath: () => __filename }; // any readable file stands in for the garment photo
  const svc = (adapter, limit = 5) => tryOnService({ wardrobe, storage, adapter, limiter: dailyLimiter(limit) });

  test('TO-08 disabled provider → 503 so the client keeps the overlay', async () => {
    await expect(svc({ enabled: false }).tryOn('u', { buffer: jpeg }, ['a'])).rejects.toMatchObject({ status: 503, code: 'TRYON_DISABLED' });
  });
  test('TO-09 a non-image upload is refused (415)', async () => {
    await expect(svc({ enabled: true }).tryOn('u', { buffer: Buffer.from('not an image at all') }, ['a'])).rejects.toMatchObject({ status: 415 });
  });
  test('TO-10 someone else\'s piece is not found (404)', async () => {
    await expect(svc({ enabled: true }).tryOn('u', { buffer: jpeg }, ['zzz'])).rejects.toMatchObject({ status: 404 });
  });
  test('TO-11 success returns the AI image, labelled, with what was applied', async () => {
    const adapter = { enabled: true, name: 'fashn', tryOn: jest.fn(async ({ personImage, category }) => ({ imageUrl: `https://cdn/${category}.png`, from: personImage })) };
    const r = await svc(adapter).tryOn('u', { buffer: jpeg }, ['a']);
    expect(r).toMatchObject({ imageUrl: 'https://cdn/tops.png', aiGenerated: true, provider: 'fashn', applied: [{ id: 'a' }], skipped: [] });
    expect(adapter.tryOn.mock.calls[0][0].personImage.startsWith('data:image/jpeg;base64,')).toBe(true);
  });
  test('TO-12 provider failure → 502 with a fallback message', async () => {
    const adapter = { enabled: true, name: 'fashn', tryOn: async () => { throw new TryOnError('TRYON_PROVIDER', 'busy.'); } };
    await expect(svc(adapter).tryOn('u', { buffer: jpeg }, ['a'])).rejects.toMatchObject({ status: 502, code: 'TRYON_PROVIDER' });
  });
});
