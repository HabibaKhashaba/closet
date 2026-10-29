# Closet – AI digital wardrobe

CSCE 3701 Software Engineering · American University in Cairo · Fall 2026
Team: Habiba · Salma · Bashar · Karim · Youssef · Instructor: Dr. Sherif Aly

Closet is an AI-powered wardrobe assistant. You photograph each piece once; Closet knows what is clean and at home, the weather in your city and the events on your calendar, and suggests three explained outfits from what you already own.

**Honest scope.** Sprint 1 (graded in Milestone 2) is the 15 stories below. The app also contains working **early previews** of Sprint 2 and Sprint 3 features. Every screen is labelled “Sprint 1 · Implemented”, “Sprint 2 · Early preview” or “Sprint 3 · Product preview”, and the sidebar marks each area with its sprint colour.

**Jira:** https://aucegypt-team-r73i3oon.atlassian.net/jira/software/projects/SCRUM/boards/1

## Team roles

| Member | Role |
| --- | --- |
| Habiba | Requirements and user research |
| Salma | Frontend |
| Bashar | Recommendation engine and AI · UML use case diagram |
| Karim | Backend and database |
| Youssef | Testing, integration and deployment · UML component diagram |

## How we work

- `main` is always deployable; work happens on feature branches named `US-xx-short-name`.
- Every change goes through a pull request reviewed by a teammate; tests run on every pull request (`.github/workflows/ci.yml`).
- Commit messages and branches reference the Jira story (e.g. `US-19`), so Jira links them automatically.
- The requirements and design documents are updated at every sprint review, with tracked changes.

Milestone 1 deliverables (requirements and architecture PDF, UML diagrams, clickable prototype, Jira backlog import) are in `docs/milestone1/`.

## Sprint 1 – “A working closet” (done)

| Story | What you can do |
| --- | --- |
| US-01 | Register, sign in (email or Google), sign out; 5 failed sign-ins lock the account for 15 min |
| US-02 – 04 | 4-step style quiz: styles, colours, occasions, usual dress code, modest option, city |
| US-08, 09, 11 | Add a piece by photo, enter its details, review before saving |
| US-12, 71 | Browse and filter the closet (filters combine, counts update); edit a piece later |
| US-56, 15, 16 | One of 5 statuses per piece; laundry basket; “Wash done” |
| US-46 | Add events and see them in a month view |
| US-64 | Closet gaps by category and dress code |
| US-06 | Delete the account and every photo and record |

**169 Sprint 1 tests pass** (unit, API against PostgreSQL, state-transition, security, one acceptance test per story).

## Early previews (built ahead, not Sprint 1)

| Sprint | Preview | Notes |
| --- | --- | --- |
| 2 | **Style me — the core flow:** choose the occasion → 3 complete looks shown visually (pieces, occasion, weather, match %, “Recommended because …”) → change any piece → try it on → wear, save, favourite, rate or reject with a reason | Weather from Open-Meteo, seasonal estimate as fallback |
| 2 | Mix & Match with live check and “Suggest a fix”; saved looks | |
| 3 | **Virtual Try-On Preview (US-27):** choose a full-body photo of yourself; the chosen look (including a changed piece) is placed on it; flip between the three looks; adjust the fit; remove the photo | A simulated overlay drawn in the browser, labelled as a preview. **The photo never leaves the browser tab** (not uploaded, gone when the tab closes). A photo-real provider is a planned adapter; the stylised avatar is the fallback |
| 2 | **Change one piece from a tray:** click a garment → up to 3 alternatives with the old → new match %; the three looks each have their own name | |
| 3 | **Style a forgotten piece:** Analytics → Forgotten pieces → Another chance → three looks that all contain it | |
| 2 | **Mix & Match → Suggest a fix:** a weak piece lowers the score; Suggest a fix keeps the best single swap and shows before → after | |
| 3 | **v1.4 Delete with a reason:** Torn / damaged → replacement on the shopping list; Became too small → replacement in the next size; No longer my style → never a replacement, never suggested again, learned after two in one style; Other → kept only | One policy table (`server/src/shared/deletionPolicy.js`) + `ItemDeleted` event |
| 3 | **v1.4 Shopping bag:** items from Ask Closet, replacements, wardrobe gaps and suggestions, each labelled, with a “You already own similar item” warning | `GET/POST /shopping/list`, `PATCH/DELETE /shopping/list/:id` |
| 2 | Wardrobe rules (US-84 – US-87): laundry basket time + auto-return, laundry day, recycle time, return dates, .ics calendar import, wardrobe dates on the calendar | Requested in the Milestone 1 review |
| 3 | Ask Closet: the language model (or, without a key, the keyword parser) picks one of 35 whitelisted functions; questions such as “Is my blazer clean?” only read state (including “put beige trousers in my shopping list”); every change can be undone | Set `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`; without a key the keyword parser answers |
| 3 | Analytics, forgotten pieces, Style this piece, Smart Shopping and “Do I need this?”, outfits planned for events, in-app reminders, Admin | Admin: `admin@closet.app / Closet2026!` |
| 2 | **v1.3** Explainable looks (“Recommended because …” + factors), 9 occasion templates, conflict detection with one-tap replacement (US-79), outfit history, activity log | Audit step in the API pipeline |
| 3 | **v1.3** Closet has learned (Confirm / Not accurate / exact Undo), Wardrobe Health (defined formula), duplicate-purchase warning (similarity score), Notification Center (in-app) | Rule-based, documented in the SDD |
| Stretch | **v1.3** Packing Mode (Mark as packed → status Packed), admin system health | Concept previews |

