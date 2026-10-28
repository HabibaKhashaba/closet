# Milestone 2 final pass: edits the existing interactive deck in place (same art, fonts, Morph names, notes).
import os, re, shutil, subprocess, sys, json, html
from PIL import Image
D = '/tmp/claude-0/deck'; W = f'{D}/w'
SK = '/root/.claude/skills/synced/e542fcf5-4699-4ace-a38f-449c86c90763_6a20e36a-2515-4c7a-a85a-ebb218fdbb0a/pptx'
DIAG = '/home/claude/src2/closet/docs/milestone2/diagrams'
SHOTS = '/tmp/claude-0/shots2x'; PRO = '/tmp/claude-0/pro'
shutil.rmtree(W, ignore_errors=True); shutil.copytree(f'{D}/u', W)
ORIG = open(f'{D}/order.txt').read().split()          # original slide number → file
S = lambda n: f'{W}/ppt/slides/{ORIG[n-1]}'
def rd(p): return open(p, encoding='utf8').read()
def wr(p, t): open(p, 'w', encoding='utf8').write(t)
esc = lambda s: html.escape(s, quote=False)
LOG = []

# ---------- 1 · media: fresh v1.5 screenshots, hand-off picture, demo video + poster ----------
media = f'{W}/ppt/media/'
MAP = {}
for f in os.listdir(f'{W}/ppt/slides'):
    if not f.endswith('.xml'): continue
    x = rd(f'{W}/ppt/slides/{f}'); r = rd(f'{W}/ppt/slides/_rels/{f}.rels')
    rm = dict(re.findall(r'Id="(rId\d+)"[^>]*Target="\.\./media/([^"]+)"', r))
    for d, rid in re.findall(r'descr="([^"]+)"[^>]*>.*?<a:blip r:embed="(rId\d+)"', x, re.S):
        if rid in rm: MAP.setdefault(d, set()).add(rm[rid])
for d, files in MAP.items():
    m = re.match(r'img/(.+)\.jpg$', d)
    if not m: continue
    src = f'{SHOTS}/{m.group(1)}.png' if m.group(1) != 'handoff_home' else f'{SHOTS}/handoff_home.jpg'
    if not os.path.exists(src): LOG.append(f'kept old screenshot {d} (no new capture)'); continue
    for f in files:
        old = Image.open(media + f); new = Image.open(src).convert('RGB')
        if abs(old.width / old.height - new.width / new.height) > 0.01: LOG.append(f'kept {d}: aspect differs'); continue
        new.resize(old.size, Image.LANCZOS).save(media + f, quality=90)
    LOG.append(f'screenshot {d} → build v1.5')
shutil.copy('/tmp/claude-0/out/Closet_Demo_FINAL.mp4', media + 'media-97-1.mp4')
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', '1.5', '-i', media + 'media-97-1.mp4', '-frames:v', '1', '/tmp/claude-0/poster.png'], check=True)
p0 = Image.open(media + 'image-97-3.png'); Image.open('/tmp/claude-0/poster.png').convert('RGB').resize(p0.size).save(media + 'image-97-3.png')
LOG.append('embedded video replaced: v1.5 recording, 3:43, 1920×1080')

# ---------- 2 · structure: new slides (duplicates of the plain diagram slide 46, then rewritten) ----------
def add_after(after_file):
    out = subprocess.run([sys.executable, f'{SK}/scripts/add_slide.py', W, ORIG[46-1], '--after', after_file], capture_output=True, text=True, cwd=f'{SK}/scripts')
    m = re.search(r'(slide\d+\.xml)', out.stdout + out.stderr.split('from')[0] if 'Created' in out.stdout else out.stdout)
    m = re.search(r'Created ppt/slides/(slide\d+\.xml)', out.stdout)
    assert m, out.stdout + out.stderr
    return m.group(1)
NEW = {}
def new(key, after): NEW[key] = add_after(after); return NEW[key]
new('D19', ORIG[18-1]); new('PRO', ORIG[25-1]); new('D18', ORIG[39-1]); new('D20', ORIG[45-1])
new('D21', ORIG[48-1]); new('D22', ORIG[50-1]); new('D23', NEW['D22']); new('DEF2', ORIG[93-1]); new('APX', ORIG[96-1])

def rels_add(slide, typ, target):
    p = f'{W}/ppt/slides/_rels/{slide}.rels'; r = rd(p)
    n = max(int(i) for i in re.findall(r'Id="rId(\d+)"', r)) + 1
    t = {'img': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image', 'slide': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide'}[typ]
    wr(p, r.replace('</Relationships>', f'<Relationship Id="rId{n}" Type="{t}" Target="{target}"/></Relationships>'))
    return f'rId{n}'
