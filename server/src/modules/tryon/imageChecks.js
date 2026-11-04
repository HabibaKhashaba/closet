// Checks on the two input images, done before anything is sent to a provider:
// the real file type (magic bytes, not the name), pixel size, and which garment categories are supported.
const { sniffType } = require('../wardrobe/photoStorage');

// Closet category → provider category. v1 tries on ONE garment; tops, layers (jackets) and dresses are the
// reliable ones. Bottoms work technically and can be switched on with TRYON_CATEGORIES=Top,Layer,Dress,Bottom.
const PROVIDER_CATEGORY = { Top: 'tops', Layer: 'tops', Dress: 'one-pieces', Bottom: 'bottoms' };
const DEFAULT_SUPPORTED = ['Top', 'Layer', 'Dress'];
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

function supportedCategories(env = process.env) {
  const list = (env.TRYON_CATEGORIES || '').split(',').map((s) => s.trim()).filter((c) => PROVIDER_CATEGORY[c]);
  return list.length ? list : DEFAULT_SUPPORTED;
}

// Width/height from the file header (JPEG SOF, PNG IHDR, WebP VP8/VP8L/VP8X). null when unreadable.
function imageSize(buf) {
  const type = sniffType(buf);
  try {
    if (type === 'image/png') return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    if (type === 'image/jpeg') {
      let i = 2;
      while (i + 9 < buf.length) {
        if (buf[i] !== 0xff) { i += 1; continue; }
        const m = buf[i + 1];
        if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
        const len = buf.readUInt16BE(i + 2);
        if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) };
        if (m === 0xda) break;
        i += 2 + len;
      }
      return null;
    }
    if (type === 'image/webp') {
      const chunk = buf.slice(12, 16).toString();
      if (chunk === 'VP8 ') return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
      if (chunk === 'VP8L') { const b = buf.readUInt32LE(21); return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 }; }
      if (chunk === 'VP8X') return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
    }
  } catch { /* truncated header */ }
  return null;
}

// Returns { ok, mime, size, code, message }. minSide: the shortest side we accept, in pixels.
function checkImage(buf, { minSide, what }) {
  const mime = buf && sniffType(buf);
  if (!mime || !ACCEPTED.includes(mime)) return { ok: false, code: 'UNSUPPORTED_FILE', message: `The ${what} must be a JPG, PNG or WebP image.` };
  const size = imageSize(buf);
  if (size && Math.min(size.width, size.height) < minSide) {
    return { ok: false, mime, size, code: what === 'garment photo' ? 'GARMENT_IMAGE_UNSUITABLE' : 'PHOTO_TOO_SMALL', message: `The ${what} is too small (${size.width}×${size.height}). Use one at least ${minSide} px on each side.` };
  }
  return { ok: true, mime, size };
}

module.exports = { PROVIDER_CATEGORY, DEFAULT_SUPPORTED, ACCEPTED, supportedCategories, imageSize, checkImage };
