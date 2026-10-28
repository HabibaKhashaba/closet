// Controller layer (MVC): routing, signed-in state and shared data. Screens are the views.
import React, { useCallback, useEffect, useState } from 'react';
import { api, session, whenSignedOut } from './api.js';
import { AppContext, Icon, Spinner, useToast, WeatherPill, SPRINT, relDay } from './ui.jsx';
import AuthScreen from './screens/AuthScreen.jsx';
import QuizScreen from './screens/QuizScreen.jsx';
import HomeScreen from './screens/HomeScreen.jsx';
import ClosetScreen from './screens/ClosetScreen.jsx';
import AddPieceScreen from './screens/AddPieceScreen.jsx';
import PieceScreen from './screens/PieceScreen.jsx';
import CareScreen from './screens/CareScreen.jsx';
import LendingScreen from './screens/LendingScreen.jsx';
import DonationScreen from './screens/DonationScreen.jsx';
import PlannerScreen from './screens/PlannerScreen.jsx';
import ProfileScreen from './screens/ProfileScreen.jsx';
import OutfitsScreen from './screens/OutfitsScreen.jsx';
import MixMatchScreen from './screens/MixMatchScreen.jsx';
import SavedScreen from './screens/SavedScreen.jsx';
import TryOnScreen from './screens/TryOnScreen.jsx';
import AskScreen from './screens/AskScreen.jsx';
import AnalyticsScreen from './screens/AnalyticsScreen.jsx';
import ShoppingScreen from './screens/ShoppingScreen.jsx';
import AdminScreen from './screens/AdminScreen.jsx';
import PackingScreen from './screens/PackingScreen.jsx';