def add_media(path, name):
    shutil.copy(path, media + name); ct = rd(f'{W}/[Content_Types].xml'); ext = name.rsplit('.', 1)[1]
    if f'Extension="{ext}"' not in ct: wr(f'{W}/[Content_Types].xml', ct.replace('<Default ', f'<Default Extension="{ext}" ContentType="image/{"jpeg" if ext == "jpg" else ext}"/><Default ', 1))
    return '../media/' + name

def diagram_slide(key, png, kicker, caption, back_to, back_label, morph_name):
    f = NEW[key]; p = f'{W}/ppt/slides/{f}'; x = rd(p)
    rel = add_media(f'{DIAG}/{png}', f'image-v15-{key}.png')
    r = rd(f'{W}/ppt/slides/_rels/{f}.rels')
    r = re.sub(r'(Id="rId1" Type="[^"]+/image" Target=")[^"]+"', lambda m: m.group(1) + rel + '"', r)
    r = re.sub(r'(Id="rId2" Type="[^"]+/slide" Target=")[^"]+"', lambda m: m.group(1) + back_to + '"', r)
    wr(f'{W}/ppt/slides/_rels/{f}.rels', r)
    x = x.replace('<a:t>03 · CLASSES</a:t>', f'<a:t>{esc(kicker)}</a:t>').replace('name="!!D6_class_diagram" descr="/home/claude/m2/d13/D6_class_diagram.png"', f'name="{morph_name}" descr="{png}"')
    x = x.replace('◂  Back to the designs', esc(back_label))
    cap = tb(20, 'Caption', 3.3, 6.78, 7.8, 0.44, [[(caption, 1200, 'B9AEA6', False, 'Inter')]], anchor='ctr')
    x = x.replace('</p:spTree>', cap + '</p:spTree>')
    wr(p, x)

EMU = 914400
def E(v): return int(round(v * EMU))
def run(t, sz, col, b=False, font='Inter', i=False, spc=None):
    fam = f'<a:latin typeface="{font}"/><a:ea typeface="{font}"/><a:cs typeface="{font}"/>'
    return (f'<a:r><a:rPr lang="en-US" sz="{sz}"{" b=\"1\"" if b else ""}{" i=\"1\"" if i else ""}{f" spc=\"{spc}\"" if spc else ""} dirty="0">'
            f'<a:solidFill><a:srgbClr val="{col}"/></a:solidFill>{fam}</a:rPr><a:t>{esc(t)}</a:t></a:r>')
def tb(id, name, x, y, w, h, paras, anchor='t', algn='l', fill=None, line=None, geom='rect', link=None, lsp=None):
    ps = ''
    for para in paras:
        rs = ''.join(run(*r) for r in para)
        ls = f'<a:lnSpc><a:spcPct val="{lsp}"/></a:lnSpc>' if lsp else ''
        ps += f'<a:p><a:pPr algn="{algn}" indent="0" marL="0">{ls}<a:buNone/></a:pPr>{rs}</a:p>'
    fl = f'<a:solidFill><a:srgbClr val="{fill}"/></a:solidFill>' if fill else '<a:noFill/>'
    ln = f'<a:ln w="9525"><a:solidFill><a:srgbClr val="{line}"/></a:solidFill></a:ln>' if line else '<a:ln><a:noFill/></a:ln>'
    av = '<a:avLst><a:gd name="adj" fmla="val 8000"/></a:avLst>' if geom == 'roundRect' else '<a:avLst/>'
    hl = f'<a:hlinkClick r:id="{link}" action="ppaction://hlinksldjump"/>' if link else ''
    return (f'<p:sp><p:nvSpPr><p:cNvPr id="{id}" name="{name}">{hl}</p:cNvPr><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="{E(x)}" y="{E(y)}"/><a:ext cx="{E(w)}" cy="{E(h)}"/></a:xfrm>'
            f'<a:prstGeom prst="{geom}">{av}</a:prstGeom>{fl}{ln}</p:spPr><p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" rtlCol="0" anchor="{anchor}"><a:normAutofit/></a:bodyPr><a:lstStyle/>{ps}</p:txBody></p:sp>')
def box(id, name, x, y, w, h, fill, line=None, adj=6000, shadow=False):
    ln = f'<a:ln w="9525"><a:solidFill><a:srgbClr val="{line}"/></a:solidFill></a:ln>' if line else '<a:ln><a:noFill/></a:ln>'
    sh = '<a:effectLst><a:outerShdw blurRad="177800" dist="63500" dir="5400000" algn="t" rotWithShape="0"><a:srgbClr val="000000"><a:alpha val="40000"/></a:srgbClr></a:outerShdw></a:effectLst>' if shadow else ''
    return (f'<p:sp><p:nvSpPr><p:cNvPr id="{id}" name="{name}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="{E(x)}" y="{E(y)}"/><a:ext cx="{E(w)}" cy="{E(h)}"/></a:xfrm>'
            f'<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val {adj}"/></a:avLst></a:prstGeom><a:solidFill><a:srgbClr val="{fill}"/></a:solidFill>{ln}{sh}</p:spPr></p:sp>')
