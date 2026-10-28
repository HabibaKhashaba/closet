# Closet v1.4 diagrams — drawn for 16:9 slides and A4 documents alike: 1600×900, 15–20 px text.
# One visual language with the app: cream paper, charcoal ink, dusty rose, sprint colours.
import math, os
OUT = os.path.dirname(os.path.abspath(__file__))
INK, MUTED, ROSE, ROSE_INK, PAPER = '#2a2626', '#7d736f', '#c48a86', '#9c5f5b', '#fffdfb'
SPR = {1: ('#e4f0e8', '#4f8a66', 'Sprint 1 · implemented'), 2: ('#f8ecdc', '#b77a33', 'Sprint 2 · early preview'),
       3: ('#eee7f2', '#7a5a9c', 'Sprint 3 · product preview'), 4: ('#efebe7', '#8f857c', 'Stretch · concept preview'), 0: ('#ffffff', '#2a2626', '')}
BLUE, RED = '#2f5fae', '#b8472b'

def esc(s): return str(s).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')

class SVG:
    def __init__(self, W=1600, H=900, title=None, sub=None):
        self.W, self.H, self.o = W, H, []
        self.o.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" font-family="Inter, Helvetica, Arial, sans-serif">')
        self.o.append('<defs><marker id="arr" markerWidth="12" markerHeight="10" refX="11" refY="5" orient="auto"><path d="M0,0 L12,5 L0,10 z" fill="#2a2626"/></marker>'
                      '<marker id="open" markerWidth="12" markerHeight="10" refX="11" refY="5" orient="auto"><path d="M0,0 L12,5 L0,10" fill="none" stroke="#2a2626" stroke-width="1.5"/></marker>'
                      '<marker id="tri" markerWidth="16" markerHeight="14" refX="15" refY="7" orient="auto"><path d="M0,0 L15,7 L0,14 z" fill="#fff" stroke="#2a2626" stroke-width="1.4"/></marker>'
                      '<marker id="dia" markerWidth="18" markerHeight="12" refX="1" refY="6" orient="auto"><path d="M1,6 L9,1 L17,6 L9,11 z" fill="#2a2626"/></marker>'
                      '<marker id="arrR" markerWidth="12" markerHeight="10" refX="11" refY="5" orient="auto"><path d="M0,0 L12,5 L0,10 z" fill="#9c5f5b"/></marker></defs>')
        self.o.append(f'<rect width="{W}" height="{H}" fill="{PAPER}"/>')
        if title:
            self.o.append(f'<text x="40" y="52" font-family="Lora, Georgia, serif" font-size="30" fill="{INK}">{esc(title)}</text>')
        if sub:
            self.o.append(f'<text x="40" y="80" font-size="15" fill="{MUTED}">{esc(sub)}</text>')
    def add(self, s): self.o.append(s)
    def text(self, x, y, s, size=16, fill=INK, anchor='middle', weight='normal', family=None, italic=False):
        fam = f' font-family="{family}"' if family else ''
        st = ' font-style="italic"' if italic else ''
        lines = str(s).split('\n')
        for i, t in enumerate(lines):
            yy = y + (i - (len(lines) - 1) / 2) * size * 1.22 + size * .35
            self.o.append(f'<text x="{x}" y="{yy:.1f}" text-anchor="{anchor}" font-size="{size}" font-weight="{weight}" fill="{fill}"{fam}{st}>{esc(t)}</text>')
    def rect(self, x, y, w, h, fill='#fff', stroke=INK, rx=10, sw=1.4, dash=None, opacity=1):
        d = f' stroke-dasharray="{dash}"' if dash else ''
        self.o.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"{d} opacity="{opacity}"/>')
    def line(self, x1, y1, x2, y2, stroke=INK, sw=1.4, dash=None, marker=None, start=None):
        d = f' stroke-dasharray="{dash}"' if dash else ''
        m = f' marker-end="url(#{marker})"' if marker else ''
        s = f' marker-start="url(#{start})"' if start else ''
        self.o.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{stroke}" stroke-width="{sw}"{d}{m}{s}/>')
    def path(self, d, stroke=INK, sw=1.4, dash=None, marker=None, fill='none'):
        dd = f' stroke-dasharray="{dash}"' if dash else ''
        m = f' marker-end="url(#{marker})"' if marker else ''
        self.o.append(f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"{dd}{m}/>')
    def label(self, x, y, s, size=13, fill=INK, bg=PAPER):
        w = len(s) * size * .56 + 10
        self.o.append(f'<rect x="{x - w / 2:.1f}" y="{y - size * .75:.1f}" width="{w:.1f}" height="{size * 1.5:.1f}" rx="4" fill="{bg}"/>')
        self.text(x, y, s, size, fill)
    def actor(self, x, y, name, size=16, ext=False):
        if ext:
            self.rect(x - 78, y - 30, 156, 60, '#f4f1ee', '#8f857c', 10, 1.3)
            self.text(x, y - 13, '«actor»', 12, MUTED)
            self.text(x, y + 9, name, size - 1, INK, weight='600')
            return
        g = f'<g stroke="{INK}" stroke-width="2" fill="none"><circle cx="{x}" cy="{y - 30}" r="11" fill="#fff"/><line x1="{x}" y1="{y - 19}" x2="{x}" y2="{y + 10}"/>'
        g += f'<line x1="{x - 17}" y1="{y - 8}" x2="{x + 17}" y2="{y - 8}"/><line x1="{x}" y1="{y + 10}" x2="{x - 13}" y2="{y + 32}"/><line x1="{x}" y1="{y + 10}" x2="{x + 13}" y2="{y + 32}"/></g>'
        self.o.append(g)
        self.text(x, y + 50, name, size + 1, INK, weight='700')
    def legend(self, x, y, items, size=14):
        for i, n in enumerate(items):
            f, s, t = SPR[n]
            self.rect(x, y + i * 26, 30, 18, f, s, 9, 1.4, '5 3' if n == 4 else None)
            self.text(x + 40, y + i * 26 + 9, t, size, INK, anchor='start')
    def save(self, name):
        self.o.append('</svg>')
        p = os.path.join(OUT, name + '.svg')
        open(p, 'w').write('\n'.join(self.o))
        return p

def ell_edge(c, rx, ry, q):
    dx, dy = q[0] - c[0], q[1] - c[1]
    t = 1 / math.sqrt((dx / rx) ** 2 + (dy / ry) ** 2)
    return c[0] + dx * t, c[1] + dy * t

# ---------------------------------------------------------------- D1 use case overview
def use_case_overview():
    s = SVG(title='Use case diagram · Closet v1.4', sub='Two actors (User, Admin) and six external services. Colour = the sprint that delivers each use case. «include» / «extend» detail: next diagram.')
    RX, RY = 150, 23
    s.rect(160, 100, 1130, 785, '#fffaf6', INK, 18, 1.6)
    s.text(725, 122, 'Closet', 19, INK, weight='700', family='Lora, Georgia, serif')
    L = [('Register / Login', 1), ('Manage Style Profile', 1), ('Customize Wardrobe Rules', 2), ('Add Clothing Item', 1), ('Edit / Browse Closet', 1),
         ('Delete Clothing Item', 2), ('Manage Availability & Laundry', 1), ('View Wear Analytics & History', 3), ('Style Forgotten Piece', 3), ('Review What Closet Learned', 3)]
    R = [('Virtual Try-On', 3), ('Ask Closet (AI chat)', 3), ('Get Outfit Recommendation', 2), ('Mix & Match (Build Outfit)', 2), ('Mark Outfit as Worn', 2),
         ('Plan Outfit Ahead', 1), ('Pack for a Trip', 4), ('Shopping List & Smart Shopping', 3), ('View Notifications', 3)]
    ys = [160 + i * 56 for i in range(10)]
    U = (725, 360)
    pos = {}
    for col, x in ((L, 420), (R, 1030)):
        for (n, sp), y in zip(col, ys[:len(col)]):
            pos[n] = (x, y)
            p = (x + RX, y) if x < 725 else (x - RX, y)
            s.line(p[0], p[1], U[0] + (-22 if x < 725 else 22), U[1] - 10, '#6d6462', 1.2)
    for col, x in ((L, 420), (R, 1030)):
        for (n, sp), y in zip(col, ys[:len(col)]):
            f, st, _ = SPR[sp]
            s.add(f'<ellipse cx="{x}" cy="{y}" rx="{RX}" ry="{RY}" fill="{f}" stroke="{st}" stroke-width="1.8"{" stroke-dasharray=\"6 4\"" if sp == 4 else ""}/>')
            s.text(x, y, n, 15.5, INK, weight='500')
    s.rect(725 - 60, U[1] - 52, 120, 120, PAPER, PAPER, 10, 0)
    s.actor(*U, 'User')
    # administration
    s.line(190, 728, 1260, 728, '#b9a99d', 1.2, '8 6')
    s.text(205, 744, 'Administration', 13.5, MUTED, anchor='start', weight='600')
    A = (725, 800)
    adm = [('Manage User Accounts', 420, 790, 3), ('View System Health & Usage', 1030, 770, 4), ('Handle Privacy & Data Requests', 1030, 840, 4)]
    for n, x, y, sp in adm:
        p = (x + RX, y) if x < 725 else (x - RX, y)
        s.line(p[0], p[1], A[0] + (-22 if x < 725 else 22), A[1] - 8, '#6d6462', 1.2)
        f, st, _ = SPR[sp]
        s.add(f'<ellipse cx="{x}" cy="{y}" rx="{RX}" ry="{RY}" fill="{f}" stroke="{st}" stroke-width="1.8"{" stroke-dasharray=\"6 4\"" if sp == 4 else ""}/>')
        s.text(x, y, n, 15.5, INK, weight='500')
    s.rect(670, 742, 110, 126, PAPER, PAPER, 10, 0)
    s.actor(725, 790, 'Admin')
    # external actors
    ext = [('Vision Service', 80, 328, ['Add Clothing Item'])]
    for n, x, y, links in ext:
        for l in links:
            p = ell_edge(pos[l], RX, RY, (x, y)); s.line(x + 78, y, p[0], p[1], '#8f857c', 1.3, '5 4')
        s.actor(x, y, n, 14, ext=True)
    E = [('Try-On Service', 160, ['Virtual Try-On']), ('LLM Service', 228, ['Ask Closet (AI chat)']), ('Weather API', 350, ['Get Outfit Recommendation', 'Plan Outfit Ahead', 'Pack for a Trip']),
         ('Calendar Service', 490, ['Plan Outfit Ahead']), ('Notification Service', 608, ['View Notifications'])]
    for n, y, links in E:
        for l in links:
            s.line(1362, y, pos[l][0] + RX, pos[l][1], '#8f857c', 1.3, '5 4')
        s.actor(1440, y, n, 14, ext=True)
    s.legend(1330, 752, [1, 2, 3, 4], 13.5)
    return s.save('D1_use_case_overview')

# ---------------------------------------------------------------- D2 recommendation zoom (include / extend)
def use_case_zoom():
    s = SVG(title='Zoom · Get Outfit Recommendation (UC-09) and Ask Closet (UC-07)', sub='«include» = always runs (blue, base → included) · «extend» = optional (red, extension → base) · the LLM only picks one of 14 whitelisted functions')
    RX, RY = 138, 27
    def uc(x, y, n, sp=2):
        f, st, _ = SPR[sp]
        s.add(f'<ellipse cx="{x}" cy="{y}" rx="{RX}" ry="{RY}" fill="{f}" stroke="{st}" stroke-width="1.8"/>'); s.text(x, y, n, 15, INK, weight='500')
        return (x, y)
    def rel(a, b, kind, t=.5, dx=0, dy=-12, p1=None, p2=None):
        p1, p2 = p1 or ell_edge(a, RX, RY, b), p2 or ell_edge(b, RX, RY, a)
        col = BLUE if kind == 'include' else RED
        s.line(p1[0], p1[1], p2[0], p2[1], col, 1.8, '7 5', 'arr' if kind == 'include' else 'arrR')
        mx, my = p1[0] + (p2[0] - p1[0]) * t + dx, p1[1] + (p2[1] - p1[1]) * t + dy
        s.label(mx, my, f'«{kind}»', 13, col)
    s.rect(190, 100, 1120, 785, '#fffaf6', INK, 18, 1.6)
    rec = uc(740, 450, 'Get Outfit\nRecommendation')
    names = [('Get Weather / Forecast', 2), ('Check Item Availability', 1), ('Analyze Preferences\n& Feedback', 2), ('Generate 3\nRecommendations', 2), ('Explain Recommendation', 2)]
    for i, (n, sp) in enumerate(names):
        c = uc(1150, 175 + i * 110, n, sp)
        rel(rec, c, 'include', .62, 0, -10, p1=(rec[0] + RX - 4, rec[1] + (i - 2) * 6), p2=(c[0] - RX, c[1]))
    ext = [('Reject Outfit\n(with a reason)', 2), ('Change One Piece', 2), ('Save / Favourite\nOutfit', 2), ('Virtual Try-On', 3)]
    for i, (n, sp) in enumerate(ext):
        c = uc(328 + i * 278, 800, n, sp)
        rel(c, rec, 'extend', .3, 0, 0, p1=(c[0], c[1] - RY), p2=(rec[0] + (i - 1.5) * 40, rec[1] + RY))
    chat = uc(420, 420, 'Ask Closet (AI chat)', 3)
    intr = uc(420, 190, 'Interpret Request\n(one of 14 functions)', 3)
    rel(chat, intr, 'include', .5, 0, 0)
    U = (90, 560); s.actor(*U, 'User')
    s.line(112, 540, rec[0] - RX, rec[1], '#6d6462', 1.3); s.line(112, 575, chat[0] - RX, chat[1], '#6d6462', 1.3)
    s.actor(90, 190, 'LLM Service', 14, ext=True); s.line(168, 190, intr[0] - RX, intr[1], '#8f857c', 1.3, '5 4')
    s.text(560, 300, 'tool call · keyword parser fallback', 12.5, MUTED)
    s.actor(1470, 175, 'Weather API', 14, ext=True); s.line(1392, 175, 1150 + RX, 175, '#8f857c', 1.3, '5 4')
    s.actor(1470, 800, 'Try-On Service', 14, ext=True); s.line(1392, 800, 1162 + RX, 800, '#8f857c', 1.3, '5 4')
    s.legend(1340, 330, [1, 2, 3], 13.5)
    return s.save('D2_use_case_zoom')

# ---------------------------------------------------------------- D3 component diagram
def comp(s, x, y, w, h, name, sp, stereo='component', sub=None, fs=15.5):
    f, st, _ = SPR[sp]
    s.rect(x, y, w, h, f, st, 10, 1.8, '6 4' if sp == 4 else None)
    ix, iy = x + w - 26, y + 9
    s.add(f'<g fill="#fff" stroke="{INK}" stroke-width="1.1"><rect x="{ix}" y="{iy}" width="16" height="20"/><rect x="{ix - 5}" y="{iy + 4}" width="10" height="4"/><rect x="{ix - 5}" y="{iy + 12}" width="10" height="4"/></g>')
    s.text(x + w / 2 - 8, y + (h / 2 - (8 if sub else 0)), name, fs, INK, weight='600')
    if sub: s.text(x + w / 2 - 6, y + h / 2 + 14, sub, 12, MUTED)

def component_diagram():
    s = SVG(title='UML component diagram · Closet v1.4', sub='Layered modular monolith. Every request passes the API-tier security pipeline before a module runs. Modules talk only through interfaces or the Event Bus. Solid arrow = request flow, dashed = «use» dependency.')
    # tiers
    tiers = [(30, 'Client'), (230, 'API tier · security pipeline'), (470, 'Application modules (one Node.js process)'), (1150, 'Adapters'), (1370, 'External services')]
    for x, t in tiers: s.text(x, 112, t.upper(), 12.5, ROSE_INK, anchor='start', weight='700')
    comp(s, 30, 140, 170, 120, 'Web App', 1, sub='React 19 · MVC')
    s.text(115, 290, 'views · controller · api.js', 12, MUTED)
    # API pipeline
    pipe = [('API Gateway', 'HTTPS · CORS · CSP · rate limits'), ('Request Validation', 'schemas, 400 errors'), ('Authentication', 'JWT 2 h · IAuthToken'), ('Access Control', 'role + ownership'), ('Audit', 'activity log (v1.3)')]
    for i, (n, sub) in enumerate(pipe):
        y = 140 + i * 104
        comp(s, 230, y, 210, 78, n, 1 if i < 4 else 2, sub=sub, fs=15)
        if i: s.line(335, y - 26, 335, y - 2, INK, 1.6, None, 'arr')
    s.line(200, 200, 228, 180, INK, 1.6, None, 'arr'); s.text(115, 312, 'REST / JSON over HTTPS', 12, MUTED)
    # modules grid
    mods = [('Identity & Auth', 1), ('Profile', 1), ('Wardrobe', 1), ('Availability', 1),
            ('Planner', 1), ('Privacy', 1), ('Recommendation\nEngine', 2), ('Outfits & History', 2),
            ('Closet Intelligence', 3), ('Ask Closet', 3), ('Smart Shopping', 3), ('Admin', 3),
            ('Packing', 4), ('Activity Log', 2), ('Notification Center', 3), ('Event Bus', 1)]
    cw, ch = 158, 82
    for i, (n, sp) in enumerate(mods):
        cx = 470 + (i % 4) * 168; cy = 140 + (i // 4) * 104
        comp(s, cx, cy, cw, ch, n, sp, fs=14.5)
    s.rect(462, 132, 682, 420, 'none', '#b9a99d', 16, 1.2, '8 6')
    s.line(440, 520, 462, 520, INK, 1.6, None, 'arr')
    s.rect(552, 795, 506, 80, '#fff', '#b9a99d', 12, 1.2)
    s.text(805, 815, 'Provided interfaces: IClosetAPI · IAuthToken · IPreferences · IWardrobe', 11.5, INK)
    s.text(805, 835, 'IAvailability · IRecommend · IWeather · IIntentParser · IInsights · IAdminAPI', 11.5, INK)
    s.text(805, 857, 'Events: UserRegistered · ItemCreated · ItemDeleted → Smart Shopping · OutfitWorn · AccountDeleted', 11.5, MUTED)
    # adapters
    ad = [('Weather Adapter', 2, 'Open-Meteo · 30-min cache'), ('Language Model\nAdapter', 3, 'tool call · 8 s · fallback'), ('Calendar Adapter', 2, '.ics import'),
          ('Photo Storage', 1, 'signed URLs · EXIF removed'), ('Try-On Adapter', 4, 'planned'), ('Notification\nAdapter', 4, 'planned · in-app now')]
    for i, (n, sp, sub) in enumerate(ad):
        y = 140 + i * 88
        comp(s, 1160, y, 190, 70, n, sp, sub=sub, fs=14)
    ex = [('Open-Meteo API', 175), ('Anthropic / OpenAI', 263), ('Google / Outlook /\nApple Calendar', 351), ('Photo store (disk → bucket)', 439), ('Virtual Try-On Service', 527), ('Push / e-mail service', 615)]
    for n, y in ex:
        s.rect(1385, y - 26, 190, 52, '#f4f1ee', '#8f857c', 10, 1.2)
        s.text(1480, y, n, 13.5, INK)
        s.line(1350, y, 1383, y, '#8f857c', 1.3, '5 4', 'open')
    s.line(1144, 300, 1158, 300, INK, 1.4, '6 4', 'open')
    # data tier
    s.add(f'<g><ellipse cx="803" cy="655" rx="300" ry="16" fill="#e8f4ec" stroke="{INK}" stroke-width="1.4"/><path d="M503 655 v100 a300 16 0 0 0 600 0 v-100" fill="#e8f4ec" stroke="{INK}" stroke-width="1.4"/></g>')
    s.text(803, 690, 'PostgreSQL  «persist»', 19, INK, weight='700')
    s.text(803, 716, 'one schema per module · every row carries user_id', 13, MUTED)
    s.text(803, 738, 'accounts · profile · wardrobe · availability · planner · outfits', 12, MUTED)
    s.text(803, 756, 'intelligence · activity · packing · shopping · assistant', 12, MUTED)
    s.line(803, 552, 803, 636, INK, 1.4, '6 4', 'open')
    s.legend(40, 650, [1, 2, 3, 4], 13.5)
    s.rect(30, 775, 512, 100, '#fff7f4', ROSE, 12, 1.2)
    s.text(56, 792, 'Authentication & security (instructor feedback)', 13.5, ROSE_INK, anchor='start', weight='700')
    s.text(56, 816, 'bcrypt passwords · lockout after 5 failures · JWT with token version', 12.5, INK, anchor='start')
    s.text(56, 836, '(logout and suspend end sessions) · admin routes require role', 12.5, INK, anchor='start')
    s.text(56, 856, '· another user’s row → 404 · secrets only in environment variables', 12.5, INK, anchor='start')
    s.rect(1072, 790, 510, 85, '#f5f0f8', '#7a5a9c', 12, 1.2)
    s.text(1086, 812, 'Role of the LLM', 13.5, '#6a4b87', anchor='start', weight='700')
    s.text(1086, 836, 'chooses ONE of 14 whitelisted functions, fills its arguments;', 12.5, INK, anchor='start')
    s.text(1086, 858, 'never sees photos or the database · keyword parser if down', 12.5, INK, anchor='start')
    return s.save('D3_component_diagram')

# ---------------------------------------------------------------- D4/D5 ER diagrams
def table(s, x, y, name, cols, sp=1, w=270, hl=None):
    f, st, _ = SPR[sp]
    h = 34 + len(cols) * 22 + 8
    s.rect(x, y, w, h, '#fff', st, 8, 1.6, '6 4' if sp == 4 else None)
    s.add(f'<path d="M{x} {y + 8} a8 8 0 0 1 8 -8 h{w - 16} a8 8 0 0 1 8 8 v26 h-{w} z" fill="{f}" stroke="{st}" stroke-width="1.6"/>')
    s.text(x + 12, y + 17, name, 15, INK, anchor='start', weight='700')
    for i, c in enumerate(cols):
        key = c.startswith('PK') or c.startswith('FK')
        new = hl and c in hl
        s.text(x + 12, y + 46 + i * 22, c, 13, ROSE_INK if new else (INK if key else '#4a4342'), anchor='start', weight='600' if key else 'normal')
    return (x, y, w, h)

def rel_line(s, a, b, label=None, side='r'):
    ax, ay = a; bx, by = b
    mx = (ax + bx) / 2
    s.path(f'M{ax} {ay} H{mx} V{by} H{bx}', '#5a5250', 1.5)
    # crow's foot at b (many)
    d = -1 if bx > ax else 1
    s.line(bx, by, bx + d * 12, by - 8, '#5a5250', 1.5); s.line(bx, by, bx + d * 12, by + 8, '#5a5250', 1.5)
    s.line(ax - d * 0, ay - 7, ax - d * 0, ay + 7, '#5a5250', 1.5)
    if label: s.label(mx, min(ay, by) + abs(by - ay) / 2, label, 11.5, MUTED)

def er_core(s=None):
    own = s is None
    if own: s = SVG(title='ER diagram (1/2) · the closet — Sprint 1 core', sub='PostgreSQL, one schema per module. Every table is owned by one module and carries user_id, so every query is scoped to its owner. 1 ──< many.')
    u = table(s, 40, 120, 'accounts.users', ['PK id UUID', 'email TEXT UNIQUE', 'password_hash TEXT', 'google_id TEXT UNIQUE', 'role user | admin', 'account_status active | suspended', 'token_version INT', 'failed_logins INT · locked_until', 'created_at'], 1, 300)
    p = table(s, 40, 470, 'profile.profiles', ['PK FK user_id', 'styles · colours · occasions TEXT[]', 'dress_code 1–5 · modest BOOL', 'city · display_name', 'laundry_days 1–14 · auto_return', 'laundry_weekday · repeat_days 0–30', 'reminders · reminder_hour', 'avoid_styles TEXT[] (v1.4)'], 1, 300, hl=['avoid_styles TEXT[] (v1.4)'])
    w = table(s, 470, 120, 'wardrobe.items', ['PK id UUID', 'FK user_id', 'name · photo_key', 'category (7) · colour · fabric', 'season · size · styles TEXT[]', 'dress_codes SMALLINT[] (≥1)', 'modest BOOL', 'wear_count · last_worn_at', 'created_at · updated_at'], 1, 300)
    a = table(s, 900, 120, 'availability.item_status', ['PK FK item_id', 'FK user_id', 'status (5 values)', 'changed_at', 'until DATE · note (v1.2)'], 1, 300)
    h = table(s, 900, 330, 'availability.status_history', ['PK id BIGSERIAL', 'FK item_id', 'from_status → to_status', 'changed_at'], 1, 300)
    d = table(s, 470, 500, 'wardrobe.deletions', ['PK id', 'FK user_id', 'name · category · colour', 'wear_count · note · deleted_at', 'reason: 4 values (v1.4)', 'styles · dress_codes · fabric (v1.4)'], 2, 300, hl=['reason: 4 values (v1.4)', 'styles · dress_codes · fabric (v1.4)'])
    e = table(s, 900, 560, 'planner.events', ['PK id UUID', 'FK user_id', 'title · event_date · event_time', 'occasion · dress_code', 'FK planned_outfit_id (v1.2)'], 1, 270)
    rel_line(s, (340, 200), (470, 200), 'owns')
    s.line(190, 352, 190, 470, '#5a5250', 1.5); s.label(230, 410, '1 ── 1', 11.5, MUTED)
    rel_line(s, (770, 200), (900, 200), '1 ── 1 status')
    rel_line(s, (770, 260), (900, 380), 'history')
    rel_line(s, (340, 260), (470, 560), 'deletion reasons')
    s.path('M190 120 V100 H1215 V625 H1170', '#5a5250', 1.5)
    s.line(1170, 625, 1182, 617, '#5a5250', 1.5); s.line(1170, 625, 1182, 633, '#5a5250', 1.5)
    s.label(700, 100, 'user 1 ──< events', 11.5, MUTED)
    s.rect(1240, 120, 335, 400, '#fff7f4', ROSE, 12, 1.2)
    s.text(1254, 145, 'Rules the schema enforces', 15, ROSE_INK, anchor='start', weight='700')
    for i, t in enumerate(['CHECK: 7 categories, 5 statuses,', 'dress codes 1–5, ≥ 1 dress code per piece', 'ON DELETE CASCADE from users →', 'account deletion removes everything', 'status only changes through the', 'Availability state machine (10 moves)', 'deletions keep the reason, never the photo', 'reason ∈ Torn / damaged · No longer my style', '· Became too small · Other (BR-10)', 'photo_key → private storage, signed URL']):
        s.text(1254, 175 + i * 32, t, 13, INK, anchor='start')
    if not own: return s
    s.legend(40, 790, [1, 2], 13.5)
    return s.save('D4_er_core')

def er_intelligence(s=None):
    own = s is None
    if own: s = SVG(title='ER diagram (2/2) · outfits, feedback and Closet Intelligence', sub='Feedback tables feed learning; v1.3 adds learned decisions, read notices, the activity log and packing; v1.4 adds the shopping list (new in rose).')
    o = table(s, 40, 120, 'outfits.outfits', ['PK id UUID', 'FK user_id', 'item_ids UUID[2..4]', 'occasion · style · rule_score', 'reasons TEXT[]', 'source recommended | built | planned', 'favorite BOOL · created_at'], 2, 300)
    wr = table(s, 40, 470, 'outfits.wears', ['PK id BIGSERIAL', 'FK user_id', 'item_ids UUID[] · worn_on', 'rating 1–5', 'occasion (v1.3)', 'temp_c · conditions (v1.3)'], 2, 300, hl=['occasion (v1.3)', 'temp_c · conditions (v1.3)'])
    fb = table(s, 430, 120, 'outfits.feedback', ['PK id', 'FK user_id', 'kind swap | reject', 'item_ids · reason (7)', 'created_at'], 2, 280)
    hi = table(s, 430, 330, 'outfits.hidden_items', ['PK user_id + item_id', 'until TIMESTAMPTZ'], 2, 280)
    le = table(s, 820, 120, 'intelligence.learned', ['PK user_id + key', 'state confirmed | dismissed', 'previous JSONB (exact undo)', 'decided_at'], 3, 300)
    nr = table(s, 820, 320, 'intelligence.notifications_read', ['PK user_id + key', 'read_at'], 3, 300)
    ac = table(s, 820, 470, 'activity.log', ['PK id BIGSERIAL', 'FK user_id', 'action · detail', 'at (indexed)'], 2, 300)
    tr = table(s, 430, 520, 'packing.trips', ['PK id UUID', 'FK user_id', 'destination · start_date · end_date', 'trip_type · activities[]', 'item_ids UUID[] · plan JSONB', 'packed BOOL'], 4, 320)
    sd = table(s, 1220, 120, 'shopping.decisions', ['PK user_id + key', 'state saved | dismissed | bought'], 3, 330)
    aa = table(s, 1220, 260, 'assistant.actions', ['PK id UUID', 'FK user_id', 'function (14 whitelisted)', 'undo JSONB · undone'], 3, 330)
    sl = table(s, 1220, 430, 'shopping.list_items (v1.4)', ['PK id UUID', 'FK user_id', 'title · category · colour', 'source ask | replacement | gap |', '  suggestion | manual', 'reason · replaces · suggestion_key', 'status to_buy | bought · created_at'], 3, 330, hl=['source ask | replacement | gap |', '  suggestion | manual', 'reason · replaces · suggestion_key'])
    s.rect(1220, 690, 350, 190, '#f5f0f8', '#7a5a9c', 12, 1.2)
    s.text(1236, 714, 'How the data closes the loop', 15, '#6a4b87', anchor='start', weight='700')
    for i, t in enumerate(['wears + feedback + favourites + deletions', '→ patterns (evidence, confidence)', '→ user confirms → profile (previous kept)', '→ next looks rank differently', 'All tables: ON DELETE CASCADE (US-06).']):
        s.text(1236, 744 + i * 28, t, 13.5, INK, anchor='start')
    s.text(330, 885, 'item_ids reference wardrobe.items (array of ids, checked by the Outfits service on write)', 13, MUTED, anchor='start')
    s.line(340, 270, 430, 270, '#5a5250', 1.3, '4 4'); s.label(385, 256, 'reacts to', 11.5, MUTED)
    s.line(190, 302, 190, 470, '#5a5250', 1.3, '4 4'); s.label(240, 390, 'Wear this', 11.5, MUTED)
    s.line(710, 220, 820, 220, '#5a5250', 1.3, '4 4'); s.label(765, 205, 'evidence', 11.5, MUTED)
    s.path('M340 520 H380 V100 H970 V120', '#5a5250', 1.3, '4 4'); s.label(660, 100, 'wear history + favourites → evidence', 11.5, MUTED)
    if not own: return s
    s.legend(40, 780, [2, 3, 4], 13.5)
    return s.save('D5_er_intelligence')

class Shift:
    """Draws onto another canvas, moved down by dy (used to put both ER halves on one sheet)."""
    def __init__(self, s, dy): self.s, self.dy = s, dy
    def add(self, x):
        self.s.o.append(f'<g transform="translate(0,{self.dy})">{x}</g>')
    def __getattr__(self, n):
        f = getattr(SVG, n)
        def call(*a, **k):
            start = len(self.s.o); f(self.s, *a, **k); part = ''.join(self.s.o[start:]); del self.s.o[start:]
            self.add(part)
        return call

def er_full():
    s = SVG(1600, 1860, 'ER diagram · the complete Closet database', 'PostgreSQL 16, one schema per module (migrations 001 – 005). Every table carries user_id → accounts.users (ON DELETE CASCADE). 1 ──< many; rose text = added in v1.3 / v1.4.')
    er_core(s)
    s.rect(30, 905, 1540, 2, '#e2d8d0', '#e2d8d0', 0, 0)
    s.text(40, 935, 'Outfits, feedback, Closet Intelligence, shopping and packing', 17, MUTED, anchor='start', weight='600')
    er_intelligence(Shift(s, 850))
    s.path('M40 160 H18 V1410 H40', '#9c5f5b', 1.6, '6 4', 'arrR'); s.add('<text transform="translate(12 800) rotate(-90)" text-anchor="middle" font-size="12" fill="#9c5f5b">user_id → every table</text>')
    s.path('M470 340 H440 V860 H190 V970', '#5a5250', 1.3, '4 4', 'arr'); s.label(330, 845, 'wardrobe.items ← item_ids of outfits, wears, feedback, trips', 11.5, MUTED)
    s.legend(40, 1755, [1, 2, 3, 4], 13.5)
    return s.save('ER_complete')

# ---------------------------------------------------------------- D6 class diagram
def klass(s, x, y, w, name, attrs, ops, sp=1, stereo=None):
    f, st, _ = SPR[sp]
    hh = 30 + (16 if stereo else 0)
    h = hh + len(attrs) * 19 + 10 + len(ops) * 19 + 10
    s.rect(x, y, w, h, '#fff', st, 6, 1.6, '6 4' if sp == 4 else None)
    s.rect(x, y, w, hh, f, st, 6, 1.6)
    if stereo: s.text(x + w / 2, y + 12, f'«{stereo}»', 11.5, MUTED)
    s.text(x + w / 2, y + hh - 14, name, 15, INK, weight='700')
    yy = y + hh + 16
    for a in attrs: s.text(x + 10, yy, a, 12.5, '#3d3634', anchor='start'); yy += 19
    s.line(x, yy - 8, x + w, yy - 8, st, 1)
    yy += 8
    for o in ops: s.text(x + 10, yy, o, 12.5, INK, anchor='start'); yy += 19
    return (x, y, w, h)

def class_diagram():
    s = SVG(title='Class diagram · key classes (lower-level design)', sub='Each module = Router → Service → Repository (Repository pattern). The engine is Pipe & Filter with a Strategy scorer; adapters hide external services.')
    gw = klass(s, 40, 110, 300, 'ApiGateway', ['- pipeline: Middleware[]'], ['+ securityPipeline(app)', '+ validate(schema)', '+ authenticate(IAuthToken)', '+ requireRole(role)', '+ audit(ActivityService)'], 1, 'facade')
    ids = klass(s, 40, 380, 300, 'IdentityService', ['- repo: IdentityRepository', '- bus: EventBus'], ['+ register(email, pw): Session', '+ login(email, pw): Session', '+ verifySession(token): User', '+ logout(userId)'], 1, 'service')
    wd = klass(s, 400, 110, 320, 'WardrobeService', ['- repo: WardrobeRepository', '- storage: PhotoStorage'], ['+ add(userId, photo, details): Piece', '+ list(userId, filters): Piece[]', '+ edit(userId, id, changes)', '+ remove(userId, id, reason)', '+ gaps(userId): Gaps'], 1, 'service')
    av = klass(s, 400, 420, 320, 'AvailabilityService', ['- repo: StatusRepository', '- machine: StatusMachine'], ['+ setStatus(userId, id, to, until, note)', '+ washDone(userId): Result', '+ sweep(userId)  // auto-return', '+ infoMap(userId)'], 1, 'service')
    sm = klass(s, 400, 690, 320, 'StatusMachine', ['+ ALLOWED: Map<Status, Status[]>'], ['+ canMove(from, to): bool'], 1)
    en = klass(s, 780, 110, 330, 'RecommendationEngine', ['- scorer: Scorer  «Strategy»'], ['+ filterPieces(pieces, ctx)', '+ combine(pool, ctx)', '+ criteria(outfit) / ruleScore()', '+ breakdown(outfit): Parts', '+ why(outfit, ctx): Factor[]', '+ recommend(pieces, opts): Outfit[3]'], 2, 'pipe & filter')
    it = klass(s, 780, 470, 330, 'IntelligenceService', ['- wardrobe, outfits, profile, planner'], ['+ health(userId): WardrobeHealth', '+ learned(userId): Pattern[]', '+ decide(userId, key, decision)', '+ undo(userId, key)', '+ conflicts(userId): Conflict[]', '+ notifications(userId)'], 3, 'service')
    ad = klass(s, 1170, 110, 380, 'LanguageModelAdapter', ['- provider: anthropic | openai | none', '- timeoutMs = 8000'], ['+ parse(message): {fn, args}', '  // falls back to KeywordParser'], 3, 'adapter')
    wa = klass(s, 1170, 330, 380, 'WeatherAdapter', ['- cache: Map (30 min)'], ['+ forDate(city, date): Weather', '  // seasonal estimate on failure'], 2, 'adapter')
    bus = klass(s, 1170, 520, 380, 'EventBus', ['- handlers: Map<topic, fn[]>'], ['+ subscribe(topic, handler)', '+ publish(topic, payload)'], 1, 'observer')
    rp = klass(s, 40, 680, 300, 'Repository (per module)', ['- db: Pool'], ['+ queries always filter user_id'], 1, 'repository')
    sh = klass(s, 780, 700, 330, 'ShoppingService', ['- wardrobe, profile (interfaces)'], ['+ list(userId) / addToList(item)', '+ onDeleted(userId, deletion)', '+ suggestions(userId)  // gaps, basics', '+ check(userId, piece)  // do I need it?'], 3, 'service')
    dp = klass(s, 1170, 665, 380, 'DeletionPolicy', ['+ EFFECTS: reason → effect (4)'], ['+ replacementFor(deletion): Item | null', '+ isAvoided(deletions, piece): bool', '+ letGoStyles(deletions): Style[]'], 3, 'rules')
    # relations (anchored to the real box edges)
    bot = lambda r: r[1] + r[3]
    s.line(190, bot(gw), 190, ids[1] - 2, INK, 1.4, None, 'open'); s.label(230, (bot(gw) + ids[1]) / 2, 'uses', 12, MUTED)
    s.line(340, gw[1] + 110, 398, gw[1] + 110, INK, 1.4, None, 'open'); s.label(369, gw[1] + 96, 'routes', 11.5, MUTED)
    s.line(560, bot(wd), 560, av[1] - 2, INK, 1.4, '6 4', 'open'); s.label(625, (bot(wd) + av[1]) / 2, 'IAvailability', 12, MUTED)
    s.line(560, bot(av), 560, sm[1] - 2, INK, 1.4, None, 'open')
    s.line(720, wd[1] + 110, 778, wd[1] + 110, INK, 1.4, '6 4', 'open'); s.label(749, wd[1] + 96, 'IWardrobe', 11.5, MUTED)
    s.line(945, bot(en), 945, it[1] - 2, INK, 1.4, '6 4', 'open'); s.label(1000, (bot(en) + it[1]) / 2, 'IRecommend', 12, MUTED)
    s.line(1110, bot(en) - 30, 1168, wa[1] + 40, INK, 1.4, '6 4', 'open'); s.label(1140, (bot(en) + wa[1]) / 2 + 2, 'IWeather', 11.5, MUTED)
    s.line(1110, it[1] + 140, 1168, bus[1] + 50, INK, 1.4, '6 4', 'open'); s.label(1140, (it[1] + bus[1]) / 2 + 92, 'events', 11.5, MUTED)
    s.line(1110, en[1] + 60, 1168, ad[1] + 60, INK, 1.4, '6 4', 'open'); s.label(1140, en[1] + 46, 'IIntentParser', 11.5, MUTED)
    s.line(190, bot(ids), 190, rp[1] - 2, INK, 1.4, None, 'open')
    s.line(1170, bus[1] + 100, 1112, sh[1] + 30, INK, 1.4, '6 4', 'open'); s.label(1128, bus[1] + 150, 'ItemDeleted', 11.5, MUTED)
    s.line(1110, sh[1] + 100, 1168, dp[1] + 60, INK, 1.4, '6 4', 'open'); s.label(1140, sh[1] + 64, 'uses', 11.5, MUTED)
    s.legend(400, 815, [1, 2, 3], 13.5)
    return s.save('D6_class_diagram')

# ---------------------------------------------------------------- sequence diagrams
def sequence(name, title, sub, parts, steps, colw=None, fname=None):
    s = SVG(title=title, sub=sub)
    n = len(parts); colw = colw or (1520 / n)
    X = {}
    top = 120
    for i, (k, label, kind) in enumerate(parts):
        x = 40 + colw * i + colw / 2; X[k] = x
        fill = {'actor': PAPER, 'ui': '#fbeef0', 'gw': '#f4ecee', 'svc': '#efe8f3', 'db': '#e8f4ec', 'ext': '#f4f1ee'}[kind]
        s.line(x, top + 60, x, 870, '#b9a99d', 1.3, '6 5')
        if kind == 'actor':
            s.actor(x, top + 14, label, 15)
        else:
            s.rect(x - colw / 2 + 10, top, colw - 20, 58, fill, '#5a5250', 8, 1.4)
            s.text(x, top + 29, label, 14.5, INK, weight='600')
    y = top + 100
    for st in steps:
        kind = st[0]
        if kind == 'frame':
            _, a, b, lab, hgt = st
            x1, x2 = X[a] - colw / 2 + 14, X[b] + colw / 2 - 14
            s.rect(x1, y - 14, x2 - x1, hgt, 'none', ROSE, 4, 1.4)
            s.rect(x1, y - 14, len(lab) * 8 + 16, 22, '#fbeef0', ROSE, 3, 1.2)
            s.text(x1 + 8, y - 3, lab, 12.5, ROSE_INK, anchor='start', weight='700')
            y += 26; continue
        if kind == 'note':
            _, a, txt = st
            s.rect(X[a] - 150, y - 12, 300, 30, '#fff7d9', '#c9b46a', 4, 1)
            s.text(X[a], y + 3, txt, 12.5, INK); y += 40; continue
        _, a, b, msg = st[:4]
        ret = kind in ('ret', 'planned')
        if a == b:
            s.path(f'M{X[a]} {y} h40 v22 h-38', INK, 1.4, None, 'arr'); s.text(X[a] + 50, y + 11, msg, 13, INK, anchor='start'); y += 50; continue
        s.line(X[a], y, X[b] - (6 if X[b] > X[a] else -6), y, INK if not ret else '#6d6462', 1.5, '6 4' if ret else None, 'open' if ret else 'arr')
        s.label((X[a] + X[b]) / 2, y - 12, msg, 13, INK if not ret else '#6d6462')
        y += 42
    return s.save(fname or name)

def seq_add():
    parts = [('u', 'Salma', 'actor'), ('ui', 'Web App\n(React)', 'ui'), ('gw', 'API Gateway\n+ pipeline', 'gw'), ('w', 'Wardrobe\nService', 'svc'), ('st', 'Photo\nStorage', 'svc'), ('r', 'Wardrobe\nRepository', 'svc'), ('b', 'Event Bus →\nAvailability', 'svc'), ('db', 'PostgreSQL', 'db')]
    steps = [('msg', 'u', 'ui', 'photo + details → Save'), ('msg', 'ui', 'gw', 'POST /api/v1/items (multipart, Bearer JWT)'),
             ('frame', 'gw', 'w', 'pipeline (every request)', 112),
             ('self', 'gw', 'gw', 'HTTPS · CSP · rate limit'), ('self', 'gw', 'gw', 'validate · verify JWT · role'),
             ('msg', 'gw', 'w', 'add(userId, photo, details)'), ('msg', 'w', 'st', 'check type from bytes, strip EXIF, save'), ('ret', 'st', 'w', 'photo_key'),
             ('msg', 'w', 'r', 'insert(piece, user_id)'), ('msg', 'r', 'db', 'INSERT wardrobe.items'), ('ret', 'db', 'r', 'row'),
             ('msg', 'w', 'b', 'publish ItemCreated'), ('msg', 'b', 'db', 'INSERT item_status = Available'),
             ('ret', 'w', 'gw', 'Piece (signed photo URL)'), ('ret', 'gw', 'ui', '201 Created  (audit: “Piece added”)'), ('ret', 'ui', 'u', 'piece appears in the closet')]
    steps = [('msg',) + x[1:] if x[0] == 'self' else x for x in steps]
    return sequence('seq', 'Sequence · “What happens when Salma clicks Add?” (US-08, Sprint 1)', 'The real code path: security pipeline → service → storage → repository → event bus. Every query carries user_id.', parts, steps, fname='D7_sequence_add_piece')

def seq_conflict():
    parts = [('u', 'Habiba', 'actor'), ('ui', 'Web App', 'ui'), ('av', 'Availability', 'svc'), ('pl', 'Planner', 'svc'), ('it', 'Closet\nIntelligence', 'svc'), ('rec', 'Recommendation\nEngine', 'svc'), ('db', 'PostgreSQL', 'db')]
    steps = [('msg', 'u', 'ui', 'Navy blazer → In laundry'), ('msg', 'ui', 'av', 'PATCH /items/:id/status {Laundry}'), ('msg', 'av', 'db', 'canMove(Available→Laundry) · UPDATE'), ('ret', 'av', 'ui', '200 · back in 2 days'),
             ('msg', 'ui', 'it', 'GET /intelligence/conflicts'), ('msg', 'it', 'pl', 'upcoming events with planned outfits'), ('ret', 'pl', 'it', 'SE presentation · tomorrow'),
             ('frame', 'it', 'rec', 'loop: each planned piece not back by the event date', 104),
             ('msg', 'it', 'rec', 'swap(outfit, slot, occasion, date)'), ('ret', 'rec', 'it', 'best Available replacement'),
             ('ret', 'it', 'ui', 'conflict + “Use beige trench coat”'), ('msg', 'u', 'ui', 'Replace'), ('msg', 'ui', 'it', 'POST /conflicts/:event/fix'), ('msg', 'it', 'pl', 'plan(event, new outfit)'), ('ret', 'it', 'ui', 'event re-planned · notice cleared')]
    return sequence('seq2', 'Sequence · conflict detection (US-79, Sprint 2 preview)', 'The “magic moment”: one status change in Availability is detected by Intelligence through the Planner and fixed with the Recommendation Engine.', parts, steps, fname='D8_sequence_conflict')

# ---------------------------------------------------------------- D9 state machine
def state_diagram():
    s = SVG(title='State machine · item status (US-56)', sub='Exactly one status per piece. 10 allowed moves; any other move is refused with 409. Only Available pieces are ever used in an outfit.')
    st = {'Available': (800, 450, '#e4f0e8', '#4f8a66'), 'Laundry': (800, 175, '#e5ecf3', '#3e5d80'), 'Borrowed': (1250, 450, '#f8ecdc', '#b77a33'),
          'Packed': (800, 740, '#eee7f2', '#7a5a9c'), 'Unavailable': (350, 450, '#f7e3e1', '#b55450')}
    W, H = 220, 84
    for n, (x, y, f, c) in st.items():
        s.rect(x - W / 2, y - H / 2, W, H, f, c, 40, 2.2)
        s.text(x, y - 8, n, 22, INK, weight='700', family='Lora, Georgia, serif')
        s.text(x, y + 20, {'Available': 'in outfits ✓', 'Laundry': 'basket time 1–14 d', 'Borrowed': 'return date + note', 'Packed': 'trip / return date', 'Unavailable': 'repair · tailor'}[n], 13, MUTED)
    s.add('<circle cx="560" cy="300" r="12" fill="#2a2626"/>'); s.line(570, 308, 690, 410, INK, 1.6, None, 'arr'); s.label(610, 350, 'ItemCreated', 12.5, MUTED)
    def arc(a, b, label, off, lx=0, ly=0):
        (x1, y1, *_), (x2, y2, *_) = st[a], st[b]
        dx, dy = x2 - x1, y2 - y1; L = math.hypot(dx, dy); nx, ny = -dy / L, dx / L
        sx, sy = x1 + dx * .24 + nx * off, y1 + dy * .24 + ny * off
        ex, ey = x1 + dx * .74 + nx * off, y1 + dy * .74 + ny * off
        s.line(sx, sy, ex, ey, INK, 1.8, None, 'arr')
        s.label((sx + ex) / 2 + nx * 16 + lx, (sy + ey) / 2 + ny * 16 + ly, label, 13.5, INK)
    arc('Available', 'Laundry', 'In laundry', -22, -50, 0); arc('Laundry', 'Available', 'Wash done · auto-return', -22, 90, 0)
    arc('Available', 'Borrowed', 'Lend', -20, 0, -6); arc('Borrowed', 'Available', 'Returned', -20, 0, 6)
    arc('Available', 'Packed', 'Pack (Packing Mode)', 22, -120, 0); arc('Packed', 'Available', 'Unpack', 22, 70, 0)
    arc('Available', 'Unavailable', 'Unavailable', 20, 0, 6); arc('Unavailable', 'Available', 'Ready again', 20, 0, -6)
    s.path('M1250 408 C1250 250 1050 175 912 175', INK, 1.8, None, 'arr'); s.label(1150, 230, 'Came back dirty', 13.5)
    s.path('M690 745 C-80 760 -80 175 688 175', INK, 1.8, None, 'arr'); s.label(160, 640, 'Came back dirty', 13.5)
    s.rect(1080, 640, 480, 200, '#fff7f4', ROSE, 12, 1.2)
    s.text(1096, 664, 'Rules', 15, ROSE_INK, anchor='start', weight='700')
    for i, t in enumerate(['A piece in the laundry cannot be lent or packed.', 'Borrowed / Packed may return straight to Laundry.', 'Every move writes availability.status_history.', 'A planned piece that is away → conflict (US-79).', 'Tests: ST-01 – ST-04, API-S01 – S06, API-L01 – L03, AT-10 – AT-12.']):
        s.text(1096, 694 + i * 28, t, 13.5, INK, anchor='start')
    return s.save('D9_state_machine')

# ---------------------------------------------------------------- D10 product loop
def product_loop():
    s = SVG(title='Why Closet is more than an outfit generator', sub='Six kinds of context → Closet Intelligence → three outcomes; the feedback loop makes every recommendation better than the last.')
    ins = ['My wardrobe', 'My style', 'My weather', 'My calendar', 'My history', 'My feedback']
    for i, t in enumerate(ins):
        x = 120 + i * 230
        s.rect(x - 95, 120, 190, 64, '#fff', ROSE, 32, 1.8); s.text(x, 152, t, 18, INK, weight='600')
        s.line(x, 186, 800, 300, '#c9b5ad', 1.4, None, 'arr')
    s.rect(560, 300, 480, 100, '#2a2626', '#2a2626', 50, 0); s.text(800, 340, 'CLOSET INTELLIGENCE', 22, '#fff', weight='700'); s.text(800, 370, 'rules + engine + learned preferences', 14, '#e9c9c4')
    outs = ['Better outfits', 'Smarter shopping', 'Better utilisation']
    for i, t in enumerate(outs):
        x = 360 + i * 440
        s.line(800, 402, x, 470, '#c9b5ad', 1.4, None, 'arr'); s.rect(x - 140, 470, 280, 60, '#e4f0e8', '#4f8a66', 30, 1.8); s.text(x, 500, t, 18, INK, weight='600')
    loop = ['Wardrobe', 'Context', 'Recommendation', 'Feedback', 'Learning', 'Better recommendation']
    cx, cy, R = 800, 735, 115
    s.text(260, 620, 'THE LEARNING LOOP', 14, ROSE_INK, anchor='start', weight='700')
    for i, t in enumerate(loop):
        x = 170 + i * 254
        s.rect(x - 105, 680, 210, 56, '#fbeef0' if i not in (3, 4) else '#eee7f2', ROSE if i not in (3, 4) else '#7a5a9c', 28, 1.6); s.text(x, 708, t, 16, INK, weight='600')
        if i < 5: s.line(x + 106, 708, x + 146, 708, INK, 1.8, None, 'arr')
    s.path('M1440 738 C1440 840 170 840 170 740', ROSE_INK, 1.8, '7 5', 'arrR'); s.label(800, 825, 'every Wear, rating, rejection, favourite and swap is stored as feedback (US-37)', 13.5, ROSE_INK)
    return s.save('D10_product_loop')

# ---------------------------------------------------------------- D11 deployment + CI
def deployment():
    s = SVG(title='Deployment and testing architecture', sub='One deployable (Node.js serves the API and the built React app), one database, CI on every pull request.')
    s.rect(60, 130, 330, 180, '#fbeef0', ROSE, 14, 1.6); s.text(225, 160, '«device» Phone / laptop browser', 15, INK, weight='700'); s.text(225, 210, 'React 19 SPA', 16, INK); s.text(225, 240, 'session token in sessionStorage', 13, MUTED)
    s.rect(520, 110, 520, 330, '#fff', INK, 14, 1.6); s.text(780, 140, '«node» Render web service · Node 22', 15, INK, weight='700')
    s.rect(550, 170, 460, 70, '#e4f0e8', '#4f8a66', 10, 1.4); s.text(780, 205, 'Express API · /api/v1 · security pipeline', 15, INK)
    s.rect(550, 255, 460, 70, '#f8ecdc', '#b77a33', 10, 1.4); s.text(780, 290, 'Static web app (client/dist)', 15, INK)
    s.rect(550, 340, 460, 70, '#eee7f2', '#7a5a9c', 10, 1.4); s.text(780, 375, 'Env secrets: JWT, DB URL, LLM key, photo secret', 14, INK)
    s.rect(1160, 130, 380, 150, '#e8f4ec', INK, 14, 1.6); s.text(1350, 165, '«database» PostgreSQL 16', 15, INK, weight='700'); s.text(1350, 210, '11 schemas · migrations 001–005', 14, INK); s.text(1350, 240, 'seed: npm run seed (demo reset)', 13, MUTED)
    s.rect(1160, 310, 380, 110, '#f4f1ee', '#8f857c', 14, 1.4); s.text(1350, 345, 'External: Open-Meteo, LLM API', 14, INK); s.text(1350, 375, 'calendar .ics · photo store', 13, MUTED)
    s.line(392, 220, 518, 220, INK, 1.6, None, 'arr'); s.label(455, 204, 'HTTPS', 12.5, MUTED)
    s.line(1040, 205, 1158, 205, INK, 1.6, None, 'arr'); s.label(1100, 190, 'pg (TLS)', 12.5, MUTED)
    s.line(1040, 365, 1158, 365, '#8f857c', 1.4, '5 4', 'open')
    # CI
    s.text(60, 520, 'CONTINUOUS INTEGRATION · GitHub Actions on every pull request', 14, ROSE_INK, anchor='start', weight='700')
    steps = [('git push / PR', '#fff'), ('install +\nmigrate', '#fff'), ('unit tests', '#e4f0e8'), ('API tests\n(Supertest)', '#e4f0e8'), ('acceptance\ntests', '#e4f0e8'), ('coverage\nreport', '#eee7f2'), ('build web app\n+ seed demo', '#fff'), ('browser journey\n(Playwright)', '#f8ecdc')]
    for i, (t, f) in enumerate(steps):
        x = 60 + i * 188
        s.rect(x, 560, 168, 84, f, INK, 12, 1.4, '6 4' if i == 7 else None); s.text(x + 84, 602, t, 15, INK, weight='600')
        if i < 7: s.line(x + 170, 602, x + 186, 602, INK, 1.6, None, 'arr')
    s.text(60, 700, 'Jobs: server (unit, API, acceptance, coverage) · client (build) · e2e (the live-demo route in Chromium, screenshot per step, fails on any browser error).', 15, INK, anchor='start')
    s.text(60, 730, 'The e2e job (dashed) was added in the final pass; it has been run locally (evidence in the test report) and runs in CI from the next push.', 14, MUTED, anchor='start')
    return s.save('D11_deployment_ci')

# ---------------------------------------------------------------- D12 core flow (activity)
def node(s, x, y, w, h, title, sub, sp, rx=16):
    f, st, _ = SPR[sp]
    s.rect(x - w / 2, y - h / 2, w, h, f, st, rx, 1.9, '6 4' if sp == 4 else None)
    s.text(x, y - (12 if sub else 0), title, 17, INK, weight='700')
    if sub: s.text(x, y + 16, sub, 12.5, '#4a4342')

def core_flow():
    s = SVG(title='The heart of Closet · recommend → change → try on → feedback → learning', sub='UML activity view of UC-09 / UC-12 / UC-22. Colour = the sprint that delivers each step (all built early as labelled previews).')
    Y1, W, H = 240, 250, 112
    xs = [205, 495, 785, 1075, 1390]
    node(s, xs[0], Y1, W, H, 'Choose the occasion', 'one-tap template · day · style', 2)
    node(s, xs[1], Y1, W, H, 'Engine: filter → combine', 'Available only · weather · dress code\nmodest · recycle time', 2)
    node(s, xs[2], Y1, W, H, 'Three looks', 'pieces · name · occasion · style\nweather · “Recommended because …”', 2)
    node(s, xs[3], Y1, W, H, 'Change a piece', 'one slot swapped · the rest stays\nrule check runs again', 2)
    node(s, xs[4], Y1, 290, H, 'Virtual try-on', 'dressing room · avatar (simulated)\nflip between the three looks', 3)
    s.add('<circle cx="40" cy="240" r="13" fill="#2a2626"/>'); s.line(53, 240, xs[0] - W / 2 - 2, 240, INK, 1.8, None, 'arr')
    for a, b in zip(xs, xs[1:]):
        s.line(a + W / 2 + 2, Y1, b - (145 if b == xs[4] else W / 2) - 4, Y1, INK, 1.8, None, 'arr')
    s.path(f'M{xs[3]} {Y1 - H / 2} C{xs[3]} 120 {xs[2]} 120 {xs[2]} {Y1 - H / 2 - 4}', ROSE_INK, 1.8, '7 5', 'arrR'); s.label((xs[2] + xs[3]) / 2, 136, 'swap again', 13, ROSE_INK)
    s.path(f'M{xs[4] - 60} {Y1 - H / 2} C{xs[4] - 60} 120 {xs[3] + 60} 120 {xs[3] + 60} {Y1 - H / 2 - 4}', ROSE_INK, 1.8, '7 5', 'arrR'); s.label((xs[3] + xs[4]) / 2 + 20, 136, 'back · change a piece', 13, ROSE_INK)
    # decision
    dx, dy = xs[4], 420
    s.add(f'<path d="M{dx} {dy - 46} L{dx + 70} {dy} L{dx} {dy + 46} L{dx - 70} {dy} Z" fill="#fff" stroke="{INK}" stroke-width="1.8"/>'); s.text(dx, dy, 'decide', 15, INK, weight='600')
    s.line(dx, Y1 + H / 2 + 2, dx, dy - 48, INK, 1.8, None, 'arr')
    acts = [(1390, 'Wear this', 'wear count +1 · last worn\noccasion + weather kept', 2), (1075, 'Rate 1 – 5', 'after wearing\n“wouldn’t repeat” = never again', 3), (785, 'Save · Favourite', 'lookbook · favourites\nraise similar pieces', 2), (495, 'Reject + reason', '7 reasons · “not in the mood”\nhides for a week', 2)]
    for x, t, sub, sp in acts:
        node(s, x, 600, 260 if x != 1390 else 290, 104, t, sub, sp)
    s.line(dx, dy + 48, 1390, 546, INK, 1.8, None, 'arr')
    s.path(f'M{dx - 70} {dy} H1075 V546', INK, 1.8, None, 'arr'); s.path(f'M{dx - 70} {dy} H785 V546', INK, 1.8, None, 'arr'); s.path(f'M{dx - 70} {dy} H495 V546', INK, 1.8, None, 'arr')
    s.line(1390 - 145, 600, 1075 + 132, 600, '#8f857c', 1.4, '5 4', 'open')
    # feedback bar
    s.rect(330, 700, 1200, 54, '#2a2626', '#2a2626', 27, 0); s.text(930, 727, 'FEEDBACK STORED · wears · ratings · favourites · swaps · rejections with a reason (US-37)', 16, '#fff', weight='600')
    for x in (495, 785, 1075, 1390): s.line(x, 652, x, 698, INK, 1.6, None, 'arr')
    node(s, 150, 727, 250, 104, 'Closet has learned', 'pattern + evidence + confidence\nconfirm · not accurate · undo', 3)
    s.line(330, 727, 277, 727, INK, 1.8, None, 'arr')
    s.path('M150 675 V440 H495 V298', ROSE_INK, 2, '8 5', 'arrR'); s.label(320, 424, 'ranks the next three looks', 13.5, ROSE_INK)
    s.rect(330, 790, 1200, 70, '#fff7f4', ROSE, 12, 1.2)
    s.text(350, 815, 'Requirements: FR-27 – FR-35, FR-42 – FR-50, FR-75, FR-76 · Use cases: UC-09, UC-12, UC-22 · Stories: US-19, US-24, US-27, US-26, US-23, US-62, US-60, US-40', 13.5, INK, anchor='start')
    s.text(350, 840, 'Tests: API-R01 – R06, API-CF01 – CF02, API-O01 – O03, EX-01 – EX-06, LR-01 – LR-05, browser journey steps 39 – 42b', 13.5, MUTED, anchor='start')
    s.legend(40, 810, [2, 3], 13)
    return s.save('D12_core_flow')

# ---------------------------------------------------------------- D13 deletion-reason logic (activity with decisions)
def deletion_logic():
    s = SVG(title='Delete a piece · the reason drives shopping and learning', sub='US-13 (Sprint 2) + US-33 / US-34 / US-36 (Sprint 3), built early. One rule table (BR-10, DeletionPolicy) decides every effect.')
    node(s, 200, 200, 300, 96, 'Delete clothing item', 'from the piece page · UC-05', 2)
    node(s, 200, 360, 300, 108, 'Choose a reason (required)', 'Torn / damaged · No longer my style\nBecame too small · Other', 2)
    s.line(200, 250, 200, 304, INK, 1.8, None, 'arr')
    node(s, 200, 540, 300, 108, 'Piece + photo deleted', 'reason, category, colour, styles kept\nwardrobe.deletions · activity log', 1 if False else 2)
    s.line(200, 416, 200, 484, INK, 1.8, None, 'arr')
    s.line(352, 540, 440, 540, INK, 1.8, None, 'arr'); s.label(396, 524, 'ItemDeleted', 12.5, MUTED)
    dx, dy = 530, 540
    s.add(f'<path d="M{dx} {dy - 54} L{dx + 88} {dy} L{dx} {dy + 54} L{dx - 88} {dy} Z" fill="#fff" stroke="{INK}" stroke-width="1.8"/>'); s.text(dx, dy, 'reason?', 16, INK, weight='600')
    rows = [(170, 'Torn / damaged', 'Replacement on the shopping list', 'same category and colour · tag “Replacement”', '#f5e6e3', ROSE_INK),
            (330, 'Became too small', 'Replacement in the next size', 'on the shopping list · “Replacement”', '#f5e6e3', ROSE_INK),
            (490, 'No longer my style', 'Never a replacement · never suggested', 'category + colour avoided · buy check “Think twice”', '#eee7f2', '#6a4b87'),
            (630, 'Other', 'Reason recorded only', 'no shopping or profile change', '#f4f1ee', '#7d736f')]
    for y, reason, t1, t2, fill, col in rows:
        s.path(f'M{dx + 88} {dy} H700 V{y} H760', col, 1.8, None, 'arr')
        s.label(700, y - 16, reason, 13.5, col)
        s.rect(762, y - 46, 420, 92, fill, col, 14, 1.8); s.text(972, y - 12, t1, 16.5, INK, weight='700'); s.text(972, y + 16, t2, 13, '#4a4342')
    # learning branch
    s.line(1184, 490, 1240, 490, '#6a4b87', 1.8, None, 'arr')
    s.rect(1242, 430, 330, 120, '#eee7f2', '#6a4b87', 14, 1.8)
    s.text(1407, 460, '≥ 2 let go share a style?', 15, INK, weight='700'); s.text(1407, 488, '→ “Closet has learned” card', 13.5, INK); s.text(1407, 512, 'confirm → avoid style, rank lower', 13.5, INK); s.text(1407, 534, 'Undo restores the profile exactly', 12.5, MUTED)
    s.line(1184, 170, 1240, 170, ROSE_INK, 1.8, None, 'arr'); s.line(1184, 330, 1240, 330, ROSE_INK, 1.8, None, 'arr')
    s.rect(1242, 120, 330, 250, '#fff', ROSE, 14, 1.8)
    s.text(1407, 150, 'Shopping bag', 17, INK, weight='700', family='Lora, Georgia, serif')
    for i, t in enumerate(['sources: Ask Closet · Replacement', 'Wardrobe gap · Smart suggestion', '“You already own a similar item”', 'mark bought · remove', 'Ask Closet: “add a replacement', 'for my torn loafers”']):
        s.text(1407, 184 + i * 28, t, 13.5, INK)
    s.rect(40, 720, 1530, 150, '#fff7f4', ROSE, 12, 1.2)
    s.text(60, 746, 'Requirements', 15, ROSE_INK, anchor='start', weight='700')
    for i, t in enumerate(['FR-15 a deletion reason is required (4 values) · FR-71 reasons update shopping and personalisation (BR-10)', 'FR-72 replacement for Torn / damaged, next size for Became too small · FR-58 never treat “No longer my style” as a replacement',
                           'FR-73 two or more let go with a shared style → learned pattern (confirm / undo) · FR-61 shopping list with sources · FR-74 add to the list through Ask Closet',
                           'Tests: DR-01 – DR-06, API-DR01 – DR05, API-SL01 – SL05, API-SH02, API-DL01 – DL03 · journey steps 47 – 48']):
        s.text(60, 774 + i * 25, t, 13.5, INK if i < 3 else MUTED, anchor='start')
    return s.save('D13_deletion_logic')

def seq_delete():
    parts = [('u', 'Habiba', 'actor'), ('ui', 'Web App', 'ui'), ('gw', 'API Gateway\n+ pipeline', 'gw'), ('w', 'Wardrobe\nService', 'svc'), ('b', 'Event Bus', 'svc'), ('sh', 'Smart Shopping\n+ DeletionPolicy', 'svc'), ('db', 'PostgreSQL', 'db')]
    steps = [('msg', 'u', 'ui', 'Remove · reason: Torn / damaged'), ('msg', 'ui', 'gw', 'DELETE /items/:id {reason}'),
             ('msg', 'gw', 'gw', 'reason ∈ 4 · JWT · owner'),
             ('msg', 'gw', 'w', 'deletePiece(userId, id, reason)'), ('msg', 'w', 'db', 'DELETE item · INSERT wardrobe.deletions'),
             ('msg', 'w', 'b', 'publish ItemDeleted {deletion}'), ('msg', 'b', 'sh', 'onDeleted(userId, deletion)'),
             ('msg', 'sh', 'sh', 'replacementFor(deletion)'),
             ('frame', 'sh', 'db', 'alt: Torn / damaged · Became too small', 70),
             ('msg', 'sh', 'db', 'INSERT shopping.list_items (replacement)'),
             ('note', 'sh', 'No longer my style · Other → nothing added'),
             ('ret', 'sh', 'w', 'listItem | null'), ('ret', 'w', 'gw', '{deleted, effect, addedToShoppingList}'), ('ret', 'gw', 'ui', '200 · audit “Piece deleted · reason”')]
    return sequence('seq3', 'Sequence · delete with a reason → replacement in the shopping bag (US-13, US-33)', 'Observer: Wardrobe does not know about Smart Shopping. One event, one rule table (DeletionPolicy, BR-10).', parts, steps, fname='D14_sequence_delete_reason')

def seq_ask_shopping():
    parts = [('u', 'Habiba', 'actor'), ('ui', 'Web App\n(Ask Closet)', 'ui'), ('ask', 'Ask Closet\nService', 'svc'), ('llm', 'Language Model\nAdapter / parser', 'ext'), ('sh', 'Smart\nShopping', 'svc'), ('db', 'PostgreSQL', 'db')]
    steps = [('msg', 'u', 'ui', '“Do I need beige trousers?”'), ('msg', 'ui', 'ask', 'POST /chat {message}'), ('msg', 'ask', 'llm', 'interpret(message)'), ('ret', 'llm', 'ask', 'buy_check {Beige, Bottom}'),
             ('msg', 'ask', 'sh', 'check(Bottom, Beige)'), ('ret', 'sh', 'ask', 'Skip · 4 similar owned'), ('ret', 'ask', 'ui', 'reply + context {buy}'),
             ('msg', 'u', 'ui', '“add this to my shopping list”'), ('msg', 'ui', 'ask', 'POST /chat {message, context}'), ('msg', 'ask', 'llm', 'interpret → add_to_shopping'),
             ('msg', 'ask', 'sh', 'addToList(title, category, colour, source = ask)'), ('msg', 'sh', 'db', 'INSERT shopping.list_items'),
             ('ret', 'sh', 'ask', 'item + “you already own 4 similar” · undo logged'), ('ret', 'ask', 'ui', '“Added Beige trousers …” · Undo · open bag')]
    return sequence('seq4', 'Sequence · Ask Closet puts an item on the shopping list (US-36)', 'The language model only picks the function (one of 14); the list, the warning and the Undo come from Closet’s own modules.', parts, steps, fname='D15_sequence_ask_shopping')

def seq_tryon_photo():
    parts = [('u', 'Habiba', 'actor'), ('ui', 'Web App\n(Try-on screen)', 'ui'), ('tab', 'This browser tab\n(sessionStorage)', 'db'), ('api', 'Closet API\n(Wardrobe)', 'svc'), ('vto', 'Try-On Adapter\n(planned)', 'ext')]
    steps = [('msg', 'u', 'ui', 'Try on (LOOK 01, with the changed piece)'), ('msg', 'ui', 'api', 'GET /items — pieces of the look (signed photo URLs)'), ('ret', 'api', 'ui', 'pieces + photoUrl'),
             ('msg', 'u', 'ui', 'Choose my photo (explicit, full body)'), ('msg', 'ui', 'ui', 'check type ≤ 15 MB · downscale ≤ 1100 px'), ('msg', 'ui', 'tab', 'keep photo in this tab only'),
             ('note', 'api', 'the photo is never sent to the server'),
             ('frame', 'ui', 'ui', 'for each piece', 116), ('msg', 'ui', 'ui', 'cut out piece (flood-fill background)'), ('msg', 'ui', 'ui', 'place on body region · layer order'),
             ('ret', 'ui', 'u', '“Virtual Try-On Preview · simulated on your photo”'), ('msg', 'u', 'ui', 'next look · adjust fit · Save / Favourite / Wear'),
             ('msg', 'u', 'ui', 'Remove my photo'), ('msg', 'ui', 'tab', 'delete photo + fit'), ('planned', 'ui', 'vto', 'render(outfit, photo) — planned photo-real provider')]
    return sequence('seq5', 'Sequence · Virtual Try-On Preview on your own photo (US-27)', 'Honest scope: a simulated overlay in the browser. Privacy by design: the photo stays in the tab, is removable, and never reaches Closet’s server.', parts, steps, fname='D16_sequence_tryon_photo')

def seq_forgotten_mix():
    parts = [('u', 'Habiba', 'actor'), ('ui', 'Web App', 'ui'), ('out', 'Outfits\n(insights)', 'svc'), ('rec', 'Recommendation\nEngine', 'svc'), ('db', 'PostgreSQL', 'db')]
    steps = [('frame', 'u', 'db', 'Style a forgotten piece (US-54, US-59)', 226),
             ('msg', 'ui', 'out', 'GET /insights'), ('ret', 'out', 'ui', 'forgotten: worn before, not in 40+ days'), ('msg', 'u', 'ui', 'Another chance (Denim jacket)'),
             ('msg', 'ui', 'rec', 'POST /recommendations {occasion, fixedId}'), ('ret', 'rec', 'ui', '3 looks — every one contains the piece (must be Available)'),
             ('frame', 'u', 'db', 'Mix & Match → Suggest a fix (US-42, US-43, US-66)', 270),
             ('msg', 'u', 'ui', 'lay 4 pieces on the table'), ('msg', 'ui', 'rec', 'POST /recommendations/check'), ('ret', 'rec', 'ui', 'match % · colour · style · formality · weather · rules'),
             ('msg', 'u', 'ui', 'Suggest a fix'), ('msg', 'ui', 'rec', 'POST /swap for each slot (≤ 3 rounds)'), ('ret', 'rec', 'ui', 'best single swap: higher rule score, then higher match %')]
    return sequence('seq6', 'Sequence · Style a forgotten piece, and Mix & Match → Suggest a fix', 'Both reuse the same engine: fixedId keeps one piece in every look; Suggest a fix keeps the swap that improves the rule score, then the match %.', parts, steps, fname='D17_sequence_forgotten_mix')

if __name__ == '__main__':
    for f in [use_case_overview, use_case_zoom, component_diagram, er_core, er_intelligence, class_diagram, seq_add, seq_conflict, state_diagram, product_loop, deployment]:
        print(f())
    for f in [core_flow, deletion_logic, seq_delete, seq_ask_shopping, er_full, seq_tryon_photo, seq_forgotten_mix]:
        print(f())
