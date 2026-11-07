// Admin (US-80 accounts, US-81 system health, US-83 configuration, US-84 security log).
// Only for role = admin (checked by the server's Access Control step, not just hidden here).
// Admins see accounts, counts and account-level events — never anyone's photos, pieces or outfits.
import React, { useMemo, useState } from 'react';
import { api } from '../api.js';
import { Icon, Modal, PageHead, Skeleton, SprintNote, Tabs, fmtDate, useApp, useLoad } from '../ui.jsx';

const ago = (iso) => {
  if (!iso) return '—';
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
};
const EVENT_ICON = { 'Account created': 'plus', 'Signed in': 'check', 'Signed in with Google': 'check', 'Signed out': 'logout', 'Profile updated': 'edit', 'Admin: account suspended': 'x', 'Admin: account restored': 'refresh', 'Admin: account unlocked': 'shield' };
const stateOf = (u) => (u.status === 'suspended' ? 'suspended' : u.locked ? 'locked' : 'active');

function Kpi({ label, value, sub, tone }) {
  return (
    <div className="card pad admin-kpi">
      <span className="eyebrow">{label}</span>
      <h2 className={tone || ''} style={{ marginTop: 6 }}>{value}</h2>
      {sub && <span className="tiny muted">{sub}</span>}
    </div>
  );
}

function Signups({ weeks }) {
  const max = Math.max(1, ...weeks.map((w) => w.signups));
  return (
    <div className="admin-bars" aria-label="Sign-ups per week">
      {weeks.map((w) => (
        <div key={w.weekEnding} className="admin-bar">
          <span className="tiny"><b>{w.signups}</b></span>
          <i style={{ height: `${8 + (w.signups / max) * 92}%` }} />
          <span className="tiny muted">{fmtDate(w.weekEnding, { day: 'numeric', month: 'short' })}</span>
        </div>
      ))}
    </div>
  );
}

function EventList({ events, showEmail = true }) {
  if (!events.length) return <p className="small muted">No account events yet.</p>;
  return (
    <ul className="admin-events">
      {events.map((e, k) => (
        <li key={k}>
          <i className={/suspended/.test(e.action) ? 'rose' : /unlocked|restored/.test(e.action) ? 'ok' : ''}><Icon name={EVENT_ICON[e.action] || 'clock'} size={14} /></i>
          <span><b>{e.action}</b>{e.detail ? <> · {e.detail}</> : null}{showEmail && <><br /><span className="tiny muted">{e.email}</span></>}</span>
          <span className="tiny muted" title={new Date(e.at).toLocaleString()}>{ago(e.at)}</span>
        </li>
      ))}
    </ul>
  );
}