**599 automated tests pass in the final run of build v1.6** (407 unit + 192 API on PostgreSQL 16); coverage 97.53 % lines, 83.64 % branches, 90.84 % functions (V8). Browser: `e2e/demo_journey.py` (58 steps), `e2e/stateful_journey.py` (15 checkpoints) and `e2e/lifecycle_journey.py` (12 checkpoints: care, tailor, lending, donation, packing, purchase, planner), on the live app; the last two also on the offline demo. The final run was made where the npm registry was blocked, with small compatibility shims for the npm packages; run `npm test` once with the real packages to confirm. Reset the demo data at any time with `npm run seed`.

**Build v1.6 adds one garment lifecycle** (`server/src/shared/lifecycle.js`: 9 states, 21 moves): Care (Laundry · Repairs & alterations, the tailor with a return reminder), Borrow & lend, a donate-only Donation area and a Wardrobe status on Home; see `CORRECTION_AUDIT.md` and `FINAL_ACCEPTANCE_CHECKLIST.md`.

**Build v1.5 added proactive wardrobe intelligence** (Sprint 3 preview, no new sidebar items): Still love it? (style · keep · donate), donate (v1.6: donate only), seasonal rotation, laundry risk and laundry-aware multi-day plans, repeat intelligence and outfit memory, one planned-outfit monitor (weather + availability), borrow tracker, explainable Wardrobe Health, duplicate check on add, gap confidence, trip capsule, event rescue, cost per wear, purchase impact and one Notification Center — all from one pure rule layer, `server/src/modules/intelligence/insights.js`.

## Run it

You need Node.js 20+ and Docker (or your own PostgreSQL 16).

```bash
npm run install:all        # installs server and client packages
npm run db                 # starts PostgreSQL in Docker (closet + closet_test databases)
cp server/.env.example server/.env
npm run migrate            # creates the schema
npm run seed               # demo: demo@closet.app / Closet2026! · admin: admin@closet.app / Closet2026!
npm run api                # API on http://localhost:4000
npm run web                # web app on http://localhost:5173 (in a second terminal)
```

## Test it

```bash
npm test                   # all 599 tests (needs the closet_test database from `npm run db`)
npm run coverage           # with a coverage report in server/coverage
```

GitHub Actions is **configured** (`.github/workflows/ci.yml`): server (unit, API, coverage), client (build), e2e (demo journey, stateful journey, demo-check) and offline-demo (builds `Closet_Demo.html` and runs the stateful journey on it). It has not run on GitHub yet; until it does, the evidence is the local runs in `docs/milestone2/evidence/v15/`.

```bash
pip install playwright && python -m playwright install chromium
SHOTS=e2e-shots/ python e2e/demo_journey.py      # app on http://localhost:4000 after `npm run seed`
```

## Before a live demo

```bash
npm run seed && WEATHER_MODE=estimate npm run api   # fresh data; seasonal weather so the looks repeat
npm run demo:check                                 # preflight: "Ready: every demo check passed."
```

The full checklist with the expected values is `docs/milestone2/DEMO_PREFLIGHT.md`. Three runs from a fresh seed gave identical results (`docs/milestone2/evidence/demo_3runs/`).

## Offline demo and backup video

`bash tools/offline_demo/build.sh` builds `Closet_Demo.html`: the built web app plus the **real services and rules running on in-memory repositories** (same seed), in one file that opens with a double-click; state lasts for the browser session and the Reset badge restores the seed (`npm run demo:offline`). `tools/record_demo_video.py` records `Closet_Demo_FINAL.mp4` (the 13 demo steps, 5:33) from a fresh seed: `TRYON_PHOTO=avatar` uses the stylised avatar, or pass a consenting team member’s full-body photo. The recording is embedded in both presentation files.

## Deploy

`render.yaml` is a Render blueprint: one web service (API + built web app) and one PostgreSQL database. On Render, choose **New → Blueprint**, pick this repository, and set `CLIENT_ORIGIN` to the service URL.

## Code map

```
client/src/        React web app (MVC): api.js = model, App.jsx = controller, screens/ = views
server/src/
  gateway/         security pipeline: security.js → validation → authenticate.js → accessControl.js
  modules/         identity · profile · wardrobe · availability · planner · privacy ·
                   outfits · recommendation (engine, weather adapter) · assistant (LLM adapter,
                   keyword parser) · shopping · admin
  events/          in-process event bus (Observer)
  shared/          vocabulary (requirements §3.1), validation, errors
  db/              connection, migrations runner, demo seed
server/migrations/ SQL schema (001 Sprint 1, 002 outfits / planner / chat, 003 customization, shopping)
server/seed/photos 29 original garment illustrations for the demo closet
server/tests/      unit/ and api/ (acceptance.test.js = one test per story)
docs/              Milestone 1 and Milestone 2 documents and diagrams
```

## Documents

| Milestone | Files |
| --- | --- |
| Milestone 1 | `docs/milestone1/` – requirements and architecture, use case and component diagrams, prototype |
| Milestone 2 | `docs/milestone2/` – **final (build v1.6):** Closet_SRS_v1.3 and Closet_SDD_v1.3, revision 5 (front matter on top of the tracked v1.2 baseline; builders in `rev5/`, revision 4 in `rev4/`), Test Plan and Report v1.3, Traceability v1.6, API table v1.6, 24 diagrams (SVG + PNG, D24 – D26 new in v1.6), the test plan and report, the presentation (interactive, linear, PDF) and one presenter pack (Q&A, Jira checklist, verification matrix), the demo script and `DEMO_PREFLIGHT.md`; test evidence in `evidence/` (including three fresh-seed demo runs); slide sources in `slides-source/`. Earlier drafts are in the git history. |
