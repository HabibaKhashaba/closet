# Records every API call of the demo route on the seeded account, so build.py can bake a
# standalone offline HTML of the real app (no server). Run after `npm run seed`, app on CLOSET_URL.
import os, json, base64, re
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

B = os.environ.get('CLOSET_URL', 'http://localhost:4000')
OUT = os.environ.get('OUT', 'tools/offline_demo/recording.json')
rec, photos = [], {}

def on_response(r):
    u = urlparse(r.url)
    if not u.path.startswith('/api/v1/'): return
    req = r.request
    if u.path.startswith('/api/v1/photos/'):
        key = u.path.rsplit('/', 1)[1]
        if key not in photos:
            try: photos[key] = 'data:image/jpeg;base64,' + base64.b64encode(r.body()).decode()
            except Exception: pass
        return
    try: data = r.json() if r.status != 204 else None
    except Exception: data = None
    body = req.post_data if req.method != 'GET' else None
    if body and 'multipart/form-data' in (req.headers.get('content-type') or ''): body = '<form>'
    rec.append({'m': req.method, 'p': u.path[len('/api/v1'):] + (('?' + u.query) if u.query else ''), 'b': body, 's': r.status, 'd': data})

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_context(viewport={'width': 1440, 'height': 900}).new_page()
    pg.on('response', on_response)
    def go(path, wait=900):
        if pg.url.endswith('#' + path): pg.goto(f'{B}/#/blank'); pg.wait_for_timeout(150)
        pg.goto(f'{B}/#{path}'); pg.wait_for_timeout(wait)
    pg.goto(B); pg.wait_for_selector('text=Welcome back')
    pg.fill('input[type=email]', 'demo@closet.app'); pg.fill('input[type=password]', 'Closet2026!'); pg.click('form button.btn.lg')
    pg.wait_for_selector('.today-card .look'); pg.wait_for_timeout(1800)
    # 1. every screen in its starting state (so free exploration works offline)
    for path in ['/closet', '/laundry', '/outfits', '/mix', '/tryon', '/saved', '/ask', '/planner', '/packing', '/analytics', '/shopping', '/profile']:
        go(path, 1300)
    pg.click('button[aria-label^="Notifications"]'); pg.wait_for_timeout(700); pg.click('.notif button[aria-label="Close notifications"]')
    go('/closet'); pg.click('button:has-text("Closet gaps")'); pg.wait_for_timeout(800); pg.keyboard.press('Escape')
    ids = pg.eval_on_selector_all('.piece-card', 'els => els.map(e => (e.getAttribute("href")||"").split("/").pop()).filter(Boolean)')
    for i in ids: go(f'/closet/{i}', 500)
    for occ in ['University', 'Work', 'Dinner', 'Wedding', 'Casual outing', 'Formal event', 'Travel', 'Gym', 'Interview']:
        go('/outfits', 600); pg.click(f'.occ:has-text("{occ}")'); pg.click('button:has-text("Generate 3 looks")'); pg.wait_for_selector('text=LOOK 03', timeout=15000); pg.wait_for_timeout(500)
    # 2. the demo route, in order
    go('/'); go('/closet'); pg.click('.piece-card:has-text("Navy blazer")'); pg.wait_for_selector('text=Availability')
    pg.click('button:has-text("In laundry")'); pg.wait_for_selector('.status.Laundry')
    go('/'); go('/planner'); pg.wait_for_selector('.conflict'); pg.click('.conflict button:has-text("Replace with")'); pg.wait_for_timeout(1200)
    go('/laundry'); pg.click('button:has-text("Wash done")'); pg.wait_for_selector('text=Available again.'); pg.wait_for_timeout(600)
    go('/outfits'); pg.click('.occ:has-text("University")'); pg.click('button:has-text("Generate 3 looks")'); pg.wait_for_selector('text=LOOK 03'); pg.wait_for_timeout(600)
    for k in range(3):                 # every slot of every look can be changed offline (the replace tray)
        n = pg.locator('.looks .flip').nth(k).locator('.look-piece').count()
        for j in range(n):
            pg.locator('.looks .flip').nth(k).locator('.look-piece img').nth(j).click(); pg.wait_for_timeout(700)
            pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    first = pg.locator('.looks .flip').first
    first.locator('.look-piece img').first.click(); pg.wait_for_selector('.tray-opt'); pg.locator('.tray-opt').first.click(); pg.wait_for_timeout(1000)
    first.locator('button:has-text("Try on")').click(); pg.wait_for_timeout(1200)
    pg.click('.fitting-card button:has-text("Save")'); pg.wait_for_timeout(500); pg.click('.fitting-card button:has-text("Favourite")'); pg.wait_for_timeout(500)
    go('/analytics', 1500)                # forgotten pieces → three looks around each
    names = pg.eval_on_selector_all('.piece-card:has(a:has-text("Another chance")) .name', 'els => els.map(e => e.textContent)')
    for nm in names:
        go('/analytics', 1200); c = pg.locator(f'.piece-card:has-text("{nm}")').first; c.scroll_into_view_if_needed(); c.locator('a:has-text("Another chance")').click(); pg.wait_for_timeout(2600)
    go('/mix?occasion=Work'); pg.click('button:has-text("Start from a suggested look")'); pg.wait_for_selector('.verdict-card .meters'); pg.wait_for_timeout(800)
    pg.click('button[aria-label="Choose Top or dress"]'); pg.click('.picker button:has-text("Red cropped tee")'); pg.wait_for_timeout(1300)
    pg.click('button:has-text("Suggest a fix")'); pg.wait_for_selector('.fix-delta', timeout=20000); pg.wait_for_timeout(800)
    go('/closet'); pg.click('.piece-card:has-text("Silk scarf")'); pg.wait_for_selector('text=Availability')
    pg.click('button:has-text("Remove")'); pg.click('.reason-card:has-text("Torn / damaged")'); pg.click('.modal button:has-text("Remove piece")'); pg.wait_for_selector('.bag-item:has-text("Silk scarf")')
    go('/ask')
    for q in ['I want to buy beige trousers. Do I need them?', 'add this to my shopping list']:
        pg.fill('.chat-input input', q); pg.click('.chat-input button'); pg.wait_for_timeout(1500)
    go('/shopping'); pg.wait_for_timeout(800); pg.click('button:has-text("Check my closet")'); pg.wait_for_timeout(800)
    go('/analytics', 1200); pg.locator('#learned .learn-front').first.click(); pg.wait_for_timeout(500)
    pg.locator('#learned .learn-back button:has-text("Confirm")').first.click(); pg.wait_for_timeout(900)
    pg.click('#learned details summary'); pg.click('#learned button:has-text("Undo")'); pg.wait_for_timeout(700)
    for path in ['/', '/closet', '/laundry', '/saved', '/shopping', '/analytics', '/planner']: go(path, 1000)
    b.close()

json.dump({'calls': rec, 'photos': photos}, open(OUT, 'w'))
print(len(rec), 'calls,', len(photos), 'photos →', OUT)
