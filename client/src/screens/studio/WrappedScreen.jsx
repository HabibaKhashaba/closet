// Closet wrapped — v3.0: your style story as swipeable cards + a share card drawn on a canvas.
// Every number is counted from your wear history; nothing is invented.
import React, { useRef, useState } from 'react';
import { api } from '../../api.js';
import { Icon, PageHead, SprintNote, Tabs, pieceName, useApp, useLoad } from '../../ui.jsx';
import { MiniLook } from './common.jsx';

const BG = ['#9c5f5b', '#3e5d80', '#4d7a5c', '#6a4b87', '#8a6420', '#2a2626'];

function drawShare(canvas, w) {
  const c = canvas.getContext('2d'); const W = 1080; const H = 1350;
  canvas.width = W; canvas.height = H;
  const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#c48a86'); g.addColorStop(1, '#6a4b87');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.fillStyle = '#fff'; c.textAlign = 'left';
  c.font = '600 44px Georgia, serif'; c.fillText(`My closet · last ${w.days} days`, 80, 140);
  c.font = '600 96px Georgia, serif'; c.fillText(w.persona, 80, 300, W - 160);
  c.font = 'italic 40px Georgia, serif'; wrap(c, w.tagline, 80, 380, W - 160, 52);
  const rows = [[`${w.outfitsWorn}`, 'outfits worn'], [`${w.differentPieces}`, 'different pieces'], [`${w.rotation}%`, 'of my closet in rotation']];
  if (w.topColours[0]) rows.push([`${w.topColours[0].share}%`, `${w.topColours[0].colour.toLowerCase()}`]);
  rows.forEach(([n, l], i) => { c.font = '600 120px Georgia, serif'; c.fillText(n, 80, 640 + i * 170); c.font = '36px sans-serif'; c.fillText(l, 80 + c.measureText(n).width * 0 + 380, 620 + i * 170); });
  c.font = '600 36px sans-serif'; c.fillText('closet · AI wardrobe', 80, H - 80);
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
    try {
      drawShare(canvas.current, d);
      const a = document.createElement('a'); a.download = `closet-wrapped-${d.days}d.png`; a.href = canvas.current.toDataURL('image/png'); a.click();
    } catch (e) { toast('Could not make the image', true); }
  }
  const cards = d ? [
    ['Your closet worked hard', <><div className="num">{d.outfitsWorn}</div><p>outfits worn · {d.differentPieces} different pieces · {d.rotation}% of your closet in rotation</p></>],
    ['Most worn', d.mostWorn ? <><MiniLook pieces={[d.mostWorn.piece]} /><p><b>{pieceName(d.mostWorn.piece)}</b> — worn {d.mostWorn.times} time{d.mostWorn.times === 1 ? '' : 's'}</p></> : <p>No wears yet.</p>],
    ['Your colours', <>{d.topColours.map((c) => <div key={c.colour} style={{ fontSize: 20 }}><b>{c.share}%</b> {c.colour.toLowerCase()}</div>)}{!d.topColours.length && <p>No wears yet.</p>}</>],
    ['Where you went', d.topOccasion ? <><div className="num" style={{ fontSize: 40 }}>{d.topOccasion.occasion}</div><p>{d.topOccasion.times} time{d.topOccasion.times === 1 ? '' : 's'}</p></> : <p>Add an occasion when you log an outfit.</p>],
    ['Favourite formula', d.favouriteLook ? <><MiniLook pieces={d.favouriteLook.pieces} /><p>Worn together {d.favouriteLook.times} times</p></> : <p>No outfit repeated yet.</p>],
    ['Forgotten treasures', <><div className="num">{d.forgotten}</div><p>pieces not worn in 40+ days{d.health !== null ? ` · closet health ${d.health}/100` : ''}</p></>],
    ['Your style persona', <><div className="num" style={{ fontSize: 34 }}>{d.persona}</div><p className="persona-line">{d.tagline}</p></>],
  ] : [];
  return (
    <>
      <PageHead title="Closet wrapped" sub="Your style story, counted from what you actually wore." actions={d && <button type="button" className="btn rose" onClick={share}><Icon name="gift" size={15} />Download share card</button>} />
      <Tabs options={[['30', 'Last 30 days'], ['90', 'Last 90 days'], ['365', 'This year']]} value={days} onChange={setDays} />
      <div className="wrapped-deck" style={{ marginTop: 16 }} aria-live="polite">
        {cards.map(([title, body], i) => (
          <div key={title} className="wrapped-card" style={{ background: BG[i % BG.length] }}><h3>{title}</h3><div>{body}</div><span className="tiny" style={{ opacity: .8 }}>{i + 1} / {cards.length}</span></div>
        ))}
      </div>
      {d && <p className="tiny muted">{d.from} → {d.to}. {d.ai ? 'The tagline was written by AI from these facts; ' : ''}every number is counted by Closet.</p>}
      <canvas ref={canvas} hidden />
      <div style={{ marginTop: 20 }}><SprintNote n={5} /></div>
    </>
  );
}
