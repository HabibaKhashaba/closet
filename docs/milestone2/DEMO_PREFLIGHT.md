# Closet — Demo preflight (Milestone 2)

Run this checklist **once, about 15 minutes before presenting**, on the laptop that will show the demo.
Every value below was verified on 26 Oct 2026: three runs from a fresh seed gave identical results.

## 1. Start from a clean state (2 min)

```bash
# PostgreSQL running, then from the repo root:
npm run seed                                   # demo@closet.app / Closet2026!  (30 pieces)
WEATHER_MODE=estimate npm start                # (re)start the server AFTER seeding
npm run demo:check                             # must end with "Ready: every demo check passed."
```

- **Restart the server for every rehearsal.** Sign-in is limited to 30 attempts per 15 minutes
  (a security feature). Several rehearsals in a row without a restart hit the limit.
- `WEATHER_MODE=estimate` uses the seasonal estimate instead of live weather, so the looks
  cannot change because the weather changed. The app labels it "Seasonal estimate".
- If `demo:check` prints a ✗, each line says what to fix. Do not present until it passes.

## 2. Browser (1 min)

- Chrome, one window, zoom 100 %, `http://localhost:4000`, bookmarks bar hidden.
- Sign in as **demo@closet.app / Closet2026!** and leave it on Home.
- Try-on photo: use only a photo of the team member who agreed to it. It stays in this browser
  tab (session storage) and is never uploaded. Without a photo, the stylised avatar is used.
- Backup: `Closet_Demo.html` (offline recording of the same flow) open in a second tab.

## 3. What the audience will see (expected values)

The seven “wow” moments are in **bold**; everything else supports them. Aim for 4–6 minutes.

| # | Step | Expected |
|---|---|---|
| 1 | Home | Greeting, weather (seasonal estimate), Today's Look, Wardrobe Health, forgotten pieces, upcoming event |
| 2 | Closet → Navy blazer → **In laundry** | The blazer shows the Laundry status |
| 3 | Laundry → **Wash done** | The blazer is in the basket (4 pieces), then “Available again.” |
| 4 | **Style me → University → Generate 3 looks** | Exactly 3 looks: **Campus Stripes · Classic Midi · Relaxed Linen** — each with pieces, match %, weather and a reason |
| 5 | **Click the top of LOOK 01 → choose a piece** | Tray: Sage linen shirt · Blue Oxford shirt · Red cropped tee; only that piece changes, the score moves, the change stays |
| 6 | **Try on** → photo → next look → Favourite | The changed piece is worn; label “Virtual Try-On Preview · simulated on your photo” |
| 7 | **Analytics → Forgotten pieces → Denim jacket → Another chance** | Exactly 3 looks, every one with the denim jacket |
| 8 | **Mix & Match → Work → Start from a suggested look → top = Red cropped tee → Suggest a fix** | **98 % → 82 % → 98 %**, “red cropped tee → ivory silk blouse” |
| 9 | **Closet → Silk scarf → Remove → Torn / damaged → Remove piece** | Scarf gone; the bag shows “Silk scarf” tagged **Replacement** with the reason |
| 10 | Ask Closet: “Do I need beige trousers?” → “Add this to my shopping list” → Shopping bag | “Probably not. You already own 4 similar beige bottoms…”; bag item **Added by Ask Closet** with “You already own…” |
| 11 | **Analytics → Closet has learned** → flip → Confirm → Undo | Cards start closed; evidence, confidence, Confirm / Not accurate; Confirm saves, Undo restores |
| 12 | Home | Reflects the changes (closet now 29 pieces) |

“No longer my style” (no replacement, learning updated) is checked by `demo:check` on a throwaway account, not shown live.

## 4. Hand-off and return

- Slide “Instead of explaining it, we'll show you.” → click **Live demo** (or anywhere) → the app fills the screen → switch to Chrome.
- After the demo switch back: the same picture → “What the user sees is simple.” → click → “What happens behind one click?”
- The date, greeting and weather on Home change, so retake the hand-off picture on the day:
  `python3 tools/handoff_shot.py handoff.jpg 1920x1080` (your screen size), then in PowerPoint right-click the picture on the demo slides → Change Picture.

## 5. If something goes wrong on stage

- Server stopped or 429 “Too many requests”: restart the server (step 1), sign in again.
- Anything else: go back to PowerPoint, previous slide → **Backup recording**. The video (4:36, the same 12 steps) is embedded in the presentation and plays without any other file. `07_Demo/Closet_Demo_FINAL.mp4` is the same video; `Closet_Demo.html` is a second fallback that runs in the browser without a server.
