// Composition root: builds the API Gateway pipeline and wires the modules together.
// Request path: security → validation (per route) → authentication → access control → module.
const express = require('express');
const config = require('./config');
const { EventBus } = require('./events/eventBus');
const { securityPipeline } = require('./gateway/security');
const { authenticate } = require('./gateway/authenticate');
const { errorHandler, notFoundRoute } = require('./gateway/errorHandler');
const { identityRepository } = require('./modules/identity/identityRepository');
const { identityService, googleTokenVerifier } = require('./modules/identity/identityService');
const { identityRoutes } = require('./modules/identity/identityRoutes');
const { registerProfile } = require('./modules/profile/profileModule');
const { registerWardrobe } = require('./modules/wardrobe/wardrobeModule');
const { localPhotoStorage } = require('./modules/wardrobe/photoStorage');
const { registerAvailability } = require('./modules/availability/availabilityModule');
const { registerPlanner } = require('./modules/planner/plannerModule');
const { registerPrivacy } = require('./modules/privacy/privacyModule');
const { registerOutfits } = require('./modules/outfits/outfitsModule');
const { registerRecommendation } = require('./modules/recommendation/recommendationModule');
const { weatherAdapter } = require('./modules/recommendation/weatherAdapter');
const { registerAssistant } = require('./modules/assistant/assistantModule');
const { llmAdapter } = require('./modules/assistant/llmAdapter');
const { registerShopping } = require('./modules/shopping/shoppingModule');
const { registerAdmin } = require('./modules/admin/adminModule');
const { registerIntelligence } = require('./modules/intelligence/intelligenceModule');
const { registerPacking } = require('./modules/packing/packingModule');
const { registerActivity } = require('./modules/activity/activityModule');
const { audit } = require('./gateway/audit');
const vocabulary = require('./shared/vocabulary');
const { ALLOWED: STATUS_TRANSITIONS } = require('./modules/availability/statusMachine');

function createApp(deps = {}) {
  const { pool, transaction } = deps.db || require('./db/pool');
  const bus = deps.bus || new EventBus();
  const storage = deps.storage || localPhotoStorage({ dir: config.photoDir, secret: config.photoUrlSecret });
  const googleVerifier = deps.googleVerifier !== undefined ? deps.googleVerifier : googleTokenVerifier(config.googleClientId);

  // Modules
  const identity = identityService({ repo: identityRepository(pool), bus, googleVerifier });
  const profile = registerProfile({ db: pool, bus });
  let wardrobe; // Availability and Wardrobe use each other's interfaces, so bind lazily.
  const availability = registerAvailability({ db: pool, transaction, bus, wardrobe: () => wardrobe.service, profile: () => profile.service });
  wardrobe = registerWardrobe({ db: pool, bus, storage, availability: availability.service, profile: profile.service });
  const outfits = registerOutfits({ db: pool, bus, wardrobe: () => wardrobe.service });
  const weather = deps.weather || weatherAdapter();
  const rec = registerRecommendation({ wardrobe: () => wardrobe.service, profile: profile.service, outfits: () => outfits.service, weather });
  const planner = registerPlanner({ db: pool, rec: () => rec.service, outfits: () => outfits.service, wardrobe: () => wardrobe.service, availability: availability.service });
  const shopping = registerShopping({ db: pool, bus, wardrobe: () => wardrobe.service, profile: profile.service });
  const admin = registerAdmin({ db: pool, services: deps.services });
  const activity = registerActivity({ db: pool });
  const packing = registerPacking({ db: pool, wardrobe: () => wardrobe.service, profile: profile.service, weather, planner: () => planner.service, availability: availability.service, outfits: () => outfits.service });
  const intelligence = registerIntelligence({
    db: pool, wardrobe: () => wardrobe.service, outfits: () => outfits.service, profile: profile.service, planner: () => planner.service,
    rec: () => rec.service, activity: () => activity.service, packing: () => packing.service, availability: availability.service,
  });
  const privacy = registerPrivacy({ bus, identity });
  const assistant = registerAssistant({
    db: pool, parser: deps.parser || llmAdapter(), rec: () => rec.service, outfits: () => outfits.service,
    wardrobe: () => wardrobe.service, availability: availability.service, planner: () => planner.service, shopping: () => shopping.service,
    proactive: () => intelligence.service.proactive, intelligence: () => intelligence.service, packing: () => packing.service, profile: profile.service,
  });

  // API Gateway
  const app = express();
  securityPipeline(app);
  const auth = authenticate(identity);
  const api = express.Router();

  api.get('/health', (_req, res) => res.json({ status: 'ok' }));
  // The client reads the status rules from here (one source of truth — defect D-12: the web app had its own copy).
  api.get('/vocabulary', (_req, res) => res.json({ ...vocabulary, STATUS_TRANSITIONS }));
  const auditStep = audit(activity.service);
  api.use('/auth', auditStep, identityRoutes({ identity, auth }));
  api.use('/photos', wardrobe.photos); // protected by signed URLs instead of the login token

  // Everything below needs a valid login token.
  api.use(auth);
  api.use(auditStep); // Audit: successful changes are written to the user's activity log
  api.use('/profile', profile.routes);
  api.use('/items', availability.routes.items); // PATCH /items/:id/status
  api.use('/items', outfits.routes.items); // POST/DELETE /items/:id/hide
  api.use('/items', wardrobe.routes);
  api.use('/laundry', availability.routes.laundry);
  api.use('/closet/gaps', wardrobe.gaps);
  api.use('/events', planner.routes);
  api.use('/weather', rec.routes.weather);
  api.use('/recommendations', rec.routes.recommendations);
  api.use('/outfits', outfits.routes.outfits);
  api.use('/insights', outfits.routes.insights);
  api.use('/chat', assistant.routes);
  api.use('/shopping', shopping.routes);
  api.use('/intelligence', intelligence.routes.intelligence);
  api.use('/notifications', intelligence.routes.notifications);
  api.use('/packing', packing.routes);
  api.use('/activity', activity.routes);
  api.use('/admin', admin.routes); // Access Control: requireRole('admin')
  api.use('/account', privacy.routes);

  app.use('/api/v1', api);
  if (deps.webDir) {
    // Production: the same server also serves the built React app.
    const path = require('path');
    app.use(express.static(deps.webDir));
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(deps.webDir, 'index.html')));
  }
  app.use(notFoundRoute);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
