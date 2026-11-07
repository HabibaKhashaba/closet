# Builds Closet_SRS_v2.0.pdf and Closet_SDD_v2.0.pdf: one clean, unified document each.
# Content = v1.1 rev 3 baseline (removed text dropped, added text kept) + revisions 4 and 5 merged into their sections.
import json, re, html as H, pathlib, sys, base64, subprocess
W = pathlib.Path('/tmp/claude-0/-home-claude/9efb93b1-43eb-5797-9e1b-67bf2830dbac/scratchpad/v2')
DIAG = pathlib.Path('/home/claude/src2/closet/docs/milestone2/diagrams')
OUT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else W / 'out'); OUT.mkdir(exist_ok=True)
REV = json.load(open(W / 'rev.json'))
DATE = 'November 2, 2026'

FIX = [  # stale statements in the baseline text
    (r'Closet_SDD_v1\.[0-3]', 'Closet_SDD_v2.0'), (r'Closet_SRS_v1\.[0-3]', 'Closet_SRS_v2.0'),
    (r'FR-01\s*[–-]\s*FR-80', 'FR-01 – FR-117'), (r'NFR-01\s*[–-]\s*NFR-15', 'NFR-01 – NFR-20'),
    (r'\b1[34]\s+whitelisted', '35 whitelisted'), (r'\b1[34] functions', '35 functions'), (r'\b31 functions', '35 functions'),
    (r'photo-real try-on on the user’s own photo,\s*', ''),
    (r'try the look on a stylised avatar', 'try the look on (a simulated preview or a realistic AI try-on on their own photo)'),
    (r'Developers \(Salma, Bashar, Karim\)', 'Developers (Habiba, Salma, Bashar, Karim, Youssef)'),
    (r'Tester \(Youssef\)', 'Testers (Salma leads the test report)'),
    (r'Scrum lead and documentation \(Habiba\)|Scrum lead \(Habiba\)', 'Scrum lead and documentation (Habiba)'),
    (r'\(future; the app draws a stylised avatar today\)', '(FASHN: realistic AI try-on since version 2.0, US-118; the simulated preview remains as the fallback)'),
    (r'US-30 photo-real try-on', 'US-30 photo-real try-on (now delivered by US-118, Sprint 2)'),
    (r'Photo-real try-on \(future\)', 'Photo-real try-on (US-118, Sprint 2: AI try-on, see chapter 8)'),
    (r'(Availability and laundry:\s*(?:</b>)?\s*)five statuses', r'\1nine lifecycle states (section 4.22)'),
    (r'Figure 6-10 – Virtual try-on — choose your photo; it stays in this tab \(S3 preview\)\.', 'Figure 6-10 – Virtual try-on (current design) — choose your photo; it stays in this tab.'),
    (r'Figure 6-11 – Virtual Try-On Preview on a photo — a neutral test figure in the automated run \(S3 preview\)\.', 'Figure 6-11 – Virtual try-on (current design) — simulated preview on a neutral test figure. The realistic AI result (US-118) is added after the live provider test (T-30).'),
    (r'exactly one of five statuses', 'exactly one of the lifecycle states (five in Sprint 1; nine since build v1.6, section 4.22)'),
    (r'\s{2,}', ' '), (r' ([,.;:)])', r'\1'), (r'\( ', '('),
]
def fix(t):
    for a, b in FIX: t = re.sub(a, b, t)
    return t

def runs_html(runs):
    out = ''
    for (b, i, m), t in runs:
        t = H.escape(t)
        if m: t = f'<code>{t}</code>'
        if i: t = f'<i>{t}</i>'
        if b: t = f'<b>{t}</b>'
        out += t
    return out

def cell(t): return H.escape(fix(t))

