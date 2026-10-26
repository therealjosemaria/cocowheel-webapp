"""Request maps: isolated frontend, mocked API/road paths, no provider or live writes."""
from playwright.sync_api import sync_playwright, expect

BASE = 'http://127.0.0.1:3201'
origin = {'latitude': -33.90, 'longitude': 151.20, 'label': 'Example origin, Sydney'}
destination = {'latitude': -33.87, 'longitude': 151.24, 'label': 'Example destination, Sydney'}
post = {'id': 'post-1', 'alias': 'tester01', 'origin': origin, 'destination': destination,
        'date': 'any', 'time': '', 'status': 'OPEN', 'offers': [], 'expiresAt': '2026-10-28T01:00:00Z'}
second = dict(post, id='post-2', alias='other001', origin=dict(origin, latitude=-33.91))
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width in [320, 390, 844, 1440]:
        context = browser.new_context(viewport={'width': width, 'height': 900})
        page = context.new_page()
        errors, routes, writes = [], [], []
        failure = {'enabled': False}
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.route('**/*', lambda r: r.continue_() if r.request.url.startswith(BASE) else r.abort())
        def api(r):
            path = r.request.url.split('/api/')[-1].split('?')[0]
            data = {}
            if path == 'university/session': data = {'unikey': 'tester01'}
            elif path == 'current': data = {'current': None, 'currents': []}
            elif path == 'history': data = {'driver': [], 'rider': []}
            elif path == 'rider-demands': data = {'requests': [post, dict(second, status='CANCELLED')], 'sent': []}
            elif path == 'rider-demands/search': data = {'requests': [post, second]}
            elif path == 'route-preview':
                payload = r.request.post_data_json
                routes.append(payload)
                if failure['enabled']:
                    r.fulfill(status=503, json={'error': 'ROUTE_PREVIEW_UNAVAILABLE'}); return
                data = {'points': [payload['origin'], {'latitude': -33.895, 'longitude': 151.25}, payload['destination']]}
            elif path.startswith('profile-photo/'):
                r.fulfill(content_type='image/svg+xml', body='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#e2e8f0"/></svg>'); return
            elif r.request.method == 'POST': writes.append(path)
            r.fulfill(json=data)
        page.route('**/api/**', api)
        page.goto(BASE + '/?start=driver')
        page.get_by_role('button', name='See journey requests', exact=True).click()
        page.get_by_role('button', name='SEARCH', exact=True).click()
        cards = page.locator('.demand-page .activity-card')
        expect(cards).to_have_count(2)
        assert routes == [], 'No routing calls for unseen request cards'
        cards.first.get_by_role('button', name='Show route', exact=True).click()
        expect(page.get_by_text('Road path by', exact=False)).to_be_visible()
        expect(page.locator('.demand-map path.leaflet-interactive[fill="none"]')).to_have_count(1)
        expect(page.get_by_text('Approximate routes', exact=True)).to_have_count(0)
        assert len(routes) == 1 and routes[0]['origin']['latitude'] == origin['latitude']
        cards.first.get_by_role('button', name='Hide route').click()
        cards.first.get_by_role('button', name='Show route').click()
        expect(page.get_by_text('Road path by', exact=False)).to_be_visible()
        assert len(routes) == 1, 'Reuse the existing session road cache'
        failure['enabled'] = True
        cards.nth(1).get_by_role('button', name='Show route').click()
        expect(cards.first.get_by_role('button', name='Show route')).to_be_visible()
        expect(page.get_by_text('Road route unavailable.', exact=False)).to_be_visible()
        expect(page.locator('.demand-map path.leaflet-interactive[fill="none"]')).to_have_count(0)
        failure['enabled'] = False
        page.get_by_role('button', name='Try again', exact=True).click()
        expect(page.get_by_text('Road path by', exact=False)).to_be_visible()
        expect(page.get_by_text('Road route unavailable.', exact=False)).to_have_count(0)
        page.screenshot(path=f'/tmp/request-map-discovery-{width}.png', full_page=True)
        page.goto(BASE + '/activity')
        cards = page.locator('.demand-activity .activity-card')
        expect(cards).to_have_count(2)
        before = len(routes)
        cards.first.get_by_role('button', name='Show route', exact=True).click()
        expect(cards.first.get_by_text('Road path by', exact=False)).to_be_visible()
        expect(cards.first.get_by_text('Your route', exact=True)).to_be_visible()
        expect(cards.first.get_by_role('button', name='Withdraw post')).to_be_visible()
        assert len(routes) == before, 'Activity shares the same cached road path'
        page.screenshot(path=f'/tmp/request-map-activity-{width}.png', full_page=True)
        cards.nth(1).get_by_role('button', name='Show route', exact=True).click()
        expect(cards.first.locator('.demand-map')).to_have_count(0)
        expect(cards.nth(1).get_by_text('Road path by', exact=False)).to_be_visible()
        expect(cards.nth(1).get_by_role('button', name='Withdraw post')).to_have_count(0)
        cards.nth(1).get_by_role('button', name='Hide route').click()
        expect(page.locator('.demand-map')).to_have_count(0)
        page.wait_for_timeout(400)
        assert not errors, errors
        assert not writes, writes
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        print(f'PASS {width}: road paths, cached toggles, failure/retry, one selected request, Activity/history, no writes/errors/overflow', flush=True)
        context.close()
    browser.close()
