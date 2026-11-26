// Invitation decoder — v3.0, editorial design: invitation → editable event card → Planner + looks for the day.
import React, { useState } from 'react';
import { api } from '../../api.js';
import { WeatherPill, fmtDate, useApp } from '../../ui.jsx';
import { ACCENT, Choice, Cover, Drop, Fineprint, LookPanel, Step } from './editorial.jsx';
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
    <div className="ed" style={{ '--acc': ACCENT.invitation }}>
      <Cover feature="invitation" no={4} kicker="You’re invited" title="Invitation decoder" pick={['Emerald satin dress', 'Gold strappy heels', 'Champagne evening bag']}
        dek="Snap the card or paste the message. We read the date and the dress code, plan it, and dress you for that day’s weather." />
      <Step n={1} title="The invitation">
        <div className="ed-vs" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 0 }}>
          <Drop label="Drop a photo of the invitation" value={photo} onChange={setPhoto} onError={(m) => toast(m, true)} />
          <textarea className="input" rows={5} value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} aria-label="Invitation text"
            placeholder="…or paste it: “Join us for the wedding of Sara & Omar on 12 December at 7:30 pm. Dress code: black tie.”" />
        </div>
        <div className="ed-actions"><button type="button" className="ed-cta" disabled={busy || (!text.trim() && !photo)} onClick={decode}>{busy && !card ? 'Reading…' : 'Read invitation'}</button></div>
      </Step>

      {card && (
        <section className="ed-spread" style={{ gridTemplateColumns: '1fr' }}>
          <div className="ed-label">Your event card · edit anything</div>
          {decoded.message && <p className="ed-sub" style={{ color: '#8c2f2b' }}>{decoded.message}</p>}
          <input className="input ed-headline" style={{ border: 0, borderBottom: '2px solid var(--line)', background: 'transparent', width: '100%', padding: '4px 0' }} value={card.title} onChange={(e) => set('title', e.target.value)} aria-label="Event" />
          <div className="ed-row" style={{ marginTop: 18, gap: 26 }}>
            <label><div className="ed-label">Date</div><input className="input" type="date" value={card.date || ''} onChange={(e) => set('date', e.target.value)} style={{ fontFamily: 'var(--serif)', fontSize: 22, border: 0, background: 'transparent' }} /></label>
            <label><div className="ed-label">Time</div><input className="input" type="time" value={card.time || ''} onChange={(e) => set('time', e.target.value)} style={{ fontFamily: 'var(--serif)', fontSize: 22, border: 0, background: 'transparent' }} /></label>
          </div>
          <div className="ed-label" style={{ marginTop: 18 }}>Dress code{card.dressCodeText ? ` · the card says “${card.dressCodeText}”` : ''}</div>
          <div style={{ marginTop: 8 }}><Choice label="Dress code" options={[1, 2, 3, 4, 5]} render={(l) => vocab.DRESS_CODES[l]} value={card.dressCodeLevel} onChange={(v) => set('dressCodeLevel', v)} /></div>
          <div className="ed-actions"><button type="button" className="ed-cta" disabled={busy || !card.date} onClick={confirm}>Add to planner & style me</button></div>
          <Fineprint>{decoded.source === 'ai' ? 'Read by AI — check it before saving.' : 'Read by Closet’s keyword rules (no AI needed) — check it before saving.'}</Fineprint>
        </section>
      )}

      {done && (
        <Step n={2} title={`What to wear · ${fmtDate(done.event.date, { weekday: 'long', day: 'numeric', month: 'long' })}`} aside={<WeatherPill w={done.weather} />}>
          {done.note && <p className="ed-sub">{done.note}</p>}
          <div className="ed-grid">
            {done.looks.map((o, i) => (
              <LookPanel key={o.itemIds.join()} eyebrow={`Look ${i + 1}`} title={o.title} look={{ pieces: o.pieces, compatibility: o.compatibility, score: o.ruleScore }}>
                <button type="button" className="ed-link" onClick={async () => { try { await api.planOutfit(done.event.id, { itemIds: o.itemIds, ruleScore: o.ruleScore, reasons: o.reasons }); toast('Planned for the event'); go('/planner'); } catch (e) { toast(e.message, true); } }}>Plan this look</button>
              </LookPanel>
            ))}
          </div>
        </Step>
      )}
    </div>
  );
}
