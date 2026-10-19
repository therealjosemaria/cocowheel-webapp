"""Isolated local UI checks: Next on :3090, no real API/provider requests.
Run with a Python environment containing Playwright and system Chromium.
"""
from playwright.sync_api import sync_playwright, expect

pin = {'latitude': -33.87, 'longitude': 151.21, 'label': 'Town Hall'}
end = {'latitude': -33.92, 'longitude': 151.25, 'label': 'Coogee'}
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width in [320, 390, 1440]:
        for driver in [True, False]:
            context = browser.new_context(viewport={'width': width, 'height': 900}, reduced_motion='reduce' if width == 320 else 'no-preference')
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda e: errors.append(str(e)))
            state = {'accepted': driver, 'count': 2, 'signedIn': True}
            def respond(route):
                path = route.request.url.split('/api/')[-1].split('?')[0]
                if not state['signedIn']:
                    route.fulfill(status=401,json={'error': 'UNAUTHORIZED'})
                    return
                requests = [{'requestId': f'req{i}', 'riderAlias': f'rider{i}', 'status': 'PENDING',
                             'pickup': pin, 'destination': end, 'createdAt': '2026-10-19T00:00:00Z',
                             'requestedDepartureAt': '2026-10-19T00:00:00Z', 'directionFit': 'GOOD'} for i in range(state['count'])]
                ride = {'rideId': 'test-ride', 'driverAlias': 'driver1234', 'status': 'REQUESTED' if driver or not state['accepted'] else 'ACCEPTED',
                        'priceAud': 5, 'scheduledDepartureAt': '2026-10-19T00:00:00Z', 'expiresAt': '2099-10-19T00:00:00Z',
                        'plannedRoute': {'origin': pin, 'destination': end}, 'paymentMethod': 'PAYID', 'pickupEstablished': False}
                if driver: ride['requests'] = requests
                else:
                    ride['request'] = dict(requests[0], status='ACCEPTED' if state['accepted'] else 'PENDING')
                    if state['accepted']: ride['coRideCode'] = '1234'
                item = {'role': 'DRIVER' if driver else 'RIDER', 'ride': ride}
                if path == 'university/session': data = {'unikey': 'driver1234' if driver else 'rider0', 'canAdmin': False}
                elif path == 'current': data = {'current': item, 'currents': [item]}
                elif path == 'route-preview': data = {'points': [pin,end], 'durationSeconds': 600}
                elif path.startswith('rides/test-ride'): data = {'ride': ride}
                else: data = {}
                route.fulfill(status=200,json=data)
            page.route('**/*',lambda r: r.continue_() if r.request.url.startswith('http://127.0.0.1:3090') else r.abort())
            page.route('**/api/**',respond)
            page.goto('http://127.0.0.1:3090/help')
            if not driver:
                expect(page.locator('.profile-update-badge')).to_have_count(0)
                state['accepted'] = True
                page.evaluate("window.dispatchEvent(new Event('cocowheels:identity-changed'))")
            expect(page.locator('.profile-update-badge')).to_have_text('2' if driver else '1')
            page.get_by_role('button',name='Profile:',exact=False).click()
            card = page.locator('.profile-active-ride')
            expect(card).to_have_count(1)
            expect(card).to_contain_text('2 new rider requests' if driver else 'driver1234 accepted your request')
            # Opening Profile does not acknowledge anything.
            expect(page.locator('.profile-update-badge')).to_be_visible()
            expect(page.locator('#guest-identity-popover')).to_have_css('opacity','1')
            page.screenshot(path=f'/tmp/updates-profile-{width}-{driver}.png',full_page=True)
            page.goto('http://127.0.0.1:3090/activity/test-ride')
            if driver:
                notice = page.get_by_role('button',name='New rider request',exact=False)
                expect(notice).to_be_visible()
                assert page.evaluate('scrollY') == 0
                page.screenshot(path=f'/tmp/updates-notice-{width}.png',full_page=True)
                notice.click()
                expect(page.locator('#request-req0')).to_be_in_viewport()
                page.wait_for_function("JSON.parse(localStorage.getItem('cocowheels:seen-updates:v1:driver1234') || '[]').some(k=>k.includes(':req0:'))")
                page.locator('#request-req1').scroll_into_view_if_needed()
                expect(page.locator('.profile-update-badge')).to_have_count(0)
                expect(page.locator('.ride-update-notice')).to_have_count(0)
                assert page.locator('.request-arrived').count() == 2
                expect(page.locator('.request-arrived').first).to_have_css('animation-name', 'none' if width == 320 else 'request-arrival')
                page.screenshot(path=f'/tmp/updates-seen-{width}.png',full_page=True)
                page.reload()
                expect(page.locator('.profile-update-badge')).to_have_count(0)
                page.evaluate('scrollTo(0,0)')
                state['count'] = 3
                page.evaluate("window.dispatchEvent(new Event('cocowheels:identity-changed')); window.dispatchEvent(new Event('cocowheels:ride-updated'))")
                expect(page.locator('.profile-update-badge')).to_have_text('1')
                expect(notice).to_be_visible()
                assert page.evaluate('scrollY') == 0
                # The same existing card navigates to the specific unseen request.
                page.get_by_role('button',name='Profile:',exact=False).click()
                page.locator('.profile-active-ride').click()
                expect(page.locator('#request-req2')).to_be_in_viewport()
                expect(page.locator('.profile-update-badge')).to_have_count(0)
                # Authentication loss removes private unread information.
                page.goto('http://127.0.0.1:3090/help')
                state['count'] = 4
                page.evaluate("window.dispatchEvent(new Event('cocowheels:identity-changed'))")
                expect(page.locator('.profile-update-badge')).to_have_text('1')
                state['signedIn'] = False
                page.evaluate("window.dispatchEvent(new Event('cocowheels:identity-changed'))")
                expect(page.locator('.profile-update-badge')).to_have_count(0)
                expect(page.locator('.profile-active-ride')).to_have_count(0)
            else:
                expect(page.locator('.ride-update-notice')).to_have_count(0)
                page.locator('#pickup-test-ride').scroll_into_view_if_needed()
                expect(page.locator('.profile-update-badge')).to_have_count(0)
                page.screenshot(path=f'/tmp/updates-rider-{width}.png',full_page=True)
            assert not errors, errors
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            print('PASS', width, 'driver' if driver else 'rider',flush=True)
            context.close()
    browser.close()