def pic(id, name, x, y, w, h, rid, descr):
    return (f'<p:pic><p:nvPicPr><p:cNvPr id="{id}" name="{name}" descr="{esc(descr)}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>'
            f'<p:blipFill><a:blip r:embed="{rid}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="{E(x)}" y="{E(y)}"/><a:ext cx="{E(w)}" cy="{E(h)}"/></a:xfrm><a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val 4000"/></a:avLst></a:prstGeom></p:spPr></p:pic>')
def kicker(t): return tb(2, 'Kicker', 0.6, 0.42, 11.5, 0.3, [[(t, 1200, 'C48A86', True, 'Inter', False, 200)]])
def title(t, y=0.78, sz=4000): return tb(3, 'Title', 0.6, y, 12.0, 0.75, [[(t, sz, 'F6EFE9', False, 'Lora')]])
def pageno(): return tb(99, 'PageNo', 12.28, 6.98, 0.6, 0.3, [[('0', 1200, '8F857C')]], algn='r')
def backbtn(rid, label): return tb(98, 'Back', 0.45, 6.78, 2.9, 0.44, [[(label, 1300, 'E9C9C4', True)]], anchor='ctr', algn='ctr', fill='0E0B0C', line='3A3031', geom='roundRect', link=rid)
def page(f, body):
    p = f'{W}/ppt/slides/{f}'; x = rd(p)
    x = re.sub(r'<p:spTree>.*</p:spTree>', lambda m: '<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>' + body + '</p:spTree>', x, flags=re.S)
    wr(p, x)

diagram_slide('D19', 'D19_use_cases_proactive.png', '01 · SPRINT · UML USE CASES · PROACTIVE (NEW IN BUILD V1.5)', 'UC-23 – UC-30 added for the proactive features; the overview (User, Admin, services) is unchanged.', ORIG[15-1], '◂  Back to the use cases', '!!D19_use_cases')
diagram_slide('D18', 'D18_component_v15.png', '03 · UML COMPONENT DIAGRAM V1.5 · WHAT CHANGED', 'New: Proactive service · Wardrobe Insights (pure rules) · repositories · offline demo host — all behind the same security pipeline.', ORIG[37-1], '◂  Back to the diagram', '!!D18_component')
diagram_slide('D20', 'D20_er_v15.png', '03 · ER · V1.5 ADDITIONS (MIGRATION 006)', 'price · rehoming · snoozes · outfit memory (event, note) · planned weather — applied on PostgreSQL 16.', ORIG[41-1], '◂  Back to the ER', '!!D20_er')
diagram_slide('D21', 'D21_state_v15.png', '03 · STATE · STATUS MACHINE + THE REHOMING INTENTION', 'Rehoming is not a sixth status: it coexists with a status and ends in a delete with a reason (Donated · Given away · Sold).', ORIG[40-1], '◂  Back to the designs', '!!D21_state')
diagram_slide('D22', 'D22_sequence_donate.png', '03 · SEQUENCE · STILL LOVE IT? → DONATE', 'Style it · Keep it · Donate · Not now. A donated piece leaves with its history kept — and no replacement is suggested.', ORIG[40-1], '◂  Back to the designs', '!!D22_seq')
diagram_slide('D23', 'D23_sequence_monitor.png', '03 · SEQUENCE · PLANNED-OUTFIT MONITOR → ADJUST', 'Forecast vs the weather saved with the plan (≥ 5 °C or rain) and current status → Adjust outfit changes only the affected piece.', ORIG[40-1], '◂  Back to the designs', '!!D23_seq')

