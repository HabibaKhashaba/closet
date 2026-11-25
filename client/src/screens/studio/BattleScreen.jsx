// Stylist battle — v3.0: The Classic vs The Rule Breaker style the same occasion; you vote.
import React, { useState } from 'react';
import { api } from '../../api.js';
import { Chips, Icon, PageHead, SprintNote, useApp } from '../../ui.jsx';
import { LookCard } from './common.jsx';

export default function BattleScreen() {
  const { vocab, toast } = useApp();
  const [occasion, setOccasion] = useState('Dinner');
  const [res, setRes] = useState(null);
  const [voted, setVoted] = useState(null);
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true); setVoted(null);
    try { setRes(await api.battle({ occasion })); } catch (e) { toast(e.message, true); } finally { setBusy(false); }
  }
  async function vote(l) {
    try { const r = await api.battleVote({ winner: l.persona, itemIds: l.itemIds, occasion }); setVoted(l.persona); setRes((x) => ({ ...x, votes: r.votes })); } catch (e) { toast(e.message, true); }
  }
  return (
    <>
      <PageHead title="Stylist battle" sub="Two stylists, one closet. Both looks pass the same rules — you pick the winner, and Closet learns your taste." />
      <section className="table-board stack lg">
        <Chips options={Object.keys(vocab.OCCASIONS)} value={occasion} multiple={false} onChange={(v) => setOccasion(v || occasion)} />
        <div className="row"><button type="button" className="btn rose" disabled={busy} onClick={run}><Icon name="trophy" size={15} />{busy ? 'Styling…' : res ? 'New battle' : 'Start the battle'}</button>
          {res && <span className="small muted">Your votes so far — The Classic {res.votes.classic} · The Rule Breaker {res.votes.rebel}</span>}</div>
      </section>
      <section style={{ marginTop: 20 }} aria-live="polite">
        {res && (res.looks.length ? (
          <div className="studio-looks">
            {res.looks.map((l) => (
              <LookCard key={l.persona} title={l.name} look={l}>
                <p className="persona-line">“{l.line}”</p>
                <button type="button" className={`btn ${voted === l.persona ? 'rose' : 'line'}`} disabled={!!voted} onClick={() => vote(l)}>{voted === l.persona ? 'Winner' : 'Vote for this look'}</button>
              </LookCard>
            ))}
          </div>
        ) : <p className="muted">{res.message}</p>)}
        {res && <p className="tiny muted" style={{ marginTop: 10 }}>{res.ai ? 'The stylists’ lines were written by AI. ' : ''}Looks and scores come from Closet’s rules.</p>}
      </section>
      <div style={{ marginTop: 20 }}><SprintNote n={5} /></div>
    </>
  );
}