def body_from(blocks, skip_pages, pagekind):
    """Turn extracted blocks into HTML; returns list of (level, title, html) sections."""
    secs = []; cur = None; para = None; pre = None; lst = None
    lastbot = None; lastpage = None; lasttable = None
    def flush():
        nonlocal para, pre, lst
        if para is not None:
            txt = fix(' '.join(para['h']).replace('- ', '-') if False else ' '.join(para['h']))
            txt = re.sub(r'(\w)-\s+(\d)', r'\1-\2', txt)
            cls = ' class="cap"' if para['cap'] else ''
            if para['li']:
                cur['h'] += f'<li>{txt}</li>'
            else:
                cur['h'] += f'<p{cls}>{txt}</p>'
            para = None
        if pre is not None:
            cur['h'] += '<pre>' + '\n'.join(pre) + '</pre>'; pre = None
    def newsec(level, title):
        nonlocal cur
        flush_list()
        cur = {'lvl': level, 'title': fix(title), 'h': ''}; secs.append(cur)
    def flush_list():
        nonlocal lst
        flush()
        if cur is not None and cur['h'].endswith('</li>') and not cur['h'].endswith('</ul>'):
            pass
    newsec(0, '')
    pending_head = None
    for x in blocks:
        pg = x['page']
        if pg in skip_pages: continue
        k = x['kind']; d = x['data']
        if k == 'line':
            serif = 'Serif-Bold' in d['f']
            if serif and d['sz'] >= 12.5:
                lvl = 1 if d['sz'] >= 16 else 2
                if cur['title'] and cur['lvl'] == lvl and not cur['h'] and lastpage == pg and d['top'] - lastbot < 12:
                    cur['title'] += ' ' + fix(d['t']); lastbot = d['bot']; continue
                flush(); close_ul(cur); newsec(lvl, d['t']); lastbot = d['bot']; lastpage = pg; lasttable = None; continue
            mono = d['f'].startswith('DejaVuSansMono')
            if mono:
                if para: flush()
                if pre is None: pre = []
                ind = max(0, round((d['x'] - 62) / 5.5))
                pre.append(' ' * ind + H.escape(d['t']))
                lastbot = d['bot']; lastpage = pg; continue
            elif pre is not None: flush()
            t = runs_html(d['runs'])
            first_bold = d['runs'] and d['runs'][0][0][0] and len(d['runs'][0][1].strip()) > 1
            bullet = d['t'][:1] in '•◦▪–' and len(d['t']) > 2 and d['t'][1] == ' '
            cap = d['t'].startswith('Figure ') or d['t'].startswith('Table ')
            gap = (d['top'] - lastbot) if (lastpage == pg and lastbot is not None) else 0
            brk = (para is None or bullet or cap or first_bold or gap > d['sz'] * 0.9
                   or (lastpage != pg and para['h'] and para['h'][-1].rstrip().endswith(('.', ':', '</b>'))))
            if brk:
                flush()
                if bullet:
                    t = re.sub(r'^(<[^>]+>)*[•◦▪–]\s*', lambda m: m.group(0)[:-len(m.group(0).lstrip('<>/biscode'))] if False else '', t, count=1)
                    if not cur['h'].endswith(('</li>',)): cur['h'] += '<ul>'
                elif cur['h'].endswith('</li>'): cur['h'] += '</ul>'
                para = {'h': [t], 'cap': cap, 'li': bullet}
            else:
                para['h'].append(t)
            lastbot = d['bot']; lastpage = pg; lasttable = None
        elif k == 'table':
            flush(); close_ul(cur)
            rows = [[re.sub(r'\s+', ' ', c).strip() for c in r] for r in d]
            rows = [r for r in rows if any(r)]
            if sum(len(c) for r in rows for c in r) < 6: continue
            if not rows: continue
            if lasttable is not None and lasttable['head'] == rows[0]:
                rows = rows[1:]; cur['h'] = cur['h'][:-len('</tbody></table>')]
                cur['h'] += ''.join('<tr>' + ''.join(f'<td>{cell(c)}</td>' for c in r) + '</tr>' for r in rows) + '</tbody></table>'
            else:
                head = rows[0]
                looks_head = all(len(c) < 40 for c in head) and len(rows) > 1
                h = '<table>'
                if looks_head: h += '<thead><tr>' + ''.join(f'<th>{cell(c)}</th>' for c in head) + '</tr></thead>'; rows = rows[1:]
                h += '<tbody>' + ''.join('<tr>' + ''.join(f'<td>{cell(c)}</td>' for c in r) + '</tr>' for r in rows) + '</tbody></table>'
                cur['h'] += h
                lasttable = {'head': head if looks_head else None}
            lastbot = None; lastpage = pg
        elif k == 'img':
            flush(); close_ul(cur)
            wide = pagekind(pg) == 'land'
            cur['h'] += f'<figure class="{"diag" if wide else "shot"}"><img src="file://{d}"/>'
            cur['h'] += '<!--CAP-->'
            lastbot = None; lastpage = pg; lasttable = None
    flush(); close_ul(cur)
    # attach captions directly following an image into its figure
    for s in secs:
        s['h'] = re.sub(r'<!--CAP-->(<p class="cap">(.*?)</p>)?', lambda m: f'<figcaption>{m.group(2) or ""}</figcaption></figure>', s['h'])
    return secs

def close_ul(cur):
    if cur['h'].endswith('</li>'): cur['h'] += '</ul>'

def rev_sections(h):
    parts = re.split(r'(<h2[^>]*>.*?</h2>)', h)
    out = {}; title = None
    for p in parts:
        m = re.match(r'<h2[^>]*>(.*?)</h2>', p)
        if m: title = re.sub('<.*?>', '', m.group(1)); out[title] = ''
        elif title: out[title] += p
    return out

def find(secs, prefix):
    for i, s in enumerate(secs):
        if s['title'].startswith(prefix): return i
    raise KeyError(prefix)

def figure(name, cap, cls='diag'):
    return f'<figure class="{cls}"><img src="file://{DIAG / name}"/><figcaption>{cap}</figcaption></figure>'

CSS = open(pathlib.Path(__file__).with_name('v2.css')).read()

def assemble(secs, cover, revhist, title):
    toc = '<h1 class="toc-h">Table of Contents</h1><div class="toc">'
    body = ''; n = 0
    for s in secs:
        if s['lvl'] == 0:
            continue
        n += 1; aid = f's{n}'
        tag = 'h1' if s['lvl'] == 1 else ('h2' if s['lvl'] == 2 else 'h3')
        if s['lvl'] <= 2:
            toc += f'<div class="t{s["lvl"]}"><a href="#{aid}"><span>{H.escape(s["title"]) if "<" not in s["title"] else s["title"]}</span><i data-a="{aid}"></i></a></div>'
        if tag == 'h1':
            m = re.match(r'^(?:(\d+)\.|Appendix ([A-Z])[:.]?)\s*(.*)$', s['title'])
            num, txt = ((m.group(1) or m.group(2)), m.group(3)) if m else ('', s['title'])
            kick = 'Appendix' if (m and m.group(2)) else ('Chapter' if num else '')
            body += f'<h1 id="{aid}" class="chap" data-t="{H.escape(re.sub('<.*?>','',txt))}"><span class="cn">{num}</span><span class="ck">{kick}</span><span class="ctx">{txt.title() if txt.isupper() else txt}</span></h1>' + s['h']
        else:
            body += f'<{tag} id="{aid}">{s["title"]}</{tag}>' + s['h']
    toc += '</div>'
    return f'<!doctype html><html><head><meta charset="utf-8"><style>{CSS}</style><title>{title}</title></head><body data-doc="{title}">{cover}<section class="tocs">{toc}</section><section class="front">{revhist}</section>{body}</body></html>'

