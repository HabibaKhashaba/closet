import os, sys, glob
from playwright.sync_api import sync_playwright
src = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'svg'); out = sys.argv[1]
os.makedirs(out, exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch(args=['--disable-gpu']); pg = b.new_page(viewport={'width': 800, 'height': 1000})
    for f in sorted(glob.glob(src + '/*.svg')):
        pg.set_content('<html><body style="margin:0">' + open(f).read() + '</body></html>'); pg.wait_for_timeout(50)
        pg.locator('svg').screenshot(path=os.path.join(out, os.path.basename(f)[:-4] + '.png'))
    b.close()
