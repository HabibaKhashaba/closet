# (source slide, speaker, start, about, words) — the spoken script for Closet_M2_Presentation.pptx.
# 32 slides, 10 minutes: many are animation frames (doors, zooms) that only need one click.
S = [
 (1, 'HABIBA', '0:00', 'Logo', 'Good morning, Dr. Sherif, and good morning everyone. We are Team Closet — I’m Habiba, with Salma, Bashar, Karim and Youssef.'),
 (2, 'HABIBA', '0:11', 'The dressing room', 'How many of you stood in front of a full closet this morning and felt you had nothing to wear?'),
 (3, 'HABIBA', '0:22', 'The closed doors', 'That everyday problem is where our project begins. <i>[Click — the doors open.]</i>'),
 (4, 'HABIBA', '0:30', 'The doors open', 'Inside: everything you own — but no idea what to wear today.'),
 (5, 'HABIBA', '0:38', 'Title',
  'This is Closet: an intelligent wardrobe that learns how you dress. You photograph each piece once; from then on Closet knows what you own, what is clean and at home, the weather and your calendar, '
  'and suggests complete outfits from your own clothes. In ten minutes: what Sprint 1 delivered, the app today, the design, how we tested it, and what we learned.'),
 (8, 'HABIBA', '1:07', 'Sprint 1: a working closet',
  'Sprint 1 ran from October 11 to 24 with one goal: a working closet — a signed-in user can build and manage a real digital closet. '
  'We committed to 15 stories and 48 story points and finished all of them: secure sign-in, the style quiz, adding and browsing pieces, laundry and availability, and the planner. Each card is one story with its owner.'),
 (9, 'HABIBA', '1:37', 'Evidence from Jira',
  'All of it was managed in Jira, in our project SCRUM. Every story has an owner, points and a status. Sprint 1 is closed with every story done, and Sprints 2 and 3 are already planned with tasks for each of us.'),
 (10, 'HABIBA', '1:57', 'Milestone 1 feedback',
  'You gave us feedback on Milestone 1 and we changed the design: a security pipeline in front of every module, an Admin actor in the use case diagram, and the core flow first in the documents. '
  'Every change has an ID in the change log of the SRS and SDD version 2.0. Karim will now show you the product.'),
 (22, 'KARIM', '2:25', 'Three looks',
  'Thank you, Habiba. This is the heart of Closet. The user chooses the occasion — university, work or a wedding. Closet reads only the pieces that are really available, nothing in the laundry or lent to a friend, '
  'checks the weather, and builds three complete looks. Each has a match percentage and says why it works. If you like a look but not one piece, change just that piece. '
  'You can save, wear or reject it, and Closet learns from that. Every look now has a Virtual Try-On button — Youssef built it.'),
 (24, 'YOUSSEF', '3:07', 'Virtual Try-On',
  'Thanks, Karim. Virtual Try-On answers the question every user asks: how will this look on me? It is image-based — no camera, no AR. You pick one piece from a look — a top, a jacket or a dress — '
  'upload a full-body photo or reuse your saved one, and agree to a short notice, because the photo goes to an external AI service. '
  'The browser never talks to the AI provider: our server checks the photo and the piece, sends both to the try-on service, waits for the job, and shows the result labelled AI-generated. '
  'If it fails, the app explains why and offers Retry. Bashar will take you into the design.'),
 (52, 'BASHAR', '3:58', 'Use case diagram',
  'Thank you, Youssef. This is our UML use case diagram: two actors, the User and the Admin, and the external services Closet depends on. Let me walk you through it. <i>[Click — zoom.]</i>'),
 (53, 'BASHAR', '4:15', 'Zoom · the user’s side',
  'The user’s side: register and sign in, build the closet, manage laundry and availability, plan events — that is Sprint 1 — and then get outfits, change a piece, try it on and ask Closet. <i>[Click.]</i>'),
 (54, 'BASHAR', '4:33', 'Zoom · the Admin',
  'The Admin you asked for in Milestone 1: manages accounts, system health and privacy requests — but never sees anyone’s wardrobe. <i>[Click.]</i>'),
 (55, 'BASHAR', '4:45', 'Zoom · external services',
  'And the external services as actors: the AI try-on service, the language model for Ask Closet, weather, calendar and notifications. <i>[Click — back out.]</i>'),
 (56, 'BASHAR', '4:58', 'The whole diagram again',
  'Each use case is traced to its requirements and tests in the SRS. Youssef will show you the architecture behind it.'),
 (60, 'YOUSSEF', '5:09', 'Component diagram',
  'This is the component diagram. Closet is a modular monolith: the React web app, the API gateway and security pipeline, the feature modules, and the adapters to outside services. <i>[Click — zoom.]</i>'),
 (61, 'YOUSSEF', '5:25', 'Zoom · security pipeline',
  'Every request passes the security pipeline first: the gateway, validation, authentication, access control and the audit log — this answers your authentication comment. <i>[Click.]</i>'),
 (62, 'YOUSSEF', '5:38', 'Zoom · application modules',
  'Then the modules — wardrobe, availability, recommendation, outfits, planner and the rest. They talk only through interfaces and an event bus, and each owns its own database schema. <i>[Click.]</i>'),
 (63, 'YOUSSEF', '5:53', 'Zoom · adapters',
  'Outside services sit behind adapters with fallbacks: weather, the language model, the calendar — and the new Virtual Try-On provider, so we can switch AI companies without touching the app. <i>[Click — back out.]</i>'),
 (64, 'YOUSSEF', '6:10', 'The whole diagram again', 'That is how the whole system fits together. Salma will show you how we know it works.'),
 (126, 'SALMA', '6:20', 'Testing',
  'Thank you, Youssef. We tested on four levels: unit tests for the rules, API tests against a real PostgreSQL database, one acceptance test per Sprint 1 story, and browser tests that click through the real app. '
  'On the final Sprint 1 build, 599 of 599 automated tests passed with 97 percent line coverage, using equivalence classes, boundary values and state-transition tests.'),
 (132, 'SALMA', '6:49', 'Green on GitHub',
  'And these are the real GitHub Actions runs: every push runs the server tests, the web app build, the browser journeys and the offline demo — all four green. '
  'With Virtual Try-On the suite grew to 631 tests, including 23 new unit tests and 9 API tests.'),
 (137, 'SALMA', '7:11', 'Retrospective',
  'Our retrospective. What went well: the Milestone 1 architecture held, and tests caught real bugs before the demo. What did not: integration came late, and Jira was not updated daily. '
  'What we change: Jira every day, dependency checks in planning, and deploying earlier. Habiba.'),
 (145, 'HABIBA', '7:33', 'Sprint 1', 'Thank you, Salma. In Sprint 1 we built the closet.'),
 (146, 'HABIBA', '7:39', 'Sprint 2', 'In Sprint 2 we make it intelligent — the live AI try-on, real photos and usability tests.'),
 (147, 'HABIBA', '7:49', 'Sprint 3', 'And in Sprint 3, Closet learns from you — from what you wear, save and reject.'),
 (148, 'HABIBA', '7:58', 'The camera pulls back', '<i>[Click — the camera pulls back.]</i>'),
 (149, 'HABIBA', '8:04', 'The whole room', 'Everything you saw today, in one room.'),
 (150, 'HABIBA', '8:09', 'The wardrobe', '<i>[Click — the closet closes.]</i>'),
 (151, 'HABIBA', '8:14', 'The doors close', ''),
 (152, 'HABIBA', '8:16', 'The lights dim', ''),
 (153, 'HABIBA', '8:19', 'Questions',
  'Your wardrobe, your style, your context — one intelligent system. Thank you. We are happy to answer your questions, and we can show the app live.'),
]
