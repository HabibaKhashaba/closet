# GitHub Actions — first real runs (build v1.6, 29 Oct 2026)

The first time the project ran with the **real** npm packages (Jest 29, Supertest, Express, pg, Vite 7, React 19) and a real PostgreSQL 16 service, on GitHub's Ubuntu runners. Before this, every run had used compatibility shims in a sandbox where the npm registry was blocked.

Workflow: `.github/workflows/ci.yml`, four jobs:

- **server:** `npm install` + all Jest tests with coverage
- **client:** `npm install` + `vite build`
- **e2e:** build, migrate, seed, start the server; then `demo_journey.py`, `stateful_journey.py`, `lifecycle_journey.py` and `demo-check.js`
- **offline-demo:** build `Closet_Demo.html` and run two journeys against it

| Run | Commit | Result | What it showed | Defect |
|---|---|---|---|---|
| [CI #1](https://github.com/HabibaKhashaba/closet/actions/runs/40896887495) | 7a76f54 — Milestone 2 code + M1 history | Failure | server: **596 passed, 3 failed, 599 total** (real Jest). TO-01 – TO-03 could not `import()` the browser ES module `client/src/photoTryOn.js` in Jest's CommonJS runtime. e2e did not run (it needs server). | D-26 |
| [CI #2](https://github.com/HabibaKhashaba/closet/actions/runs/40899146697) | 73b5a4d — test loads the module in a child Node process | Failure | server passed (all 599). e2e: `demo_journey.py` step 34 still showed one Planner notice after Replace. The seed had stored the live Cairo forecast for "Dinner with family", so an extra "5 °C cooler" alert appeared. | D-27 |
| [CI #3](https://github.com/HabibaKhashaba/closet/actions/runs/40902206778) | 811635c — seed always uses the weather estimate | Failure | The three browser journeys passed. Only the last step (`demo-check.js`) failed. | D-28 |
| [CI #4](https://github.com/HabibaKhashaba/closet/actions/runs/40902620249) | f51d932 — CI e2e job sets `WEATHER_MODE=estimate` | Failure | Same last step: the demo check ran right after the lifecycle journey without a re-seed (30 pieces, denim jacket already donated) and crashed. | D-28 |
| [CI #5](https://github.com/HabibaKhashaba/closet/actions/runs/40905244684) | bb5b2eb — re-seed before the demo check | **Success** | **All four jobs green** (client 17 s, server 1 min 13 s, offline-demo 2 min 43 s, e2e 4 min 50 s; 6 min 8 s total). Artifacts: coverage-report (286 KB), e2e-journey (41.4 MB), offline-demo (7.46 MB). | — |

## What this verifies

- **599 / 599 tests pass under real Jest 29** against PostgreSQL 16. The server job runs `jest --coverage` and fails on any failing test. The total (599) comes from the CI #1 log.
- The web app builds with the real Vite.
- The three browser journeys pass against the live app built and served on GitHub, and the demo check passes on a fresh seed.
- The offline demo builds, and its two journeys pass.

## Not taken from these runs

- **Coverage percentages under real Jest:** they are in the `coverage-report` artifact, but were not read for this file. The 97.53 % line coverage in the Test Plan and Report is from the sandbox run.
- **Exact per-checkpoint output of the green run:** it is in the `e2e-journey` artifact.

The annotations show only warnings: actions running on Node 20 are deprecated, and the `ubuntu-latest` label is moving to Ubuntu 26. Neither fails a job.