# ---------- 3 · the proactive scene ----------
f = NEW['PRO']; cards = [
 ('01 · WEATHER CHANGED', '24 °C → 30 °C', 'c1_weather.jpg', 'The forecast moved since you planned tomorrow’s look. The navy blazer may be too warm.', 'Adjust outfit → only the blazer changes'),
 ('02 · LAUNDRY RISK', 'Before the presentation', 'c2_laundry.jpg', '2 of your 3 most-worn casual tops are in the laundry — and you have an event tomorrow.', 'Open laundry · plan around it'),
 ('03 · TRIP PACKING', 'Paris · 5 days · carry-on', 'c3_trip.jpg', '5 clothing pieces, 2 pairs of shoes, 1 accessory → 10 possible outfits. Fits the carry-on.', 'Remove a piece → it re-plans'),
 ('04 · STILL LOVE IT?', 'Denim jacket · 104 days', 'c4_donate.jpg', 'Unworn for 104 days, in season. No judgement — style it, keep it, or pass it on.', 'Style it · Keep it · Donate'),
]
body = kicker('02 · PRODUCT · SPRINT 3 PREVIEW — BUILT EARLY IN V1.5') + title('Closet is becoming proactive.')
body += tb(4, 'Sub', 0.6, 1.6, 12.0, 0.4, [[('It tells you before something becomes a problem — every notice has a reason and one action.', 1700, 'B9AEA6')]])
for i, (k, h, img, t, a) in enumerate(cards):
    x = 0.6 + i * 3.08; rid = rels_add(f, 'img', add_media(f'{PRO}/{img}', f'image-v15-pro{i}.jpg'))
    body += box(10 + i * 10, f'!!pcard{i}', x, 2.2, 2.92, 4.25, '1C1617', '3A3031', 5000, True)
    body += tb(11 + i * 10, f'PK{i}', x + 0.2, 2.38, 2.6, 0.25, [[(k, 1100, 'C48A86', True, 'Inter', False, 150)]])
    body += tb(12 + i * 10, f'PH{i}', x + 0.2, 2.66, 2.6, 0.4, [[(h, 1700, 'F6EFE9', False, 'Lora')]])
    body += pic(13 + i * 10, f'!!pimg{i}', x + 0.2, 3.12, 2.52, 1.6, rid, f'Real app screenshot: {k}')
    body += tb(14 + i * 10, f'PT{i}', x + 0.2, 4.86, 2.55, 0.95, [[(t, 1250, 'B9AEA6')]], lsp=105000)
    body += tb(15 + i * 10, f'PA{i}', x + 0.2, 5.9, 2.55, 0.36, [[('→ ' + a, 1200, 'E7C792', True)]], anchor='ctr')
body += tb(60, 'Foot', 0.6, 6.62, 11.4, 0.5, [[('Real screens from build v1.5 · one shared rule layer (Wardrobe Insights) · 22 proactive API tests + 38 rule tests · stories US-94 – US-111 are proposed, not yet in Jira.', 1150, '8F857C')]])
body += pageno(); page(f, body)

# ---------- 4 · appendix: proactive features and the final-pass defect log ----------
def grid(f, kick, ttl, head, rows, cols, back_rid, rowh=0.34, sz=1150, y0=1.62):
    body = kicker(kick) + title(ttl, 0.72, 3400); y = y0; i = 100
    for j, (hd, (cx, cw)) in enumerate(zip(head, cols)):
        body += tb(i, f'H{j}', cx, y, cw, 0.3, [[(hd, 1050, 'C48A86', True, 'Inter', False, 150)]]); i += 1
    y += 0.36
    for r in rows:
        body += box(i, 'row', 0.5, y - 0.03, 12.33, rowh - 0.04, '161112'); i += 1
        for j, (c, (cx, cw)) in enumerate(zip(r, cols)):
            body += tb(i, f'C{j}', cx, y, cw, rowh - 0.06, [[(c, sz, 'F6EFE9' if j == 0 else 'B9AEA6', j == 0)]], anchor='ctr'); i += 1
        y += rowh
    body += backbtn(back_rid, '◂  Back to the appendix') + pageno(); page(f, body)
sys.path.insert(0, '/home/claude/src2/closet/docs/milestone2/rev4')
f = NEW['APX']; rid = rels_add(f, 'slide', ORIG[90-1])
grid(f, 'APPENDIX · PROACTIVE WARDROBE INTELLIGENCE (BUILD V1.5)', 'What “proactive” means, feature by feature', ['FEATURE', 'WHERE IN THE APP', 'REQUIREMENT', 'EVIDENCE (TEST IDS)'], [
 ['Still love it? · style · keep · donate', 'Home · Analytics', 'FR-81 · FR-82', 'IN-01 – IN-08 · API-PR01 · E2E s06 – s07'],
 ['Donate / give / sell (rehoming)', 'Piece screen', 'FR-83', 'API-PR02 · API-PR03 · API-PR92 · E2E s08 – s09'],
 ['Seasonal rotation (suggest, never automatic)', 'Analytics', 'FR-84', 'IN-10 – IN-12 · API-PR10'],
 ['Laundry risk · laundry-aware multi-day plan', 'Home · Ask Closet', 'FR-85 · FR-86', 'IN-20 – IN-23 · API-PR20 · API-PR21'],
 ['Repeat intelligence · outfit memory', 'Outfit card · Ask Closet', 'FR-87 · FR-88', 'IN-30 – IN-34 · API-PR60 · API-PR62'],
 ['Planned-outfit monitor (weather + status)', 'Planner · Home', 'FR-89', 'IN-40 – IN-42 · API-PR30 – PR32 · E2E s14'],
 ['Borrow tracker', 'Piece · Ask Closet', 'FR-90', 'API-PR40'],
 ['Explainable Wardrobe Health', 'Analytics', 'FR-91', 'WH-01 – WH-05 · IN-80'],
 ['Duplicate check when adding', 'Add a piece', 'FR-92', 'DU-01 – DU-02 · API-PR70'],
 ['Gap confidence · purchase impact', 'Shopping bag', 'FR-93 · FR-94', 'IN-60 – IN-63 · API-PR71 · API-PR72'],
 ['Trip capsule (carry-on limits)', 'Packing · Ask Closet', 'FR-95', 'IN-70 – IN-73 · API-PR80'],
 ['Event rescue · cost per wear', 'Ask Closet · Piece', 'FR-96 · FR-97', 'API-PR93 · IN-50 – IN-52 · API-PR50'],
 ['One Notification Center (type · level · dedupe)', 'Bell', 'FR-98', 'API-PR31 · API-PR40 · E2E s01'],
 ['Ask Closet · 31 functions, questions never change state', 'Ask Closet', 'FR-99', 'AI-40 – AI-47 · API-PR90 – PR93 · E2E s10'],
], [(0.62, 4.3), (5.0, 2.3), (7.4, 1.6), (9.05, 3.75)], rid, rowh=0.335, sz=1100, y0=1.5)

