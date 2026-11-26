// Unit tests for the admin rules (US-80/81/84) on the in-memory repository: the same service the
// server runs on PostgreSQL. An admin sees counts and account events, never wardrobe content.
const { adminService } = require('../../src/modules/admin/adminModule');
const { memoryRepositories, createMemoryStore } = require('../../src/db/memoryRepositories');

const DAY = 86400000;
const NOW = new Date('2026-11-07T12:00:00Z');
const id = (n) => `00000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`;
function setup() {
  const repos = memoryRepositories(createMemoryStore());
  const S = repos.store;
  S.users.push(
    { id: id(1), email: 'admin@closet.app', role: 'admin', created_at: new Date(NOW - 40 * DAY) },
    { id: id(2), email: 'habiba@closet.app', role: 'user', created_at: new Date(NOW - 20 * DAY) },
    { id: id(3), email: 'new@closet.app', role: 'user', created_at: new Date(NOW - 2 * DAY), failed_logins: 5, locked_until: new Date(NOW.getTime() + 10 * 60000) },
  );
  S.items.push({ id: 'i1', user_id: id(2), name: 'Navy blazer' }, { id: 'i2', user_id: id(2), name: 'Silk blouse' });
  S.tryOns.push({ id: 't1', user_id: id(2), status: 'COMPLETED' }, { id: 't2', user_id: id(2), status: 'FAILED' });
  S.activity.push(
    { id: 1, user_id: id(2), action: 'Signed in', detail: null, at: new Date(NOW - DAY) },
    { id: 2, user_id: id(2), action: 'Piece added', detail: 'Navy blazer', at: new Date(NOW - DAY) },
    { id: 3, user_id: id(1), action: 'Admin: account suspended', detail: 'new@closet.app', at: new Date(NOW - 3600000) },
  );
  return { S, svc: adminService({ repo: repos.admin, now: () => NOW }) };
}

describe('Admin service', () => {
  test('AD-U01 accounts carry counts and lock state, never piece names', async () => {
    const { svc } = setup();
    const list = await svc.users();
    expect(list.map((u) => u.email)).toEqual(['admin@closet.app', 'habiba@closet.app', 'new@closet.app']);
    expect(list[1]).toMatchObject({ pieces: 2, tryOns: 2, status: 'active', locked: false });
    expect(list[2]).toMatchObject({ locked: true, failedLogins: 5 });
    expect(JSON.stringify(list)).not.toMatch(/Navy blazer|Silk blouse/);
  });
  test('AD-U02 overview: states, new this week, active this week, try-on totals, 6 weeks of sign-ups', async () => {
    const { svc } = setup();
    const s = await svc.stats();
    expect(s).toMatchObject({ users: 3, admins: 1, active: 3, suspended: 0, locked: 1, newThisWeek: 1, activeThisWeek: 2, pieces: 2, avgPieces: 1 });
    expect(s.tryOns).toEqual({ total: 2, completed: 1, failed: 1, running: 0 });
    expect(s.signupsByWeek).toHaveLength(6);
    expect(s.signupsByWeek[5].signups).toBe(1);
  });
  test('AD-U03 security log hides wardrobe actions; details only on admin actions', async () => {
    const { svc } = setup();
    const ev = await svc.events();
    expect(ev.map((e) => e.action)).toEqual(['Admin: account suspended', 'Signed in']);
    expect(ev[0]).toMatchObject({ detail: 'new@closet.app', email: 'admin@closet.app' });
    expect(ev[1].detail).toBeNull();
  });
  test('AD-U04 one account: its own events; unknown or malformed id is 404', async () => {
    const { svc } = setup();
    const u = await svc.user(id(2));
    expect(u.events.map((e) => e.action)).toEqual(['Signed in']);
    await expect(svc.user(id(9))).rejects.toMatchObject({ status: 404 });
    await expect(svc.user('nope')).rejects.toMatchObject({ status: 404 });
  });
  test('AD-U05 suspend / restore; never yourself or another admin', async () => {
    const { svc } = setup();
    expect(await svc.setStatus(id(1), id(2), 'suspended')).toMatchObject({ status: 'suspended' });
    expect((await svc.stats()).suspended).toBe(1);
    expect(await svc.setStatus(id(1), id(2), 'active')).toMatchObject({ status: 'active' });
    await expect(svc.setStatus(id(1), id(1), 'suspended')).rejects.toMatchObject({ status: 409 });
  });
  test('AD-U06 unlock clears the lock and the wrong-password count', async () => {
    const { svc } = setup();
    await svc.unlock(id(3));
    expect((await svc.users())[2]).toMatchObject({ locked: false, failedLogins: 0 });
  });
  test('AD-U07 health lists the five services and the try-on provider honestly', async () => {
    const { svc } = setup();
    const h = await svc.health();
    expect(h.services.map((x) => x.name)).toEqual(['PostgreSQL', 'Weather API', 'Language model', 'Virtual Try-On Service', 'Notification Service']);
    expect(h.status).toBe('ok');
  });
});
