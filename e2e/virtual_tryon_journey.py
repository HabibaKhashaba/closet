# Virtual Try-On journey (US-118): image-based try-on of ONE piece from a recommended look, through the real UI.
# Runs against the live app started with TRYON_PROVIDER=mock (no API key needed) OR the offline demo (mock provider).
#   TRYON_PROVIDER=mock npm start   then   python e2e/virtual_tryon_journey.py
#   CLOSET_URL=file:///abs/path/Closet_Demo.html python e2e/virtual_tryon_journey.py
# Checks: Try-On button on each of the 3 looks · supported-piece picker · photo validation · consent · loading ·
# success · save result · try another item (saved photo reused) · error + retry (offline only: forced failure) ·
# leave while running → resumes · back to the same 3 looks · delete the saved photo · other card actions intact.
import os
from playwright.sync_api import sync_playwright, expect

URL = os.environ.get('CLOSET_URL', 'http://localhost:4000/')
BASE = URL.split('#')[0]
OFFLINE = BASE.startswith('file:')
S = os.environ.get('SHOTS', './e2e-shots-vto/')
FIG = os.environ.get('TRYON_PHOTO', 'e2e/fixtures/tryon_test_figure.jpg')
os.makedirs(S, exist_ok=True)
errs, steps = [], []
SUPPORTED = ('Top', 'Outerwear', 'Dress')  # Closet labels for Top, Layer, Dress

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_context(viewport={'width': 1440, 'height': 900}).new_page()
    pg.on('console', lambda m: m.type == 'error' and not any(x in m.text for x in ('fonts.g', 'TUNNEL', 'status of 4')) and errs.append(m.text))
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('dialog', lambda d: d.accept())

    def shot(name):
        pg.wait_for_timeout(300); pg.screenshot(path=f'{S}{name}.png'); steps.append(name)
    def go(path, wait=900):
        pg.goto(f'{BASE}#{path}'); pg.wait_for_timeout(wait)
    def api(path):
        return pg.evaluate("async (p) => { const r = await fetch('/api/v1' + p, { headers: { Authorization: 'Bearer ' + sessionStorage.getItem('closet.token') } }); return r.json(); }", path)

    # ---------- sign in, generate the 3 looks ----------
    pg.goto(BASE); pg.wait_for_selector('text=Welcome back')
    pg.fill('input[type=email]', 'demo@closet.app'); pg.fill('input[type=password]', 'Closet2026!'); pg.click('form button.btn.lg')
    pg.wait_for_timeout(2500)
    go('/outfits'); pg.click('.occ:has-text("University")'); pg.click('button:has-text("Generate 3 looks")')
    pg.wait_for_selector('text=LOOK 03'); pg.wait_for_timeout(1400)
    cards = pg.locator('.looks .flip .front')
    expect(cards).to_have_count(3)
    titles = [cards.nth(k).locator('h3').inner_text() for k in range(3)]
    for k in range(3):   # the Try-On action is on every look, and the other actions are still there
        for label in ('Virtual Try-On', 'Wear this', 'Save', 'Not for me', 'Preview'):
            expect(cards.nth(k).locator(f'button:has-text("{label}")')).to_have_count(1)
    shot('v01_three_looks_with_try_on')

    # ---------- pick the piece ----------
    for k in range(3):  # the first look with a top, jacket or dress
        cards.nth(k).locator('button:has-text("Virtual Try-On")').click()
        pg.wait_for_selector('text=Which item do you want to try on?')
        if any(pg.locator('.vto-pick-row').nth(j).is_enabled() for j in range(pg.locator('.vto-pick-row').count())): break
        pg.keyboard.press('Escape')
    shot('v02_picker')
    rows = pg.locator('.vto-pick-row')
    n = rows.count(); enabled = [k for k in range(n) if rows.nth(k).is_enabled()]
    assert enabled, 'no piece of the look can be tried on'
    for k in range(n):  # only tops, jackets/layers and dresses are offered
        label = rows.nth(k).locator('.tiny').first.inner_text()
        assert rows.nth(k).is_enabled() == (label in SUPPORTED), f'row {k} ({label}) enabled={rows.nth(k).is_enabled()}'
    chosen = rows.nth(enabled[0]).locator('b').inner_text()
    rows.nth(enabled[0]).click()
    pg.wait_for_selector('.vto'); pg.wait_for_selector('text=Trying on')
    expect(pg.locator('.vto-garment h2')).to_have_text(chosen)
    expect(pg.locator('text=Upload a full-body photo').first).to_be_visible(); shot('v03_screen_no_photo')

    # ---------- photo validation, consent ----------
    pg.click('button:has-text("Generate try-on")')
    expect(pg.locator('.vto-photo-error')).to_contain_text('full-body photo')
    pg.set_input_files('input[aria-label="Upload a full-body photo"]', 'e2e/fixtures/tryon_too_small.jpg')
    expect(pg.locator('.vto-photo-error')).to_contain_text('too small')
    pg.set_input_files('input[aria-label="Upload a full-body photo"]', 'e2e/fixtures/not_an_image.png')
    expect(pg.locator('.vto-photo-error')).to_contain_text('could not be opened')
    shot('v04_photo_validation')
    pg.set_input_files('input[aria-label="Upload a full-body photo"]', FIG)
    pg.wait_for_selector('.vto-photo img')
    pg.click('button:has-text("Generate try-on")')
    expect(pg.locator('.vto-side [role=alert]')).to_contain_text('photo notice')
    pg.check('input[aria-label="I agree to the photo notice"]')
    pg.check('label.check:has-text("Save this photo for next time") input')
    shot('v05_ready')

    # ---------- generate: loading → success ----------
    pg.click('button:has-text("Generate try-on")')
    pg.wait_for_selector('text=Creating your virtual try-on…'); shot('v06_loading')
    pg.wait_for_selector('.vto-result img', timeout=30000)
    expect(pg.locator('.vto-result figcaption')).to_contain_text('Mock result' if OFFLINE else ('AI-generated' if os.environ.get('REAL_PROVIDER') else 'result'))
    shot('v07_result')
    pg.click('button:has-text("Save result")'); expect(pg.locator('.vto-side button:has-text("Saved")')).to_have_count(1)
    assert len(api('/virtual-try-on?saved=true')['tryOns']) >= 1, 'the saved result is not stored'
    assert api('/virtual-try-on/photo')['photo'] is not None, 'the photo was not saved for next time'

    # ---------- try another item: the saved photo is offered first ----------
    pg.click('button:has-text("Try another item")')
    pg.wait_for_selector('text=Try another item from this look')
    rows = pg.locator('.vto-pick-row'); enabled = [k for k in range(rows.count()) if rows.nth(k).is_enabled()]
    rows.nth(enabled[-1]).click(); pg.wait_for_timeout(1200)
    pg.wait_for_selector('text=Use saved try-on photo')
    expect(pg.locator('input[aria-label="Use saved try-on photo"]')).to_be_checked(); shot('v08_saved_photo_offered')

    # ---------- error + retry (offline demo: force the mock provider to fail once) ----------
    if OFFLINE:
        pg.evaluate('globalThis.__closetTryOnFailNext = "process"')
        pg.check('input[aria-label="I agree to the photo notice"]'); pg.click('button:has-text("Generate try-on")')
        pg.wait_for_selector('text=We couldn’t create this try-on', timeout=30000); shot('v09_failed')
        expect(pg.locator('.vto-failed button:has-text("Retry")')).to_be_visible()
        pg.click('.vto-failed button:has-text("Retry")')
        pg.wait_for_selector('text=Creating your virtual try-on…')
        pg.wait_for_selector('.vto-result img', timeout=30000); shot('v10_retry_ok')
    else:
        pg.check('input[aria-label="I agree to the photo notice"]'); pg.click('button:has-text("Generate try-on")')
        pg.wait_for_selector('.vto-result img', timeout=60000)

    # ---------- leave while running, come back: it resumes ----------
    pg.click('button:has-text("Try another item")'); pg.wait_for_selector('.vto-pick-row')
    rows = pg.locator('.vto-pick-row'); enabled = [k for k in range(rows.count()) if rows.nth(k).is_enabled()]
    rows.nth(enabled[0]).click(); pg.wait_for_selector('text=Use saved try-on photo')
    pg.check('input[aria-label="I agree to the photo notice"]'); pg.click('button:has-text("Generate try-on")')
    pg.wait_for_selector('text=Creating your virtual try-on…')
    go('/closet', 300)
    go('/virtual-try-on'); pg.wait_for_selector('.vto-hist'); shot('v11_your_try_ons')
    pg.locator('.vto-hist').first.click()
    pg.wait_for_selector('.vto-result img', timeout=30000)

    # ---------- back to the same three looks ----------
    pg.click('.tryon-head button:has-text("Back to outfit")'); pg.wait_for_selector('text=LOOK 03'); pg.wait_for_timeout(800)
    assert [pg.locator('.looks .flip .front').nth(k).locator('h3').inner_text() for k in range(3)] == titles, 'Back to outfit did not return to the same looks'
    shot('v12_back_to_looks')

    # ---------- delete the saved photo ----------
    pg.locator('.looks .flip .front').first.locator('button:has-text("Virtual Try-On")').click()
    rows = pg.locator('.vto-pick-row'); enabled = [k for k in range(rows.count()) if rows.nth(k).is_enabled()]
    rows.nth(enabled[0]).click(); pg.wait_for_selector('text=Use saved try-on photo')
    pg.click('button:has-text("Delete saved photo")'); pg.wait_for_timeout(800)
    expect(pg.locator('text=Use saved try-on photo')).to_have_count(0)
    assert api('/virtual-try-on/photo')['photo'] is None, 'the saved photo was not deleted'
    shot('v13_photo_deleted')
    b.close()

assert not errs, f'browser errors: {errs}'
print(f'virtual try-on journey passed on the {"offline demo" if OFFLINE else "live app"}: {len(steps)} steps')
