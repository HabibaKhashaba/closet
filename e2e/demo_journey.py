# End-to-end browser journey (Playwright for Python). First the Sprint 1 path on a new account,
# then the live-demo route on the seeded account, act by act (see the demo script):
# 1 Home · 2 Sprint 1 foundation (closet, laundry) · 3 Style me: 3 looks → change a piece → try on
# your photo · 4 forgotten piece → 3 looks around it · 5 Mix & Match → Suggest a fix ·
# 6 delete with a reason → shopping bag · 7 Ask Closet → bag · 8 Closet has learned.
# Run from the repo root with the app on CLOSET_URL after `npm run seed`:
#   pip install playwright && python e2e/demo_journey.py
# Every step checks what it should see, saves a screenshot, and the run fails on any browser error.
import os
from playwright.sync_api import sync_playwright, expect

S = os.environ.get('SHOTS', './e2e-shots/')
B = os.environ.get('CLOSET_URL', 'http://localhost:4000')
PHOTO = os.environ.get('PHOTO', 'server/seed/photos/sage_linen_shirt.jpg')
# The try-on photo: a neutral TEST FIGURE in CI; for the recorded demo the team's own consenting photo.
TRYON = os.environ.get('TRYON_PHOTO', 'e2e/fixtures/tryon_test_figure.jpg')
os.makedirs(S, exist_ok=True)
errs = []
steps = []

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 1440, 'height': 900}, device_scale_factor=2)
    pg = ctx.new_page()
    # 400 / 401 responses are expected: the journey types a wrong and a too-short password on purpose.
    pg.on('console', lambda m: m.type == 'error' and not any(x in m.text for x in ('fonts.g', 'TUNNEL', 'status of 400', 'status of 401')) and errs.append(m.text))
    pg.on('pageerror', lambda e: errs.append(str(e)))

    def shot(name, full=False):
        pg.wait_for_timeout(450)
        pg.screenshot(path=f'{S}{name}.png', full_page=full)
        steps.append(name)

    # read the real state through the API (the same token the app uses) — the demo must change data, not just the screen
    def api(path):
        return pg.evaluate("async (p) => { const r = await fetch('/api/v1' + p, { headers: { Authorization: 'Bearer ' + sessionStorage.getItem('closet.token') } }); return r.json(); }", path)
    def piece(name):
        return next((x for x in api('/items')['items'] if x['name'] == name), None)
    results = {}

    def go(path):
        pg.goto(f'{B}/#{path}')
        pg.wait_for_timeout(900)

    def sign_in(email, password='Closet2026!'):
        pg.goto(B); pg.evaluate('sessionStorage.clear()'); pg.reload()
        pg.wait_for_selector('text=Welcome back')
        pg.fill('input[type=email]', email); pg.fill('input[type=password]', password)
        pg.click('form button.btn.lg')

    # ---------- Sprint 1 · US-01 authentication ----------
    pg.goto(B); pg.wait_for_selector('text=Welcome back'); shot('01_login')
    pg.fill('input[type=email]', 'demo@closet.app'); pg.fill('input[type=password]', 'WrongPass1'); pg.click('form button.btn.lg')
    pg.wait_for_selector('.form-error'); shot('02_login_error')
    pg.click('button:has-text("Create account")'); pg.fill('input[type=email]', 'salma.demo@closet.app'); pg.fill('input[type=password]', 'short')
    pg.click('form button.btn.lg'); pg.wait_for_selector('.err'); shot('03_register_validation')
    pg.fill('input[type=password]', 'Closet2026!'); pg.click('form button.btn.lg')

    # ---------- US-02 – US-04 style profile ----------
    pg.wait_for_selector('text=Let’s learn your style')
    for s in ['Chic', 'Minimal', 'Classic']: pg.click(f'.style-card:has-text("{s}")')
    for c in ['Beige', 'Navy']: pg.click(f'.chip:has-text("{c}")')
    for o in ['University', 'Work']: pg.click(f'.chip:has-text("{o}")')
    pg.fill('input[placeholder="Cairo"]', 'Cairo')
    shot('04_quiz', full=True)
    pg.click('text=Save my style'); pg.wait_for_selector('text=Today’s look')
    go('/closet'); pg.wait_for_selector('text=Your closet is empty'); shot('06_closet_empty')

    # ---------- US-08, US-09, US-11 add a piece ----------
    go('/closet/new'); pg.wait_for_selector('text=Take or upload a photo'); shot('07_add_photo')
    pg.set_input_files('input[type=file]', PHOTO)
    pg.wait_for_selector('text=2 · Details'); pg.click('button:has-text("Review")'); pg.wait_for_selector('.err'); shot('08_add_required')
    pg.fill('input[placeholder="Navy silk midi dress"]', 'Sage linen shirt')
    sels = pg.query_selector_all('.card select')
    sels[0].select_option('Top'); sels[1].select_option('Green'); sels[2].select_option('Linen'); sels[3].select_option('Summer')
    pg.fill('input[placeholder="e.g. M, 38"]', 'M')
    pg.click('.chip:has-text("Casual")'); pg.click('.chip:has-text("Smart Casual")'); pg.click('.chip >> text=Minimal')
    shot('09_add_details')
    pg.click('button:has-text("Review")'); pg.wait_for_selector('text=3 · Review before saving'); shot('10_add_review')
    pg.click('text=Save to closet'); pg.wait_for_selector('.piece-card:has-text("Sage linen shirt")'); shot('11_closet_one')

    # ---------- ACT 1 · the curated demo account: Home ----------
    sign_in('demo@closet.app'); pg.wait_for_selector('.today-card .look'); pg.wait_for_timeout(1800); shot('30_home')
    pg.click('button[aria-label^="Notifications"]'); pg.wait_for_selector('.notif'); shot('31_notifications'); pg.keyboard.press('Escape'); pg.click('.notif button[aria-label="Close notifications"]')
    go('/closet'); pg.wait_for_selector('.piece-card'); shot('12_closet_full')
    pg.click('.tabs button:has-text("Tops")'); pg.click('.chip:has-text("Available")'); pg.wait_for_timeout(400)
    expect(pg.locator('.piece-card .meta').first).to_contain_text('Available'); shot('13_closet_filtered')
    pg.click('.chip:has-text("Available")'); pg.click('.tabs button:has-text("All")')
    pg.click('button:has-text("Closet gaps")'); pg.wait_for_selector('text=levels you dress for'); shot('23_gaps'); pg.keyboard.press('Escape')

    # ---------- ACT 2 · Sprint 1 foundation: US-56, US-71, US-15 piece, status, edit ----------
    pg.click('.piece-card:has-text("Navy blazer")'); pg.wait_for_selector('text=Availability'); shot('14_piece_detail')
    pg.click('button:has-text("In laundry")'); pg.wait_for_selector('.status.Laundry'); shot('15_piece_to_laundry')
    # ---------- magic moment: the planned blazer is now in the laundry → conflict → one-tap replacement ----------
    go('/'); pg.wait_for_selector('.conflict'); pg.wait_for_timeout(800); shot('32_home_conflict')
    go('/planner'); pg.wait_for_selector('.conflict'); shot('33_planner_conflict')
    pg.click('.conflict button:has-text("Replace with")'); pg.wait_for_timeout(1200)
    expect(pg.locator('.conflict')).to_have_count(0); shot('34_planner_fixed')
    go('/closet')
    pg.click('.piece-card:has-text("Navy blazer")'); pg.wait_for_selector('text=Availability')
    pg.click('button:has-text("Edit")'); pg.wait_for_selector('text=Save changes'); shot('16_piece_edit'); pg.click('.modal button:has-text("Cancel")')

    # ---------- US-15, US-16, US-84 laundry ----------
    go('/laundry'); pg.wait_for_selector('.hamper'); expect(pg.locator('.basket-item')).to_have_count(4)
    expect(pg.locator('.basket-item:has-text("Navy blazer")')).to_have_count(1); shot('17_laundry')
    assert piece('Navy blazer')['status'] == 'Laundry', 'the blazer is not in the laundry'
    pg.click('button:has-text("Wash done")'); pg.wait_for_timeout(500); shot('18_laundry_washing')
    pg.wait_for_selector('text=Available again.'); pg.wait_for_timeout(900); shot('19_laundry_clean')
    assert piece('Navy blazer')['status'] == 'Available', 'Wash done did not make the blazer Available'
    assert not [x for x in api('/items')['items'] if x['status'] == 'Laundry'], 'pieces are still in the laundry after Wash done'

    # ---------- US-46 planner ----------
    go('/planner'); pg.wait_for_selector('.cal'); shot('20_planner')
    pg.click('button:has-text("New event")'); pg.fill('input[placeholder="Dinner with friends"]', 'Graduation photos'); pg.select_option('.modal select', 'Party'); shot('21_event_form')
    pg.click('.modal button:has-text("Add event")'); pg.wait_for_timeout(800); shot('22_planner_added')

    # ---------- profile, settings, US-06 delete (cancelled) ----------
    go('/profile'); pg.wait_for_selector('text=Wardrobe rules'); pg.wait_for_selector('.activity div'); shot('24_settings', full=True)
    pg.click('button:has-text("Delete account")'); pg.wait_for_selector('text=DELETE MY ACCOUNT'); shot('25_delete_confirm'); pg.keyboard.press('Escape')

    # ---------- ACT 3 · the heart of Closet: 3 looks → change a piece → try on your photo ----------
    big_posts = []
    pg.on('request', lambda r: '/api/' in r.url and r.post_data and len(r.post_data) > 150_000 and big_posts.append(r.url))
    go('/outfits'); pg.wait_for_selector('text=What’s the occasion?'); shot('39_style_studio')
    pg.click('.occ:has-text("University")'); pg.click('button:has-text("Generate 3 looks")')
    pg.wait_for_selector('.generating'); shot('39b_generating')
    pg.wait_for_selector('text=LOOK 03'); pg.wait_for_timeout(1400)
    expect(pg.locator('.looks .flip')).to_have_count(3)
    names = [pg.locator('.looks .flip').nth(k).locator('.front h3').inner_text() for k in range(3)]
    assert len(set(names)) == 3, f'look names repeat: {names}'
    for k in range(3):
        card = pg.locator('.looks .flip').nth(k).locator('.front')
        assert card.locator('.look-piece img').count() >= 3, 'a look is not complete'
        expect(card.locator('.match-pill')).to_contain_text('%'); expect(card.locator('.why-line')).to_contain_text('Recommended because')
    expect(pg.locator('.style-bar')).to_contain_text('°')
    results['looks'] = [[pg.locator('.looks .flip').nth(k).locator('.front h3').inner_text(), pg.locator('.looks .flip').nth(k).locator('.front .look-piece img').evaluate_all('e => e.map(i => i.alt)')] for k in range(3)]
    shot('40_recommendations')
    first = pg.locator('.looks .flip').first
    before = first.locator('.look-piece img').first.get_attribute('alt')
    first.locator('.look-piece img').first.click(); pg.wait_for_selector('.tray-opt'); shot('41a_replace_tray')
    expect(pg.locator('.tray-opt')).to_have_count(3)
    results['tray'] = pg.locator('.tray-opt b').all_inner_texts()
    others_before = pg.locator('.looks .flip').first.locator('.look-piece img').evaluate_all('e => e.map(i => i.alt).slice(1)')
    pg.locator('.tray-opt').first.click(); pg.wait_for_timeout(1400)
    after = pg.locator('.looks .flip').first.locator('.look-piece img').first.get_attribute('alt')
    assert pg.locator('.looks .flip').first.locator('.look-piece img').evaluate_all('e => e.map(i => i.alt).slice(1)') == others_before, 'other pieces changed'
    assert before != after, 'change piece did not change the piece'
    expect(pg.locator('.looks .flip').first.locator('.match-pill.moved')).to_have_count(1)
    shot('41_change_piece')
    pg.locator('.looks .flip').first.locator('.why-btn').click(); pg.wait_for_timeout(800); shot('40b_why')
    pg.locator('.looks .flip').first.locator('button:has-text("Back to the look")').click(); pg.wait_for_timeout(600)
    pg.locator('.looks .flip').first.locator('button:has-text("Try on")').click()
    pg.wait_for_selector('text=See this look on you'); shot('42a_tryon_choose_photo')
    pg.set_input_files('input[aria-label="Choose my photo"]', TRYON)
    pg.wait_for_selector('.on-photo .me'); pg.wait_for_timeout(2200)
    n_worn = pg.locator('.on-photo .worn').count(); n_pieces = pg.locator('.fitting-card .hanger-row').count()
    assert n_worn == n_pieces, f'{n_worn} pieces drawn on the photo, look has {n_pieces}'
    expect(pg.locator('.on-photo .worn').first).to_have_attribute('alt', after)   # the changed piece is worn
    expect(pg.locator('.sim-chip')).to_contain_text('Virtual Try-On Preview')
    shot('42_tryon')
    saved0 = len(api('/outfits')['outfits'])
    pg.click('.fitting-card button:has-text("Save")'); pg.wait_for_timeout(700)
    pg.click('.fitting-card button:has-text("Favourite")'); pg.wait_for_timeout(700)
    outs = api('/outfits')['outfits']
    assert len(outs) >= saved0 + 1 and any(o['favorite'] for o in outs[:2]), 'Save / Favourite did not store the look'
    pg.click('.stage button[aria-label="Next look"]'); pg.wait_for_timeout(1800); shot('42b_tryon_next')
    expect(pg.locator('.on-photo .worn').first).to_be_visible()
    worn_ids = sorted(x['id'] for x in api('/items')['items'] if x['name'] in pg.locator('.fitting-card .hanger-row b').all_inner_texts())
    pg.click('.fitting-card button:has-text("Wear this today")'); pg.wait_for_selector('text=Worn today'); pg.wait_for_timeout(500)
    wears = api('/outfits/history')['wears']
    assert any(sorted(p['id'] for p in w['pieces']) == worn_ids for w in wears), 'Wear this did not record this look'
    pg.click('.stage button[aria-label="Previous look"]'); pg.wait_for_timeout(1000)
    pg.click('.fitting-card button:has-text("Change a piece")'); pg.wait_for_selector('text=LOOK 03')
    expect(pg.locator('.looks .flip').first.locator('.look-piece img').first).to_have_attribute('alt', after)  # the changed look is kept
    assert not big_posts, f'the try-on photo must never be sent to the server: {big_posts}'

    # ---------- ACT 4 · a forgotten piece → three looks built around it ----------
    go('/analytics'); pg.wait_for_selector('text=Forgotten pieces')
    card = pg.locator('.piece-card:has-text("Denim jacket")'); card.scroll_into_view_if_needed(); shot('43a_forgotten')
    card.locator('a:has-text("Another chance")').click()
    pg.wait_for_selector('text=LOOK 03'); pg.wait_for_timeout(1400)
    expect(pg.locator('.looks > *')).to_have_count(3)
    for k in range(3): expect(pg.locator('.looks .flip').nth(k).locator('.front img[alt="Denim jacket"]')).to_have_count(1)
    results['forgotten'] = [pg.locator('.looks .flip').nth(k).locator('.front h3').inner_text() for k in range(3)]
    shot('43_forgotten_three_looks')

    # ---------- ACT 5 · Mix & Match → a weak piece → Suggest a fix ----------
    go('/mix?occasion=Work'); pg.wait_for_selector('text=Pick a few pieces')
    pg.click('button:has-text("Start from a suggested look")'); pg.wait_for_selector('.verdict-card .meters'); pg.wait_for_timeout(1000)
    good = int(pg.locator('.verdict-card .big-num').inner_text().strip('%').strip()); shot('44a_mix_board')
    pg.click('button[aria-label="Choose Top or dress"]'); pg.click('.picker button:has-text("Red cropped tee")'); pg.wait_for_timeout(1600)
    weak = int(pg.locator('.verdict-card .big-num').inner_text().strip('%').strip())
    assert weak < good, f'the weak piece did not lower the score ({good} → {weak})'
    shot('44b_mix_weak')
    slots_weak = pg.locator('.slot img').evaluate_all('e => e.map(i => i.alt)')
    pg.click('button:has-text("Suggest a fix")'); pg.wait_for_selector('.fix-delta', timeout=20000); pg.wait_for_timeout(1500)
    fixed = int(pg.locator('.verdict-card .big-num').inner_text().strip('%').strip())
    assert fixed > weak, f'Suggest a fix did not improve the score ({weak} → {fixed})'
    slots_fixed = pg.locator('.slot img').evaluate_all('e => e.map(i => i.alt)')
    assert sum(a != b for a, b in zip(slots_weak, slots_fixed)) == 1, 'Suggest a fix should change exactly one piece'
    expect(pg.locator('.fix-delta')).to_contain_text('red cropped tee')
    results['mix'] = [good, weak, fixed, pg.locator('.fix-delta').inner_text()]
    shot('44c_mix_fixed')
    go('/saved'); pg.wait_for_selector('text=Lookbook'); shot('44_saved')
    go('/packing'); pg.wait_for_selector('.suitcase'); pg.wait_for_timeout(700); shot('45_packing')
    pg.click('button:has-text("Mark as packed")'); pg.wait_for_selector('text=Unpack'); shot('46_packed')
    pg.click('button:has-text("Unpack")'); pg.wait_for_timeout(800)

    # ---------- ACT 6 · delete with a reason → replacement in the shopping bag ----------
    go('/closet'); pg.click('.piece-card:has-text("Silk scarf")'); pg.wait_for_selector('text=Availability')
    pg.click('button:has-text("Remove")'); pg.wait_for_selector('.reason-card'); pg.click('.reason-card:has-text("Torn / damaged")'); shot('47_delete_reason')
    pg.click('.modal button:has-text("Remove piece")'); pg.wait_for_selector('.bag-item:has-text("Silk scarf")'); pg.wait_for_timeout(500); shot('48_bag_replacement')
    assert piece('Silk scarf') is None, 'the silk scarf is still in the closet'
    rep = [i for i in api('/shopping/list')['items'] if i['source'] == 'replacement' and 'silk scarf' in (i.get('replaces') or '')]
    assert rep and 'torn' in (rep[0].get('reason') or '').lower(), 'no replacement with the stored reason'
    expect(pg.locator('.bag-item:has-text("Silk scarf") .tag:has-text("Replacement")')).to_have_count(1)

    # ---------- ACT 7 · Ask Closet → shopping bag ----------
    go('/ask'); pg.wait_for_selector('text=Try asking')
    for q in ['I want to buy beige trousers. Do I need them?', 'add this to my shopping list']:
        pg.fill('.chat-input input', q); pg.click('.chat-input button'); pg.wait_for_timeout(1600)
    pg.wait_for_selector('.bag-chip:has-text("Beige trousers")'); shot('50_ask')
    results['ask'] = pg.locator('.msg.ai').all_inner_texts()[-2:] if pg.locator('.msg.ai').count() else []
    go('/shopping'); pg.wait_for_selector('.bag-item:has-text("Beige trousers")'); pg.wait_for_timeout(400)
    for label in ['Added by Ask Closet', 'Replacement']: expect(pg.locator(f'.bag-item .tag:has-text("{label}")').first).to_be_visible()
    expect(pg.locator('.bag-item:has-text("Beige trousers") .dup-chip')).to_contain_text('You already own')
    assert any(i['source'] == 'ask' and i['title'] == 'Beige trousers' for i in api('/shopping/list')['items']), 'the bag item from Ask Closet is not stored'
    shot('52_shopping')
    pg.click('button:has-text("Check my closet")'); pg.wait_for_selector('.dup-warn'); pg.locator('.dup-warn').scroll_into_view_if_needed(); shot('52b_duplicate')

    # ---------- ACT 8 · Closet has learned: cards start closed → flip → confirm → undo ----------
    go('/analytics'); pg.wait_for_selector('text=Wardrobe utilised'); pg.wait_for_timeout(900); shot('51_analytics')
    pg.locator('#learned').scroll_into_view_if_needed(); pg.wait_for_timeout(400)
    expect(pg.locator('#learned .learn-flip.flipped')).to_have_count(0)
    shot('51a_learned_cards')
    pg.locator('#learned .learn-front').first.click(); pg.wait_for_timeout(800); shot('51b_learned')
    expect(pg.locator('#learned .learn-back').first).to_contain_text('Not accurate')
    before = api('/profile')
    pg.locator('#learned .learn-back button:has-text("Confirm")').first.click(); pg.wait_for_timeout(900)
    confirmed = api('/profile')
    assert confirmed != before, 'Confirm did not change the profile'
    pg.click('#learned details summary'); pg.wait_for_selector('#learned .tag.s1'); shot('51c_learned_confirmed')
    pg.click('#learned button:has-text("Undo")'); pg.wait_for_timeout(900)
    after_undo = api('/profile')
    for k in ('styles', 'avoidStyles', 'dressCode', 'colours'): assert after_undo.get(k) == before.get(k), f'Undo did not restore {k}'
    go('/'); pg.wait_for_selector('.today-card .look'); pg.wait_for_timeout(1000); shot('54_end_home')
    assert len(api('/items')['items']) == 29, 'Home: the closet should now hold 29 pieces (the scarf was deleted)'
    import json as _json; open(f'{S}results.json', 'w').write(_json.dumps(results, indent=1, ensure_ascii=False))

    # ---------- admin ----------
    sign_in('admin@closet.app'); pg.wait_for_timeout(1500); go('/admin'); pg.wait_for_selector('text=demo@closet.app'); pg.wait_for_selector('text=System health'); shot('53_admin')

    # ---------- phone ----------
    m = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2).new_page()
    m.goto(B); m.fill('input[type=email]', 'demo@closet.app'); m.fill('input[type=password]', 'Closet2026!'); m.click('form button.btn.lg')
    m.wait_for_selector('.today-card'); m.wait_for_timeout(1500); m.screenshot(path=f'{S}26_phone_home.png'); steps.append('26_phone_home')
    b.close()

print(f'{len(steps)} steps, {len(errs)} browser errors')
for e in errs: print('  ', e)
raise SystemExit(1 if errs else 0)