ART = pathlib.Path('/home/claude/src2/closet/client/public/art')
HANGER = '<svg class="hg" viewBox="0 0 120 46"><path d="M60 4c-5 0-8 3-8 7 0 3 2 5 5 6l3 2" fill="none" stroke="#8a6d5b" stroke-width="3" stroke-linecap="round"/><path d="M60 19 8 42h104z" fill="none" stroke="#8a6d5b" stroke-width="3.2" stroke-linejoin="round"/></svg>'
COVER = {
  'SRS': ('The Requirements Issue', [('117', 'functional requirements, each traced to a story, a test and a release'), ('31', 'use cases, from sign-in to the AI try-on'), ('9', 'garment states, one lifecycle'), ('3', 'looks for every occasion — and why')],
          [('FR-01 – FR-117', 'tag-rose'), ('NFR-01 – NFR-20', 'tag-sage'), ('UC-01 – UC-31', 'tag-butter'), ('US-118 · Try-On', 'tag-sky')]),
  'SDD': ('The Design Issue', [('15', 'modules in one modular monolith'), ('8', 'database migrations, one schema per module'), ('35', 'whitelisted Ask Closet functions'), ('1', 'provider interface for the AI try-on')],
          [('Architecture', 'tag-rose'), ('Class · Sequence', 'tag-sage'), ('Data · ER', 'tag-butter'), ('Try-On service', 'tag-sky')]),
}
def cover(kind, extra=''):
    short = 'SRS' if 'Requirements' in kind else 'SDD'
    issue, lines, tags = COVER[short]
    rail = ''.join(f'<div class="hang h{k}">{HANGER}<div class="garm"><img src="file://{ART / f}"/></div><span class="ptag {tags[k][1]}">{tags[k][0]}</span></div>'
                   for k, f in enumerate(['beige_trench_coat.jpg', 'cream_knit_sweater.jpg', 'beige_wide_leg_trousers.jpg', 'white_sneakers.jpg']))
    cl = ''.join(f'<div class="cl"><b>{n}</b><span>{t}</span></div>' for n, t in lines)
    bars = ''.join(f'<i style="width:{w}pt"></i>' for w in [1, 2.4, 1, 1, 3, 1.4, 1, 2.2, 1, 3, 1, 1.6, 2.4, 1, 1, 2.8, 1.2, 1, 2])
    return f'''<div class="cover"><div class="cv-blob b1"></div><div class="cv-blob b2"></div>
<div class="cv-top"><span>CSCE 3701 · Software Engineering · AUC</span><span>Milestone 2 · Sprint 1 · November 2026</span></div>
<div class="cv-mast">Closet</div>
<div class="cv-issue">{issue}</div>
<div class="cv-rail"><div class="rod"></div>{rail}</div>
<div class="cv-lines"><div class="cv-kick2">Inside this issue</div><div class="cv-cl">{cl}</div></div>
<div class="cv-bottom"><div class="cv-doc"><div class="cv-dk">{short} · Version 2.0</div><div class="cv-dt">{kind}</div>
<div class="cv-team">Team Closet — Habiba Khashaba · Salma · Bashar · Karim · Youssef<br/>Instructor: Dr. Sherif Aly · {DATE} · github.com/HabibaKhashaba/closet</div></div>
<div class="cv-code"><div class="bars">{bars}</div><span>CLOSET · v2.0 · {short}</span></div></div></div><!--/cover-->'''

REVROWS = [
    ('Team Closet', 'Sep 2026', 'Milestone 0: problem, users, first feature list.', '0.1'),
    ('Team Closet', '10/13/2026', 'Milestone 1 baseline.', '1.0'),
    ('Team Closet', '10/25/2026', 'Milestone 2: separate document (IEEE / Wiegers template), Admin actor, authentication and authorization, release per requirement.', '1.1'),
    ('Team Closet', '10/26/2026', 'Revisions 2 and 3: core flow first, deletion reasons, shopping list, try-on on the user’s photo, Suggest a fix (C-01 – C-68).', '1.1 r2–r3'),
    ('Team Closet', '10/28/2026', 'Revision 4 (build v1.5): proactive wardrobe intelligence, three different looks, Ask Closet with 31 functions (C-70 – C-84).', '1.2'),
    ('Team Closet', '10/29/2026', 'Revision 5 (build v1.6): one garment lifecycle (nine states), care, borrow & lend, donation, Ask Closet with 35 functions (C-85 – C-97).', '1.3'),
    ('Team Closet', DATE, 'Version 2.0 for the Milestone 2 submission: one consolidated document — revisions 4 and 5 merged into their sections, stale statements corrected, use case diagrams placed with the requirements, AI virtual try-on (US-118) added, Admin console detailed (FR-118 – FR-120), cost per wear removed, unified layout.', '2.0'),
]
def revhist(what):
    rows = ''.join(f'<tr><td>{a}</td><td>{b}</td><td>{c}</td><td>{d}</td></tr>' for a, b, c, d in REVROWS)
    return (f'<h1 class="nonum">Revision History</h1><table class="rh"><thead><tr><th>Author</th><th>Date</th><th>Reason for changes</th><th>Version</th></tr></thead><tbody>{rows}</tbody></table>'
            f'<p class="note"><b>How changes are tracked.</b> Earlier versions showed every edit inline (green = added, red = removed) and stacked each revision in front of the previous document. '
            f'Version 2.0 consolidates them: every requirement now sits in its own section with its final wording. Each change keeps its ID (C-01 – C-97, C-98 – C-107) in the change log appendix, and the statements that were superseded are listed there with what replaced them, so the progression of the {what} stays visible.</p>')

