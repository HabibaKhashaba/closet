# Closet v1.5 diagrams (Milestone 2 final): the changes since v1.4 only, in the same visual language.
#   D18 component diagram v1.5 (security pipeline · feature modules · repository layer · adapters)
#   D19 use cases · proactive wardrobe intelligence
#   D20 ER additions (migration 006)
#   D21 state machine · item status + the separate rehoming lifecycle
#   D22 sequence · Still love it? → Donate
#   D23 sequence · planned-outfit monitor (weather + availability) → change one piece
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from diagrams import SVG, comp, table, rel_line, sequence, ell_edge, SPR, INK, MUTED, ROSE, ROSE_INK, PAPER  # noqa: E402

def component_v15():
    s = SVG(title='UML component diagram · Closet v1.5 (Milestone 2 final)', sub='Modular monolith. React UI → API Gateway → Authentication + Security → feature modules → repositories → PostgreSQL. Adapters connect external services. Solid = request flow, dashed = «use».')
    for x, t in [(30, 'Client'), (240, 'API Gateway · security pipeline'), (500, 'Feature modules (services)'), (1010, 'Repository layer'), (1250, 'Adapters / external')]:
        s.text(x, 112, t.upper(), 12.5, ROSE_INK, anchor='start', weight='700')
    comp(s, 30, 140, 180, 110, 'Web App', 1, sub='React 19 · api.js')
    s.text(120, 272, 'views · controller · model', 12, MUTED)
    comp(s, 30, 560, 180, 110, 'Offline demo', 2, sub='same services, local data')
    s.text(120, 690, 'localApi.js → in-memory repos', 12, MUTED)
    # security pipeline, emphasised (instructor feedback M1: authentication/security must be visible)
    s.rect(232, 132, 236, 610, '#fff7f4', ROSE, 14, 1.6)
    pipe = [('API Gateway', 'HTTPS · CORS · CSP · helmet'), ('Rate limiting', '1000/15 min · sign-in 30'), ('Validation', 'schemas → 400'), ('Authentication', 'bcrypt · JWT 2 h · token version'),
            ('Authorization', 'role (admin 403)'), ('Ownership', 'every query user_id → 404'), ('Audit', 'activity log')]
    for i, (n, sub) in enumerate(pipe):
        y = 146 + i * 84
        comp(s, 246, y, 208, 66, n, 1, sub=sub, fs=14.5)
        if i: s.line(350, y - 18, 350, y - 2, INK, 1.6, None, 'arr')
    s.line(210, 195, 244, 180, INK, 1.6, None, 'arr'); s.text(120, 300, 'REST / JSON', 12, MUTED)
    mods = [('Identity & Auth', 1), ('Profile', 1), ('Wardrobe', 1), ('Availability\n(state machine)', 1), ('Planner', 1), ('Privacy', 1),
            ('Recommendation\nEngine', 2), ('Outfits & Memory', 2), ('Wardrobe Insights\n(v1.5, shared rules)', 3), ('Closet Intelligence\n+ Notifications', 3),
            ('Ask Closet', 3), ('Smart Shopping', 3), ('Packing', 4), ('Admin', 3), ('Event Bus', 1)]
    for i, (n, sp) in enumerate(mods):
        cx = 492 + (i % 3) * 166; cy = 140 + (i // 3) * 104
        comp(s, cx, cy, 156, 84, n, sp, fs=13.5)
    s.rect(484, 132, 506, 532, 'none', '#b9a99d', 16, 1.2, '8 6')
    s.line(454, 440, 482, 440, INK, 1.6, None, 'arr')
    # repositories
    repos = ['identity', 'profile', 'wardrobe', 'availability', 'outfits', 'planner', 'shopping', 'intelligence', 'packing', 'assistant', 'activity']
    s.rect(1006, 132, 222, 532, '#f6f3ef', '#8f857c', 14, 1.3)
    for i, r in enumerate(repos):
        s.rect(1018, 146 + i * 46, 198, 36, '#fff', '#8f857c', 8, 1.1)
        s.text(1117, 164 + i * 46, f'{r}Repository', 13, INK)
    s.line(990, 400, 1004, 400, INK, 1.4, '6 4', 'open')
    s.text(1117, 682, 'PostgreSQL repos (server)', 12, INK); s.text(1117, 700, 'in-memory repos (offline demo)', 12, MUTED)
    # db
    s.add(f'<g><ellipse cx="1117" cy="760" rx="120" ry="14" fill="#e8f4ec" stroke="{INK}" stroke-width="1.4"/><path d="M997 760 v80 a120 14 0 0 0 240 0 v-80" fill="#e8f4ec" stroke="{INK}" stroke-width="1.4"/></g>')
    s.text(1117, 800, 'PostgreSQL 16', 17, INK, weight='700'); s.text(1117, 824, '6 migrations · user_id on every row', 12, MUTED)
    s.line(1117, 712, 1117, 744, INK, 1.4, '6 4', 'open')
    ad = [('Weather Adapter', 2, 'Open-Meteo · estimate mode'), ('Language Model', 3, 'tool call · keyword fallback'), ('Calendar (.ics)', 2, 'import'),
          ('Photo Storage', 1, 'signed URLs · EXIF stripped'), ('Try-On Provider', 4, 'interface only · 2-D preview'), ('Notification', 4, 'in-app now · push later')]
    for i, (n, sp, sub) in enumerate(ad):
        y = 140 + i * 90
        comp(s, 1256, y, 196, 72, n, sp, sub=sub, fs=13.5)
        s.rect(1468, y + 14, 112, 44, '#f4f1ee', '#8f857c', 9, 1.1); s.text(1524, y + 36, ['Open-Meteo', 'Anthropic/OpenAI', 'Google/Apple', 'disk → bucket', 'future model', 'push/e-mail'][i], 11.5, INK)
        s.line(1452, y + 36, 1466, y + 36, '#8f857c', 1.2, '5 4', 'open')
    s.path('M990 150 V124 H1240 V176 H1254', INK, 1.2, '6 4', 'open')
    s.legend(500, 690, [1, 2, 3, 4], 13)
    s.rect(500, 800, 490, 80, '#fff', '#b9a99d', 12, 1.2)
    s.text(745, 818, 'One source of truth: item status lives only in Availability; every', 12.5, INK)
    s.text(745, 838, 'screen, the planner monitor and the engine read it — never a copy.', 12.5, INK)
    s.text(745, 860, 'Status rules reach the web app through GET /vocabulary.', 12.5, MUTED)
    return s.save('D18_component_v15')

def use_cases_proactive():
    s = SVG(title='Use cases · proactive wardrobe intelligence (v1.5)', sub='Grouped by what Closet notices. Every state change waits for the user (Confirm, Keep, Donate, Adjust). Admin is unchanged (see D1). Notification Service and Weather are secondary actors.')
    s.actor(110, 460, 'User')
    s.actor(1500, 260, 'Weather\nService', ext=True); s.actor(1500, 470, 'Calendar\n(.ics)', ext=True); s.actor(1500, 680, 'Notification\nService', ext=True)
    s.rect(240, 110, 1150, 770, '#fff', '#b9a99d', 18, 1.3)
    s.text(815, 136, 'Closet', 18, INK, weight='700', family='Lora, Georgia, serif')
    groups = [('Use what you own', 300, 165, ['Still love it? (style · keep · donate)', 'Donate / give / sell a piece', 'Seasonal rotation', 'Repeat a loved look']),
              ('Warn before it is a problem', 830, 165, ['Planned outfit vs weather', 'Planned outfit vs availability', 'Laundry before an event', 'Borrowed piece overdue']),
              ('Plan', 300, 525, ['Trip capsule (carry-on)', 'Plan several days', 'I have nothing to wear']),
              ('Buy intentionally', 830, 525, ['What would it add? (simulated)', 'Duplicate check on Add', 'Gaps with confidence', 'Cost per wear'])]
    for title, gx, gy, ucs in groups:
        s.rect(gx, gy, 500, 330 if len(ucs) == 4 else 270, '#faf7f4', '#d9cfc7', 14, 1.1)
        s.text(gx + 16, gy + 22, title.upper(), 12.5, ROSE_INK, anchor='start', weight='700')
        for i, u in enumerate(ucs):
            cy = gy + 72 + i * 64
            s.add(f'<ellipse cx="{gx + 250}" cy="{cy}" rx="215" ry="26" fill="#eee7f2" stroke="#7a5a9c" stroke-width="1.5"/>')
            s.text(gx + 250, cy, u, 14, INK)
    s.line(160, 460, 300, 330, INK, 1.2); s.line(160, 460, 300, 650, INK, 1.2)
    # the right-hand groups are reached through the gap between the rows, never across another group
    s.path('M160 460 L300 510 H815 V420 H830', INK, 1.2); s.path('M815 510 V600 H830', INK, 1.2)
    for (y1, y2) in [(260, 300), (470, 360), (680, 560)]:
        s.line(1420, y1, 1330, y2, '#8f857c', 1.2, '6 4')
    s.text(815, 893, 'Implemented as Sprint 3 previews in v1.5 (built early, labelled in the app) · stories US-94 – US-111 proposed for Jira', 13, MUTED)
    return s.save('D19_use_cases_proactive')

def er_v15():
    s = SVG(title='ER additions · migration 006 (v1.5)', sub='Only the data the features need. Days since worn, cost per wear, seasons, laundry risk and conflicts are DERIVED at read time — no second copy of any status.')
    it = table(s, 60, 130, 'wardrobe.items (existing)', ['PK id', 'FK user_id', 'category · colour · season …', 'wear_count · last_worn_at', '+ price NUMERIC(10,2) NULL', '+ currency EGP|USD|EUR|…', '+ purchase_date DATE'], 1, 330, hl=['+ price NUMERIC(10,2) NULL', '+ currency EGP|USD|EUR|…', '+ purchase_date DATE'])
    rh = table(s, 520, 130, 'wardrobe.rehoming (new)', ['PK,FK item_id → items', 'FK user_id', 'method donate|give|sell', 'started_at'], 3, 300)
    de = table(s, 520, 330, 'wardrobe.deletions (existing)', ['PK id · FK user_id', 'name · category · colour', 'reason … + Donated', '+ Given away · Sold / rehomed', 'deleted_at (history kept)'], 1, 300, hl=['reason … + Donated', '+ Given away · Sold / rehomed'])
    sn = table(s, 960, 130, 'intelligence.snoozes (new)', ['PK user_id, key', 'key keep:/season:/borrow:/notice:', 'until DATE', 'reason (Still love it …)'], 3, 330)
    we = table(s, 60, 470, 'outfits.wears (existing)', ['PK id · FK user_id', 'item_ids · worn_on · rating', 'occasion · temp_c · conditions', '+ event_title', '+ note'], 2, 330, hl=['+ event_title', '+ note'])
    ev = table(s, 960, 400, 'planner.events (existing)', ['PK id · FK user_id', 'date · occasion · planned_outfit_id', '+ planned_temp_c', '+ planned_condition'], 1, 330, hl=['+ planned_temp_c', '+ planned_condition'])
    pr = table(s, 960, 610, 'profile.profiles (existing)', ['PK,FK user_id', 'styles · dress_code · …', '+ allow_repeats BOOL'], 1, 330, hl=['+ allow_repeats BOOL'])
    rel_line(s, (390, 190), (520, 190), '1 ── 0..1')
    s.text(420, 300, 'Mark as donated → row moves to deletions', 12.5, MUTED, anchor='start')
    s.rect(60, 760, 860, 100, '#fff7f4', ROSE, 12, 1.2)
    s.text(76, 784, 'Design decision (SDD 5.15)', 14, ROSE_INK, anchor='start', weight='700')
    s.text(76, 810, 'Donation is a separate lifecycle, not a 6th item status: the 5-status state machine and its 25 tested', 13, INK, anchor='start')
    s.text(76, 832, 'transitions stay unchanged; a piece “Ready to donate” is still owned, so its status stays truthful.', 13, INK, anchor='start')
    return s.save('D20_er_v15')

def state_v15():
    s = SVG(title='State model · item status + rehoming (v1.5)', sub='Status: exactly one of five, 10 allowed moves (unchanged). Rehoming is a second, independent lifecycle that ends by leaving the active closet with a recorded reason.')
    st = {'Available': (420, 470), 'Laundry': (420, 210), 'Borrowed': (740, 470), 'Packed': (420, 730), 'Unavailable': (110, 470)}
    for n, (x, y) in st.items():
        f, c = {'Available': ('#e4f0e8', '#4f8a66'), 'Laundry': ('#e5ecf3', '#3e5d80'), 'Borrowed': ('#f8ecdc', '#b77a33'), 'Packed': ('#eee7f2', '#7a5a9c'), 'Unavailable': ('#f7e3e1', '#b55450')}[n]
        s.rect(x - 95, y - 34, 190, 68, f, c, 34, 2); s.text(x, y, n, 19, INK, weight='700', family='Lora, Georgia, serif')
    for a, b, lab in [('Available', 'Laundry', 'In laundry ⇄ Wash done'), ('Available', 'Borrowed', 'Lend ⇄ Mark returned'), ('Available', 'Packed', 'Pack (trip / season) ⇄ Unpack / Bring back'), ('Available', 'Unavailable', 'Unavailable ⇄ Ready')]:
        (x1, y1), (x2, y2) = st[a], st[b]
        ox, oy = (0, 7) if y1 == y2 else (7, 0)
        s.line(x1 + (x2 - x1) * .3 + ox, y1 + (y2 - y1) * .3 + oy, x1 + (x2 - x1) * .7 + ox, y1 + (y2 - y1) * .7 + oy, INK, 1.6, None, 'arr')
        s.line(x1 + (x2 - x1) * .7 - ox, y1 + (y2 - y1) * .7 - oy, x1 + (x2 - x1) * .3 - ox, y1 + (y2 - y1) * .3 - oy, INK, 1.6, None, 'arr')
        s.label((x1 + x2) / 2 + (0 if y1 == y2 else 0), (y1 + y2) / 2 - (52 if y1 == y2 else 0), lab, 12.5)
    s.text(420, 870, 'Borrowed / Packed → Laundry allowed (came back dirty) · all 25 pairs tested (ST-01 – ST-04)', 12.5, MUTED)
    s.rect(900, 150, 660, 700, '#fbf8f5', '#b9a99d', 16, 1.2)
    s.text(920, 178, 'REHOMING (wardrobe.rehoming)', 13, ROSE_INK, anchor='start', weight='700')
    r = {'Kept': (1060, 270), 'Ready to donate /\ngive / sell': (1230, 470), 'Left the closet\n(deletions: Donated …)': (1230, 700)}
    for n, (x, y) in r.items():
        s.rect(x - 130, y - 42, 260, 84, '#fff', '#7a5a9c', 30, 1.8); s.text(x, y, n, 15, INK, weight='600')
    s.add('<circle cx="1060" cy="200" r="10" fill="#2a2626"/>'); s.line(1060, 210, 1060, 226, INK, 1.4, None, 'arr')
    s.line(1150, 312, 1215, 426, INK, 1.6, None, 'arr'); s.label(1330, 360, 'Donate · Give · Sell (user)', 12.5)
    s.line(1170, 430, 1100, 314, INK, 1.4, '6 4', 'arr'); s.label(1010, 392, 'Keep it after all', 12.5)
    s.line(1230, 512, 1230, 655, INK, 1.6, None, 'arr'); s.label(1340, 585, 'Mark as donated (user)', 12.5)
    s.add('<circle cx="1440" cy="700" r="11" fill="none" stroke="#2a2626" stroke-width="2"/><circle cx="1440" cy="700" r="6" fill="#2a2626"/>'); s.line(1360, 700, 1427, 700, INK, 1.4, None, 'arr')
    for i, t in enumerate(['While Ready: still owned, status unchanged, left out of new outfits.', 'Left: no replacement on the shopping list (BR-12), history kept.', 'Keep it: snooze 90 days (intelligence.snoozes).']):
        s.text(920, 772 + i * 24, t, 12.5, INK, anchor='start')
    return s.save('D21_state_v15')

def seq_donate():
    parts = [('u', 'Habiba', 'actor'), ('ui', 'Web App', 'ui'), ('gw', 'Gateway\n(auth · owner)', 'gw'), ('pro', 'Proactive\nservice', 'svc'), ('ins', 'Wardrobe\nInsights (pure)', 'svc'), ('w', 'Wardrobe\nservice', 'svc'), ('sh', 'Smart\nShopping', 'svc'), ('db', 'Repositories\n→ PostgreSQL', 'db')]
    steps = [('msg', 'ui', 'gw', 'GET /intelligence/forgotten'), ('msg', 'gw', 'pro', 'forgotten(userId)'), ('msg', 'pro', 'db', 'pieces + current status + snoozes'),
             ('msg', 'pro', 'ins', 'forgottenCandidates(pieces, weather, snoozes)'), ('ret', 'ins', 'pro', 'Denim jacket · 104 days · in season'), ('ret', 'pro', 'ui', '“Still love it?” card'),
             ('frame', 'u', 'db', 'user chooses Donate', 200),
             ('msg', 'u', 'ui', 'Donate → Donate'), ('msg', 'ui', 'w', 'POST /items/:id/rehome {donate}'), ('msg', 'w', 'db', 'INSERT wardrobe.rehoming'), ('ret', 'w', 'ui', '“Ready to donate” (still owned)'),
             ('msg', 'u', 'ui', 'Mark as donated'), ('msg', 'ui', 'w', 'POST /items/:id/rehome/done'), ('msg', 'w', 'db', 'DELETE item · INSERT deletions (Donated)'),
             ('msg', 'w', 'sh', 'ItemDeleted (Observer)'), ('ret', 'sh', 'w', 'policy Donated → no replacement'), ('ret', 'w', 'ui', 'gone from the closet · bag unchanged')]
    return sequence('seq7', 'Sequence · Still love it? → Donate (v1.5)', 'The rule lives in one pure function; the state change goes through the Wardrobe service; Smart Shopping reacts through the event bus and adds nothing.', parts, steps, fname='D22_sequence_donate')

def seq_monitor():
    parts = [('u', 'Salma', 'actor'), ('ui', 'Web App\n(Home/Planner)', 'ui'), ('pro', 'Proactive\nmonitor', 'svc'), ('pl', 'Planner', 'svc'), ('av', 'Availability\n(current status)', 'svc'), ('wx', 'Weather\nAdapter', 'ext'), ('rec', 'Recommendation\nEngine', 'svc')]
    steps = [('msg', 'ui', 'pro', 'GET /intelligence/monitor'), ('msg', 'pro', 'pl', 'upcoming planned outfits'), ('msg', 'pl', 'av', 'pieces with CURRENT status'), ('msg', 'pl', 'wx', 'forecast for the event day'),
             ('ret', 'pl', 'pro', 'event + planned snapshot 24 °C + forecast 30 °C'),
             ('frame', 'pro', 'rec', 'each planned outfit', 92), ('note', 'pro', 'weatherShift: |Δ| ≥ 5 °C or rain → warm piece'), ('note', 'pro', 'status ≠ Available → that piece'),
             ('ret', 'pro', 'ui', '“30 °C instead of 24 °C — blazer may be too warm”'), ('msg', 'u', 'ui', 'Adjust outfit'),
             ('msg', 'ui', 'pro', 'POST /monitor/:event/adjust {itemId}'), ('msg', 'pro', 'rec', 'swap(only that slot, event date)'), ('ret', 'rec', 'pro', 'Beige trench coat (light)'),
             ('msg', 'pro', 'pl', 'plan(event, outfit) — new forecast snapshot'), ('ret', 'pro', 'ui', 'only the layer changed · alert cleared')]
    return sequence('seq8', 'Sequence · planned-outfit monitor → change one piece (v1.5)', 'ONE monitor for weather and availability. It reads current status and forecast every time (no stored copies) and reuses Change One Piece.', parts, steps, fname='D23_sequence_monitor')

if __name__ == '__main__':
    for f in [component_v15, use_cases_proactive, er_v15, state_v15, seq_donate, seq_monitor]:
        print(f())
