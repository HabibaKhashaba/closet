// Chooses the virtual try-on provider from the environment.
//   TRYON_PROVIDER=fashn  → FASHN (needs FASHN_API_KEY)        (default when FASHN_API_KEY is set)
//   TRYON_PROVIDER=mock   → mock provider, no AI, for demos without a key
//   TRYON_PROVIDER=none   → feature off                         (default when there is no key)
// Add a new company by writing providers/<name>Provider.js with the same contract and a case here.
const { disabledProvider } = require('./VirtualTryOnProvider');
const { fashnProvider } = require('./fashnProvider');
const { mockProvider } = require('./mockProvider');

function createProvider(env = process.env) {
  const choice = (env.TRYON_PROVIDER || (env.FASHN_API_KEY ? 'fashn' : 'none')).toLowerCase();
  if (choice === 'fashn') return env.FASHN_API_KEY ? fashnProvider({ apiKey: env.FASHN_API_KEY, model: env.FASHN_MODEL || 'tryon-v1.6' }) : disabledProvider();
  if (choice === 'mock') return mockProvider({ delayMs: Number(env.TRYON_MOCK_DELAY_MS || 4000) });
  return disabledProvider();
}

module.exports = { createProvider };
