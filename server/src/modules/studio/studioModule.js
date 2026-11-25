// Studio module (v3.0): the ten new features, each in its own file under ./features, mounted under
// /api/v1/studio (and Cher mode also at /api/v1/cher-mode). One route table is used by BOTH the Express
// server and the offline demo, so the two can never drift apart.
// Feature flags: FEATURES_OFF=battle,wrapped turns features off (their routes answer 404 FEATURE_OFF).
const express = require('express');
const { AppError } = require('../../shared/errors');
const { studioRepository } = require('./studioRepository');
const { featureFlags } = require('./context');

// static requires (the offline demo bundles this file)
const FEATURE_FILES = {
  buy: require('./features/buy'), cher: require('./features/cher'), rescue: require('./features/rescue'), invitation: require('./features/invitation'), mood: require('./features/mood'),
  recreate: require('./features/recreate'), fitcheck: require('./features/fitcheck'), battle: require('./features/battle'), wrapped: require('./features/wrapped'), friends: require('./features/friends'),
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function registerStudio({ db, repo, env = process.env, ...deps }) {
  const flags = featureFlags(env);
  const d = { ...deps, repo: repo || studioRepository(db) };
  const features = {};
  d.friends = () => features.friends.methods; // Recreate this look offers friends' lendable pieces
  for (const [key, make] of Object.entries(FEATURE_FILES)) features[key] = make(d);
  // [method, path, feature, handler]
  const table = [];
  for (const [key, f] of Object.entries(features)) for (const [method, path, fn] of f.routes) table.push({ method, path, feature: key, fn });
  table.push({ method: 'GET', path: '/features', feature: null, fn: () => ({ features: flags, ai: !!(deps.llm && deps.llm.enabled) }) });

  async function run(entry, { userId, body, query, params }) {
    if (entry.feature && !flags[entry.feature]) throw new AppError(404, 'FEATURE_OFF', 'This feature is turned off.');
    for (const [k, v] of Object.entries(params || {})) if (/id$/i.test(k) && !UUID.test(v)) throw new AppError(404, 'NOT_FOUND', 'Not found.');
    return entry.fn({ userId, body: body || {}, query: query || {}, params: params || {} });
  }

  const router = express.Router();
  for (const e of table) {
    router[e.method.toLowerCase()](e.path, async (req, res, next) => {
      try { res.json(await run(e, { userId: req.user.id, body: req.body, query: req.query, params: req.params })); } catch (err) { next(err); }
    });
  }
  return { features, flags, table, run, routes: router, service: Object.fromEntries(Object.entries(features).map(([k, f]) => [k, f.methods])) };
}

module.exports = { registerStudio, FEATURE_FILES };
