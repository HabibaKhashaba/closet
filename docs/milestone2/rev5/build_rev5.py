# Revision 5 (build v1.6): SRS v1.3, SDD v1.3, Test Plan and Report v1.3, Traceability v1.6, API table v1.6.
# Same method as revision 4: new front matter + the previous version as the tracked baseline. Every number
# below is read from docs/milestone2/evidence/v16/ (written by the real runs), never typed in.
import pathlib, re, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / 'rev4'))
from docbase import render, merge, table, img  # noqa: E402
from reqs_v16 import FRS, NFRS, BRS, CHANGES, API, STORIES  # noqa: E402
import openpyxl  # noqa: E402
from openpyxl.styles import PatternFill  # noqa: E402

REPO = pathlib.Path(__file__).resolve().parents[3]
M2 = REPO / 'docs/milestone2'; FINAL = M2 / 'final'; EV = M2 / 'evidence/v16'
OUT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else FINAL)
GREEN = PatternFill('solid', fgColor='E3F2E6')
DATE = '10/29/2026'

def evidence():
    rows = [l.split(',') for l in (EV / 'counts_v16.csv').read_text().splitlines()[1:]]
    tot = sum(int(r[1]) for r in rows); ok = sum(int(r[2]) for r in rows); bad = sum(int(r[3]) for r in rows)
    run = (EV / 'test_run_v16.txt').read_text()
    t = int(re.search(r'^ℹ tests (\d+)', run, re.M).group(1)); p = int(re.search(r'^ℹ pass (\d+)', run, re.M).group(1)); f = int(re.search(r'^ℹ fail (\d+)', run, re.M).group(1))
    assert (t, p, f) == (tot, ok, bad), 'per-file counts and the full run disagree'
    cov = next(l for l in (EV / 'coverage_v16.txt').read_text().splitlines() if 'all files' in l).split('|')
    e2e = {}
    for n in ['demo_live', 'stateful_live', 'lifecycle_live', 'stateful_offline', 'lifecycle_offline']:
        last = (EV / f'e2e_{n}.txt').read_text().strip().splitlines()[-1]
        e2e[n] = last
    dc = (EV / 'demo_check.txt').read_text()
    return {'rows': rows, 'total': t, 'passed': p, 'failed': f, 'unit': sum(int(r[1]) for r in rows if '/unit/' in r[0]), 'api': sum(int(r[1]) for r in rows if '/api/' in r[0]),
            'lines': cov[1].strip(), 'branches': cov[2].strip(), 'functions': cov[3].strip(), 'e2e': e2e,
            'demo_runs': dc.count('=== fresh seed'), 'demo_ok': dc.count('Ready: every demo check passed.')}

E = evidence()
VIDEO = '5:33 (332.7 s)'

def cover(title, version, extra=''):
    return f'''<div class="cover"><div class="kicker">CSCE 3701 · Team Closet · Milestone 2 final</div><h1>{title}</h1>
  <div class="sub">Version {version} · revision 5 · application build v1.6</div>
  <table class="meta"><tr><td>Team</td><td>Habiba · Salma · Bashar · Karim · Youssef</td></tr><tr><td>Date</td><td>{DATE}</td></tr>{extra}</table></div>'''

