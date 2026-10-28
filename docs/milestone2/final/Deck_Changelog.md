# Presentation changelog — Milestone 2 final (build v1.5)

Edited in place from `Closet_M2_FINAL_Interactive.pptx` (127 slides). Same art, same fonts (Lora + Inter — the deck never used Georgia/Arial), same Morph object names, all speaker notes kept. Scripts: `docs/milestone2/slides-source/edit.py` (interactive) and `linear.py` (linear, derived from the edited interactive deck).

Note on slide numbers: the spec referred to a 97-slide version with the hub on 5/15/35/60/74/81. The deck we received has 127 slides; the room hub is on 7/20/52/70/77/81 (now 7/21/59/77/84/88) and the opening is 1–6. The opening (1–6) and closing (86–89, now 93–96) were not redesigned.

## Done
| Area | Change |
|---|---|
| Hub | Labels numbered 01 SPRINT · 02 PRODUCT · 03 INSIDE THE SYSTEM · 04 QUALITY · 05 RETROSPECTIVE · 06 DOCUMENTS; progress state: a ✓ replaces the number of every finished section on each later hub. Standing (oval) mirror is labelled RETROSPECTIVE. Hotspots unchanged. |
| Proactive scene | New slide “Closet is becoming proactive” after the demo: Weather changed · Laundry risk · Trip packing · Still love it? — four real screenshots from build v1.5. Everything else proactive is in the appendix. |
| Diagrams | New v1.5 slides after each baseline: use cases (proactive), component v1.5, ER additions, state + rehoming, two sequences (donate, monitor). Each with a one-line caption and a Back link. |
| Numbers | 497 / 497 tests, 317 unit + 180 API, 15 acceptance, coverage 97.24 / 83.42 / 91.09 %, 58 + 15 + 15 browser steps, 17 defects, SRS/SDD v1.2 counts (101 FR, 18 NFR, 30 UC, 84 + 18 proposed stories, 86 changes), Ask Closet 31 functions, “2 similar” beige bottoms. No old figure remains (checked by text search). |
| Honesty | Jira slide: visible “SCREENSHOTS PENDING” label until real captures are pasted. CI slide: “configured; first run on GitHub pending”. Render: “blueprint configured; the local demo is the verified presentation path”. Test notes mention the shimmed final run. |
| Appendix | Test plan and results of the final run; new defect log D-08 – D-17; new “What proactive means, feature by feature” (requirement + test IDs). |
| Media | All 21 app screenshots retaken on build v1.5 (2880 × 1800); hand-off picture retaken; embedded backup video re-recorded on v1.5 (3:43) with a new poster frame. |
| Notes | Updated on every changed slide; new slides have notes; slide 7 notes contain the presenter cheat-sheet. |
| Checks | Both decks pass the OOXML validator; 0 broken slide links (276 interactive, 103 linear); PDF rendered from the linear deck (83 pages). |

## Not done (and why)
- Re-drawn hub art (layered closet with garments on rails), new entry/exit art per object (door opening, drawer, box lid), ambient animation, peek cards, count-up, flip cards, “Break it” button, fog reveal and drawer Q&A: these need new illustrated assets and PowerPoint animation authoring that cannot be verified without PowerPoint desktop. The existing Morph camera moves stay as they were.
- Morph playback, clickable objects and video playback were checked structurally (XML, links), not played — PowerPoint is not available here. Rehearse once in PowerPoint desktop.
- Jira and GitHub screenshots: only the team can capture them.
