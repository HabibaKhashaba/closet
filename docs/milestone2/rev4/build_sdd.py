# SDD v1.2 (revision 4) = revision-4 design front matter + the v1.1 rev 3 SDD as the tracked baseline.
import sys, pathlib
from docbase import render, merge, table, img, counts
from api_v15 import API
from reqs import FRS

BASE = pathlib.Path(sys.argv[1]); OUT = pathlib.Path(sys.argv[2])
c = counts()

html = f"""
<div class="cover">
  <div class="kicker">CSCE 3701 Software Engineering · The American University in Cairo</div>
  <h1>Software Design Document<br/>for Closet</h1>
  <div class="sub">Version 1.2 · revision 4 (Milestone 2 final) · application build v1.5</div>
  <table class="meta">
    <tr><td>Prepared by</td><td>Habiba Khashaba, Salma, Bashar, Karim and Youssef (Team Closet)</td></tr>
    <tr><td>Instructor</td><td>Dr. Sherif Aly</td></tr>
    <tr><td>Date</td><td>10/28/2026</td></tr>
    <tr><td>How to read it</td><td>Pages headed “v1.2 (rev. 4)” describe the v1.5 design: new diagrams D18 – D23, the security pipeline, the shared
    Wardrobe Insights layer, repositories and the offline demo, diverse recommendations, Ask Closet routing, notifications, migration 006 and the API additions.
    The v1.1 revision 3 SDD follows unchanged as the baseline. Where a v1.5 section supersedes a baseline section, R4.0 says so.</td></tr>
  </table>
</div>

<h2>R4.0 What changed in the design</h2>
{table(['Baseline (v1.1 rev 3)', 'Now (v1.2 rev 4, build v1.5)', 'Section'], [
 ['3.1 component diagram (D2)', 'D18 adds the Proactive service, Wardrobe Insights, repositories and the security pipeline as a visible layer', 'R4.1'],
 ['5.4 top-3 by score', 'Diversity-aware selection: any two looks share ≤ 1 major garment when the closet allows', 'R4.5'],
 ['5.8 Ask Closet: 14 functions', '31 whitelisted functions; questions never change state; follow-up context', 'R4.6'],
 ['5.5 notifications without levels', 'One Notification Center: type, level HIGH / MEDIUM / LOW, stable key, de-duplication', 'R4.7'],
 ['4.1 data model (D3)', 'D20: price, rehoming, snoozes, outfit memory, planned weather (migration 006)', 'R4.8'],
 ['Demo: recorded responses', 'Offline demo runs the real services on in-memory repositories', 'R4.4'],
 ['5.19 planned designs', 'Seasonal rotation, laundry risk, monitor, borrow tracker, trip capsule, purchase impact, cost per wear and donation are now built (Sprint 3 preview)', 'R4.3'],
])}

<h2 class="pb">R4.1 Architecture · component view (D18)</h2>
<p>Closet stays a <b>modular monolith</b>: one Node/Express process, one PostgreSQL database with a schema per module, a React single-page app.
v1.5 adds no new process. The proactive features are one service (<code>intelligence/proactive.js</code>) that only <i>composes</i> the existing modules
through their services, plus one pure rule module (<code>intelligence/insights.js</code>) with no I/O.</p>
{img('D18_component_v15.png', 'Figure R4-1 (D18). Component diagram v1.5. Every request passes the security pipeline before any module. New in v1.5: Proactive service, Wardrobe Insights, repositories, offline demo host.')}

<h2>R4.2 Security pipeline (applies to every route, old and new)</h2>
{table(['Order', 'Stage', 'Implementation', 'Failure', 'Evidence'], [
 ['1', 'Headers and CORS', 'helmet (CSP: self, blob: images, Google sign-in only), CORS allow-list', '—', 'SEC unit tests'],
 ['2', 'Rate limit', '1,000 / 15 min general (photos excluded, D-04); 30 / 15 min sign-in', '429', 'API-AU'],
 ['3', 'Validation', 'shared/validate.js schemas (types incl. number, ranges, enums, max lengths)', '400 VALIDATION', 'UT-V*, API-PR50'],
 ['4', 'Authentication', 'Bearer JWT, short expiry; offline demo uses its own local session token only', '401', 'API-AU, OF-02'],
 ['5', 'Role', 'user / admin; admin routes only accounts and health — no wardrobe data (FR-77)', '403', 'API-AU'],
 ['6', 'Ownership', 'every query scoped by user id; another user’s piece, plan, trip or look', '404 (not 403 — does not reveal existence)', 'API-PR01, API-PR03'],
 ['7', 'Audit', 'sign-in, deletes, role changes written to the audit log', '—', 'API-AU'],
])}

<h2 class="pb">R4.3 Wardrobe Insights — one rule layer, many surfaces</h2>
<p><code>insights.js</code> is pure: every function takes plain data (pieces, statuses, wears, weather, events, snoozes, today) and returns a decision with
its reasons. The same function feeds Home, Planner, Analytics, Ask Closet and the Notification Center, so a rule cannot say one thing on one screen and another elsewhere.</p>
{table(['Function', 'Rule (thresholds are constants in the file)', 'Used by', 'Requirement'], [
 ['seasonFromWeather / seasonFromMonth', '≥ 27 °C Summer, ≤ 17 °C Winter, else by month', 'seasonal, forgotten, trip', 'FR-84'],
 ['forgottenCandidates', 'Available, not rehoming, added ≥ 30 days, in season, unworn 90 days (180 if dress codes ≥ 4 only), not snoozed', 'Home, Analytics, Ask, notifications', 'FR-81'],
 ['seasonalRotation', 'off-season Available pieces → pack; stored in-season pieces → bring back', 'Analytics, Ask, notifications', 'FR-84'],
 ['laundryRisk', '2 of the user’s 3 most-worn pieces in Laundry before a planned event', 'Home, Ask, notifications', 'FR-85'],
 ['planDays', 'n days without repeats; repeats only when the closet runs out, with a note', 'Ask “plan my week”', 'FR-86'],
 ['repeatInsight / similarLook', 'same set worn recently / near-identical look', 'Outfit card, Ask', 'FR-87'],
 ['memoryMatches / memorySignals', 'past wears with event, rating, weather; boost ≤ +3 within ±4 °C', 'Ask, ranker', 'FR-88'],
 ['weatherShift', 'forecast differs from the planned snapshot by ≥ 5 °C or rain appears', 'Monitor', 'FR-89'],
 ['costPerWear / valueInsights', 'price ÷ wears; only priced pieces; never invented', 'Piece, Analytics, Ask', 'FR-97'],
 ['gapConfidence', 'HIGH / MEDIUM / LOW from evidence count, with reasons and limits', 'Shopping, Ask', 'FR-93'],
 ['purchaseImpact', 'distinct major-garment sets the new piece enables; twin → “Probably unnecessary”', 'Shopping, Ask', 'FR-94'],
 ['tripCapsule', 'carry-on: 8 clothing / 2 shoes / 3 extras; each piece ≤ 2 (3 with laundry) wears', 'Packing, Ask', 'FR-95'],
 ['explainHealth', 'what raises / lowers the score, from the same parts as the score', 'Analytics', 'FR-91'],
])}
<h3>Proactive service</h3>
<p><code>proactiveService(&#123;repo, wardrobe, availability, outfits, planner, weather, recommendation&#125;)</code> loads data through the module services, calls the rules,
and performs the few writes the user confirms (snooze, pack for season, adjust one planned piece, remind later). Snoozes are one table with typed keys
(<code>keep:</code>, <code>season:</code>, <code>borrow:</code>, <code>notice:</code>) and an expiry, so “Not now” works the same everywhere.</p>
<h3>Design decision · rehoming is not a status</h3>
<p>“Ready to donate / give / sell” is stored in <code>wardrobe.rehoming</code>, not as a sixth availability status. Reason: the status machine describes where a piece
<i>is</i> (Available, Laundry, Borrowed, Repair, Stored); rehoming is an <i>intention</i> that can coexist with a status and that ends in a delete with a reason
(Donated / Given away / Sold / rehomed). Keeping it separate leaves the tested state machine (28 tests) unchanged. Rehoming pieces are excluded from recommendations.</p>
{img('D22_sequence_donate.png', 'Figure R4-2 (D22). Sequence · Still love it? → Donate → Confirm it has left.')}

<h2 class="pb">R4.4 Repositories and the offline demo</h2>
<p>Every module now receives its repository through <code>buildModules(deps)</code> in <code>app.js</code>. The server passes PostgreSQL repositories;
the offline demo passes <code>memoryRepositories.js</code>. Both run the <b>same services, rules and validation</b>; only storage differs.
This replaced the v1.4 recorded-response demo (defect D-13), where a change on one screen did not reach the others.</p>
{table(['Concern', 'Server', 'Offline demo (Closet_Demo.html)'], [
 ['Services, rules, validation', 'same code', 'same code (bundled with esbuild)'],
 ['Storage', 'PostgreSQL 16', 'in-memory store, saved to sessionStorage; Reset restores the seed'],
 ['Seed', 'seedData.js', 'seedData.js (same pieces, wears, prices, events)'],
 ['Auth', 'JWT', 'local demo session only; requests without it → 401 (OF-02)'],
 ['Weather / AI', 'adapter (live or estimate)', 'estimate mode; keyword parser (no network)'],
 ['Verified by', 'API tests, stateful E2E (live)', 'OF-01 – OF-09, stateful E2E (offline), 15 checkpoints'],
])}

<h2>R4.5 Recommendation · diversity-aware selection</h2>
<p>The ranker (pipe-and-filter, unchanged) scores candidate looks. <code>pickDiverse</code> then chooses three:</p>
<ol>
<li>Take the best look. For each next pick, penalise overlap with looks already chosen: <code>score − 6 × weightedOverlap</code> (accessories weigh 0.5), +3 for a different silhouette (dress vs separates).</li>
<li>Accept a look only if it shares at most <b>1</b> major garment (top, bottom, dress, outerwear, shoes) with each chosen look.</li>
<li>If fewer than three qualify, relax the limit step by step (2, 3, 4) — small closets still get three looks, and the relaxation is visible in tests.</li>
<li>With a fixed piece (“style this piece”, forgotten piece) the fixed piece is excluded from the overlap count — it must be in all three.</li>
</ol>
<p>Verified by DV-01 – DV-07 and demo-check on the seed: maximum shared major garments = 1.</p>

<h2 class="pb">R4.6 Ask Closet routing (31 functions)</h2>
<p>The keyword parser maps a message to one of 31 whitelisted functions; the optional LLM adapter may only return one of the same functions with a validated schema.
Rules: (1) questions (“Is my blazer clean?”) route to read-only functions — they never change state (defect D-09); (2) state changes return an <code>undoId</code>;
(3) follow-ups use context (<code>itemIds</code>, <code>buy</code>, <code>pieceId</code>) — “add this to my shopping list” after a purchase check; (4) anything else returns the scope message
“I can help with your wardrobe, outfits, laundry, shopping, weather and planner.”</p>
{table(['Group', 'Functions (names as in FUNCTIONS)'], [
 ['Outfits', 'recommend · change_piece · style_piece · event_rescue · week_plan · repeat_check · memory · plan_event'],
 ['Availability', 'availability (question, read-only) · set_status · wash_done · laundry_list · laundry_risk · borrowed · hide_piece'],
 ['Shopping', 'buy_check · add_to_shopping · similar_owned · closet_needs · value'],
 ['Wardrobe care', 'forgotten · donate_candidates · keep_piece · rehome_piece · rehome_done · seasonal · health'],
 ['Planner / travel', 'plan_check · trip_pack · weather'],
 ['Scope', 'help (out-of-scope reply)'],
])}
<p class="small muted">The exact list is <code>FUNCTIONS</code> in <code>assistant/keywordParser.js</code>; AI-40 – AI-47 test 56 phrasings across them.</p>

<h2>R4.7 Notification Center</h2>
{table(['Type', 'Level (from priority: ≥5 HIGH, ≥3 MEDIUM, else LOW)', 'Key (de-duplication)', 'Action'], [
 ['WEATHER_CHANGE', 'HIGH if the event is today/tomorrow, else MEDIUM', 'monitor alert key (event + piece)', 'Adjust outfit'],
 ['LAUNDRY_WARNING', 'MEDIUM', 'laundry-risk key (event)', 'Open laundry'],
 ['BORROW_RETURN (overdue)', 'MEDIUM', 'borrow:&lt;piece&gt;:&lt;day&gt;', 'Mark returned'],
 ['SEASONAL_ROTATION', 'LOW', 'season:&lt;season&gt;:&lt;month&gt;', 'Review'],
 ['FORGOTTEN_DONATION', 'LOW', 'donate:&lt;piece&gt;:&lt;week&gt;', 'Style it'],
 ['Existing: AVAILABILITY_CONFLICT, PLAN_REMINDER, LAUNDRY_DAY, WEATHER_ALERT, PACKING, WASH_DONE, FORGOTTEN_PIECE', 'by priority', 'unchanged; a due reminder is skipped when the piece already has an overdue notice (D-17)', 'as before'],
])}
{img('D23_sequence_monitor.png', 'Figure R4-3 (D23). Sequence · planned-outfit monitor → Adjust outfit (only the affected piece changes).')}

<h2 class="pb">R4.8 Data · migration 006</h2>
{img('D20_er_v15.png', 'Figure R4-4 (D20). ER additions in v1.5.')}
{table(['Table', 'Change', 'Why'], [
 ['wardrobe.items', '+ price numeric(10,2) ≥ 0, currency, purchase_date', 'cost per wear (FR-97)'],
 ['wardrobe.rehoming (new)', 'item_id PK, method donate|give|sell, since', 'donation flow (FR-83)'],
 ['wardrobe.deletions', 'reason check + Donated, Given away, Sold / rehomed', 'exit reasons, no replacement suggested'],
 ['intelligence.snoozes (new)', 'user_id, key, until', 'Keep / Not now / Remind later (FR-82, FR-84, FR-90)'],
 ['outfits.wears', '+ event_title, note', 'outfit memory (FR-88)'],
 ['planner.events', '+ planned_temp_c, planned_condition', 'monitor compares with the forecast (FR-89)'],
 ['profile.profiles', '+ allow_repeats', 'planning preference (FR-86)'],
])}
<p class="small">Migration 006 was applied to a real PostgreSQL 16 database in the team’s test environment; all {c['api']} API tests ran against it.</p>
{img('D21_state_v15.png', 'Figure R4-5 (D21). Item status machine (unchanged) and the separate rehoming intention.', '82%')}

<h2 class="pb">R4.9 API additions and changes (build v1.5)</h2>
<p class="small">All routes under <code>/api/v1</code>; all pass the security pipeline (R4.2). Full table: <code>04_Design/Closet_API_Table_v1.5.xlsx</code>.</p>
{table(['Method', 'Route', 'Purpose', 'Auth', 'Request', 'Response', 'Errors'], [[f'<b>{a[0]}</b>', f'<code>{a[1]}</code>', a[2], a[3], f'<span class="small">{a[4]}</span>', f'<span class="small">{a[5]}</span>', a[6]] for a in API])}

<h2 class="pb">R4.10 Use cases and traceability to design</h2>
{img('D19_use_cases_proactive.png', 'Figure R4-6 (D19). Proactive use cases UC-23 – UC-30. Admin remains in D1.')}
{table(['Req.', 'Module', 'API', 'Data'], [[f'<b style="white-space:nowrap">{f[0]}</b>', f[5], f'<span class="small">{f[4]}</span>', f'<span class="small">{f[6]}</span>'] for f in FRS])}

<h2>R4.11 Tradeoffs and limits</h2>
<ul>
<li><b>Rules, not a model.</b> Proactive features are explainable thresholds. Pro: every notice can say why; testable. Con: thresholds (90 days, 5 °C) are guesses to tune with user data.</li>
<li><b>Composition over new modules.</b> The Proactive service depends on five module services — a wide fan-in, accepted because it adds no new tables beyond snoozes/rehoming.</li>
<li><b>Weather in the demo is estimated</b> (WEATHER_MODE=estimate) so the demo is deterministic; live weather depends on the provider key.</li>
<li><b>Try-On is a simulated preview</b> (overlay on the user’s photo), not a generated image — stated in the app.</li>
<li><b>Deployment:</b> a Render blueprint is configured; the local demo is the verified presentation path.</li>
</ul>
<p class="note">The baseline v1.1 revision 3 SDD follows.</p>
"""
front = render(html, OUT.with_name('_sdd_front.pdf'), 'Software Design Document · Closet · v1.2 (rev. 4)')
merge([(front, None), (BASE, None)], OUT)
front.unlink()
print(OUT)
