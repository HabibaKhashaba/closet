// Stylist battle — v3.0, editorial design: The Classic vs The Rule Breaker, same closet, you vote.
import React, { useState } from 'react';
import { api } from '../../api.js';
import { useApp } from '../../ui.jsx';
import { ACCENT, Choice, Cover, Fineprint, LookPanel, Step } from './editorial.jsx';

const SIDE = { classic: '#2a2626', rebel: '#9c5f5b' };

export default function BattleScreen() {
  const { vocab, toast } = useApp();
  const [occasion, setOccasion] = useState('Dinner');
  const [res, setRes] = useState(null);
  const [voted, setVoted] = useState(null);
  const [busy, setBusy] = useState(false);
  async function run(occ = occasion) {
    setBusy(true); setVoted(null);
    try { setRes(await api.battle({ occasion: occ })); } catch (e) { toast(e.message, true); } finally { setBusy(false); }
  }
  async function vote(l) {
    try { const r = await api.battleVote({ winner: l.persona, itemIds: l.itemIds, occasion }); setVoted(l.persona); setRes((x) => ({ ...x, votes: r.votes })); } catch (e) { toast(e.message, true); }
  }
  return (
    <div className="ed" style={{ '--acc': ACCENT.battle }}>
      <Cover feature="battle" no={8} kicker="Two stylists · one closet" title="Stylist battle" pick={['Navy blazer', 'Red cropped tee', 'Gold hoop earrings']}
        dek="The Classic versus The Rule Breaker. Both looks pass the same rules — you choose the winner, and Closet learns your taste." />
      <Step n={1} title="Tonight’s brief" aside={res && <span className="ed-fine">Score so far — Classic {res.votes.classic} · Rule Breaker {res.votes.rebel}</span>}>
        <Choice label="Occasion" options={Object.keys(vocab.OCCASIONS)} value={occasion} onChange={(o) => { setOccasion(o); if (res) run(o); }} />
        <div className="ed-actions"><button type="button" className="ed-cta" disabled={busy} onClick={() => run()}>{busy ? 'Styling…' : res ? 'New round' : 'Start the battle'}</button></div>
      </Step>
      {res && (res.looks.length ? (
        <div className="ed-vs">
          {res.looks.map((l, i) => (
            <React.Fragment key={l.persona}>
              {i === 1 && <div className="ed-vs-mark">vs</div>}
              <div style={{ '--acc': SIDE[l.persona], opacity: voted && voted !== l.persona ? 0.55 : 1, transition: 'opacity .3s' }}>
                <LookPanel eyebrow={l.persona === 'classic' ? 'Stylist A' : 'Stylist B'} title={l.name} look={l} quote={l.line}>
                  <button type="button" className="ed-cta" disabled={!!voted} onClick={() => vote(l)}>{voted === l.persona ? 'Winner ✓' : 'Vote for this look'}</button>
                </LookPanel>
              </div>
            </React.Fragment>
          ))}
        </div>
      ) : <p className="ed-sub">{res.message}</p>)}
      {res && <Fineprint>{res.ai ? 'The stylists’ lines were written by AI. ' : ''}Looks and scores come from Closet’s rules.</Fineprint>}
    </div>
  );
}
