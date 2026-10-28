# SRS v1.2 (revision 4) = revision-4 front matter + the v1.1 rev 3 document as the tracked baseline.
import sys, pathlib
from docbase import render, merge, table, img, counts, REPO
from reqs import FRS, NFRS, BRS, CHANGES, STORIES

BASE = pathlib.Path(sys.argv[1])  # Closet_SRS_v1.1.pdf (rev 3)
OUT = pathlib.Path(sys.argv[2])
c = counts()

html = f"""
<div class="cover">
  <div class="kicker">CSCE 3701 Software Engineering · The American University in Cairo</div>
  <h1>Software Requirements Specification<br/>for Closet</h1>
  <div class="sub">Version 1.2 · revision 4 (Milestone 2 final) · application build v1.5</div>
  <table class="meta">
    <tr><td>Prepared by</td><td>Habiba Khashaba, Salma, Bashar, Karim and Youssef (Team Closet)</td></tr>
    <tr><td>Instructor</td><td>Dr. Sherif Aly</td></tr>
    <tr><td>Date</td><td>10/28/2026</td></tr>
    <tr><td>How to read it</td><td>The first pages (header “v1.2 (rev. 4)”) are revision 4: what changed, the new section 4.21 and the change log entries C-70 – C-84.
      Then the v1.1 revision 3 specification follows unchanged as the tracked baseline (header “Version 1.1 (rev. 3)”, its own page numbers).
      Where revision 4 supersedes a v1.1 statement, the table in R4.1 says so — the newer statement wins.</td></tr>
  </table>
</div>

<h2>Revision history (revision 4 added)</h2>
{table(['Name', 'Date', 'Reason for changes', 'Version'], [
  ['Habiba Khashaba (team)', 'Sep 2026', 'Milestone 0: problem, users, first feature list', '0.1'],
  ['Habiba Khashaba (team)', '10/13/2026', 'Milestone 1 baseline', '1.0'],
  ['Habiba Khashaba (team)', '10/25/2026', 'Milestone 2: separate SRS (IEEE / Wiegers), Admin actor, authentication and authorization requirements, US-61 to Sprint 2', '1.1'],
  ['Habiba Khashaba (team)', '10/26/2026', 'Revision 2 and 3: core flow first, deletion reasons, shopping list, try-on on the user’s photo, Suggest a fix (C-50 – C-68)', '1.1 rev. 2–3'],
  ['<b>Team (final pass)</b>', '<b>10/28/2026</b>', '<b>Revision 4 (build v1.5): proactive wardrobe intelligence FR-81 – FR-99, three genuinely different looks FR-100, one record per saved look FR-101, Ask Closet with 31 functions, NFR-16 – NFR-18, BR-12 – BR-13. Changes C-70 – C-84.</b>', '<b>1.2</b>'],
])}
<p class="note"><b>How changes are tracked.</b> Revision 4 does not rewrite the baseline. Every added or changed requirement is listed here with its ID;
the change log addendum (R4.6) continues Appendix D. In the baseline pages, green text = added after v1.0 and red strike-through = removed (unchanged convention).</p>

<h2>R4.1 What changed in revision 4</h2>
{table(['ID', 'Type', 'Where', 'Change'], [[a, f'<span class="tag {"ok" if b == "Added" else "warn"}">{b}</span>', w, t] for a, b, w, t in CHANGES])}
<h3>Superseded statements in the baseline pages</h3>
{table(['Baseline statement (v1.1 rev 3)', 'Now (v1.2 rev 4)'], [
  ['US-19 acceptance: “no two share more than 2 pieces”', 'FR-100: any two looks share at most <b>one major garment</b> when the closet allows'],
  ['FR-51 / AS-3: “13 14 whitelisted functions”', 'FR-99: <b>31</b> whitelisted functions'],
  ['FR-15: six deletion reasons for a user delete', 'unchanged for a user delete (4 reasons in the app); Donated / Given away / Sold / rehomed only through FR-83'],
  ['FR-64: one outfit per trip day', 'FR-95: trip capsule with luggage limit, reuse limits and remove / re-plan'],
  ['FR-60 / US-88: purchase check uses Available pieces', 'FR-94: every owned piece counts; distinct outfits only'],
])}

<h2 class="pb">R4.2 New section 4.21 · Proactive wardrobe intelligence</h2>
<p><b>4.21.1 Description and priority.</b> Closet evolves from “tell me what to wear” to “I understand your wardrobe and warn you before something becomes a problem”.
The features reuse the existing data — item status, wear history, weather, planner, recommendations, analytics and shopping — through one shared rule layer
(<i>Wardrobe Insights</i>, SDD 5.14). Priority as agreed with the product vision: core intelligence (monitor, duplicates, gap confidence, memory) High;
laundry, packing, event rescue and donation Medium; seasonal rotation, borrow tracker, repeats and the health explanation Low.
Release: <b>Sprint 3 · built early in v1.5</b> (labelled “Sprint 3 · preview” in the app). The proposed stories US-94 – US-111 are <b>not yet in Jira</b> (Proposed_Future_Backlog.md).</p>
<p><b>4.21.2 Stimulus / response.</b></p>
<ul>
<li>Home → “Still love it?” → Style it · Keep it · Donate · Not now → three looks / snooze / donate flow.</li>
<li>Planner and Home → “It’s now expected to be 30 °C instead of 24 °C — your navy blazer may be too warm” → Adjust outfit → only the blazer changes.</li>
<li>Ask Closet → “Do I need to do laundry before Monday?”, “Pack me for 5 days in Paris”, “What did I wear to Salma’s birthday?” → answers from real data.</li>
<li>Add a piece → Review → “You already own 2 similar white tops” → Add anyway · View similar · Cancel.</li>
</ul>
<p><b>4.21.3 Functional requirements.</b></p>
{table(['ID', 'Requirement', 'Story', 'Release'], [[f'<b>{f[0]}</b>', f[1], f[2], 'S3 (built early, v1.5)' if f[0] not in ('FR-100', 'FR-101') else 'S2 (changed)'] for f in FRS])}

<h2 class="pb">R4.3 Non-functional requirements and business rules added</h2>
{table(['ID', 'Requirement', 'Verification'], [[f'<b>{a}</b>', b, v] for a, b, v in NFRS])}
{table(['ID', 'Business rule'], [[f'<b>{a}</b>', b] for a, b in BRS])}
<h3>Security requirements — unchanged, now tested on every new route</h3>
<p>NFR-04 applies to every v1.5 route: authentication (JWT), validation (schemas, 400), ownership (another user’s piece, plan or trip → 404),
role checks. Examples: API-PR01 (keep someone else’s piece → 404), API-PR03 (rehome someone else’s piece → 404, invalid method → 400),
API-PR50 (negative price → 400), OF-02 (offline demo without the session → 401).</p>

<h2>R4.4 Use cases added</h2>
{img('D19_use_cases_proactive.png', 'Figure R4-1. Use cases · proactive wardrobe intelligence (v1.5). The overview D1 — User, Admin and the external services — is unchanged and remains in Appendix B.')}
{table(['UC', 'Name', 'Primary actor', 'Secondary actors', 'Requirements'], [
  ['UC-23', 'Still love it? (style · keep · donate)', 'User', '—', 'FR-81, FR-82'], ['UC-24', 'Donate / give / sell a piece', 'User', '—', 'FR-83'],
  ['UC-25', 'Rotate the wardrobe for the season', 'User', 'Weather Service', 'FR-84'], ['UC-26', 'Monitor planned outfits', 'User', 'Weather Service, Calendar', 'FR-85, FR-89'],
  ['UC-27', 'Plan days / pack a trip capsule', 'User', 'Weather Service', 'FR-86, FR-95'], ['UC-28', 'Buy intentionally (impact, duplicates, gaps)', 'User', '—', 'FR-92 – FR-94'],
  ['UC-29', 'Remember and repeat outfits', 'User', '—', 'FR-87, FR-88'], ['UC-30', 'Receive proactive notices', 'User', 'Notification Service', 'FR-98'],
])}
<p class="small muted">Admin (Milestone 1 feedback): present in D1 with UC-19 – UC-20 (accounts, system health). The Admin has no access to wardrobes, prices or donations (FR-77).</p>

<h2 class="pb">R4.5 Traceability for the new requirements</h2>
{table(['Req.', 'Story', 'Screen', 'API', 'Module', 'Data', 'Tests'], [[f[0], f[2], f[3], f'<span class="small">{f[4]}</span>', f[5], f[6], f[7]] for f in FRS])}
<p class="small">Full matrix with Sprint 1 rows: <code>05_Testing/Closet_Traceability_Matrix_v1.5.xlsx</code>. Tests ran {c['passed']}/{c['total']} passing in the final run (see the Test Plan and Report v1.2 for how they were executed).</p>

<h2>R4.6 Appendix D addendum · change log C-70 – C-84</h2>
{table(['ID', 'Type', 'Section', 'Old → new'], [[a, b, w, t] for a, b, w, t in CHANGES])}
<h3>Proposed stories (not yet in Jira)</h3>
{table(['ID', 'Title', 'Priority', 'Estimate', 'Requirements'], [[s[0], s[1], s[6], f'{s[5]} pts', s[7]] for s in STORIES])}
<p class="note">The baseline v1.1 revision 3 specification follows.</p>
"""
front = render(html, OUT.with_name('_srs_front.pdf'), 'Software Requirements Specification · Closet · v1.2 (rev. 4)')
merge([(front, None), (BASE, None)], OUT)
front.unlink()
print(OUT)
