# One source for the v1.6 (revision 5) requirements, changes, API rows and proposed stories.
# Used by the SRS v1.3, SDD v1.3, Test Plan and Report v1.3, the traceability matrix v1.6 and the API table v1.6.
# Story IDs US-112 – US-117 are PROPOSED: they are not in Jira until the team adds them.

# (FR, requirement, story, screen, API, module, tables, tests, demo step)
FRS = [
 ('FR-102', 'Every piece shall be in exactly one of nine lifecycle states — Available, Laundry, Borrowed, Packed, Needs repair, Needs alteration, At tailor, Ready to donate, Unavailable — and move only along the 21 allowed transitions. Only Available is wearable. Donated is not a state: the piece leaves the active closet (archived with reason Donated, wear history kept).',
  'US-112', 'Every screen (status badge, Closet filter)', 'PATCH /items/:id/status · GET /vocabulary', 'shared/lifecycle.js · Availability (setStatus)', 'availability.item_status (CHECK 9 states)', 'ST-01 – ST-06 · LF-01 – LF-04 · API-S01 – S06', 'all'),
 ('FR-103', 'The user shall mark a piece Needs repair or Needs alteration with a reason (≤ 80 chars) and optional notes, see it under Care → Repairs & alterations, and close it with Fixed at home (→ Available) or Donate (→ Ready to donate).',
  'US-113', 'Piece → More actions → Repair / Alter · Care → Repairs & alterations', 'POST /items/:id/care · POST /items/:id/care/done · GET /care', 'Availability (needsCare, careDone, care)', 'availability.care_jobs', 'LC-01 · LC-04 · LF-05 · OF-10 · E2E l03', '3'),
 ('FR-104', 'The user shall send a piece that needs care to a tailor with tailor name, date sent, expected return date and optional cost. While At tailor it is left out of outfits, plans and trips. On the expected day the Notification Center shows TAILOR_READY with Mark collected and Remind me later (1–30 days). Mark collected sets Available and keeps the care history.',
  'US-113', 'Care → Repairs & alterations (At tailor) · Home · Notifications', 'POST /items/:id/care/tailor · GET /intelligence/tailor · POST /intelligence/tailor/:itemId/remind · POST /items/:id/care/done', 'Availability · Proactive service · Closet Intelligence (notifications)', 'availability.care_jobs', 'LC-02 · LC-03 · LC-04 · ST-06 · E2E l03 – l05', '3'),
 ('FR-105', 'The Borrow & lend area shall list pieces currently lent (person, date lent, due date, note, days out, overdue first) and the returned history. Lend item records person (required), date lent and due date; Mark returned sets Available and closes the loan. A lent piece is excluded from outfits and raises a Planner conflict.',
  'US-114', 'Wardrobe → Borrow & lend · Piece → More actions → Lend item', 'POST /items/:id/lend · POST /items/:id/return · GET /lending', 'Availability (lend, returned, lending)', 'availability.loans', 'LC-10 – LC-12 · API-PR40 · OF-11 · E2E l06 – l07', '4'),
 ('FR-106', 'Donation is the only way to pass a piece on (no give or sell). Donate sets Ready to donate (still owned, left out of outfits, duplicates, gaps and purchase impact); the Donation area lists Ready to donate and the Donated history; Mark as donated archives the piece with reason Donated and adds no replacement to the Shopping bag; Cancel donation sets Available. Analytics shows the donated count.',
  'US-115', 'Wardrobe → Donation · Still love it? · Piece → More actions → Donate · Analytics', 'POST/DELETE /items/:id/donate · POST /items/:id/donate/done · GET /donation', 'Wardrobe (donate, cancelDonation, donationDone, donation) · Smart Shopping (no replacement)', 'availability.item_status · wardrobe.deletions', 'API-PR02 · API-PR03 · API-PR92 · LF-04 · LF-12 · E2E s08 – s09, l08 – l09', '7'),
 ('FR-107', 'Home shall show a Wardrobe status summary: total pieces, ready to wear, and one clickable line per non-empty state (laundry, borrowed, packed, needs repair / alteration, at tailor, ready to donate) that opens the place where that state is managed.',
  'US-112', 'Home → Wardrobe status', 'GET /items', 'Web app (HomeScreen)', '—', 'E2E l01 · stateful status check', '1, 13'),
 ('FR-108', 'Availability conflict alerts shall cover every non-wearable state and name it (“packed”, “lent out”, “at the tailor”, “waiting for an alteration” …) with the expected date written as a day (“Mon 2 Nov”) and the correct verb for plural garments.',
  'US-100 (changed)', 'Home “Closet noticed” · Planner · Notifications', 'GET /intelligence/monitor · GET /notifications', 'Proactive monitor · Closet Intelligence', '—', 'API-K01 – K04 · API-PR30 · API-PR32 · LC-03 · LC-11 · LF-06', '10'),
 ('FR-109', 'The repeat insight (FR-87) shall be visible on the outfit card (Keep it · Wear again · Change one piece · Show an alternative); Outfit history shall offer memory search, Wear again and Create a variation (FR-88).',
  'US-98, US-99 (UI)', 'Style me outfit card · Analytics → Outfit history', 'POST /intelligence/repeat · GET /intelligence/memory', 'Web app · Wardrobe Insights', '—', 'API-PR60 · API-PR62 · IN-30 – IN-34', '11'),
 ('FR-110', 'Style me shall offer an “I have nothing to wear” rescue for an occasion and date: three Available looks for its dress code and weather; a gap is named only when no complete look exists (FR-96).',
  'US-107 (UI)', 'Style me → Rescue panel · Ask Closet', 'POST /intelligence/rescue · POST /chat (event_rescue)', 'Proactive service (rescue) · Recommendation Engine', '—', 'LC-23 · LC-30 · LF-10', '—'),
 ('FR-111', 'The purchase check shall use the item name (≤ 40 chars) as well as category and colour, and count only owned pieces (not Ready to donate). The simulation shall show five blocks: New outfit combinations · Similar items owned · Wardrobe gap · Main occasions · Recommendation; nothing is saved.',
  'US-105 (changed)', 'Shopping → Do I need this? What would it add?', 'POST /shopping/check · POST /shopping/impact', 'Smart Shopping · Wardrobe Insights (purchaseImpact)', '—', 'API-PR71 · IN-62 · LC-22 · E2E lifecycle step 6', '9'),
 ('FR-112', 'Ask Closet shall map each message to one of 35 whitelisted functions, adding care_list (“What needs repair?”, “What is at the tailor?”), lend_piece (“Lend my black blazer to Nour until Friday”), donation_list, donate_piece, donate_done, unpacked (“What haven’t I packed?”), and tailor answers in availability (“When is my black blazer back from the tailor?”). Questions read state only.',
  'US-110 (changed)', 'Ask Closet', 'POST /chat · POST /chat/undo/:id', 'Ask Closet (keyword parser / LLM adapter)', 'assistant.actions', 'LF-10 (22 prompts) · LF-11 · LF-12 · API-PR90 – PR93 · E2E s10', '12'),
 ('FR-113', 'The Planner shall offer Plan several days (FR-86) and the Closet gaps view shall show each gap’s confidence (HIGH / MEDIUM / LOW) and reasons (FR-93).',
  'US-97, US-104 (UI)', 'Planner → Plan several days · Closet → Closet gaps', 'POST /intelligence/plan-days · GET /intelligence/gaps', 'Web app · Wardrobe Insights', '—', 'API-PR21 · API-PR72 · LC-20', '10'),
]

