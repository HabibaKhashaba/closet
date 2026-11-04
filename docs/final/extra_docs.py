# Short companion documents in the same style as the SRS/SDD v2.0: test report, presentation script, how to run, note.
import pathlib, subprocess, sys, re, html as H
sys.path.insert(0, str(pathlib.Path(__file__).parent))
HERE = pathlib.Path(__file__).parent; OUT = pathlib.Path(sys.argv[1]); OUT.mkdir(exist_ok=True)
CSS = (HERE / 'v2.css').read_text()
VS = '/tmp/claude-0/-home-claude/9efb93b1-43eb-5797-9e1b-67bf2830dbac/scratchpad/vto2'
EV = HERE.parent / 'milestone2/evidence'
def tbl(head, rows): return '<table><thead><tr>' + ''.join(f'<th>{h}</th>' for h in head) + '</tr></thead><tbody>' + ''.join('<tr>' + ''.join(f'<td>{c}</td>' for c in r) + '</tr>' for r in rows) + '</tbody></table>'
def head(title, sub):
    return f'''<div class="mini-cover"><div class="mc-k">CSCE 3701 · Team Closet · Milestone 2 · Sprint 1</div><div class="mc-b">Closet</div><div class="mc-t">{title}</div><div class="mc-s">{sub}</div></div>'''
EXTRA = '''.mini-cover{background:linear-gradient(120deg,#fbf1ef,#f5e6e3 60%,#f6eedb);border-radius:18pt;padding:16pt 20pt;margin-bottom:14pt}
.mc-k{font-size:8pt;letter-spacing:2.5pt;text-transform:uppercase;color:#9c5f5b;font-weight:bold}.mc-b{font-size:40pt;font-style:italic;font-weight:bold;line-height:1}
.mc-t{font-size:20pt;font-weight:bold;margin-top:4pt}.mc-s{font-size:10.5pt;color:#6f6461;margin-top:3pt}
.who{display:inline-block;background:#c48a86;color:#fff;border-radius:10pt;padding:1pt 8pt;font-size:9pt;font-weight:bold;margin-right:6pt}
.say{border-left:3pt solid #c48a86;padding:4pt 10pt;margin:4pt 0 10pt;background:#fcf9f6;border-radius:0 8pt 8pt 0}
h2{break-after:avoid} .keep{break-inside:avoid}'''
def page(name, title, body):
    hp = OUT / f'{name}.html'
    hp.write_text(f'<!doctype html><html><head><meta charset="utf-8"><title>{title}</title><style>{CSS}{EXTRA}</style></head><body data-doc="{title}">{body}</body></html>')
    subprocess.run(['node', str(HERE / 'render.js'), str(hp), str(OUT / f'{name}.pdf'), title], check=True)
    print(name)

# ---------------------------------------------------------------- Test Plan and Report v2.0
unit = (EV / 'v20/unit_virtual_tryon.txt').read_text()
vt = [l[5:].split(' › ')[-1] for l in unit.splitlines() if l.startswith('PASS ')]
api = re.findall(r"test\('(API-VT\d+) ([^']+)'", (HERE.parent.parent / 'server/tests/api/virtual_tryon_api.test.js').read_text())
e2e = {n: (EV / f'v20/e2e_{n}_offline.txt').read_text().strip().splitlines()[-1] for n in ('virtual_tryon', 'lifecycle', 'stateful')}
body = head('Test Plan and Report · Version 2.0', 'Build v1.6 + Virtual Try-On (US-118) · November 4, 2026')
body += '<h1 class="nonum" style="break-before:avoid">1. Test plan</h1>'
body += '<p><b>Objective.</b> Show that every requirement in the SRS v2.0 works as specified, that nothing that worked before broke, and that the new Virtual Try-On is safe (another user cannot reach my photos) and fails gracefully.</p>'
body += tbl(['Level', 'What', 'Tool', 'Where it runs'], [
  ['Unit', 'Pure rules: validators, recommendation engine, lifecycle state machine, Ask Closet parser, Virtual Try-On service and providers', 'Jest 29', 'every push (GitHub Actions)'],
  ['API / integration', 'The real Express app through the security pipeline against a real PostgreSQL 16 database (emptied before each test)', 'Jest + Supertest', 'GitHub Actions (PostgreSQL service)'],
  ['Acceptance', 'One test per Sprint 1 story, written from its acceptance criteria', 'Jest + Supertest', 'GitHub Actions'],
  ['End-to-end (browser)', 'Real user journeys clicked in Chromium: demo, stateful, lifecycle, virtual try-on', 'Playwright (Python)', 'GitHub Actions + offline demo'],
  ['Manual', 'Demo rehearsal on the presenting laptop; visual check of screens', '—', 'team']])
