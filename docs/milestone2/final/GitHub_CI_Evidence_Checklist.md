# GitHub and CI evidence checklist (Milestone 2)

Status: **CONFIGURED, NOT EXECUTED.** The workflow file exists; it has not yet run on GitHub. Nothing below is a GitHub screenshot or a CI result.

## What exists in the repository
- `.github/workflows/ci.yml` with jobs: `server` (unit + API on a PostgreSQL 16 service, `npm run coverage`, uploads `coverage-report`), `client` (Vite build), `e2e` (seed, demo-check, demo journey, stateful journey; `WEATHER_MODE=estimate`, `set -o pipefail`), `offline-demo` (build `Closet_Demo.html`, run the stateful journey on the file).
- `render.yaml` — Render blueprint **configured**; deployment **not verified**. The local demo is the verified presentation path.
- Local git history of the final pass (commits authored “Claude (M2 final pass)”, on top of the team baseline). Push it to the team repository so the history is visible.

## Team actions
- [ ] Push the final branch to the team GitHub repository (`git push origin <branch>`), open a pull request into `main`.
- [ ] Wait for the workflow to run. Screenshot the **Actions** run with all jobs green — or, if a job fails, fix it and keep the screenshot of the failing run and of the fix (that is real evidence too).
- [ ] Download the `coverage-report` artifact from the run; compare with the sandbox numbers (lines 97.24 %, branches 83.42 %, functions 91.09 %). If they differ, the CI numbers win: update the Test Report §1 and the slide.
- [ ] Screenshot: commit history (Insights → Commits or the PR commits tab), the PR with review comments, contributors graph.
- [ ] Run once locally with real packages: `npm install && npm test && npm --prefix server run coverage && npm --prefix client run build`. Record the result in `05_Testing/evidence/official_run.txt`.
- [ ] Paste the screenshots into the deck slide “Evidence from GitHub” (frames say “Screenshot pending — real GitHub capture” until then).

## What you may say in the presentation until then
- “CI is configured with unit, API, browser and offline-demo jobs; its first run is pending.”
- “497 of 497 tests pass in our final run on a real PostgreSQL database; the official npm run on a team laptop is pending.”
- Not: “CI is green”, “deployed on Render”, or any coverage number other than the measured one.
