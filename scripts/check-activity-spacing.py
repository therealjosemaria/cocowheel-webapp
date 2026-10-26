"""Activity layout regression: mocked APIs, no production writes or external traffic."""
from playwright.sync_api import sync_playwright, expect

BASE = 'http://127.0.0.1:3201'
pin = {'latitude': -33.9, 'longitude': 151.2, 'label': 'Example suburb, Sydney'}
ride = {'rideId': 'COCO-TEST123', 'status': 'CANCELLED', 'driverAlias': 'driver01',
        'priceAud': 0, 'plannedRoute': {'origin': pin, 'destination': pin}}
post = {'id': 'post-1', 'origin': pin, 'destination': pin, 'date': 'any', 'time': '',
        'status': 'CANCELLED', 'offers': []}
offer = {'id': 'offer-1', 'rideId': 'COCO-TEST123', 'driverAlias': 'driver01',
         'departureAt': '2026-10-27T01:00:00Z', 'priceAud': 0, 'status': 'PENDING'}
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width in [320, 390, 844, 1440]:
        context = browser.new_context(viewport={'width': width, 'height': 900})
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.route('**/*', lambda r: r.continue_() if r.request.url.startswith(BASE) else r.abort())
        def api(r):
            path = r.request.url.split('/api/')[-1].split('?')[0]
            data = {}
            if path == 'university/session': data = {'unikey': 'tester01'}
            elif path == 'current': data = {'current': None, 'currents': []}
            elif path == 'history': data = {'driver': [ride, dict(ride, rideId='COCO-TEST456')], 'rider': []}
            elif path == 'rider-demands':
                data = {'requests': [dict(post, status='OPEN', expiresAt='2026-10-28T01:00:00Z', offers=[offer]),
                                     dict(post, id='post-2')], 'sent': [offer]}
            elif path.startswith('profile-photo/'):
                r.fulfill(content_type='image/svg+xml', body='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#f1f5f9"/><circle cx="12" cy="8" r="3" fill="#64748b"/><path d="M5 22v-3a7 7 0 0 1 14 0v3" fill="#64748b"/></svg>'); return
            r.fulfill(json=data)
        page.route('**/api/**', api)
        page.goto(BASE + '/activity')
        cards = page.locator('.activity-card')
        expect(cards).to_have_count(5)
        expect(page.get_by_role('heading', name='Posts and offers', exact=True)).to_have_count(0)
        expect(page.locator('.demand-activity details')).to_have_count(0)
        expect(page.get_by_text('Withdrawn', exact=True)).to_be_visible()
        expect(page.get_by_role('button', name='Accept ride', exact=True)).to_be_visible()
        expect(page.locator('.demand-activity .activity-role svg')).to_have_count(3)
        boxes = [cards.nth(i).bounding_box() for i in range(5)]
        for before, after in zip(boxes, boxes[1:]):
            assert abs(after['y'] - before['y'] - before['height'] - 10) < 1
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        page.screenshot(path=f'/tmp/activity-spacing-{width}.png', full_page=True, animations='disabled')
        page.get_by_role('button', name='Withdraw post', exact=True).click()
        expect(page.get_by_role('dialog', name='Withdraw your post?', exact=True)).to_be_visible()
        page.keyboard.press('Escape')
        assert not errors, errors
        print(f'PASS {width}: equal 10px gaps, expanded posts, icons, actions, no overflow/errors', flush=True)
        context.close()
    browser.close()