body += '<p><b>Techniques.</b> Equivalence partitioning and boundary values (photo size and type, 1 – 6 pieces, daily limit), state-transition testing (81 ordered pairs of the 9 lifecycle states; PENDING → PROCESSING → COMPLETED / FAILED), decision tables (deletion reasons), scenario tests (the black blazer at the tailor), and security cases (no token → 401, someone else’s data → 404). <b>Test doubles:</b> the weather, Google sign-in and the AI try-on provider are replaced by fakes, so tests need no keys and no network. <b>Entry / exit:</b> a story is Done when its acceptance test and the full suite pass on GitHub Actions.</p>'
body += '<h1 class="nonum">2. Results</h1>'
body += tbl(['Suite', 'Result', 'Run'], [
  ['Full suite, build v1.6 (unit + API + acceptance)', '<b>599 / 599 passed</b> · 0 failed · line coverage 97.53 %', 'GitHub Actions CI #5, 29 Oct 2026 (real Jest, PostgreSQL 16)'],
  ['Virtual Try-On unit tests VT-01 – VT-27', f'<b>{len(vt)} / {len(vt)} passed</b>', 'sandbox, 4 Nov 2026 (Node 22; Jest-compatible runner because the npm registry is blocked there)'],
  ['Virtual Try-On API tests API-VT01 – VT09', f'{len(api)} written · <b>run on GitHub Actions after the push</b>', 'not executed in the sandbox (needs npm packages + PostgreSQL)'],
  ['e2e virtual_tryon_journey.py', e2e['virtual_tryon'], 'offline demo build, Chromium, 4 Nov 2026'],
  ['e2e lifecycle_journey.py (regression)', e2e['lifecycle'], 'offline demo build, 4 Nov 2026'],
  ['e2e stateful_journey.py (regression)', e2e['stateful'], 'offline demo build, 4 Nov 2026']])
body += '<p class="note"><b>Honest status.</b> The old try-on tests TO-01 – TO-12 were removed with the old <code>/tryon</code> route they tested; the new Virtual Try-On replaces both. The real FASHN service has not been called yet (no API key in the sandbox): the provider was replaced by a test double and a mock. The live provider test is task T-30.</p>'
body += '<h2>2.1 Virtual Try-On · unit tests (passed)</h2>' + tbl(['Test', 'What it shows'], [[t.split(' ', 1)[0], H.escape(t.split(' ', 1)[1])] for t in vt])
body += '<h2>2.2 Virtual Try-On · API tests (run in CI)</h2>' + tbl(['Test', 'What it shows'], [[a, H.escape(b)] for a, b in api])
body += '<h2>2.3 Virtual Try-On · browser journey</h2>' + tbl(['Step', 'Checked'], [
  ['v01', 'Every one of the 3 looks shows Virtual Try-On, Wear this, Save, Not for me and Preview'], ['v02', 'The picker lists the look’s pieces; only tops, jackets and dresses are enabled'],
  ['v03 – v04', 'No photo → message; too-small photo and non-image rejected in the browser'], ['v05', 'Generate without consent → message; consent + save photo'],
  ['v06 – v07', 'Loading state, then the result with its label; Save result stored (API checked)'], ['v08', 'Try another item offers the saved photo first'],
  ['v09 – v10', 'Forced provider failure → friendly error → Retry → success'], ['v11', 'Leaving while it runs; “Your try-ons” lists it and it completes'],
  ['v12', 'Back to outfit returns to the same three looks'], ['v13', 'Delete saved photo (API checked)']])
body += f'<figure class="shot"><img src="file://{VS}/v09_failed.png"/><figcaption>Error state with Retry (step v09).</figcaption></figure>'
body += '<h2>2.4 Defects found in this pass (all fixed)</h2>' + tbl(['ID', 'Found by', 'Severity', 'Description', 'Fix'], [
  ['D-29', 'e2e v05', 'High', 'Offline demo: deleting a seeded piece removed a photo shared by other pieces, so a top had “no usable photo”.', 'only photos added in the tab are removed'],
  ['D-30', 'visual check', 'Medium', 'The garment picker opened inside the flipping outfit card and was clipped.', 'rendered into the page body (portal)'],
  ['D-31', 'e2e v08', 'Low', 'Try another item on the same piece kept the previous upload instead of the saved photo.', 'reset photo choice and consent'],
  ['D-32', 'e2e v12', 'Medium', 'Back to outfit from “Your try-ons” opened an empty Style me.', 'returns to the stored three looks']])
body += '<h2>2.5 Not verified yet</h2><ul><li>Live FASHN generation (needs the team’s API key, T-30).</li><li>API-VT01 – VT09 and the full suite after this change on GitHub Actions (runs on push).</li><li>Usability test with classmates (T-33) and load test (T-34) — Sprint 2.</li></ul>'
page('Closet_Test_Plan_and_Report_v2.0', 'Test Plan and Report · v2.0', body)

