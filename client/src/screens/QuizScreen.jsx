// US-02 style quiz on first sign-in (can be skipped).
import React, { useState } from 'react';
import { api } from '../api.js';
import { SprintTag, useApp } from '../ui.jsx';
import { go } from '../App.jsx';
import StyleProfileForm from './StyleProfileForm.jsx';

export default function QuizScreen() {
  const { profile, setProfile, toast, loadWeather } = useApp();
  const [value, setValue] = useState({ styles: profile.styles, colours: profile.colours, occasions: profile.occasions, dressCode: profile.dressCode, modest: profile.modest, city: profile.city || '' });
  const [busy, setBusy] = useState(false);

  async function save(skip) {
    setBusy(true);
    try {
      const body = skip ? {} : { ...value, city: value.city.trim() || undefined };
      setProfile(await api.saveQuiz(body));
      loadWeather();
      toast(skip ? 'You can fill in your style profile later' : 'Style profile saved');
      go('/');
    } catch (e) { toast(e.message, true); } finally { setBusy(false); }
  }

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '36px 24px 80px' }}>
      <div className="row between" style={{ marginBottom: 24 }}>
        <div className="logo" style={{ padding: 0 }}>closet<i /></div>
        <SprintTag n={1} />
      </div>
      <h1>Let’s learn your style</h1>
      <p className="muted" style={{ margin: '8px 0 28px', maxWidth: 620 }}>Five quick questions. Closet uses them to rank outfit ideas and to spot what your closet is really missing. You can change everything later.</p>
      <div className="card pad-lg"><StyleProfileForm value={value} onChange={setValue} /></div>
      <div className="row end" style={{ marginTop: 20 }}>
        <button type="button" className="btn ghost" onClick={() => save(true)} disabled={busy}>Skip for now</button>
        <button type="button" className="btn lg" onClick={() => save(false)} disabled={busy}>Save my style</button>
      </div>
    </div>
  );
}