function AccountDetail({ id, me, onClose, onChanged }) {
  const { toast } = useApp();
  const d = useLoad(() => api.adminUser(id), [id]);
  async function act(fn, msg) {
    try { await fn(); toast(msg); d.reload(true); onChanged(); } catch (e) { toast(e.message, true); }
  }
  const u = d.data;
  return (
    <Modal title={u ? u.email : 'Account'} sub="Account details · counts only, never the wardrobe itself" onClose={onClose} wide>
      {!u ? <Skeleton h={260} /> : (
        <div className="grid g2" style={{ gap: 20, alignItems: 'start' }}>
          <div className="stack">
            <div className="row wrap" style={{ gap: 8 }}>
              <span className="tag" style={{ textTransform: 'capitalize' }}>{u.role}</span>
              <span className={stateOf(u) === 'active' ? 'tag s1' : 'tag rose'}>{stateOf(u)}</span>
              {u.failedLogins > 0 && <span className="tag">{u.failedLogins} wrong password{u.failedLogins === 1 ? '' : 's'}</span>}
            </div>
            <table className="table">
              <tbody>
                <tr><td className="muted">Joined</td><td>{fmtDate(u.createdAt, { day: 'numeric', month: 'short', year: 'numeric' })}</td></tr>
                <tr><td className="muted">Last active</td><td>{ago(u.lastActive)}</td></tr>
                <tr><td className="muted">Pieces</td><td>{u.pieces}</td></tr>
                <tr><td className="muted">Saved outfits</td><td>{u.outfits}</td></tr>
                <tr><td className="muted">Outfits worn</td><td>{u.wears}</td></tr>
                <tr><td className="muted">Virtual try-ons</td><td>{u.tryOns}</td></tr>
                {u.locked && <tr><td className="muted">Locked until</td><td>{new Date(u.lockedUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td></tr>}
              </tbody>
            </table>
            {u.id !== me && u.role !== 'admin' && (
              <div className="row wrap">
                {u.status === 'active'
                  ? <button type="button" className="btn line sm" onClick={() => act(() => api.adminSetStatus(u.id, 'suspended'), `${u.email} suspended — their sessions ended`)}><Icon name="x" size={14} />Suspend account</button>
                  : <button type="button" className="btn sm" onClick={() => act(() => api.adminSetStatus(u.id, 'active'), `${u.email} restored`)}><Icon name="check" size={14} />Restore account</button>}
                {u.locked && <button type="button" className="btn sm" onClick={() => act(() => api.adminUnlock(u.id), `${u.email} unlocked`)}><Icon name="shield" size={14} />Unlock now</button>}
              </div>
            )}
            <p className="tiny muted">Suspending ends every session at once (the token version goes up). Unlocking clears the five-wrong-passwords lock early.</p>
          </div>
          <div>
            <h3 style={{ marginBottom: 10 }}>Security events</h3>
            <EventList events={u.events} showEmail={false} />
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function AdminScreen() {
  const { toast, user } = useApp();
  const users = useLoad(() => api.adminUsers(), []);
  const stats = useLoad(() => api.adminStats(), []);
  const health = useLoad(() => api.adminHealth(), []);
  const config = useLoad(() => api.adminConfig(), []);
  const events = useLoad(() => api.adminEvents(), []);
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const reload = () => { users.reload(true); stats.reload(true); events.reload(true); };
  async function act(fn, msg) { try { await fn(); toast(msg); reload(); } catch (e) { toast(e.message, true); } }

  const list = useMemo(() => (users.data?.users || [])
    .filter((u) => filter === 'all' || stateOf(u) === filter || (filter === 'admin' && u.role === 'admin'))
    .filter((u) => !q.trim() || u.email.toLowerCase().includes(q.trim().toLowerCase())), [users.data, filter, q]);
  const count = (k) => (users.data?.users || []).filter((u) => (k === 'admin' ? u.role === 'admin' : stateOf(u) === k)).length;
  const s = stats.data;

  return (
    <>
      <PageHead title="Admin" sprint={3} sub="Accounts, security and platform health. Admins never see anyone’s photos, pieces or outfits — only counts." />

      {s ? (
        <div className="grid g4" style={{ marginBottom: 20 }}>
          <Kpi label="Accounts" value={s.users} sub={`${s.admins} admin · ${s.users - s.admins} members`} />
          <Kpi label="Active this week" value={s.activeThisWeek} sub={`${s.newThisWeek} new in the last 7 days`} />
          <Kpi label="Need attention" value={s.suspended + s.locked} sub={`${s.suspended} suspended · ${s.locked} locked`} tone={s.suspended + s.locked ? 'rose-text' : ''} />
          <Kpi label="Virtual try-ons" value={s.tryOns.total} sub={`${s.tryOns.completed} done · ${s.tryOns.failed} failed · ${s.tryOns.running} running`} />
          <Kpi label="Pieces stored" value={s.pieces} sub={`${s.avgPieces} per member on average`} />
          <Kpi label="Saved outfits" value={s.outfitsSaved} />
          <Kpi label="Outfits worn" value={s.wears} />
          <Kpi label="Server errors" value={health.data ? health.data.serverErrors : '…'} sub={health.data ? `up ${health.data.uptimeMinutes} min` : ''} />
        </div>
      ) : <Skeleton h={220} style={{ marginBottom: 20 }} />}

      <div className="grid g2" style={{ gap: 20, marginBottom: 20, alignItems: 'start' }}>
        <section className="card pad-lg">
          <div className="card-head"><div><h3>Sign-ups</h3><p className="small muted">New accounts per week, last 6 weeks</p></div></div>
          {s ? <Signups weeks={s.signupsByWeek} /> : <Skeleton h={160} />}
        </section>
        <section className="card pad-lg">
          <div className="card-head"><div><h3>Security log</h3><p className="small muted">Sign-ins, new accounts and admin actions — no wardrobe activity</p></div><button type="button" className="btn ghost sm" onClick={() => events.reload(true)}><Icon name="refresh" size={14} />Refresh</button></div>
          {events.data ? <div className="admin-scroll"><EventList events={events.data.events.slice(0, 8)} /></div> : <Skeleton h={160} />}
        </section>
      </div>

      <section className="card pad-lg" style={{ marginBottom: 20 }}>
        <div className="card-head">
          <div><h3>Accounts</h3><p className="small muted">Open an account for its details and security events.</p></div>
          <input className="admin-search" placeholder="Search by email…" aria-label="Search accounts" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <Tabs value={filter} onChange={setFilter} options={[['all', `All · ${users.data?.users.length ?? 0}`], ['active', `Active · ${count('active')}`], ['locked', `Locked · ${count('locked')}`], ['suspended', `Suspended · ${count('suspended')}`], ['admin', `Admins · ${count('admin')}`]]} />
        </div>
        {users.loading ? <Skeleton h={240} /> : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table admin-table">
              <thead><tr><th>Account</th><th>Role</th><th>Status</th><th>Pieces</th><th>Outfits</th><th>Try-ons</th><th>Last active</th><th>Joined</th><th /></tr></thead>
              <tbody>
                {list.map((u) => (
                  <tr key={u.id} onClick={() => setOpen(u.id)} style={{ cursor: 'pointer' }}>
                    <td><b>{u.email}</b>{u.id === user.id && <span className="tiny muted"> · you</span>}</td>
                    <td style={{ textTransform: 'capitalize' }}>{u.role}</td>
                    <td><span className={stateOf(u) === 'active' ? 'tag s1' : 'tag rose'}>{stateOf(u)}</span>{u.failedLogins > 0 && !u.locked && <span className="tiny muted"> · {u.failedLogins} wrong</span>}</td>
                    <td>{u.pieces}</td>
                    <td>{u.outfits}</td>
                    <td>{u.tryOns}</td>
                    <td className="muted">{ago(u.lastActive)}</td>
                    <td className="muted">{fmtDate(u.createdAt)}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                      {u.id !== user.id && u.role !== 'admin' && (<>
                        {u.locked && <button type="button" className="btn sm" style={{ marginRight: 6 }} onClick={() => act(() => api.adminUnlock(u.id), `${u.email} unlocked`)}><Icon name="shield" size={14} />Unlock</button>}
                        {u.status === 'active'
                          ? <button type="button" className="btn line sm" onClick={() => act(() => api.adminSetStatus(u.id, 'suspended'), `${u.email} suspended — their sessions ended`)}><Icon name="x" size={14} />Suspend</button>
                          : <button type="button" className="btn sm" onClick={() => act(() => api.adminSetStatus(u.id, 'active'), `${u.email} restored`)}><Icon name="check" size={14} />Restore</button>}
                      </>)}
                    </td>
                  </tr>
                ))}
                {!list.length && <tr><td colSpan={9} className="muted">No accounts match.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {health.data && (
        <section className="card pad-lg" style={{ marginBottom: 20 }}>
          <div className="card-head"><div><h3>System health</h3><p className="small muted">Up {health.data.uptimeMinutes} min · {health.data.serverErrors} unexpected errors since start · status {health.data.status}</p></div><span className={health.data.status === 'ok' ? 'tag s1' : 'tag rose'}>{health.data.status}</span></div>
          <div className="grid g3" style={{ gap: 12 }}>
            {health.data.services.map((x) => <div key={x.name} className="notice small" style={{ background: x.status === 'ok' ? 'var(--ok-soft)' : x.status === 'fallback' ? 'var(--warn-soft)' : 'var(--bg-2)' }}><Icon name={x.status === 'ok' ? 'check' : x.status === 'fallback' ? 'refresh' : 'link'} size={16} style={{ flex: 'none' }} /><span><b>{x.name}</b> · {x.status}<br /><span className="muted">{x.detail}</span></span></div>)}
          </div>
        </section>
      )}

      <div className="grid g2" style={{ gap: 20, alignItems: 'start' }}>
        {s && (
          <section className="card pad">
            <h3 style={{ marginBottom: 10 }}>Why pieces leave closets</h3>
            {s.deletionReasons.length ? <div className="chips">{s.deletionReasons.map((r) => <span key={r.reason} className="chip">{r.reason} <span className="n">{r.n}</span></span>)}</div> : <p className="small muted">No pieces deleted yet.</p>}
            <p className="tiny muted" style={{ marginTop: 10 }}>Reasons only — never which piece or whose.</p>
          </section>
        )}
        {config.data && (
          <section className="card pad">
            <div className="card-head"><h3>App configuration</h3><span className="tag s4">Read-only preview · US-83</span></div>
            <p className="small muted" style={{ marginBottom: 10 }}>The shared lists every module uses: {config.data.categories.length} categories, {config.data.statuses.length} statuses, {Object.keys(config.data.dressCodes).length} dress codes, {config.data.occasions.length} occasions and {config.data.templates.length} occasion templates.</p>
            <div className="chips">{config.data.switches.map((x) => <span key={x.key} className="chip">{x.label} <span className="n">{x.on ? 'on' : 'off'}</span></span>)}</div>
          </section>
        )}
      </div>
      <div style={{ marginTop: 20 }}><SprintNote n={3}>Protected by Access Control: every /admin request is checked for role “admin” on the server; a normal user gets 403.</SprintNote></div>
      {open && <AccountDetail id={open} me={user.id} onClose={() => setOpen(null)} onChanged={reload} />}
    </>
  );
}
