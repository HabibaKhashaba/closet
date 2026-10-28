# Presenter pack, demo script and retrospective addendum (Milestone 2 final, build v1.5).
import re, sys, pathlib
from docbase import render, merge, table, counts, EVID, REPO
OUT = pathlib.Path(sys.argv[1]); DECKMD = pathlib.Path(sys.argv[2]); RETRO = pathlib.Path(sys.argv[3])
c = counts()
t = DECKMD.read_text()
parts = re.split(r'<!-- Slide number: (\d+) -->', t)
flow = []
for i in range(1, len(parts), 2):
    b = parts[i + 1]; m = re.search(r'### Notes:\s*(.*)', b, re.S)
    note = (m.group(1).strip() if m else '').replace('\n', ' ')
    pm = re.match(r'([A-Z]{4,8})(?: / [A-Z]+)?\b(?: \(([\d:–-]+(?: min)?)\))?', note)
    if pm and pm.group(2): flow.append([parts[i], pm.group(1).title(), pm.group(2), note[len(pm.group(0)):].lstrip('. ')[:230]])

STEPS = [
 ('Home', 'Today’s look, 30 °C estimate, Closet noticed (≤ 2 notices), Still love it? denim jacket · 104 days', '“This is Closet on a normal Wednesday. It already noticed two things for us.”'),
 ('Closet → Navy blazer → In laundry', 'Badge Laundry; basket shows 4 pieces', '“One status per piece — and it travels everywhere.”'),
 ('Laundry → Wash done', '“Available again.”, basket empty', '“One tap and everything is clean.”'),
 ('Style me → University → Generate 3 looks', 'Campus Stripes · Clean Oxford · Relaxed Midi; any two share ≤ 1 major garment', '“Three looks — three different directions, not the same outfit with other shoes.”'),
 ('Click the top of LOOK 01', 'Tray: Blue Oxford 99 % · Sage linen 99 % · Red cropped tee 90 %', '“Only that piece changes; the score moves with it.”'),
 ('Try on → avatar or consenting photo → next → Favourite', '“Virtual Try-On Preview” label; one saved record', '“A simulated preview on your photo — it never leaves the browser.”'),
 ('Home → Still love it? → Style it', '3 looks, every one with the denim jacket', '“A forgotten piece, styled three ways.”'),
 ('Closet → Denim jacket → donate it → Donate → Mark as donated', 'Ready to donate first; then gone, history kept, nothing added to the bag', '“Or pass it on. No replacement is suggested — that is the point.”'),
 ('Mix & Match → Work → suggested look → Red cropped tee → Suggest a fix', '98 % → 82 % → 98 %', '“It tells you why, and fixes one piece.”'),
 ('Closet → Silk scarf → Remove → Torn / damaged', 'Shopping bag: Silk scarf · Replacement', '“Why it leaves decides what happens next.”'),
 ('Ask Closet: beige trousers → Add this → Is my blazer clean? → Who has my rose wrap dress?', '“You already own 2 similar…”; Added by Ask Closet; “Available”; “with Nour for 12 days”', '“Questions read your real wardrobe — and never change it.”'),
 ('Planner → weather alert → Adjust outfit', '24 °C → 30 °C; only the blazer changes', '“Planned yesterday, warned today.”'),
 ('Analytics → Closet has learned → flip → Confirm → Undo', 'Cards closed; Confirm saves; Undo restores', '“Nothing changes until you confirm.”'),
 ('Home', '28 pieces; every change stored', '“Back home — everything we did is still here.”'),
]
QA = [
 ('Is the AI real?', 'Ask Closet maps a message to one of 31 whitelisted functions. In the demo the keyword parser answers (no API key needed); the optional language-model adapter can only choose among the same functions with a validated schema. Our modules do the work; it never sees photos or the database.'),
 ('How do you know the three looks are really different?', 'Diversity-aware selection: any two looks share at most one major garment when the closet allows (FR-100). Tested by the diversity suite (16 tests) and measured in the browser journey: maximum shared = 1.'),
 ('Is the try-on generated?', 'No. It is a simulated overlay on the user’s photo (Virtual Try-On Preview), labelled so in the app. The photo stays in the browser tab.'),
 ('Why is “Ready to donate” not a status?', 'A status says where a piece is; rehoming is an intention that can coexist with a status and ends in a delete with a reason. Keeping it separate left the tested state machine (28 tests) unchanged.'),
 ('Is CI running? Is it deployed?', 'CI is configured (server, client, e2e, offline-demo jobs); its first run on GitHub is pending. Render blueprint configured; the local demo is the verified presentation path.'),
 ('How were the 497 tests run?', f'Final run: {c["passed"]}/{c["total"]} on a real PostgreSQL 16 database; npm was blocked in our build environment, so small compatibility shims replaced nine packages. The official npm test on a team laptop is pending.'),
 ('Coverage?', f'V8: lines {c["lines"]} %, branches {c["branches"]} %, functions {c["functions"]} % of the server files the tests load. The React client is covered by the browser journeys, not by line coverage.'),
 ('What if the weather service is down?', 'The weather adapter falls back to a seasonal estimate and labels it; the demo uses that mode on purpose so it is repeatable.'),
 ('Are the new routes secure?', 'Same pipeline as every route: validation (400), JWT (401), ownership (another user’s piece → 404). Examples: API-PR01, API-PR03, API-PR50, OF-02.'),
 ('Where are the proactive stories in Jira?', 'They are proposed (US-94 – US-111), not yet in Jira; they were built early as a Sprint 3 preview. The import file is in 02_Sprint.'),
 ('What does the offline demo fake?', 'Nothing in the logic: it runs the same services and rules on in-memory data with the same seed. Only storage (browser session) and weather (estimate) differ. 9 parity tests + the 15-checkpoint journey run on it.'),
 ('What was the hardest bug?', 'D-09: “Is my blazer clean?” used to change the blazer’s status — a question changed state. Questions now route to read-only functions; 56 phrasings are tested.'),
]
SAY = [['497 / 497 tests pass (final run)', '“CI is green”'], [f'Coverage {c["lines"]} / {c["branches"]} / {c["functions"]} %', 'any other coverage figure'], ['Render blueprint configured; local demo verified', '“It is deployed on Render”'],
       ['Try-on is a simulated preview', '“AI-generated try-on”'], ['Proactive stories are proposed, built early', '“They were in our Sprint 1”'], ['Jira screenshots: only real captures', 'a drawn or mocked board']]

