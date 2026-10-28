# The demo hand-off picture: Home of the freshly seeded demo account, exactly as Chrome shows it in
# full screen. The deck uses it before and after the live demo, so the switch to Chrome is seamless.
# Retake it on the day (date, greeting and weather change):  python3 tools/handoff_shot.py out.jpg [1920x1080]
import sys
from playwright.sync_api import sync_playwright
out = sys.argv[1] if len(sys.argv) > 1 else 'handoff_home.jpg'
w, h = map(int, (sys.argv[2] if len(sys.argv) > 2 else '1920x1080').split('x'))
B = 'http://localhost:4000'
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': w, 'height': h})
    pg.goto(B); pg.fill('input[type=email]', 'demo@closet.app'); pg.fill('input[type=password]', 'Closet2026!'); pg.click('form button.btn.lg')
    pg.wait_for_selector('.today-card .look'); pg.wait_for_timeout(2500)
    pg.screenshot(path=out, type='jpeg', quality=92); b.close()
print('→', out, f'{w}×{h}')
