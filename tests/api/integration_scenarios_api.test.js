// Integration scenarios A–E over HTTP on PostgreSQL (GitHub Actions). Same scenarios as
// tests/unit/integration_scenarios.test.js — see tests/scenarios.js.
const request = require('supertest');
const { makeApp, resetDb, pool, registerUser, addPiece, auth, weatherState } = require('../helpers');
const { defineScenarios } = require('../scenarios');

const app = makeApp();
const CLOSET = [
  { name: 'White fitted tee', category: 'Top', colour: 'White', dressCodes: [1, 2], styles: ['Minimal'] },
  { name: 'Breton striped top', category: 'Top', colour: 'Navy', dressCodes: [1, 2], styles: ['Classic'] },
  { name: 'Blue Oxford shirt', category: 'Top', colour: 'Blue', dressCodes: [1, 2, 3], styles: ['Classic'] },
  { name: 'Beige wide-leg trousers', category: 'Bottom', colour: 'Beige', dressCodes: [1, 2, 3], styles: ['Classic'] },
  { name: 'Light-wash jeans', category: 'Bottom', colour: 'Blue', fabric: 'Denim', dressCodes: [1, 2], styles: ['Casual'] },
  { name: 'Black tailored trousers', category: 'Bottom', colour: 'Black', dressCodes: [2, 3, 4], styles: ['Classic'] },
  { name: 'White sneakers', category: 'Shoes', colour: 'White', dressCodes: [1, 2], styles: ['Casual'] },
  { name: 'Black loafers', category: 'Shoes', colour: 'Black', dressCodes: [1, 2, 3, 4], styles: ['Classic'] },
  { name: 'Denim jacket', category: 'Layer', colour: 'Blue', fabric: 'Denim', season: 'All seasons', dressCodes: [1, 2], styles: ['Casual'] },
  { name: 'Navy blazer', category: 'Layer', colour: 'Navy', dressCodes: [2, 3, 4], styles: ['Classic'] },
  { name: 'Structured black bag', category: 'Bag', colour: 'Black', dressCodes: [1, 2, 3, 4, 5], styles: ['Classic'] },
];

afterAll(() => pool.end());

defineScenarios('HTTP API · PostgreSQL', async () => {
  await resetDb();
  weatherState.tempC = 22;
  const u = await registerUser(app);
  for (const d of CLOSET) await addPiece(app, u.token, d);
  return {
    async call(method, url, body) {
      let req = request(app)[method.toLowerCase()](`/api/v1${url}`).set(auth(u.token));
      if (body) req = req.send(body);
      const r = await req;
      return { status: r.status, data: r.body };
    },
  };
});