html = f"""
<div class="cover"><div class="kicker">CSCE 3701 · Team Closet · Milestone 2 final</div>
<h1>Presenter Pack</h1><div class="sub">Habiba · Salma · Bashar · Karim · Youssef — build v1.5 · interactive deck 136 slides · linear deck 83 slides</div>
<table class="meta"><tr><td>Verified</td><td>{c['passed']}/{c['total']} tests · demo journey 58 steps · stateful journey 15 checkpoints live + 15 offline · demo-check passes · 0 broken links in both decks</td></tr>
<tr><td>Pending</td><td>real Jira and GitHub screenshots · official npm run and first CI run · one rehearsal in PowerPoint desktop (Morph, video) · retake the hand-off picture on the day</td></tr></table></div>

<h2>1. Before you present</h2>
<ol><li>Fonts: install Lora and Inter (06_Presentation/fonts) on the presentation laptop — the deck uses only these two.</li>
<li>Run <code>07_Demo/Demo_Preflight.md</code> (seed, restart, <code>npm run demo:check</code>).</li>
<li>Paste the real Jira captures into the three frames on “Evidence from Jira” (the yellow “SCREENSHOTS PENDING” label can then be deleted).</li>
<li>Retake the hand-off picture: <code>python3 tools/handoff_shot.py handoff.jpg 1920x1080</code> → right-click the picture on the demo slides → Change Picture.</li>
<li>Open the interactive deck once in PowerPoint desktop and click through: Morph, clickable objects and the embedded video were checked structurally here, not played in PowerPoint.</li></ol>

<h2>2. What changed in this version</h2>
{table(['Where', 'Change'], [
 ['Room (hub)', 'Labels numbered 01 Sprint · 02 Product · 03 Inside the system · 04 Quality · 05 Retrospective · 06 Documents; a tick replaces the number once a section is done.'],
 ['After the demo', 'New scene “Closet is becoming proactive” — four real screens: weather changed, laundry risk, trip packing, Still love it?'],
 ['Design', 'v1.5 diagrams after each baseline: use cases (proactive), component, ER additions, state + rehoming, two sequences.'],
 ['Quality', f'Real final numbers: {c["passed"]}/{c["total"]}, {c["unit"]} unit + {c["api"]} API, coverage {c["lines"]} / {c["branches"]} / {c["functions"]} %; CI stated as configured, not executed.'],
 ['Documents', 'SRS v1.2 / SDD v1.2 with the new counts (101 FR, 18 NFR, 30 use cases, 84 + 18 proposed stories, 86 changes).'],
 ['Appendix', 'Proactive features with requirement and test IDs; defect log D-08 – D-17; test plan and results of the final run.'],
 ['Media', 'All app screenshots retaken on build v1.5; the embedded backup video re-recorded (3:43).'],
 ['Notes', 'Every changed slide has updated speaker notes; slide 7’s notes hold the navigation cheat-sheet.'],
])}

<h2 class="pb">3. Talk flow (from the speaker notes of the interactive deck)</h2>
{table(['Slide', 'Who', 'Time', 'What to say / do'], flow)}

<h2 class="pb">4. What you may say — and what you must not</h2>
{table(['Say', 'Never say'], SAY)}

<h2>5. Questions we expect</h2>
{table(['Question', 'Answer'], [[f'<b>{q}</b>', a] for q, a in QA])}
"""
render(html, OUT, 'Presenter Pack · Closet · Milestone 2 final')

