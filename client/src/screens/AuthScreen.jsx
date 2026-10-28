// US-01: register and sign in with email (or Google, when a Google client ID is configured).
// Authentication is visible on purpose: password rules, lockout and session expiry are explained.
import React, { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../api.js';
import { Field, Icon } from '../ui.jsx';

const GOOGLE_ID = (import.meta.env && import.meta.env.VITE_GOOGLE_CLIENT_ID) || '';

function GoogleButton({ onCredential }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!GOOGLE_ID) return;
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.onload = () => {
      window.google.accounts.id.initialize({ client_id: GOOGLE_ID, callback: (r) => onCredential(r.credential) });
      window.google.accounts.id.renderButton(ref.current, { theme: 'outline', size: 'large', shape: 'pill', width: 356 });
    };
    document.body.appendChild(script);
  }, [onCredential]);
  if (!GOOGLE_ID) return null;
  return <><div className="or">or</div><div ref={ref} /></>;
}

const COLLAGE = [
  ['navy_silk_midi_dress', 'Dress', 0, 30, -6], ['beige_trench_coat', 'Layer', 130, 0, 4], ['cream_knit_sweater', 'Top', 262, 34, -3],
  ['beige_wide_leg_trousers', 'Bottom', 394, 8, 5], ['white_sneakers', 'Shoes', 526, 40, -4], ['structured_black_bag', 'Bag', 640, 12, 6],
];

export default function AuthScreen({ onSignedIn }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onSignedIn(mode === 'login' ? await api.login(email, password) : await api.register(email, password));
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, { message: 'Cannot reach Closet. Check your connection.' }));
    } finally {
      setBusy(false);
    }
  }
  const google = async (credential) => {
    try { onSignedIn(await api.google(credential)); } catch (err) { setError(err); }
  };

  return (
    <div className="auth">
      <section className="auth-art">
        <div className="logo">closet<i /></div>
        <div style={{ position: 'relative', zIndex: 2, marginTop: 'auto' }}>
          <span className="eyebrow" style={{ color: 'var(--rose-ink)' }}>Your AI wardrobe assistant</span>
          <h1 style={{ marginTop: 12 }}>Get dressed in seconds, with what you already own.</h1>
          <p>Closet knows every piece you own, what is in the laundry, the weather in your city and the events on your calendar — and suggests three outfits that actually work.</p>
          <div className="features">
            {['3 explained outfits a day', 'Weather-aware', 'Knows your laundry', 'Plan for your calendar', 'Ask in plain words'].map((f) => <span key={f} className="tag plain" style={{ background: 'rgba(255,255,255,.7)', padding: '6px 12px' }}>{f}</span>)}
          </div>
        </div>
        <div className="collage" aria-hidden="true">
          {COLLAGE.map(([f, c, x, y, r]) => (
            <div key={f} className={`tile ${c}`} style={{ left: x, top: y, transform: `rotate(${r}deg)` }}><img src={`/art/${f}.jpg`} alt="" /></div>
          ))}
        </div>
        <small className="muted" style={{ position: 'relative', zIndex: 2 }}>CSCE 3701 · Software Engineering · Fall 2026</small>
      </section>
      <section className="auth-form">
        <form className="card pad-lg" onSubmit={submit} noValidate>
          <h2 style={{ marginBottom: 6 }}>{mode === 'login' ? 'Welcome back' : 'Create your closet'}</h2>
          <p className="muted small" style={{ marginBottom: 18 }}>{mode === 'login' ? 'Sign in to see today’s outfits.' : 'It takes a minute. Your photos stay private.'}</p>
          <div className="tabs" style={{ marginBottom: 20, width: '100%', display: 'flex' }}>
            <button type="button" className={mode === 'login' ? 'on' : ''} style={{ flex: 1 }} onClick={() => { setMode('login'); setError(null); }}>Sign in</button>
            <button type="button" className={mode === 'register' ? 'on' : ''} style={{ flex: 1 }} onClick={() => { setMode('register'); setError(null); }}>Create account</button>
          </div>
          {error && !error.details.length && <div className="form-error" role="alert">{error.message}</div>}
          <Field label="Email" error={error?.field('email')}>
            <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" />
          </Field>
          <Field label="Password" error={error?.field('password')} hint={mode === 'register' ? '8–72 characters' : undefined}>
            <input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          <button className="btn block lg" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
          <GoogleButton onCredential={google} />
          {mode === 'login' && (
            <button type="button" className="btn ghost block sm" style={{ marginTop: 10 }} onClick={() => { setEmail('demo@closet.app'); setPassword('Closet2026!'); }}>Fill in the demo account</button>
          )}
          <div className="notice" style={{ marginTop: 18 }}>
            <Icon name="shield" size={18} style={{ color: 'var(--ok)', flex: 'none' }} />
            <span className="small muted">Passwords are hashed with bcrypt. Five wrong tries lock the account for 15 minutes. Sessions expire after 2 hours and end on sign-out.</span>
          </div>
        </form>
      </section>
    </div>
  );
}
