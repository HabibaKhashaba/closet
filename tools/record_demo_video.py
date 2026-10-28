# Records the backup demo video: the same 12 steps as the live demo, on the real app, with a visible
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

    pg.goto(B); pg.wait_for_selector('input[type=email]')
    pg.fill('input[type=email]', 'demo@closet.app'); pg.fill('input[type=password]', 'Closet2026!'); pg.click('form button.btn.lg')
    pg.wait_for_selector('.today-card .look'); wait(1.2)
    card('Closet — live demo', 'CSCE 3701 · Milestone 2 · backup recording', 2.6)
    # 1 Home
    move(700, 420); cap('Home — today’s look, the weather, Wardrobe Health, what’s coming up', 3.2)
    # 2 Closet → Navy blazer → laundry
    nav('Closet'); cap('Sprint 1 · the closet — one status on every piece', 1.8)
    click('.piece-card:has-text("Navy blazer")'); pg.wait_for_selector('text=Availability'); wait(.6)
    click('button:has-text("In laundry")'); pg.wait_for_selector('.status.Laundry'); cap('The navy blazer goes to the laundry', 1.8)
    # 3 Laundry → Wash done
    nav('Laundry'); pg.wait_for_selector('.basket-item:has-text("Navy blazer")'); cap('It is in the basket', 1.6)
    click('button:has-text("Wash done")'); pg.wait_for_selector('text=Available again.'); wait(.8); cap('Wash done — every piece is Available again', 2)
    # 4 Style me → University → three looks
    nav('Style me'); pg.wait_for_selector('.occ:has-text("University")')
    click('.occ:has-text("University")'); wait(.4); click('button:has-text("Generate 3 looks")')
    pg.wait_for_selector('text=LOOK 03'); wait(1.6); move(960, 520)
    cap('Three complete looks — each with its own name, match %, the weather and one reason', 3.6)
    # 5 Change one piece
    click(pg.locator('.looks .flip').first.locator('.look-piece img').first); pg.wait_for_selector('.tray-opt'); cap('Change one piece — real alternatives, each with its new match %', 2.6)
    click('.tray-opt'); wait(1.6); cap('Only that piece changes; the score moves', 2.2)
    # 6 Try on
    click(pg.locator('.looks .flip').first.locator('button:has-text("Try on")')); pg.wait_for_selector('text=See this look on you'); wait(.8)
    if AVATAR:
        cap('Try it on — with your own photo, or the stylised avatar', 2.2)
        click('button:has-text("Use the stylised avatar instead")'); pg.wait_for_selector('.mirror-glass svg'); wait(1.4)
        cap('Virtual Try-On Preview — a simulated overlay, here on the stylised avatar (no photo)', 3.4)
    else:
        pg.set_input_files('input[aria-label="Choose my photo"]', PHOTO); pg.wait_for_selector('.on-photo .worn'); wait(1.6)
        cap(('Virtual Try-On Preview — a simulated overlay. ' + NOTE) if NOTE else 'Virtual Try-On Preview — a simulated overlay; the photo never leaves the browser', 3.6)
    click('.stage button[aria-label="Next look"]'); wait(1.8)
    click('.fitting-card button:has-text("Favourite")'); wait(.6); cap('Flip between the three looks · Favourite', 1.8)
    # 7 Forgotten piece
    nav('Analytics'); c = pg.locator('.piece-card:has-text("Denim jacket")').first; c.scroll_into_view_if_needed(); wait(.6)
    cap('Forgotten pieces — not worn for 40+ days', 1.8)
    click(c.locator('a:has-text("Another chance")')); pg.wait_for_selector('text=LOOK 03'); wait(1.6)
    cap('Three looks built around the denim jacket — every one contains it', 3)
    # 8 Mix & Match → weak piece → Suggest a fix
    nav('Mix & Match'); click('.chip:has-text("Work")') if pg.locator('.chip:has-text("Work")').count() else None
    click('button:has-text("Start from a suggested look")'); pg.wait_for_selector('.verdict-card .meters'); wait(1)
    cap('Mix & Match — a strong Work look', 1.8)
    click('button[aria-label="Choose Top or dress"]'); wait(.5); click('.picker button:has-text("Red cropped tee")'); wait(1.6)
    cap('A red cropped tee for Work — the score drops, and Closet says why', 2.6)
    click('button:has-text("Suggest a fix")'); pg.wait_for_selector('.fix-delta', timeout=20000); wait(1.4)
    cap('Suggest a fix — one piece replaced, the score rises again', 2.8)
    # 9 Delete a torn piece → replacement in the bag
    nav('Closet'); click('.piece-card:has-text("Silk scarf")'); pg.wait_for_selector('text=Availability'); wait(.5)
    click('button:has-text("Remove")'); pg.wait_for_selector('.reason-card'); cap('Deleting asks why — each reason says what happens next', 2.2)
    click('.reason-card:has-text("Torn / damaged")'); wait(.5); click('.modal button:has-text("Remove piece")')
    pg.wait_for_selector('.bag-item:has-text("Silk scarf")'); wait(.8)
    cap('Torn → a replacement goes into the shopping bag. “No longer my style” is never replaced.', 3.2)
    # 10 Ask Closet → bag
    nav('Ask Closet'); pg.wait_for_selector('.chat-input input')
    for q in ['Do I need beige trousers?', 'Add this to my shopping list']:
        type_in('.chat-input input', q); click('.chat-input button'); wait(2.2)
    cap('Ask Closet: you already own 4 similar — added to the bag, with Undo', 2.8)
    nav('Shopping bag'); pg.wait_for_selector('.bag-item'); cap('Every item says where it came from: Added by Ask Closet · Replacement', 2.8)
    # 11 Learning → flip → Confirm → Undo
    nav('Analytics'); pg.locator('#learned').scroll_into_view_if_needed(); wait(.8)
    cap('Closet has learned — the cards start closed', 1.8)
    click('#learned .learn-front'); wait(1); cap('Evidence and confidence — nothing changes until you confirm', 2.4)
    click('#learned .learn-back button:has-text("Confirm")'); wait(1); cap('Confirmed …', 1.4)
    click('#learned details summary'); wait(.5); click('#learned button:has-text("Undo")'); wait(.9); cap('… and Undo restores it exactly', 1.8)
    # 12 Home reflects the changes
    nav('Home'); pg.wait_for_selector('.today-card .look'); wait(.8); cap('Back on Home — every change is stored', 2.6)
    nocap(); card('closet.', 'Your wardrobe · your style · your context — one intelligent system', 3)
    ctx.close(); b.close()
print('done — convert the .webm in', OUT, 'to Closet_Demo_FINAL.mp4 with ffmpeg')
