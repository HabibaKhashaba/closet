// FashnVirtualTryOnProvider — FASHN image-based virtual try-on (https://fashn.ai, API docs: docs.fashn.ai).
// Asynchronous API: POST /v1/run → { id }; GET /v1/status/:id → { status: starting | in_queue | processing |
// completed | failed, output: [imageUrl], error }. The key is read from FASHN_API_KEY (server only).
const { STATUS, ProviderError, assertProvider } = require('./VirtualTryOnProvider');

const BASE = 'https://api.fashn.ai/v1';
const RUNNING = new Set(['starting', 'in_queue', 'processing', 'queued', 'running']);

function fashnProvider({ apiKey = process.env.FASHN_API_KEY, model = process.env.FASHN_MODEL || 'tryon-v1.6',
  baseUrl = BASE, fetchImpl = (...a) => fetch(...a), requestTimeoutMs = 30000 } = {}) {
  const outputs = new Map(); // jobId → output URL seen in the last status call (saves one request)

  async function request(path, opts = {}) {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl && setTimeout(() => ctrl.abort(), requestTimeoutMs);
    let res;
    try {
      res = await fetchImpl(`${baseUrl}${path}`, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, ...(ctrl && { signal: ctrl.signal }) });
    } catch (e) {
      throw new ProviderError('TRYON_NETWORK', 'Could not reach the try-on service.', { retryable: true });
    } finally { if (timer) clearTimeout(timer); }
    const body = await res.json().catch(() => ({}));
    if (res.status === 401 || res.status === 403) throw new ProviderError('TRYON_PROVIDER_AUTH', 'The try-on service rejected the server’s API key.');
    if (res.status === 429) throw new ProviderError('TRYON_PROVIDER_BUSY', 'The try-on service is busy. Try again in a minute.', { retryable: true });
    if (!res.ok) throw new ProviderError('TRYON_PROVIDER', messageOf(body) || `The try-on service returned an error (${res.status}).`, { retryable: res.status >= 500 });
    return body;
  }
  const messageOf = (b) => (b && b.error && (typeof b.error === 'string' ? b.error : b.error.message || b.error.name)) || null;

  return assertProvider({
    name: 'fashn',
    enabled: Boolean(apiKey),
    async generateTryOn({ personImage, garmentImage, category }) {
      if (!apiKey) throw new ProviderError('TRYON_DISABLED', 'Virtual try-on is not set up on this server.');
      const body = await request('/run', { method: 'POST', body: JSON.stringify({ model_name: model, inputs: { model_image: personImage, garment_image: garmentImage, category: category || 'auto' } }) });
      if (!body.id) throw new ProviderError('TRYON_PROVIDER', messageOf(body) || 'The try-on service did not accept the job.');
      return { jobId: String(body.id) };
    },
    async getStatus(jobId) {
      const s = await request(`/status/${encodeURIComponent(jobId)}`);
      if (s.status === 'completed') {
        if (Array.isArray(s.output) && s.output[0]) outputs.set(jobId, s.output[0]);
        return { status: STATUS.COMPLETED };
      }
      if (s.status === 'failed' || s.status === 'canceled' || s.error) {
        return { status: STATUS.FAILED, error: { code: 'TRYON_PROVIDER', message: messageOf(s) || 'The try-on service could not create the image.' } };
      }
      if (RUNNING.has(s.status) || !s.status) return { status: STATUS.PROCESSING };
      return { status: STATUS.PROCESSING };
    },
    async getResult(jobId) {
      if (!outputs.has(jobId)) {
        const s = await request(`/status/${encodeURIComponent(jobId)}`);
        if (s.status !== 'completed' || !Array.isArray(s.output) || !s.output[0]) return null;
        outputs.set(jobId, s.output[0]);
      }
      const imageUrl = outputs.get(jobId); outputs.delete(jobId);
      return { imageUrl };
    },
  });
}

module.exports = { fashnProvider, FASHN_BASE: BASE };