defs = [l.strip('|').split('|') for l in open('/home/claude/src2/closet/docs/milestone2/evidence/defects.md').read().splitlines()[2:] if l.startswith('| D-')]
short = {'D-08': 'Saved-look toast offered an Undo that did nothing', 'D-09': '“Is my blazer clean?” changed the blazer’s status', 'D-10': 'Save + Favourite created two saved records',
         'D-11': 'The three looks shared 2–3 major garments', 'D-12': 'The web app had its own copy of the status rules', 'D-13': 'The offline demo replayed recorded answers',
         'D-14': 'Weather alert stayed after “Adjust outfit”', 'D-15': 'Purchase check ignored pieces in the laundry', 'D-16': '“rose” was not understood as a colour', 'D-17': 'An overdue piece produced two notices'}
FOUND = {'D-08': 'Code review (honesty audit)', 'D-09': 'Ask Closet intent tests (EP)', 'D-10': 'Stateful E2E journey', 'D-11': 'Diversity tests (BVA)', 'D-12': 'Code review', 'D-13': 'Honesty audit · offline demo', 'D-14': 'Browser journey', 'D-15': 'API tests (BVA)', 'D-16': 'Ask Closet intent tests', 'D-17': 'API tests'}
f = NEW['DEF2']; rid = rels_add(f, 'slide', ORIG[90-1])
grid(f, 'APPENDIX · DEFECT LOG (FINAL PASS)', 'Defect log · D-08 – D-17', ['ID', 'FOUND BY', 'SEVERITY', 'WHAT', 'STATUS'],
     [[d[0].strip(), FOUND.get(d[0].strip(), d[1].strip()), d[2].strip(), short[d[0].strip()], ('Fixed · removed' if d[0].strip() == 'D-08' else 'Fixed · regression test')] for d in defs if d[0].strip() in short],
     [(0.62, 0.8), (1.5, 3.1), (4.7, 1.0), (5.8, 5.0), (10.9, 1.9)], rid, rowh=0.42, sz=1150)

# ---------- 5 · text: real final numbers, honest labels ----------
def rep(n, old, new, all_=False, notes=False):
    p = S(n) if not notes else notes_of(n); x = rd(p); o, nw = esc(old), esc(new)
    if o not in x: raise SystemExit(f'slide {n}: not found {old!r}')
    x = x.replace(o, nw) if all_ else x.replace(o, nw, 1); wr(p, x)
def notes_of(n):
    r = rd(f'{W}/ppt/slides/_rels/{ORIG[n-1]}.rels'); return f'{W}/ppt/notesSlides/' + re.search(r'notesSlides/(notesSlide\d+\.xml)', r).group(1)
def set_notes(n, text):
    p = notes_of(n); x = rd(p)
    paras = ''.join(f'<a:p><a:r><a:rPr lang="en-US" dirty="0"/><a:t>{esc(t)}</a:t></a:r></a:p>' for t in text.split('\n'))
    m = re.search(r'(<p:sp>(?:(?!</p:sp>).)*?type="body".*?<p:txBody>.*?<a:lstStyle/>)(.*?)(</p:txBody>)', x, re.S)
    assert m, p; x = x[:m.start(2)] + paras + x[m.end(2):]; wr(p, x)

rep(9, '169 / 169', '497 / 497'); rep(9, 'Sprint 1 tests pass', 'tests pass · final run')
rep(13, '14 whitelisted functions', '31 whitelisted functions')
for n in (56, 57, 58, 59): rep(n, '04 · QUALITY · SPRINT 1', '04 · QUALITY · FINAL RUN (BUILD V1.5)')
for n, old, new in [(56, '>89<', '>317<'), (57, '>65<', '>180<')]:
    p = S(n); x = rd(p); assert old in x; wr(p, x.replace(old, new, 1))
