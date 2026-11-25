// Invitation decoder — v3.0: an invitation photo or text → an editable event card → Planner + looks.
import React, { useState } from 'react';
import { api } from '../../api.js';
import { Chips, Field, Icon, PageHead, SprintNote, WeatherPill, useApp } from '../../ui.jsx';
import { LookCard, PhotoInput, Source } from './common.jsx';
import { go } from '../../App.jsx';

export default function InvitationScreen() {
  const { vocab, toast } = useApp();
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState(null);
  const [decoded, setDecoded] = useState(null);
  const [card, setCard] = useState(null);
  const [done, setDone] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setCard((c) => ({ ...c, [k]: v }));

  async function decode() {
    setBusy(true); setDone(null);
    try { const r = await api.inviteDecode({ text, ...(photo && { photo: { base64: photo.base64, mime: photo.mime } }) }); setDecoded(r); setCard(r.card); } catch (e) { toast(e.message, true); } finally { setBusy(false); }
  }
  async function confirm() {
    setBusy(true);
    try { setDone(await api.inviteConfirm(card)); toast('Added to your planner'); } catch (e) { toast(e.message, true); } finally { setBusy(false); }
  }
  return (
    <>
      <PageHead title="Invitation decoder" sub="Snap or paste an invitation. Closet reads the date and dress code, adds it to your planner and styles you for the day’s weather." />
      <div className="studio">
        <section className="table-board stack lg">
          <PhotoInput label="Photo of the invitation" value={photo} onChange={setPhoto} onError={(m) => toast(m, true)} />
          <textarea className="input" rows={4} value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} aria-label="Invitation text" placeholder="…or paste the text: “Join us for the wedding of Sara & Omar on 12 December at 7:30 pm. Dress code: black tie.”" />
          <div className="row"><button type="button" className="btn rose" disabled={busy || (!text.trim() && !photo)} onClick={decode}><Icon name="mail" size={15} />{busy && !card ? 'Reading…' : 'Read invitation'}</button></div>
        </section>
        <section className="verdict-card stack lg" aria-live="polite">
          {!card ? <p className="muted">The event card appears here — you can edit every field before saving.</p> : (
            <>
              {decoded.message && <div className="notice warn small" style={{ color: 'var(--ink)' }}>{decoded.message}</div>}
              <Field label="Event"><input className="input" value={card.title} onChange={(e) => set('title', e.target.value)} /></Field>
              <div className="row" style={{ gap: 10 }}>
                <Field label="Date"><input className="input" type="date" value={card.date || ''} onChange={(e) => set('date', e.target.value)} /></Field>
                <Field label="Time"><input className="input" type="time" value={card.time || ''} onChange={(e) => set('time', e.target.value)} /></Field>
              </div>
              <Field label="Dress code" hint={card.dressCodeText ? `Invitation says: “${card.dressCodeText}”` : null}>
                <Chips options={[1, 2, 3, 4, 5]} render={(l) => vocab.DRESS_CODES[l]} value={card.dressCodeLevel} multiple={false} onChange={(v) => set('dressCodeLevel', v || card.dressCodeLevel)} />
              </Field>
              <div className="row"><button type="button" className="btn" disabled={busy || !card.date} onClick={confirm}><Icon name="calendar" size={15} />Add to planner & style me</button></div>
              <Source source={decoded.source} />
            </>
          )}
        </section>
      </div>
      {done && (
        <section style={{ marginTop: 20 }} className="stack lg">
          <div className="row between"><h3 style={{ margin: 0 }}>Looks for {done.event.title}</h3><WeatherPill w={done.weather} /></div>
          {done.note && <p className="small muted">{done.note}</p>}
          <div className="studio-looks">
            {done.looks.map((o, i) => (
              <LookCard key={o.itemIds.join()} title={o.title || `Look ${i + 1}`} look={{ pieces: o.pieces, compatibility: o.compatibility, score: o.ruleScore }}>
                <button type="button" className="btn line sm" onClick={async () => { try { await api.planOutfit(done.event.id, { itemIds: o.itemIds, ruleScore: o.ruleScore, reasons: o.reasons }); toast('Planned for the event'); go('/planner'); } catch (e) { toast(e.message, true); } }}>Plan this look</button>
              </LookCard>
            ))}
          </div>
        </section>
      )}
      <div style={{ marginTop: 20 }}><SprintNote n={5} /></div>
    </>
  );
}