# ---------------------------------------------------------------- SRS v1.3
def srs():
    html = cover('Software Requirements Specification', '1.3', '<tr><td>How to read it</td><td>The first pages (header “v1.3 (rev. 5)”) are revision 5. The v1.2 revision 4 document follows unchanged as the tracked baseline; where revision 5 supersedes it, R5.1 says so — the newer statement wins.</td></tr>')
    html += '<h2>Revision history (revision 5 added)</h2>' + table(['Author', 'Date', 'Change', 'Version'], [
        ['Team (final pass)', '10/28/2026', 'Revision 4 (build v1.5): proactive intelligence FR-81 – FR-101', '1.2'],
        ['<b>Team (corrections)</b>', f'<b>{DATE}</b>', '<b>Revision 5 (build v1.6): one garment lifecycle, Care (repairs, alterations, tailor), Borrow &amp; lend, donate-only Donation, Home Wardrobe status, UI entry points, purchase check by name, Ask Closet 35 functions. FR-102 – FR-113, changes C-85 – C-97.</b>', '<b>1.3</b>']])
    html += '<h2>R5.1 What changed in revision 5</h2>' + table(['Baseline statement (v1.2)', 'Now (v1.3)'], [
        ['FR-27 – FR-29: five statuses (Available, Laundry, Borrowed, Packed, Unavailable)', 'FR-102: nine states, 21 transitions; Donated is an archive, not a state'],
        ['FR-83: Ready to donate / give / sell as a separate rehoming record', 'FR-106: donate only; Ready to donate is a state; Donation area'],
        ['FR-90: borrow tracker on the piece page and Home', 'FR-105: Borrow &amp; lend area with a lend form and history'],
        ['“Repair” = status Unavailable with a free-text note', 'FR-103, FR-104: Care → Repairs &amp; alterations, tailor, reminder, Mark collected'],
        ['FR-86 – FR-88, FR-93, FR-96 reachable only through Ask Closet or the API', 'FR-109, FR-110, FR-113: visible entry points in the app'],
        ['FR-94: purchase check by category and colour', 'FR-111: also by item name; five named result blocks'],
        ['FR-99: 31 functions', 'FR-112: 35 functions'],
        ['SDD v1.2 design decision “rehoming is not a status”', 'Reversed (SDD v1.3 R5.2)']])
    html += '<h2 class="pb">R5.2 Section 4.22 · Garment lifecycle, care, lending and donation</h2>'
    html += '<p class="small">Release: <b>Sprint 3 · built early in v1.6</b> (labelled “Sprint 3 · preview” in the app). Stories US-112 – US-117 are <b>proposed, not yet in Jira</b>.</p>'
    html += table(['ID', 'Requirement', 'Story', 'Screen'], [[f'<b>{f[0]}</b>', f[1], f[2], f[3]] for f in FRS])
    html += '<h2>R5.3 Non-functional and business rules</h2>' + table(['ID', 'Requirement', 'Verified by'], [[f'<b>{n[0]}</b>', n[1], n[2]] for n in NFRS])
    html += table(['ID', 'Rule'], [[f'<b>{b[0]}</b>', b[1]] for b in BRS])
    html += '<h2 class="pb">R5.4 State model</h2>' + img('D24_state_v16.png', 'Figure R5-1 (D24). The one garment lifecycle (supersedes D21 and the v1.1 state machine figure).')
    html += '<h2>R5.5 Change log C-85 – C-97</h2>' + table(['ID', 'Type', 'Section', 'Change'], [list(c) for c in CHANGES])
    html += '<h2>R5.6 Traceability (excerpt)</h2>' + table(['FR', 'API', 'Tests', 'Demo step'], [[f[0], f[4], f[7], f[8]] for f in FRS])
    html += f'<p class="small">Full matrix: <code>Closet_Traceability_Matrix_v1.6.xlsx</code>. Final run: {E["passed"]}/{E["total"]} tests passing (how they were executed: Test Plan and Report v1.3).</p>'
    html += '<p class="note">The baseline v1.2 revision 4 specification follows.</p>'
    front = render(html, OUT / '_srs5.pdf', 'Software Requirements Specification · Closet · v1.3 (rev. 5)')
    merge([(front, None), (FINAL / 'Closet_SRS_v1.2.pdf', None)], OUT / 'Closet_SRS_v1.3.pdf'); front.unlink()