rep(56, 'Validators, passwords, photo checks, closet gaps, the status machine.', 'Validators, the status machine, the engine, diversity, wardrobe insights, 56 Ask Closet phrasings.')
rep(57, 'Every endpoint through the real security pipeline and a PostgreSQL test database.', 'Every endpoint — old and new — through the real security pipeline on PostgreSQL 16.')
rep(58, 'all 25 status pairs.', 'all 25 status pairs, 89 / 90 days unworn, 28 / 30 °C forecast.')
for n in (60, 61): rep(n, '349 / 349', '497 / 497')
for a, b in [('169 / 169', '317 + 180'), ('Sprint 1 tests', 'unit + API tests'), ('97.95 %', '97.24 %'), ('84.57 %', '83.42 %'), ('94.72 %', '91.09 %'),
             ('58 steps × 3', '58 + 15 + 15'), ('browser journey · fresh seed · identical', 'browser steps · live app + offline demo')]: rep(61, a, b)
for n in range(62, 68):
    p = S(n); x = rd(p); wr(p, x.replace('349 / 349 · D-06 closed', '497 / 497 · D-06 closed'))
rep(67, 'all seven defects are in the appendix.', 'all 17 defects are in the appendix.')
rep(68, 'CI runs unit, API, acceptance and coverage on every pull request; the browser-journey job is configured and runs from the next push. Render deployment: blueprint written — the local run is the verified demo path.',
    'CI is configured — server tests + coverage, client build, browser journeys, offline demo — and its first run on GitHub is pending; every result in this talk is from our local runs. Render blueprint configured; the local demo is the verified presentation path.')
for a, b in [('SRS v1.1', 'SRS v1.2'), ('SDD v1.1', 'SDD v1.2'), ('A real SDD page: component diagram v1.4 (Figure 3-1)', 'A real SDD page: component diagram (revision 4 adds D18 – D23)'),
             ('user stories', 'user stories (18 proposed)')]: rep(79, a, b)
for old, new in [('>80<', '>101<'), ('>15<', '>18<'), ('>22<', '>30<'), ('>84<', '>102<'), ('>71<', '>86<')]:
    p = S(79); x = rd(p); assert x.count(old) >= 1, old; wr(p, x.replace(old, new, 1))
for a, b in [('Test plan and results (26 Oct 2026)', 'Test plan and results (final run, build v1.5)'), ('89 S1 + previews', '317'), ('65 S1 + previews', '180'),
             ('the live-demo route, 58 steps, state read back from the API', 'demo journey (58 steps) + stateful journey, live app and offline demo'),
             ('Playwright · 3 fresh-seed runs, identical', 'Playwright · Chromium'), ('58 steps · 0 errors', '58 + 15 + 15 · 0 errors'),
             ('lines 97.95 % · branches 84.57 % · functions 94.72 %', 'lines 97.24 % · branches 83.42 % · functions 91.09 %'), ('349 / 349 · 0 failed · 0 skipped', '497 / 497 · 0 failed · 0 skipped')]: rep(92, a, b)
rep(121, '— you own 4 similar.', '— you own 2 similar.')
rep(115, '“Another chance”: Closet styles that exact piece.', '“Another chance”: three looks with that exact piece. After 90 days: Still love it?')

# Jira frames: say plainly that the screenshots are pending (no drawing of Jira, ever)
x = rd(S(12)); x = x.replace('</p:spTree>', tb(90, 'JiraPending', 3.55, 6.8, 5.35, 0.36, [[('SCREENSHOTS PENDING — real Jira captures go in these frames', 1100, 'E7C792', True)]], anchor='ctr', algn='ctr', fill='2A1F1C', line='6B5536', geom='roundRect') + '</p:spTree>'); wr(S(12), x)
# GitHub/CI frame honesty on slide 68 already in text; Sprint 3 slide gets the proactive promise

# ---------- 6 · hub: numbered labels + progress state (✓ = section done) ----------
LAB = {'lab-obj_door': ('SPRINT', '01 · SPRINT', 'S'), 'lab-obj_mirror': ('PRODUCT', '02 · PRODUCT', 'P'), 'lab-obj_panel': ('INSIDE THE SYSTEM', '03 · INSIDE THE SYSTEM', 'I'),
       'lab-obj_dresser': ('QUALITY', '04 · QUALITY', 'Q'), 'lab-obj_oval': ('RETROSPECTIVE', '05 · RETROSPECTIVE', 'R'), 'lab-obj_box': ('DOCUMENTS', '06 · DOCUMENTS', 'D')}
