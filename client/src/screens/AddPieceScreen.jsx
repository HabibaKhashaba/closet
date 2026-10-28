// US-08 add a piece by photo → US-09 details → US-11 review; the piece is created only on Save.
import React, { useMemo, useRef, useState } from 'react';
import { api, ApiError } from '../api.js';
import { CATEGORY_ONE, Icon, SprintTag, useApp, dressName } from '../ui.jsx';
import { go } from '../App.jsx';
import PieceForm, { cleanDetails, emptyDetails } from './PieceForm.jsx';

const MAX = 10 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

export default function AddPieceScreen() {
  const { vocab, toast } = useApp();
  const [step, setStep] = useState(0);
  const [photo, setPhoto] = useState(null);
  const [photoError, setPhotoError] = useState(null);
  const [details, setDetails] = useState(emptyDetails);
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);
  const input = useRef(null);
  const preview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);

  function pick(file) {
    if (!file) return;
    if (!TYPES.includes(file.type) && !/\.(heic|heif)$/i.test(file.name)) return setPhotoError('Use a JPG, PNG, WebP or HEIC photo.');
    if (file.size > MAX) return setPhotoError('Photos can be up to 10 MB.');
    setPhotoError(null);
    setPhoto(file);
    return setStep(1);
  }

  function review() {
    const missing = [];
    if (!details.category) missing.push({ field: 'category', message: 'Category is required' });
    if (!details.colour) missing.push({ field: 'colour', message: 'Colour is required' });
    if (!details.dressCodes.length) missing.push({ field: 'dressCodes', message: 'Choose at least one dress-code level' });
    setErrors(missing);
    if (!missing.length) setStep(2);
  }

  async function save() {
    setBusy(true);
    try {
      await api.addItem(photo, cleanDetails(details));
      toast('Piece added to your closet');
      go('/closet');
    } catch (e) {
      if (e instanceof ApiError && e.details.length) { setErrors(e.details); setStep(1); }
      toast(e.message, true);
    } finally { setBusy(false); }
  }

  const d = details;
  return (
    <div style={{ maxWidth: 980 }}>
      <div className="page-head">
        <div className="stack" style={{ gap: 8 }}><a href="#/closet" className="small muted row" style={{ gap: 4 }}><Icon name="back" size={14} /> My closet</a><div className="row"><h1>Add a piece</h1><SprintTag n={1} /></div></div>
      </div>
      <div className="steps">{[0, 1, 2].map((i) => <i key={i} className={i <= step ? 'on' : ''} />)}</div>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 340px) minmax(0, 1fr)', alignItems: 'start' }}>
        <div>
          {preview ? <div className={`tile ${d.category || ''}`}><img src={preview} alt="New piece" /></div> : (
            <button type="button" className="drop" onClick={() => input.current.click()}
              onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files[0]); }}>
              <Icon name="camera" size={40} /><b style={{ color: 'var(--ink)' }}>Take or upload a photo</b><small>JPG, PNG, WebP or HEIC · up to 10 MB</small><small>Location data is removed before saving</small>
            </button>
          )}
          <input ref={input} type="file" accept="image/*" capture="environment" hidden onChange={(e) => pick(e.target.files[0])} />
          {photo && step < 2 && <button type="button" className="btn line sm" style={{ marginTop: 12 }} onClick={() => input.current.click()}>Change photo</button>}
          {photoError && <p className="err" role="alert">{photoError}</p>}
        </div>
        <div className="card pad-lg">
          {step === 0 && <><h2>1 · Photo</h2><p className="muted" style={{ marginTop: 8 }}>Start with a photo of the piece on a plain background. Then you add its details and check them before anything is saved.</p></>}
          {step === 1 && (
            <>
              <h2 style={{ marginBottom: 16 }}>2 · Details</h2>
              <PieceForm value={details} onChange={setDetails} errors={errors} />
              <div className="row end" style={{ marginTop: 22 }}>
                <button type="button" className="btn" onClick={review}>Review</button>
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <h2 style={{ marginBottom: 16 }}>3 · Review before saving</h2>
              <dl className="kv">
                <dt>Name</dt><dd>{d.name || '—'}</dd>
                <dt>Category</dt><dd>{CATEGORY_ONE[d.category]}</dd>
                <dt>Colour</dt><dd>{d.colour}</dd>
                <dt>Fabric</dt><dd>{d.fabric || '—'}</dd>
                <dt>Season</dt><dd>{d.season || '—'}</dd>
                <dt>Size</dt><dd>{d.size || '—'}</dd>
                <dt>Dress code</dt><dd>{d.dressCodes.map((l) => dressName(vocab, l)).join(', ')}</dd>
                <dt>Style</dt><dd>{d.styles.join(', ') || '—'}</dd>
                <dt>Modest</dt><dd>{d.modest ? 'Yes' : 'No'}</dd>
              </dl>
              <p className="small muted" style={{ margin: '16px 0' }}>Nothing is saved until you press Save.</p>
              <div className="row end">
                <button type="button" className="btn line" onClick={() => setStep(1)}>Edit details</button>
                <button type="button" className="btn" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save to closet'}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
