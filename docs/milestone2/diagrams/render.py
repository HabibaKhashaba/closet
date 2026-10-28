import sys, glob
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 1600, 'height': 900}, device_scale_factor=2)
    for f in sorted(glob.glob('/home/claude/m2/d13/D*.svg')):
        pg.set_content('<html><body style="margin:0">' + open(f).read() + '</body></html>'); pg.wait_for_timeout(250)
        pg.locator('svg').first.screenshot(path=f[:-4] + '.png')
    b.close()
