// Integration scenarios A–E on the real services with the seeded demo closet in memory
// (the same code the server runs; only the repositories are in-memory). See tests/scenarios.js.
const { createLocalApi, TOKEN } = require('../../../tools/offline_demo/localApi');
const { defineScenarios } = require('../scenarios');

defineScenarios('real services · in-memory data', async () => {
  const local = createLocalApi();
  await local.ready;
  return { call: (method, url, body) => local.handle(method, url, body || null, `Bearer ${TOKEN}`) };
});
