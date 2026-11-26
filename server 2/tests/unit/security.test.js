// Unit tests of the security building blocks: tokens, passwords, photo checks, access control, event bus.
const jwt = require('jsonwebtoken');
const config = require('../../src/config');
const { issueToken, readToken } = require('../../src/modules/identity/tokens');
const { hashPassword, checkPassword } = require('../../src/modules/identity/passwords');
const { localPhotoStorage, sniffType, stripJpegMetadata } = require('../../src/modules/wardrobe/photoStorage');
const { requireRole } = require('../../src/gateway/accessControl');
const { httpsOnly } = require('../../src/gateway/security');
const { EventBus } = require('../../src/events/eventBus');
const { jpegWithExif, PNG } = require('../helpers');

describe('Login tokens (JWT)', () => {
  const user = { id: '11111111-1111-1111-1111-111111111111', role: 'user', token_version: 0 };
  test('UT-S01 a fresh token is accepted and carries id, role, version', () => {
    expect(readToken(issueToken(user))).toMatchObject({ sub: user.id, role: 'user', tv: 0 });
  });
  test('UT-S02 a token signed with another secret is refused', () => {
    expect(readToken(jwt.sign({ sub: user.id }, 'attacker-secret'))).toBeNull();
  });
  test('UT-S03 an expired token is refused', () => {
    expect(readToken(jwt.sign({ sub: user.id, exp: Math.floor(Date.now() / 1000) - 10 }, config.jwtSecret))).toBeNull();
  });
  test('UT-S04 the "none" algorithm is refused', () => {
    const part = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const unsigned = `${part({ alg: 'none', typ: 'JWT' })}.${part({ sub: user.id, role: 'admin', tv: 0 })}.`;
    expect(readToken(unsigned)).toBeNull();
  });
  test('UT-S05 garbage is refused', () => expect(readToken('not.a.token')).toBeNull());
});

describe('Passwords (bcrypt)', () => {
  test('UT-S06 hash is not the password and verifies only the right password', async () => {
    const hash = await hashPassword('Closet2026!');
    expect(hash).not.toContain('Closet2026!');
    expect(await checkPassword('Closet2026!', hash)).toBe(true);
    expect(await checkPassword('closet2026!', hash)).toBe(false);
  });
  test('UT-S07 an account without a password (Google only) never matches', async () => {
    expect(await checkPassword('anything', null)).toBe(false);
  });
});

describe('Photos', () => {
  test.each([
    ['UT-P01 JPEG', jpegWithExif(), 'image/jpeg'],
    ['UT-P02 PNG', PNG, 'image/png'],
    ['UT-P03 WebP', Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 ')]), 'image/webp'],
    ['UT-P04 HEIC', Buffer.concat([Buffer.alloc(4), Buffer.from('ftypheic'), Buffer.alloc(4)]), 'image/heic'],
    ['UT-P05 PDF is refused', Buffer.from('%PDF-1.7 fake document'), null],
    ['UT-P06 EXE is refused', Buffer.concat([Buffer.from('MZ'), Buffer.alloc(20)]), null],
  ])('%s', (_id, buffer, expected) => expect(sniffType(buffer)).toBe(expected));

  test('UT-P07 EXIF (GPS) block is removed, the image data is kept', () => {
    const original = jpegWithExif();
    const clean = stripJpegMetadata(original);
    expect(original.toString('latin1')).toContain('GPS');
    expect(clean.toString('latin1')).not.toContain('GPS');
    expect(clean.toString('latin1')).toContain('hello'); // other blocks kept
    expect(clean.slice(-2)).toEqual(Buffer.from([0xff, 0xd9]));
  });

  test('UT-P08 signed URL: valid, expired, tampered, foreign key', () => {
    const s = localPhotoStorage({ dir: '/tmp', secret: 'k' });
    const key = '0b8f2c1e-3c4d-4e5f-8a9b-0c1d2e3f4a5b.jpg';
    const url = new URL(s.signedUrl(key, 1_000_000_000_000), 'http://x');
    const exp = url.searchParams.get('exp');
    const sig = url.searchParams.get('sig');
    expect(s.verify(key, exp, sig, 1_000_000_000_000)).toBe(true);
    expect(s.verify(key, exp, sig, 1_000_000_000_000 + 16 * 60 * 1000)).toBe(false); // after 15 min
    expect(s.verify(key, exp, `${sig}x`, 1_000_000_000_000)).toBe(false);
    expect(s.verify('../../etc/passwd', exp, sig, 1_000_000_000_000)).toBe(false);
  });
});

describe('Access control and pipeline', () => {
  const run = (mw, req) => new Promise((resolve) => mw(req, {}, (err) => resolve(err)));
  test('UT-S08 admin route: admin passes, user gets 403, no user gets 401', async () => {
    const adminOnly = requireRole('admin');
    expect(await run(adminOnly, { user: { role: 'admin' } })).toBeUndefined();
    expect((await run(adminOnly, { user: { role: 'user' } })).status).toBe(403);
    expect((await run(adminOnly, {})).status).toBe(401);
  });
  test('UT-S09 HTTP is redirected to HTTPS in production only', () => {
    const original = config.env;
    config.env = 'production';
    let redirected = null;
    httpsOnly({ headers: { host: 'closet.app', 'x-forwarded-proto': 'http' }, originalUrl: '/x' },
      { redirect: (code, url) => { redirected = [code, url]; } }, () => {});
    config.env = original;
    expect(redirected).toEqual([308, 'https://closet.app/x']);
  });
});

describe('Event bus (Observer)', () => {
  test('UT-E01 every subscriber receives the event, in order; unknown topics are ignored', async () => {
    const bus = new EventBus();
    const seen = [];
    bus.subscribe('ItemCreated', async (p) => seen.push(`a:${p.id}`));
    bus.subscribe('ItemCreated', async (p) => seen.push(`b:${p.id}`));
    await bus.publish('ItemCreated', { id: 1 });
    await bus.publish('Nobody', {});
    expect(seen).toEqual(['a:1', 'b:1']);
  });
});
