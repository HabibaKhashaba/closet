// Closet wrapped — v3.0, editorial design: full-bleed story cards + a share card drawn on a canvas.
// Every number is counted from your wear history; nothing is invented.
import React, { useRef, useState } from 'react';
import { api } from '../../api.js';
import { pieceName, useApp, useLoad } from '../../ui.jsx';
import { ACCENT, Choice, Cover, Fineprint } from './editorial.jsx';

const BG = ['#f5e6e3', '#f1e8de', '#e5ede3', '#eee7f2', '#e5ecf3', '#f6eedb', '#fbf1ef'];

function drawShare(canvas, w) {
  const c = canvas.getContext('2d'); const W = 1080; const H = 1350;
  canvas.width = W; canvas.height = H;
  const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#fbf1ef'); g.addColorStop(1, '#f1e8de');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.fillStyle = '#2a2626';
  c.font = '600 30px sans-serif'; c.fillText(`CLOSET WRAPPED · LAST ${w.days} DAYS`, 80, 120);
  c.font = '600 104px Georgia, serif'; wrap(c, w.persona, 80, 270, W - 160, 108);
  c.font = 'italic 40px Georgia, serif'; wrap(c, w.tagline, 80, 520, W - 160, 52);
  const rows = [[`${w.outfitsWorn}`, 'outfits worn'], [`${w.differentPieces}`, 'different pieces'], [`${w.rotation}%`, 'of my closet in rotation']];
  if (w.topColours[0]) rows.push([`${w.topColours[0].share}%`, `${w.topColours[0].colour.toLowerCase()}`]);
  rows.forEach(([n, l], i) => { const y = 760 + i * 135; c.font = '600 110px Georgia, serif'; c.fillText(n, 80, y); c.font = '34px sans-serif'; c.fillText(l, 420, y - 18); });
  c.font = '600 30px sans-serif'; c.fillText('closet · AI wardrobe', 80, H - 70);
}
function wrap(c, text, x, y, max, lh) {
  let line = ''; for (const word of String(text).split(' ')) { const t = line ? `${line} ${word}` : word; if (c.measureText(t).width > max) { c.fillText(line, x, y); y += lh; line = word; } else line = t; } c.fillText(line, x, y);
}

export default function WrappedScreen() {
  const { toast } = useApp();
  const [days, setDays] = useState('30');
  const w = useLoad(() => api.wrapped(Number(days)), [days]);
  const canvas = useRef(null);
  const d = w.data;
  function share() {
    try { drawShare(canvas.current, d); const a = document.createElement('a'); a.download = `closet-wrapped-${d.days}d.png`; a.href = canvas.current.toDataURL('image/png'); a.click(); } catch { toast('Could not make the image', true); }
  }
  const cards = d ? [
    ['Your closet worked hard', <><div className="num">{d.outfitsWorn}</div><p>outfits worn<br />{d.differentPieces} different pieces</p><div className="bar"><i style={{ width: `${d.rotation}%` }} /></div><div className="lbl">{d.rotation}% of your closet in rotation</div></>],
    ['Your most-worn piece', d.mostWorn ? <><img src={d.mostWorn.piece.photoUrl} alt={pieceName(d.mostWorn.piece)} /><p style={{ fontFamily: 'var(--serif)', fontSize: 22 }}>{pieceName(d.mostWorn.piece)}<br /><span className="lbl">worn {d.mostWorn.times} time{d.mostWorn.times === 1 ? '' : 's'}</span></p></> : <p>No wears yet.</p>],
    ['Your colours', <>{d.topColours.map((c) => <div key={c.colour}><div className="lbl">{c.colour}</div><div className="bar"><i style={{ width: `${c.share}%` }} /></div><div style={{ fontFamily: 'var(--serif)', fontSize: 30, marginTop: -6 }}>{c.share}%</div></div>)}{!d.topColours.length && <p>No wears yet.</p>}</>],
    ['Where you went', d.topOccasion ? <><div className="num" style={{ fontSize: 64 }}>{d.topOccasion.occasion}</div><p>{d.topOccasion.times} time{d.topOccasion.times === 1 ? '' : 's'} — your top occasion</p></> : <p>Add an occasion when you log an outfit.</p>],
    ['Your favourite formula', d.favouriteLook ? <><div className="row-img">{d.favouriteLook.pieces.slice(0, 3).map((p) => <img key={p.id} src={p.photoUrl} alt={pieceName(p)} />)}</div><p>Worn together {d.favouriteLook.times} times</p></> : <p>No outfit repeated yet.</p>],
    ['Forgotten treasures', <><div className="num">{d.forgotten}</div><p>pieces not worn in 40+ days{d.health !== null ? <><br />closet health {d.health}/100</> : null}</p></>],
    ['Your style persona', <><div style={{ fontFamily: 'var(--serif)', fontSize: 46, lineHeight: 1, fontWeight: 600 }}>{d.persona}</div><p style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 20 }}>{d.tagline}</p><button type="button" className="ed-cta" style={{ alignSelf: 'flex-start' }} onClick={share}>Download share card</button></>],
  ] : [];
  return (
    <div className="ed" style={{ '--acc': ACCENT.wrapped }}>
      <Cover feature="wrapped" no={9} kicker="Your year in clothes" title="Closet wrapped" dek="Your style story, counted from what you actually wore — swipe through it, then share it." />
      <Choice label="Period" options={['30', '90', '365']} value={days} render={(x) => (x === '365' ? 'This year' : `Last ${x} days`)} onChange={setDays} />
      <div className="ed-story" style={{ marginTop: 22 }} aria-live="polite">
        {cards.map(([title, body], i) => (
          <article key={title} style={{ background: BG[i % BG.length] }}>
            <div><div className="lbl">{String(i + 1).padStart(2, '0')} / {String(cards.length).padStart(2, '0')}</div><h3>{title}</h3></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{body}</div>
          </article>
        ))}
      </div>
      {d && <Fineprint>{d.from} → {d.to}. {d.ai ? 'The tagline was written by AI from these facts; ' : ''}every number is counted by Closet.</Fineprint>}
      <canvas ref={canvas} hidden />
    </div>
  );
}
