// Virtual Try-On Preview on the user's own photo (view layer, runs only in the browser).
// Honest scope: a simulated overlay — each piece's own photo is cut out from its background and
// placed on the body regions of the user's full-body photo. No generative model is involved; the
// ITryOn adapter (SDD 5.17) is where a photo-real provider would plug in later.
// Privacy: the photo is read from the user's device, downscaled, and kept only in this tab
// (sessionStorage). It is never sent to Closet's server, and "Remove my photo" deletes it.

const KEY = 'closet.tryonPhoto';
const FIT_KEY = 'closet.tryonFit';
export const DEFAULT_FIT = { x: 50, y: 0, scale: 100 };   // body centre (%), vertical shift (%), size (%)

export function loadPhoto() { try { return sessionStorage.getItem(KEY); } catch { return null; } }
export function removePhoto() { try { sessionStorage.removeItem(KEY); sessionStorage.removeItem(FIT_KEY); } catch { /* nothing stored */ } }
export function loadFit() { try { return { ...DEFAULT_FIT, ...JSON.parse(sessionStorage.getItem(FIT_KEY) || '{}') }; } catch { return { ...DEFAULT_FIT }; } }
export function saveFit(f) { try { sessionStorage.setItem(FIT_KEY, JSON.stringify(f)); } catch { /* optional */ } }

const img = (src) => new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = src; });

// Read a chosen file, downscale to ≤ 1100 px tall and keep it in this tab only.
export async function storePhoto(file) {
  if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type)) throw new Error('Choose a JPG, PNG or WebP photo.');
  if (file.size > 15 * 1024 * 1024) throw new Error('That photo is larger than 15 MB.');
  const url = URL.createObjectURL(file);
  try {
    const i = await img(url);
    const k = Math.min(1, 1100 / i.height);
    const c = document.createElement('canvas'); c.width = Math.round(i.width * k); c.height = Math.round(i.height * k);
    c.getContext('2d').drawImage(i, 0, 0, c.width, c.height);
    const data = c.toDataURL('image/jpeg', 0.86);
    try { sessionStorage.setItem(KEY, data); } catch { /* too large for this tab: still shown, not kept */ }
    return data;
  } finally { URL.revokeObjectURL(url); }
}

// Cut a garment out of its photo: flood-fill the background from the borders (colour distance),
// then soften the edge. Cached per photo URL.
const cache = new Map();
export function cutout(src) {
  if (!cache.has(src)) cache.set(src, (async () => {
    const i = await img(src);
    const k = Math.min(1, 520 / Math.max(i.width, i.height));
    const w = Math.round(i.width * k), h = Math.round(i.height * k);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.drawImage(i, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h); const px = d.data;
    const at = (x, y) => (y * w + x) * 4;
    let br = 0, bg = 0, bb = 0, n = 0;
    for (let x = 0; x < w; x += 4) for (const y of [0, h - 1]) { const p = at(x, y); br += px[p]; bg += px[p + 1]; bb += px[p + 2]; n++; }
    br /= n; bg /= n; bb /= n;
    const far = (p) => Math.hypot(px[p] - br, px[p + 1] - bg, px[p + 2] - bb) > 34;
    const seen = new Uint8Array(w * h); const stack = [];
    for (let x = 0; x < w; x++) stack.push(x, 0, x, h - 1);
    for (let y = 0; y < h; y++) stack.push(0, y, w - 1, y);
    while (stack.length) {
      const y = stack.pop(), x = stack.pop();
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const q = y * w + x; if (seen[q]) continue; seen[q] = 1;
      const p = q * 4; if (far(p)) continue;
      px[p + 3] = 0;
      stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
    }
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {   // soft 1-px edge
      const p = at(x, y); if (!px[p + 3]) continue;
      if (!px[at(x + 1, y) + 3] || !px[at(x - 1, y) + 3] || !px[at(x, y + 1) + 3] || !px[at(x, y - 1) + 3]) px[p + 3] = 150;
    }
    g.putImageData(d, 0, 0);
    // crop to the garment
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (px[at(x, y) + 3] > 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 <= x0 || y1 <= y0) return { src: c.toDataURL(), ratio: h / w };
    const o = document.createElement('canvas'); o.width = x1 - x0 + 1; o.height = y1 - y0 + 1;
    o.getContext('2d').drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
    return { src: o.toDataURL('image/png'), ratio: o.height / o.width };
  })());
  return cache.get(src);
}

// Where each kind of piece sits on a standing full-body photo, as a share of the body box
// (top, width, centre-x, layer order). The body box itself is moved / scaled by the fit controls.
export function region(p) {
  const n = (p.name || '').toLowerCase();
  if (p.category === 'Dress') return { top: 0.17, w: 0.56, cx: 0.5, z: 4, maxH: 0.62 };
  if (p.category === 'Top') return { top: 0.17, w: 0.58, cx: 0.5, z: 3, maxH: 0.33 };
  if (p.category === 'Layer') return { top: 0.155, w: 0.66, cx: 0.5, z: 5, maxH: 0.42, alpha: 0.96 };
  if (p.category === 'Bottom') return /skirt/.test(n) ? { top: 0.45, w: 0.46, cx: 0.5, z: 2, maxH: 0.36 } : { top: 0.45, w: 0.4, cx: 0.5, z: 2, maxH: 0.44 };
  if (p.category === 'Shoes') return { top: 0.905, w: 0.34, cx: 0.5, z: 1, maxH: 0.09 };
  if (p.category === 'Bag') return { top: 0.47, w: 0.26, cx: 0.86, z: 6, maxH: 0.2 };
  if (/glass/.test(n)) return { top: 0.055, w: 0.17, cx: 0.5, z: 7, maxH: 0.05 };
  if (/earring|hoop/.test(n)) return { top: 0.07, w: 0.2, cx: 0.5, z: 7, maxH: 0.05 };
  if (/scarf/.test(n)) return { top: 0.14, w: 0.26, cx: 0.5, z: 6, maxH: 0.12 };
  return { top: 0.15, w: 0.2, cx: 0.5, z: 6, maxH: 0.1 };
}
