# Lifecycle journey (v1.6): the garment lifecycle through the real UI, live app OR offline demo (same assertions).
# Laundry · Repairs & alterations (At tailor) · Borrow & lend · Donation · Packing · Purchase simulation ·
# Planner weather / availability conflict. After every change it navigates away and checks the state again
# through the UI AND the API (Style me, Planner conflicts, Ask Closet, Home status, Shopping bag, Analytics).
#   python e2e/lifecycle_journey.py                                       # app on http://localhost:4000 after npm run seed
#   CLOSET_URL=file:///abs/path/Closet_Demo.html python e2e/lifecycle_journey.py
import os, json, datetime
from playwright.sync_api import sync_playwright, expect

URL = os.environ.get('CLOSET_URL', 'http://localhost:4000/')
BASE = URL.split('#')[0]
OFFLINE = BASE.startswith('file:')
S = os.environ.get('SHOTS', './e2e-shots-lifecycle/')
os.makedirs(S, exist_ok=True)
errs, steps, results = [], [], {'target': 'offline demo' if OFFLINE else 'live app'}
day = lambda n: (datetime.datetime.now(datetime.timezone.utc).date() + datetime.timedelta(days=n)).isoformat()  # the app's day is UTC

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_context(viewport={'width': 1440, 'height': 900}).new_page()
    pg.on('console', lambda m: m.type == 'error' and not any(x in m.text for x in ('fonts.g', 'TUNNEL', 'status of 400', 'status of 401', 'status of 404', 'status of 409')) and errs.append(m.text))
    pg.on('pageerror', lambda e: errs.append(str(e)))

    def shot(name):
        pg.wait_for_timeout(300); pg.screenshot(path=f'{S}{name}.png'); steps.append(name)
    def go(path, wait=900):
        pg.goto(f'{BASE}#{path}'); pg.wait_for_timeout(wait)
    def api(path, method='GET', body=None):
        return pg.evaluate("""async ([p, m, b]) => { const r = await fetch('/api/v1' + p, { method: m, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + sessionStorage.getItem('closet.token') }, body: b ? JSON.stringify(b) : undefined });
                             return r.status === 204 ? null : r.json(); }""", [path, method, body])
    def piece(name):
        return next((x for x in api('/items')['items'] if x['name'] == name), None)
    def recommended(pid):
        return any(any(pid in o['itemIds'] for o in api('/recommendations', 'POST', {'occasion': occ})['outfits']) for occ in ('Work', 'Interview', 'Dinner', 'University'))
    def ask(q):
        go('/ask'); pg.wait_for_selector('.chat-input input')
        n = pg.locator('.msg.ai').count()
        pg.fill('.chat-input input', q); pg.click('.chat-input button')
        pg.wait_for_function('n => document.querySelectorAll(".msg.ai").length > n && !document.querySelector(".typing")', arg=n, timeout=15000)
        pg.wait_for_timeout(250)
        return pg.locator('.msg.ai').last.inner_text()
    def open_piece(name):
        go('/closet'); pg.click(f'.piece-card:has-text("{name}")'); pg.wait_for_selector('text=Availability'); pg.wait_for_timeout(300)

    # ---------- sign in; Home Wardrobe status ----------
    pg.goto(BASE); pg.wait_for_selector('text=Welcome back')
    pg.fill('input[type=email]', 'demo@closet.app'); pg.fill('input[type=password]', 'Closet2026!'); pg.click('form button.btn.lg')
    pg.wait_for_selector('.today-card .look', timeout=20000); pg.wait_for_timeout(1200)
    expect(pg.locator('.status-line:has-text("in the laundry") b')).to_have_text('3')
    expect(pg.locator('.status-line:has-text("need repair") b')).to_have_text('1')
    shot('l01_home_status')

    # ---------- 1 Laundry: Navy blazer → Laundry → Care/Laundry → Wash done ----------
    open_piece('Navy blazer'); pg.click('button:has-text("In laundry")'); pg.wait_for_selector('.status.Laundry')
    go('/care'); expect(pg.locator('.basket-item:has-text("Navy blazer")')).to_have_count(1); shot('l02_care_laundry')
    pg.click('button:has-text("Wash done")'); pg.wait_for_selector('text=Available again.'); pg.wait_for_timeout(600)
    assert piece('Navy blazer')['status'] == 'Available'

    # ---------- 2 Repairs & alterations: Black blazer → Needs alteration → tailor → Care → Style me → collected ----------
    bb = piece('Black blazer')
    open_piece('Black blazer'); pg.click('button:has-text("More actions")'); pg.click('.menu button:has-text("Repair / Alter")')
    pg.click('.reason-card:has-text("Needs alteration")'); pg.fill('input[aria-label="Reason"]', 'Sleeves too long'); pg.click('.modal button:has-text("Save")')
    pg.wait_for_selector('.status.Needs-alteration')
    pg.click('button:has-text("Send to tailor")'); pg.fill('input[aria-label="Tailor"]', 'Hany Tailoring'); pg.fill('input[aria-label="Expected return"]', day(0))
    pg.click('.modal button:has-text("Send to tailor")'); pg.wait_for_selector('.status.At-tailor')
    go('/care/repairs'); expect(pg.locator('section[aria-label="At tailor"] .care-row:has-text("Black blazer")')).to_have_count(1)
    expect(pg.locator('section[aria-label="At tailor"]')).to_contain_text('Sleeves too long'); shot('l03_care_at_tailor')
    go('/closet'); expect(pg.locator('.piece-card:has-text("Black blazer") .meta')).to_contain_text('At tailor')
    assert not recommended(bb['id']), 'a piece at the tailor was recommended'
    go('/outfits'); pg.click('.occ:has-text("Work")') if pg.locator('.occ:has-text("Work")').count() else None
    pg.click('button:has-text("Generate 3 looks")'); pg.wait_for_selector('text=LOOK 03', timeout=20000); pg.wait_for_timeout(900)
    expect(pg.locator('.looks .flip img[alt="Black blazer"]')).to_have_count(0); shot('l04_styleme_without_blazer')
    n = api('/notifications')['notifications']
    assert any(x['type'] == 'TAILOR_READY' and 'should be ready from the tailor' in x['text'] for x in n), 'no tailor reminder'
    r1 = ask('When is my black blazer back from the tailor?'); assert 'at the tailor' in r1 and 'Hany Tailoring' in r1, r1
    r2 = ask('What needs repair?'); assert 'Camel cardigan' in r2 and 'Black blazer' in r2, r2
    go('/care/repairs'); pg.click('section[aria-label="At tailor"] button:has-text("Mark collected")'); pg.wait_for_timeout(900)
    expect(pg.locator('section[aria-label="At tailor"]')).to_have_count(0)
    assert piece('Black blazer')['status'] == 'Available'; shot('l05_collected')
    results['repair'] = [r1, r2]

    # ---------- 3 Borrow & lend: Black blazer → Nour → Closet / Style me / Planner / Ask → Mark returned ----------
    open_piece('Black blazer'); pg.click('button:has-text("More actions")'); pg.click('.menu button:has-text("Lend item")')
    pg.fill('input[aria-label="Person"]', 'Nour'); pg.fill('input[aria-label="Expected return"]', day(5)); pg.click('.modal button:has-text("Lend item")')
    pg.wait_for_selector('.status.Borrowed')
    go('/closet'); expect(pg.locator('.piece-card:has-text("Black blazer") .meta')).to_contain_text('Borrowed')
    assert not recommended(bb['id']), 'a lent piece was recommended'
    ev = next(e for e in api('/events/upcoming')['events'] if e['title'] == 'Dinner with family')
    plan = [x['id'] for x in ev['plannedOutfit']['pieces']]
    api(f"/events/{ev['id']}/outfit", 'PUT', {'itemIds': plan[:2] + [bb['id']] + plan[3:]})
    conf = api('/intelligence/conflicts')['conflicts']
    assert any(c['itemId'] == bb['id'] and 'lent out' in c['message'] for c in conf), 'Planner did not detect the lent piece'
    go('/lending'); expect(pg.locator('.care-row:has-text("Black blazer")')).to_contain_text('Nour'); shot('l06_borrow_lend')
    r3 = ask('Who has my black blazer?'); assert 'Nour' in r3, r3
    go('/lending'); pg.click('.care-row:has-text("Black blazer") button:has-text("Mark returned")'); pg.wait_for_timeout(900)
    assert piece('Black blazer')['status'] == 'Available'
    assert not any(c['itemId'] == bb['id'] for c in api('/intelligence/conflicts')['conflicts'])
    expect(pg.locator('text=History')).to_have_count(1); shot('l07_returned')
    api(f"/events/{ev['id']}/outfit", 'PUT', {'itemIds': plan})
    results['lend'] = r3

    # ---------- 4 Donation: Still love it? → Style it → Donate → Donation area → navigate away → Mark as donated ----------
    go('/'); pg.wait_for_selector('.still'); pg.locator('.still a:has-text("Style it")').click(); pg.wait_for_selector('text=LOOK 03', timeout=20000); pg.wait_for_timeout(900)
    go('/'); pg.wait_for_selector('.still'); pg.locator('.still button:has-text("Donate")').first.click(); pg.wait_for_selector('text=Donate this item?')
    pg.click('.reason-card:has-text("Donate")'); pg.wait_for_selector('.modal button:has-text("Mark as donated")'); pg.keyboard.press('Escape')
    go('/analytics'); go('/planner')   # navigate away
    go('/donation'); expect(pg.locator('section[aria-label="Ready to donate"] .care-row:has-text("Denim jacket")')).to_have_count(1); shot('l08_donation_area')
    bag = len(api('/shopping/list')['items']); donated0 = api('/donation')['count']
    pg.click('.care-row:has-text("Denim jacket") button:has-text("Mark as donated")'); pg.wait_for_timeout(900)
    go('/closet'); expect(pg.locator('.piece-card:has-text("Denim jacket")')).to_have_count(0)
    assert len(api('/shopping/list')['items']) == bag, 'donation created a replacement'
    go('/shopping'); expect(pg.locator('.bag-item:has-text("Denim jacket")')).to_have_count(0)
    go('/analytics'); pg.locator('#forgotten').scroll_into_view_if_needed(); expect(pg.locator('#forgotten')).to_contain_text(f'{donated0 + 1} donated'); shot('l09_donated_analytics')

    # ---------- 5 Packing: short trip → capsule → Mark packed → Packed everywhere → Unpack ----------
    go('/packing'); pg.wait_for_selector('text=Where are you going?')
    pg.fill('input[aria-label="Destination"]', 'Alexandria') if pg.locator('input[aria-label="Destination"]').count() else None
    trip = api('/packing/trips', 'POST', {'destination': 'Alexandria', 'startDate': day(2), 'endDate': day(3), 'tripType': 'Travel', 'activities': ['Travel', 'Dinner'], 'carryOn': True})
    tid = trip['id'] if 'id' in trip else trip['trip']['id']
    packed = api(f'/packing/trips/{tid}/pack', 'POST')
    ids = (packed.get('trip') or {}).get('itemIds') or trip.get('itemIds') or []
    assert ids and all(piece_by['status'] == 'Packed' for piece_by in [x for x in api('/items')['items'] if x['id'] in ids]), 'trip pieces not Packed'
    assert not any(recommended(i) for i in ids[:2]), 'a packed piece was recommended'
    r4 = ask("What haven't I packed?")
    go('/packing'); pg.wait_for_timeout(600); shot('l10_packing')
    api(f'/packing/trips/{tid}/unpack', 'POST')
    assert all(x['status'] == 'Available' for x in api('/items')['items'] if x['id'] in ids)
    results['packing'] = {'pieces': len(ids), 'ask': r4[:160]}

    # ---------- 6 Purchase simulation: useful vs near-duplicate, nothing added ----------
    total = api('/items')['total']
    useful = api('/shopping/impact', 'POST', {'category': 'Shoes', 'colour': 'White', 'name': 'loafers', 'styles': ['Classic', 'Minimal'], 'dressCodes': [2, 3]})
    dup = api('/shopping/impact', 'POST', {'category': 'Top', 'colour': 'Black', 'name': 'fitted top', 'styles': ['Minimal'], 'dressCodes': [1, 2, 3]})
    assert useful['newCombinations'] > dup['newCombinations'] and dup['similarOwned'] >= 1, (useful, dup)
    assert api('/items')['total'] == total, 'simulation created a piece'
    results['purchase'] = {'useful': [useful['recommendation'], useful['newCombinations']], 'duplicate': [dup['recommendation'], dup['newCombinations'], dup['similarOwned']]}

    # ---------- 7 Planner: weather / availability conflict → adjust one piece ----------
    mon = api('/intelligence/monitor')['alerts']
    w = [a for a in mon if a['kind'] == 'weather']
    if w:
        go('/planner'); pg.click('.conflict button:has-text("Adjust outfit")'); pg.wait_for_timeout(1200); shot('l11_planner_adjusted')
        assert not any(a['kind'] == 'weather' and a['eventId'] == w[0]['eventId'] for a in api('/intelligence/monitor')['alerts'])
        results['weather'] = w[0]['message']
    go('/'); pg.wait_for_selector('.today-card'); shot('l12_home_end')
    b.close()

open(f'{S}results.json', 'w').write(json.dumps(results, indent=1, ensure_ascii=False))
assert not errs, errs
print(f"{results['target']}: {len(steps)} checkpoints, {len(errs)} browser errors")
