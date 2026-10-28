# Closet — Demo preflight (Milestone 2 final · build v1.5)

Run this **once, about 15 minutes before presenting**, on the laptop that will show the demo.
The expected values below come from `npm run demo:check` on build v1.5 (identical over 3 fresh seeds, 28 Oct 2026).

## 1. Start from a clean state (2 min)

```bash
# PostgreSQL running, then from the repo root:
npm run seed                                   # demo@closet.app / Closet2026!  (30 pieces)
WEATHER_MODE=estimate npm start                # (re)start the server AFTER seeding
npm run demo:check                             # must end with "Ready: every demo check passed."
```

- **Restart the server for every rehearsal.** Sign-in is limited to 30 attempts per 15 minutes (security feature).
- `WEATHER_MODE=estimate` makes the weather repeatable (30 °C, labelled “Typical for the season”). The planned presentation was saved at 24 °C, so the Planner shows the weather-change alert.
- If `demo:check` prints a ✗, the line says what to fix. Do not present until it passes.

## 2. Browser (1 min)

- Chrome, one window, zoom 100 %, `http://localhost:4000`, bookmarks bar hidden. Sign in as **demo@closet.app / Closet2026!**, leave it on Home.
- Try-on: only a photo of a team member who agreed to it. It stays in the browser tab and is never uploaded. Otherwise use the stylised avatar.
- Backups, open in other tabs: `Closet_Demo.html` (offline demo — the **same services and rules** on in-memory data, works without a server or internet; Reset badge restores the seed) and `Closet_Demo_FINAL.mp4` (3:43).

## 3. What the audience will see (expected values)

Aim for 5–6 minutes. **Bold** = the moment to pause on.

| # | Step | Expected |
|---|---|---|
| 1 | Home | Today’s look, weather 30 °C (estimate), **Closet noticed** with at most 2 notices, **Still love it?** denim jacket · 104 days |
| 2 | Closet → Navy blazer → **In laundry** | Status badge Laundry; it appears in the Laundry basket (4 pieces) |
| 3 | Laundry → **Wash done** | “Available again.” — the basket is empty |
| 4 | **Style me → University → Generate 3 looks** | **Campus Stripes · Clean Oxford · Relaxed Midi** — any two share at most one major garment |
| 5 | Click the top of LOOK 01 | Tray: **Blue Oxford shirt 99 % · Sage linen shirt 99 % · Red cropped tee 90 %**; only that piece changes |
| 6 | **Try on** → avatar or consenting photo → next look → Favourite | Label “Virtual Try-On Preview” — a simulated overlay; Favourite + Save keep one record |
| 7 | Home → Still love it? → **Style it** | Three looks, every one with the denim jacket |
| 8 | Closet → Denim jacket → donate it → **Donate** → Mark as donated | “Ready to donate” first; then gone, history kept, **nothing added to the Shopping bag** |
| 9 | **Mix & Match → Work → Start from a suggested look → top = Red cropped tee → Suggest a fix** | **98 % → 82 % → 98 %** |
| 10 | Closet → Silk scarf → Remove → **Torn / damaged** | Scarf gone; Shopping bag: “Silk scarf” tagged **Replacement** |
| 11 | Ask Closet: “Do I need beige trousers?” → “Add this to my shopping list” → “Is my blazer clean?” → “Who has my rose wrap dress?” | “Probably not. You already own **2** similar beige bottoms…”; bag item **Added by Ask Closet**; “Your navy blazer is Available”; “with Nour for 12 days (expected back …)” |
| 12 | **Planner** → weather alert → **Adjust outfit** | “It’s now expected to be 30 °C instead of 24 °C … navy blazer may be too warm” → only the blazer changes |
| 13 | **Analytics → Closet has learned** → flip → Confirm → Undo | Cards start closed; Confirm saves, Undo restores |
| 14 | Home | Reflects the changes (28 pieces: jacket donated, scarf removed) |

## 4. Rules for what we say
- Try-On is a **simulated preview**, not generated imagery.
- Ask Closet uses the **keyword parser** (31 whitelisted functions); the language-model adapter is optional and off in the demo.
- Weather is the **seasonal estimate** in the demo.
- Deployment: “Render blueprint configured; the local demo is the verified presentation path.”

## 5. If something goes wrong on stage
- Server stopped or 429 “Too many requests”: restart the server (step 1), sign in again.
- Anything else: switch to `Closet_Demo.html` (same flow, same values) or play `Closet_Demo_FINAL.mp4`.
