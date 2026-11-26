// MockVirtualTryOnProvider — for development and demos WITHOUT an API key (TRYON_PROVIDER=mock).
// It runs the whole pipeline (job → PROCESSING → COMPLETED → stored result) but generates nothing:
// the "result" is the user's own photo, and the app labels it "Mock result — no AI was used".
// Never selected automatically: only when TRYON_PROVIDER=mock is set.
const { STATUS, ProviderError, assertProvider } = require('./VirtualTryOnProvider');

function mockProvider({ delayMs = Number(process.env.TRYON_MOCK_DELAY_MS || 4000), now = () => Date.now(), fail = null } = {}) {
  // fail: null | 'submit' | 'process' | 'empty', or a function returning one of those (checked per job; demos/tests)
  const failMode = () => (typeof fail === 'function' ? fail() : fail);
  const jobs = new Map();
  let n = 0;
  return assertProvider({
    name: 'mock',
    enabled: true,
    mock: true,
    async generateTryOn({ personImage, garmentImage, category }) {
      if (!personImage || !garmentImage) throw new ProviderError('TRYON_PROVIDER', 'Missing image.');
      const mode = failMode();
      if (mode === 'submit') throw new ProviderError('TRYON_PROVIDER', 'Mock provider: the job was refused.');
      n += 1;
      const jobId = `mock-${n}-${now()}`;
      jobs.set(jobId, { personImage, category, startedAt: now(), mode });
      return { jobId };
    },
    async getStatus(jobId) {
      const j = jobs.get(jobId);
      if (!j) return { status: STATUS.FAILED, error: { code: 'TRYON_PROVIDER', message: 'Unknown job.' } };
      if (now() - j.startedAt < delayMs) return { status: STATUS.PROCESSING };
      if (j.mode === 'process') return { status: STATUS.FAILED, error: { code: 'TRYON_PROVIDER', message: 'Mock provider: generation failed.' } };
      return { status: STATUS.COMPLETED };
    },
    async getResult(jobId) {
      const j = jobs.get(jobId);
      if (!j || j.mode === 'empty') return null;
      return { imageUrl: j.personImage };
    },
  });
}

module.exports = { mockProvider };