demo = f"""
<div class="kicker">CSCE 3701 · Team Closet · Milestone 2 final · build v1.5</div>
<h1>Demo script</h1>
<p>Presenter: Salma. 5–6 minutes. Start state: <code>npm run seed</code>, server restarted with <code>WEATHER_MODE=estimate</code>, <code>npm run demo:check</code> passed, signed in as demo@closet.app on Home.
Backups: <code>Closet_Demo.html</code> (same services and rules, offline) and the embedded recording (3:43).</p>
{table(['#', 'Click', 'You should see', 'Say'], [[str(i + 1), a, b, f'<i>{s}</i>'] for i, (a, b, s) in enumerate(STEPS)])}
<h3>If something goes wrong</h3>
<ul><li>429 or server down: restart the server, sign in again (10 seconds).</li><li>Anything else: switch to the offline demo tab — same flow, same values — or back to PowerPoint → Backup recording.</li>
<li>Never improvise numbers: everything on screen is real data from the seed.</li></ul>
"""
render(demo, OUT.with_name('Demo_Script.pdf'), 'Demo script · Closet · build v1.5')

retro = f"""
<div class="kicker">CSCE 3701 · Team Closet · Milestone 2 final</div>
<h2>Addendum · what the final pass taught us (build v1.5)</h2>
<p class="note">Prepared during the final pass from the defect log and test evidence, for the team to discuss at the Sprint 2 retrospective. It does not replace the team’s own Sprint 1 retrospective (previous page).</p>
{table(['Observation (evidence)', 'Proposed action for Sprint 2'], [
 ['Ten more defects (D-08 – D-17) were found only when we tested <i>state across screens</i> and asked questions in many phrasings — e.g. D-09: a question changed state.', 'Keep the stateful journey (navigate away and back after every change) in the Definition of Done for any story that changes data.'],
 ['D-13: the offline demo replayed recordings, so it could not show a change spreading.', 'A demo or fallback must run the real rules; no recorded answers.'],
 ['D-12: the web app kept its own copy of the status rules and drifted.', 'One source of truth for shared rules (/vocabulary); review for copies.'],
 ['Features built early (proactive, Sprint 3 preview) had no Jira stories.', 'Import the proposed stories into the backlog and estimate them at planning before more preview work.'],
 ['The official npm run and CI have not been executed yet.', 'First task of Sprint 2: run CI on GitHub and record the result (GitHub_CI_Evidence_Checklist.md).'],
])}
"""
add = render(retro, OUT.with_name('_retro_add.pdf'), 'Sprint 1 Retrospective · addendum (final pass)')
merge([(RETRO, None), (add, None)], OUT.with_name('Closet_Sprint1_Retrospective.pdf')); add.unlink()
print('ok', len(flow))
