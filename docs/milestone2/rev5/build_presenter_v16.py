# Demo script v1.6 (13 steps, from DEMO_PREFLIGHT.md) and a v1.6 addendum on top of the presenter pack.
import pathlib, re, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / 'rev4'))
from docbase import render, merge, table  # noqa: E402

M2 = pathlib.Path(__file__).resolve().parents[1]; FINAL = M2 / 'final'
pre = (M2 / 'DEMO_PREFLIGHT.md').read_text()
md = lambda t: re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', re.sub(r'`(.+?)`', r'<code>\1</code>', t))
rows = [[md(c.strip()) for c in l.strip().strip('|').split('|')] for l in pre.splitlines() if re.match(r'\| \d+ \|', l)]
assert len(rows) == 13, len(rows)
note = next(l for l in pre.splitlines() if l.startswith('**Scenario note'))

demo = f'''<div class="kicker">CSCE 3701 · Team Closet · Milestone 2 final · build v1.6</div><h1>Demo script · 13 steps</h1>
<p>About 5–7 minutes. Start from a fresh seed (see the preflight). The recorded backup <code>Closet_Demo_FINAL.mp4</code> follows the same 13 steps (5:33).</p>
{table(['#', 'Step', 'Expected'], rows)}<p class="note">{md(note)}</p>
<h3>What we say</h3><ul><li>Try-On is a simulated preview, not generated imagery.</li><li>Ask Closet: keyword parser, 35 whitelisted functions; the language model is optional and off.</li>
<li>Weather: the seasonal estimate. Closet is not connected to charities or tailors — Care and Donation keep the closet accurate.</li>
<li>Deployment: “Render blueprint configured; the local demo is the verified presentation path.”</li></ul>'''
render(demo, FINAL / 'Demo_Script.pdf', 'Demo script · Closet · build v1.6')

add = f'''<div class="kicker">CSCE 3701 · Team Closet · Milestone 2 final</div><h1>Presenter Pack · v1.6 addendum</h1>
<p class="note">These pages <b>supersede</b> the build v1.5 pages that follow wherever they disagree (numbers, the 14-step demo, and the Q&amp;A answer “Why is Ready to donate not a status?”).</p>
<h2>Numbers to quote (build v1.6, 29 Oct 2026)</h2>{table(['What', 'Value', 'Evidence'], [
 ['Automated tests', '599 / 599 passing (407 unit + 192 API on PostgreSQL 16)', 'evidence/v16/test_run_v16.txt'],
 ['Coverage', '97.53 % lines · 83.64 % branches · 90.84 % functions', 'evidence/v16/coverage_v16.txt'],
 ['Browser journeys', 'live: demo 58 steps, stateful 15, lifecycle 12 · offline: stateful 15, lifecycle 12 · 0 browser errors', 'evidence/v16/e2e_*.txt'],
 ['Demo check', '3 / 3 fresh seeds', 'evidence/v16/demo_check.txt'],
 ['Video', '13 steps, 5:33', 'Closet_Demo_FINAL.mp4'],
 ['Lifecycle', '9 states, 21 allowed moves, 81 pairs tested', 'ST-01 – ST-06'],
 ['Ask Closet', '35 whitelisted functions', 'keywordParser.FUNCTIONS']])}
<h2>Q&amp;A changes</h2>{table(['Question', 'Answer now'], [
 ['Why is “Ready to donate” a status now? (v1.5 said it was not)', 'v1.5 kept it in a separate table so the five-status machine stayed unchanged. That gave two sources of truth and screens disagreed. v1.6 has one lifecycle; leaving the closet is still a delete with the reason Donated, never a state.'],
 ['Why only donate, not give away or sell?', 'The brief asked for donate only. Old v1.5 rows with Given away / Sold are still readable.'],
 ['How do you know repairs work end to end?', 'LC-01 – LC-04 and the lifecycle journey (live and offline) run the exact Black blazer flow, including “not in Style me while at the tailor” and the reminder.'],
 ['Why white loafers in the demo?', 'The seed already owns black loafers, so Closet correctly says “Probably unnecessary” for them. We show the honest result rather than change the rule.'],
 ['Were the tests run with the real packages?', 'Not in this pass: the npm registry was blocked, so the suites ran on small compatibility shims against a real PostgreSQL 16. npm test on a normal machine is the authoritative run; CI is configured, not executed.']])}
<h2>Known limits to state if asked</h2><ul><li>The interactive deck still shows build v1.5 figures; use this addendum for numbers.</li><li>Proposed stories US-112 – US-117 are not in Jira yet.</li><li>Vite build and GitHub Actions not run for v1.6.</li></ul>'''
front = render(add, FINAL / '_add.pdf', 'Presenter Pack · Closet · v1.6 addendum')
merge([(front, None), (FINAL / 'Closet_M2_Presenter_Pack.pdf', None)], FINAL / 'Closet_M2_Presenter_Pack_v1.6.pdf'); front.unlink()
print('ok')
