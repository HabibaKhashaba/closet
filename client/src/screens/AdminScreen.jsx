// Admin (Sprint 3 early start, US-80). Only for role = admin (checked by the server's Access
// Control step, not just hidden here). Admins see counts, never anyone's photos or pieces.
import React from 'react';
import { api } from '../api.js';
import { Icon, PageHead, Skeleton, SprintNote, fmtDate, useApp, useLoad } from '../ui.jsx';

export default function AdminScreen() {
  const { toast, user } = useApp();
  const users = useLoad(() => api.adminUsers(), []);
  const stats = useLoad(() => api.adminStats(), []);
  const health = useLoad(() => api.adminHealth(), []);
  const config = useLoad(() => api.adminConfig(), []);
  async function set(u, status) {
    try { await api.adminSetStatus(u.id, status); toast(status === 'suspended' ? `${u.email} suspended — their sessions ended` : `${u.email} restored`); users.reload(true); stats.reload(true); } catch (e) { toast(e.message, true); }
  }
  return (
    <>
      <PageHead title="Admin" sprint={3} sub="Accounts and platform health. Admins never see anyone’s photos or pieces." />
      {stats.data && (
        <div className="grid g4" style={{ marginBottom: 20 }}>
          {[['Accounts', stats.data.users], ['Suspended', stats.data.suspended], ['Pieces', stats.data.pieces], ['Outfits worn', stats.data.wears]].map(([k, v]) => <div key={k} className="card pad"><span className="eyebrow">{k}</span><h2 style={{ marginTop: 6 }}>{v}</h2></div>)}
        </div>
      )}
      {health.data && (
        <section className="card pad-lg" style={{ marginBottom: 20 }}>
          <div className="card-head"><div><h3>System health</h3><p className="small muted">Up {health.data.uptimeMinutes} min · {health.data.serverErrors} unexpected errors since start · status {health.data.status}</p></div><span className={health.data.status === 'ok' ? 'tag s1' : 'tag rose'}>{health.data.status}</span></div>
          <div className="grid g3" style={{ gap: 12 }}>
            {health.data.services.map((x) => <div key={x.name} className="notice small" style={{ background: x.status === 'ok' ? 'var(--ok-soft)' : x.status === 'fallback' ? 'var(--warn-soft)' : 'var(--bg-2)' }}><Icon name={x.status === 'ok' ? 'check' : x.status === 'fallback' ? 'refresh' : 'link'} size={16} style={{ flex: 'none' }} /><span><b>{x.name}</b> · {x.status}<br /><span className="muted">{x.detail}</span></span></div>)}
          </div>
        </section>
      )}
      <section className="card pad-lg">
        {users.loading ? <Skeleton h={240} /> : (
          <table className="table">
            <thead><tr><th>Account</th><th>Role</th><th>Status</th><th>Pieces</th><th>Joined</th><th /></tr></thead>
            <tbody>
              {users.data.users.map((u) => (
                <tr key={u.id}>
                  <td><b>{u.email}</b>{u.locked && <span className="tag rose" style={{ marginLeft: 8 }}>locked</span>}</td>
                  <td style={{ textTransform: 'capitalize' }}>{u.role}</td>
                  <td><span className={u.status === 'active' ? 'tag s1' : 'tag rose'}>{u.status}</span></td>
                  <td>{u.pieces}</td>
                  <td className="muted">{fmtDate(u.createdAt)}</td>
                  <td style={{ textAlign: 'right' }}>{u.id !== user.id && (u.status === 'active'
                    ? <button type="button" className="btn line sm" onClick={() => set(u, 'suspended')}><Icon name="x" size={14} />Suspend</button>
                    : <button type="button" className="btn sm" onClick={() => set(u, 'active')}><Icon name="check" size={14} />Restore</button>)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {stats.data && stats.data.deletionReasons.length > 0 && (
        <section className="card pad" style={{ marginTop: 20 }}><h3 style={{ marginBottom: 10 }}>Why pieces leave closets</h3><div className="chips">{stats.data.deletionReasons.map((r) => <span key={r.reason} className="chip">{r.reason} <span className="n">{r.n}</span></span>)}</div></section>
      )}
      {config.data && (
        <section className="card pad" style={{ marginTop: 20 }}>
          <div className="card-head"><h3>App configuration</h3><span className="tag s4">Read-only preview · US-83</span></div>
          <p className="small muted" style={{ marginBottom: 10 }}>The shared lists every module uses: {config.data.categories.length} categories, {config.data.statuses.length} statuses, {Object.keys(config.data.dressCodes).length} dress codes, {config.data.occasions.length} occasions and {config.data.templates.length} occasion templates.</p>
          <div className="chips">{config.data.switches.map((x) => <span key={x.key} className="chip">{x.label} <span className="n">{x.on ? 'on' : 'off'}</span></span>)}</div>
        </section>
      )}
      <div style={{ marginTop: 20 }}><SprintNote n={3}>Protected by Access Control: every /admin request is checked for role “admin” on the server; a normal user gets 403.</SprintNote></div>
    </>
  );
}
