// VirtualTryOnProvider — the contract every image-based try-on service implements (Adapter pattern).
// Closet never talks to a provider's API outside this folder, so a provider can be swapped by configuration.
//
//   provider.name                       short id stored with each try-on ('fashn', 'mock', …)
//   provider.enabled                    false when it is not configured (e.g. no API key)
//   provider.generateTryOn({ personImage, garmentImage, category })
//                                       → { jobId }   personImage / garmentImage: data URI or https URL
//                                                      category: 'tops' | 'bottoms' | 'one-pieces'
//   provider.getStatus(jobId)           → { status: 'PROCESSING' | 'COMPLETED' | 'FAILED', error?: { code, message } }
//   provider.getResult(jobId)           → { imageUrl } | null   (https URL or data URI of the generated image)
//
// Errors are thrown as ProviderError with a code the service maps to a friendly message.
const STATUS = Object.freeze({ PENDING: 'PENDING', PROCESSING: 'PROCESSING', COMPLETED: 'COMPLETED', FAILED: 'FAILED' });

class ProviderError extends Error {
  constructor(code, message, { retryable = false } = {}) { super(message); this.code = code; this.retryable = retryable; }
}

function assertProvider(p) {
  for (const m of ['generateTryOn', 'getStatus', 'getResult']) {
    if (typeof p[m] !== 'function') throw new Error(`Virtual try-on provider "${p.name}" is missing ${m}()`);
  }
  if (typeof p.name !== 'string') throw new Error('Virtual try-on provider needs a name');
  return p;
}

// Used when no provider is configured: the feature reports itself as off instead of failing later.
function disabledProvider() {
  const off = async () => { throw new ProviderError('TRYON_DISABLED', 'Virtual try-on is not set up on this server.'); };
  return { name: 'none', enabled: false, generateTryOn: off, getStatus: off, getResult: off };
}

module.exports = { STATUS, ProviderError, assertProvider, disabledProvider };
