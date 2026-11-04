// Minimal Buffer for the offline demo (browser): only what Closet's server code uses on images
// (from/alloc/concat, slice, equals, toString, readUInt*). Node's real Buffer is used everywhere else.
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
class Buf extends Uint8Array {
  static from(x, enc) {
    if (x instanceof ArrayBuffer) return new Buf(x);
    if (ArrayBuffer.isView(x) || Array.isArray(x)) return new Buf(Uint8Array.from(x));
    if (typeof x !== 'string') throw new TypeError('Buffer.from: unsupported input');
    if (enc === 'base64') { const bin = atob(x.replace(/[^A-Za-z0-9+/]/g, '')); const b = new Buf(bin.length); for (let i = 0; i < bin.length; i += 1) b[i] = bin.charCodeAt(i); return b; }
    if (enc === 'latin1' || enc === 'binary') { const b = new Buf(x.length); for (let i = 0; i < x.length; i += 1) b[i] = x.charCodeAt(i) & 255; return b; }
    return new Buf(new TextEncoder().encode(x));
  }
  static alloc(n, fill = 0) { return new Buf(n).fill(fill); }
  static concat(list) { const out = new Buf(list.reduce((n, b) => n + b.length, 0)); let o = 0; for (const b of list) { out.set(b, o); o += b.length; } return out; }
  static isBuffer(x) { return x instanceof Buf; }
  slice(a, b) { return new Buf(this.subarray(a, b)); }
  equals(o) { return o.length === this.length && this.every((v, i) => v === o[i]); }
  toString(enc) {
    if (enc === 'base64') { let s = ''; for (let i = 0; i < this.length; i += 0x8000) s += String.fromCharCode.apply(null, this.subarray(i, i + 0x8000)); return btoa(s); }
    if (enc === 'latin1' || enc === 'binary') { let s = ''; for (const c of this) s += String.fromCharCode(c); return s; }
    return new TextDecoder().decode(this);
  }
  readUInt16BE(i) { return (this[i] << 8) | this[i + 1]; }
  readUInt16LE(i) { return this[i] | (this[i + 1] << 8); }
  readUInt32BE(i) { return ((this[i] << 24) >>> 0) + ((this[i + 1] << 16) | (this[i + 2] << 8) | this[i + 3]); }
  readUInt32LE(i) { return ((this[i + 3] << 24) >>> 0) + ((this[i + 2] << 16) | (this[i + 1] << 8) | this[i]); }
  readUIntLE(i, n) { let v = 0; for (let k = n - 1; k >= 0; k -= 1) v = v * 256 + this[i + k]; return v; }
  writeUInt16BE(v, i) { this[i] = (v >> 8) & 255; this[i + 1] = v & 255; return i + 2; }
}
void B64;
module.exports = Buf;
