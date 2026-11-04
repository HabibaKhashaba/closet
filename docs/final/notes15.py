# (slide, speaker, start, about, words) — the full spoken script: 15 slides, 10 minutes (≈ 130 words a minute).
# Used for the speaker notes of Closet_M2_Presentation.pptx and for Closet_Presentation_Script.pdf.
S = [
 (1, 'HABIBA', '0:00', 'The closet opens',
  'Good morning, Dr. Sherif, and good morning everyone. We are Team Closet — I’m Habiba, and with me are Salma, Bashar, Karim and Youssef. '
  'How many of you stood in front of a full closet this morning and felt you had nothing to wear? '
  'That everyday problem is where our project begins. <i>[Click — the doors open.]</i>'),
 (2, 'HABIBA', '0:27', 'Title',
  'This is Closet: an intelligent wardrobe that learns how you dress. You photograph each piece once. From then on, Closet knows what you own, what is clean and at home, '
  'what the weather will be, and what is on your calendar — and it suggests complete outfits from the clothes you already have. '
  'In the next ten minutes we will show you what we delivered in Sprint 1, what the app looks like today, how it is designed, how we tested it, and what we learned as a team.'),
 (3, 'HABIBA', '1:08', 'Sprint 1: a working closet',
  'Sprint 1 ran from October 11 to October 24, and its goal was simple: a working closet. That means a signed-in user can build and manage a real digital closet. '
  'We committed to 15 user stories, 48 story points, and we finished all of them. They cover secure sign-in, the style quiz, adding and browsing pieces, laundry and availability, and the planner. '
  'Each card on this slide is one story with its owner.'),
 (4, 'HABIBA', '1:42', 'Evidence from Jira',
  'All of this was managed in Jira, in our project called SCRUM. Here you can see the real sprint: every story has an owner, story points and a status. '
  'Sprint 1 is closed with every story done. Sprint 2 and Sprint 3 are already planned, and each of us has tasks assigned for them — so the backlog is not only past work, it is our plan for the next weeks.'),
 (5, 'HABIBA', '2:16', 'Milestone 1 feedback',
  'In Milestone 1 you gave us feedback, and we took it seriously. Authentication was not evident in the design — so now there is a security pipeline in front of every module: '
  'the gateway, validation, authentication and access control. The Admin actor was missing from the use case diagram — now the Admin manages accounts and system health, '
  'but can never see anyone’s wardrobe. '
  'Every one of these changes has its own ID in the change log of the SRS and SDD version 2.0, so you can trace exactly what changed and why. Now Karim will show you the product.'),
 (6, 'KARIM', '3:02', 'Three looks',
  'Thank you, Habiba. This is the heart of Closet. The user chooses the occasion — for example university, work or a wedding. Closet then reads only the pieces that are actually available, '
  'so nothing in the laundry or lent to a friend, checks the weather for that day, and builds three complete looks. '
  'Every look has a match percentage, and Closet explains why it chose it — for example, that the colours match or that the fabric suits thirty degrees. '
  'If you like a look but not one piece, you can change just that piece and the rest of the outfit stays. You can save it, wear it, or reject it with a reason, and Closet learns from that. '
  'And on every look there is now a new button: Virtual Try-On. Youssef built it, so I’ll let him show you.'),
 (7, 'YOUSSEF', '4:05', 'Virtual Try-On',
  'Thanks, Karim. Virtual Try-On answers the question every user asks: how will this actually look on me? It is image-based — no camera and no AR. '
  'From one of the three looks, you pick one piece — a top, a jacket or a dress. You upload a clear full-body photo, or reuse the photo you saved last time, and you agree to a short notice, '
  'because your photo is sent to an external AI service. Then you press Generate. '
  'The browser never talks to the AI provider: our server checks the photo and the piece, then sends both to the try-on service. The screen shows “Creating your virtual try-on”, and when the image is ready it appears, clearly labelled as AI-generated. '
  'If something fails, the app tells you why in plain words and offers Retry. The API key never leaves our server. '
  'Bashar will now take you into the design.'),
 (8, 'BASHAR', '5:12', 'Use case diagram',
  'Thank you, Youssef. This is our UML use case diagram. It has two actors: the User and the Admin. Around the system you can see the external services Closet depends on — '
  'the weather service, the calendar, the language model for Ask Closet, and now the AI try-on service. The User’s side is large, because almost everything is done by the user; '
  'the Admin’s side is small on purpose: accounts and system health only. <i>[Click — the camera zooms in.]</i>'),
 (9, 'BASHAR', '5:49', 'Zoom: the user’s side',
  'Zooming into the user’s side: the user registers and signs in, builds the closet, manages availability and laundry, and gets outfit recommendations. '
  'Around the recommendation you see the include and extend relationships: they show which use cases build on getting an outfit, such as changing one piece, trying the look on, or asking Closet. '
  'These use cases are exactly the stories we planned in Jira, and each one is traced to its requirements and tests in the SRS. Now Youssef will show you the architecture.'),
 (10, 'YOUSSEF', '6:29', 'Component diagram',
  'This is the component diagram. Closet is a modular monolith. At the top is the React web app. Every request first passes the API gateway and the security pipeline — '
  'HTTPS, rate limits, validation, authentication and access control. Only then does it reach a feature module. Each module owns its own database schema in PostgreSQL, '
  'so no module can change another module’s data directly. <i>[Click — zoom in.]</i>'),
 (11, 'YOUSSEF', '7:01', 'Zoom: application modules',
  'Here are the modules: identity, wardrobe, availability, the recommendation engine, outfits, the planner, Ask Closet, shopping and the others. '
  'They talk to each other only through interfaces and an event bus. For example, when a piece is deleted, the wardrobe publishes an event and the shopping list reacts — '
  'This is what let us add Virtual Try-On without breaking anything: it is one new module, with an adapter for the AI provider, '
  'so we could even switch to another AI company later. Salma will now show you how we know it all works.'),
 (12, 'SALMA', '7:44', 'Testing',
  'Thank you, Youssef. A design is only good if it works, so we tested on four levels. Unit tests check the rules — the recommendation engine, the validators and the lifecycle of a piece. '
  'API tests run the real server against a real PostgreSQL database. Acceptance tests check every Sprint 1 story against its acceptance criteria — one test per story. '
  'And browser tests click through the real app like a user would. On the final build, 599 out of 599 automated tests passed on GitHub Actions, with 97 percent line coverage. '
  'For Virtual Try-On we added 23 unit tests, 9 API tests and a browser journey that covers the upload checks, loading, success, errors and Retry.'),
 (13, 'SALMA', '8:37', 'Retrospective',
  'Here is our retrospective. What went well: the architecture from Milestone 1 held — all fifteen stories fitted into the modules we designed — and our tests found real bugs before the demo, not after. '
  'What did not go well: integration happened late in the sprint, and we did not update Jira every day, so our burndown is not as honest as it should be. '
  'What we will change: we update Jira daily, we check dependencies during sprint planning, and we deploy earlier so problems appear sooner. Habiba.'),
 (14, 'HABIBA', '9:18', 'Next sprints',
  'Thank you, Salma. Sprint 1 built the closet. In Sprint 2, we make it intelligent: the live AI try-on with real photos, smarter recommendations, and usability testing with real users. '
  'In Sprint 3, Closet learns from you — from what you wear, save and reject.'),
 (15, 'HABIBA', '9:40', 'Questions',
  'Your wardrobe, your style, your context — one intelligent system. Thank you for listening. We are happy to answer your questions, and if you would like, we can show you the app live right now.'),
]