def renumber(h, mapping):
    for a, b in mapping: h = h.replace(a, b)
    return h

VS = '/tmp/claude-0/-home-claude/9efb93b1-43eb-5797-9e1b-67bf2830dbac/scratchpad/vto2'
TRYON_FR = [
 ('FR-114', 'Every one of the three recommended looks shall offer a <b>Virtual Try-On</b> action next to Save, Change a piece, Not for me and Wear this. It opens “Which item do you want to try on?” listing the look’s pieces; tops, jackets / layers and dresses can be chosen, the others are shown as “Not supported yet”.', 'US-118', 'S1 (built)'),
 ('FR-115', 'The user shall upload a clear full-body photo (JPG, PNG or WebP, ≤ 10 MB, ≥ 300 px per side) or use the saved try-on photo, and may save, replace or delete that photo. Before generating, the user shall confirm that the photo and the piece’s photo are sent to an external AI try-on service.', 'US-118', 'S1 (built)'),
 ('FR-116', 'Generate shall send the request to Closet’s server only; the server validates the piece (owner, category, photo) and the user photo, starts the provider job and returns a try-on id with status PENDING / PROCESSING. The screen shows “Creating your virtual try-on…” and checks the status (every 2.5 s, then 4 s, then 6 s) until COMPLETED or FAILED. Leaving the screen does not cancel the job.', 'US-118', 'S1 (built)'),
 ('FR-117', 'A completed try-on shall show the generated image labelled “AI-generated try-on · not a photo” with Save result, Try another item and Back to outfit (the same three looks). A failed try-on shall explain why in words (no photo, unsuitable piece, provider error, time-out, no result, network) and offer Retry.', 'US-118', 'S1 (built)'),
]
TRYON_NFR = [
 ('NFR-20', 'Virtual Try-On privacy and limits: the provider key exists only in the server environment; photos and results are private files behind signed URLs and only their owner can read them (another user gets 404); files are checked by their bytes, not their name; 20 try-ons per user per day, 2 running at once (429); a job still running after 180 s becomes FAILED; image contents are never logged; deleting the account deletes every try-on file.', 'VT-01 – VT-27 (unit) · API-VT01 – VT09 · e2e virtual_tryon_journey.py'),
]
TRYON_CH = [
 ('C-98', 'Added', '4.23', 'Image-based Virtual Try-On of one garment from a recommended look, FR-114 – FR-117 (US-118).'),
 ('C-99', 'Added', '5.6, 6.3', 'NFR-20 privacy and limits; data: migration 008 (tryon.virtual_try_ons, tryon.user_photos).'),
 ('C-100', 'Changed', '4.11', 'The in-browser overlay is kept as “Quick fit preview”; the realistic try-on is the new image-based Virtual Try-On (4.23).'),
 ('C-101', 'Changed', '1.2, 4.14', 'Requirement ranges updated (FR-01 – FR-117, NFR-01 – NFR-20); Ask Closet uses 35 functions everywhere.'),
 ('C-102', 'Changed', 'Appendix B', 'Use case overview, proactive use cases and the nine-state lifecycle placed with the analysis models.'),
 ('C-103', 'Changed', 'all', 'Revisions 4 and 5 merged into their sections; stacked revision pages removed.'),
 ('C-104', 'Changed', 'Revision history', 'One revision table from 0.1 to 2.0.'),
]

ADMIN_FR = [
 ('FR-118', 'The Admin page shall show a platform overview: accounts (admins / members), accounts active and new in the last 7 days, accounts that need attention (suspended, locked), virtual try-ons (done, failed, running), pieces stored and the average per member, saved and worn outfits, server errors, and new accounts per week for the last 6 weeks. Only totals — never a wardrobe.', 'US-80, US-81', 'S1 (built early)'),
 ('FR-119', 'The admin shall search accounts by email and filter them (all, active, locked, suspended, admins). Opening an account shows its role, state, joined date, last activity, wrong-password count and counts of pieces, saved outfits, worn outfits and try-ons, with that account’s security events. Piece names, photos and outfits are never shown.', 'US-80, US-119', 'S1 (built early)'),
 ('FR-120', 'A security log shall list account-level events across the platform — account created, signed in / out, profile updated and every admin action (suspended, restored, unlocked, with the account concerned). Wardrobe actions (pieces, laundry, outfits) shall never appear in it. The admin shall be able to unlock an account locked after five wrong passwords before the 15 minutes end; an admin account cannot be suspended from this page.', 'US-119, US-120', 'S1 (built early)'),
]
V2_CH = [
 ('C-105', 'Removed', '4.21, 6.4, Appendix B', 'Cost per wear removed from the product at the team’s decision: FR-97, US-53 / US-108 and GET /intelligence/value are withdrawn; the piece page, Analytics and Ask Closet no longer show it (Ask Closet: 34 functions). The optional price fields stay in the data model but are not shown.'),
 ('C-106', 'Added', '4.24', 'Admin console in detail: FR-118 – FR-120 (overview, account detail, security log, unlock), US-119 and US-120; routes GET /admin/users/:id, GET /admin/events, POST /admin/users/:id/unlock.'),
 ('C-107', 'Changed', '1.2, 4.14', 'Requirement range FR-01 – FR-120; Ask Closet uses 34 functions everywhere.'),
]
REMOVED_MARK = ('FR-97', 'US-108', 'US-53', '/intelligence/value')
def v2post(h):
    # C-105: rows of the withdrawn cost-per-wear feature stay visible, struck through, for traceability
    def row(m):
        r = m.group(0)
        if not any(k in r for k in REMOVED_MARK) or 'C-105' in r: return r
        return r.replace('<tr>', '<tr class="removed">', 1).replace('</td>', ' <span class="rm">removed · C-105</span></td>', 1)
    h = re.sub(r'<tr>.*?</tr>', row, h, flags=re.S)
    for a, b in [('35 functions', '34 functions'), ('FR-01 – FR-117', 'FR-01 – FR-120'),
                 ('purchase impact, cost per wear and donation are now built', 'purchase impact and donation are now built (cost per wear was removed in v2.0, C-105)'),
                 ('<td>cost per wear (FR-97)</td>', '<td>optional purchase details (cost per wear removed in v2.0, C-105)</td>')]:
        h = h.replace(a, b)
    return h

