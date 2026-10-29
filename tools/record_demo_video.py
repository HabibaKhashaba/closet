# Records the backup demo video (build v1.5): the same 13 steps as the live demo (Demo_Preflight.md, build v1.6), on the real app, with a visible
# cursor that moves smoothly to every click and short captions. Full-screen page only (no browser bar).
#   TRYON_PHOTO=avatar CLOSET_URL=http://localhost:4000 python3 tools/record_demo_video.py   (stylised avatar, no photo)
#   TRYON_PHOTO=/path/photo.jpg [TRYON_NOTE="…"] …   (a full-body photo of a team member who agreed to it)
# Start from a fresh seed and a restarted server (WEATHER_MODE=estimate).
# Then: ffmpeg -i video/<file>.webm -c:v libx264 -crf 24 -preset slow -pix_fmt yuv420p -movflags +faststart Closet_Demo_FINAL.mp4
import os, sys
from playwright.sync_api import sync_playwright
B = os.environ.get('CLOSET_URL', 'http://localhost:4000'); OUT = os.environ.get('OUT', 'video')
PHOTO = os.environ.get('TRYON_PHOTO'); NOTE = os.environ.get('TRYON_NOTE', '')
if not PHOTO: sys.exit('Set TRYON_PHOTO=avatar, or to a consenting team photo.')
AVATAR = PHOTO == 'avatar'
W, H = 1920, 1080
CURSOR = '''(() => { const add = () => { if (document.getElementById('fake-cursor')) return;
  const c = document.createElement('div'); c.id = 'fake-cursor';
  c.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M4 2 L4 19 L8.5 15 L11.5 22 L14.5 20.7 L11.6 14 L17.5 14 Z" fill="#1d1a1b" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  c.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;transform:translate(-100px,-100px);transition:transform 40ms linear';
  document.documentElement.appendChild(c);
  document.addEventListener('mousemove', (e) => { c.style.transform = 'translate(' + (e.clientX - 3) + 'px,' + (e.clientY - 2) + 'px)'; }, true);
  document.addEventListener('mousedown', () => { c.firstChild.style.transform = 'scale(.85)'; }, true);
  document.addEventListener('mouseup', () => { c.firstChild.style.transform = ''; }, true); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add); else add(); })();'''
CAP = '''([t]) => { let d = document.getElementById('cap'); if (!d) { d = document.createElement('div'); d.id = 'cap'; document.body.appendChild(d); }
  d.style.cssText = 'position:fixed;left:50%;bottom:30px;transform:translateX(-50%);z-index:2147483646;color:#f6efe9;font:500 20px Inter,system-ui,sans-serif;padding:13px 28px;border-radius:999px;background:rgba(20,17,18,.88);box-shadow:0 10px 30px rgba(0,0,0,.25);pointer-events:none;max-width:86vw;text-align:center'; d.textContent = t; }'''