NFRS = [
 ('NFR-17 (extended)', 'One source of truth for the lifecycle: the states, transitions, labels and the questions “wearable / owned / leaving / in care” live only in shared/lifecycle.js; every status change (including lending, care and donation) goes through Availability.setStatus, which keeps loans and care jobs in step.', 'ST-01 – ST-06 · LF-01 – LF-04 · LC-01 – LC-12 · code review'),
 ('NFR-18 (extended)', 'Offline parity covers Care, Borrow & lend and Donation: the offline demo runs the same services and schemas; the lifecycle journey passes unchanged against it.', 'OF-10 · OF-11 · e2e/lifecycle_journey.py (offline)'),
 ('NFR-19', 'One calendar day for the app: “today” is the UTC day on the server, in the seed and in the E2E journeys, so dates such as lent on, sent on and expected back never disagree across midnight.', 'LC-10 · defect D-18'),
]
BRS = [
 ('BR-12 (changed)', 'A donated piece never creates a replacement on the shopping list. Give away and sell are no longer offered (v1.5 rows with those reasons are still readable).'),
 ('BR-14', 'A piece that needs care, is at the tailor, is lent out or is ready to donate is never recommended, planned or packed until it is Available again.'),
]

CHANGES = [
 ('C-85', 'Added', '4.22', 'One garment lifecycle with nine states and 21 transitions (FR-102); supersedes the five-status machine of FR-27 – FR-29 and the separate rehoming intention.'),
 ('C-86', 'Added', '4.22', 'Care: Repairs & alterations and the tailor flow with return reminder (FR-103, FR-104).'),
 ('C-87', 'Changed', '4.21 FR-90', 'Borrow tracker → Borrow & lend area with lend form and history (FR-105).'),
 ('C-88', 'Changed', '4.21 FR-83 · BR-12', 'Donate / give / sell → donate only, Ready to donate as a state, Donation area (FR-106).'),
 ('C-89', 'Added', '4.22', 'Home Wardrobe status with clickable counts (FR-107).'),
 ('C-90', 'Changed', '4.21 FR-89', 'Conflict alerts name every non-wearable state with a readable date (FR-108).'),
 ('C-91', 'Changed', '4.21 FR-86 – FR-88, FR-93, FR-96', 'UI entry points for multi-day plans, repeat insight, outfit memory, gap confidence and event rescue (FR-109, FR-110, FR-113).'),
 ('C-92', 'Changed', '4.21 FR-94', 'Purchase check uses the item name; simulation shows five named blocks (FR-111).'),
 ('C-93', 'Changed', '4.21 FR-99', 'Ask Closet 31 → 35 functions (FR-112).'),
 ('C-94', 'Added', '5.4', 'NFR-17 and NFR-18 extended; NFR-19 one calendar day.'),
 ('C-95', 'Added', '5.5', 'BR-12 changed; BR-14.'),
 ('C-96', 'Added', '6.3', 'Data: migration 007 (item_status CHECK 9 states, availability.care_jobs, availability.loans; wardrobe.rehoming converted to Ready to donate, then dropped).'),
 ('C-97', 'Changed', '6.4', 'Traceability extended to FR-102 – FR-113 (Closet_Traceability_Matrix_v1.6.xlsx).'),
]

