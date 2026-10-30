// Virtual Try-On Preview — the dressing room (US-27, Sprint 3, built early; opened from every look).
// The user chooses a full-body photo of herself; the look is placed on it (simulated overlay of
// each piece's own photo — see photoTryOn.js). The photo never leaves this browser tab.
// Flip between the same three looks (a changed piece is kept); wear, save, favourite or change a piece.
// Without a photo, the stylised avatar is the fallback. A photo-real provider is a planned adapter.
import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { CountUp, Icon, Skeleton, SprintTag, Tile, matchWord, pieceName, useApp, CATEGORY_ONE } from '../ui.jsx';
import { avatarSVG, SKIN_TONES } from '../avatar.js';
import { go } from '../App.jsx';
import { FlowRail, storedLooks } from './OutfitsScreen.jsx';
import { DEFAULT_FIT, cutout, loadFit, loadPhoto, region, removePhoto, saveFit, storePhoto } from '../photoTryOn.js';

// The look on the user's photo: the photo keeps its own shape; pieces sit on body regions.
function OnPhoto({ photo, pieces, fit }) {
  const [ratio, setRatio] = useState(0.5);
  const [cuts, setCuts] = useState({});
  useEffect(() => { const i = new Image(); i.onload = () => setRatio(i.width / i.height); i.src = photo; }, [photo]);
  useEffect(() => {
    let live = true;
    pieces.forEach((p) => cutout(p.photoUrl).then((c) => live && setCuts((m) => ({ ...m, [p.id]: c }))).catch(() => {}));
    return () => { live = false; };
  }, [pieces]);
  const bh = 0.9 * (fit.scale / 100);                   // body height, share of the photo height
  const bw = (0.27 * bh) / ratio;                        // shoulder span, share of the photo width
  const top0 = 0.05 + fit.y / 100;
  return (
    <div className="on-photo" style={{ aspectRatio: String(ratio) }}>
      <img className="me" src={photo} alt="You" />
      {pieces.map((p) => {
        const r = region(p); const c = cuts[p.id]; if (!c) return null;
        const wFrac = r.w * bw * 2;                       // width of the piece, share of the photo width
        const hFrac = Math.min(wFrac * c.ratio * ratio, r.maxH * bh);
        const w = hFrac / (c.ratio * ratio);
        const cx = fit.x / 100 + (r.cx - 0.5) * bw * 2;
        return <img key={p.id} className="worn" src={c.src} alt={pieceName(p)}
          style={{ left: `${(cx - w / 2) * 100}%`, top: `${(top0 + r.top * bh) * 100}%`, width: `${w * 100}%`, zIndex: r.z, opacity: r.alpha || 1 }} />;
      })}
    </div>
  );
}

// LED vanity bulbs around the arched mirror: 7 on the arch, 4 down each side (percent of the frame).
const BULBS = [
  ...Array.from({ length: 7 }, (_, k) => { const a = Math.PI - (k * Math.PI) / 6; return [50 + 50 * Math.cos(a), 30 - 30 * Math.sin(a)]; }),
  ...[44, 59, 74, 89].flatMap((y) => [[0, y], [100, y]]),
];

