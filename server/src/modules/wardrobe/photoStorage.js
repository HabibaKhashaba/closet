// Photo storage behind one small interface, so local disk can be swapped for a cloud bucket.
// Photos are private: the API only hands out short-lived signed URLs (HMAC + expiry).
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heic',
};

// Checks the first bytes of the file, not just the name, so a renamed .exe is refused.
function sniffType(buffer) {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.slice(0, 4).toString() === 'RIFF' && buffer.slice(8, 12).toString() === 'WEBP') return 'image/webp';
  if (buffer.slice(4, 8).toString() === 'ftyp' && /^(heic|heix|hevc|mif1|msf1)$/.test(buffer.slice(8, 12).toString())) return 'image/heic';
  return null;
}

// Removes EXIF/XMP blocks (APP1) from a JPEG, which is where GPS location is kept (NFR-05).
function stripJpegMetadata(buffer) {
  if (!(buffer[0] === 0xff && buffer[1] === 0xd8)) return buffer;
  const parts = [buffer.slice(0, 2)];
  let i = 2;
  while (i + 4 <= buffer.length && buffer[i] === 0xff) {
    const marker = buffer[i + 1];
    if (marker === 0xda) break; // start of image data: copy the rest unchanged
    const length = buffer.readUInt16BE(i + 2);
    if (marker !== 0xe1) parts.push(buffer.slice(i, i + 2 + length)); // drop APP1 only
    i += 2 + length;
  }
  parts.push(buffer.slice(i));
  return Buffer.concat(parts);
}

function sign(key, expires, secret) {
  return crypto.createHmac('sha256', secret).update(`${key}.${expires}`).digest('base64url');
}

function localPhotoStorage({ dir, secret, ttlSeconds = 15 * 60 }) {
  return {
    async save(buffer, mime) {
      const key = `${crypto.randomUUID()}.${TYPES[mime]}`;
      const data = mime === 'image/jpeg' ? stripJpegMetadata(buffer) : buffer;
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, key), data);
      return key;
    },
    async remove(key) {
      await fs.rm(path.join(dir, path.basename(key)), { force: true });
    },
    signedUrl(key, now = Date.now()) {
      const expires = Math.floor(now / 1000) + ttlSeconds;
      return `/api/v1/photos/${key}?exp=${expires}&sig=${sign(key, expires, secret)}`;
    },
    verify(key, exp, sig, now = Date.now()) {
      if (!/^[0-9a-f-]{36}\.(jpg|png|webp|heic)$/.test(key)) return false;
      if (!exp || Number(exp) < Math.floor(now / 1000)) return false;
      const expected = Buffer.from(sign(key, Number(exp), secret));
      const given = Buffer.from(String(sig || ''));
      return expected.length === given.length && crypto.timingSafeEqual(expected, given);
    },
    filePath(key) {
      return path.resolve(dir, path.basename(key));
    },
  };
}

module.exports = { localPhotoStorage, sniffType, stripJpegMetadata, TYPES };