CARD = '''([t, s]) => { let d = document.getElementById('card'); if (!d) { d = document.createElement('div'); d.id = 'card'; document.body.appendChild(d); }
  d.style.cssText = 'position:fixed;inset:0;z-index:2147483645;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;background:#0e0b0c;color:#f6efe9;font-family:Lora,Georgia,serif;text-align:center';
  d.innerHTML = '<div style="font:600 15px Inter,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#c48a86">' + s + '</div><div style="font-size:54px;max-width:80vw">' + t + '</div>'; }'''

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': W, 'height': H}, record_video_dir=OUT, record_video_size={'width': W, 'height': H})
    ctx.add_init_script(CURSOR)
    pg = ctx.new_page()
    pos = [W / 2, H / 2]
    def wait(s): pg.wait_for_timeout(int(s * 1000))
    def cap(t, s=2.2): pg.evaluate(CAP, [t]); wait(s)
    def nocap(): pg.evaluate("document.getElementById('cap')&&document.getElementById('cap').remove()")
    def card(t, s, sec=2.4): pg.evaluate(CARD, [t, s]); wait(sec); pg.evaluate("document.getElementById('card')&&document.getElementById('card').remove()")
    def move(x, y):
        pg.mouse.move(x, y, steps=max(12, int(((x - pos[0]) ** 2 + (y - pos[1]) ** 2) ** .5 / 22))); pos[:] = [x, y]
    def click(target, pause=0.35):   # glide to the element, then click it
        loc = pg.locator(target).first if isinstance(target, str) else target
        loc.scroll_into_view_if_needed(); bb = loc.bounding_box()
        move(bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2); wait(pause); pg.mouse.click(pos[0], pos[1])
    def type_in(target, text): click(target); pg.keyboard.type(text, delay=35)
    def nav(name):                   # use the sidebar, like a person would
        nocap(); click(f'nav a:has-text("{name}")'); wait(1.1)

    import datetime
    day = lambda n: (datetime.datetime.now(datetime.timezone.utc).date() + datetime.timedelta(days=n)).isoformat()  # the app's day (UTC)
    def go(path, sec=1.0): nocap(); pg.goto(f'{B}#{path}'); wait(sec)
    def open_piece(name):
        nav('Closet'); click(f'.piece-card:has-text("{name}")'); pg.wait_for_selector('text=Availability'); wait(.5)
    def ask(q, sec=2.4):
        type_in('.chat-input input', q); click('.chat-input button'); wait(sec)
    def scroll_to(sel, sec=.6):  # bring it to the upper middle of the screen, clear of the caption
        pg.locator(sel).first.evaluate("e => e.scrollIntoView({ block: 'center' })"); wait(sec)

    pg.goto(B); pg.wait_for_selector('input[type=email]')
    pg.fill('input[type=email]', 'demo@closet.app'); pg.fill('input[type=password]', 'Closet2026!'); pg.click('form button.btn.lg')
    pg.wait_for_selector('.today-card .look'); wait(1.2)
    card('Closet — live demo', 'CSCE 3701 · Milestone 2 · build v1.6 · backup recording', 2.6)
    # 1 HOME — wardrobe status, weather, proactive notices
    move(700, 420); cap('Home — today’s look, the weather (30 °C, seasonal estimate) and what’s coming up', 3)
    scroll_to('.noticed'); cap('Closet noticed — at most two notices, each with a reason and one action', 3)
    scroll_to('.status-list'); cap('Wardrobe status — every count opens the place where it is managed', 3)
    # 2 LAUNDRY
    open_piece('Navy blazer'); cap('One garment lifecycle — one status on every piece', 1.8)
    click('button:has-text("In laundry")'); pg.wait_for_selector('.status.Laundry'); cap('The navy blazer goes to the laundry', 1.8)
    nav('Care'); pg.wait_for_selector('.basket-item:has-text("Navy blazer")'); cap('Care → Laundry: it is in the basket', 1.8)
    click('button:has-text("Wash done")'); pg.wait_for_selector('text=Available again.'); wait(.8); cap('Wash done — Available again', 1.8)
    # 3 REPAIRS & ALTERATIONS
    open_piece('Black blazer'); click('button:has-text("More actions")'); wait(.4); cap('More actions → Repair / Alter', 1.6)
    click('.menu button:has-text("Repair / Alter")'); wait(.5); click('.reason-card:has-text("Needs alteration")')
    type_in('input[aria-label="Reason"]', 'Sleeves too long'); wait(.3); click('.modal button:has-text("Save")'); pg.wait_for_selector('.status.Needs-alteration'); cap('Needs alteration — sleeves too long', 1.8)
    click('button:has-text("Send to tailor")'); wait(.4); type_in('input[aria-label="Tailor"]', 'Hany Tailoring'); pg.fill('input[aria-label="Expected return"]', day(0)); wait(.4)
    click('.modal button:has-text("Send to tailor")'); pg.wait_for_selector('.status.At-tailor'); cap('Sent to the tailor, expected back today', 1.8)
    go('/care/repairs'); pg.wait_for_selector('section[aria-label="At tailor"]'); cap('Care → Repairs & alterations: AT TAILOR · “should be ready today”', 3)
    nav('Style me · 3 looks'); click('.occ:has-text("Work")'); wait(.3); click('button:has-text("Generate 3 looks")'); pg.wait_for_selector('text=LOOK 03'); wait(1.4)
    cap('Style me → Work: three looks — the black blazer is not in any of them', 3)
    go('/care/repairs'); pg.wait_for_selector('section[aria-label="At tailor"]'); click('section[aria-label="At tailor"] button:has-text("Mark collected")'); wait(1.2)
    cap('Mark collected — Available again, back in your outfits', 2.2)
    # 4 BORROW & LEND
    open_piece('Black blazer'); click('button:has-text("More actions")'); wait(.3); click('.menu button:has-text("Lend item")'); wait(.4)
    type_in('input[aria-label="Person"]', 'Nour'); pg.fill('input[aria-label="Expected return"]', day(5)); wait(.4); click('.modal button:has-text("Lend item")'); pg.wait_for_selector('.status.Borrowed')
    cap('Lent to Nour — due in five days', 1.8)
    nav('Borrow & lend'); pg.wait_for_selector('.care-row:has-text("Black blazer")'); cap('Borrow & lend: who has what, since when, overdue — the rose wrap dress is 4+ days late', 3.2)
    nav('Closet'); scroll_to('.piece-card:has-text("Black blazer")'); cap('Still in the closet, marked Borrowed — left out of outfits and plans', 2.4)
    nav('Borrow & lend'); click('.care-row:has-text("Black blazer") button:has-text("Mark returned")'); wait(1); cap('Mark returned — Available, and the loan stays in the history', 2.4)
    # 5 STYLE ME — three genuinely different looks, change one piece
    nav('Style me · 3 looks'); click('.occ:has-text("University")'); wait(.4); click('button:has-text("Generate 3 looks")')
    pg.wait_for_selector('text=LOOK 03'); wait(1.6); move(960, 520)
    cap('Three complete looks, three different directions — any two share at most one major garment', 3.6)
    click(pg.locator('.looks .flip').first.locator('.look-piece img').first); pg.wait_for_selector('.tray-opt'); cap('Change one piece — real alternatives, each with its new match %', 2.4)
    click('.tray-opt'); wait(1.6); cap('Only that piece changes; the score moves', 2)
    # 6 TRY ON
    click(pg.locator('.looks .flip').first.locator('button:has-text("Try on")')); pg.wait_for_selector('text=See this look on you'); wait(.8)
    if AVATAR:
        click('button:has-text("Use the stylised avatar instead")'); pg.wait_for_selector('.mirror-glass svg'); wait(1.4)
        cap('Virtual Try-On Preview — a simulated overlay, here on the stylised avatar (no photo)', 3.2)
    else:
        pg.set_input_files('input[aria-label="Choose my photo"]', PHOTO); pg.wait_for_selector('.on-photo .worn'); wait(1.6)
        cap(('Virtual Try-On Preview — a simulated overlay. ' + NOTE) if NOTE else 'Virtual Try-On Preview — a simulated overlay; the photo never leaves the browser', 3.4)
    # 7 DONATION
    nav('Home'); scroll_to('.still'); cap('Still love it? — the denim jacket has not been worn for 104 days', 2.4)
    click('.still a:has-text("Style it")'); pg.wait_for_selector('text=LOOK 03'); wait(1.4); cap('Style it — three looks, every one with the denim jacket', 2.6)
    nav('Home'); scroll_to('.still'); click(pg.locator('.still button:has-text("Donate")').first); pg.wait_for_selector('text=Donate this item?')
    cap('Or donate it to someone who may need it', 2); click('.reason-card:has-text("Donate")'); pg.wait_for_selector('.modal button:has-text("Mark as donated")'); cap('Ready to donate — it waits under Donation', 2.2)
    pg.keyboard.press('Escape'); nav('Planner'); wait(.6)
    nav('Donation'); pg.wait_for_selector('.care-row:has-text("Denim jacket")'); cap('Donation: still there after navigating away — Mark as donated when it has left', 2.8)
    click('.care-row:has-text("Denim jacket") button:has-text("Mark as donated")'); wait(1.2); cap('Donated — archived, wear history kept', 2)
    nav('Shopping bag'); pg.wait_for_selector('.bag-item'); cap('Shopping bag: no replacement for the jacket', 2.4)
    # 8 PACKING
    nav('Packing'); pg.wait_for_selector('input[aria-label="Destination"]'); pg.fill('input[aria-label="Destination"]', ''); type_in('input[aria-label="Destination"]', 'Alexandria')
    pg.fill('input[aria-label="First day"]', day(2)); pg.fill('input[aria-label="Last day"]', day(3)); wait(.4)
    click('button:has-text("Plan my suitcase")'); pg.wait_for_selector('button:has-text("Add to packing list")', timeout=20000); wait(1); cap('A carry-on capsule for two days — pieces reused on purpose', 2.8)
    click('button:has-text("Add to packing list")'); pg.wait_for_selector('button:has-text("Mark as packed")'); wait(.6)
    click('button:has-text("Mark as packed")'); wait(1.2); cap('Mark as packed — every piece is now Packed', 2.2)
    nav('Closet'); wait(.6); cap('…and shows as Packed in the closet', 2)
    # 9 SHOPPING — purchase simulation
    nav('Shopping bag'); scroll_to('input[aria-label="What is it"]')
    pg.select_option('select[aria-label="Category"]', 'Shoes'); pg.select_option('select[aria-label="Colour"]', 'White'); pg.fill('input[aria-label="What is it"]', ''); type_in('input[aria-label="What is it"]', 'loafers')
    click('button:has-text("Check my closet")'); wait(1.6); scroll_to('.impact-blocks'); cap('White loafers: new combinations, similar owned, gap, occasions → a useful purchase (simulated)', 3.4); nocap()
    scroll_to('input[aria-label="What is it"]'); pg.select_option('select[aria-label="Category"]', 'Top'); pg.select_option('select[aria-label="Colour"]', 'Black'); pg.fill('input[aria-label="What is it"]', ''); type_in('input[aria-label="What is it"]', 'fitted top')
    click('button:has-text("Check my closet")'); wait(1.6); scroll_to('.impact-blocks'); cap('A black fitted top: you already own a similar one — lower value. Nothing was added', 3.4)
    # 10 PLANNER
    nav('Planner'); pg.wait_for_selector('.conflict'); wait(.6); cap('The forecast changed: 24 °C → 30 °C — the planned blazer may be too warm', 3)
    click('.conflict button:has-text("Adjust outfit")'); wait(1.6); cap('Adjust outfit — only the blazer changes', 2.2)
    # 11 ANALYTICS
    nav('Analytics & insights'); wait(.8); scroll_to('text=What lowers it'); cap('Wardrobe Health — explained: what raises it, what lowers it', 3)
    scroll_to('text=Cost per wear'); cap('Cost per wear — only confirmed wears count', 2.6)
    scroll_to('input[aria-label="Search outfit memory"]'); type_in('input[aria-label="Search outfit memory"]', 'Salma'); click('button:has-text("Find")'); wait(1.2)
    cap('Outfit memory — Salma’s birthday, 27 °C, ★★★★★ · Wear again · Create a variation', 3.2)
    # 12 ASK CLOSET — real state
    nav('Ask Closet'); pg.wait_for_selector('.chat-input input')
    for q in ['What needs repair?', 'Who has my rose wrap dress?', 'What clothes are ready to donate?']: ask(q)
    cap('Ask Closet reads the current wardrobe — repairs, loans, donations', 3)
    # 13 HOME
    nav('Home'); pg.wait_for_selector('.today-card .look'); wait(.8); scroll_to('.status-list'); cap('Back on Home — every change is stored and shows everywhere', 3)
    nocap(); card('closet.', 'Your wardrobe · your style · your context — one intelligent system', 3)
    ctx.close(); b.close()
print('done — convert the .webm in', OUT, 'to Closet_Demo_FINAL.mp4 with ffmpeg')
