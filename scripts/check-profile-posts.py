"""Profile journey grouping checks; localhost UI, mocked APIs, no external traffic."""
from playwright.sync_api import sync_playwright, expect

BASE = 'http://127.0.0.1:3201'
pin = {'latitude': -33.9, 'longitude': 151.2, 'label': 'Example suburb'}
post = {'id': 'post-1', 'origin': pin, 'destination': pin, 'status': 'OPEN'}
ride = {'rideId': 'COCO-TEST123', 'status': 'REQUESTED', 'driverAlias': 'driver01',
        'priceAud': 0, 'plannedRoute': {'origin': pin, 'destination': pin},
        'request': {'requestId': 'join-1', 'status': 'PENDING', 'pickup': pin, 'destination': pin}}
cases = [
    ('post', None, post, 0, 1),
    ('pending-post', {'role': 'RIDER', 'ride': ride}, post, 0, 2),
    ('post-offer', None, post, 1, 1),
    ('legacy-offer', None, None, 1, 1),
    ('confirmed', {'role': 'RIDER', 'ride': dict(ride, status='ACCEPTED', pickupEstablished=True,
      request=dict(ride['request'], status='ACCEPTED'))}, None, 0, 1),
    ('driver', {'role': 'DRIVER', 'ride': dict(ride, status='PUBLISHED', request=None)}, None, 0, 1),
]
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width in [390, 1440]:
        for name, current, active, offers, count in cases:
            context = browser.new_context(viewport={'width': width, 'height': 900})
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.route('**/*', lambda r: r.continue_() if r.request.url.startswith(BASE) else r.abort())
            def api(r):
                path = r.request.url.split('/api/')[-1].split('?')[0]
                data = {}
                if path.startswith('profile-photo/'):
                    r.fulfill(content_type='image/svg+xml', body='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#f1f5f9"/><circle cx="12" cy="8" r="3" fill="#64748b"/><path d="M5 22v-3a7 7 0 0 1 14 0v3" fill="#64748b"/></svg>')
                    return
                if path == 'university/session':
                    data = {'unikey': 'tester01', 'ratings': {'driver': None, 'rider': None}}
                elif path == 'current':
                    data = {'current': current, 'currents': [current] if current else [],
                            'activeDemand': active, 'pendingDemandOffers': offers}
                r.fulfill(json=data)
            page.route('**/api/**', api)
            page.goto(BASE + '/?start=rider')
            button = page.get_by_role('button', name='Profile:', exact=False)
            expect(button).to_have_attribute('aria-label', 'Profile: tester01' + (', 1 updates' if offers else ''))
            button.click()
            region = page.get_by_role('region', name='Your rides', exact=True)
            expect(region.locator('a')).to_have_count(count)
            expect(region.get_by_role('link', name='Your post', exact=False)).to_have_count(1 if active else 0)
            if offers:
                expect(region.get_by_text('1 ride offer to review')).to_be_visible()
            page.wait_for_timeout(250)
            if count == 2:
                first, second = [region.locator('a').nth(i).bounding_box() for i in [0, 1]]
                assert abs(second['y'] - first['y'] - first['height'] - 12) < 1
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            page.screenshot(path=f'/tmp/profile-post-{name}-{width}.png', full_page=True)
            assert not errors, errors
            print(f'PASS {width} {name}: grouping, badge, cards, no overflow/errors', flush=True)
            context.close()
    browser.close()