def visited(n): return '' if n < 19 else 'S' if n < 51 else 'SPI' if n < 69 else 'SPIQ' if n < 76 else 'SPIQR' if n < 80 else 'SPIQRD'
hubs = 0
for n in range(1, len(ORIG) + 1):
    p = S(n); x = rd(p)
    if '!!lab-obj_door' not in x: continue
    for nm, (old, num, k) in LAB.items():
        m = re.search(rf'<p:sp>(?:(?!</p:sp>).)*?name="!!{nm}".*?</p:sp>', x, re.S)
        if not m: continue
        s = m.group(0); lab = ('✓ ' + num.split('·', 1)[1]) if k in visited(n) else num
        s2 = s.replace(f'<a:t>{old}</a:t>', f'<a:t>{esc(lab)}</a:t>', 1)
        if k in visited(n): s2 = re.sub(r'(<a:t>[^<]*</a:t>)', r'\1', s2)
        if k == 'D': s2 = s2.replace('<a:t>  SRS · SDD</a:t>', '<a:t>  SRS·SDD</a:t>')
        x = x.replace(s, s2)
    wr(p, x); hubs += 1
LOG.append(f'hub labels numbered 01 – 06 with progress ticks on {hubs} room slides')

# ---------- 7 · notes ----------
NOTE = {
 9: 'HABIBA (0:30). "Sprint goal: a working closet. We committed 15 stories, 48 points, and finished all 15. US-61 moved to Sprint 2 at planning: it hides pieces from recommendations, which only exist in Sprint 2." The 497 / 497 is the whole final run of build v1.5 (evidence/test_run_v15.txt), not only Sprint 1.',
 60: 'YOUSSEF (0:15). Pause on the number. "497 of 497 automated tests pass. Zero failed." Real output: 05_Testing/evidence/test_run_v15.txt. Honest footnote if asked: the final run used small compatibility shims for npm packages because the registry was blocked in our build environment; the official npm test on a team laptop and the first CI run are pending. CLICK.',
 61: 'YOUSSEF (0:30). 317 unit tests and 180 API tests on a real PostgreSQL 16 database; 15 acceptance tests, one per Sprint 1 story. Coverage (V8: lines, branches, functions): 97.24 %, 83.42 %, 91.09 %. Browser: the 58-step demo journey, plus a 15-checkpoint stateful journey that leaves every screen and comes back — once on the live app and once on the offline demo file. "We did not just build it. We proved that it works." CLICK the bug story.',
 67: 'YOUSSEF. PASS: 497 / 497 · D-06 closed. Seventeen defects in total; D-08 – D-17 were found in the final pass (appendix).',
 68: 'YOUSSEF (0:20). Be exact: CI is configured (server, client, e2e, offline-demo jobs) but has not run on GitHub yet. Render: blueprint configured; the local demo is the verified presentation path.',
 79: 'HABIBA (0:30). "The SRS says WHAT the system must do, the SDD says HOW it is designed — each in its IEEE template. Revision 4 adds the proactive features as section 4.21 with tracked IDs: 101 functional and 18 non-functional requirements, 30 use cases, 84 stories plus 18 proposed, 86 logged changes."',
 56: 'YOUSSEF. 317 unit tests: validators, the status machine, the engine, diversity of the three looks, the wardrobe-insight rules and 56 Ask Closet phrasings. CLICK.',
 57: 'YOUSSEF. 180 API tests: every endpoint, including the new proactive ones, through the real security pipeline on PostgreSQL 16. CLICK.',
 58: 'YOUSSEF. Black-box design: equivalence classes, boundaries (password 7 / 8, photo 10 MB / +1 byte, 89 / 90 days unworn, 28 / 30 °C), all 25 status pairs. CLICK.',
 92: 'Test plan and results — final run of build v1.5. Numbers from 05_Testing/evidence (test_run_v15.txt, coverage_v15.txt, e2e logs).',
}
NOTE[97] = 'BACKUP RECORDING (3:43). Click the video to play it (or press Alt+P). The same 14 steps as the live demo (Demo_Preflight.md), recorded on the real app, build v1.5, from a fresh seed. The try-on uses the stylised avatar (no photo of a person), and the video says so. When it ends: "Back to the talk" → the slide after the demo.'
for n, t in NOTE.items(): set_notes(n, t)
x = rd(notes_of(7)); assert 'CLICK the DOOR' in x
cheat = ('PRESENTER CHEAT-SHEET (not shown). Room objects: door = 01 Sprint · big mirror = 02 Product + live demo · wall panel = 03 Inside the system · drawer = 04 Quality · standing mirror = 05 Retrospective · box = 06 Documents. '
         'A tick (✓) on a label = section done. Click anywhere (not on an object) = next section in talk order. Every inside slide has ◂ Back. '
         'If the live app fails: big mirror → Backup recording (embedded, 3:43). New in this version: proactive scene after the demo, v1.5 diagrams after each baseline diagram, appendix: proactive features + defect log D-08 – D-17.')