# ---------------------------------------------------------------- SDD v1.3
def sdd():
    html = cover('Software Design Document', '1.3', '<tr><td>How to read it</td><td>Pages headed “v1.3 (rev. 5)” describe the v1.6 design: diagrams D24 – D26, the lifecycle module and the new routes. The v1.2 SDD follows as the baseline.</td></tr>')
    html += '<h2>R5.1 What changed in the design</h2>' + table(['Baseline (v1.2)', 'Now (v1.3, build v1.6)', 'Section'], [
        ['D21 status machine (5) + separate rehoming lifecycle', 'D24: one lifecycle, 9 states, 21 transitions', 'R5.3'],
        ['D20 data: wardrobe.rehoming', 'D25: availability.care_jobs, availability.loans; rehoming converted and dropped (migration 007)', 'R5.4'],
        ['Status rules spread over Availability, Wardrobe and Insights', 'shared/lifecycle.js: states, transitions, labels, isWearable / isOwned / isLeaving / inCare', 'R5.3'],
        ['Rehome routes (/items/:id/rehome)', 'Care, lending and donation routes (R5.6); rehome routes removed', 'R5.6'],
        ['Wardrobe navigation: Closet, Laundry', 'Closet · Care · Borrow &amp; lend · Donation', 'R5.7']])
    html += '''<h2>R5.2 Design decision reversed · “rehoming is not a status”</h2>
<p>v1.5 kept “Ready to donate / give / sell” in its own table so the tested five-status machine stayed unchanged. In use, this gave two sources of truth:
a piece could be Available <i>and</i> rehoming, and every module had to remember to check both (the v1.6 audit found the forgotten list, purchase impact and
health each handling it differently). v1.6 makes <b>Ready to donate a lifecycle state</b>, adds the care and lending states, and keeps the rule
“leaving the closet is a delete with a reason, never a state”. Cost: the state machine grew from 25 to 81 tested ordered pairs (ST-01 – ST-06).</p>'''
    html += '<h2 class="pb">R5.3 The lifecycle module and the single write path</h2>' + img('D24_state_v16.png', 'Figure R5-1 (D24). One garment lifecycle.')
    html += '''<p><code>shared/lifecycle.js</code> is the only place that knows the states. <code>Availability.setStatus(user, item, to, opts)</code> is the only write path:
moving into Borrowed opens a loan and moving out closes it; moving into Needs repair / alteration opens a care job; At tailor updates the job (tailor, sent, expected back, cost);
a care state → Available closes the job (collected / fixed); → Ready to donate closes it as donated. Transitions not in ALLOWED fail with 409. Dates are UTC days (NFR-19).</p>'''
    html += '<h2 class="pb">R5.4 Data (migration 007)</h2>' + img('D25_er_v16.png', 'Figure R5-2 (D25). ER additions in v1.6.')
    html += '<h2 class="pb">R5.5 Sequence · alteration at the tailor</h2>' + img('D26_sequence_tailor.png', 'Figure R5-3 (D26). Black blazer: Needs alteration → At tailor → TAILOR_READY → Mark collected.')
    html += '<h2 class="pb">R5.6 API additions and changes (build v1.6)</h2><p class="small">All under <code>/api/v1</code>, behind the security pipeline. Full table: <code>Closet_API_Table_v1.6.xlsx</code>.</p>'
    html += table(['Method', 'Route', 'Purpose', 'Auth', 'Request', 'Response', 'Errors'], [list(a) for a in API])
    html += '''<h2>R5.7 Web app</h2><ul>
<li>Navigation, Wardrobe group: Closet · Care (tabs Laundry, Repairs &amp; alterations) · Borrow &amp; lend · Donation.</li>
<li>Piece page: simple moves as buttons; Repair / Alter, Lend item and Donate under “More actions”, each a short form (RepairModal, TailorModal, LendModal).</li>
<li>Home: Wardrobe status with clickable state lines. Style me: repeat notice on the card, Rescue panel. Planner: Plan several days. Closet gaps: confidence and reasons.
Shopping: five result blocks. Analytics: outfit-memory search, Wear again, Create a variation, donated count.</li>
<li>The offline demo mounts the same services and request schemas on in-memory repositories (careJobs, loans).</li></ul>'''
    html += '<p class="note">The baseline v1.2 SDD follows.</p>'
    front = render(html, OUT / '_sdd5.pdf', 'Software Design Document · Closet · v1.3 (rev. 5)')
    merge([(front, None), (FINAL / 'Closet_SDD_v1.2.pdf', None)], OUT / 'Closet_SDD_v1.3.pdf'); front.unlink()

