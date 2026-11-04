// Virtual Try-On helpers shared by the outfit cards and the try-on screen (no React here).
import { api } from './api.js';

export const DEFAULT_SUPPORTED = ['Top', 'Layer', 'Dress'];
export const MAX_PHOTO_MB = 10;
export const MIN_SIDE = 300;
const ACCEPT = ['image/jpeg', 'image/png', 'image/webp'];

// Server settings, fetched once per page load.
let cached = null;
export function tryOnConfig() {
  if (!cached) cached = api.vto.status().catch(() => ({ enabled: false, supportedCategories: DEFAULT_SUPPORTED, unreachable: true }));
  return cached;
}

// Checks a chosen photo in the browser before upload (the server checks again).
export function checkPhoto(file) {
  return new Promise((resolve) => {
    if (!file) return resolve({ ok: false, message: 'Choose a photo first.' });
    if (/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name || '')) return resolve({ ok: false, message: 'HEIC photos are not supported for try-on. Use a JPG or PNG (on iPhone: Settings → Camera → Formats → Most Compatible).' });
    if (!ACCEPT.includes(file.type)) return resolve({ ok: false, message: 'Use a JPG, PNG or WebP photo.' });
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) return resolve({ ok: false, message: `This photo is larger than ${MAX_PHOTO_MB} MB. Choose a smaller one.` });
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth; const h = img.naturalHeight;
      if (Math.min(w, h) < MIN_SIDE) { URL.revokeObjectURL(url); return resolve({ ok: false, message: `This photo is too small (${w}×${h}). Use one at least ${MIN_SIDE} px on each side.` }); }
      resolve({ ok: true, url, width: w, height: h, landscape: w > h });
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve({ ok: false, message: 'This file could not be opened as an image.' }); };
    img.src = url;
  });
}

// How long to wait before the next status check: quick at first, then slower (never hammering).
export function nextPollMs(elapsedMs) {
  if (elapsedMs < 20000) return 2500;
  if (elapsedMs < 60000) return 4000;
  return 6000;
}
export const CLIENT_GIVE_UP_MS = 200000; // the server stops the job at 180 s

export const CATEGORY_WORD = { Top: 'top', Layer: 'jacket or layer', Dress: 'dress', Bottom: 'bottom', Shoes: 'shoes', Bag: 'bag', Extra: 'accessory' };

// Friendly text for error codes from the API.
export function errorText(e) {
  const code = e && (e.code || e.error);
  const map = {
    PHOTO_REQUIRED: 'Add a clear full-body photo of yourself first.',
    PHOTO_TOO_SMALL: e && e.message,
    UNSUPPORTED_FILE: 'Use a JPG, PNG or WebP photo.',
    FILE_TOO_LARGE: `Photos can be up to ${MAX_PHOTO_MB} MB.`,
    UNSUPPORTED_GARMENT: e && e.message,
    GARMENT_IMAGE_MISSING: 'This piece has no usable photo. Add a clear photo of it first.',
    GARMENT_IMAGE_UNSUITABLE: e && e.message,
    TRYON_DISABLED: 'Virtual try-on is not set up on this server yet.',
    TRYON_LIMIT: e && e.message,
    TRYON_BUSY: 'A try-on is already being created. Wait for it to finish.',
    CONSENT_REQUIRED: 'Please tick the photo notice first.',
  };
  if (e && (e.status === 0 || e.name === 'TypeError')) return 'No connection. Check your internet and try again.';
  return map[code] || (e && e.message) || 'Something went wrong. Please try again.';
}

// Remembers the try-on in progress for this tab, so leaving and coming back resumes it.
const KEY = 'closet.vto.active';
export const activeJob = {
  get() { try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch { return null; } },
  set(v) { try { sessionStorage.setItem(KEY, JSON.stringify(v)); } catch { /* optional */ } },
  clear() { try { sessionStorage.removeItem(KEY); } catch { /* optional */ } },
};
