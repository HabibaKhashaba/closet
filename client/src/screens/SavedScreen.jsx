// Saved looks and favourites (US-26, US-51), including looks built in Mix & Match — shown as a lookbook:
// each look is a page, favourites carry a ribbon, and a look with a piece that is away says so.
import React, { useState } from 'react';
import { api } from '../api.js';
import { Empty, Icon, Look, PageHead, Skeleton, SprintNote, Tabs, fmtDate, useApp, useLoad } from '../ui.jsx';
import { go } from '../App.jsx';

export default function SavedScreen() {
  const { toast, refresh } = useApp();
  const [tab, setTab] = useState('all');
  const { data, loading, reload } = useLoad(() => api.outfits(tab === 'fav'), [tab]);
  async function remove(id) { try { await api.deleteOutfit(id); toast('Look removed from your lookbook'); reload(true); } catch (e) { toast(e.message, true); } }
  async function fav(o) { try { await api.favorite(o.id, !o.favorite); toast(o.favorite ? 'Removed from favourites' : 'Added to favourites'); reload(true); } catch (e) { toast(e.message, true); } }
  async function wear(o) { try { await api.wear(o.pieces.map((p) => p.id), null, o.occasion ? { occasion: o.occasion } : {}); toast('Marked as worn today'); refresh(); } catch (e) { toast(e.message, true); } }
  return (
    <>
      <PageHead title="Lookbook" sprint={2} sub="Every look you saved from a suggestion or built on the styling table — one page each." actions={<Tabs options={[['all', 'All looks'], ['fav', 'Favourites']]} value={tab} onChange={setTab} />} />
      {loading ? <div className="lookbook">{[0, 1, 2].map((i) => <Skeleton key={i} h={520} />)}</div>
        : !data.outfits.length ? <Empty icon="bookmark" title={tab === 'fav' ? 'No favourites yet' : 'Your lookbook is empty'} action={<a className="btn" href="#/outfits">Get outfit ideas</a>}>Tap the bookmark on any outfit to keep it here.</Empty>
          : (
            <div className="lookbook">
              {data.outfits.map((o, k) => (
                <article key={o.id} className="page-spread lift rise" style={{ animationDelay: `${k * 60}ms` }}>
                  {o.favorite && <span className="fav">FAVOURITE</span>}
                  <div className="folio"><span>No. {String(k + 1).padStart(2, '0')}</span><span>{o.occasion || 'Everyday'}</span></div>
                  <h3>{o.source === 'built' ? 'Built on the styling table' : `The ${(o.occasion || 'everyday').toLowerCase()} look`}</h3>
                  <Look pieces={o.pieces} labels animate={false} />
                  {o.reasons?.[0] && <p className="small serif" style={{ fontStyle: 'italic', color: 'var(--ink-2)' }}>“{o.reasons[0]}”</p>}
                  <div className="row between small">
                    <span className={o.wearable ? 'tag s1' : 'tag rose'}>{o.wearable ? 'Ready to wear' : 'A piece is away'}</span>
                    <span className="muted tiny">Saved {fmtDate(o.createdAt)}{o.ruleScore !== null ? ` · rule score ${o.ruleScore}` : ''}</span>
                  </div>
                  <div className="toolbar">
                    <button type="button" onClick={() => wear(o)} disabled={!o.wearable}><Icon name="check" size={14} />Wear</button>
                    <button type="button" onClick={() => go(`/tryon?ids=${o.pieces.map((p) => p.id).join(',')}`)}><Icon name="mirror" size={14} />Try on</button>
                    <button type="button" className={o.favorite ? 'on' : ''} onClick={() => fav(o)}><Icon name="heart" size={14} fill={o.favorite ? 'currentColor' : 'none'} />{o.favorite ? 'Favourite' : 'Favourite'}</button>
                    <button type="button" style={{ marginLeft: 'auto' }} onClick={() => remove(o.id)}><Icon name="trash" size={14} />Remove</button>
                  </div>
                </article>
              ))}
            </div>
          )}
      <div style={{ marginTop: 22 }}><SprintNote n={2} /></div>
    </>
  );
}
