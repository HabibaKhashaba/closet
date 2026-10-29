# Closet v1.6 diagrams (Milestone 2 final, revision 5): the changes since v1.5 only, same visual language.
#   D24 state machine · the ONE garment lifecycle (shared/lifecycle.js) — supersedes D21
#   D25 ER additions (migration 007: care_jobs, loans; rehoming converted, then dropped)
#   D26 sequence · Black blazer: Needs alteration → At tailor → reminder → Mark collected
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from diagrams import SVG, table, rel_line, sequence, INK, MUTED, ROSE, ROSE_INK  # noqa: E402

COL = {'Available': ('#e4f0e8', '#4f8a66'), 'Laundry': ('#e5ecf3', '#3e5d80'), 'Borrowed': ('#f8ecdc', '#b77a33'), 'Packed': ('#eee7f2', '#7a5a9c'),
       'Needs repair': ('#f7e3e1', '#b55450'), 'Needs alteration': ('#f7e3e1', '#b55450'), 'At tailor': ('#fbeede', '#a86a2c'),
       'Ready to donate': ('#f3ecf6', '#8a5aa0'), 'Unavailable': ('#efeae6', '#8f857c')}

def state_v16():
    s = SVG(H=960, title='State machine · one garment lifecycle (v1.6)', sub='Exactly one of 9 states per piece, 21 allowed moves (shared/lifecycle.js). Every status change goes through Availability.setStatus, which also opens / closes loans and care jobs.')
    st = {'Available': (700, 470), 'Laundry': (700, 190), 'Borrowed': (1080, 300), 'Packed': (1080, 610), 'Unavailable': (1080, 850),
          'Needs repair': (390, 470), 'Needs alteration': (390, 760), 'At tailor': (140, 615), 'Ready to donate': (700, 760)}
    for n, (x, y) in st.items():
        f, c = COL[n]
        s.rect(x - 105, y - 32, 210, 64, f, c, 32, 2); s.text(x, y, n, 18, INK, weight='700', family='Lora, Georgia, serif')

    def clip(a, b, t0=.0):
        (x1, y1), (x2, y2) = st[a], st[b]
        dx, dy = x2 - x1, y2 - y1
        # leave each pill at its border (half sizes 105 × 32)
        k = min(105 / abs(dx) if dx else 9e9, 32 / abs(dy) if dy else 9e9)
        return x1 + dx * (k + .03), y1 + dy * (k + .03), x2 - dx * (k + .03), y2 - dy * (k + .03)

    def pair(a, b, out_l, back_l, gap=7, lab=24):
        x1, y1, x2, y2 = clip(a, b)
        dx, dy = x2 - x1, y2 - y1; L = (dx * dx + dy * dy) ** .5; nx, ny = -dy / L, dx / L
        s.line(x1 + nx * gap, y1 + ny * gap, x2 + nx * gap, y2 + ny * gap, INK, 1.6, None, 'arr')
        s.line(x2 - nx * gap, y2 - ny * gap, x1 - nx * gap, y1 - ny * gap, INK, 1.6, None, 'arr')
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        if not out_l: return
        s.label(mx + nx * lab * (1 + .9 * abs(nx)) , my + ny * lab, out_l, 12)
        s.label(mx - nx * lab * (1 + .9 * abs(nx)), my - ny * lab, back_l, 12)

    def one(a, b, lab, lx=0, ly=-18, dash=None):
        x1, y1, x2, y2 = clip(a, b)
        s.line(x1, y1, x2, y2, INK, 1.6, dash, 'arr'); s.label((x1 + x2) / 2 + lx, (y1 + y2) / 2 + ly, lab, 12)

    pair('Available', 'Laundry', '', '', lab=30); s.label(760, 300, 'In laundry ↑', 12); s.label(640, 300, 'Wash done ↓', 12)
    pair('Available', 'Borrowed', 'Lend item', 'Mark returned')
    pair('Available', 'Packed', 'Pack (trip / season)', 'Unpack · Bring back')
    pair('Available', 'Unavailable', 'Ready', 'Unavailable')
    pair('Available', 'Needs repair', 'Repair / Alter', 'Fixed at home')
    pair('Available', 'Needs alteration', 'Repair / Alter', 'Fixed at home')
    pair('Available', 'Ready to donate', 'Donate', 'Cancel donation', lab=40)
    # came back dirty: Borrowed / Packed → Laundry (orthogonal, right of the pairs)
    s.path('M1080 268 V170 H808', INK, 1.5, None, 'arr'); s.path('M1185 610 H1250 V150 H808', INK, 1.5, None, 'arr')
    s.label(960, 150, 'came back dirty (Borrowed / Packed → Laundry)', 12)
    # tailor
    one('Needs repair', 'At tailor', 'Send to tailor', -40, -14); one('Needs alteration', 'At tailor', 'Send to tailor', -44, 14)
    s.path('M140 583 V330 H630 V436', INK, 1.6, None, 'arr'); s.label(390, 330, 'Mark collected  (At tailor → Available)', 12)
    # donate instead of repairing
    one('Needs alteration', 'Ready to donate', 'Donate', 0, -16, dash='6 4')
    s.text(545, 812, 'Needs repair → Ready to donate is allowed too', 11.5, MUTED)
    s.add('<circle cx="700" cy="905" r="11" fill="none" stroke="#2a2626" stroke-width="2"/><circle cx="700" cy="905" r="6" fill="#2a2626"/>')
    s.line(700, 794, 700, 890, INK, 1.6, None, 'arr'); s.label(820, 852, 'Mark as donated → archived', 12)
    s.rect(1290, 300, 290, 390, '#fbf8f5', '#b9a99d', 14, 1.2)
    s.text(1306, 326, 'WHAT EACH STATE MEANS', 12.5, ROSE_INK, anchor='start', weight='700')
    for i, t in enumerate(['Only Available is wearable', '   (Style me, plans, trips).', 'Care screen: Laundry, Needs repair,', '   Needs alteration, At tailor.',
                           'Borrowed: an open loan', '   (person, lent, due).', 'At tailor: an open care job (tailor,', '   sent, expected back, cost) →', '   reminder on the day.',
                           'Ready to donate: still owned, left', '   out of outfits, duplicates, gaps.', 'Donated is not a state: archived', '   with reason Donated, history kept,', '   no replacement (BR-12).']):
        s.text(1306, 352 + i * 23, t, 12.5, INK, anchor='start')
    s.text(1435, 730, '81 ordered pairs tested (ST-01 – ST-06):', 12, MUTED); s.text(1435, 750, '21 valid, 60 rejected with 409.', 12, MUTED)
    return s.save('D24_state_v16')

