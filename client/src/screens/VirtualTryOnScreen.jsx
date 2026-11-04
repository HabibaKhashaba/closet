// Virtual Try-On (US-118) — image-based: ONE garment from a recommended look on the user's own photo.
// Flow: Style me → 3 looks → "Virtual Try-On" on a look → pick the piece (GarmentPicker) → this screen:
// choose / upload a full-body photo → consent → Generate → "Creating your virtual try-on…" (polling the
// server, which asks the provider) → result → Save result · Try another item · Back to outfit · Retry.
// The browser never calls the AI provider; the server holds the key. Leaving the screen does not cancel
// the job: coming back resumes it (and every try-on is listed under "Your try-ons").
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../api.js';
import { Icon, Modal, PageHead, Skeleton, Spinner, Tile, pieceName, useApp, CATEGORY_ONE } from '../ui.jsx';
import { go } from '../App.jsx';
import { FlowRail } from './OutfitsScreen.jsx';
import { CATEGORY_WORD, CLIENT_GIVE_UP_MS, DEFAULT_SUPPORTED, activeJob, checkPhoto, errorText, nextPollMs, tryOnConfig } from '../virtualTryOn.js';

// "Which item do you want to try on?" — opened from an outfit card. Unsupported pieces are shown, disabled.
export function GarmentPicker({ pieces, onClose, onPick, title = 'Which item do you want to try on?' }) {
  const [cfg, setCfg] = useState(null);
  useEffect(() => { let live = true; tryOnConfig().then((c) => live && setCfg(c)); return () => { live = false; }; }, []);
  const supported = (cfg && cfg.supportedCategories) || DEFAULT_SUPPORTED;
  const ok = pieces.filter((p) => supported.includes(p.category));
  // Rendered into <body>: the outfit cards flip with a 3D transform, which would trap a fixed-position modal.
  return createPortal(
    <Modal title={title} sub="Virtual try-on dresses your photo in one piece at a time. Tops, jackets and dresses work best." onClose={onClose}>
      {cfg && !cfg.enabled && <div className="notice warn small" style={{ marginBottom: 12 }}><Icon name="alert" size={16} />Virtual try-on is not set up on this server yet (no provider key). You can still pick a piece to see the screen.</div>}
      <div className="vto-pick" role="list">
        {pieces.map((p) => {
          const can = supported.includes(p.category);
          return (
            <button key={p.id} type="button" role="listitem" className={`vto-pick-row ${can ? '' : 'off'}`} disabled={!can} onClick={() => onPick(p)} aria-label={can ? `Try on ${pieceName(p)}` : `${pieceName(p)} cannot be tried on yet`}>
              <Tile piece={p} status={false} style={{ width: 56, height: 56, aspectRatio: 'auto', borderRadius: 12, flex: 'none' }} />
              <span className="grow"><b>{pieceName(p)}</b><br /><span className="tiny muted">{CATEGORY_ONE[p.category]}</span></span>
              {can ? <span className="chip sm">Try on</span> : <span className="tiny muted">Not supported yet</span>}
            </button>
          );
        })}
      </div>
      {!ok.length && <p className="small muted" style={{ marginTop: 12 }}>None of these pieces can be tried on yet — try a look with a top, a jacket or a dress.</p>}
    </Modal>, document.body,
  );
}

const STEPS = ['Uploading your photo…', 'Sending your photo and the piece to the try-on service…', 'Fitting the piece to your pose…', 'Adding the final details…'];