# ---------------------------------------------------------------- Presentation script (10 minutes, 15 slides)
from notes15 import S
body = head('Presentation script', '15 slides · 10 minutes · Closet_M2_Presentation.pptx — the same text is in each slide’s speaker notes')
body += tbl(['Speaker', 'Slides', 'Time', 'About'], [['Habiba', '1 – 5, 14 – 15', '≈ 3:50', 'opening, Sprint 1, Jira, feedback, next sprints, closing'], ['Karim', '6', '≈ 0:50', 'three looks'], ['Youssef', '7, 10 – 11', '≈ 2:10', 'Virtual Try-On, component diagram (with zoom)'], ['Bashar', '8 – 9', '≈ 1:10', 'use case diagram (with zoom)'], ['Salma', '12 – 13', '≈ 2:00', 'testing, retrospective']])
body += '<p class="note"><b>Tips.</b> Click once per slide; the zooms on slides 9 and 11 happen by themselves when you click. Say the hand-over line at the end of your part. Questions: everyone answers on their own part (who did what is in the README).</p>'
for n, who, t, about, say in S:
    body += f'<div class="keep"><h3 style="font-style:normal;color:#2a2626"><span class="who">{who}</span>Slide {n} · {about} <span class="tiny muted">from {t}</span></h3><div class="say">{say}</div></div>'
page('Closet_Presentation_Script', 'Presentation script', body)

# ---------------------------------------------------------------- How to run (Mac)
body = head('How to run Closet', 'On a Mac · the live demo runs on Habiba’s laptop')
body += '<h2>1. Install (one time)</h2><ul><li><b>Node.js 20+</b> (LTS) — nodejs.org</li><li><b>Postgres.app</b> — postgresapp.com · open it, click Initialize, keep it running</li><li><b>The code</b> — github.com/HabibaKhashaba/closet → Code → Download ZIP → unzip into Downloads (folder <code>closet-main</code>)</li></ul>'
body += '<h2>2. Set up (one time) — Terminal, one line at a time</h2><pre>cd ~/Downloads/closet-main\nnpm install\nnpm run install:all\n/Applications/Postgres.app/Contents/Versions/latest/bin/createdb closet\nprintf "DATABASE_URL=postgres://localhost:5432/closet\\nJWT_SECRET=change-me-closet-2026\\nPORT=4000\\nTRYON_PROVIDER=mock\\n" &gt; server/.env\nnpm --prefix server run migrate\nnpm --prefix client run build\nnpm run seed</pre><p>“Already exists” from createdb is fine.</p>'
body += '<h2>3. Start (every time)</h2><pre>cd ~/Downloads/closet-main\nnpm --prefix server start</pre><p>Wait for “Closet API on http://localhost:4000”, then open <b>http://localhost:4000</b>.</p>'
body += tbl(['Account', 'Email', 'Password'], [['Demo user', 'demo@closet.app', 'Closet2026!'], ['Admin', 'admin@closet.app', 'Closet2026!']])
body += '<h2>4. Virtual Try-On</h2><p>With <code>TRYON_PROVIDER=mock</code> the whole flow works without AI (the result is labelled “Mock result”). For the real AI result, replace that line in <code>server/.env</code> with <code>TRYON_PROVIDER=fashn</code> and <code>FASHN_API_KEY=…</code> (the team’s key — never commit it), then restart. Ctrl + C stops the server; <code>npm run seed</code> resets the demo data.</p>'
page('How_to_Run_Closet', 'How to run Closet', body)

# ---------------------------------------------------------------- Note to the instructor
body = head('Note to Dr. Sherif Aly', 'Milestone 2 · Sprint 1 submission · November 2026')
body += '<p>Dear Dr. Sherif,</p><p>This is Team Closet’s Milestone 2 (Sprint 1) submission. Each document is one clean version (v2.0); every change since Milestone 1 keeps its ID in the change log.</p>'
body += tbl(['File', 'What it is'], [
  ['Closet_SRS_v2.0.pdf', 'Software Requirements Specification (use case diagrams in 2.2 and Appendix B; change log in Appendix D)'],
  ['Closet_SDD_v2.0.pdf', 'Software Design Document (architecture, class, sequence, data; Virtual Try-On in 8.20)'],
  ['Closet_Test_Plan_and_Report_v2.0.pdf', 'Test plan, methodology and results'],
  ['Closet_M2_Presentation.pptx', 'The 10-minute presentation (15 slides)'],
  ['How_to_Run_Closet.pdf', 'How to run the app locally']])
body += tbl(['Link', ''], [['Jira (project SCRUM)', 'aucegypt-team-r73i3oon.atlassian.net/jira/software/projects/SCRUM/boards/1'], ['GitHub', 'github.com/HabibaKhashaba/closet'], ['GitHub Actions (CI)', 'github.com/HabibaKhashaba/closet/actions'], ['Demo', 'live in class from our laptop (React + Node API + PostgreSQL)']])
body += '<p>Thank you,<br/>Team Closet — Habiba Khashaba, Salma, Bashar, Karim and Youssef</p>'
page('Note_to_Dr_Sherif_Aly', 'Note to Dr. Sherif Aly', body)
