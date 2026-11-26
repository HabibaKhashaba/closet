// End-to-end integration scenarios A–E (Milestone 3–4): one change must reach every feature that
// depends on it. The same scenarios run on two stacks:
//   tests/unit/integration_scenarios.test.js — the real services on in-memory data (runs anywhere)
//   tests/api/integration_scenarios_api.test.js — the HTTP API on PostgreSQL (GitHub Actions)
// `stack()` returns { call(method, url, body) → { status, data } }.
const inDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

function defineScenarios(name, stack) {
  let s;
  const get = async (url) => (await s.call('GET', url)).data;
  const ok = async (method, url, body) => {
    const r = await s.call(method, url, body);
    if (r.status >= 400) throw new Error(`${method} ${url} → ${r.status} ${JSON.stringify(r.data)}`);
    return r.data;
  };
  const items = async () => (await get('/items')).items;
  const piece = async (id) => (await s.call('GET', `/items/${id}`)).data;
  const looksFor = async (occasion) => (await ok('POST', '/recommendations', { occasion })).outfits;
  const firstAvailable = async (category) => (await items()).find((p) => p.category === category && p.status === 'Available');

  describe(`Integration scenarios (${name})`, () => {
    beforeEach(async () => { s = await stack(); });

    test('SC-A Laundry: a planned shirt goes to the laundry → status, basket, outfits and planner all react; Wash done restores it everywhere', async () => {
      const top = await firstAvailable('Top');
      const bottom = await firstAvailable('Bottom');
      // Tomorrow: the laundry basket returns pieces after 2 days, so the planner must warn about it.
      const ev = await ok('POST', '/events', { title: 'Seminar', date: inDays(1), time: '10:00', occasion: 'University' });
      await ok('PUT', `/events/${ev.id}/outfit`, { itemIds: [top.id, bottom.id] });
      await ok('PATCH', `/items/${top.id}/status`, { status: 'Laundry' });
      expect((await piece(top.id)).status).toBe('Laundry');
      expect((await get('/laundry')).items.map((p) => p.id)).toContain(top.id);
      for (const o of await looksFor('University')) expect(o.itemIds).not.toContain(top.id);
      expect((await get('/intelligence/conflicts')).conflicts.some((c) => c.eventId === ev.id && c.itemId === top.id)).toBe(true);
      await ok('POST', '/laundry/wash-done');
      expect((await piece(top.id)).status).toBe('Available');
      expect((await get('/laundry')).items.map((p) => p.id)).not.toContain(top.id);
      expect((await get('/intelligence/conflicts')).conflicts.some((c) => c.eventId === ev.id && c.itemId === top.id)).toBe(false);
    });

    test('SC-B Outfit history: generate → save → wear with a rating → saved list, wear counts, history and insights all update', async () => {
      const look = (await looksFor('University'))[0];
      const before = await Promise.all(look.itemIds.map(piece));
      const saved = await ok('POST', '/outfits', { itemIds: look.itemIds, occasion: 'University', ruleScore: look.ruleScore, reasons: [] });
      expect((await get('/outfits')).outfits.map((o) => o.id)).toContain(saved.id);
      await ok('PATCH', `/outfits/${saved.id}`, { favorite: true });
      expect((await get('/outfits?favorites=true')).outfits.map((o) => o.id)).toContain(saved.id);
      const insightsBefore = await get('/insights');
      const w = await ok('POST', '/outfits/wear', { itemIds: look.itemIds, rating: 5, occasion: 'University' });
      const after = await Promise.all(look.itemIds.map(piece));
      after.forEach((p, i) => expect(p.wearCount).toBe(before[i].wearCount + 1));
      expect(after.every((p) => p.lastWornAt && Math.abs(Date.now() - new Date(p.lastWornAt)) < 2 * 86400000)).toBe(true);
      const hist = await get('/outfits/history');
      expect(JSON.stringify(hist)).toContain(look.itemIds[0]);
      expect(w).toBeTruthy();
      const insightsAfter = await get('/insights');
      expect(JSON.stringify(insightsAfter)).not.toBe(JSON.stringify(insightsBefore));
    });

    test('SC-C Donation: a donated jacket leaves the active closet, is never recommended, and is kept in donation history (no replacement bought)', async () => {
      const layer = await firstAvailable('Layer');
      const total = (await get('/items')).total;
      await ok('POST', `/items/${layer.id}/donate`, { reason: 'Rarely worn' });
      expect((await piece(layer.id)).status).toBe('Ready to donate');
      for (const occ of ['University', 'Work']) for (const o of await looksFor(occ)) expect(o.itemIds).not.toContain(layer.id);
      await ok('POST', `/items/${layer.id}/donate/done`);
      expect((await s.call('GET', `/items/${layer.id}`)).status).toBe(404);
      expect((await get('/items')).total).toBe(total - 1);
      const d = await get('/donation');
      expect(d.donated.some((x) => x.name === layer.name && x.reason === 'Rarely worn')).toBe(true);
      expect((await get('/shopping/list')).items.some((i) => i.replaces === layer.name || (i.title || '').includes(layer.name))).toBe(false);
    });

    test('SC-D Packing: packing a trip makes its pieces Packed and unavailable; unpacking restores them', async () => {
      const trip = await ok('POST', '/packing/trips', { destination: 'Alexandria', startDate: inDays(5), endDate: inDays(7), tripType: 'Travel', activities: ['Everyday'] });
      expect(trip.itemIds.length).toBeGreaterThan(0);
      await ok('POST', `/packing/trips/${trip.id}/pack`);
      const packed = await Promise.all(trip.itemIds.map(piece));
      const packedIds = packed.filter((p) => p.status === 'Packed').map((p) => p.id);
      expect(packedIds.length).toBeGreaterThan(0);
      for (const o of await looksFor('Everyday')) packedIds.forEach((id) => expect(o.itemIds).not.toContain(id));
      expect(packed.find((p) => p.status === 'Packed').statusNote).toBe('Alexandria');
      await ok('POST', `/packing/trips/${trip.id}/unpack`);
      for (const id of packedIds) expect((await piece(id)).status).toBe('Available');
    });

    test('SC-E Ask Closet: an outfit request uses only the user\'s Available pieces; saving it shows in Saved outfits at once', async () => {
      const all = await items();
      const r = await ok('POST', '/chat', { message: 'What should I wear to university today?' });
      expect(r.function).toBe('recommend');
      expect(r.outfits.length).toBeGreaterThan(0);
      for (const o of r.outfits) for (const id of o.itemIds) expect(all.find((p) => p.id === id).status).toBe('Available');
      const saved = await ok('POST', '/outfits', { itemIds: r.outfits[0].itemIds, occasion: 'University', reasons: [] });
      expect((await get('/outfits')).outfits.map((o) => o.id)).toContain(saved.id);
    });
  });
}

module.exports = { defineScenarios, inDays };
