# Closet — Demo preflight (Milestone 2 final · build v1.6)

Run this **once, about 15 minutes before presenting**, on the laptop that will show the demo.
The expected values below come from `npm run demo:check` and the recorded walkthrough on build v1.6 (29 Oct 2026).

## 1. Start from a clean state (3 min)

```bash
# PostgreSQL running, then from the repo root:
npm run seed                                   # demo@closet.app / Closet2026!  (31 pieces)
WEATHER_MODE=estimate npm start                # (re)start the server AFTER seeding
npm --prefix server run demo:check -- --save   # on the presentation day only: saves TODAY's looks as the reference
npm run seed && npm run demo:check             # fresh seed again → must end with "Ready: every demo check passed."
```

- **Why `--save` on the day.** The looks are identical on every fresh seed of the **same day** (checked on 3 fresh seeds).
  The accessory in a look rotates with the date, because the ranking uses how many days ago each piece was last worn.
  A reference saved on another day therefore fails only the last check (“same looks … as the saved run”).
- **Restart the server for every rehearsal.** Sign-in is limited to 30 attempts per 15 minutes (security feature).
- `WEATHER_MODE=estimate` makes the weather repeatable (30 °C, labelled “Typical for the season”). The planned presentation was saved at 24 °C, so the Planner shows the weather-change alert.
- If `demo:check` prints a ✗, the line says what to fix. Do not present until it passes.

## 2. Browser (1 min)

- Chrome, one window, zoom 100 %, `http://localhost:4000`, bookmarks bar hidden. Sign in as **demo@closet.app / Closet2026!**, leave it on Home.
- Try-on: only a photo of a team member who agreed to it. It stays in the browser tab and is never uploaded. Otherwise use the stylised avatar.
- Backups, open in other tabs: `Closet_Demo.html` (offline demo: the **same services and rules** on in-memory data, works without a server or internet; the Reset badge restores the seed) and `Closet_Demo_FINAL.mp4` (5:33, the 13 steps below).

## 3. The 13 steps (expected values)

Aim for 5–7 minutes. **Bold** = the moment to pause on.

| # | Step | Expected |
|---|---|---|
| 1 | **Home** | Today’s look, 30 °C (estimate), Closet noticed (≤ 2 notices), **Wardrobe status** with clickable counts: 3 in laundry, 1 borrowed (rose wrap dress, overdue), 1 packed, 1 needs repair (camel cardigan) |
| 2 | Closet → Navy blazer → **In laundry** → Care → Laundry → **Wash done** | It appears in the basket, then Available again |
| 3 | Black blazer → More actions → **Repair / Alter** → Needs alteration “Sleeves too long” → **Send to tailor** (Hany Tailoring, back today) → Care → Repairs & alterations → Style me → Work → **Mark collected** | AT TAILOR “should be ready today”; the black blazer is in **none** of the three Work looks; after collecting it is Available |
| 4 | Black blazer → **Lend item** → Nour, due in 5 days → Borrow & lend → **Mark returned** | Borrowed everywhere; the rose wrap dress shows as overdue; after return the loan stays in History |
| 5 | **Style me → University → 3 looks** → click a top | **Campus Stripes · Clean Oxford · Relaxed Midi** (any two share ≤ 1 major garment); the tray changes only that piece |
| 6 | **Try on** | Label “Virtual Try-On Preview”: a simulated overlay |
| 7 | Home → Still love it? (**denim jacket · 104 days**) → Style it → **Donate** → Donation → navigate away → **Mark as donated** | Three looks with the jacket; Ready to donate waits under Donation; after Mark as donated it is gone, history kept, **no replacement** in the Shopping bag |
| 8 | **Packing** → Alexandria, 2 days, carry-on → **Mark as packed** | A capsule that reuses pieces; every piece shows Packed in the Closet |
| 9 | **Shopping → Do I need this?** Shoes · White · “loafers”, then Top · Black · “fitted top” | White loafers → **Good buy** (five blocks: new combinations, similar owned, gap, occasions, recommendation); black fitted top → **Skip**, you already own a similar one; nothing is added |
| 10 | **Planner** → weather alert → **Adjust outfit** | “24 °C → 30 °C … the planned blazer may be too warm” → only the blazer changes |
| 11 | **Analytics** → Wardrobe Health, Cost per wear, Outfit memory “Salma” | Health raising / lowering; only confirmed wears count; Salma’s birthday with Wear again · Create a variation |
| 12 | **Ask Closet**: “What needs repair?” · “Who has my rose wrap dress?” · “What clothes are ready to donate?” | “Camel cardigan needs a repair: loose button” · “with Nour for 12 days (expected back Sat 24 Oct)” · “Nothing is waiting to be donated” |
| 13 | **Home** | Reflects every change (30 pieces: the denim jacket was donated) |

**Scenario note (honest).** The brief asked to simulate **black** loafers. The seed closet already owns black loafers, so Closet correctly answers “Probably unnecessary” for them. The demo therefore uses **white** loafers as the useful purchase and the black fitted top as the near-duplicate.

## 4. Rules for what we say
- Try-On is a **simulated preview**, not generated imagery.
- Ask Closet uses the **keyword parser** (35 whitelisted functions); the language-model adapter is optional and off in the demo.
- Weather is the **seasonal estimate** in the demo.
- Closet is not connected to charities or tailors: Donation and Care keep the closet accurate; nothing is sent anywhere.
- Deployment: “Render blueprint configured; the local demo is the verified presentation path.”

## 5. If something goes wrong on stage
- Server stopped or 429 “Too many requests”: restart the server (step 1), sign in again.
- Anything else: switch to `Closet_Demo.html` (same flow, same rules) or play `Closet_Demo_FINAL.mp4`.
