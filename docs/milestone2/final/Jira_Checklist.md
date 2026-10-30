# Jira checklist — Sprint 1 (project SCRUM)

Status: **PENDING USER ACTION.** This is what the real Jira sprint must show. Nothing here is a Jira export or a Jira metric — capture the real screenshots and place them on the “Evidence from Jira” slide.

**Sprint** — name “Closet Sprint 1”, Oct 11 – Oct 24, 2026. **Goal:** “A signed-in user can build and manage a real digital closet — profile, pieces with photos, statuses and laundry, events and closet gaps.” **Committed:** 15 stories / 48 points; all Done.

| Story | Summary | Owner | Points | Priority | Status | Acceptance criteria |
| --- | --- | --- | --- | --- | --- | --- |
| US-01 | Register and log in with email or Google | Karim | 8 | Highest | Done | Password ≥ 8 chars or Google; wrong password shows an error; no other user’s data is ever returned |
| US-06 | Delete my account and all my photos and data | Karim | 2 | Highest | Done | Double confirmation; all data and photos deleted within 24 h |
| US-08 | Add a piece by taking or uploading a photo | Bashar | 8 | Highest | Done | JPG/PNG/HEIC ≤ 10 MB stored and shown as the piece’s image |
| US-09 | Enter category, colour, fabric, season, size, style, dress code | Karim | 2 | Highest | Done | Values from 3.1; category, colour and ≥ 1 dress-code level required |
| US-11 | Review and edit every detail before saving | Salma | 2 | Highest | Done | One review screen; the piece exists only after Save |
| US-12 | Browse and filter my closet by category and status | Salma | 2 | Highest | Done | Filters combine; counts update |
| US-71 | Edit a piece’s details later | Salma | 2 | Highest | Done | Changes appear in all outfits and filters |
| US-15 | Put a piece in the laundry basket and take it out | Habiba | 2 | Highest | Done | One tap each way; basket lists all Laundry pieces |
| US-16 | Return everything with one “Wash done” tap | Habiba | 2 | High | Done | All Laundry pieces become Available |
| US-56 | Set a status per piece (5 statuses) | Salma | 2 | Highest | Done | Exactly one status, shown as a badge |
| US-02 | Answer a short style quiz: styles, colours, occasions | Bashar | 2 | Highest | Done | ≤ 4 steps, skippable; answers change the first recommendation |
| US-03 | Set my usual dress code and a modest preference | Bashar | 2 | Highest | Done | One of the 5 levels; with modest on, no non-modest piece appears anywhere |
| US-04 | Set my city so outfits use my local weather | Habiba | 2 | Highest | Done | Forecast on Home is for that city |
| US-46 | Add events by hand and see them in a calendar | Karim | 8 | Highest | Done | Title, date, time and one occasion; month view |
| US-64 | See closet gaps by category and dress code | Habiba | 2 | Medium | Done | Gap = ≤ 1 piece at a level the user dresses for |

**US-61** “Hide a piece for 7 days without it being a dislike” → Sprint 2, with the comment: “Moved at Sprint 1 planning: it hides a piece from recommendations, which are built in Sprint 2 (dependency).”

## Screenshots to capture
- [ ] Sprint backlog: the 15 stories with owners and points
- [ ] Sprint 1 board with every story in Done
- [ ] Burndown chart or Sprint report — exactly what Jira shows (do not redraw it; our retrospective already says the board was updated late)
- [ ] Sprint details (goal, dates) if not visible above
- [ ] Place them on the slide “Evidence from Jira” (paste into the three frames)

## Milestone 2 final pass — what changed for Jira (build v1.5)

Nothing below has been done in Jira by us; each line is an action for the team.

- [ ] **Do not** add the v1.5 proactive stories to Sprint 1 — Sprint 1 stays 15 stories / 48 points as committed.
- [ ] Import `Proposed_Backlog_Jira_Import.csv` into the **backlog** (18 stories US-94 – US-111, status To Do, label `proposed`). Estimates are a first guess (48 points) — re-estimate at Sprint 3 planning.
- [ ] Optional: link the defect fixes D-08 – D-17 (`05_Testing/evidence/defects.md`) as Bugs under the stories they affected (US-19, US-20, US-41, US-88 …). Only if the team wants Jira to reflect them; they were found in the final pass, not during Sprint 1.
- [ ] Screenshot after the import: the backlog with the proposed stories **below** the sprint, so it is clear they are future work.

## Slide placeholders that need these screenshots

| Slide (interactive deck) | Frame | Screenshot |
|---|---|---|
| “Evidence from Jira” | 1 | Sprint backlog with the 15 stories, owners, points |
| “Evidence from Jira” | 2 | Board with every story in Done |
| “Evidence from Jira” | 3 | Burndown / Sprint report, exactly as Jira shows it |

Until they are pasted, the frames say **“Screenshot pending — real Jira capture”**. Do not replace them with a drawing.


## Review preparation (after Sprint 1, in progress)

| Jira | Task | Owner | Status |
| --- | --- | --- | --- |
| SCRUM-65 | T-21 Check SDD diagrams against the code; present Station 3 (System) | Bashar | In progress |
| SCRUM-66 | T-22 Run the demo preflight; drive the live demo | Karim | In progress |
| SCRUM-67 | T-23 PowerPoint playback check; manual re-test of US-11, US-12, US-71 | Salma | In progress |
| SCRUM-64 | US-118 Realistic AI virtual try-on (proposed, 8 points) | — | To Do |