# ---------------------------------------------------------------- Test Plan and Report v1.3
def tpr():
    e = E['e2e']
    html = cover('Test Plan and Report', '1.3', '<tr><td>Supersedes</td><td>v1.2 (build v1.5). Every number below is from the final runs of build v1.6, stored in <code>evidence/v16/</code>. The v1.2 report is appended unchanged as history; its numbers are superseded.</td></tr>')
    html += f'''<h2>R5.1 Results at a glance</h2><div class="stats">
<div><div class="big">{E["passed"]}/{E["total"]}</div><span>tests passing · {E["failed"]} failing</span></div>
<div><div class="big">{E["unit"]} · {E["api"]}</div><span>unit · API (real PostgreSQL 16)</span></div>
<div><div class="big">{E["lines"]} %</div><span>line coverage · branches {E["branches"]} % · functions {E["functions"]} %</span></div>
<div><div class="big">{E["demo_ok"]}/{E["demo_runs"]}</div><span>demo checks on fresh seeds</span></div></div>'''
    html += '<h2>R5.2 How the tests were run</h2><p>Two environments, in this order. <b>(1) Sandbox:</b> the npm registry was blocked, so the suites ran under <code>node:test</code> with small compatibility shims for Jest, Supertest, Express and pg, against a real PostgreSQL 16; the web app was bundled with esbuild. The per-file counts, coverage and journey results in R5.1, R5.3 and R5.4 are from that run. <b>(2) GitHub Actions, real packages:</b> Jest 29, Supertest, Express, pg, Vite 7 and React 19 on Ubuntu runners with a PostgreSQL 16 service. The first runs found three problems the shims hid (D-26 – D-28, R5.3a). <b>CI #5: all four jobs green, 599 / 599 under real Jest.</b></p>'
    ci = [
      ['<a href="https://github.com/HabibaKhashaba/closet/actions/runs/40896887495">CI #1</a>', 'Failure', 'server: 596 passed, 3 failed (TO-01 – TO-03 could not import() a browser ES module in real Jest)', 'D-26'],
      ['<a href="https://github.com/HabibaKhashaba/closet/actions/runs/40899146697">CI #2</a>', 'Failure', 'server green (599 / 599); e2e: an extra Planner weather alert, because the seed stored a live forecast', 'D-27'],
      ['<a href="https://github.com/HabibaKhashaba/closet/actions/runs/40902206778">CI #3</a>', 'Failure', 'three browser journeys pass; the final demo check ran without a re-seed', 'D-28'],
      ['<a href="https://github.com/HabibaKhashaba/closet/actions/runs/40902620249">CI #4</a>', 'Failure', 'same final step', 'D-28'],
      ['<a href="https://github.com/HabibaKhashaba/closet/actions/runs/40905244684">CI #5</a>', '<span class="tag ok">Success</span>', 'all four jobs green: server tests, Vite build, 3 live journeys + demo check, offline demo (6 min 8 s)', '—']]
    html += '<h3>R5.3a GitHub Actions runs (29 Oct 2026)</h3>' + table(['Run', 'Result', 'What it showed', 'Defect'], ci)
    html += '<p class="small">Coverage under real Jest is in the CI <code>coverage-report</code> artifact; the percentages above are from the sandbox run. Full history: <code>evidence/v16/ci_runs.md</code>.</p>'
    html += '<h2>R5.3 Per test file</h2>' + table(['File', 'Executed', 'Passed', 'Failed'], [[f'<code>{r[0]}</code>', r[1], r[2], r[3]] for r in E['rows']])
    html += '<h2 class="pb">R5.4 Browser journeys (Playwright, Chromium)</h2>' + table(['Journey', 'Target', 'Result'], [
        ['demo_journey.py (presentation flow)', 'live app', e['demo_live']], ['stateful_journey.py', 'live app', e['stateful_live']], ['lifecycle_journey.py (care, lend, donate, pack, purchase, planner)', 'live app', e['lifecycle_live']],
        ['stateful_journey.py', 'offline demo', e['stateful_offline']], ['lifecycle_journey.py', 'offline demo', e['lifecycle_offline']]])
    html += '<p class="small">lifecycle_journey.py was also run 5 times in a row after defect D-22 was fixed: 5/5 passed. Before the fix it failed 1 of about 8 runs.</p>'
    html += f'<h2>R5.5 Demo recording</h2><p>The 13-step walkthrough was re-recorded after the last correction on a fresh seed: <b>{VIDEO}</b>. Frames of the shopping, donation, Ask Closet and final Home steps were checked by eye; this review found D-19 and D-23 (both fixed, then re-recorded).</p>'
    html += '<h2>R5.6 New tests in v1.6</h2>' + table(['IDs', 'Technique', 'What they show'], [
        ['ST-01 – ST-06', 'State transition', 'all 81 ordered pairs of the 9 states: 21 allowed, 60 rejected with 409; loans / care jobs opened and closed with the status'],
        ['LF-01 – LF-06', 'EP · decision table', 'lifecycle helpers; seeded closet; message wording (D-23)'],
        ['LF-10 – LF-12', 'EP over prompts', '22 v1.6 Ask Closet prompts route to the right function with the right arguments; donate only'],
        ['LC-01 – LC-04', 'Scenario', 'exact Black blazer flow: Needs alteration → tailor → left out of looks → reminder → Mark collected'],
        ['LC-10 – LC-12', 'Scenario · BVA', 'lend with dates, overdue, Planner conflict, return keeps history'],
        ['LC-20 – LC-23, LC-30', 'Scenario', 'multi-day plan skips non-wearable states; purchase impact ignores Ready to donate; rescue with and without a formal piece'],
        ['OF-10 – OF-11', 'Parity', 'care and lending on the offline demo']])
    defects = [l for l in (EV / 'defects_v16.md').read_text().splitlines() if re.match(r'\| D-(1[89]|2\d) ', l)]
    html += '<h2 class="pb">R5.7 Defects found in this pass</h2>' + table(['ID', 'Found by', 'Severity', 'Feature', 'Description', 'Fix', 'Status'], [l.strip('|').split(' | ') for l in defects])
    html += '''<h2>R5.8 Not verified</h2><ul>
<li>Real-Jest coverage percentages (in the CI artifact, not transcribed).</li><li>The interactive PowerPoint deck’s playback.</li>
<li>Deployment: Render blueprint configured; the local demo is the verified presentation path.</li><li>Jira: proposed stories US-112 – US-117 are not in Jira; no screenshots were produced.</li></ul>'''
    html += '<p class="note">The superseded v1.2 report (build v1.5) follows as history.</p>'
    front = render(html, OUT / '_tpr5.pdf', 'Test Plan and Report · Closet · v1.3 (build v1.6)')
    merge([(front, None), (FINAL / 'Closet_M2_Test_Plan_and_Report_v1.2.pdf', None)], OUT / 'Closet_M2_Test_Plan_and_Report_v1.3.pdf'); front.unlink()

