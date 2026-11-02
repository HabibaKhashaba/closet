// Try-On adapter (ITryOn, SDD 5.17) for the FASHN virtual try-on API (US-118).
// Contract: tryOn({ personImage, garmentImage, category }) → { imageUrl }.
//   personImage / garmentImage: an https URL or a data URI. category: 'tops' | 'bottoms' | 'one-pieces' | 'auto'.
// The API is asynchronous: POST /v1/run returns a prediction id, then GET /v1/status/:id until it completes.
// The key comes only from the environment (FASHN_API_KEY); without it the adapter reports itself as disabled.
const BASE = 'https://api.fashn.ai/v1';

class TryOnError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

function fashnAdapter({ apiKey = process.env.FASHN_API_KEY, model = process.env.FASHN_MODEL || 'tryon-v1.6',
  fetchImpl = (...a) => fetch(...a), timeoutMs = 90000, pollMs = 2000, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` });
  return {
    name: 'fashn',
    enabled: Boolean(apiKey),
    async tryOn({ personImage, garmentImage, category = 'auto' }) {
      if (!apiKey) throw new TryOnError('TRYON_DISABLED', 'AI try-on is not configured on this server.');
      const start = await fetchImpl(`${BASE}/run`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ model_name: model, inputs: { model_image: personImage, garment_image: garmentImage, category } }),
      });
      const started = await start.json().catch(() => ({}));
      if (!start.ok || !started.id) throw new TryOnError('TRYON_PROVIDER', (started.error && (started.error.message || started.error)) || `Try-on service error (${start.status})`);
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        await sleep(pollMs);
        const res = await fetchImpl(`${BASE}/status/${encodeURIComponent(started.id)}`, { headers: headers() });
        const s = await res.json().catch(() => ({}));
        if (s.status === 'completed' && Array.isArray(s.output) && s.output[0]) return { imageUrl: s.output[0] };
        if (s.status === 'failed' || s.status === 'canceled' || s.error) {
          throw new TryOnError('TRYON_PROVIDER', (s.error && (s.error.message || s.error)) || 'The try-on service could not create the image.');
        }
      }
      throw new TryOnError('TRYON_TIMEOUT', 'The try-on service took too long.');
    },
  };
}

module.exports = { fashnAdapter, TryOnError };
