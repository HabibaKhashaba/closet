// Offline demo entry (browser): answers the web app's fetch('/api/v1/...') with localApi.js, which runs
// Closet's real services on in-memory data. State survives a refresh in the same tab (sessionStorage).
const { createLocalApi } = require('./localApi');

const KEY = 'closet.offline.state';
let saved = null;
try { saved = sessionStorage.getItem(KEY); } catch { /* private mode */ }
const api = createLocalApi({ saved, persist: (s) => { try { sessionStorage.setItem(KEY, s); } catch { /* full or blocked */ } } });
window.__closetOffline = { api, reset() { try { sessionStorage.removeItem(KEY); sessionStorage.removeItem('closet.token'); } catch { /* ignore */ } location.hash = '#/'; location.reload(); } };

const toDataUrl = (file) => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(file); });
const real = window.fetch.bind(window);
window.fetch = async (url, opt = {}) => {
  if (typeof url !== 'string' || url.indexOf('/api/v1') !== 0) return real(url, opt);
  const method = (opt.method || 'GET').toUpperCase();
  let body = null;
  if (typeof FormData !== 'undefined' && opt.body instanceof FormData) {
    const photo = opt.body.get('photo');
    body = { details: opt.body.get('details'), photo: photo ? await toDataUrl(photo) : null };
  } else if (typeof opt.body === 'string') { try { body = JSON.parse(opt.body); } catch { body = {}; } }
  const auth = opt.headers && (opt.headers.Authorization || opt.headers.authorization);
  const r = await api.handle(method, url.slice('/api/v1'.length), body, auth);
  await new Promise((res) => setTimeout(res, 60)); // a little latency, like a network
  return new Response(r.status === 204 ? null : JSON.stringify(r.data), { status: r.status, headers: { 'Content-Type': 'application/json' } });
};

// Static art used by the sign-in screen (/art/*.jpg) is embedded by build.py.
const ART = window.__CLOSET_ART__ || {};
new MutationObserver(() => {
  document.querySelectorAll('img[src^="/art/"]').forEach((im) => { const u = ART[im.getAttribute('src')]; if (u) im.src = u; });
}).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['src'] });

document.addEventListener('DOMContentLoaded', () => {
  const d = document.createElement('div');
  d.className = 'offline-badge';
  d.innerHTML = '<b>Offline demo</b> · real Closet logic on local data in this tab · <button type="button">Reset</button>';
  d.style.cssText = 'position:fixed;left:12px;bottom:10px;z-index:99999;font:600 11px Inter,Arial,sans-serif;color:#6b5e58;background:rgba(255,253,251,.94);border:1px solid #e2d8d0;padding:5px 10px;border-radius:999px';
  d.querySelector('button').style.cssText = 'font:inherit;border:0;background:none;text-decoration:underline;cursor:pointer;color:#9c5f5b;padding:0';
  d.querySelector('button').onclick = () => window.__closetOffline.reset();
  document.body.appendChild(d);
});
