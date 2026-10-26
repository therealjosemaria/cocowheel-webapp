"""Request maps: isolated frontend, mocked API/road paths, no provider or live writes."""
from playwright.sync_api import sync_playwright, expect
import json

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
        failure = {'enabled': False, 'empty': False}
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.route('**/*', lambda r: r.continue_() if r.request.url.startswith(BASE) else r.abort())
        def api(r):
            path = r.request.url.split('/api/')[-1].split('?')[0]
            data = {}
            if path == 'university/session': data = {'unikey': 'tester01'}
            elif path == 'current': data = {'current': None, 'currents': []}
            elif path == 'history': data = {'driver': [], 'rider': []}
            elif path == 'search': data = {'candidates': [dict(rideId='COCO-TEST',driverAlias='driver01',status='PUBLISHED',priceAud=0,
                scheduledDepartureAt='2099-10-27T01:00:00Z',redactedCorridor=[origin,destination],directionFit='GOOD',
                pickupDistanceMeters=200,destinationDistanceMeters=200,isOwnOffer=False)], 'serverNow':'2026-10-27T00:00:00Z'}
            elif path == 'rider-demands': data = {'requests': [post, dict(second, status='CANCELLED')], 'sent': []}
            elif path == 'rider-demands/search': data = {'requests': [] if failure['empty'] else [post, second] + [dict(second,id=f'extra-{i}') for i in range(18)]}
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
        page.add_init_script('sessionStorage.setItem("cocowheels:find-ride-draft:v1", JSON.stringify({...'+json.dumps({'pickup':origin,'destination':destination,'departureAt':None})+',savedAt:Date.now()}));')
        page.goto(BASE + '/?start=rider')
        expect(page.locator('.ride-option')).to_have_count(1)
        page.locator('.ride-option').click()
        expect(page.locator('.ride-option')).to_have_attribute('aria-pressed','true')
        expect(page.get_by_role('button',name='REQUEST TO JOIN',exact=True)).to_be_enabled()
        page.screenshot(path=f'/tmp/shared-results-rider-{width}.png',full_page=True)
        page.get_by_role('button',name='Back to route search',exact=True).click()
        expect(page.get_by_role('button',name='Where from?',exact=True)).to_be_visible()
        page.evaluate('sessionStorage.clear()')
        routes.clear()
        page.goto(BASE + '/?start=driver')
        page.get_by_role('button', name='See journey requests', exact=True).click()
        page.get_by_role('button', name='SEARCH', exact=True).click()
        cards = page.locator('.journey-request-results .activity-card')
        expect(cards).to_have_count(20)
        expect(page.locator('.ride-selection-map .leaflet-container')).to_be_visible()
        expect(page.locator('.ride-selection-map path.leaflet-interactive')).to_have_count(0)
        listing = page.locator('.ride-option-list')
        assert listing.evaluate('(el) => el.scrollHeight > el.clientHeight')
        assert page.locator('.ride-selection-map').bounding_box()['y'] < listing.bounding_box()['y']
        page.screenshot(path=f'/tmp/request-results-initial-{width}.png', full_page=True)
        assert routes == [], 'No routing calls for unseen request cards'
        cards.first.get_by_role('button', name='Show route', exact=True).click()
        expect(page.get_by_text('Road path by', exact=False)).to_be_visible()
        expect(page.locator('.ride-selection-map path.leaflet-interactive[fill="none"]')).to_have_count(1)
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
        expect(page.locator('.ride-selection-map path.leaflet-interactive[fill="none"]')).to_have_count(0)
        failure['enabled'] = False
        page.get_by_role('button', name='Try again', exact=True).click()
        expect(page.get_by_text('Road path by', exact=False)).to_be_visible()
        expect(page.get_by_text('Road route unavailable.', exact=False)).to_have_count(0)
        page.screenshot(path=f'/tmp/request-map-discovery-{width}.png', full_page=True)
        cards.nth(1).get_by_role('button',name='Offer a ride',exact=True).click()
        expect(page.get_by_role('dialog',name='Offer a ride',exact=True)).to_be_visible()
        page.keyboard.press('Escape')
        assert not writes, 'Selecting and reviewing must not publish an offer'
        page.get_by_role('button',name='Back to route search',exact=True).click()
        expect(page.get_by_role('heading',name='Journey requests',exact=True)).to_be_visible()
        failure['empty'] = True
        page.get_by_role('button',name='SEARCH',exact=True).click()
        expect(page.get_by_text('No matching ride requests.',exact=True)).to_be_visible()
        expect(page.locator('.ride-selection-map .leaflet-container')).to_be_visible()
        page.screenshot(path=f'/tmp/request-results-empty-{width}.png', full_page=True)
        page.goto(BASE + '/activity')
        cards = page.locator('.demand-activity .activity-card')
        expect(cards).to_have_count(2)
        before = len(routes)
        expect(page.locator('.demand-map')).to_have_count(0)
        expect(cards.first.get_by_text('Open', exact=True)).to_be_visible()
        cards.first.locator('.activity-open').click()
        expect(cards).to_have_count(1)
        expect(cards.first.get_by_text('Road path by', exact=False)).to_be_visible()
        expect(cards.first.get_by_text('Your route', exact=True)).to_be_visible()
        expect(cards.first.get_by_role('button', name='Withdraw post')).to_be_visible()
        assert len(routes) == before, 'Activity shares the same cached road path'
        page.screenshot(path=f'/tmp/request-map-activity-{width}.png', full_page=True)
        page.get_by_role('link', name='Back', exact=True).click()
        expect(cards).to_have_count(2)
        cards.nth(1).locator('.activity-open').click()
        expect(cards).to_have_count(1)
        expect(cards.first.get_by_text('Road path by', exact=False)).to_be_visible()
        expect(cards.first.get_by_text('Withdrawn', exact=True)).to_be_visible()
        expect(cards.first.get_by_role('button', name='Withdraw post')).to_have_count(0)
        page.get_by_role('link', name='Back', exact=True).click()
        expect(page.locator('.demand-map')).to_have_count(0)
        page.wait_for_timeout(400)
        assert not errors, errors
        assert not writes, writes
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        print(f'PASS {width}: road paths, cached toggles, failure/retry, one selected request, Activity/history, no writes/errors/overflow', flush=True)
        context.close()
    browser.close()