wr(notes_of(7), x.replace('CLICK the DOOR.', 'CLICK the DOOR. ' + esc(cheat), 1))
def new_notes(key, text):
    src = notes_of(46); f = NEW[key]; num = int(re.search(r'\d+', f).group())
    dst = f'{W}/ppt/notesSlides/notesSlide{num}.xml'; nx = rd(src)
    wr(dst, nx); r46 = rd(src.replace('notesSlides/', 'notesSlides/_rels/') + '.rels')
    wr(dst.replace('notesSlides/', 'notesSlides/_rels/') + '.rels', re.sub(r'slides/slide\d+\.xml', f'slides/{f}', r46))
    ct = rd(f'{W}/[Content_Types].xml')
    wr(f'{W}/[Content_Types].xml', ct.replace('</Types>', f'<Override PartName="/ppt/notesSlides/notesSlide{num}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/></Types>'))
    rp = f'{W}/ppt/slides/_rels/{f}.rels'; r = rd(rp); k = max(int(i) for i in re.findall(r'Id="rId(\d+)"', r)) + 1
    wr(rp, r.replace('</Relationships>', f'<Relationship Id="rId{k}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide{num}.xml"/></Relationships>'))
    ORIG.append(f); set_notes(len(ORIG), text)
new_notes('PRO', 'SALMA (0:45). "Everything you just saw answers a question. The next step is Closet speaking first." Four real screens: the forecast changed since we planned tomorrow — Adjust outfit changes only the blazer. Two of the most-worn tops are in the laundry before an event. A carry-on capsule for Paris. And a jacket nobody wore for 104 days: style it, keep it, or donate it — no judgement. One shared rule layer feeds Home, Planner, Ask Closet and the notification bell. Built early as a Sprint 3 preview; the stories are proposed, not yet in Jira. Then hand over to Karim.')
new_notes('D19', 'BASHAR (0:15). Eight new use cases for the proactive features; the overview with the Admin is unchanged.')
new_notes('D18', 'YOUSSEF (0:20). What changed in v1.5: a Proactive service that only composes existing modules, a pure rule layer (Wardrobe Insights), repositories injected into every module — the same code runs the offline demo — all behind the same security pipeline.')
new_notes('D20', 'BASHAR (0:15). Migration 006: price for cost per wear, a rehoming table, snoozes for Keep / Not now, outfit memory, the weather saved with a plan.')
new_notes('D21', 'BASHAR (0:15). Design decision: Ready to donate is an intention, not a sixth status — the tested state machine did not change.')
new_notes('D22', 'BASHAR. Still love it? → Donate → Confirm it has left → deleted with reason Donated, no replacement.')
new_notes('D23', 'BASHAR. Monitor: planned weather vs forecast and current status → Adjust outfit changes one piece.')
new_notes('APX', 'Backup for questions: every proactive feature, where it is in the app, its requirement and its tests.')
new_notes('DEF2', 'Backup: the ten defects found in the final pass, each with a regression test (05_Testing/evidence/defects.md).')

# ---------- 8 · page numbers follow the new order ----------
p = rd(f'{W}/ppt/presentation.xml'); rels = rd(f'{W}/ppt/_rels/presentation.xml.rels')
rm = {a: b for a, b in re.findall(r'Id="(rId\d+)"[^>]*Target="slides/(slide\d+\.xml)"', rels)}
rm.update({b: a for a, b in re.findall(r'Target="slides/(slide\d+\.xml)"[^>]*Id="(rId\d+)"', rels)})
order = [rm[i] for i in re.findall(r'<p:sldId [^>]*r:id="(rId\d+)"', p)]
oldnum = {f: i + 1 for i, f in enumerate(open(f'{D}/order.txt').read().split())}
for i, f in enumerate(order, 1):
    pp = f'{W}/ppt/slides/{f}'; x = rd(pp)
    if f in oldnum:
        o = oldnum[f]; x2 = re.sub(rf'(<a:off x="11231575" y="\d+"/>.*?<a:t>){o}(</a:t>)', rf'\g<1>{i}\2', x, count=1, flags=re.S)
        if x2 == x: x2 = re.sub(rf'<a:t>{o}</a:t>(?=(?:(?!<a:t>).)*</p:spTree>)', f'<a:t>{i}</a:t>', x, count=1, flags=re.S)
        x = x2
    else:
        x = x.replace('<a:t>46</a:t>', f'<a:t>{i}</a:t>').replace('<a:t>0</a:t>', f'<a:t>{i}</a:t>')
    wr(pp, x)
json.dump({'order': order, 'new': NEW}, open(f'{D}/new_order.json', 'w'))
print(len(order), 'slides'); print('\n'.join(LOG))
