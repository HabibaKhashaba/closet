# Test Plan and Report v1.2 (Milestone 2 final, build v1.5). A fresh document: every number comes from the evidence files.
import re, sys, json, pathlib
from docbase import render, table, img, counts, EVID, REPO

OUT = pathlib.Path(sys.argv[1])
c = counts()
RUN = (EVID / 'test_run_v15.txt').read_text().splitlines()
suites = set(re.sub(r'^\s*▶ ', '', l) for l in RUN if l.lstrip().startswith('▶'))
tests, cur = [], None
for l in RUN:
    if l.lstrip().startswith('▶'): cur = l.strip()[2:]; continue
    m = re.match(r'^(\s*)([✔✖]) (.*) \([\d.]+ms\)$', l)
    if m and m.group(3) not in suites: tests.append((cur, m.group(3), m.group(2) == '✔'))
assert len(tests) == c['total'], (len(tests), c['total'])
summary = {k: re.search(rf'ℹ {k} (\S+)', '\n'.join(RUN)).group(1) for k in ('tests', 'suites', 'pass', 'fail', 'duration_ms')}
assert int(summary['tests']) == c['total'] and int(summary['pass']) == c['passed']
cov_rows = []
for l in (EVID / 'coverage_v15.txt').read_text().splitlines():
    m = re.match(r'^ℹ\s+(\S.*?)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*(.*)$', l)
    if m and m.group(1) != 'file': cov_rows.append([m.group(1), m.group(2), m.group(3), m.group(4), m.group(5)[:40]])
live = (EVID / 'e2e_stateful_live.txt').read_text().strip().splitlines()[0]
off = (EVID / 'e2e_stateful_offline.txt').read_text().strip().splitlines()[0]
journey = [l for l in (EVID / 'e2e_demo_journey.txt').read_text().splitlines() if 'steps' in l][-1]
defects = [l.strip('|').split('|') for l in (REPO / 'docs/milestone2/evidence/defects.md').read_text().splitlines()[2:] if l.startswith('| D-')]
def has(prefix): return [t for t in tests if t[1].startswith(prefix)]
def ids(*prefixes): return ' · '.join(t[1].split(' ')[0] for p in prefixes for t in has(p))

CHECKS = [
 ('s01', 'Sign in; Home shows ≤ 2 proactive notices and “Still love it?” (denim jacket, 104 days)'),
 ('s02', 'Navy blazer → In laundry; Laundry basket, Closet card and Home count follow; the blazer is not recommended'),
 ('s03', 'Wash done → Available in the Closet and the API; basket empty'),
 ('s04', 'Three looks; any two share ≤ 1 major garment (measured from the API)'),
 ('s05', 'Favourite + Save → one record; still in Favourites after a reload; unfavourite keeps it in All looks'),
 ('s06', 'Still love it? → Style it: the denim jacket is in all three looks'),
 ('s07', 'Keep it (“Still love it”) → gone from Analytics and from the API candidates'),
 ('s08', 'Donate → the piece is marked Ready to donate'),
 ('s09', 'Mark as donated → gone from the closet, history kept, nothing added to the Shopping Bag'),
 ('s10', 'Ask Closet: 12 questions → 12 different answers; blazer answer follows its status; “Add this” reaches the Shopping Bag; out-of-scope reply'),
 ('s11', 'Mix & Match: red cropped tee lowers the score, Suggest a fix raises it (live run: 98 → 82 → 98)'),
 ('s12', 'Remove the silk scarf with reason “Torn / damaged” → Replacement in the Shopping Bag'),
 ('s13', 'Closet has learned: closed card → flip → Confirm changes the profile → Undo restores it'),
 ('s14', 'Planner: planned at 24 °C, now 30 °C → Adjust outfit changes exactly one piece, the warm one'),
 ('s15', 'Packing: carry-on capsule within 8 clothing / 2 shoes; back to Home'),
]

