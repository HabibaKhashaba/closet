// Virtual Try-On module (US-118) — image-based try-on of ONE garment from a recommended look on the user's photo.
// Layers: VirtualTryOnController (HTTP) → VirtualTryOnService (rules) → VirtualTryOnProvider (adapter) → external API.
// The browser never calls the provider: the API key stays on the server.
const config = require('../../config');
const { TOPICS } = require('../../events/eventBus');
const { virtualTryOnRepository } = require('./virtualTryOnRepository');
const { virtualTryOnService } = require('./virtualTryOnService');
const { virtualTryOnController } = require('./virtualTryOnController');
const { createProvider } = require('./providers');

function registerVirtualTryOn({ db, repo, bus, wardrobe, outfits, storage, provider, settings, fetchImpl, now }) {
  const service = virtualTryOnService({
    repo: repo || virtualTryOnRepository(db), provider: provider || createProvider(), wardrobe, outfits, storage,
    settings: { ...config.tryOn, ...settings }, fetchImpl, now,
  });
  if (bus) bus.subscribe(TOPICS.AccountDeleted, ({ userId }) => service.deleteFilesOf(userId));
  return { service, routes: virtualTryOnController({ service, maxPhotoBytes: (settings && settings.maxPhotoBytes) || config.tryOn.maxPhotoBytes }) };
}

module.exports = { registerVirtualTryOn };
