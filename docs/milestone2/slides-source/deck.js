// Closet – Milestone 2 – FINAL (presentation pass). A spatial presentation: a dark screen → the
// wardrobe → its doors open → we walk into a dressing room. Every area of the room is a section and
// every section moves the camera the same way: WIDE → APPROACH → ENTER → INSIDE → EXIT.
// The "camera" is Morph: the same named objects ('!!name') at new positions and sizes. Each layer of
// the room has a depth, so near things move more than far things (parallax).
// MODE=interactive (Morph, clickable room, camera slides advance by themselves) | linear (one path, fades).
// Type: Lora (display) + Inter (body) only, one scale (see F). Numbers: evidence/counts_final.txt.
const pptxgen = require('pptxgenjs');
const sharp = require('sharp');
const fs = require('fs');

const MODE = process.env.MODE || 'interactive';
const LIN = MODE !== 'interactive';
const OUT = process.env.OUT || `out/raw_${MODE}.pptx`;
const HF = 'Lora', BF = 'Inter';
// the type scale (pt): statement 44–54 · title 48 · section 34 · subtitle 22 · body 16–18 · label 12–14
const F = { statement: 54, title: 48, section: 34, sub: 22, body: 17, bodyS: 16, label: 13, labelS: 12, mark: 72 };
const DIAG = '/home/claude/m2/d13';
const POS = JSON.parse(fs.readFileSync('scene/positions.json', 'utf8'));
const C = { bg: '0E0B0C', ink: '070505', panel: '1C1617', line: '3A3031', cream: 'F6EFE9', blush: 'E9C9C4', rose: 'C48A86', taupe: 'B9A48C', gold: 'E7C792',
  grey: '8F857C', grey2: 'B9AEA6', s1: '86B996', s2: 'E0A866', s3: 'B497D6', bad: 'E07B73' };
const W = 13.333, H = 7.5, PX = 180;           // art is 2400 × 1350 px = 13.333 × 7.5 in
const meta = {};
async function dims(p) { if (!meta[p]) meta[p] = await sharp(p).metadata(); return meta[p]; }
const CLEAR = 'scene/_clear.png';
const N = { tests: 349, s1: 169, extra: 180, lines: '97.95 %', branches: '84.57 %', funcs: '94.72 %', e2e: 58 };

// ---------- registry: id → slide, transition, auto-advance ----------
const SL = [];
// o.io: interactive only · o.cam: a camera move (interactive only: the linear deck has no camera)
const add = (id, fn, o = {}) => { if (LIN && (o.io || o.cam)) return; SL.push({ id, fn, t: o.t || 'morph', adv: o.adv, num: o.num !== false && !o.cam, master: o.master }); };
const has = (id) => SL.some((s) => s.id === id);
const num = (id) => { const i = SL.findIndex((s) => s.id === id); if (i < 0) throw new Error('no slide ' + id); return i + 1; };

