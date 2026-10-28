# Stateful browser journey (Milestone 2 final). Complements demo_journey.py: after every mutation it
# NAVIGATES AWAY AND BACK (and sometimes reloads) and checks the state again, through the UI and the API.
# Runs against the live app OR the offline demo file — the same assertions for both:
#   python e2e/stateful_journey.py                                   # app on http://localhost:4000 after npm run seed
#   CLOSET_URL=file:///abs/path/Closet_Demo.html python e2e/stateful_journey.py   # offline demo, no server
# Fails on any browser error and on any assertion. Writes screenshots and results.json to SHOTS.
import os, json
from playwright.sync_api import sync_playwright, expect

URL = os.environ.get('CLOSET_URL', 'http://localhost:4000/')
BASE = URL.split('#')[0]
OFFLINE = BASE.startswith('file:')
S = os.environ.get('SHOTS', './e2e-shots-stateful/')
os.makedirs(S, exist_ok=True)
MAJOR = {'Top', 'Dress', 'Bottom', 'Layer', 'Shoes'}
errs, steps, results = [], [], {'target': 'offline demo' if OFFLINE else 'live app'}

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_context(viewport={'width': 1440, 'height': 900}).new_page()
    pg.on('console', lambda m: m.type == 'error' and not any(x in m.text for x in ('fonts.g', 'TUNNEL', 'status of 400', 'status of 401', 'status of 404', 'status of 409')) and errs.append(m.text))
    pg.on('pageerror', lambda e: errs.append(str(e)))

    def shot(name):
        pg.wait_for_timeout(350); pg.screenshot(path=f'{S}{name}.png'); steps.append(name)
    def go(path, wait=900):
        pg.goto(f'{BASE}#{path}'); pg.wait_for_timeout(wait)
    def api(path, method='GET', body=None):
        return pg.evaluate("""async ([p, m, b]) => { const r = await fetch('/api/v1' + p, { method: m, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + sessionStorage.getItem('closet.token') }, body: b ? JSON.stringify(b) : undefined });
                             return r.status === 204 ? null : r.json(); }""", [path, method, body])
    def piece(name):
        return next((x for x in api('/items')['items'] if x['name'] == name), None)
    def ask(q):
        n = pg.locator('.msg.ai').count()
        pg.fill('.chat-input input', q); pg.click('.chat-input button')
        pg.wait_for_function('n => document.querySelectorAll(".msg.ai").length > n && !document.querySelector(".typing")', arg=n, timeout=15000)
        pg.wait_for_timeout(250)
        return pg.locator('.msg.ai').last.inner_text()

    # ---------- sign in ----------
    pg.goto(BASE); pg.wait_for_selector('text=Welcome back')
    pg.fill('input[type=email]', 'demo@closet.app'); pg.fill('input[type=password]', 'Closet2026!'); pg.click('form button.btn.lg')
    pg.wait_for_selector('.today-card .look', timeout=20000); pg.wait_for_timeout(1500); shot('s01_home')
    expect(pg.locator('.noticed')).to_be_visible()                      # Closet noticed: at most two notices
    assert pg.locator('.notice-card').count() <= 2, 'Home shows more than two proactive notices'
    expect(pg.locator('.still')).to_contain_text('denim jacket')         # Still love it? — the 104-day denim jacket
    home_laundry = int(pg.locator('a.stat:has-text("in the laundry") b').inner_text())

    # ---------- Laundry: one status, everywhere ----------
    go('/closet'); pg.click('.piece-card:has-text("Navy blazer")'); pg.wait_for_selector('text=Availability')
    pg.click('button:has-text("In laundry")'); pg.wait_for_selector('.status.Laundry'); shot('s02_blazer_laundry')
    go('/laundry'); expect(pg.locator('.basket-item:has-text("Navy blazer")')).to_have_count(1)
    go('/closet'); expect(pg.locator('.piece-card:has-text("Navy blazer") .meta')).to_contain_text('In laundry')
    go('/'); pg.wait_for_selector('.today-card'); expect(pg.locator('a.stat:has-text("in the laundry") b')).to_have_text(str(home_laundry + 1))
    rec = api('/recommendations', 'POST', {'occasion': 'University'})
    assert not any(piece('Navy blazer')['id'] in o['itemIds'] for o in rec['outfits']), 'a laundry piece was recommended'
    go('/laundry'); pg.click('button:has-text("Wash done")'); pg.wait_for_selector('text=Available again.'); pg.wait_for_timeout(700)
    go('/closet'); expect(pg.locator('.piece-card:has-text("Navy blazer") .meta')).to_contain_text('Available')
    go('/laundry'); expect(pg.locator('.basket-item')).to_have_count(0)
    assert piece('Navy blazer')['status'] == 'Available'
    shot('s03_wash_done')

    # ---------- 3 looks: genuinely different ----------
    go('/outfits'); pg.click('.occ:has-text("University")'); pg.click('button:has-text("Generate 3 looks")'); pg.wait_for_selector('text=LOOK 03'); pg.wait_for_timeout(1300)
    expect(pg.locator('.looks .flip')).to_have_count(3); shot('s04_three_looks')
    looks = api('/recommendations', 'POST', {'occasion': 'University'})['outfits']
    cat = {x['id']: x['category'] for x in api('/items')['items']}
    worst = 0
    for i in range(3):
        for j in range(i + 1, 3):
            a = {x for x in looks[i]['itemIds'] if cat[x] in MAJOR}; c = {x for x in looks[j]['itemIds'] if cat[x] in MAJOR}
            worst = max(worst, len(a & c))
    assert worst <= 1, f'two looks share {worst} major garments'
    results['max_shared_major_garments'] = worst

    # ---------- Favourite → Lookbook → Favourites, survives navigation and refresh ----------
    first = pg.locator('.looks .flip').first
    names = sorted(first.locator('.front .look-piece img').evaluate_all('e => e.map(i => i.alt)'))
    first.locator('button[aria-label="Favourite"]').click(); pg.wait_for_timeout(900)
    first.locator('button[aria-label="Save"], button:has-text("Save")').first.click(); pg.wait_for_timeout(900)   # save after favourite: same record
    go('/saved'); pg.click('.tabs button:has-text("Favourites")'); pg.wait_for_timeout(700); shot('s05_favourites')
    favs = api('/outfits?favorites=true')['outfits']
    mine = [o for o in favs if sorted(pp['name'] for pp in o['pieces']) == names]
    assert len(mine) == 1, 'the favourited look is not in Favourites exactly once'
    assert len([o for o in api('/outfits')['outfits'] if sorted(pp['name'] for pp in o['pieces']) == names]) == 1, 'Save + Favourite created a duplicate'
    pg.reload(); pg.wait_for_timeout(1500); pg.click('.tabs button:has-text("Favourites")'); pg.wait_for_timeout(600)
    assert any(sorted(pp['name'] for pp in o['pieces']) == names for o in api('/outfits?favorites=true')['outfits']), 'favourite lost after refresh'
    api(f"/outfits/{mine[0]['id']}", 'PATCH', {'favorite': False})
    assert not any(o['id'] == mine[0]['id'] for o in api('/outfits?favorites=true')['outfits'])
    assert any(o['id'] == mine[0]['id'] for o in api('/outfits')['outfits']), 'unfavourite removed it from All looks'

    # ---------- Still love it? → Style it (3 looks contain it) → Keep it ----------
    go('/'); pg.wait_for_selector('.still'); pg.locator('.still a:has-text("Style it")').click(); pg.wait_for_selector('text=LOOK 03'); pg.wait_for_timeout(1300)
    for k in range(3): expect(pg.locator('.looks .flip').nth(k).locator('.front img[alt="Denim jacket"]')).to_have_count(1)
    shot('s06_style_it')
    go('/analytics'); pg.locator('#forgotten').scroll_into_view_if_needed(); expect(pg.locator('#forgotten .still:has-text("denim jacket")')).to_have_count(1)
    pg.locator('#forgotten .still:has-text("denim jacket") button:has-text("Keep it")').click(); pg.click('.modal .chip:has-text("Still love it")'); pg.wait_for_timeout(900)
    go('/analytics'); expect(pg.locator('#forgotten .still:has-text("denim jacket")')).to_have_count(0); shot('s07_kept')
    assert all(c['id'] != piece('Denim jacket')['id'] for c in api('/intelligence/forgotten')['candidates'])

    # ---------- Donate: Ready to donate → Mark as donated → gone, no replacement ----------
    bag_before = len(api('/shopping/list')['items'])
    go('/closet'); pg.click('.piece-card:has-text("Denim jacket")'); pg.wait_for_selector('text=Availability')
    pg.click('button.link:has-text("donate it")'); pg.wait_for_selector('text=Donate this item?'); shot('s08_donate')
    pg.click('.reason-card:has-text("Donate")'); pg.wait_for_selector('.modal button:has-text("Mark as donated")')
    assert piece('Denim jacket')['rehome']['label'] == 'Ready to donate'
    pg.click('.modal button:has-text("Mark as donated")'); pg.wait_for_timeout(1000)
    go('/closet'); expect(pg.locator('.piece-card:has-text("Denim jacket")')).to_have_count(0)
    assert piece('Denim jacket') is None and len(api('/shopping/list')['items']) == bag_before, 'donation created a replacement or left the piece'
    shot('s09_donated')

    # ---------- Ask Closet: different questions → different, state-backed answers ----------
    go('/ask'); pg.wait_for_selector('text=Try asking')
    asked = []
    for q in ['What should I wear to university tomorrow?', 'Is my blazer clean?', 'Put the blazer in the wash.', 'Is my blazer clean?', 'Laundry is done.',
              'Do I need beige trousers?', 'Add this to my shopping list.', 'Who has my rose wrap dress?', 'What has the best cost per wear?',
              'Is tomorrow’s outfit still okay for the weather?', 'Pack me for 5 days in Paris with a carry-on', 'Tell me a joke']:
        asked.append((q, ask(q)))
    shot('s10_ask')
    replies = [r for _, r in asked]
    assert len(set(replies)) == len(replies), 'Ask Closet repeated an answer'
    assert 'Available' in replies[1] and 'in the laundry' in replies[3], 'availability answers do not follow state'
    assert replies[1] != replies[3]
    assert sum('beige trousers' in r.lower() for r in replies) <= 2, 'beige trousers leaked into unrelated answers'
    assert replies[-1].startswith('I can help with your wardrobe'), 'out-of-scope answer is wrong'
    assert any(i['title'] == 'Beige trousers' and i['source'] == 'ask' for i in api('/shopping/list')['items']), 'Add this did not update the shopping list'
    go('/shopping'); expect(pg.locator('.bag-item:has-text("Beige trousers") .tag:has-text("Added by Ask Closet")')).to_have_count(1)
    results['ask'] = [[q, r[:160]] for q, r in asked]

    # ---------- Mix & Match: weak piece → Suggest a fix ----------
    go('/mix?occasion=Work'); pg.click('button:has-text("Start from a suggested look")'); pg.wait_for_selector('.verdict-card .meters'); pg.wait_for_timeout(900)
    good = int(pg.locator('.verdict-card .big-num').inner_text().strip('%').strip())
    pg.click('button[aria-label="Choose Top or dress"]'); pg.click('.picker button:has-text("Red cropped tee")'); pg.wait_for_timeout(1400)
    weak = int(pg.locator('.verdict-card .big-num').inner_text().strip('%').strip())
    pg.click('button:has-text("Suggest a fix")'); pg.wait_for_selector('.fix-delta', timeout=20000); pg.wait_for_timeout(1200)
    fixed = int(pg.locator('.verdict-card .big-num').inner_text().strip('%').strip())
    assert weak < good and fixed > weak, f'Mix & Match {good} → {weak} → {fixed}'
    results['mix'] = [good, weak, fixed]; shot('s11_mix')

    # ---------- Delete with a reason → Shopping Bag ----------
    go('/closet'); pg.click('.piece-card:has-text("Silk scarf")'); pg.wait_for_selector('text=Availability')
    pg.click('button:has-text("Remove")'); pg.click('.reason-card:has-text("Torn / damaged")'); pg.click('.modal button:has-text("Remove piece")')
    pg.wait_for_selector('.bag-item:has-text("Silk scarf")'); go('/closet'); expect(pg.locator('.piece-card:has-text("Silk scarf")')).to_have_count(0)
    go('/shopping'); expect(pg.locator('.bag-item:has-text("Silk scarf") .tag:has-text("Replacement")')).to_have_count(1); shot('s12_bag')

    # ---------- Closet has learned: closed → flip → Confirm → Undo ----------
    go('/analytics'); pg.locator('#learned').scroll_into_view_if_needed(); expect(pg.locator('#learned .learn-flip.flipped')).to_have_count(0)
    before = api('/profile'); pg.locator('#learned .learn-front').first.click(); pg.wait_for_timeout(600)
    pg.locator('#learned .learn-back button:has-text("Confirm")').first.click(); pg.wait_for_timeout(900)
    assert api('/profile') != before, 'Confirm did not change the profile'
    pg.click('#learned details summary'); pg.click('#learned button:has-text("Undo")'); pg.wait_for_timeout(900)
    after = api('/profile')
    for k in ('styles', 'avoidStyles', 'dressCode', 'colours'): assert after.get(k) == before.get(k), f'Undo did not restore {k}'
    shot('s13_learned')

    # ---------- Planner: the weather changed → Adjust outfit changes only the warm piece ----------
    mon = api('/intelligence/monitor')['alerts']
    w = [a for a in mon if a['kind'] == 'weather']
    if w:
        ev = next(e for e in api('/events/upcoming')['events'] if e['id'] == w[0]['eventId'])
        before_ids = [pp['id'] for pp in ev['plannedOutfit']['pieces']]
        go('/planner'); pg.click('.conflict button:has-text("Adjust outfit")'); pg.wait_for_timeout(1200); shot('s14_adjusted')
        ev2 = next(e for e in api('/events/upcoming')['events'] if e['id'] == w[0]['eventId'])
        after_ids = [pp['id'] for pp in ev2['plannedOutfit']['pieces']]
        assert sum(x != y for x, y in zip(before_ids, after_ids)) == 1 and w[0]['itemId'] not in after_ids, 'Adjust outfit did not change exactly the warm piece'
        results['weather_adjust'] = w[0]['message']
    else:
        results['weather_adjust'] = 'no weather shift in this data (planned forecast unchanged)'

    # ---------- Packing: carry-on capsule ----------
    go('/packing'); pg.wait_for_selector('text=Where are you going?')
    plan = api('/packing/plan', 'POST', {'destination': 'Paris', 'startDate': api('/weather')['date'], 'endDate': api('/weather')['date'], 'tripType': 'Travel', 'activities': ['Travel'], 'carryOn': True})
    assert plan['counts']['clothing'] <= 8 and plan['counts']['shoes'] <= 2
    results['capsule'] = plan['summary']

    go('/'); pg.wait_for_selector('.today-card'); shot('s15_home_end')
    b.close()

open(f'{S}results.json', 'w').write(json.dumps(results, indent=1, ensure_ascii=False))
print(f"{results['target']}: {len(steps)} checkpoints, {len(errs)} browser errors")
for e in errs: print('  ', e)
raise SystemExit(1 if errs else 0)
