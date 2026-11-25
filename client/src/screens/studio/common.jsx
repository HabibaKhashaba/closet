// Shared pieces for the v3.0 Studio screens: photo input (as base64 JSON, ≤ 5 MB), a small look grid,
// a piece picker and the "how this was decided" footer (AI or Closet rules, never invented numbers).
import React, { useState } from 'react';
import { Icon, Modal, Tile, pieceName } from '../../ui.jsx';

export function readPhoto(file) {
  return new Promise((resolve, reject) => {
    if (!file) { resolve(null); return; }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { reject(new Error('Use a JPG, PNG or WebP photo.')); return; }
    if (file.size > 5 * 1024 * 1024) { reject(new Error('The photo is larger than 5 MB.')); return; }
    const r = new FileReader();
    r.onload = () => resolve({ base64: String(r.result).replace(/^data:[^,]+,/, ''), mime: file.type, preview: r.result });
    r.onerror = () => reject(new Error('Could not read the photo.'));
    r.readAsDataURL(file);
  });
}

export function PhotoInput({ label = 'Add a photo (optional)', value, onChange, onError }) {
  return (
    <label className="photo-drop">
      <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={async (e) => { try { onChange(await readPhoto(e.target.files[0])); } catch (err) { onError && onError(err.message); } }} />
      {value ? <img src={value.preview} alt="Chosen" /> : <span className="stack" style={{ alignItems: 'center', gap: 6 }}><Icon name="camera" size={22} /><span className="small">{label}</span></span>}
    </label>
  );
}

export function MiniLook({ pieces }) {
  return (
    <div className="mini-look">
      {pieces.filter(Boolean).map((p) => (p.photoUrl ? <Tile key={p.id} piece={p} status={false} />
        : <div key={p.id} className="tile virtual-tile" title={pieceName(p)}><span>{p.virtual ? 'New: ' : ''}{pieceName(p)}</span></div>))}
    </div>
  );
}

export function LookCard({ title, sub, look, children }) {
  return (
    <div className="studio-card stack">
      <div><b style={{ fontFamily: 'var(--serif)', fontSize: 18 }}>{title}</b>{sub && <div className="small muted">{sub}</div>}</div>
      <MiniLook pieces={look.pieces} />
      <div className="small"><b>{look.compatibility}%</b> compatible · rule score {look.score}/100</div>
      {children}
    </div>
  );
}

export function PiecePicker({ items, value = [], onChange, max = 4, title = 'Choose pieces', onClose }) {
  const [sel, setSel] = useState(value);
  const toggle = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= max ? s : [...s, id]));
  return (
    <Modal wide title={title} sub={`Up to ${max} pieces`} onClose={onClose}>
      <div className="picker">
        {items.map((p) => (
          <button type="button" key={p.id} className={sel.includes(p.id) ? 'on' : ''} onClick={() => toggle(p.id)}>
            <Tile piece={p} />
            <div className="tiny" style={{ fontWeight: 600, marginTop: 6 }}>{pieceName(p)}</div>
          </button>
        ))}
      </div>
      <div className="row" style={{ marginTop: 14 }}><button type="button" className="btn" disabled={sel.length < 2} onClick={() => onChange(sel)}>Use {sel.length} piece{sel.length === 1 ? '' : 's'}</button></div>
    </Modal>
  );
}

export const Source = ({ source }) => (
  <p className="tiny muted">{source === 'ai' ? 'Read by AI, checked against your closet. Every number is computed by Closet’s rules.' : 'Closet rules (no AI needed). Every number is computed by Closet’s rules.'}</p>
);
