"""Local mocked UI check. Start Next on 3090 with an unreachable API target.
Uses system Chromium + Python Playwright; no external requests or live data.
"""
import json
from playwright.sync_api import sync_playwright, expect

origin = {'latitude': -33.87, 'longitude': 151.21, 'label': 'Town Hall'}
destination = {'latitude': -33.92, 'longitude': 151.25, 'label': 'Coogee'}
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width in [320, 390, 1440]:
        for driver in [True, False]:
            context = browser.new_context(viewport={'width': width, 'height': 900}, has_touch=width < 700, is_mobile=width < 700)
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            state = {'submitted': False, 'fail': True, 'sent': []}

            def respond(route):
                path = route.request.url.split('/api/')[-1]
                rating = {'canRate': not state['submitted'], 'submitted': state['submitted'], 'targetRole': 'RIDER' if driver else 'DRIVER', 'closesAt': '2099-10-19T00:00:00Z'}
                ride = {'rideId': 'test-ride', 'status': 'COMPLETED', 'driverAlias': 'driver1234', 'driverRating': {'average': 4.8, 'count': 5},
                        'priceAud': 5, 'scheduledDepartureAt': '2026-10-19T00:00:00Z', 'expiresAt': '2099-10-19T00:00:00Z',
                        'completedAt': '2026-10-19T01:00:00Z', 'plannedRoute': {'origin': origin, 'destination': destination},
                        'paymentMethod': 'PAYID', 'payIdType': 'EMAIL', 'payId': 'driver@example.com', 'pickupEstablished': True, 'rating': rating}
                request = {'requestId': 'req', 'riderAlias': 'rider1234', 'status': 'ACCEPTED', 'pickup': origin, 'destination': destination,
                           'createdAt': '2026-10-19T00:00:00Z', 'requestedDepartureAt': '2026-10-19T00:00:00Z', 'directionFit': 'GOOD'}
                if driver:
                    ride['rider'] = {'alias': 'rider1234', 'pickup': origin, 'destination': destination, 'requestedDepartureAt': request['requestedDepartureAt'], 'directionFit': 'GOOD'}
                else:
                    ride['request'] = request
                if path.startswith('profile-photo/'):
                    route.fulfill(content_type='image/svg+xml', body='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#e2e8f0"/></svg>')
                    return
                if path == 'rides/test-ride/ratings':
                    state['sent'].append(route.request.post_data_json)
                    if state['fail']:
                        route.fulfill(status=503, json={'error': 'SERVICE_UNAVAILABLE'})
                        return
                    state['submitted'] = True
                    rating['submitted'] = True
                    rating['canRate'] = False
                    data = {'rating': rating}
                elif path == 'university/session':
                    data = {'unikey': 'driver1234' if driver else 'rider1234', 'canAdmin': False, 'ratings': {'driver': {'average': 4.8, 'count': 5} if driver else None, 'rider': None if driver else {'average': 4.8, 'count': 5}}}
                elif path == 'current': data = {'current': None, 'currents': []}
                elif path == 'history': data = {'driver': [], 'rider': []}
                elif path == 'route-preview': data = {'points': [origin, destination], 'durationSeconds': 600}
                elif path.startswith('rides/test-ride'): data = {'ride': ride, 'serverNow': '2026-10-19T01:00:00Z'}
                else: data = {}
                route.fulfill(status=200, json=data)

            page.route('**/*', lambda r: r.continue_() if r.request.url.startswith('http://127.0.0.1:3090') else r.abort())
            page.route('**/api/**', respond)
            page.goto('http://127.0.0.1:3090/activity/test-ride')
            stars = page.get_by_role('button', name='Rate ', exact=False)
            expect(stars).to_have_count(5)
            expect(page.get_by_role('button', name='Submit rating', exact=True)).to_have_count(0)
            expect(page.locator('.ride-rating')).not_to_contain_text('Optional')
            expect(page.locator('.ride-rating')).not_to_contain_text('Only averages')
            for i in range(5):
                bounds = stars.nth(i).bounding_box()
                # Browser float geometry can report 43.99994 for a 44px target.
                assert bounds['width'] >= 43.99 and bounds['height'] >= 43.99, bounds
            page.locator('.ride-rating').scroll_into_view_if_needed()
            page.screenshot(path=f'/tmp/gumwheel-rating-{width}-{"driver" if driver else "rider"}.png', full_page=True)
            star = page.get_by_role('button', name='Rate 4 stars', exact=True)
            star.focus()
            assert state['sent'] == []
            if width < 700: star.tap()
            else: star.press('Enter')
            expect(page.get_by_role('dialog')).to_be_visible()
            page.get_by_role('button', name='OKAY', exact=True).click()
            expect(star).to_have_attribute('aria-pressed', 'true')
            state['fail'] = False
            star.click()
            expect(page.get_by_text('Thanks for rating your ride.', exact=True)).to_be_visible()
            assert state['sent'] == [{'score': 4}, {'score': 4}]
            page.reload()
            expect(page.get_by_text('Thanks for rating your ride.', exact=True)).to_be_visible()
            expect(stars).to_have_count(0)
            page.get_by_role('button', name='Profile:', exact=False).click()
            expect(page.get_by_text('As a driver', exact=False)).to_be_visible()
            expect(page.locator('.profile-ratings > div').nth(0 if driver else 1).get_by_label('4.8 out of 5 from 5 ratings', exact=True)).to_be_visible()
            expect(page.get_by_text('Not enough ratings yet', exact=True)).to_be_visible()
            expect(page.locator('#guest-identity-popover')).to_have_css('opacity', '1')
            profile_bounds = page.locator('#guest-identity-popover').bounding_box()
            assert profile_bounds['x'] >= 0 and profile_bounds['x'] + profile_bounds['width'] <= width
            page.screenshot(path=f'/tmp/gumwheel-rating-profile-{width}-{"driver" if driver else "rider"}.png')
            assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
            assert errors == [], errors
            context.close()
            print(f'PASS {width}px {"driver" if driver else "rider"}: select, error, retry, persist, touch targets, no overflow')
    browser.close()