# New or changed routes in v1.6 (all under /api/v1, behind the security pipeline; another user's piece → 404).
API = [
 ('PATCH', '/items/:id/status', 'Simple moves (Laundry, Packed, Unavailable, back to Available) — now 9 states', 'JWT · owner', '{ status* (9 states), until, note }', 'Piece', '400 · 404 · 409 move not allowed'),
 ('POST', '/items/:id/care', 'Needs repair / Needs alteration (opens a care job)', 'JWT · owner', '{ kind*: repair|alteration, reason* ≤ 80, notes ≤ 200 }', 'Piece with care', '400 · 404 · 409'),
 ('POST', '/items/:id/care/tailor', 'Send to tailor → At tailor', 'JWT · owner', '{ tailor ≤ 60, sentOn, expectedBack*, cost 0–100000 }', 'Piece with care { tailor, sentOn, expectedBack, cost }', '400 · 404 · 409'),
 ('POST', '/items/:id/care/done', 'Mark collected / Fixed at home → Available (job closed, history kept)', 'JWT · owner', '—', 'Piece', '404 · 409'),
 ('GET', '/care', 'Care overview: at tailor, needs alteration, needs repair, history', 'JWT', '—', '{ atTailor[], needsAlteration[], needsRepair[], laundry, history[] }', '—'),
 ('POST', '/items/:id/lend', 'Lend item → Borrowed (opens a loan)', 'JWT · owner', '{ person* ≤ 60, lentOn, dueOn*, note ≤ 120 }', 'Piece with loan', '400 · 404 · 409'),
 ('POST', '/items/:id/return', 'Mark returned → Available (loan closed, history kept)', 'JWT · owner', '—', 'Piece', '404 · 409'),
 ('GET', '/lending', 'Borrow & lend: currently lent (overdue first) and history', 'JWT', '—', '{ current[], overdue, history[] }', '—'),
 ('POST', '/items/:id/donate', 'Donate → Ready to donate (still owned)', 'JWT · owner', '—', 'Piece', '404 · 409'),
 ('DELETE', '/items/:id/donate', 'Cancel donation → Available', 'JWT · owner', '—', 'Piece', '404 · 409'),
 ('POST', '/items/:id/donate/done', 'Mark as donated → archived with reason Donated; no replacement', 'JWT · owner', '—', '{ deleted, reason: Donated, effect, addedToShoppingList: null }', '404 · 409'),
 ('GET', '/donation', 'Donation area: ready to donate and donated history', 'JWT', '—', '{ ready[{ markedOn, daysSinceWorn }], donated[{ donatedAt }], count }', '—'),
 ('GET', '/intelligence/tailor', 'Pieces due back from the tailor today or earlier', 'JWT', '—', '{ due[] }', '—'),
 ('POST', '/intelligence/tailor/:itemId/remind', 'Remind me later (tailor)', 'JWT · owner', '{ days 1–30 }', '{ until }', '400 · 404'),
 ('POST', '/intelligence/rescue', '“I have nothing to wear”: three Available looks for an occasion and date', 'JWT', '{ occasion*, date }', '{ outfits[], weather, level, levelName, solved, gap, shopping, message }', '400'),
 ('POST', '/shopping/check', 'Quick purchase check — now with name; owned pieces only', 'JWT', '{ category*, colour, name ≤ 40, … }', '{ verdict, similarOwned[], … }', '400'),
 ('POST', '/chat', 'Ask Closet — 35 functions', 'JWT', '{ message* ≤ 500, context, pieceId }', '{ function, reply, …, undoId }', '400 · 404'),
 ('—', '/items/:id/rehome (POST · DELETE · /done)', 'REMOVED in v1.6 (replaced by /donate)', '—', '—', '—', '404'),
]