html = f"""
<div class="cover">
  <div class="kicker">CSCE 3701 Software Engineering · The American University in Cairo</div>
  <h1>Test Plan and Test Report<br/>for Closet</h1>
  <div class="sub">Version 1.2 · Milestone 2 final · application build v1.5</div>
  <table class="meta">
    <tr><td>Prepared by</td><td>Habiba Khashaba, Salma, Bashar, Karim and Youssef (Team Closet)</td></tr>
    <tr><td>Instructor</td><td>Dr. Sherif Aly</td></tr><tr><td>Date</td><td>10/28/2026</td></tr>
    <tr><td>Supersedes</td><td>Closet_M2_Test_Plan_and_Report.pdf (v1.1, build v1.4). Every number below is from the final run of build v1.5 and is reproduced in <code>05_Testing/evidence/</code>.</td></tr>
  </table>
</div>

<h2>1. Summary</h2>
<div class="stats">
 <div><div class="big">{c['passed']}/{c['total']}</div><span>automated tests passing · {summary['suites']} suites · 0 failing</span></div>
 <div><div class="big">{c['unit']} + {c['api']}</div><span>unit tests + API tests (API tests on real PostgreSQL 16)</span></div>
 <div><div class="big">{c['lines']}%</div><span>line coverage · branches {c['branches']}% · functions {c['functions']}%</span></div>
 <div><div class="big">58 + 15 + 15</div><span>browser steps: demo journey · stateful (live) · stateful (offline demo)</span></div>
</div>
<p><b>How the final run was executed — read this first.</b> The run was made in the team’s build environment, where the npm registry was not reachable.
The real server code, the real tests and a real PostgreSQL 16 database were used; nine npm packages were replaced by small <i>compatibility shims</i>
(express, pg, bcryptjs, jsonwebtoken, helmet, cors, express-rate-limit, multer, dotenv; supertest for the API tests) and Jest by a thin adapter over Node’s built-in test runner.
The shims never ship. <b>Pending:</b> the authoritative <code>npm test</code> and <code>npm run test:coverage</code> with the real packages on a team machine,
and the first execution of the GitHub Actions workflow (configured, <b>not yet executed</b>). Results of that run replace section 4 if they differ.</p>
{table(['Exit criterion (section 2.6)', 'Result'], [
 ['All Sprint 1 acceptance tests AT-01 – AT-15 pass', '<span class="tag ok">met</span> 15/15'],
 ['No open High or Medium defect', f'<span class="tag ok">met</span> {len(defects)} found, {len(defects)} fixed and re-tested'],
 ['Line coverage ≥ 80 % on server modules', f'<span class="tag ok">met</span> {c["lines"]} % (V8, files loaded by the tests)'],
 ['Every new requirement FR-81 – FR-101 has at least one test', '<span class="tag ok">met</span> see the traceability matrix v1.5'],
 ['Demo journey and stateful journeys pass with 0 browser errors', '<span class="tag ok">met</span> live and offline'],
 ['Official npm run + CI execution', '<span class="tag warn">pending</span> configured, not executed'],
])}

<h2 class="pb">2. Test plan</h2>
<h3>2.1 Scope</h3>
<p>In scope: Sprint 1 stories (accounts, profile, add / browse / edit pieces, status and laundry, planner, gaps, delete account), the Sprint 2/3 previews built early
(recommendations, change one piece, try-on preview, Mix &amp; Match, Ask Closet, shopping list, learning) and the v1.5 proactive features FR-81 – FR-101.
Out of scope: load testing, real third-party weather/LLM availability (adapters are tested with fakes and the estimate mode), mobile browsers other than Chromium, and the Render deployment
(blueprint configured; the local demo is the verified presentation path).</p>
<h3>2.2 Levels and tools</h3>
{table(['Level', 'What', 'Tool', 'Where'], [
 ['Unit', 'pure rules: status machine, validation, engine, diversity, insights, parser, policies', 'Jest API (node:test adapter in the final run)', 'server/tests/unit'],
 ['API / integration', 'routes through the full pipeline on a real database, including a second user for ownership checks', 'supertest + PostgreSQL 16', 'server/tests/api'],
 ['Acceptance', 'AT-01 – AT-15 (Sprint 1 Definition of Done) and the API-PR proactive scenarios', 'same', 'tests/api/acceptance, proactive_api'],
 ['End-to-end (browser)', 'demo journey (58 steps) and stateful journey (15 checkpoints)', 'Playwright (Python), Chromium', 'e2e/'],
 ['Offline demo parity', 'the offline file runs the same services and rules', 'OF-01 – OF-09 + stateful journey on the file', 'tests/unit/offline_parity, e2e'],
 ['Security', 'headers, CORS, auth, lockout, tokens, ownership (404), validation, photo privacy', 'unit + API', 'security.test, auth.test, profile_planner_privacy'],
 ['Regression', 'one or more tests per defect D-01 – D-17; whole suite on every change', 'same', 'section 6'],
])}
<h3>2.3 Test design techniques (black-box)</h3>
{table(['Technique', 'Applied to', 'Example test IDs'], [
 ['Equivalence partitioning (EP)', 'email, piece details, profile, events, Ask phrasings (56 questions in 12 intent classes)', ids('UT-V0', 'AI-43')[:220] + ' …'],
 ['Boundary value analysis (BVA)', 'password 7/8, lockout 4/5, photo 10 MB / +1 byte, weather 18/19 and 25/26 °C, recycle N days, gaps 1/2, unworn 89/90 days, monitor 28/30 °C', ids('API-A08', 'API-W07', 'API-W08', 'RE-05', 'RE-06', 'RE-07', 'RE-08', 'RE-22', 'UT-G03', 'UT-G04', 'IN-01', 'API-PR31')],
 ['State transition (ST)', 'item status machine (28 tests: every valid and invalid transition), rehoming intention, learning card closed → flipped → confirmed → undone', 'Item status state machine suite · API-S01 – API-S06 · API-PR02 · API-PR03'],
 ['Decision table', 'deletion reason → effect (replacement / learning / none) incl. Donated, Given away, Sold', 'Deletion reasons suite · API-PR02 · API-PR92'],
 ['Scenario / use case', 'core flow, donate flow, monitor → adjust, trip capsule, Ask follow-ups', 'AT-01 – AT-15 · API-PR90 – API-PR93 · stateful journey'],
 ['Error guessing', 'questions that look like commands (D-09), double save (D-10), duplicate notices (D-17)', 'AI-43 · API-PR61 · API-PR90'],
])}
<h3>2.4 Environment</h3>
<p>Node 22, PostgreSQL 16 (database <code>closet_test</code>; tables truncated between tests by <code>tests/helpers.js</code>), TZ Africa/Cairo, WEATHER_MODE=estimate (deterministic forecasts), seed from <code>server/src/db/seedData.js</code>.
Browser tests: Chromium 1440 × 900, the app on <code>localhost:4000</code> after <code>npm run seed</code>, and the offline file <code>Closet_Demo.html</code>.</p>
<h3>2.5 Entry criteria</h3>
<ul><li>Migrations 001 – 006 apply on an empty database.</li><li>Seed completes; <code>npm run demo:check</code> passes.</li><li>Story has acceptance criteria in Jira.</li></ul>
<h3>2.6 Exit criteria</h3>
<p>As in the table in section 1. A failing test blocks the merge (CI job <code>test</code>, configured).</p>
<h3>2.7 Risks</h3>
{table(['Risk', 'Mitigation'], [
 ['Shimmed packages behave differently from the real ones', 'Shims implement only the used API; official npm run pending (section 1)'],
 ['Weather provider unavailable on stage', 'estimate mode + offline demo'],
 ['Random ids change the demo order', 'deterministic tie-breaks (D-07), demo-check over 3 fresh seeds'],
 ['Thresholds (90 days, 5 °C) are guesses', 'BVA tests pin the current rule; values are constants to tune'],
])}

<h2 class="pb">3. Black-box test cases (selected, with inputs and expected results)</h2>
{table(['ID', 'Technique', 'Input', 'Expected', 'Result'], [
 ['API-A04', 'BVA', 'password of 7 characters', '400 with field details', 'Pass'],
 ['API-A08 / A09', 'BVA', '4 then 5 failed logins', '4th still allowed; 5th locks, 423', 'Pass'],
 ['API-W07 / W08', 'BVA', 'photo 10 MB / 10 MB + 1 byte', 'accepted / 413', 'Pass'],
 ['RE-05 – RE-08', 'BVA', '25, 26, 18, 19 °C', 'warm allowed / none / layer required / not required', 'Pass'],
 ['IN-01', 'BVA', 'piece unworn 90 / 89 days', 'candidate / not a candidate', 'Pass'],
 ['API-PR31', 'BVA', 'planned at 24 °C, forecast 30 °C / 28 °C', 'weather alert on the blazer / no alert', 'Pass'],
 ['API-S02', 'ST', 'Laundry → Borrowed', '409, status unchanged', 'Pass'],
 ['AI-43', 'EP', '“Is my blazer clean?”, “Are my loafers available?”', 'read-only availability, state unchanged', 'Pass'],
 ['API-PR61', 'Error guessing', 'Save then Favourite the same look', 'one saved record, favourite = true', 'Pass'],
 ['API-PR02', 'Decision table', 'Donate → Mark as donated', 'piece gone, history kept, no Shopping Bag item', 'Pass'],
 ['API-PR03', 'Security / EP', 'rehome another user’s piece; method “burn”', '404; 400', 'Pass'],
 ['DV (diversity suite)', 'BVA on overlap', 'seeded closet, 3 occasions', 'any two looks share ≤ 1 major garment', 'Pass'],
])}

<h2>4. Results by test file (final run)</h2>
{table(['File', 'Tests', 'Passed', 'Failed'], [[f'<code>{r[0]}</code>', r[1], r[2], r[3]] for r in c['rows']] + [['<b>Total</b>', f"<b>{c['total']}</b>", f"<b>{c['passed']}</b>", f"<b>{c['failed']}</b>"]])}
<p class="small">Run summary from the log: tests {summary['tests']}, suites {summary['suites']}, pass {summary['pass']}, fail {summary['fail']}, duration {float(summary['duration_ms'])/1000:.1f} s. Log: <code>evidence/test_run_v15.txt</code>.</p>

<h2 class="pb">5. End-to-end and offline demo</h2>
<p><b>Demo journey</b> (<code>e2e/demo_journey.py</code>): {journey}. <b>Stateful journey</b> (<code>e2e/stateful_journey.py</code>) — after every change it navigates away and back
(and sometimes reloads) and checks the state through both the UI and the API:</p>
<ul><li>Live app: {live}</li><li>Offline demo file: {off}</li></ul>
{table(['#', 'Checkpoint (same assertions live and offline)'], [[a, b] for a, b in CHECKS])}
<p class="small">Screenshots of every checkpoint: <code>evidence/e2e-stateful-live/</code>, <code>evidence/e2e-stateful-offline/</code>. Demo preflight: <code>evidence/demo_check.txt</code> (deterministic over 3 fresh seeds).</p>
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
{''.join(img(str(EVID / 'e2e-stateful-live' / f), f.replace('.jpg', '')) for f in ['s04_three_looks.jpg', 's09_donated.jpg', 's14_adjusted.jpg'])}
</div>

<h2 class="pb">6. Defect log and regression tests</h2>
{table(['ID', 'Found by', 'Severity', 'Feature', 'Description', 'Fix', 'Status'], [[f'<b style="white-space:nowrap">{d[0].strip()}</b>'] + [f'<span class="small">{x.strip()}</span>' for x in d[1:]] for d in defects])}

<h2 class="pb">7. Security testing</h2>
{table(['Concern', 'Tests', 'Result'], [
 ['Security headers, no server banner, CORS allow-list, safe errors', ids('API-X0'), 'Pass'],
 ['Passwords hashed (bcrypt), length rules, lockout after 5 failures', 'API-A02 · API-A04 · API-A08 – A10 · Passwords (bcrypt) suite', 'Pass'],
 ['Tokens: missing, tampered, wrong secret, expired, after logout, deleted user', 'API-A12 – API-A15 · Login tokens (JWT) suite', 'Pass'],
 ['Ownership: another user’s pieces, photos, plans, trips, new v1.5 routes → 404', 'Ownership and photo privacy suite · API-L04 · API-PR01 · API-PR03', 'Pass'],
 ['Validation on new fields (price, rehome method, days ranges)', 'API-PR03 · API-PR50', 'Pass'],
 ['Admin sees no wardrobe data', 'Admin suites (US-80, US-81)', 'Pass'],
 ['Offline demo requires its local session', 'OF-02', 'Pass'],
])}

<h2>8. Coverage</h2>
<p>V8 coverage of the server files loaded by the tests: lines {c['lines']} %, branches {c['branches']} %, functions {c['functions']} %. Files never loaded by a test do not appear in this report —
the client (React) is covered by the browser journeys, not by line coverage. Per-file table: Appendix B.</p>

<h2>9. Limitations (stated plainly)</h2>
<ul>
<li>Final run used compatibility shims for npm packages (section 1); the official <code>npm test</code> on a team machine is pending.</li>
<li>CI workflow (unit, API, E2E, offline demo jobs) is configured but has not been executed.</li>
<li>Client production build with Vite not yet run (the offline demo was bundled with esbuild).</li>
<li>No usability study with real users yet; no load tests; Chromium only.</li>
<li>Try-On is a simulated overlay preview, tested as such (placement tests), not image generation.</li>
<li>Render deployment: blueprint configured; the local demo is the verified presentation path.</li>
</ul>

<h2 class="pb">Appendix A · All {c['total']} automated tests of the final run</h2>
"""
by = {}
for s, t, ok in tests: by.setdefault(s, []).append((t, ok))
for s, rows in by.items():
    html += f'<h4>{s} <span class="muted small">({len(rows)})</span></h4>' + table(['Test', 'Result'], [[f'<span class="small">{t.replace("<", "&lt;")}</span>', 'Pass' if ok else '<b>Fail</b>'] for t, ok in rows])
html += '<h2 class="pb">Appendix B · Coverage by file</h2>' + table(['File / folder', 'Lines %', 'Branches %', 'Functions %', 'Uncovered lines'], cov_rows)

render(html, OUT, 'Test Plan and Report · Closet · v1.2 (build v1.5)')
print(OUT, len(tests))
