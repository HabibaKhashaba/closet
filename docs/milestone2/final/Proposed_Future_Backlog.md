# Proposed future backlog — proactive wardrobe intelligence (build v1.5)

**Status: PROPOSED — not in Jira yet.** These stories describe features that were built early in build v1.5 as a *Sprint 3 preview* (labelled so in the app).
They are not part of Sprint 1, they have no Jira history, and nothing here is a Jira export or a Jira metric.
To put them in Jira: import `Proposed_Backlog_Jira_Import.csv` into the backlog (not into a sprint), then the team estimates and prioritises them at Sprint 3 planning.

18 stories · 48 points (team estimate to confirm) · requirements FR-81 – FR-101 (SRS v1.2 §4.21)

| ID | Story | Priority | Points | Depends on | Requirements |
|---|---|---|---|---|---|
| US-94 | Still love it? — style, keep or donate a long-unworn piece | Medium | 3 | US-54, US-59 | FR-81, FR-82 |
| US-95 | Donate, give or sell a piece | Medium | 3 | US-13 | FR-83 |
| US-96 | Seasonal rotation | Low | 2 | US-56 | FR-84 |
| US-97 | Laundry before an event and multi-day plans | Medium | 3 | US-15, US-16, US-47 | FR-85, FR-86 |
| US-98 | Repeat a look — intentionally | Low | 2 | US-23 | FR-87 |
| US-99 | Outfit memory | High | 3 | US-91 | FR-88 |
| US-100 | Planned-outfit monitor (weather + availability) | High | 3 | US-79, US-24 | FR-89 |
| US-101 | Borrow tracker | Low | 2 | US-86 | FR-90 |
| US-102 | Explain my Wardrobe Health | Low | 1 | US-89 | FR-91 |
| US-103 | Duplicate check when adding | High | 2 | US-08, US-65 | FR-92 |
| US-104 | Gaps with confidence | High | 2 | US-64 | FR-93 |
| US-105 | What would this purchase add? | High | 3 | US-88, US-65 | FR-94 |
| US-106 | Trip capsule | Medium | 5 | US-68 | FR-95 |
| US-107 | I have nothing to wear | Medium | 2 | US-19 | FR-96 |
| US-108 | Cost per wear | Low | 2 | US-23 | FR-97 |
| US-109 | One notification center for proactive notices | Medium | 2 | US-92 | FR-98 |
| US-110 | Ask Closet understands my wardrobe questions | High | 5 | US-31 | FR-99 |
| US-111 | Offline demo on real logic | Medium | 3 | — | NFR-18 |

## Stories and acceptance criteria

### US-94 — Still love it? — style, keep or donate a long-unworn piece

As a user, I want Closet to point out a piece I have not worn in a long time and let me style it, keep it or donate it, so that my clothes get worn or go to someone who may need them.

Acceptance criteria:
- Only Available pieces, added 30+ days ago, in season, unworn 90 days (180 for formal-only pieces) are shown
- Style it opens three looks that all contain the piece
- Keep it hides the suggestion for 90 days (optional reason)
- Not now hides it for 14 days
- Wording is never judgmental

Priority Medium · 3 points · depends on US-54, US-59 · FR-81, FR-82

### US-95 — Donate, give or sell a piece

As a user, I want to mark a piece as ready to donate and confirm later that it has left, so that my closet stays accurate.

Acceptance criteria:
- Ready to donate keeps the piece in the closet and out of new outfits
- Mark as donated removes it with reason Donated; history is kept
- No replacement is added to the shopping bag
- Cancel restores it
- Another user’s piece → 404

Priority Medium · 3 points · depends on US-13 · FR-83

### US-96 — Seasonal rotation

As a user, I want Closet to suggest which pieces to store or bring back when the weather changes, so that my closet shows what I can wear now.

Acceptance criteria:
- Uses the temperature and each piece’s season, not the month alone
- Pack for season → Packed; Bring back → Available
- Already packed pieces are not suggested again
- Packed pieces never appear in outfits
- Nothing moves without confirmation

Priority Low · 2 points · depends on US-56 · FR-84

### US-97 — Laundry before an event and multi-day plans

As a user, I want to know when my most-worn pieces for an upcoming event are in the laundry, and get several days of outfits that do not repeat before washing.

Acceptance criteria:
- Warning only for 2 of the 3 most-worn suitable tops/bottoms in the laundry before an event within 7 days
- Irrelevant laundry never warns
- Wash done clears it
- Multi-day plan never repeats a top, bottom or dress unless repeats are allowed

Priority Medium · 3 points · depends on US-15, US-16, US-47 · FR-85, FR-86

### US-98 — Repeat a look — intentionally

As a user, I want Closet to suggest a variation when I wear almost the same look again, and to offer a look I loved, so that repeating is a choice.

