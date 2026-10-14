# Closet – AI-assisted digital wardrobe

CSCE 3701 Software Engineering · Fall 2026 · Team Closet

Closet is a mobile app that knows which clothes you own and which are in the laundry. Pick an occasion and a style and it gives you three explained outfits for today's weather. You can change one piece, try the outfit on an avatar, wear it and rate it, and ask the AI chat to act on your closet. Closet learns from every reaction and shows what it learned, with Undo.

## Team

| Member | Role |
| --- | --- |
| Habiba | Requirements and user research |
| Salma | Frontend |
| Bashar | Recommendation engine and AI · UML use case diagram |
| Karim | Backend and database |
| Youssef | Testing, integration and deployment · UML component diagram |

## Milestone 1 – Scoping, Requirements and Architecture

| Deliverable | File |
| --- | --- |
| Requirements specification + architectural design and description | [Closet_M1_Requirements_and_Architecture.pdf](Closet_M1_Requirements_and_Architecture.pdf) |
| UML use case diagram | [Closet_Use_Case_Diagram.png](Closet_Use_Case_Diagram.png) |
| UML component diagram | [Closet_Component_Diagram.png](Closet_Component_Diagram.png) · [SVG](Closet_Component_Diagram.svg) |
| Clickable prototype | [index.html](index.html) – open in a browser (AI, weather and calendar are simulated and labelled) |
| Product backlog (Jira import) | [closet_jira_import.csv](closet_jira_import.csv) |

**Backlog:** 70 user stories in 10 epics (43 Must · 11 Should · 16 Could). 50 committed for December 1, 2026, 15 stretch, 5 future. Tracked in Jira: https://aucegypt-team-r73i3oon.atlassian.net/jira/software/projects/SCRUM/boards/1.

## Architecture

A layered **modular monolith**: a React web app → API Gateway (Facade) → one Node.js process with one module per feature area (Accounts & Profile, Wardrobe, Availability, Recommendation Engine, Outfits, Ask Closet, Planner, Analytics, Privacy & Settings, Vision) connected by interfaces and an in-process Event Bus → adapters with fallbacks for the language-model, weather and vision APIs → PostgreSQL, object storage and a cache.

## Planned code layout (from Sprint 1)

```
client/            React web app (MVC)
server/
  src/gateway/     API Gateway: auth, validation, routing
  src/modules/     one folder per module, each with its own repository and tables
  src/events/      in-process Event Bus
  src/adapters/    language model, weather, vision adapters + fallbacks
docs/              SRS/SDS, UML diagrams
```

## Sprint plan

| Sprint | Dates | Goal |
| --- | --- | --- |
| S1 | Oct 11 – 24 | A working closet |
| S2 | Oct 25 – Nov 7 | Outfits that explain themselves |
| S3 | Nov 8 – 21 | AI chat, learning, planning, analytics |
| Release | Nov 22 – Dec 1 | Integration, testing, demo |

## How we work

- `main` is always deployable; work happens on feature branches named `US-xx-short-name`.
- Every change goes through a pull request reviewed by a teammate; tests run on every pull request.
- Commit messages and branches reference the Jira story (e.g. `US-19`), so Jira links them automatically.
- The requirements and design document is updated at every sprint review.
