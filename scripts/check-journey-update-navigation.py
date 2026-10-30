"""Synthetic notification navigation, no live APIs or provider traffic; Next :3201."""
from playwright.sync_api import sync_playwright, expect

BASE = 'http://127.0.0.1:3201'
pin = {'latitude': -33.9, 'longitude': 151.2, 'label': 'Example origin, Sydney'}
end = dict(pin, latitude=-33.87, label='Example destination, Sydney')
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width in [320, 390, 844, 1440]:
        for scenario in ['offer', 'driver', 'accepted', 'multiple', 'none', 'reviewed-elsewhere']:
            context = browser.new_context(viewport={'width': width, 'height': 900}, reduced_motion='reduce' if width == 320 else 'no-preference')
            page = context.new_page()
            errors, writes = [], []
            page.on('pageerror', lambda error: errors.append(str(error)))
            state = {'signed_in': True, 'reviewed': ['demand-offer:offer-1'] if scenario == 'reviewed-elsewhere' else []}
            req = {'requestId': 'join-1', 'riderAlias': 'rider01', 'status': 'PENDING', 'pickup': pin,
                   'destination': end, 'createdAt': '2026-10-27T00:00:00Z', 'requestedDepartureAt': '2026-10-28T01:00:00Z', 'directionFit': 'GOOD'}
            ride = {'rideId': 'test-ride', 'driverAlias': 'driver01', 'status': 'REQUESTED', 'priceAud': 0,
                    'scheduledDepartureAt': '2026-10-28T01:00:00Z', 'expiresAt': '2099-10-28T01:00:00Z',
                    'plannedRoute': {'origin': pin, 'destination': end}, 'pickupEstablished': False}
            item = None
            if scenario == 'driver':
                ride['requests'] = [req, dict(req, requestId='join-2')]
                item = {'role': 'DRIVER', 'ride': ride}
            elif scenario in ['multiple', 'accepted']:
                ride['request'] = dict(req, status='ACCEPTED' if scenario == 'accepted' else 'PENDING')
                if scenario == 'accepted':
                    ride.update(status='ACCEPTED', coRideCode='1234')
                else:
                    ride['conversations'] = [{'requestId': 'join-1', 'unread': 2, 'peer': 'driver01', 'stopped': False}]
                item = {'role': 'RIDER', 'ride': ride}
            post = {'id': 'post-1', 'origin': pin, 'destination': end, 'date': 'any', 'time': '',
                    'status': 'FULFILLED' if scenario == 'accepted' else 'OPEN', 'expiresAt': '2099-10-28T01:00:00Z',
                    'offers': [{'id': 'offer-1', 'rideId': 'offered-ride', 'demandId': 'post-1', 'driverAlias': 'driver02',
                                'departureAt': '2026-10-28T01:00:00Z', 'priceAud': 0, 'status': 'PENDING'}] if scenario in ['offer', 'multiple', 'reviewed-elsewhere'] else []}
            page.route('**/*', lambda r: r.continue_() if r.request.url.startswith(BASE) else r.abort())
            def api(r):
                path = r.request.url.split('/api/')[-1].split('?')[0]
                if not state['signed_in']:
                    r.fulfill(status=401, json={'error': 'UNAUTHORIZED'}); return
                data = {}
                if path == 'university/session': data = {'unikey': 'tester01', 'ratings': {'driver': None, 'rider': None}}
                elif path == 'notifications/reviewed':
                    if r.request.method == 'POST':
                        state['reviewed'] = list(set(state['reviewed'] + r.request.post_data_json['keys']))
                    data = {'keys': state['reviewed']}
                elif path == 'current': data = {'current': item, 'currents': [item] if item else [],
                    'activeDemand': post if post['status'] == 'OPEN' else None, 'pendingDemandOffers': len(post['offers'])}
                elif path == 'history': data = {'driver': [], 'rider': []}
                elif path == 'rider-demands': data = {'requests': [post], 'sent': []}
                elif path == 'route-preview': data = {'points': [pin, end], 'durationSeconds': 600}
                elif path.startswith('rides/test-ride'): data = {'ride': ride}
                elif path.startswith('profile-photo/'):
                    r.fulfill(content_type='image/svg+xml', body='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#e2e8f0"/></svg>'); return
                if r.request.method == 'POST' and path != 'route-preview': writes.append(path)
                r.fulfill(json=data)
            page.route('**/api/**', api)
            page.goto(BASE + '/help')
            page.get_by_role('button', name='Profile:', exact=False).click()
            link = page.locator('.profile-active-ride')
            count = 2 if scenario == 'multiple' else 0 if scenario in ['none', 'reviewed-elsewhere'] else 1
            if count: expect(link).to_contain_text(f'{count} update' + ('s' if count > 1 else '') + ' to review')
            expected = {
                'offer': '/activity/requests/post-1#offer-offer-1',
                'driver': '/activity/test-ride#request-join-1',
                'accepted': '/activity/test-ride?request=join-1#pickup-test-ride',
                'multiple': '/activity#updates', 'none': '/activity', 'reviewed-elsewhere': '/activity',
            }[scenario]
            expect(link).to_have_attribute('href', expected)
            page.screenshot(path=f'/tmp/journey-updates-profile-{scenario}-{width}.png', full_page=True)
            if scenario != 'reviewed-elsewhere': assert not state['reviewed'], 'Opening Profile must not acknowledge updates'
            else: expect(page.locator('.profile-update-badge')).to_have_count(0)
            link.click()
            expect(page).to_have_url(BASE + expected)
            if scenario == 'multiple':
                markers = page.locator('.journey-update-marker')
                expect(markers).to_have_count(2)
                for marker in markers.all():
                    marker.scroll_into_view_if_needed()
                    expect(marker.locator('xpath=ancestor::article')).to_have_class('activity-card request-arrived')
                page.wait_for_timeout(900)
                expect(markers).to_have_count(2)  # summaries do not mark updates read
                page.screenshot(path=f'/tmp/journey-updates-activity-{width}.png', full_page=True)
                page.get_by_role('link', name='Details for journey requested', exact=False).click()
                expect(page).to_have_url(BASE + '/activity/requests/post-1#offer-offer-1')
                expect(page.get_by_role('button', name='Accept ride')).to_be_visible()
                expect(page.locator('.profile-update-badge')).to_have_text('1')
            elif scenario == 'offer':
                expect(page.get_by_role('button', name='Accept ride')).to_be_visible()
                expect(page.locator('.profile-update-badge')).to_have_count(0)
                page.reload()
                expect(page.get_by_role('button', name='Accept ride')).to_be_visible()
                expect(page.locator('.profile-update-badge')).to_have_count(0)
            elif scenario == 'driver':
                expect(page.locator('.driver-request-accordion').first).to_have_attribute('open', '')
                expect(page.locator('.driver-request-accordion').nth(1)).not_to_have_attribute('open', '')
            elif scenario == 'accepted':
                expect(page.locator('#pickup-test-ride')).to_be_visible()
                expect(page.locator('.profile-update-badge')).to_have_count(0)
            if scenario in ['offer', 'multiple']:
                expect(page.get_by_text('Road path by', exact=False)).to_be_visible()
            page.screenshot(path=f'/tmp/journey-updates-detail-{scenario}-{width}.png', full_page=True)
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            assert not errors, errors
            assert all(path == 'notifications/reviewed' for path in writes), writes
            if scenario in ['offer', 'accepted', 'multiple']: assert state['reviewed'], 'Visible detail must be acknowledged server-side'
            state['signed_in'] = False
            page.evaluate("window.dispatchEvent(new Event('cocowheels:identity-changed'))")
            expect(page.get_by_role('button', name='Profile: No guest name yet', exact=True)).to_be_visible()
            expect(page.locator('.profile-update-badge')).to_have_count(0)
            print(f'PASS {width} {scenario}: destination, grouping, review acknowledgements only, no errors/overflow, auth reset', flush=True)
            context.close()
    browser.close()