Acceptance criteria:
- ≥ 3 shared main pieces within 7 days → variation offer
- ≥ 4★ look → positive repeat offer
- “Repeating is fine” setting stops the variation offer

Priority Low · 2 points · depends on US-23 · FR-87

### US-99 — Outfit memory

As a user, I want Closet to remember what I wore, where, in what weather and how I rated it, so that I can find it again and get better suggestions.

Acceptance criteria:
- Wear stores event title, occasion, temperature, condition, rating, note
- “What did I wear to Salma’s birthday?” finds it
- Highly rated similar context adds at most +3 to a piece’s rank

Priority High · 3 points · depends on US-91 · FR-88

### US-100 — Planned-outfit monitor (weather + availability)

As a user, I want to be warned before an event when a planned piece is unavailable or the forecast changed a lot, and fix only that piece.

Acceptance criteria:
- Current status is read every time (no copies)
- |Δ| ≥ 5 °C or rain → alert; smaller changes → none
- Adjust changes only the affected piece
- Alerts are deduplicated

Priority High · 3 points · depends on US-79, US-24 · FR-89

### US-101 — Borrow tracker

As a user, I want to see who has my piece and be reminded when it is overdue.

Acceptance criteria:
- Borrower and dates persist
- Overdue → one reminder
- Remind me later
- Mark returned → Available

Priority Low · 2 points · depends on US-86 · FR-90

### US-102 — Explain my Wardrobe Health

As a user, I want to know what raises and lowers my score.

Acceptance criteria:
- Same wardrobe → same score
- Top three lowering factors with points
- Practical tone

Priority Low · 1 points · depends on US-89 · FR-91

### US-103 — Duplicate check when adding

As a user, I want to know I already own something similar before I add a piece.

Acceptance criteria:
- Similarity on category, colour, type, style, dress code, season
- Add anyway / View similar / Cancel
- Different category never matches

Priority High · 2 points · depends on US-08, US-65 · FR-92

### US-104 — Gaps with confidence

As a user, I want to know which gaps really matter.

Acceptance criteria:
- HIGH / MEDIUM / LOW with reasons
- Never HIGH with equivalents one level away
- Sorted HIGH first

Priority High · 2 points · depends on US-64 · FR-93

### US-105 — What would this purchase add?

As a user, I want to see how many new outfits a piece I might buy would create before I buy it.

Acceptance criteria:
- Simulation never saves the piece
- Counts every owned piece, including laundry
- Near-duplicate → Probably unnecessary

Priority High · 3 points · depends on US-88, US-65 · FR-94

### US-106 — Trip capsule

As a traveller, I want a compact packing list that reuses versatile pieces within my luggage limit.

Acceptance criteria:
- Carry-on: ≤ 8 clothing, ≤ 2 shoes
- Max 2 wears per piece (3 with laundry)
- Remove a piece and re-plan
- Mark as packed updates the real pieces

Priority Medium · 5 points · depends on US-68 · FR-95

### US-107 — I have nothing to wear

As a user, I want the three best looks I can wear right now for an urgent event, and a real gap only if one exists.

Acceptance criteria:
- Wardrobe first
- Only Available pieces
- Gap only when no complete look exists

Priority Medium · 2 points · depends on US-19 · FR-96

### US-108 — Cost per wear

As a user, I want to see what each wear of a piece cost me.

Acceptance criteria:
- Optional price, currency, date
- Only confirmed wears count
- No wears → message, no division
- Edit recalculates

Priority Low · 2 points · depends on US-23 · FR-97

### US-109 — One notification center for proactive notices

As a user, I want all of Closet’s warnings in one place, prioritised and never repeated.

Acceptance criteria:
- Types and priorities
- Stable keys, no duplicates
- Donation notice at most weekly
- Home shows at most two

Priority Medium · 2 points · depends on US-92 · FR-98

### US-110 — Ask Closet understands my wardrobe questions

As a user, I want to ask in my own words about availability, laundry, donations, trips, value and memory, and get answers from my real data.

Acceptance criteria:
- 31 functions
- Follow-ups with it / this
- Questions never change state
- Out-of-scope reply

Priority High · 5 points · depends on US-31 · FR-99

### US-111 — Offline demo on real logic

As the team, we want the offline fallback to run the real services on local data so that it behaves like the product.

Acceptance criteria:
- Same seed
- Mutations change state; refresh keeps it in the tab
- Stateful E2E passes offline

Priority Medium · 3 points · depends on — · NFR-18

## Not built (ideas only)

- Learn the thresholds (90 days unworn, 5 °C weather change) from each user’s own behaviour instead of fixed constants.
- Donation partner directory and pickup booking.
- Shared closet with a friend for borrowing (both accounts confirm).
- Push notifications on the phone (the Notification Center is in-app only).