(async () => {
  await sharp({ create: { width: 4, height: 4, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toFile(CLEAR);
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_WIDE';
  pres.title = 'Closet – Milestone 2 – Final';
  pres.author = 'Team Closet: Habiba, Salma, Bashar, Karim, Youssef';
  let cur = 0;

  // ---------- helpers: one style for every slide ----------
  const T = (s, text, o = {}) => s.addText(text, Object.assign({ fontFace: BF, fontSize: F.body, color: C.cream, margin: 0, valign: 'top', paraSpaceAfter: 0 }, o));
  const statement = (s, text, o = {}) => T(s, text, Object.assign({ fontFace: HF, fontSize: F.statement, color: C.cream }, o));
  const title = (s, text, o = {}) => T(s, text, Object.assign({ x: 0.6, y: 0.82, w: 12, h: 0.85, fontFace: HF, fontSize: F.title }, o));
  const section = (s, text, o = {}) => T(s, text, Object.assign({ x: 0.6, y: 0.82, w: 12, h: 0.7, fontFace: HF, fontSize: F.section }, o));
  const sub = (s, text, o = {}) => T(s, text, Object.assign({ fontSize: F.sub, color: C.blush }, o));
  const label = (s, text, o = {}) => T(s, text, Object.assign({ fontSize: F.labelS, bold: true, color: C.rose, charSpacing: 2 }, o));
  const kicker = (s, text) => label(s, text.toUpperCase(), { x: 0.6, y: 0.42, w: 10, h: 0.3 });
  const footer = (s) => { if (SL[cur].num) T(s, String(cur + 1), { x: W - 1.05, y: H - 0.52, w: 0.6, h: 0.3, fontSize: F.labelS, color: C.grey, align: 'right' }); };
  const rect = (s, x, y, w, h, fill, o = {}) => s.addShape(o.round === false ? pres.shapes.RECTANGLE : pres.shapes.ROUNDED_RECTANGLE,
    Object.assign({ x, y, w, h, rectRadius: o.r ?? 0.12, fill: { color: fill, transparency: o.tr || 0 }, line: { color: o.lc || fill, width: o.lw ?? 0.75, transparency: o.ltr || 0 } },
      o.shadow ? { shadow: { type: 'outer', color: '000000', opacity: 0.45, blur: 14, offset: 5, angle: 90 } } : {}, o.name ? { objectName: o.name } : {}));
  const pill = (s, text, x, y, w, h, fill, color, o = {}) => s.addText(text, Object.assign({ shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: h / 2, x, y, w, h,
    fill: { color: fill, transparency: o.tr || 0 }, line: { color: o.lc || fill, width: 0.75 }, fontFace: BF, fontSize: F.label, bold: true, color, align: 'center', valign: 'middle', margin: 0 }, o));
  const link = (s, x, y, w, h, target, tip) => { if (LIN || !has(target)) return; s.addImage({ path: CLEAR, x, y, w, h, hyperlink: { slide: num(target), tooltip: tip || '' } }); };
  // buttons: back = bottom left, action = bottom right, same size and style everywhere
  const BTN = { y: H - 0.72, h: 0.44 };
  const back = (s, target, text = 'Back to the room') => { if (LIN || !has(target)) return; pill(s, `◂  ${text}`, 0.45, BTN.y, 2.9, BTN.h, C.bg, C.blush, { lc: C.line, hyperlink: { slide: num(target), tooltip: text } }); };
  const action = (s, text, target, w = 2.9) => { if (LIN || !has(target)) return; pill(s, `${text}  ▸`, W - 1.25 - w, BTN.y, w, BTN.h, C.rose, C.ink, { hyperlink: { slide: num(target), tooltip: text } }); };
  const notes = (s, t) => s.addNotes(t);
  const slide = (m) => { const s = m ? pres.addSlide({ masterName: m }) : pres.addSlide(); s.background = { color: C.bg }; return s; };
  const mark = (s, o = {}) => T(s, [{ text: 'closet', options: { color: o.dim ? '6E625E' : C.cream } }, { text: '.', options: { color: o.dim ? '8F5F5C' : C.rose } }],
    Object.assign({ x: 0.55, y: 0.3, w: 3, h: 0.6, fontFace: HF, fontSize: F.section, objectName: '!!word' }, o.at || {}, o.glow ? { glow: { size: 18, opacity: 0.35, color: C.gold } } : {}));

  // ---------- the camera ----------
  // Each art layer has a depth: the room's back wall moves least, the out-of-focus foreground most.
  const DEPTH = { room_bg: 0.55, room_led: 0.6, room_rug: 0.85, room_fg: 1.6 };
  function art(s, name, cam, o = {}) {
    const file = fs.existsSync(`scene/${name}.png`) ? `scene/${name}.png` : `scene/${name}.jpg`;
    const b = POS[name] || { x: 0, y: 0, width: 2400, height: 1350 };
    let { x, y, width: w, height: h } = b;
    if (o.box) ({ x, y, w, h } = o.box);
    if (cam) { const k = 1 + (cam.k - 1) * (o.depth ?? DEPTH[name] ?? 1); x = (x - cam.cx) * k + 1200; y = (y - cam.cy) * k + 675; w *= k; h *= k; }
    s.addImage(Object.assign({ path: file, x: x / PX, y: y / PX, w: w / PX, h: h / PX, objectName: '!!' + (o.as || name) }, o.tr ? { transparency: o.tr } : {}));
  }
  const centre = (n) => ({ cx: POS[n].x + POS[n].width / 2, cy: POS[n].y + POS[n].height / 2 });
  const camOn = (n, k) => ({ ...centre(n), k });

  // ======================================================================================
  // OPENING — dark → the wardrobe → LEDs → doors open → the inside → the camera walks in
  // ======================================================================================
  const D = POS.door_l, Dr = POS.door_r;
  const doorsOpen = (s, cam, tr) => {
    art(s, 'door_l', cam, { box: { x: D.x - D.width * 0.72, y: D.y - 30, w: D.width * 0.3, h: D.height + 60 }, tr });
    art(s, 'door_r', cam, { box: { x: Dr.x + Dr.width * 1.12, y: Dr.y - 30, w: Dr.width * 0.3, h: Dr.height + 60 }, tr });
  };
  const doorsShut = (s, cam, tr) => { art(s, 'door_l', cam, { tr }); art(s, 'door_r', cam, { tr }); };
  const CENTRE_MARK = { x: W / 2 - 3, y: H / 2 - 0.75, w: 6, h: 1.5, fontSize: F.mark, align: 'center', valign: 'middle' };
  const CORNER_MARK = { x: 0.55, y: H - 1.2, w: 3, h: 0.6, fontSize: F.section };
  add('o_1', async (s) => {
    s.background = { color: C.ink };
    mark(s, { at: CENTRE_MARK, glow: true });
    notes(s, 'HABIBA (0:05). Lights low. Only the word. Wait two seconds. CLICK 1: the closet appears and its LEDs come on (by themselves). CLICK 2: the doors open and the inside lights up. CLICK 3: the camera walks in.');
  }, { t: 'fade', num: false });
  add('o_2', async (s) => {
    s.background = { color: C.ink };
    art(s, 'open_room', null, { tr: 78 }); art(s, 'open_led', null, { tr: 85 }); doorsShut(s, null, 78);
    mark(s, { at: CORNER_MARK, dim: true });
    notes(s, 'HABIBA. The wardrobe appears in the dark; the LED edge is barely on.');
  }, { num: false, adv: 500 });
  add('o_3', async (s) => {
    s.background = { color: C.ink };
    art(s, 'open_room'); art(s, 'open_led'); doorsShut(s);
    mark(s, { at: CORNER_MARK });
    notes(s, 'HABIBA (0:10). The LEDs come on. "What if your closet actually knew you — what you own, what is in the laundry, where you are going tomorrow and what the weather will be?"');
  }, { num: false });
  add('o_4', async (s) => {
    s.background = { color: C.ink };
    art(s, 'open_room'); art(s, 'open_led'); doorsOpen(s);
    mark(s, { at: CORNER_MARK });
    notes(s, 'HABIBA. The doors open.');
  }, { num: false, adv: 400 });
  add('o_5', async (s) => {
    s.background = { color: C.ink };
    art(s, 'open_room'); art(s, 'open_lit'); art(s, 'open_led'); doorsOpen(s);
    mark(s, { at: CORNER_MARK });
    sub(s, 'An intelligent wardrobe that learns how you dress.', { x: 0.6, y: H - 0.42 - 0.05, w: 8, h: 0.4, fontSize: F.sub, objectName: '!!tagline' });
    notes(s, 'HABIBA (0:10). The inside is lit. "Closet: an intelligent wardrobe that learns how you dress. Milestone 2: a working closet. Let\'s step inside."');
  }, { num: false });
  add('o_6', async (s) => {
    s.background = { color: C.ink };
    const cam = { cx: 1200, cy: 660, k: 2.6 };
    art(s, 'open_room', cam); art(s, 'open_lit', cam); art(s, 'open_led', cam, { depth: 1.05 }); doorsOpen(s, cam);
    notes(s, 'Camera walks forward into the wardrobe; its frame passes the edges of the screen.');
  }, { adv: 200, cam: true });

  // ======================================================================================
  // THE ROOM — the hub. Foreground, midground, background; one lit object per area.
  // ======================================================================================
  const AREAS = [['obj_door', 'SPRINT', 's_in', 'How we planned it'], ['obj_mirror', 'PRODUCT', 'p_in', 'The live closet'], ['obj_panel', 'INSIDE THE SYSTEM', 'p_bridge', 'Architecture and design'],
    ['obj_dresser', 'QUALITY', 'q_in', 'Does it actually work?'], ['obj_oval', 'RETROSPECTIVE', 'r_in', 'A look in the mirror'], ['obj_box', 'DOCUMENTS', 'd_in', 'SRS · SDD']];
  const LAB = { obj_door: [0.85, 6.45, 'left'], obj_oval: [3.3, 6.45, 'left'], obj_mirror: [5.75, 6.45, 'left'], obj_panel: [9.33, 4.36, 'left'], obj_box: [9.0, 4.86, 'right'], obj_dresser: [9.0, 6.55, 'left'] };
  function room(s, cam, o = {}) {
    art(s, 'room_bg', cam); art(s, 'room_led', cam, { tr: o.ledTr }); art(s, 'room_rug', cam);
    for (const [n] of AREAS) art(s, n, cam, { tr: o.lit ? (o.lit.includes(n) ? 0 : 72) : o.focus && o.focus !== n && !(o.focus === 'obj_box' && n === 'obj_dresser') ? 60 : 0 });
    art(s, 'room_fg', cam);
  }
  function roomLabels(s) {
    for (const [n, t, , d] of AREAS) {
      const [x, y, align] = LAB[n];
      T(s, [{ text: t, options: { bold: true, fontSize: F.labelS, color: C.cream, charSpacing: 2, breakLine: n !== 'obj_box' } }, ...(n === 'obj_box' ? [{ text: `  ${d}`, options: { fontSize: F.label, color: C.grey2 } }] : [{ text: d, options: { fontSize: F.label, color: C.grey2 } }])],
        { x: align === 'right' ? x - 0.3 : x, y, w: 2.75, h: n === 'obj_box' ? 0.3 : 0.55, align, objectName: '!!lab-' + n });
    }
  }
  let roomNo = 0;
  const hub = (note) => add(`room${++roomNo}`, async (s) => {
    room(s); roomLabels(s);
    for (const [n, , target, d] of AREAS) { const b = POS[n]; link(s, b.x / PX, b.y / PX, b.width / PX, b.height / PX, target, d); }
    mark(s);
    if (roomNo === 1) sub(s, 'Step inside. Every object is a door.', { x: 2.75, y: 0.45, w: 7, h: 0.4, italic: true });
    notes(s, note);
  }, { t: roomNo === 0 ? 'fade' : 'morph', num: false });
  hub('HABIBA (0:20). "This is the closet from the inside — and the review is a room. The door is the sprint, the big mirror is the product, the panel is the system inside, the drawer is quality, the standing mirror is our retrospective, the box holds the documents." CLICK the DOOR.');

  // camera into an object (one Morph move, advances by itself) and out again (one move back to the room)
  const camIn = (id, n, k, who) => add(id, async (s) => { room(s, camOn(n, k), { focus: n }); notes(s, `${who}. The camera moves into the object (Morph); the section starts by itself.`); }, { adv: 100, cam: true });
  const camOut = (id, n, k) => add(id, async (s) => { room(s, camOn(n, k), { focus: n }); notes(s, 'Back out: the camera returns to the room (Morph).'); }, { t: 'fade', adv: 100, cam: true });
  const exitTo = (id) => (has(id) ? id : null);
  async function diagram(s, file, o = {}) {
    const d = await dims(`${DIAG}/${file}.png`), ih = Math.min(o.h || 6.0, (o.w || 11.6) * d.height / d.width), w2 = ih * d.width / d.height;
    const x = (W - w2) / 2, y = o.y ?? 0.95;
    rect(s, x - 0.08, y - 0.08, w2 + 0.16, ih + 0.16, 'FDFBF8', { r: 0.06, shadow: true });
    s.addImage({ path: `${DIAG}/${file}.png`, x, y, w: w2, h: ih, objectName: o.name || '!!' + file });
    return { x, y, w: w2, h: ih };
  }
  async function zoom(s, file, fx, fy, fw, text, backTo) {
    const d = await dims(`${DIAG}/${file}.png`); const iw = W / fw, ih = iw * d.height / d.width;
    s.background = { color: 'FDFBF8' };
    s.addImage({ path: `${DIAG}/${file}.png`, x: -fx * iw, y: -fy * ih, w: iw, h: ih, objectName: '!!' + file });
    pill(s, text, 0.45, 0.35, Math.min(8, 0.9 + text.length * 0.1), 0.44, C.bg, C.cream, { lc: C.bg });
    back(s, backTo, 'Back out');
  }
  async function shot(s, f, x, y, w, h, o = {}) {
    const p = `img/${f}.jpg`; const d = await dims(p);
    rect(s, x - 0.035, y - 0.035, w + 0.07, h + 0.07, C.line, { r: 0.06, shadow: o.shadow !== false });
    const ih = (d.height / d.width) * w;
    if (ih >= h) s.addImage({ path: p, x, y, w, h, sizing: { type: 'crop', x: 0, y: 0, w, h }, ...(o.name ? { objectName: o.name } : {}) });
    else s.addImage({ path: p, x, y: y + (h - ih) / 2, w, h: ih, ...(o.name ? { objectName: o.name } : {}) });
    if (o.cap) T(s, o.cap, { x, y: y + h + 0.1, w, h: 0.3, fontSize: F.label, color: C.grey2 });
  }
  // a full-frame picture (cover), used where a tile or a screen grows to fill the frame
  async function cover(s, f, name) {
    const p = `img/${f}.jpg`; const d = await dims(p); const r = d.width / d.height;
    const w = r >= W / H ? H * r : W, h = r >= W / H ? H : W / r;
    s.addImage({ path: p, x: (W - w) / 2, y: 0, w, h, objectName: name });
  }

  // ======================================================================================
  // 01 SPRINT — the door
  // ======================================================================================
  camIn('s_in', 'obj_door', 3.2, 'HABIBA');
  add('s_goal', async (s) => {
    kicker(s, '01 · Sprint 1 · Oct 11 – 24');
    title(s, 'A working closet.');
    sub(s, 'A signed-in user can build and manage a real digital closet.', { x: 0.6, y: 1.75, w: 11, h: 0.45 });
    [['15 / 15', 'stories done'], ['48 / 48', 'story points'], [`${N.s1} / ${N.s1}`, 'Sprint 1 tests pass']].forEach(([n, l], i) => {
      statement(s, n, { x: 0.6 + i * 3.6, y: 2.75, w: 3.4, h: 0.9, color: i < 2 ? C.s1 : C.cream });
      T(s, l, { x: 0.6 + i * 3.6, y: 3.65, w: 3.4, h: 0.35, fontSize: F.label, color: C.grey2 });
    });
    T(s, 'Moved at planning: US-61 (hide a piece for 7 days) → Sprint 2. It hides pieces from recommendations, which only arrive in Sprint 2.', { x: 0.6, y: 4.6, w: 9.5, h: 0.8, fontSize: F.bodyS, color: C.grey2 });
    back(s, 's_out'); action(s, 'The 15 stories', 's_stories'); footer(s);
    notes(s, 'HABIBA (0:30). "Sprint goal: a working closet. We committed 15 stories, 48 points, and finished all 15. US-61 moved to Sprint 2 at planning: it hides pieces from recommendations, which only exist in Sprint 2."');
  }, { t: 'fade' });
  add('s_stories', async (s) => {
    kicker(s, '01 · Sprint 1 · the committed stories');
    const rows = [['US-01', 'Register, log in (email / Google), lockout', 'Karim', 8], ['US-02', 'Short style quiz', 'Bashar', 2], ['US-03', 'Dress code and modest preference', 'Bashar', 2], ['US-04', 'Set my city', 'Bashar', 2],
      ['US-06', 'Delete my account and data', 'Karim', 2], ['US-08', 'Add a piece by photo', 'Karim', 8], ['US-09', 'Enter the piece’s details', 'Karim', 2], ['US-11', 'Review before saving', 'Karim', 2],
      ['US-12', 'Browse and filter my closet', 'Karim', 2], ['US-71', 'Edit a piece later', 'Karim', 2], ['US-56', 'One status per piece (5)', 'Karim', 2], ['US-15', 'Laundry basket in / out', 'Karim', 2],
      ['US-16', '“Wash done”', 'Karim', 2], ['US-46', 'Events and month calendar', 'Bashar', 8], ['US-64', 'Closet gaps by category / dress code', 'Bashar', 2]];
    const rh = 0.335, y0 = 1.0;
    label(s, 'STORY', { x: 0.6, y: y0, w: 2, h: 0.3 }); label(s, 'OWNER', { x: 7.4, y: y0, w: 2, h: 0.3 }); label(s, 'POINTS · STATUS', { x: 9.6, y: y0, w: 3.1, h: 0.3, align: 'right' });
    rows.forEach(([id, t, o, p], i) => {
      const y = y0 + 0.38 + i * rh;
      if (i % 2 === 0) rect(s, 0.45, y, 12.4, rh, C.panel, { r: 0.04, round: false });
      T(s, id, { x: 0.6, y, w: 0.9, h: rh, fontSize: F.label, bold: true, color: C.blush, valign: 'middle' });
      T(s, t, { x: 1.55, y, w: 5.8, h: rh, fontSize: 14, valign: 'middle' });
      T(s, o, { x: 7.4, y, w: 2, h: rh, fontSize: 14, color: C.grey2, valign: 'middle' });
      T(s, `${p}   ✓ Done`, { x: 9.6, y, w: 3.1, h: rh, fontSize: 14, color: C.s1, align: 'right', valign: 'middle' });
    });
    T(s, 'Screens: Salma · tests: Youssef · Scrum and documents: Habiba', { x: 0.6, y: y0 + 0.45 + 15 * rh, w: 9, h: 0.3, fontSize: F.label, color: C.grey });
    back(s, 's_goal', 'Back to the goal'); action(s, 'What it looks like', 's_s1'); footer(s);
    notes(s, 'HABIBA (0:20). Each story has an owner and an estimate. Don\'t read the table — point at US-08 (the photo) and US-15/16 (laundry): you will see both in the demo.');
  }, { t: 'fade' });
  add('s_s1', async (s) => {
    kicker(s, '01 · Sprint 1 · what we delivered (graded)');
    const G = [['01_login', 'US-01 · sign in, lockout'], ['04_quiz', 'US-02 – 04 · style quiz'], ['09_add_details', 'US-08 / 09 · add a piece'], ['13_closet_filtered', 'US-12 · browse and filter'],
      ['14_piece_detail', 'US-56 · one status'], ['17_laundry', 'US-15 / 16 · laundry'], ['22_planner_added', 'US-46 · events and calendar'], ['23_gaps', 'US-64 · closet gaps']];
    for (let i = 0; i < G.length; i++) { const c = i % 4, r = Math.floor(i / 4); await shot(s, G[i][0], 0.6 + c * 3.1, 1.0 + r * 2.75, 2.9, 1.81, { cap: G[i][1] }); }
    back(s, 's_stories', 'Back to the stories'); action(s, 'Jira evidence', 's_jira'); footer(s);
    notes(s, 'HABIBA (0:15). "To be precise about grading: these are the Sprint 1 stories — all 15 done. Everything else in the demo is labelled as an early preview."');
  }, { t: 'fade' });
  const JF = [['backlog', 'Sprint backlog', 'INSERT REAL JIRA BACKLOG SCREENSHOT HERE', 0.6, 1.55, 7.55, 4.95], ['board', 'Sprint board', 'INSERT REAL JIRA BOARD SCREENSHOT HERE', 8.4, 1.55, 4.33, 2.35],
    ['burndown', 'Burndown / sprint report', 'INSERT REAL JIRA BURNDOWN / SPRINT REPORT SCREENSHOT HERE', 8.4, 4.15, 4.33, 2.35]];
  pres.defineSlideMaster({ title: 'JIRA', background: { color: C.bg }, objects: [
    ...JF.flatMap(([k, , t, x, y, w, h]) => [
      { rect: { x, y, w, h, fill: { color: C.panel }, line: { color: C.rose, width: 1, dashType: 'dash' } } },
      { text: { text: t, options: { x: x + 0.3, y: y + h / 2 - 0.45, w: w - 0.6, h: 0.9, fontFace: BF, fontSize: 14, bold: true, color: C.grey2, align: 'center', valign: 'middle', charSpacing: 1 } } },
      { placeholder: { options: { name: 'jira_' + k, type: 'pic', x, y, w, h }, text: '' } }])] });
  add('s_jira', async (s) => {
    kicker(s, '01 · Sprint · the real Jira sprint (project SCRUM)');
    section(s, 'Evidence from Jira');
    for (const [, name, , x, y, w, h] of JF) T(s, name, { x, y: y + h + 0.06, w, h: 0.3, fontSize: F.label, color: C.grey2 });
    pill(s, '↗  Open the live board', W - 1.25 - 2.9, 0.88, 2.9, BTN.h, C.bg, C.blush, { lc: C.rose, hyperlink: { url: 'https://aucegypt-team-r73i3oon.atlassian.net/jira/software/projects/SCRUM/boards/1' } });
    back(s, 's_s1', 'Back'); action(s, 'Your feedback', 's_feedback'); footer(s);
    notes(s, 'HABIBA (0:20). Show the three Jira views; click "Open the live board" for 10 seconds if the network allows. BEFORE THE TALK: in PowerPoint (Normal view) click the picture icon in each dashed frame — or drag the screenshot onto it — to insert the real backlog, board and burndown / sprint report. The frames are picture placeholders: the screenshot fills the frame. Do not use any image that is not from our real Jira.');
  }, { t: 'fade', master: 'JIRA' });
  add('s_feedback', async (s) => {
    kicker(s, '01 · Sprint · your Milestone 1 feedback');
    section(s, 'You told us. We changed it.');
    const rows = [['Authentication not evident', 'A security pipeline in front of every module: gateway → validation → authentication → access control → audit.', 'Component diagram'],
      ['Admin missing in the use case', 'An Admin actor: accounts, system health, privacy requests — no access to wardrobes.', 'Use case diagram'],
      ['Role of the LLM', 'The model only picks one of 14 whitelisted functions; our modules do the work; every change can be undone.', 'Component · use case'],
      ['Availability not a component', 'Its own component and state machine: 5 statuses, 10 legal moves.', 'Component · state'],
      ['More customisation; calendar', 'Laundry time, recycle time, return dates, laundry day; .ics import.', 'US-84 – US-87']];
    rows.forEach(([a, b, c], i) => {
      const y = 1.75 + i * 0.97;
      rect(s, 0.6, y, 12.1, 0.85, C.panel, { r: 0.08 });
      T(s, a, { x: 0.85, y, w: 3.2, h: 0.85, fontSize: F.bodyS, bold: true, color: C.blush, valign: 'middle' });
      T(s, b, { x: 4.15, y, w: 6.3, h: 0.85, fontSize: F.bodyS, valign: 'middle' });
      T(s, c, { x: 10.5, y, w: 2.05, h: 0.85, fontSize: F.label, color: C.grey2, valign: 'middle', align: 'right' });
    });
    back(s, 's_jira', 'Back'); action(s, 'Who uses Closet', 's_uc'); footer(s);
    notes(s, 'HABIBA (0:30). Five comments, five changes — each one visible in a diagram you will see inside the system.');
  }, { t: 'fade' });
  add('s_uc', async (s) => {
    kicker(s, '01 · Sprint · who uses Closet');
    section(s, 'Two actors. Six services.');
    const groups = [['USER', ['Register / log in', 'Style profile', 'Closet and laundry', 'Plan events', 'Three looks · change · try on', 'Ask Closet · shopping'], C.blush], ['ADMIN', ['Manage accounts', 'System health', 'Privacy requests'], C.taupe], ['SERVICES', ['Weather', 'Language model', 'Calendar', 'Photo storage', 'Try-on (planned)', 'Notifications (planned)'], C.grey2]];
    groups.forEach(([g, items, col], i) => {
      const x = 0.6 + i * 4.15;
      label(s, g, { x, y: 1.85, w: 3.9, h: 0.3, color: col });
      items.forEach((t, j) => pill(s, t, x, 2.3 + j * 0.64, 3.8, 0.5, C.panel, C.cream, { lc: C.line, bold: false, fontSize: F.bodyS }));
    });
    back(s, 's_feedback', 'Back'); action(s, 'VIEW UML', 's_uml'); footer(s);
    notes(s, 'HABIBA (0:20). The simple view first. CLICK "VIEW UML" for the formal use case diagram.');
  }, { t: 'fade' });
  const zoomBtns = (s, list) => { if (LIN) return; let x = 4.1; for (const [t, id] of list) { const w = 0.6 + t.length * 0.105; pill(s, t, x, BTN.y, w, BTN.h, C.bg, C.cream, { lc: C.line, hyperlink: { slide: num(id), tooltip: t } }); x += w + 0.15; } };
  add('s_uml', async (s) => {
    kicker(s, '01 · Sprint · UML use case diagram v1.4');
    const b = await diagram(s, 'D1_use_case_overview', { y: 0.85, h: 5.65 });
    link(s, b.x, b.y, b.w * 0.5, b.h * 0.78, 's_uml_u', 'Zoom: the user side'); link(s, b.x, b.y + b.h * 0.78, b.w * 0.8, b.h * 0.22, 's_uml_a', 'Zoom: the Admin'); link(s, b.x + b.w * 0.5, b.y, b.w * 0.5, b.h * 0.78, 's_uml_x', 'Zoom: external services');
    back(s, 's_out'); zoomBtns(s, [['User side', 's_uml_u'], ['Admin', 's_uml_a'], ['External services', 's_uml_x']]); footer(s);
    notes(s, 'HABIBA (0:30). The complete formal diagram first: User and Admin, six external services, colour = the sprint of each use case. Then zoom: User side → Admin → External services (buttons at the bottom, or click that part of the diagram). Each zoom returns here.');
  }, { t: 'fade' });
  add('s_uml_u', async (s) => { await zoom(s, 'D1_use_case_overview', 0.0, 0.08, 0.56, 'Use cases · the user’s side', 's_uml'); notes(s, 'HABIBA. The user: account, profile, closet, laundry, planner (Sprint 1 in green), then the previews.'); }, { io: true, num: false });
  add('s_uml_a', async (s) => { await zoom(s, 'D1_use_case_overview', 0.08, 0.45, 0.55, 'Use cases · the Admin', 's_uml'); notes(s, 'HABIBA. The Admin actor you asked for: manage accounts, system health, privacy requests — no access to wardrobes.'); }, { io: true, num: false });
  add('s_uml_x', async (s) => { await zoom(s, 'D1_use_case_overview', 0.44, 0.06, 0.56, 'Use cases · external services', 's_uml'); notes(s, 'HABIBA. External services as actors: try-on, the language model, weather, calendar, notifications.'); }, { io: true, num: false });
  camOut('s_out', 'obj_door', 3.2);
  hub('Back in the room. CLICK the MIRROR — the product. Hand over to Salma.');

  // ======================================================================================
  // 02 PRODUCT — the mirror comes closer, its glass darkens, the app appears in it, the frame
  // passes the edges and the app is full screen: the same picture Chrome shows → live demo.
  // ======================================================================================
  const MIR = { k: 1.18, ...centre('obj_mirror') };
  const glass = (k) => { const g = POS.mirror_dark; const pad = 60; return { x: ((g.x + pad - MIR.cx) * k + 1200) / PX, y: ((g.y + pad - MIR.cy) * k + 675) / PX, w: ((g.width - 2 * pad) * k) / PX, h: ((g.height - 2 * pad) * k) / PX }; };
  const mirrorAt = (s, k, dark) => { const cam = { ...MIR, k }; room(s, cam, { focus: 'obj_mirror' }); if (dark) art(s, 'mirror_dark', cam); };
  const FILL = 2.05;
  add('p_in', async (s) => { mirrorAt(s, MIR.k, false); notes(s, 'SALMA (0:05). The camera approaches the mirror (Morph).'); }, { adv: 200, cam: true });
  add('p_fill', async (s) => { mirrorAt(s, FILL, false); notes(s, 'SALMA. The mirror fills the screen.'); }, { adv: 150, cam: true });
  add('p_app', async (s) => {
    s.background = { color: C.bg };
    mirrorAt(s, FILL, true);
    const g = glass(FILL); const iw = g.w * 0.94, ih = iw * 9 / 16;
    statement(s, 'Instead of explaining it,\nwe’ll show you.', { x: g.x - 0.3, y: 0.45, w: g.w + 0.6, h: 1.5, fontSize: 38, align: 'center', valign: 'middle', objectName: '!!pstate' });
    s.addImage({ path: 'img/handoff_home.jpg', x: g.x + (g.w - iw) / 2, y: 2.15, w: iw, h: ih, objectName: '!!appscreen' });
    if (!LIN) {
      pill(s, '▶  Live demo', W / 2 - 2.55, 5.95, 2.4, 0.48, C.cream, C.ink, { hyperlink: { slide: num('p_demo'), tooltip: 'Live demo' } });
      pill(s, '▶  Backup recording', W / 2 + 0.15, 5.95, 2.4, 0.48, C.bg, C.cream, { lc: C.rose, hyperlink: { slide: num('x_video'), tooltip: 'The recorded demo (embedded video)' } });
    }
    footer(s);
    notes(s, `SALMA (0:10). "I'm Salma — every screen. Instead of explaining it, we'll show you." The reflection has become the app. CLICK (or "Live demo"): the app grows to full screen. If the live app is not working: click "Backup recording" — the embedded video of the same demo plays in PowerPoint; its "Back to the talk" button returns to the slide after the demo.`);
  }, { t: LIN ? 'fade' : 'morph' });
  add('p_demo', async (s) => {
    if (!LIN) mirrorAt(s, 4.4, true);
    s.addImage({ path: 'img/handoff_home.jpg', x: 0, y: 0, w: W, h: H, objectName: '!!appscreen' });
    notes(s, `SALMA — LIVE DEMO (4–6 min). This slide is the same picture as Chrome in full screen. Switch to Chrome (Alt-Tab / Cmd-Tab): signed in as demo@closet.app, Home open, full screen (F11), zoom 100 %. Run Demo_Preflight.md before the talk.
1 Home · 2 Closet → Navy blazer → In laundry · 3 Laundry → Wash done · 4 Style me → University → Generate 3 looks (WOW 1) · 5 click the top of LOOK 01 → pick a replacement (WOW 2) · 6 Try on → photo → next look → Favourite (WOW 3) · 7 Analytics → forgotten Denim jacket → Another chance (WOW 4) · 8 Mix & Match → Work → suggested look → top = Red cropped tee → Suggest a fix (WOW 5) · 9 Closet → Silk scarf → Remove → Torn / damaged (WOW 6) · 10 Ask Closet: "Do I need beige trousers?" → "Add this to my shopping list" → Shopping bag · 11 Analytics → Closet has learned → flip → Confirm → Undo (WOW 7) · 12 Home.
If anything fails: come back to PowerPoint, go back one slide and click "Backup recording".`);
  }, { num: false });
  add('p_return', async (s) => {
    s.addImage({ path: 'img/handoff_home.jpg', x: 0, y: 0, w: W, h: H, objectName: '!!appscreen' });
    notes(s, 'SALMA. Back from Chrome — the same picture, so the switch is invisible. Hand over to Karim. CLICK.');
  }, { t: 'fade', num: false });

  add('p_simple', async (s) => {
    s.addImage({ path: 'img/handoff_home.jpg', x: 0, y: 0, w: W, h: H, objectName: '!!appscreen' });
    rect(s, 0, 0, W, H, C.ink, { round: false, tr: 22, name: '!!veil' });
    statement(s, 'What the user sees is simple.', { x: 0.6, y: 2.9, w: 12.1, h: 1.2, align: 'center', valign: 'middle', objectName: '!!simple' });
    notes(s, 'KARIM (0:05). "I\'m Karim — backend and database. What the user sees is simple." CLICK.');
  }, { num: false });
  // ======================================================================================
  // 03 INSIDE THE SYSTEM — "What happens behind one click?" → a closed laptop → into its screen →
  // the UI moves towards us and each layer appears behind the one before.
  // ======================================================================================
  const LAP = POS.laptop_closed;
  add('p_bridge', async (s) => {
    s.background = { color: C.ink };
    s.addImage({ path: 'img/handoff_home.jpg', x: 4.2, y: 0.9, w: 4.9, h: 4.9 * 9 / 16, objectName: '!!appscreen', transparency: 100 });
    art(s, 'laptop_closed', null, { as: 'laptop' });
    kicker(s, '03 · Inside the system');
    statement(s, 'What happens behind one click isn’t.', { x: 0.6, y: 0.75, w: 12.1, h: 0.95, fontSize: 46, objectName: '!!simple' });
    sub(s, 'Salma pressed “Save” on a new piece. Click the laptop.', { x: 0.6, y: 1.9, w: 9, h: 0.45 });
    link(s, LAP.x / PX, LAP.y / PX, LAP.width / PX, LAP.height / PX, 'a_open', 'Open the laptop');
    if (!LIN) pill(s, 'Feature tour (backup)', 4.6, BTN.y, 2.9, BTN.h, C.bg, C.grey2, { lc: C.line, hyperlink: { slide: num('p_hub'), tooltip: 'The features as slides' } });
    footer(s);
    notes(s, 'KARIM (0:10). "What happens behind one click isn\'t. Salma pressed Save — what actually happened?" CLICK the laptop. (If the demo could not run: "Feature tour" shows each feature as slides.)');
  }, { t: 'fade' });
  add('a_open', async (s) => {
    s.background = { color: C.ink };
    s.addImage({ path: 'scene/laptop_home.png', x: 2.6, y: 0.9, w: 8.1, h: 8.1 * 1100 / 1800, objectName: '!!laptop' });
    notes(s, 'KARIM. The laptop opens; the camera moves toward the screen.');
  }, { adv: 100, cam: true });
  add('a_cam', async (s) => {
    s.background = { color: C.ink };
    const k = 2.35; s.addImage({ path: 'scene/laptop_home.png', x: W / 2 - (8.1 * k) / 2, y: H / 2 - 2.6 * k, w: 8.1 * k, h: 8.1 * k * 1100 / 1800, objectName: '!!laptop' });
    notes(s, 'KARIM. Into the screen.');
  }, { adv: 100, cam: true });
  const LAYERS = [['React UI', 'The Closet screen · api.js sends POST /api/v1/items'], ['API Gateway', 'HTTPS · CORS · CSP · rate limit'], ['Auth and security', 'JWT · validation · access control · audit'],
    ['Feature modules', 'Wardrobe service: the rules · emits ItemCreated'], ['Repository', 'SQL with user_id on every row'], ['PostgreSQL', 'wardrobe.items · one schema per module']];
  const SLAB_R = 610 / 1170;
  // a layer at depth d (0 = in focus, 1 = one step closer to us, …): bigger, lower, fading out
  const slabAt = (s, i, d) => {
    const w = 6.2 * (1 + 0.62 * d), h = w * SLAB_R, cx = W / 2 + 0.6, cy = 3.55 + 2.35 * d;
    s.addImage({ path: `scene/slab${i}.png`, x: cx - w / 2, y: cy - h / 2, w, h, objectName: '!!slab' + i, transparency: Math.min(90, d * 38) });
  };
  add('a_l1', async (s) => {
    s.addImage({ path: 'img/handoff_home.jpg', x: 0, y: 0, w: W, h: H, objectName: '!!slab0' });
    rect(s, 0, H - 2.2, W, 2.2, C.ink, { round: false, tr: 10 });
    label(s, 'LAYER 1 / 6', { x: 0.6, y: H - 2.05, w: 3, h: 0.3 });
    T(s, 'React UI', { x: 0.6, y: H - 1.72, w: 4, h: 0.65, fontFace: HF, fontSize: F.section });
    T(s, LAYERS[0][1], { x: 4.0, y: H - 1.6, w: 8.5, h: 0.45, fontSize: F.body, color: C.grey2 });
    back(s, 'a_out'); footer(s);
    notes(s, 'KARIM. Only the screen first — the React UI. api.js sends POST /api/v1/items with the photo. CLICK: the UI moves towards us and the next layer appears behind it.');
  });
  for (let n = 2; n <= 6; n++) add(`a_l${n}`, async (s) => {
    for (let i = 0; i < n; i++) { const d = n - 1 - i; if (d <= 2) slabAt(s, i, d); }
    kicker(s, `03 · Inside the system · layer ${n} / 6`);
    section(s, LAYERS[n - 1][0], { objectName: '!!layername' });
    T(s, LAYERS[n - 1][1], { x: 0.6, y: 1.55, w: 7.5, h: 0.4, fontSize: F.body, color: C.grey2, objectName: '!!layerline' });
    back(s, 'a_out'); footer(s);
    notes(s, `KARIM. ${LAYERS[n - 1][0]}: ${LAYERS[n - 1][1]}.${n === 6 ? ' The bottom. CLICK: the whole stack.' : ' CLICK.'}`);
  });
  add('a_stack', async (s) => {
    kicker(s, '03 · Inside the system · one click, six layers');
    const w = 4.3, h = w * SLAB_R, x0 = 0.9, gap = 0.78, y0 = 1.05;
    for (let i = 5; i >= 0; i--) s.addImage({ path: `scene/slab${i}.png`, x: x0, y: y0 + i * gap, w, h, objectName: '!!slab' + i });
    for (let i = 0; i < 6; i++) {
      const ly = y0 + i * gap + h * 0.42;
      s.addShape(pres.shapes.LINE, { x: x0 + w * 0.86, y: ly + 0.12, w: 6.6 - (x0 + w * 0.86), h: 0, line: { color: C.line, width: 1 } });
      T(s, [{ text: LAYERS[i][0], options: { bold: true, fontSize: F.bodyS, breakLine: true } }, { text: LAYERS[i][1], options: { color: C.grey2, fontSize: F.label } }], { x: 6.75, y: ly - 0.12, w: 5.9, h: 0.6 });
    }
    T(s, 'The same path for every request. No module calls another directly — Availability hears ItemCreated on the event bus.', { x: 6.75, y: 0.85, w: 5.9, h: 0.75, fontSize: F.bodyS, color: C.blush });
    back(s, 'a_out'); action(s, 'VIEW FORMAL UML', 'a_uml', 3.1); footer(s);
    notes(s, 'KARIM (0:20). The whole stack. CLICK "VIEW FORMAL UML": the component diagram grows out of the Feature-modules layer.');
  });
  add('a_uml', async (s) => {
    kicker(s, '03 · UML component diagram v1.4 (Youssef)');
    const b = await diagram(s, 'D3_component_diagram', { y: 0.85, h: 5.75, name: '!!slab3' });
    link(s, b.x, b.y, b.w / 2, b.h, 'a_uml_l', 'Zoom: pipeline and core modules'); link(s, b.x + b.w / 2, b.y, b.w / 2, b.h, 'a_uml_r', 'Zoom: intelligence and adapters');
    back(s, 'a_stack', 'Back to the layers'); action(s, 'Lower-level design', 'a_design', 3.1); footer(s);
    notes(s, 'KARIM (0:40). The formal UML: the security pipeline (your authentication comment), Availability as its own component, the LLM behind an adapter. Colour = sprint, dashed = planned. Click a half to zoom.');
  });
  add('a_uml_l', async (s) => { await zoom(s, 'D3_component_diagram', 0.0, 0.09, 0.62, 'Security pipeline and the core modules', 'a_uml'); notes(s, 'KARIM. Gateway → validation → authentication → access control → audit.'); }, { io: true, num: false });
  add('a_uml_r', async (s) => { await zoom(s, 'D3_component_diagram', 0.38, 0.09, 0.62, 'Intelligence, adapters and external services', 'a_uml'); notes(s, 'KARIM. Closet Intelligence, Ask Closet with the LLM adapter, Smart Shopping, Admin; adapters with fallbacks.'); }, { io: true, num: false });
  const DESIGN = [['a_er', 'Data · ER', 'ER_complete'], ['a_class', 'Classes', 'D6_class_diagram'], ['a_seq1', 'Sequence · add a piece', 'D7_sequence_add_piece'], ['a_state', 'State · a piece’s status', 'D9_state_machine'],
    ['a_seq2', 'Sequence · delete → bag', 'D14_sequence_delete_reason'], ['a_seq3', 'Sequence · try-on photo', 'D16_sequence_tryon_photo']];
  add('a_design', async (s) => {
    kicker(s, '03 · Lower-level design (Bashar)');
    section(s, 'Open any design.');
    for (let i = 0; i < DESIGN.length; i++) {
      const [id, t, f] = DESIGN[i]; const x = 0.6 + (i % 3) * 4.1, y = 1.75 + Math.floor(i / 3) * 2.5;
      rect(s, x - 0.04, y - 0.04, 3.88, 1.96, 'FDFBF8', { r: 0.06, shadow: true });
      s.addImage({ path: `${DIAG}/${f}.png`, x, y, w: 3.8, h: 1.88, sizing: { type: 'contain', w: 3.8, h: 1.88 }, objectName: '!!' + f });
      T(s, t, { x, y: y + 2.0, w: 3.8, h: 0.32, fontSize: F.bodyS });
      link(s, x, y, 3.8, 1.88, id, t);
    }
    back(s, 'a_out'); footer(s);
    notes(s, 'BASHAR (0:20). "I\'m Bashar — lower-level design. Every module is Router → Service → Repository." Open the ER first, then whichever the professor asks for.');
  }, { t: 'fade' });
  add('a_er', async (s) => {
    kicker(s, '03 · ER diagram · the complete database');
    const b = await diagram(s, 'ER_complete', { y: 0.8, h: 5.85, name: '!!ER_complete' });
    const R = [['a_er_core', 'CORE DATA', 0, 0, 0.62, 0.42], ['a_er_out', 'OUTFITS', 0, 0.5, 0.48, 0.5], ['a_er_int', 'INTELLIGENCE', 0.48, 0.5, 0.3, 0.5], ['a_er_shop', 'SHOPPING', 0.74, 0.5, 0.26, 0.5]];
    if (!LIN) for (const [id, t, fx, fy, fw, fh] of R) { pill(s, t, b.x + fx * b.w + 0.1, b.y + fy * b.h + 0.08, 1.75, 0.34, C.rose, C.ink, { fontSize: F.labelS, tr: 5 }); link(s, b.x + fx * b.w, b.y + fy * b.h, fw * b.w, fh * b.h, id, t); }
    back(s, 'a_design', 'Back to the designs'); footer(s);
    notes(s, 'KARIM / BASHAR (0:30). One database, one schema per module, user_id on every table. Click a region: core data, outfits, intelligence, shopping.');
  }, { t: 'fade' });
  const erz = (id, fx, fy, fw, text) => add(id, async (s) => { await zoom(s, 'ER_complete', fx, fy, fw, text, 'a_er'); notes(s, `ER zoom: ${text}.`); }, { io: true, num: false });
  erz('a_er_core', 0.0, 0.04, 0.78, 'Core data · accounts, profile, wardrobe, availability, planner');
  erz('a_er_out', 0.0, 0.5, 0.5, 'Outfits · saved looks, wears, feedback, hidden items');
  erz('a_er_int', 0.45, 0.5, 0.42, 'Closet Intelligence · learned, notifications, activity, packing');
  erz('a_er_shop', 0.68, 0.5, 0.33, 'Shopping · decisions, list items, assistant actions');
  for (const [id, t, f] of DESIGN.slice(1)) add(id, async (s) => {
    kicker(s, `03 · ${t}`);
    await diagram(s, f, { y: 0.85, h: 5.75 });
    back(s, 'a_design', 'Back to the designs'); footer(s);
    notes(s, `BASHAR. ${t}.`);
  }, { t: 'fade' });
  camOut('a_out', 'obj_panel', 2.4);
  hub('Back in the room. CLICK the DRAWER — quality. Hand over to Youssef.');

  // ======================================================================================
  // 04 QUALITY — the drawer. One state at a time.
  // ======================================================================================
  camIn('q_in', 'obj_dresser', 3.0, 'YOUSSEF');
  add('q_1', async (s) => { s.background = { color: C.ink }; statement(s, 'Looks good.', { x: 0.8, y: 2.9, w: 11.7, h: 1.2, align: 'center', objectName: '!!q1' }); notes(s, 'YOUSSEF. "I\'m Youssef — testing, CI and deployment. It looks good."'); }, { t: 'fade', num: false });
  add('q_2', async (s) => {
    s.background = { color: C.ink };
    statement(s, 'Looks good.', { x: 0.8, y: 2.0, w: 11.7, h: 1.0, align: 'center', color: '5A504D', objectName: '!!q1' });
    statement(s, 'But does it actually work?', { x: 0.8, y: 3.25, w: 11.7, h: 1.2, align: 'center', italic: true, color: C.blush, objectName: '!!q2' });
    notes(s, 'YOUSSEF. "But does it actually work?" — four kinds of proof, one at a time.');
  }, { num: false });
  const LV = [['UNIT', '89', 'Unit tests', 'Validators, passwords, photo checks, closet gaps, the status machine.'], ['API', '65', 'API tests', 'Every endpoint through the real security pipeline and a PostgreSQL test database.'],
    ['BLACK BOX', 'EP · BVA · ST', 'Black-box design', 'Equivalence classes, boundaries (password 7 / 8, photo 10 MB / +1 byte), all 25 status pairs.'], ['ACCEPTANCE', '15', 'Acceptance tests', 'One automated test per Sprint 1 story, written from its criteria.']];
  const progress = (s, list, n, prefix) => list.forEach((t, i) => {
    const w = 12.1 / list.length;
    T(s, t, { x: 0.6 + i * w, y: 6.25, w, h: 0.3, fontSize: F.labelS, bold: true, charSpacing: 2, align: 'center', color: i === n ? C.rose : i < n ? C.grey : '4A403E', objectName: `!!${prefix}p${i}` });
    rect(s, 0.6 + i * w + 0.1, 6.62, w - 0.2, 0.05, i === n ? C.rose : i < n ? C.grey : C.line, { round: false, name: `!!${prefix}b${i}` });
  });
  LV.forEach(([t, v, name, d], i) => add(`q_l${i + 1}`, async (s) => {
    s.background = { color: C.ink };
    kicker(s, '04 · Quality · Sprint 1');
    statement(s, v, { x: 0.8, y: 1.55, w: 11.7, h: 1.2, align: 'center', color: v.length > 3 ? C.blush : C.s1, objectName: '!!qv' });
    section(s, name, { x: 0.8, y: 2.95, w: 11.7, h: 0.7, align: 'center', objectName: '!!qn' });
    T(s, d, { x: 2.2, y: 3.8, w: 8.9, h: 0.9, fontSize: F.body, color: C.grey2, align: 'center', objectName: '!!qd' });
    progress(s, LV.map((x) => x[0]), i, 'lv'); footer(s);
    notes(s, `YOUSSEF. ${name}: ${d} CLICK.`);
  }, { t: i === 0 ? 'fade' : 'morph' }));
  add('q_total', async (s) => {
    s.background = { color: C.ink };
    T(s, `${N.tests} / ${N.tests}`, { x: 0.6, y: 1.6, w: 12.1, h: 2.0, fontFace: HF, fontSize: 120, color: C.s1, align: 'center', valign: 'middle', objectName: '!!qbig' });
    T(s, 'AUTOMATED TESTS PASSED', { x: 0.6, y: 3.75, w: 12.1, h: 0.5, fontSize: F.sub, bold: true, charSpacing: 4, align: 'center', objectName: '!!qbig2' });
    T(s, '0 FAILED · 0 SKIPPED', { x: 0.6, y: 4.35, w: 12.1, h: 0.4, fontSize: F.body, color: C.grey2, charSpacing: 3, align: 'center', objectName: '!!qbig3' });
    footer(s);
    notes(s, `YOUSSEF (0:15). Pause on the number. "${N.tests} of ${N.tests} automated tests pass. Zero failed, zero skipped." Real output: evidence/test_run_final.txt (26 Oct 2026). CLICK.`);
  }, { t: 'fade' });
  add('q_proof', async (s) => {
    s.background = { color: C.ink };
    T(s, `${N.tests} / ${N.tests}`, { x: 0.6, y: 0.55, w: 12.1, h: 1.2, fontFace: HF, fontSize: 72, color: C.s1, align: 'center', valign: 'middle', objectName: '!!qbig' });
    T(s, 'AUTOMATED TESTS PASSED', { x: 0.6, y: 1.8, w: 12.1, h: 0.4, fontSize: F.body, bold: true, charSpacing: 4, align: 'center', objectName: '!!qbig2' });
    T(s, '0 FAILED · 0 SKIPPED', { x: 0.6, y: 2.2, w: 12.1, h: 0.35, fontSize: F.label, color: C.grey2, charSpacing: 3, align: 'center', objectName: '!!qbig3' });
    const EV = [[`${N.s1} / ${N.s1}`, 'Sprint 1 tests'], ['15 / 15', 'acceptance tests · one per story'], [N.lines, 'line coverage'], [N.branches, 'branch coverage'], [N.funcs, 'function coverage'], [`${N.e2e} steps × 3`, 'browser journey · fresh seed · identical']];
    EV.forEach(([n, l], i) => { const c = i % 3, r = Math.floor(i / 3), x = 1.35 + c * 3.65, y = 3.05 + r * 1.3;
      T(s, n, { x, y, w: 3.4, h: 0.7, fontFace: HF, fontSize: F.section, align: 'center' }); T(s, l, { x, y: y + 0.68, w: 3.4, h: 0.35, fontSize: F.label, color: C.grey2, align: 'center' }); });
    T(s, 'We did not just build it. We proved that it works.', { x: 0.6, y: 5.75, w: 12.1, h: 0.5, fontFace: HF, fontSize: F.sub, italic: true, color: C.blush, align: 'center' });
    back(s, 'q_out'); action(s, 'One bug, as a story', 'q_bug'); footer(s);
    notes(s, `YOUSSEF (0:30). Sprint 1: ${N.s1} of ${N.s1}; 15 acceptance tests, one per story. Coverage (V8 reports lines, branches and functions; no statement figure): ${N.lines}, ${N.branches}, ${N.funcs}. The ${N.e2e}-step browser journey ran three times from a fresh seed with identical results. "We did not just build it. We proved that it works." CLICK the bug story.`);
  });
  const CHAIN = [['TEST', 'Demo rehearsal: “Style this piece” on a forgotten camel cardigan at 30 °C.'], ['FAILURE', 'Three looks — none of them contained the cardigan.'], ['BUG', 'The weather filter removed the warm piece before the chosen-piece step.'],
    ['FIX', 'The chosen piece goes back into the pool when it is Available.'], ['REGRESSION', 'RE-31 and API-FP01: every look must contain it.'], ['PASS', `${N.tests} / ${N.tests} · D-06 closed.`]];
  const SHORT = ['Rehearsal: “Style this piece” on a forgotten cardigan at 30 °C', 'Three looks — none with the cardigan', 'Weather filter removed the warm piece first', 'The chosen piece goes back into the pool', 'RE-31 + API-FP01: every look must contain it', `${N.tests} / ${N.tests} · D-06 closed`];
  const timeline = (n) => async (s) => {
    s.background = { color: C.ink };
    kicker(s, '04 · Quality · one defect, end to end');
    section(s, 'A real bug, found in rehearsal.');
    sub(s, 'D-06 · high severity', { x: 0.6, y: 1.55, w: 8, h: 0.4, color: C.grey2 });
    const x0 = 1.15, step = 2.2, ly = 3.55;
    s.addShape(pres.shapes.LINE, { x: x0, y: ly, w: step * 5, h: 0, line: { color: C.line, width: 2 }, objectName: '!!tl' });
    if (n > 1) s.addShape(pres.shapes.LINE, { x: x0, y: ly, w: step * (n - 1), h: 0, line: { color: C.rose, width: 2.5 }, objectName: '!!tlon' });
    CHAIN.forEach(([t], i) => {
      const on = i < n, col = i === 1 || i === 2 ? C.bad : i === 5 ? C.s1 : C.blush, x = x0 + i * step;
      s.addShape(pres.shapes.OVAL, { x: x - 0.14, y: ly - 0.14, w: 0.28, h: 0.28, fill: { color: on ? col : C.bg }, line: { color: on ? col : C.line, width: 2 }, objectName: '!!tn' + i });
      T(s, t, { x: x - 1.0, y: ly - 0.85, w: 2.0, h: 0.35, fontSize: F.label, bold: true, charSpacing: 2, align: 'center', color: on ? col : '4A403E', objectName: '!!tt' + i });
      if (on) T(s, SHORT[i], { x: x - 1.02, y: ly + 0.38, w: 2.04, h: 1.6, fontSize: F.bodyS, align: 'center', color: i === n - 1 ? C.cream : C.grey2, objectName: '!!td' + i });
    });
    if (n === 6) { T(s, 'Found because we rehearsed the live demo. D-07 was found the same way; all seven defects are in the appendix.', { x: 0.6, y: 5.75, w: 12.1, h: 0.4, fontSize: F.bodyS, color: C.grey2, align: 'center' }); back(s, 'q_proof', 'Back to the results'); action(s, 'CI and deployment', 'q_ci'); }
    footer(s);
    notes(s, n === 1 ? 'YOUSSEF (0:40). One bug, told as one path. CLICK for each step.' : `YOUSSEF. ${CHAIN[n - 1][0]}: ${CHAIN[n - 1][1]}${n === 6 ? '' : ' CLICK.'}`);
  };
  add('q_bug', timeline(1), { t: 'fade' });
  for (let n = 2; n <= 6; n++) add(`q_b${n}`, timeline(n));
  add('q_ci', async (s) => {
    kicker(s, '04 · Quality · deployment and continuous integration');
    await diagram(s, 'D11_deployment_ci', { y: 0.85, h: 5.2 });
    T(s, 'CI runs unit, API, acceptance and coverage on every pull request; the browser-journey job is configured and runs from the next push. Render deployment: blueprint written — the local run is the verified demo path.', { x: 0.6, y: 6.15, w: 12.1, h: 0.5, fontSize: F.bodyS, color: C.grey2 });
    back(s, 'q_out'); footer(s);
    notes(s, 'YOUSSEF (0:20). Be exact: the e2e job is configured but has not run in CI yet; the journey ran locally with saved evidence. Render deployment is not verified — the local setup is our demo path.');
  }, { t: 'fade' });
  camOut('q_out', 'obj_dresser', 3.0);
  hub('Back in the room. CLICK the standing MIRROR — our retrospective. Habiba.');

  // ======================================================================================
  // RETROSPECTIVE — the standing mirror fills the frame; one reflection at a time
  // ======================================================================================
  camIn('r_in', 'obj_oval', 3.6, 'HABIBA');
  const REF = [['WHAT FIT', C.s1, ['The architecture held: all 15 stories fitted the Milestone 1 modules.', 'Tests found real bugs before the demo — each with a regression test.']],
    ['WHAT DIDN’T', C.bad, ['Integration happened late.', 'Jira was not updated consistently — so there is no honest burndown.', 'Deployment slipped.']],
    ['WHAT WE’LL CHANGE', C.blush, ['Update Jira daily; review the burndown twice a week (Habiba).', 'Dependency checks during planning.', 'Deploy earlier; run the browser journey on every merge (Youssef).']]];
  const oval = (s) => s.addShape(pres.shapes.OVAL, { x: 2.9, y: -2.4, w: 7.5, h: 12.3, fill: { color: '241D1E' }, line: { color: 'C9A46A', width: 7 }, objectName: '!!ovalglass', shadow: { type: 'outer', color: 'E7C792', opacity: 0.25, blur: 30, offset: 0, angle: 90 } });
  add('r_0', async (s) => { s.background = { color: '120E0F' }; oval(s); statement(s, 'A look in the mirror.', { x: 3.4, y: 3.0, w: 6.5, h: 1.3, fontSize: 44, align: 'center', objectName: '!!rt' }); footer(s); notes(s, 'HABIBA (0:10). "A look in the mirror." Three reflections, one at a time.'); }, { t: 'fade' });
  REF.forEach(([t, col, items], i) => add(`r_${i + 1}`, async (s) => {
    s.background = { color: '120E0F' }; oval(s);
    T(s, 'A look in the mirror.', { x: 3.4, y: 0.95, w: 6.5, h: 0.4, fontSize: F.label, color: C.grey, align: 'center', objectName: '!!rt' });
    label(s, t, { x: 3.4, y: 2.0, w: 6.5, h: 0.35, fontSize: F.label, color: col, align: 'center', objectName: '!!rk' });
    T(s, items.map((x) => ({ text: x, options: { breakLine: true } })), { x: 3.85, y: 2.55, w: 5.6, h: 3.2, fontFace: HF, fontSize: 21, align: 'center', paraSpaceAfter: 12, objectName: '!!rb' });
    if (i === 2) back(s, 'r_out', 'Step back out');
    footer(s);
    notes(s, `HABIBA. ${t}: ${items.join(' ')}`);
  }));
  camOut('r_out', 'obj_oval', 3.6);
  hub('Back in the room. CLICK the BOX — the documents.');

  // ======================================================================================
  // DOCUMENTS — the jewellery box
  // ======================================================================================
  camIn('d_in', 'obj_box', 5.0, 'HABIBA');
  add('d_1', async (s) => {
    kicker(s, 'Documents · tracked changes');
    const col = async (x, name, what, imgs) => {
      T(s, name, { x, y: 0.8, w: 5.95, h: 0.6, fontFace: HF, fontSize: F.section });
      T(s, what, { x, y: 1.4, w: 5.95, h: 0.4, fontSize: F.sub, color: C.blush });
      let y = 1.98;
      for (const [f, h, cap] of imgs) { const p = `docs/${f}.png`, d = await dims(p), w = Math.min(5.95, h * d.width / d.height);
        rect(s, x - 0.03, y - 0.03, w + 0.06, h + 0.06, C.line, { r: 0.03, shadow: true }); s.addImage({ path: p, x, y, w, h });
        T(s, cap, { x, y: y + h + 0.05, w: 5.95, h: 0.3, fontSize: F.labelS, color: C.grey2 }); y += h + 0.45; }
    };
    await col(0.6, 'SRS v1.1', 'WHAT the system must do', [['srs_tracked_crop', 3.45, 'A real SRS page: added text green, removed text struck through, each change with its ID (C-04, C-28)']]);
    await col(6.85, 'SDD v1.1', 'HOW the system is designed', [['sdd_component_crop', 3.45, 'A real SDD page: component diagram v1.4 (Figure 3-1)']]);
    [['80', 'functional requirements'], ['15', 'non-functional requirements'], ['22', 'use cases'], ['84', 'user stories'], ['71', 'logged changes · ID, type, reason']].forEach(([n, l], i) => { const x = 3.75 + i * 1.82; T(s, n, { x, y: 5.95, w: 1.75, h: 0.5, fontFace: HF, fontSize: 28 }); T(s, l, { x, y: 6.42, w: 1.75, h: 0.4, fontSize: F.labelS, color: C.grey2 }); });
    back(s, 'd_out'); footer(s);
    notes(s, 'HABIBA (0:30). "The SRS says WHAT the system must do, the SDD says HOW it is designed — each in its IEEE template. These are real pages: added text green, removed text struck through, every change with an ID, a type and a reason. 80 functional and 15 non-functional requirements, 22 use cases, 84 stories, 71 logged changes."');
  }, { t: 'fade' });
  camOut('d_out', 'obj_box', 5.0);
  hub('Back in the room. CLICK anywhere except an object — the ending.');

  // ======================================================================================
  // FINAL — the closet we opened, lit sprint by sprint; the camera pulls back; doors close; LEDs dim
  // ======================================================================================
  // the room lights up sprint by sprint: the furniture (what we built), the mirror becomes the app
  // (what makes it intelligent), then the whole room (it learns)
  const LINES = [['SPRINT 1', 'We built the Closet.', C.s1], ['SPRINT 2', 'Now we make it intelligent.', C.s2], ['SPRINT 3', 'Then it learns from you.', C.s3]];
  const LIT = [['obj_door', 'obj_dresser'], ['obj_door', 'obj_dresser', 'obj_mirror'], AREAS.map((a) => a[0])];
  const reveal = (n) => async (s) => {
    s.background = { color: C.ink };
    room(s, null, { lit: LIT[n], ledTr: n === 2 ? 0 : 80 });
    if (n >= 1) { const gd = POS.mirror_dark, g = { x: (gd.x + 60) / PX, y: (gd.y + 60) / PX, w: (gd.width - 120) / PX, h: (gd.height - 120) / PX }; const iw = g.w * 0.94, ih = iw * 9 / 16; s.addImage({ path: 'img/handoff_home.jpg', x: g.x + (g.w - iw) / 2, y: g.y + g.h * 0.36, w: iw, h: ih, objectName: '!!endapp' }); }
    rect(s, 0, 6.0, W, 1.5, C.ink, { round: false, tr: 15, name: '!!fband' });
    T(s, LINES[n][0], { x: 0.6, y: 6.12, w: 12.1, h: 0.3, fontSize: F.labelS, bold: true, charSpacing: 3, align: 'center', color: LINES[n][2], objectName: '!!fsp' });
    statement(s, LINES[n][1], { x: 0.6, y: 6.4, w: 12.1, h: 0.85, fontSize: 44, italic: true, align: 'center', objectName: '!!fline' });
    notes(s, `HABIBA. "${LINES[n][1]}"${n === 0 ? ' The furniture lights — the closet itself.' : n === 1 ? ' The mirror becomes the app.' : ' The whole room comes on.'}`);
  };
  add('f_1', reveal(0), { t: 'fade', num: false });
  add('f_2', reveal(1), { num: false });
  add('f_3', reveal(2), { num: false });
  add('f_4', async (s) => { s.background = { color: C.ink }; room(s, { cx: 1200, cy: 675, k: 0.55 }, { lit: LIT[2], ledTr: 0 }); notes(s, 'The camera pulls back out of the room.'); }, { adv: 200, num: false });
  const PULL = { cx: 1200, cy: 690, k: 0.62 };
  const closetLit = (s, cam) => { art(s, 'open_room', cam); art(s, 'open_lit', cam); art(s, 'open_led', cam); };
  add('f_5', async (s) => { s.background = { color: C.ink }; closetLit(s, PULL); doorsOpen(s, PULL); notes(s, 'The wardrobe again, from outside.'); }, { t: 'fade', adv: 300, num: false });
  add('f_6', async (s) => { s.background = { color: C.ink }; art(s, 'open_room', PULL); art(s, 'open_led', PULL); doorsShut(s, PULL); notes(s, 'The doors close.'); }, { adv: 300, num: false });
  add('f_7', async (s) => { s.background = { color: C.ink }; art(s, 'open_room', PULL, { tr: 70 }); art(s, 'open_led', PULL, { tr: 88 }); doorsShut(s, PULL, 70); notes(s, 'The lights dim.'); }, { adv: 300, num: false });
  add('f_8', async (s) => {
    s.background = { color: C.ink };
    mark(s, { at: { x: W / 2 - 3, y: 1.55, w: 6, h: 1.5, fontSize: F.mark, align: 'center', valign: 'middle' }, glow: true });
    sub(s, [{ text: 'Your wardrobe. Your style. Your context.', options: { breakLine: true } }, { text: 'One intelligent system.', options: { color: C.cream } }], { x: 2.5, y: 3.25, w: W - 5, h: 1.0, align: 'center' });
    statement(s, 'Questions?', { x: 2.5, y: 4.6, w: W - 5, h: 0.9, fontSize: 44, italic: true, align: 'center' });
    if (!LIN) pill(s, 'Appendix for Q&A', W / 2 - 1.45, BTN.y, 2.9, BTN.h, C.bg, C.blush, { lc: C.line, hyperlink: { slide: num('appx'), tooltip: 'Appendix' } });
    notes(s, 'HABIBA (0:10). "Closet — your wardrobe, your style, your context. One intelligent system. Thank you. Questions?"');
  }, { t: 'fade', num: false });

  // ======================================================================================
  // APPENDIX (Q&A) and the feature tour (a backup for the live demo)
  // ======================================================================================
  const table = (s, rows, x, y, cw, o = {}) => {
    const rh = o.rh || 0.5;
    rows.forEach((r, i) => {
      if (i > 0 && i % 2 === 1) rect(s, x - 0.12, y + i * rh, cw.reduce((a, b) => a + b, 0) + 0.12, rh, C.panel, { round: false });
      r.forEach((c, j) => T(s, String(c), { x: x + cw.slice(0, j).reduce((a, b) => a + b, 0), y: y + i * rh, w: cw[j] - 0.12, h: rh, fontSize: i === 0 ? F.labelS : 14, color: i === 0 ? C.rose : j === 0 ? C.blush : C.cream, bold: i === 0 || j === 0, charSpacing: i === 0 ? 2 : 0, valign: 'middle' }));
    });
  };
  const APPX = [['x_backlog', 'Backlog and release plan'], ['x_tests', 'Test plan and results'], ['x_defects', 'Defect log'], ['x_trace', 'Traceability'], ['x_flow', 'Core flow and deletion logic'], ['x_roles', 'Team roles'], ['x_video', 'Backup demo video'], ['p_hub', 'Feature tour']];
  add('appx', async (s) => {
    kicker(s, 'Appendix · for questions');
    section(s, 'Open a room.');
    APPX.forEach(([id, t], i) => { const x = 0.6 + (i % 4) * 3.07, y = 1.8 + Math.floor(i / 4) * 2.2; rect(s, x, y, 2.85, 1.8, C.panel, { r: 0.12, lc: C.line, shadow: true }); T(s, t, { x: x + 0.25, y: y + 0.5, w: 2.35, h: 0.9, fontFace: HF, fontSize: F.sub }); link(s, x, y, 2.85, 1.8, id, t); });
    back(s, 'room1'); footer(s);
    notes(s, 'Backup for the Q&A.');
  }, { t: 'fade' });
  const ax = (id, name, fn) => add(id, async (s) => { kicker(s, 'Appendix'); section(s, name); await fn(s); back(s, 'appx', 'Back to the appendix'); footer(s); notes(s, name); }, { t: 'fade' });
  ax('x_backlog', 'Backlog and release plan', async (s) => table(s, [['SPRINT', 'DATES', 'GOAL', 'STORIES'], ['S1 ✓', 'Oct 11 – 24', 'A working closet', 'US-01, 02, 03, 04, 06, 08, 09, 11, 12, 71, 15, 16, 56, 46, 64 (15 · 48 pts)'],
    ['S2', 'Oct 25 – Nov 7', 'Outfits that explain themselves', 'US-05, 13, 17, 19, 20, 21, 57, 23, 24, 26, 37, 42, 43, 66, 51, 59, 60, 61, 84 – 87, 79, 90, 91, 93'],
    ['S3', 'Nov 8 – 21', 'AI chat, learning, planning, analytics, admin', 'US-27, 31, 76, 32, 33, 34, 36, 65, 62, 38, 39, 40, 47, 48, 52, 69, 54, 80, 88, 89, 92'], ['Release', 'Nov 22 – Dec 1', 'Integration, testing, demo', 'Language-model adapter on; end-to-end tests of every Must criterion']], 0.75, 1.75, [1.1, 1.75, 3.3, 5.9], { rh: 0.9 }));
  ax('x_tests', 'Test plan and results (26 Oct 2026)', async (s) => table(s, [['LEVEL', 'WHAT', 'HOW', 'RESULT'], ['Unit', 'validators, security, gaps, state machine, engine, deletion policy, try-on placement', 'node:test + Jest shim · EP / BVA / ST', '89 S1 + previews'],
    ['API', 'every route through the real pipeline, PostgreSQL test DB', 'auth, ownership, 4xx', '65 S1 + previews'], ['Acceptance', 'one per Sprint 1 story', 'from the acceptance criteria', '15 / 15'],
    ['Browser (E2E)', `the live-demo route, ${N.e2e} steps, state read back from the API`, 'Playwright · 3 fresh-seed runs, identical', `${N.e2e} steps · 0 errors`], ['Coverage', 'server/src', 'V8', `lines ${N.lines} · branches ${N.branches} · functions ${N.funcs}`], ['Total', '', '', `${N.tests} / ${N.tests} · 0 failed · 0 skipped`]], 0.75, 1.75, [1.7, 4.2, 2.9, 3.3], { rh: 0.68 }));
  ax('x_defects', 'Defect log', async (s) => table(s, [['ID', 'FOUND BY', 'SEVERITY', 'WHAT', 'STATUS'], ['D-01', 'unit (EP)', 'Low', 'Email with spaces rejected instead of trimmed', 'Fixed'], ['D-02', 'API (BVA)', 'Medium', 'A photo of exactly 10 MB was refused', 'Fixed'],
    ['D-03', 'browser journey', 'Medium', 'CSP blocked the photo preview before saving', 'Fixed'], ['D-04', 'browser journey', 'High', 'Rate limit counted photo downloads → 429 for everything', 'Fixed'], ['D-05', 'API (preview)', 'Medium', 'Ask Closet changed the bag instead of the shoes', 'Fixed'],
    ['D-06', 'demo rehearsal', 'High', 'Style this piece left out a warm piece at 30 °C', 'Fixed'], ['D-07', '3 fresh-seed runs', 'Medium', 'Replace-tray order changed between reseeds (random ids broke ties)', 'Fixed']], 0.75, 1.75, [0.95, 2.1, 1.4, 6.3, 1.2], { rh: 0.58 }));
  ax('x_trace', 'Follow one garment: US-08', async (s) => table(s, [['STORY', 'SCREEN', 'API', 'SERVICE', 'DATABASE', 'TESTS', 'DEMO'], ['US-08 add a piece by photo', 'Add piece', 'POST /api/v1/items', 'WardrobeService.add + PhotoStorage', 'wardrobe.items', 'AT-05 · API-W01 – W08 · UT-P01 – P08', 'Act 2']], 0.75, 1.85, [2.0, 1.3, 1.8, 2.3, 1.5, 2.3, 0.8], { rh: 1.1 }));
  ax('x_flow', 'Core flow and deletion logic', async (s) => { const d1 = await dims(`${DIAG}/D12_core_flow.png`); for (const [f, x] of [['D12_core_flow', 0.6], ['D13_deletion_logic', 6.75]]) { rect(s, x - 0.06, 1.69, 6.12, 6.0 * d1.height / d1.width + 0.12, 'FDFBF8', { r: 0.05 }); s.addImage({ path: `${DIAG}/${f}.png`, x, y: 1.75, w: 6.0, h: 6.0 * d1.height / d1.width }); } });
  ax('x_roles', 'Who did what', async (s) => table(s, [['MEMBER', 'OWNS', 'ANSWERS QUESTIONS ON'], ['Habiba', 'requirements, Scrum, documents', 'backlog, Jira, acceptance criteria, SRS / SDD, retrospective'], ['Salma', 'frontend, demo', 'every screen, the core flow, try-on, the demo'],
    ['Bashar', 'profile, planner, gaps, design, engine', 'use cases, class / sequence / state, engine and learning rules'], ['Karim', 'backend, database', 'API, security, database, shopping list'], ['Youssef', 'testing, CI, deployment', 'component diagram, tests, coverage, CI, defects']], 0.75, 1.75, [1.6, 4.3, 6.2], { rh: 0.72 }));

  // the recorded demo, embedded in the deck (plays inside PowerPoint; no external file needed)
  add('x_video', async (s) => {
    s.background = { color: C.ink };
    const poster = 'data:image/jpeg;base64,' + fs.readFileSync('img/video_poster.jpg').toString('base64');
    s.addMedia({ type: 'video', path: 'media/Closet_Demo_FINAL.mp4', x: (W - 11.0) / 2, y: 0.4, w: 11.0, h: 11.0 * 9 / 16, cover: poster });
    if (!LIN) { pill(s, '◂  Back to the talk', 0.45, BTN.y, 2.9, BTN.h, C.bg, C.blush, { lc: C.line, hyperlink: { slide: num('p_return'), tooltip: 'Back to the talk' } }); pill(s, 'Appendix', W - 1.25 - 2.0, BTN.y, 2.0, BTN.h, C.bg, C.grey2, { lc: C.line, hyperlink: { slide: num('appx'), tooltip: 'Appendix' } }); }
    else T(s, 'Backup recording of the live demo (4:36). Click the video to play.', { x: 0.6, y: H - 0.62, w: 9, h: 0.35, fontSize: F.label, color: C.grey2 });
    notes(s, 'BACKUP RECORDING (4:36). Click the video to play it (or press Alt+P). The same 12 steps as the live demo, recorded on the real app from a fresh seed. The try-on uses the stylised avatar (no photo of a person), and the video says so. When it ends: "Back to the talk" → the slide after the demo.');
  }, { t: 'fade' });

  // the feature tour: each tile comes toward the camera and fills the frame; going back reverses it
  const FEATURES = [['looks', '3 LOOKS', '40_recommendations'], ['tryon', 'TRY ON', '42_tryon'], ['mix', 'MIX & MATCH', '44c_mix_fixed'],
    ['forgot', 'FORGOTTEN PIECE', '43_forgotten_three_looks'], ['ask', 'ASK CLOSET + BAG', '52_shopping'], ['learn', 'CLOSET LEARNS', '51b_learned']];
  const tileBox = (i) => ({ x: 0.75 + (i % 3) * 4.0, y: 1.35 + Math.floor(i / 3) * 2.75, w: 3.75, h: 2.34 });
  const tiles = (note) => async (s) => {
    kicker(s, '02 · Product · feature tour');
    sub(s, 'Click a feature to step into it.', { x: 0.6, y: 0.78, w: 8, h: 0.45, italic: true });
    for (let i = 0; i < FEATURES.length; i++) {
      const [k, t, f] = FEATURES[i]; const b = tileBox(i);
      await shot(s, f, b.x, b.y, b.w, b.h, { name: '!!tile-' + k });
      pill(s, t, b.x + 0.12, b.y + b.h - 0.5, Math.min(b.w - 0.24, 0.7 + t.length * 0.12), 0.38, C.bg, C.cream, { fontSize: F.labelS, tr: 10 });
      link(s, b.x, b.y, b.w, b.h, `pf_${k}`, t);
    }
    back(s, 'p_bridge', 'Back to the talk'); footer(s);
    notes(s, note);
  };
  add('p_hub', tiles('SALMA (backup if the live demo could not run). Each tile grows into its feature; each feature returns here.'), { t: 'fade', io: true });
  const TOUR = {
    looks: [['40_recommendations', 'Three looks', ['Choose the occasion; Closet reads the available pieces and the weather.', 'Three complete looks: a name, the pieces, match %, weather, one reason.']],
      ['41a_replace_tray', 'Change one piece', ['Click a garment: real alternatives from your own closet, each with its new match %.', 'Only that piece changes; the rest stays.']]],
    tryon: [['42a_tryon_choose_photo', 'Try it on — on you', ['Choose a full-body photo of yourself.', 'It stays in this browser tab: never uploaded, removable any time.']],
      ['42_tryon', 'The look on your photo', ['The pieces you chose — including the changed one — on your photo.', 'Honest scope: a simulated overlay, not a generative model.']]],
    mix: [['44b_mix_weak', 'Mix & Match', ['Lay pieces on the styling table: one live match %.', 'A red tee for Work — the score drops to 82 %.']], ['44c_mix_fixed', 'Suggest a fix', ['Closet replaces the weak piece and says what it changed.', '82 % → 98 %.']]],
    forgot: [['43a_forgotten', 'Forgotten pieces', ['Worn before, but not in the last 40 days.', '“Another chance”: Closet styles that exact piece.']], ['43_forgotten_three_looks', 'Three ways to wear it', ['Three looks, every one with the denim jacket.']]],
    ask: [['47_delete_reason', 'Why a piece leaves', ['Torn / damaged → a replacement in the bag.', 'No longer my style → no replacement; Closet learns.']], ['50_ask', 'Ask Closet', ['“Do I need beige trousers?” — you own 4 similar.', '“Add this to my shopping list” — Undo.']]],
    learn: [['51b_learned', 'Closet has learned', ['Cards start closed. Flip: evidence, confidence, Confirm / Not accurate.', 'Nothing changes until you confirm; Undo restores it.']]],
  };
  for (const [k, , f] of FEATURES) {
    add(`pf_${k}`, async (s) => { await cover(s, f, '!!tile-' + k); notes(s, 'The tile comes toward the camera and fills the frame.'); }, { adv: 150, io: true, num: false });
    TOUR[k].forEach(([img, name, lines], j) => add(`pf_${k}_${j}`, async (s) => {
      kicker(s, `02 · Product · ${name}`);
      await shot(s, img, 0.6, 0.95, 8.4, 5.25, { name: j === 0 ? '!!tile-' + k : undefined });
      section(s, name, { x: 9.35, y: 0.95, w: 3.5, h: 1.3, fontSize: F.section });
      T(s, lines.map((t) => ({ text: t, options: { breakLine: true } })), { x: 9.35, y: 2.4, w: 3.45, h: 3.6, fontSize: F.bodyS, color: C.grey2, paraSpaceAfter: 10 });
      back(s, `pr_${k}`, 'Back to the features'); footer(s);
      notes(s, `SALMA. ${name}.`);
    }, { t: j === 0 ? 'morph' : 'fade', io: true }));
    add(`pr_${k}`, async (s) => { await cover(s, f, '!!tile-' + k); notes(s, 'Back: the feature fills the frame, then returns to its tile.'); }, { adv: 100, io: true, num: false });
    add(`p_hub_${k}`, tiles('The feature tour. Click another feature, or "Back to the talk".'), { io: true });
  }

  // ---------- build ----------
  for (cur = 0; cur < SL.length; cur++) { const s = slide(SL[cur].master); await SL[cur].fn(s); }
  fs.writeFileSync(OUT.replace('.pptx', '.json'), JSON.stringify(SL.map((s) => ({ id: s.id, t: s.t, adv: LIN ? null : s.adv ?? null }))));
  await pres.writeFile({ fileName: OUT });
  console.log(MODE, SL.length, 'slides →', OUT);
})();