def tbl(head, rows):
    return '<table><thead><tr>' + ''.join(f'<th>{h}</th>' for h in head) + '</tr></thead><tbody>' + ''.join('<tr>' + ''.join(f'<td>{c}</td>' for c in r) + '</tr>' for r in rows) + '</tbody></table>'

def strip_h(h):  # drop page-break classes and "R4.x"-style labels inside rev bodies
    h = h.replace(' class="pb"', '')
    h = re.sub(r'<p class="note">The baseline.*?</p>', '', h)
    return h

def land(pg): return 'land' if pg in LAND else 'port'

D29 = '/home/claude/src2/closet/docs/milestone2/diagrams/D29_use_case_v2.png'
UC_CAP = 'Use case diagram v2.0: every use case of the product. Colours: dark rose = key use cases (Get Outfit Recommendations, Virtual Try-On); rose = user use cases; green = «extend»; yellow = shared «include» (availability, weather); blue = Virtual Try-On details; lilac = Admin. Actors marked (duplicate) are copies drawn for readability.'
def build_srs():
    global LAND
    blocks = json.load(open(W / 'srs_base.json'))
    LAND = {x['page'] for x in blocks if x['kind'] == 'img'}
    secs = body_from(blocks, {18, 19, 20, 21}, land)
    r4 = rev_sections(REV['srs4']); r5 = rev_sections(REV['srs5'])
    g = lambda d, p: strip_h(next(v for k, v in d.items() if k.startswith(p)))
    # 2.2: put the use case overview with the product functions
    i = find(secs, '2.2'); secs[i]['h'] = secs[i]['h'] + figure('D29_use_case_v2.png', 'Figure 2-3 – ' + UC_CAP, 'diag tall')
    # 4.11 note about AI try-on
    i = find(secs, '4.11'); secs[i]['h'] += '<p class="note">Since version 2.0 this in-browser overlay is called “Quick fit preview”. The realistic, image-based Virtual Try-On of one piece on the user’s own photo is specified in section 4.23.</p>'
    # 4.21 – 4.23 after 4.20
    i = find(secs, '4.20') + 1
    new = [
     {'lvl': 2, 'title': '4.21 Proactive wardrobe intelligence', 'h': re.sub(r'Release: <b>Sprint 3 · built early in v1.5</b>', 'Release: <b>Sprint 3 · built early in v1.5</b>', g(r4, 'R4.2'))},
     {'lvl': 2, 'title': '4.22 Garment lifecycle, care, lending and donation', 'h': g(r5, 'R5.2') + figure('D24_state_v16.png', 'Figure 4-1 – The one garment lifecycle: nine states, 21 transitions (supersedes the five-status machine of FR-27 – FR-29).')},
     {'lvl': 2, 'title': '4.23 Virtual Try-On (image-based, one garment)', 'h':
      '<p><b>4.23.1 Description and priority.</b> High (US-118). The quick fit preview (4.11) shows proportions, not how the clothes really look. Virtual Try-On is image-based (no camera, no AR): the user’s full-body photo and the photo of ONE garment from a recommended look are sent by Closet’s server to an external image-based try-on service (FASHN), which returns a picture of the user wearing that garment. Version 1 supports tops, jackets / layers and dresses (the most reliable categories); the design allows bottoms (configuration) and full-outfit try-on later. Status: built and tested with the mock provider; the live provider test with a real key is task T-30.</p>'
      f'<figure class="shot"><img src="file://{VS}/v02_picker.png"/><figcaption>Figure 4-2 – “Which item do you want to try on?” opened from a recommended look; unsupported pieces are disabled.</figcaption></figure>'
      '<p><b>4.23.2 Stimulus / response.</b></p><ul><li>Generate 3 looks → Virtual Try-On on a look → choose a top, jacket or dress → the Virtual Try-On screen opens with the piece.</li><li>Upload a full-body photo (or use the saved one) → tick the photo notice → Generate try-on → “Creating your virtual try-on…” → the result with Save result · Try another item · Back to outfit.</li><li>No photo, unsuitable photo or piece, provider error or time-out → a short explanation and Retry; the rest of Closet keeps working.</li></ul>'
      f'<figure class="shot"><img src="file://{VS}/v05_ready.png"/><figcaption>Figure 4-3 – The Virtual Try-On screen: the photo, the piece, the consent notice and Generate try-on.</figcaption></figure>'
      '<p><b>4.23.3 Functional requirements.</b></p>' + tbl(['ID', 'Requirement', 'Stories', 'Release'], [[f'<b>{a}</b>', b, c, d] for a, b, c, d in TRYON_FR])},
     {'lvl': 2, 'title': '4.24 Admin console (version 2.0)', 'h':
      '<p><b>4.24.1 Description and priority.</b> Medium (US-80, US-81, US-119, US-120). Extends 4.19: the admin manages accounts and watches the platform without ever seeing anyone’s wardrobe. Only role = admin reaches /admin (Access Control); a normal user gets 403.</p>'
      '<p><b>4.24.2 Stimulus / response.</b></p><ul><li>Sign in as admin → Admin → the overview, sign-ups per week, the security log, the accounts table, system health.</li><li>Search or filter accounts → open one → its counts and security events.</li><li>Suspend → every session of that account ends at once; Restore → it can sign in again; Unlock → a locked account can sign in before the 15 minutes end. Each action appears in the security log.</li></ul>'
      f'<figure class="shot"><img src="file://{VS}/adm_page.png"/><figcaption>Figure 4-4 – The Admin page: overview, sign-ups, security log and accounts (offline demo data).</figcaption></figure>'
      f'<figure class="shot"><img src="file://{VS}/adm_detail.png"/><figcaption>Figure 4-5 – One account: counts and security events only.</figcaption></figure>'
      '<p><b>4.24.3 Functional requirements.</b></p>' + tbl(['ID', 'Requirement', 'Stories', 'Release'], [[f'<b>{a}</b>', b, c, d] for a, b, c, d in ADMIN_FR]) +
      tbl(['Story', 'As an admin I want to…', 'Priority', 'Acceptance'], [['US-119', 'see one account’s details and the platform security log', 'Should', 'Counts and account events only; wardrobe actions never listed'], ['US-120', 'unlock an account locked by wrong passwords', 'Could', 'After unlock the right password works at once; the unlock is logged']]) +
      tbl(['FR', 'API', 'Tests'], [['FR-118', 'GET /admin/stats · GET /admin/health', 'AD-U02 · AD-U07 · API-AD02 · API-AD08'], ['FR-119', 'GET /admin/users · GET /admin/users/:id', 'AD-U01 · AD-U04 · API-AD05'], ['FR-120', 'GET /admin/events · POST /admin/users/:id/unlock · PATCH /admin/users/:id', 'AD-U03 · AD-U05 · AD-U06 · API-AD03 · API-AD06 · API-AD07']])},
    ]
    secs[i:i] = new
    # 5.6 after 5.5
    i = find(secs, '6.') if False else find(secs, '6. Other')
    secs.insert(i, {'lvl': 2, 'title': '5.6 Requirements added in builds v1.5 – v1.6 and version 2.0', 'h':
        '<h3>From build v1.5 (revision 4)</h3>' + g(r4, 'R4.3') + '<h3>From build v1.6 (revision 5)</h3>' + g(r5, 'R5.3') +
        '<h3>Version 2.0 · AI virtual try-on</h3>' + tbl(['ID', 'Requirement', 'Verification'], [[f'<b>{a}</b>', b, c] for a, b, c in TRYON_NFR])})
    # traceability extension in 6.4
    i = find(secs, '6.5')
    secs.insert(i, {'lvl': 3, 'title': '6.4.1 Traceability of FR-81 – FR-117', 'h': g(r4, 'R4.5') + g(r5, 'R5.6') +
        tbl(['FR', 'API', 'Tests', 'Story'], [[a, api, t, 'US-118'] for (a, *_), api, t in zip(TRYON_FR, ['GET /virtual-try-on/status', 'GET · PUT · DELETE /virtual-try-on/photo · POST /virtual-try-on', 'POST /virtual-try-on · GET /virtual-try-on/:id', 'POST /:id/save · POST /:id/retry · DELETE /:id'], ['e2e v01 – v02 · VT-13', 'VT-14 · VT-15 · VT-21 · VT-22 · API-VT04 · API-VT08 · e2e v03 – v05', 'VT-10 · VT-11 · VT-17 · VT-18 · API-VT02 · e2e v06, v11', 'VT-16 · VT-19 · VT-20 · API-VT05 – VT07 · e2e v07 – v10, v12'])])})
    # Appendix B additions
    i = find(secs, 'Appendix C')
    secs.insert(i, {'lvl': 2, 'title': 'B.5 Use cases added in builds v1.5 and v1.6', 'h': g(r4, 'R4.4') + g(r5, 'R5.4').replace('Figure R5-1 (D24)', 'Figure B-6 (D24)')})
    secs.insert(i + 1, {'lvl': 2, 'title': 'B.6 Use case added in version 2.0', 'h': tbl(['UC', 'Name', 'Primary actor', 'Secondary actors', 'Requirements'], [['UC-31', 'Virtual Try-On of one piece from a look', 'User', 'Image-based try-on service (FASHN)', 'FR-114 – FR-117']]) +
        '<p><b>Main flow:</b> generate 3 looks → Virtual Try-On on a look → choose a supported piece → upload or reuse the full-body photo → confirm the notice → Generate → wait → the AI-generated picture → Save result / Try another item / Back to outfit. <b>Alternatives:</b> unsupported piece (disabled in the list, 422 from the API), no or unsuitable photo (400 / 415 / 422), provider not set up (503), limit reached (429), provider error, time-out or empty result (try-on FAILED → Retry). <b>Relationships:</b> «extend» Get Outfit Recommendation (UC-09).</p>'})
    # Change log
    i = find(secs, 'Appendix D')
    secs[i]['h'] += '<h3>Revision 4 (build v1.5) · C-70 – C-84</h3>' + g(r4, 'R4.6') + '<h3>Revision 5 (build v1.6) · C-85 – C-97</h3>' + g(r5, 'R5.5') + '<h3>Version 2.0 · C-98 – C-107</h3>' + tbl(['ID', 'Type', 'Section', 'Change'], TRYON_CH + V2_CH)
    secs.append({'lvl': 1, 'title': 'Appendix E: Superseded Statements', 'h': '<p>Where a later revision replaced a statement of an earlier one, the newer statement is the one in the body of this document. This appendix keeps the old wording visible.</p>' + g(r4, 'R4.1') + g(r5, 'R5.1')})
    # Remove 'proposed, not yet in Jira' wording (stories are now in Jira)
    for s in secs:
        s['h'] = re.sub(r'(are|is) <b>proposed, not yet in Jira</b>', r'\1 in Jira', s['h'])
        s['h'] = s['h'].replace('<b>not yet in Jira</b>', 'in Jira').replace('Proposed stories (not yet in Jira)', 'Stories for the proactive features')
    for sx in secs:   # Appendix B: the v2.0 diagram replaces v1.4; the v1.4 detail stays as history
        sx['h'] = re.sub(r'<figure class="diag"><img src="file://[^"]*srs_base_p58_0.png"/><figcaption>.*?</figcaption></figure>',
                         lambda m: f'<figure class="diag tall"><img src="file://{D29}"/><figcaption>Figure B-1 – {UC_CAP}</figcaption></figure>', sx['h'], flags=re.S)
        sx['h'] = sx['h'].replace('Figure B-2 – Get Outfit Recommendation and Ask Closet in detail.', 'Figure B-2 – Version 1.4 detail of Get Outfit Recommendation and Ask Closet (kept for the history of the model; Figure B-1 is current).')
        sx['h'] = sx['h'].replace('Colour shows the sprint that delivers each use case. Figure B-2 zooms into the two use cases with the most structure.', 'Figure B-1 is the version 2.0 diagram with every use case of the product; colour shows its role (see the caption).')
    html = assemble(secs, cover('Software Requirements Specification'), revhist('requirements'), 'Software Requirements Specification · v2.0')
    return html

