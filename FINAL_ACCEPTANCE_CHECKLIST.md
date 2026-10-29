# Final acceptance checklist — build v1.6

A box is checked only when the **user-facing behaviour** was observed in a run (test, browser journey or recorded video) on 29 Oct 2026 — never because code or documentation exists.
Evidence: `docs/milestone2/evidence/v16/` (test run, coverage, per-file counts, journey logs and screenshots, demo checks, defect log).

Rows were first verified in a sandbox with compatibility shims, then confirmed with the real packages in GitHub Actions ([CI #5](https://github.com/HabibaKhashaba/closet/actions/runs/40905244684), all four jobs green; history in `docs/milestone2/evidence/v16/ci_runs.md`).

## Lifecycle and care
- [x] One authoritative lifecycle: 9 states, 21 moves, everything else 409 — ST-01 – ST-06 (81 pairs), LF-01 – LF-04
- [x] Every status change goes through one write path that keeps loans and care jobs in step — LC-01 – LC-12
- [x] Care → Laundry: In laundry → basket → Wash done → Available — E2E l02, video step 2
- [x] Black blazer: Needs alteration “Sleeves too long” → Send to tailor → At tailor in Care, Closet and Ask — LC-01, E2E l03, video step 3
- [x] At tailor → left out of Style me — LC-01, E2E l04 (no black blazer in the three Work looks)
- [x] Tailor reminder on the expected day with Mark collected / Remind me later — LC-02, LC-04
- [x] Mark collected → Available, care history kept — LC-04, E2E l05
- [x] Needs repair seeded (camel cardigan, loose button) and not offered as a forgotten piece — LF-05, demo:check

## Borrow & lend
- [x] Lend item (person, date lent, due, note) → Borrowed everywhere — LC-10, E2E l06
- [x] Overdue first (rose wrap dress with Nour) — demo:check, video step 4
- [x] Planner conflict for a lent planned piece; “Who has my black blazer?” → Nour — LC-11, E2E l06
- [x] Mark returned → Available, loan kept in History — LC-12, E2E l07

## Donation
- [x] Donate only (no give / sell) — API-PR03, LF-12
- [x] Ready to donate waits under Wardrobe → Donation, still there after navigating away — E2E l08, video step 7
- [x] Mark as donated → gone from the closet, wear history kept, no Shopping-bag replacement — API-PR02, API-PR92, E2E l08 – l09
- [x] Analytics shows the donated count — E2E l09
- [x] The donate dialog opened from Home stays open until the user finishes (D-22) — 5 / 5 journey runs

## Home, planning and intelligence
- [x] Home Wardrobe status with clickable counts — E2E l01, video steps 1 and 13
- [x] Packing: Mark as packed → Packed in the Closet; Unpack → Available — API-PR80, E2E l10, video step 8
- [x] Planner weather alert → Adjust outfit changes only the warm piece — API-PR31, E2E s14 / l11, video step 10
- [x] Conflict notices name the state and a readable date (“are packed until Mon 2 Nov”) — API-K03, LF-06
- [x] Plan several days never repeats a top / bottom / dress and skips non-wearable pieces — API-PR21, LC-20
- [x] Repeat insight on the outfit card; outfit memory search, Wear again, Create a variation — API-PR60, API-PR62, video step 11
- [x] Event rescue: three looks, a gap only when nothing complete exists — LC-23, LC-30
- [x] Wardrobe Health explained (raising / lowering) over owned pieces — WH-01 – WH-05, video step 11
- [x] Duplicate warning when adding — API-DU01/02, API-PR70
- [x] Gap confidence with reasons — API-PR72
- [x] Cost per wear from confirmed wears only — API-PR50, IN-50 – IN-52
- [x] Purchase simulation, five blocks, nothing saved; quick check uses the item name — API-PR71, LC-22, video step 9
- [ ] **Purchase scenario exactly as briefed (black loafers useful).** Not possible honestly: the seed already owns black loafers, so Closet answers “Probably unnecessary”. The demo shows **white** loafers (Good buy) and the black fitted top (Skip).

## Ask Closet
- [x] 35 functions; the 22 v1.6 prompts route correctly with the right arguments — LF-10, LF-11
- [x] Answers read the current state (repairs, loans, donations) — API-PR90 – PR93, video step 12

## Offline demo
- [x] Same services and schemas on in-memory repositories — OF-01 – OF-11
- [x] Offline journeys: stateful 15 + lifecycle 12 checkpoints, 0 browser errors

## Demo, tests and documents
- [x] Demo re-recorded after the last correction: 13 steps, 5:33 (332.7 s)
- [x] demo:check passes on 3 / 3 fresh seeds (reference saved the same day)
- [x] 599 / 599 tests (unit + API on real PostgreSQL 16), coverage 97.53 % lines · 83.64 % branches · 90.84 % functions
- [x] Live journeys: demo 58 steps, stateful 15, lifecycle 12 — 0 browser errors
- [x] SRS v1.3, SDD v1.3 (D24 – D26), Test Plan and Report v1.3, Traceability v1.6, API table v1.6, defect log D-18 – D-25, preflight for the 13 steps
- [x] Real `npm test` (Jest 29) on GitHub Actions: 599 / 599. First run 596 / 599, defect D-26, fixed.
- [x] Real Vite production build — CI client job green
- [x] GitHub Actions executed: CI #1 – #4 found D-26 – D-28; CI #5 all four jobs green (tests, Vite build, 3 live journeys + demo check, offline demo)
- [ ] Interactive PowerPoint deck playback — **not tested** here; deck figures not updated to v1.6
- [ ] Jira — proposed stories US-112 – US-117 **not in Jira**; no screenshots
- [ ] Deployment — Render blueprint configured; the local demo is the verified presentation path
