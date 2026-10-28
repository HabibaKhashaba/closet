// Style profile (US-02 – US-04) and personal settings. Version 1.2 adds the customization asked
// for in the review: laundry basket time, laundry day, recycle (repeat) time and reminders.
import React, { useState } from 'react';
import { api } from '../api.js';
import { Field, Icon, Modal, PageHead, RangeRow, SprintTag, Toggle, relDay, useApp, useLoad } from '../ui.jsx';
import StyleProfileForm from './StyleProfileForm.jsx';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const PHRASE = 'DELETE MY ACCOUNT';

export default function ProfileScreen() {
  const { profile, setProfile, toast, user, signOut, loadWeather, refresh } = useApp();
  const [style, setStyle] = useState({ styles: profile.styles, colours: profile.colours, occasions: profile.occasions, dressCode: profile.dressCode, modest: profile.modest, city: profile.city || '' });
  const [rules, setRules] = useState({ displayName: profile.displayName || '', laundryDays: profile.laundryDays, laundryAutoReturn: profile.laundryAutoReturn, laundryWeekday: profile.laundryWeekday, repeatDays: profile.repeatDays, reminders: profile.reminders, reminderHour: profile.reminderHour });
  const [deleting, setDeleting] = useState(false);
  const [typed, setTyped] = useState('');
  const [password, setPassword] = useState('');
  const setR = (k) => (v) => setRules({ ...rules, [k]: v });
  const activity = useLoad(() => api.activity(), []);

  async function saveStyle() {
    try { setProfile(await api.updateProfile({ ...style, city: style.city.trim() || null })); loadWeather(); toast('Style profile saved'); } catch (e) { toast(e.message, true); }
  }
  async function saveRules() {
    try {
      const body = { ...rules, displayName: rules.displayName.trim() || undefined };
      setProfile(await api.updateProfile(body)); refresh(); toast('Settings saved');
    } catch (e) { toast(e.message, true); }
  }
  async function deleteAccount() {
    try { await api.deleteAccount(typed, password); toast('Your account and all your data were deleted'); signOut(); } catch (e) { toast(e.message, true); }
  }

  return (
    <>
      <PageHead title="Style profile & settings" sprint={1} sub="Everything Closet knows about your taste and how you like to live with your clothes." />
      <div className="dash">
        <section className="card pad-lg">
          <div className="card-head"><h2>Your style</h2><button type="button" className="btn" onClick={saveStyle}>Save style</button></div>
          <StyleProfileForm value={style} onChange={setStyle} />
        </section>
        <div className="stack lg">
          <section className="card pad">
            <div className="card-head"><h3>Wardrobe rules</h3><SprintTag n={2} /></div>
            <p className="small muted" style={{ marginTop: -6, marginBottom: 12 }}>Requested in the Milestone 1 review (US-84 – US-87), built early.</p>
            <Field label="Your name"><input value={rules.displayName} maxLength={40} onChange={(e) => setR('displayName')(e.target.value)} placeholder="Habiba" /></Field>
            <RangeRow label="Laundry basket time" sub="How long a piece usually stays in the wash" value={rules.laundryDays} min={1} max={7} onChange={setR('laundryDays')} format={(v) => `${v} day${v === 1 ? '' : 's'}`} />
            <Toggle label="Bring pieces back automatically" sub="After the basket time, pieces become Available again" value={rules.laundryAutoReturn} onChange={setR('laundryAutoReturn')} />
            <div style={{ padding: '14px 0', borderBottom: '1px solid var(--line-2)' }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Laundry day</div>
              <div className="small muted" style={{ marginBottom: 10 }}>Shown on your calendar, with a reminder the evening before</div>
              <div className="chips">
                <button type="button" className={`chip ${rules.laundryWeekday === null ? 'on' : ''}`} onClick={() => setR('laundryWeekday')(null)}>None</button>
                {DAYS.map((d, i) => <button type="button" key={d} className={`chip ${rules.laundryWeekday === i ? 'on' : ''}`} onClick={() => setR('laundryWeekday')(i)}>{d}</button>)}
              </div>
            </div>
            <RangeRow label="Recycle time" sub="Don’t suggest the same top, bottom or dress again within…" value={rules.repeatDays} min={0} max={14} onChange={setR('repeatDays')} format={(v) => (v === 0 ? 'Any time' : `${v} day${v === 1 ? '' : 's'}`)} />
            <Toggle label="Reminders" sub="Plan-an-outfit, items due back, laundry day" value={rules.reminders} onChange={setR('reminders')} />
            {rules.reminders && <RangeRow label="Remind me at" value={rules.reminderHour} min={6} max={23} onChange={setR('reminderHour')} format={(v) => `${String(v).padStart(2, '0')}:00`} />}
            <button type="button" className="btn block" style={{ marginTop: 14 }} onClick={saveRules}>Save settings</button>
          </section>

          <section className="card pad">
            <div className="card-head"><h3>Account & security</h3><SprintTag n={1} short /></div>
            <dl className="kv"><dt>Email</dt><dd>{user.email}</dd><dt>Role</dt><dd style={{ textTransform: 'capitalize' }}>{user.role}</dd><dt>Session</dt><dd>Ends after 2 hours or on sign-out</dd></dl>
            <div className="row" style={{ marginTop: 16 }}>
              <button type="button" className="btn line sm" onClick={signOut}><Icon name="logout" size={15} />Sign out everywhere</button>
              <button type="button" className="btn ghost sm" style={{ color: 'var(--bad)' }} onClick={() => setDeleting(true)}><Icon name="trash" size={15} />Delete account</button>
            </div>
          </section>
          <section className="card pad">
            <div className="card-head"><div className="row"><h3>Recent activity</h3><SprintTag n={2} short /></div><Icon name="activity" size={18} /></div>
            <p className="small muted" style={{ marginTop: -6, marginBottom: 10 }}>Sign-ins and changes to your closet, written by the API’s audit step. Only you can see this.</p>
            <div className="activity">
              {(activity.data?.activity || []).slice(0, 25).map((a) => (
                <div key={a.id}><Icon name={/Sign/.test(a.action) ? 'lock' : /Laundry|Wash/.test(a.action) ? 'washer' : /Pack/.test(a.action) ? 'suitcase' : /deleted/.test(a.action) ? 'trash' : /Profile|Learned/.test(a.action) ? 'user' : 'check'} size={15} /><span><b style={{ fontWeight: 600 }}>{a.action}</b>{a.detail ? <span className="muted"> · {a.detail}</span> : null}</span><span className="when">{relDay(new Date(a.at).toISOString().slice(0, 10))} {new Date(a.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span></div>
              ))}
            </div>
          </section>
        </div>
      </div>
      {deleting && (
        <Modal title="Delete your account?" sub="This removes your account, every piece, photo, outfit and event. It cannot be undone." onClose={() => setDeleting(false)}>
          <Field label={`Type ${PHRASE} to confirm`}><input value={typed} onChange={(e) => setTyped(e.target.value)} /></Field>
          <Field label="Your password"><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          <div className="row end"><button type="button" className="btn line" onClick={() => setDeleting(false)}>Cancel</button><button type="button" className="btn danger" disabled={typed !== PHRASE} onClick={deleteAccount}>Delete forever</button></div>
        </Modal>
      )}
    </>
  );
}