def er_v16():
    s = SVG(H=820, title='ER additions · migration 007 (v1.6)', sub='Loans and care jobs are history tables kept in step with the status by Availability.setStatus. At most ONE open loan and ONE open care job per piece (partial unique indexes).')
    table(s, 60, 130, 'availability.item_status (existing)', ['PK,FK item_id', 'FK user_id', 'status CHECK (9 states)', 'note · until', 'updated_at'], 1, 340, hl=['status CHECK (9 states)'])
    table(s, 560, 130, 'availability.loans (new)', ['PK id · FK item_id · FK user_id', 'person', 'lent_on · due_on', 'note', 'returned_on NULL = open', 'UNIQUE (item_id) WHERE open'], 3, 360)
    table(s, 560, 420, 'availability.care_jobs (new)', ['PK id · FK item_id · FK user_id', 'kind repair|alteration · reason', 'notes · tailor · cost', 'sent_on · expected_back', 'closed_on · outcome', 'UNIQUE (item_id) WHERE open'], 3, 360)
    table(s, 1080, 130, 'wardrobe.deletions (existing)', ['PK id · FK user_id', 'name · category · colour', 'reason … Donated', 'wear_count · deleted_at'], 1, 440, hl=['reason … Donated'])
    table(s, 1080, 380, 'wardrobe.rehoming (v1.5)', ['converted by 007:', 'each row → status Ready to donate', 'then DROP TABLE'], 4, 440)
    rel_line(s, (400, 200), (560, 200), '1 ── 0..*'); rel_line(s, (400, 260), (560, 480), '1 ── 0..*')
    s.text(60, 420, 'Outcome of a care job: collected · fixed · donated', 12.5, MUTED, anchor='start')
    s.text(60, 444, 'Borrowed rows without a loan were back-filled into loans.', 12.5, MUTED, anchor='start')
    s.rect(60, 680, 1460, 90, '#fff7f4', ROSE, 12, 1.2)
    s.text(76, 704, 'Design decision (SDD v1.3, R5.2) — reverses v1.5 “rehoming is not a status”', 14, ROSE_INK, anchor='start', weight='700')
    s.text(76, 730, 'Two sources of truth (a status + a separate rehoming row) made screens disagree. v1.6 has ONE lifecycle: Ready to donate is a state like Laundry,', 13, INK, anchor='start')
    s.text(76, 752, 'so every module asks the same helpers (isWearable, isOwned, isLeaving). Leaving the closet is still a delete with a reason, never a state.', 13, INK, anchor='start')
    return s.save('D25_er_v16')

def seq_tailor():
    parts = [('u', 'Habiba', 'actor'), ('ui', 'Web App\n(Piece · Care)', 'ui'), ('gw', 'Gateway\n(auth · owner)', 'gw'), ('av', 'Availability\nsetStatus', 'svc'),
             ('rec', 'Recommendation\nEngine', 'svc'), ('nt', 'Closet Intelligence\n(notifications)', 'svc'), ('db', 'Repositories\n→ PostgreSQL', 'db')]
    steps = [('msg', 'u', 'ui', 'More actions → Repair / Alter'), ('msg', 'ui', 'gw', 'POST /items/:id/care {alteration, “Sleeves too long”}'),
             ('msg', 'gw', 'av', 'needsCare()'), ('msg', 'av', 'db', 'status Needs alteration · INSERT care_jobs'),
             ('msg', 'ui', 'gw', 'POST /items/:id/care/tailor {tailor, expectedBack}'), ('msg', 'av', 'db', 'status At tailor · UPDATE care_jobs'),
             ('frame', 'u', 'db', 'Style me while it is at the tailor', 110),
             ('msg', 'ui', 'rec', 'POST /recommendations'), ('ret', 'rec', 'ui', 'three looks — only Available pieces (blazer absent)'),
             ('frame', 'u', 'db', 'on the expected-back day', 290),
             ('msg', 'ui', 'nt', 'GET /notifications'), ('ret', 'nt', 'ui', 'TAILOR_READY · Mark collected / Remind me later'),
             ('msg', 'u', 'ui', 'Mark collected'), ('msg', 'ui', 'av', 'POST /items/:id/care/done'), ('msg', 'av', 'db', 'status Available · care_jobs.closed_on, outcome collected'),
             ('ret', 'av', 'ui', 'Available — back in outfits, history kept')]
    return sequence('seq9', 'Sequence · Black blazer: alteration at the tailor (v1.6)', 'One path for every status change. The care job is history; the status says where the piece is right now.', parts, steps, fname='D26_sequence_tailor')

if __name__ == '__main__':
    for f in [state_v16, er_v16, seq_tailor]:
        print(f())