function readRoute() {
  const raw = window.location.hash.replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?');
  return { path, parts: path.split('/').filter(Boolean), query: Object.fromEntries(new URLSearchParams(qs || '')) };
}
function useHashRoute() {
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const on = () => { setRoute(readRoute()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
export const go = (path) => { window.location.hash = path; };

// Navigation with the sprint each part belongs to (honest labelling for the demo).
const NAV = [
  ['Today', [['/', 'home', 'Home', null]]],
  ['Wardrobe', [['/closet', 'closet', 'Closet', 1], ['/care', 'laundry', 'Care', 1], ['/lending', 'user', 'Borrow & lend', 3], ['/donation', 'heart', 'Donation', 3]]],
  ['Style', [['/outfits', 'sparkle', 'Style me · 3 looks', 2], ['/mix', 'grid', 'Mix & Match', 2], ['/tryon', 'mirror', 'Virtual try-on', 3], ['/saved', 'bookmark', 'Lookbook', 2]]],
  ['Assistant', [['/ask', 'brain', 'Ask Closet', 3]]],
  ['Plan', [['/planner', 'calendar', 'Planner', 1], ['/packing', 'suitcase', 'Packing', 4]]],
  ['Insights', [['/analytics', 'chart', 'Analytics & insights', 3], ['/shopping', 'bag', 'Shopping bag', 3]]],
  ['You', [['/profile', 'user', 'Style profile & settings', 1]]],
];
const TABS = [['/', 'home', 'Home'], ['/outfits', 'sparkle', 'Outfits'], ['/ask', 'chat', 'Ask'], ['/closet', 'closet', 'Closet']];

const N_ICON = { conflict: 'alert', plan: 'calendar', forgotten: 'wand', wash: 'washer', laundry: 'washer', packing: 'suitcase', due: 'clock', weather: 'cloud' };
// Notification Center (US-92): notices from Planner, Availability, Packing, Analytics and Weather in one place.
function NotificationCenter({ data, onClose, onRead }) {
  const list = data?.notifications || [];
  return (
    <div className="notif" role="dialog" aria-label="Notifications">
      <div className="row between" style={{ marginBottom: 6 }}>
        <div><h3>Notifications</h3><span className="tiny muted">{data ? `${data.unread} unread · at most ${data.dailyLimit} highlighted a day` : 'Loading…'}</span></div>
        <div className="row" style={{ gap: 6 }}>
          {data && data.unread > 0 && <button type="button" className="btn ghost sm" onClick={() => onRead(list.filter((n) => !n.read).map((n) => n.key))}>Mark all read</button>}
          <button type="button" className="iconbtn" style={{ width: 32, height: 32 }} onClick={onClose} aria-label="Close notifications"><Icon name="x" size={15} /></button>
        </div>
      </div>
      {!list.length && <p className="muted small" style={{ padding: '18px 4px' }}>You’re all caught up.</p>}
      {list.map((n) => (
        <a key={n.key} className={`notif-item ${n.read ? 'read' : 'unread'}`} href={n.link} onClick={() => { onRead([n.key]); onClose(); }}>
          <span className={`ni ${n.kind}`}><Icon name={N_ICON[n.kind] || 'bell'} size={17} /></span>
          <span className="small"><b>{n.title}</b><br />{n.text}<br /><span className="tiny muted">{relDay(n.date)}{n.highlight ? ' · today’s highlight' : ''}</span></span>
        </a>
      ))}
      <p className="tiny muted" style={{ marginTop: 8, padding: '0 6px' }}><SprintPill /> In-app today; push and e-mail come with the Notification Service adapter.</p>
    </div>
  );
}
const SprintPill = () => <span className="tag s3" style={{ marginRight: 6 }}>Sprint 3 · preview</span>;

export default function App() {
  const route = useHashRoute();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [vocab, setVocab] = useState(null);
  const [weather, setWeather] = useState(null);
  const [laundryCount, setLaundryCount] = useState(0);
  const [notes, setNotes] = useState(null);
  const [showNotes, setShowNotes] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [booting, setBooting] = useState(true);
  const [toastView, toast] = useToast();

  const signOut = useCallback(async () => { try { await api.logout(); } catch { /* already gone */ } session.clear(); setUser(null); setProfile(null); go('/'); }, []);
  useEffect(() => whenSignedOut(() => { setUser(null); setProfile(null); }), []);

  const refresh = useCallback(() => {
    api.laundry().then((r) => setLaundryCount(r.count)).catch(() => {});
    api.notifications().then(setNotes).catch(() => {});
  }, []);
  const loadWeather = useCallback(() => api.weather().then(setWeather).catch(() => {}), []);

  const signedIn = useCallback(async ({ token, user: u }) => {
    session.set(token);
    const p = await api.profile();
    setProfile(p);
    setUser(u);
    refresh(); loadWeather();
    go(p.quizCompleted ? '/' : '/quiz');
  }, [refresh, loadWeather]);

  useEffect(() => {
    api.vocabulary().then(setVocab).catch(() => {});
    if (!session.token) { setBooting(false); return; }
    api.me().then(async ({ user: u }) => { setUser(u); setProfile(await api.profile()); refresh(); loadWeather(); })
      .catch(() => session.clear())
      .finally(() => setBooting(false));
  }, [refresh, loadWeather]);

  if (booting || !vocab) return <Spinner />;
  const ctx = { user, profile, setProfile, vocab, toast, signOut, refresh, laundryCount, weather, loadWeather, route };
  if (!user) return <AppContext.Provider value={ctx}><AuthScreen onSignedIn={signedIn} />{toastView}</AppContext.Provider>;

  if (!profile) return <Spinner />;
  const [section, id] = route.parts;
  const q = route.query;
  let screen;
  if (section === 'quiz') screen = <QuizScreen />;
  else if (section === 'closet' && id === 'new') screen = <AddPieceScreen />;
  else if (section === 'closet' && id) screen = <PieceScreen id={id} />;
  else if (section === 'closet') screen = <ClosetScreen key={q.status || ''} query={q} />;
  else if (section === 'laundry') screen = <CareScreen tab="laundry" />;
  else if (section === 'care') screen = <CareScreen tab={id === 'repairs' ? 'repairs' : 'laundry'} />;
  else if (section === 'lending') screen = <LendingScreen />;
  else if (section === 'donation') screen = <DonationScreen />;
  else if (section === 'planner') screen = <PlannerScreen query={q} />;
  else if (section === 'profile') screen = <ProfileScreen />;
  else if (section === 'outfits') screen = <OutfitsScreen key={JSON.stringify(q)} query={q} />;
  else if (section === 'mix') screen = <MixMatchScreen key={q.ids || ''} query={q} />;
  else if (section === 'saved') screen = <SavedScreen />;
  else if (section === 'tryon') screen = <TryOnScreen key={q.ids || ''} query={q} />;
  else if (section === 'ask') screen = <AskScreen query={q} />;
  else if (section === 'analytics') screen = <AnalyticsScreen />;
  else if (section === 'shopping') screen = <ShoppingScreen />;
  else if (section === 'packing') screen = <PackingScreen />;
  else if (section === 'admin' && user.role === 'admin') screen = <AdminScreen />;
  else screen = <HomeScreen />;

  const current = `/${section || ''}`;
  const isOn = (path) => (path === '/' ? current === '/' : current === path || (path === '/care' && current === '/laundry'));
  const name = profile?.displayName || user.email.split('@')[0];
  if (section === 'quiz') return <AppContext.Provider value={ctx}>{screen}{toastView}</AppContext.Provider>;

  const nav = NAV.map(([group, items]) => (
    <div className="nav-group" key={group}>
      <span>{group}</span>
      <nav className="nav">
        {items.map(([path, icon, label, sprint]) => (
          <a key={path} href={`#${path}`} className={isOn(path) ? 'on' : ''} onClick={() => setMoreOpen(false)}>
            <Icon name={icon} size={18} />{label}
            {path === '/care' && laundryCount > 0 ? <span className="count">{laundryCount}</span> : sprint && <span className={`dot ${SPRINT[sprint].cls}`} title={SPRINT[sprint].label} />}
          </a>
        ))}
        {group === 'You' && user.role === 'admin' && (
          <a href="#/admin" className={isOn('/admin') ? 'on' : ''}><Icon name="shield" size={18} />Admin<span className="dot s3" title={SPRINT[3].label} /></a>
        )}
      </nav>
    </div>
  ));

  return (
    <AppContext.Provider value={ctx}>
      <div className="shell">
        <aside className="side">
          <a className="logo" href="#/">closet<i /><small>AI wardrobe</small></a>
          {nav}
          <div className="side-foot">
            <div className="legend">
              <span><i className="dot s1" style={{ width: 7, height: 7, borderRadius: 9 }} />Sprint 1 · implemented, graded</span>
              <span><i className="dot s2" style={{ width: 7, height: 7, borderRadius: 9 }} />Sprint 2 · early preview</span>
              <span><i className="dot s3" style={{ width: 7, height: 7, borderRadius: 9 }} />Sprint 3 · product preview</span>
              <span><i className="dot s4" style={{ width: 7, height: 7, borderRadius: 9 }} />Stretch · concept preview</span>
            </div>
            <a className="me" href="#/profile"><span className="avatar">{name[0].toUpperCase()}</span><span className="grow"><b style={{ fontSize: 14 }}>{name}</b><br /><span className="tiny muted">{user.email}</span></span></a>
          </div>
        </aside>
        <div className="main">
          <header className="topbar">
            <span className="logo" style={{ padding: 0, fontSize: 24 }} data-mobile-only>closet<i /></span>
            <span className="grow" />
            <a href="#/outfits"><WeatherPill w={weather} /></a>
            <div style={{ position: 'relative' }}>
              <button type="button" className="iconbtn" aria-label={`Notifications${notes?.unread ? `, ${notes.unread} unread` : ''}`} aria-expanded={showNotes} onClick={() => { setShowNotes((x) => !x); if (!showNotes) refresh(); }}><Icon name="bell" />{notes?.unread > 0 && <span className="pip" />}</button>
              {showNotes && <NotificationCenter data={notes} onClose={() => setShowNotes(false)} onRead={(keys) => keys.length && api.markRead(keys).then(refresh).catch(() => {})} />}
            </div>
            <button type="button" className="iconbtn" aria-label="Sign out" title="Sign out" onClick={signOut}><Icon name="logout" /></button>
          </header>
          <main className="page">{screen}</main>
        </div>
      </div>
      <nav className="tabbar" aria-label="Main">
        {TABS.map(([path, icon, label]) => <a key={path} href={`#${path}`} className={isOn(path) ? 'on' : ''}><Icon name={icon} size={20} />{label}</a>)}
        <button type="button" className={moreOpen ? 'on' : ''} onClick={() => setMoreOpen(true)}><Icon name="more" size={20} />More</button>
      </nav>
      {moreOpen && (
        <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && setMoreOpen(false)} style={{ alignItems: 'end', padding: 0 }}>
          <div className="card pad" style={{ width: '100%', borderRadius: '24px 24px 0 0', maxHeight: '80vh', overflowY: 'auto' }}>{nav}</div>
        </div>
      )}
      {toastView}
    </AppContext.Provider>
  );
}