# ---------------------------------------------------------------- workbooks
def xlsx():
    wb = openpyxl.load_workbook(FINAL / 'Closet_Traceability_Matrix_v1.5.xlsx')
    ws = wb['Traceability v1.5']; ws.title = 'Traceability v1.6'
    for f in FRS:
        ws.append([f[0], f[3], f[1], '—', f[2], f[5], f[4], f[7], 'S3 · built early (v1.6 preview); story proposed, not yet in Jira'])
        for c in ws[ws.max_row]: c.fill = GREEN
    for n in NFRS:
        ws.append([n[0], 'Non-functional', n[1], '—', '—', 'shared/lifecycle.js · Availability', '—', n[2], 'v1.6'])
        for c in ws[ws.max_row]: c.fill = GREEN
    if 'Read me' in wb.sheetnames:
        wb['Read me'].append([f'v1.6 (revision 5, {DATE}): rows FR-102 – FR-113 and NFR-17 / 18 (extended), NFR-19 added (green). Tests ran {E["passed"]}/{E["total"]}. Stories US-112 – US-117 are proposed, not in Jira.'])
    wb.save(OUT / 'Closet_Traceability_Matrix_v1.6.xlsx')
    wb = openpyxl.load_workbook(FINAL / 'Closet_API_Table_v1.5.xlsx')
    ws = wb['API v1.5']; ws.title = 'API v1.6'
    n = ws.max_row - 1
    for a in API:
        n += 1; ws.append([n, a[0], a[1], a[3].replace('JWT', 'Auth'), 'Lifecycle / care / lending / donation (v1.6)', 'S3 preview (v1.6)'])
        for c in ws[ws.max_row]: c.fill = GREEN
    ch = wb.create_sheet('v1.6 changes', 1); ch.append(['Method', 'Route', 'Purpose', 'Auth', 'Request', 'Response', 'Errors'])
    for a in API: ch.append(list(a))
    if 'Notes' in wb.sheetnames:
        wb['Notes'].append(['v1.6: new routes appended (green); sheet “v1.6 changes” has request / response / errors (same as SDD v1.3 R5.6). /items/:id/rehome was removed.'])
    wb.save(OUT / 'Closet_API_Table_v1.6.xlsx')

if __name__ == '__main__':
    srs(); sdd(); tpr(); xlsx()
    print(f'built in {OUT}: tests {E["passed"]}/{E["total"]}, coverage {E["lines"]} %, e2e {E["e2e"]}')