def build_sdd():
    global LAND
    blocks = json.load(open(W / 'sdd_base.json'))
    LAND = {x['page'] for x in blocks if x['kind'] == 'img' and x['page'] not in range(69, 78)}
    secs = body_from(blocks, {20, 21, 22, 23, 24}, land)
    r4 = rev_sections(REV['sdd4']); r5 = rev_sections(REV['sdd5'])
    i = find(secs, '3. SYSTEM'); secs[i - 1]['h'] += figure('D29_use_case_v2.png', 'Figure 2-2 – ' + UC_CAP, 'diag tall') + figure('D19_use_cases_proactive.png', 'Figure 2-3 – Use cases of the proactive features (UC-23 – UC-30).')
    ch = {'lvl': 1, 'title': '8. Design Evolution: Builds v1.5, v1.6 and AI Try-On', 'h': '<p>This chapter records how the design changed after the Milestone 2 baseline (chapters 3 – 7). Where it supersedes an earlier section, the table in 8.1 and 8.12 says so; the newer design wins.</p>'}
    new = [ch]; n = 0
    for k, v in list(r4.items()) + list(r5.items()):
        if k.startswith('Revision'): continue
        n += 1
        t = re.sub(r'^R[45]\.\d+\s*', '', k)
        new.append({'lvl': 2, 'title': f'8.{n} {t}' + (' (v1.6)' if k.startswith('R5') and 'What changed' in t else ''), 'h': strip_h(v)})
    n += 1
    new.append({'lvl': 2, 'title': f'8.{n} Virtual Try-On service (US-118)', 'h':
      '<p><b>Purpose.</b> Image-based try-on of ONE garment from a recommended look on the user’s own photo. It is its own module, <code>server/src/modules/tryon</code>, mounted at <code>/api/v1/virtual-try-on</code> behind the same security pipeline (authentication, validation, ownership, rate limits). The browser never calls the AI provider: the key stays on the server.</p>'
      '<p><b>Layers.</b> Web app → <code>VirtualTryOnController</code> (HTTP, multipart upload, 10 MB limit) → <code>VirtualTryOnService</code> (rules and statuses) → <code>VirtualTryOnProvider</code> interface (Adapter / Strategy) → <code>FashnVirtualTryOnProvider</code> (FASHN API) or <code>MockVirtualTryOnProvider</code> (no AI, for demos and tests). The provider is chosen by configuration (<code>TRYON_PROVIDER</code>), so Closet is not tied to one company.</p>'
      + figure('D28_vto_class.png', 'Figure 8-A – Class diagram of the Virtual Try-On module.') +
      '<pre>create(user, input):\n  IF NOT provider.enabled                     → 503 TRYON_DISABLED\n  IF NOT consent                              → 400 CONSENT_REQUIRED\n  piece ← wardrobe.getPiece(user, wardrobeItemId)      // another user\'s piece → 404\n  IF piece.category ∉ {Top, Layer, Dress}     → 422 UNSUPPORTED_GARMENT\n  garment ← storage.read(piece.photoKey)      // the original is never changed\n  IF garment missing / not an image / too small → 422 GARMENT_IMAGE_*\n  IF todayCount ≥ 20 OR running ≥ 2           → 429\n  person ← uploaded photo (checked: type, ≥ 300 px) OR saved try-on photo   // none → 400\n  row ← insert(PENDING); jobId ← provider.generateTryOn(person, garment, category)\n  row ← PROCESSING (provider error → FAILED with a friendly message)\nget(user, id):        // the client polls; no background worker\n  IF PROCESSING: IF age > 180 s → FAILED TRYON_TIMEOUT\n                 status ← provider.getStatus(jobId)   (at most once per 2.5 s)\n                 COMPLETED → image ← provider.getResult(jobId); copy into private storage\n                 FAILED → FAILED · network hiccup → stay PROCESSING</pre>'
      + figure('D27_vto_sequence.png', 'Figure 8-B – Sequence: generate a virtual try-on and poll until it is ready.') +
      tbl(['Method', 'Route', 'Purpose', 'Response', 'Errors'], [
          ['GET', '/virtual-try-on/status', 'set up? provider, supported categories, limits', '{enabled, provider, supportedCategories}', '401'],
          ['GET · PUT · DELETE', '/virtual-try-on/photo', 'the saved try-on photo', '{photo: {url, savedAt} | null}', '400 · 413 · 415 · 422'],
          ['POST', '/virtual-try-on', 'start a try-on (multipart)', '202 {tryOnId, status, garment, …}', '400 · 404 · 415 · 422 · 429 · 503'],
          ['GET', '/virtual-try-on', 'my try-ons (?saved=true)', '{tryOns: [...]}', '401'],
          ['GET', '/virtual-try-on/:id', 'status (poll)', '{status, resultImageUrl, error}', '404'],
          ['POST', '/virtual-try-on/:id/save · /retry', 'save result · retry a failed one', 'the try-on', '404 · 409 · 422'],
          ['DELETE', '/virtual-try-on/:id', 'delete it and its images', '204', '404']]) +
      tbl(['Table (migration 008)', 'Columns', 'Relations'], [
          ['tryon.virtual_try_ons', 'id, user_id, outfit_id, outfit_item_ids, wardrobe_item_id, garment_name, garment_category, user_image_key, garment_image_key, result_image_key, result_remote_url, status (PENDING · PROCESSING · COMPLETED · FAILED), provider, provider_job_id, error_code, error_message, saved, attempts, started_at, completed_at, created_at, updated_at', 'user → accounts.users (CASCADE) · outfit → outfits.outfits (SET NULL) · piece → wardrobe.items (SET NULL)'],
          ['tryon.user_photos', 'user_id, photo_key, consent_at, created_at, updated_at', 'user → accounts.users (CASCADE)']]) +
      f'<figure class="shot"><img src="file://{VS}/v06_loading.png"/><figcaption>Figure 8-C – “Creating your virtual try-on…”: the screen polls; the user may leave.</figcaption></figure>'
      f'<figure class="shot"><img src="file://{VS}/v09_failed.png"/><figcaption>Figure 8-D – A failed generation: a plain explanation and Retry.</figcaption></figure>'
      '<p><b>Privacy and security.</b> Photos are checked by their bytes (JPG, PNG, WebP only), stored privately and shown through signed, expiring URLs; every query is scoped by user; image contents are never logged; the provider’s result is copied into Closet’s storage so it is access-controlled; deleting a try-on deletes its images; deleting the account deletes all of them. <b>Future:</b> full-outfit try-on = chain the result of one garment as the person image of the next (dress, bottom, top, layer), garment background removal stored as a separate processed image, and a background worker if the provider offers webhooks. <b>Tests:</b> VT-01 – VT-27 (unit), API-VT01 – VT09 (API, PostgreSQL), e2e/virtual_tryon_journey.py (browser).</p>'})
    n += 1
    new.append({'lvl': 2, 'title': f'8.{n} Admin console (v2.0)', 'h':
      '<p><b>Design.</b> <code>adminService</code> holds the rules; its data comes from an <code>AdminRepository</code> interface — <code>pgAdminRepository</code> on PostgreSQL, the in-memory repository in the offline demo and the unit tests — so all three run the same logic (Repository pattern, like the other modules). Every route sits behind <code>requireRole(\'admin\')</code>. The security log reads <code>activity.log</code> filtered to account-level actions (<code>securityEvents.js</code>); wardrobe actions and piece names are never returned.</p>' +
      tbl(['Method', 'Route', 'Purpose', 'Response', 'Errors'], [
          ['GET', '/admin/stats', 'overview: account states, 6 weeks of sign-ups, try-on totals, usage', '{users, active, suspended, locked, newThisWeek, activeThisWeek, tryOns, signupsByWeek, …}', '401 · 403'],
          ['GET', '/admin/users · /admin/users/:id', 'accounts with counts · one account with its security events', '{users: […]} · {…, events}', '403 · 404'],
          ['GET', '/admin/events?limit=', 'platform security log (1 – 100)', '{events: [{email, action, at, detail}]}', '403'],
          ['PATCH', '/admin/users/:id', 'suspend / restore (suspend raises the token version)', '{id, email, status}', '400 · 404 · 409'],
          ['POST', '/admin/users/:id/unlock', 'lift the five-wrong-passwords lock', '{id, email, locked: false}', '404'],
          ['GET', '/admin/health · /admin/config', 'service status · shared lists (read-only)', '{status, services[]} · {…}', '403']]) +
      '<p><b>Cost per wear removed (C-105).</b> <code>costPerWear</code> / <code>valueInsights</code>, <code>GET /intelligence/value</code> and the Ask Closet <code>value</code> function were deleted; the price columns of <code>wardrobe.items</code> stay (no migration) but nothing reads them.</p>'})
    i = find(secs, '8. APPENDICES')
    secs[i]['title'] = '9. APPENDICES'
    secs[i:i] = new
    i = find(secs, 'Appendix E')
    secs[i]['h'] += '<p><b>Version 2.0.</b> Design changes of builds v1.5 and v1.6 merged into chapter 8 (previously separate front sections); Virtual Try-On module and routes /virtual-try-on added (8.' + str(n - 1) + '); Admin console detailed and cost per wear removed (8.' + str(n) + '); use case overview placed in chapter 2; one unified layout.</p>'
    html = assemble(secs, cover('Software Design Document'), revhist('design'), 'Software Design Document · v2.0')
    return html

if __name__ == '__main__':
    for name, fn in [('Closet_SRS_v2.0', build_srs), ('Closet_SDD_v2.0', build_sdd)]:
        (OUT / f'{name}.html').write_text(v2post(fn()))
        print(name)
