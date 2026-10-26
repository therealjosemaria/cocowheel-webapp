"""Profile journey grouping checks; localhost UI, mocked APIs, no external traffic."""
from playwright.sync_api import sync_playwright, expect

BASE = 'http://127.0.0.1:3201'
pin = {'latitude': -33.9, 'longitude': 151.2, 'label': 'Example suburb'}
post = {'id': 'post-1', 'origin': pin, 'destination': pin, 'status': 'OPEN', 'date': 'any', 'time': '', 'expiresAt': '2099-10-28T01:00:00Z'}
ride = {'rideId': 'COCO-TEST123', 'status': 'REQUESTED', 'driverAlias': 'driver01',
        'priceAud': 0, 'plannedRoute': {'origin': pin, 'destination': pin},
        'request': {'requestId': 'join-1', 'status': 'PENDING', 'pickup': pin, 'destination': pin}}
cases = [
    ('post', None, post, 0, 1),
    ('pending-post', {'role': 'RIDER', 'ride': ride}, post, 0, 1),
    ('post-offer', None, post, 1, 1),
    ('legacy-offer', None, None, 1, 1),
    ('confirmed', {'role': 'RIDER', 'ride': dict(ride, status='ACCEPTED', pickupEstablished=True,
      request=dict(ride['request'], status='ACCEPTED'))}, None, 0, 1),
    ('driver', {'role': 'DRIVER', 'ride': dict(ride, status='PUBLISHED', request=None)}, None, 0, 1),
    ('messages-offer', {'role': 'RIDER', 'ride': dict(ride,
      conversations=[{'requestId': 'join-1', 'unread': 2}])}, post, 1, 1),
]
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width in [320, 390, 844, 1440]:
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
                elif path == 'history':
                    data = {'driver': [], 'rider': []}
                elif path == 'rider-demands':
                    data = {'requests': [dict(post, offers=[{'id': 'offer-1', 'rideId': 'COCO-OFFER', 'status': 'PENDING',
                        'driverAlias': 'driver02', 'departureAt': '2099-10-28T01:00:00Z', 'priceAud': 0}])] if offers else [], 'sent': []}
                r.fulfill(json=data)
            page.route('**/api/**', api)
            page.goto(BASE + '/?start=rider')
            button = page.get_by_role('button', name='Profile:', exact=False)
            notifications = offers + (1 if name == 'messages-offer' else 0)
            expect(button).to_have_attribute('aria-label', 'Profile: tester01' + (f', {notifications} updates' if notifications else ''))
            button.click()
            region = page.get_by_role('region', name='Your journeys', exact=True)
            expect(region.locator('a')).to_have_count(count)
            journey_link = region.get_by_role('link', name='Your journeys', exact=False)
            expect(journey_link).to_have_count(1)
            expected = '/activity#updates' if notifications > 1 else '/activity/requests/post-1#offer-offer-1' if offers else '/activity'
            expect(journey_link).to_have_attribute('href', expected)
            if notifications:
                expect(region.get_by_text(f'{notifications} update' + ('s' if notifications != 1 else '') + ' to review')).to_be_visible()
            page.wait_for_timeout(250)
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            page.screenshot(path=f'/tmp/profile-post-{name}-{width}.png', full_page=True)
            journey_link.click()
            expect(page).to_have_url(BASE + expected)
            expect(region).not_to_be_visible()
            if expected.startswith('/activity/requests/'):
                expect(page.get_by_role('button', name='Accept ride', exact=True)).to_be_visible()
            else:
                expect(page.get_by_role('heading', name='Activity', exact=True)).to_be_visible()
            page.wait_for_timeout(350)
            assert not errors, errors
            print(f'PASS {width} {name}: grouping, badge, cards, no overflow/errors', flush=True)
            context.close()
    browser.close()