export default function TryOnScreen({ query }) {
  const { toast, refresh, profile } = useApp();
  const [looks, setLooks] = useState(null);
  const [meta, setMeta] = useState({});
  const [i, setI] = useState(0);
  const [tone, setTone] = useState(SKIN_TONES[1]);
  const [done, setDone] = useState({});
  const [photo, setPhoto] = useState(() => loadPhoto());
  const [fit, setFit] = useState(() => loadFit());
  const [avatar, setAvatar] = useState(false);
  async function choosePhoto(e) {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    try { setPhoto(await storePhoto(f)); setAvatar(false); toast('Your photo is ready — it stays in this tab only'); } catch (err) { toast(err.message, true); }
  }
  function forgetPhoto() { removePhoto(); setPhoto(null); setFit({ ...DEFAULT_FIT }); toast('Photo removed from this browser'); }
  const changeFit = (k, v) => { const f = { ...fit, [k]: v }; setFit(f); saveFit(f); };

  useEffect(() => {
    (async () => {
      try {
        const all = (await api.items()).items;
        const byId = (id) => all.find((p) => p.id === id);
        const st = storedLooks();
        const stored = st && st.result ? { ...st, outfits: st.result.outfits } : null;
        if (query.ids) {
          const ids = query.ids.split(',');
          // The look came from Style me: show it among its three looks so the user can flip between them.
          const list = stored && stored.outfits.some((o) => o.itemIds.join() === ids.join()) ? stored.outfits
            : stored && query.look !== undefined && stored.outfits[Number(query.look)] ? stored.outfits.map((o, j) => (j === Number(query.look) ? { ...o, itemIds: ids } : o))
              : [{ title: 'Your look', itemIds: ids }];
          const resolved = list.map((o) => ({ ...o, pieces: o.itemIds.map(byId).filter(Boolean) })).filter((o) => o.pieces.length >= 2);
          setLooks(resolved);
          setMeta(stored || {});
          setI(Math.max(0, resolved.findIndex((o) => o.itemIds.join() === ids.join())));
        } else {
          const r = await api.recommend({ occasion: profile.occasions[0] || 'Everyday' });
          setLooks(r.outfits); setMeta({ occasion: profile.occasions[0], levelName: r.levelName, tempC: r.weather.tempC });
        }
      } catch (e) { toast(e.message, true); setLooks([]); }
    })();
  }, [query.ids, query.look, profile.occasions, toast]);

  const look = looks && looks[i];
  const svg = useMemo(() => (look ? avatarSVG(look.pieces, tone) : ''), [look, tone]);
  const ids = look ? look.pieces.map((p) => p.id) : [];

  async function wear() { try { await api.wear(ids, null, meta.occasion ? { occasion: meta.occasion } : {}); setDone({ ...done, [i]: 'worn' }); toast('Worn today — wear counts updated'); refresh(); } catch (e) { toast(e.message, true); } }
  async function save(favorite) { try { await api.saveOutfit({ itemIds: ids, occasion: meta.occasion, ruleScore: look.ruleScore, reasons: look.reasons || [], ...(favorite && { favorite: true }) }); setDone({ ...done, [i]: favorite ? 'fav' : 'saved' }); toast(favorite ? 'Favourite saved — Closet learns from it' : 'Saved to your lookbook'); } catch (e) { toast(e.message, true); } }

  return (
    <>
      <div className="tryon-head">
        <div><SprintTag n={3} /><h1 style={{ marginTop: 8 }}>Virtual try-on</h1></div>
        <button type="button" className="btn line" onClick={() => go(meta.result ? '/outfits?back=1' : '/outfits')}><Icon name="back" size={15} />Back to my looks</button>
      </div>
      <FlowRail at={3} />
      {!looks ? <Skeleton h={640} /> : !look ? <div className="card pad">No look to try on. <a className="link" href="#/outfits">Generate three looks</a></div> : (
        <div className="fitting-room">
          <div className="stage" aria-label="Dressing room">
            <div className="curtain left" /><div className="curtain right" />
            <div className="stage-light" />
            <div className={`vanity ${photo && !avatar ? 'photo' : ''}`}>
              <div className="bulbs" aria-hidden="true">{BULBS.map(([x, y], k) => <i key={k} style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${k * 0.15}s` }} />)}</div>
              {photo && !avatar ? (
                <div className="mirror-glass photo-glass" key={`p${i}`}><OnPhoto photo={photo} pieces={look.pieces} fit={fit} /></div>
              ) : avatar ? (
                // eslint-disable-next-line react/no-danger
                <div className="mirror-glass" key={i + tone} dangerouslySetInnerHTML={{ __html: svg }} />
              ) : (
                <div className="mirror-glass upload-glass">
                  <div className="upload-card">
                    <Icon name="mirror" size={30} />
                    <b>See this look on you</b>
                    <span className="small">Choose a full-body photo of yourself, standing, facing the camera.</span>
                    <label className="btn"><Icon name="camera" size={15} />Choose my photo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto} hidden aria-label="Choose my photo" /></label>
                    <span className="tiny privacy">Your photo stays in this browser tab. It is never uploaded to Closet, and you can remove it any time.</span>
                    <button type="button" className="link-btn tiny" onClick={() => setAvatar(true)}>Use the stylised avatar instead</button>
                  </div>
                </div>
              )}
            </div>
            <div className="stage-floor" />
            <span className="sim-chip" title="A simulated overlay of each piece’s photo on your photo — not a generative try-on. A photo-real provider is a planned adapter.">{photo && !avatar ? 'Virtual Try-On Preview · simulated on your photo' : avatar ? 'Stylised avatar · no photo' : 'Virtual Try-On Preview · simulated overlay'}</span>
            {looks.length > 1 && <>
              <button type="button" className="iconbtn nav-arrow" style={{ left: 18 }} onClick={() => setI((i + looks.length - 1) % looks.length)} aria-label="Previous look"><Icon name="back" /></button>
              <button type="button" className="iconbtn nav-arrow" style={{ right: 18 }} onClick={() => setI((i + 1) % looks.length)} aria-label="Next look"><Icon name="next" /></button>
              <div className="look-dots">{looks.map((_, k) => <button type="button" key={k} className={k === i ? 'on' : ''} onClick={() => setI(k)} aria-label={`Look ${k + 1}`} />)}</div>
            </>}
          </div>
          <aside className="fitting-card">
            <div className="look-no">LOOK 0{i + 1}{looks.length > 1 ? ` OF 0${looks.length}` : ''}</div>
            <h2>{look.title || 'Your look'}</h2>
            {look.compatibility !== undefined && <div className="mini-match"><b><CountUp value={look.compatibility} />%</b> {matchWord(look.compatibility)}{meta.levelName ? ` · ${meta.levelName}` : ''}{meta.tempC !== undefined ? ` · ${meta.tempC}°` : ''}</div>}
            <div className="hangers">
              {look.pieces.map((p) => (
                <a key={p.id} href={`#/closet/${p.id}`} className="hanger-row">
                  <span className="hook" aria-hidden="true" />
                  <Tile piece={p} status={false} style={{ width: 52, height: 52, aspectRatio: 'auto', borderRadius: 12, flex: 'none' }} />
                  <span className="small"><b>{pieceName(p)}</b><br /><span className="muted">{CATEGORY_ONE[p.category]}</span></span>
                </a>
              ))}
            </div>
            {avatar && <div className="tones" aria-label="Avatar skin tone">{SKIN_TONES.map((t) => <button type="button" key={t} className={tone === t ? 'on' : ''} style={{ background: t }} onClick={() => setTone(t)} aria-label="Skin tone" />)}</div>}
            {photo && !avatar && (
              <details className="fit">
                <summary className="small"><Icon name="filter" size={14} />Adjust the fit to your photo</summary>
                {[['x', 'Left · right', 30, 70], ['y', 'Up · down', -12, 12], ['scale', 'Size', 70, 130]].map(([k, l, a, b]) => (
                  <label key={k} className="fit-row"><span className="tiny">{l}</span><input type="range" min={a} max={b} value={fit[k]} onChange={(e) => changeFit(k, Number(e.target.value))} /></label>
                ))}
                <div className="row" style={{ gap: 6, marginTop: 6 }}>
                  <label className="btn ghost sm"><Icon name="camera" size={13} />Change photo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto} hidden /></label>
                  <button type="button" className="btn ghost sm" onClick={forgetPhoto}><Icon name="x" size={13} />Remove my photo</button>
                </div>
              </details>
            )}
            {done[i] === 'worn' ? <div className="notice ok small"><Icon name="check" size={15} />Worn today. Rate it from your lookbook or history.</div> : (
              <div className="stack" style={{ gap: 8 }}>
                <button type="button" className="btn block" onClick={wear}><Icon name="check" size={15} />Wear this today</button>
                <div className="row nowrap">
                  <button type="button" className={`btn line sm grow ${done[i] === 'saved' ? 'soft' : ''}`} onClick={() => save(false)}><Icon name="bookmark" size={14} />{done[i] === 'saved' ? 'Saved' : 'Save'}</button>
                  <button type="button" className={`btn line sm grow ${done[i] === 'fav' ? 'soft' : ''}`} onClick={() => save(true)}><Icon name="heart" size={14} fill={done[i] === 'fav' ? 'currentColor' : 'none'} />Favourite</button>
                  <button type="button" className="btn ghost sm" onClick={() => go(meta.result ? '/outfits?back=1' : '/outfits')}><Icon name="swap" size={14} />Change a piece</button>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