export default function VirtualTryOnScreen({ query }) {
  const { toast } = useApp();
  const [cfg, setCfg] = useState(null);
  const [piece, setPiece] = useState(null);
  const [lookPieces, setLookPieces] = useState([]);
  const [saved, setSaved] = useState(undefined);      // the saved try-on photo: undefined = loading, null = none
  const [useSaved, setUseSaved] = useState(true);
  const [file, setFile] = useState(null);             // { file, url, width, height, landscape }
  const [photoError, setPhotoError] = useState('');
  const [keepPhoto, setKeepPhoto] = useState(false);
  const [consent, setConsent] = useState(false);
  const [job, setJob] = useState(null);               // the try-on record from the API
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState(false);
  const [history, setHistory] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const timer = useRef(null);
  const alive = useRef(true);
  const startedAt = useRef(0);

  const lookIds = (query.ids || '').split(',').filter(Boolean);
  // The 3 looks are kept in this tab (OutfitsScreen stores them), so going back shows the same looks.
  const backToOutfit = () => go(query.look !== undefined || lookIds.length || (job && job.outfitItemIds.length) ? '/outfits?back=1' : '/outfits');

  // ---------- load: settings, the chosen piece, the look, the saved photo, or an existing try-on ----------
  useEffect(() => {
    alive.current = true;
    tryOnConfig().then((c) => alive.current && setCfg(c));
    api.vto.photo().then((r) => { if (!alive.current) return; setSaved(r.photo); setUseSaved(Boolean(r.photo)); }).catch(() => alive.current && setSaved(null));
    return () => { alive.current = false; clearTimeout(timer.current); };
  }, []);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        if (query.item) setPiece(await api.item(query.item));
        if (lookIds.length) { const all = (await api.items()).items; if (live) setLookPieces(lookIds.map((id) => all.find((p) => p.id === id)).filter(Boolean)); }
        const resumeId = query.id || ((activeJob.get() || {}).item === query.item ? activeJob.get().id : null);
        if (resumeId) { const r = await api.vto.get(resumeId); if (!live) return; setJob(r);
          if (!lookIds.length && r.outfitItemIds.length) { const all = (await api.items()).items; if (live) setLookPieces(r.outfitItemIds.map((id) => all.find((p) => p.id === id)).filter(Boolean)); } if (!query.item && r.garment.id) setPiece(await api.item(r.garment.id).catch(() => null)); if (r.status === 'PROCESSING' || r.status === 'PENDING') { startedAt.current = Date.now() - 1000; poll(r.tryOnId); } }
        if (!query.item && !query.id) { const h = await api.vto.list(); if (live) setHistory(h.tryOns); }
      } catch (e) { if (live) setError(errorText(e)); }
    })();
    return () => { live = false; };
  }, [query.item, query.id, query.ids]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- polling: quick at first, then slower; stops when the screen closes ----------
  const poll = useCallback((id) => {
    clearTimeout(timer.current);
    const tick = async () => {
      if (!alive.current) return;
      const spent = Date.now() - startedAt.current;
      setElapsed(spent);
      try {
        const r = await api.vto.get(id);
        if (!alive.current) return;
        setJob(r);
        if (r.status === 'COMPLETED' || r.status === 'FAILED') { activeJob.clear(); return; }
        if (spent > CLIENT_GIVE_UP_MS) { setError('This is taking much longer than usual. You can leave this screen — the result will appear under “Your try-ons”.'); return; }
      } catch (e) {
        if (!alive.current) return;
        if (e.status === 404) { activeJob.clear(); setJob(null); setError('This try-on no longer exists.'); return; }
        // network hiccup: keep trying, but slower
      }
      timer.current = setTimeout(tick, nextPollMs(Date.now() - startedAt.current));
    };
    timer.current = setTimeout(tick, nextPollMs(0));
  }, []);

  async function choose(e) {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    setPhotoError('');
    const c = await checkPhoto(f);
    if (!c.ok) { setPhotoError(c.message); return; }
    if (file) URL.revokeObjectURL(file.url);
    setFile({ file: f, ...c }); setUseSaved(false);
  }
  async function deleteSaved() {
    if (!window.confirm('Delete your saved try-on photo from Closet?')) return;
    try { await api.vto.deletePhoto(); setSaved(null); setUseSaved(false); toast('Saved try-on photo deleted'); } catch (e) { toast(errorText(e), true); }
  }

  async function generate() {
    setError('');
    if (!useSaved && !file) { setPhotoError('Add a clear full-body photo of yourself first.'); return; }
    if (!consent) { setError('Please tick the photo notice first.'); return; }
    setBusy(true);
    try {
      const r = await api.vto.create({ wardrobeItemId: piece.id, outfitId: query.outfit, outfitItemIds: lookIds, file: useSaved ? null : file.file, useSavedPhoto: useSaved, savePhoto: !useSaved && keepPhoto });
      setJob(r);
      if (!useSaved && keepPhoto) api.vto.photo().then((p) => alive.current && setSaved(p.photo)).catch(() => {});
      if (r.status === 'PROCESSING' || r.status === 'PENDING') { activeJob.set({ id: r.tryOnId, item: piece.id }); startedAt.current = Date.now(); setElapsed(0); poll(r.tryOnId); }
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  async function retry() {
    setError(''); setBusy(true);
    try {
      const r = await api.vto.retry(job.tryOnId);
      setJob(r);
      if (r.status === 'PROCESSING' || r.status === 'PENDING') { activeJob.set({ id: r.tryOnId, item: piece && piece.id }); startedAt.current = Date.now(); setElapsed(0); poll(r.tryOnId); }
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  async function saveResult() {
    try { setJob(await api.vto.save(job.tryOnId, !job.saved)); toast(job.saved ? 'Removed from your saved try-ons' : 'Saved to your try-ons'); } catch (e) { toast(errorText(e), true); }
  }
  function tryAnother() { setJob(null); setError(''); activeJob.clear(); setFile(null); setUseSaved(Boolean(saved)); setConsent(false); setKeepPhoto(false); if (lookPieces.length) setPicker(true); else go('/outfits?back=1'); }
  function pickOther(p) { setPicker(false); go(`/virtual-try-on?item=${p.id}${lookIds.length ? `&ids=${lookIds.join(',')}` : ''}${query.look !== undefined ? `&look=${query.look}` : ''}${query.outfit ? `&outfit=${query.outfit}` : ''}`); }

  const running = job && (job.status === 'PROCESSING' || job.status === 'PENDING');
  const step = STEPS[Math.min(STEPS.length - 1, Math.floor(elapsed / 9000))];
  const preview = useSaved && saved ? saved.url : file ? file.url : null;

  // ---------- no piece chosen: the list of my try-ons ----------
  if (!query.item && !query.id) {
    return (
      <>
        <PageHead title="Virtual try-on" sprint={2} sub="See one piece from your looks on your own photo. Start from a look in Style me." actions={<button type="button" className="btn" onClick={() => go('/outfits')}><Icon name="sparkle" size={15} />Style me · 3 looks</button>} />
        {cfg && !cfg.enabled && <div className="notice warn" style={{ marginBottom: 16 }}><Icon name="alert" size={18} /><span className="small"><b>Not set up yet.</b> The server has no virtual try-on provider. Add <code>FASHN_API_KEY</code> to <code>server/.env</code> (or <code>TRYON_PROVIDER=mock</code> for a demo without AI).</span></div>}
        {error && <div className="notice warn small">{error}</div>}
        {!history ? <Skeleton h={220} /> : !history.length ? (
          <div className="card pad vto-empty"><Icon name="mirror" size={28} /><div><b>No try-ons yet</b><p className="small muted">Generate three looks, then press <b>Virtual Try-On</b> on the one you like.</p></div></div>
        ) : (
          <div className="vto-history">{history.map((t) => (
            <a key={t.tryOnId} className="card vto-hist" href={`#/virtual-try-on?id=${t.tryOnId}`}>
              <div className="vto-hist-img">{t.resultImageUrl ? <img src={t.resultImageUrl} alt={`Try-on of ${t.garment.name}`} /> : <span className="tiny muted">{t.status === 'FAILED' ? 'Failed' : 'Creating…'}</span>}</div>
              <div className="small"><b>{t.garment.name || CATEGORY_WORD[t.garment.category]}</b><br /><span className="tiny muted">{new Date(t.createdAt).toLocaleDateString()} · {t.saved ? 'Saved' : t.status.toLowerCase()}</span></div>
            </a>))}
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <div className="tryon-head">
        <div><h1 style={{ marginTop: 8 }}>Virtual try-on</h1><p className="muted small">One piece from your look, on your own photo.</p></div>
        <button type="button" className="btn line" onClick={backToOutfit}><Icon name="back" size={15} />Back to outfit</button>
      </div>
      {lookIds.length > 0 && <FlowRail at={3} />}
      {cfg && !cfg.enabled && <div className="notice warn" style={{ marginBottom: 16 }}><Icon name="alert" size={18} /><span className="small"><b>Virtual try-on is not set up on this server yet.</b> Everything else in Closet works. (Team: add <code>FASHN_API_KEY</code> to <code>server/.env</code>.)</span></div>}

      <div className="vto">
        {/* ---------- left: photo / progress / result ---------- */}
        <section className="card vto-stage" aria-live="polite">
          {job && job.status === 'COMPLETED' ? (
            <figure className="vto-result">
              <img src={job.resultImageUrl} alt={`You wearing the ${job.garment.name || 'piece'} (AI-generated)`} />
              <figcaption><span className="chip sm">{job.mock ? 'Mock result · no AI was used (demo provider)' : 'AI-generated try-on · not a photo'}</span></figcaption>
            </figure>
          ) : running ? (
            <div className="vto-running">
              {preview && <img className="vto-ghost" src={preview} alt="" />}
              <div className="vto-running-card"><Spinner /><b>Creating your virtual try-on…</b><span className="small muted">{step}</span><span className="tiny muted">Usually 15–60 seconds. You can leave this screen — it keeps going.</span></div>
            </div>
          ) : job && job.status === 'FAILED' ? (
            <div className="vto-failed">
              <Icon name="alert" size={28} />
              <b>We couldn’t create this try-on</b>
              <p className="small">{job.error && job.error.message}</p>
              <div className="row wrap" style={{ gap: 8, justifyContent: 'center' }}>
                <button type="button" className="btn" onClick={retry} disabled={busy}><Icon name="undo" size={15} />Retry</button>
                <button type="button" className="btn line" onClick={() => { setJob(null); activeJob.clear(); }}>Change photo</button>
              </div>
            </div>
          ) : preview ? (
            <div className="vto-photo"><img src={preview} alt="Your try-on photo" />{file && file.landscape && !useSaved && <span className="chip sm warn-chip">A portrait, full-body photo works best</span>}</div>
          ) : (
            <div className="vto-upload">
              <Icon name="camera" size={30} />
              <b>Upload a full-body photo</b>
              <span className="small muted">Stand straight, facing the camera, in good light, with a plain background. Head to feet in the frame.</span>
              <label className="btn"><Icon name="camera" size={15} />Choose a photo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={choose} hidden aria-label="Upload a full-body photo" /></label>
              <span className="tiny muted">JPG, PNG or WebP · up to 10 MB</span>
            </div>
          )}
          {photoError && <div className="notice warn small vto-photo-error" role="alert">{photoError}</div>}
        </section>

        {/* ---------- right: the garment, the photo choice and the actions ---------- */}
        <aside className="card pad vto-side">
          {!piece ? <Skeleton h={90} /> : (
            <div className="vto-garment">
              <Tile piece={piece} status={false} style={{ width: 84, height: 84, aspectRatio: 'auto', borderRadius: 14, flex: 'none' }} />
              <div><div className="eyebrow">Trying on</div><h2 style={{ fontSize: 20, margin: '2px 0' }}>{pieceName(piece)}</h2><span className="tiny muted">{CATEGORY_ONE[piece.category]}</span></div>
            </div>
          )}

          {job && job.status === 'COMPLETED' ? (
            <div className="stack" style={{ gap: 8 }}>
              <button type="button" className={`btn block ${job.saved ? 'soft' : ''}`} onClick={saveResult}><Icon name="bookmark" size={15} fill={job.saved ? 'currentColor' : 'none'} />{job.saved ? 'Saved' : 'Save result'}</button>
              <button type="button" className="btn line block" onClick={tryAnother}><Icon name="swap" size={15} />Try another item</button>
              <button type="button" className="btn ghost block" onClick={backToOutfit}><Icon name="back" size={15} />Back to outfit</button>
              <p className="tiny muted">Results are private to you. Delete any time from “Your try-ons”.</p>
            </div>
          ) : running ? (
            <div className="stack" style={{ gap: 8 }}>
              <div className="notice info small">Working on it… {Math.round(elapsed / 1000)} s</div>
              <button type="button" className="btn ghost block" onClick={backToOutfit}><Icon name="back" size={15} />Back to outfit (keeps going)</button>
            </div>
          ) : (!job || job.status !== 'FAILED') && (
            <div className="stack" style={{ gap: 10 }}>
              <div className="eyebrow">Your photo</div>
              {saved === undefined ? <Skeleton h={40} /> : saved && (
                <div className={`vto-opt ${useSaved ? 'on' : ''}`} onClick={() => setUseSaved(true)}><input type="radio" name="photo" checked={useSaved} onChange={() => setUseSaved(true)} aria-label="Use saved try-on photo" /><img src={saved.url} alt="" /><span className="small"><b>Use saved try-on photo</b><br /><button type="button" className="link-btn tiny" onClick={(e) => { e.stopPropagation(); deleteSaved(); }}>Delete saved photo</button></span></div>
              )}
              <div className={`vto-opt ${!useSaved ? 'on' : ''}`} onClick={() => setUseSaved(false)}>
                <input type="radio" name="photo" checked={!useSaved} onChange={() => setUseSaved(false)} aria-label="Upload a different photo" />
                {file ? <img src={file.url} alt="" /> : <span className="vto-opt-icon"><Icon name="camera" size={18} /></span>}
                <span className="small"><b>{saved ? 'Upload a different photo' : 'Upload a full-body photo'}</b><br />
                  <label className="link-btn tiny" style={{ cursor: 'pointer' }}>{file ? 'Choose another' : 'Choose a photo'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={choose} hidden aria-label="Choose a photo" /></label></span>
              </div>
              {!useSaved && file && <label className="check small"><input type="checkbox" checked={keepPhoto} onChange={(e) => setKeepPhoto(e.target.checked)} />{saved ? 'Replace my saved try-on photo with this one' : 'Save this photo for next time'}</label>}
              <label className="check small vto-consent"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} aria-label="I agree to the photo notice" />
                <span>I agree that my photo and this piece’s photo are sent to Closet’s server and to an external AI try-on service ({cfg && cfg.provider === 'mock' ? 'demo provider, no AI' : 'FASHN'}) only to create this image. Closet keeps them privately in my account until I delete them.</span></label>
              <button type="button" className="btn block" onClick={generate} disabled={busy || !piece || (cfg && !cfg.enabled)}><Icon name="mirror" size={15} />{busy ? 'Starting…' : 'Generate try-on'}</button>
              <button type="button" className="btn ghost block" onClick={backToOutfit}><Icon name="back" size={15} />Back to outfit</button>
            </div>
          )}
          {error && <div className="notice warn small" role="alert" style={{ marginTop: 10 }}>{error}</div>}
        </aside>
      </div>
      {picker && <GarmentPicker pieces={lookPieces} onClose={() => setPicker(false)} onPick={pickOther} title="Try another item from this look" />}
    </>
  );
}