STORIES = [
 ('US-112', 'One status I can trust', 'As a user, I want every piece to show exactly one state that every screen agrees on, and a summary on Home, so that I know what I can wear.', ['Nine states, 21 allowed moves; others → 409', 'Only Available appears in outfits, plans and trips', 'Home Wardrobe status counts open the place where each state is managed'], 'US-13, US-15', 3, 'High', 'FR-102, FR-107'),
 ('US-113', 'Repairs, alterations and the tailor', 'As a user, I want to record that a piece needs a repair or an alteration, send it to a tailor and be reminded when it should be ready, so that it comes back into my outfits.', ['Reason required; optional notes', 'Tailor, sent, expected back, cost', 'Left out of outfits while away', 'Reminder on the expected day; Remind me later', 'Mark collected → Available, history kept'], 'US-112', 5, 'High', 'FR-103, FR-104'),
 ('US-114', 'Borrow & lend', 'As a user, I want to record who borrowed a piece and when it is due, so that I get it back.', ['Person required; lent and due dates', 'Overdue first', 'Mark returned → Available; history kept', 'Planner conflict for a lent planned piece'], 'US-112, US-101', 3, 'Medium', 'FR-105'),
 ('US-115', 'Donate a piece', 'As a user, I want to set aside pieces to donate and confirm when they have left, so that my closet stays accurate and nothing is re-bought.', ['Donate only (no give / sell)', 'Ready to donate stays in the closet, out of outfits', 'Mark as donated: archived, history kept, no replacement', 'Cancel donation restores it', 'Analytics shows the donated count'], 'US-95', 3, 'Medium', 'FR-106'),
 ('US-116', 'See the intelligence features in the app', 'As a user, I want the repeat insight, outfit memory, multi-day plan, gap confidence and rescue to be buttons in the app, not only answers in Ask Closet.', ['Each has a visible entry point', 'Same rules as the API', 'Nothing changes without a click'], 'US-97 – US-107', 5, 'Medium', 'FR-109, FR-110, FR-113'),
 ('US-117', 'Ask Closet about care, loans and donations', 'As a user, I want to ask what needs repair, who has my blazer, what is ready to donate and what I haven’t packed.', ['35 functions', 'Questions read state only', 'Lend from a sentence (person + date)'], 'US-110', 2, 'Medium', 'FR-111, FR-112'),
]
