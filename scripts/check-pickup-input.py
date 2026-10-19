"""Mocked browser regression: local frontend on 3090; no production API calls.
Run with Python Playwright. Screenshots go to /tmp for visual review.
"""
import json
from playwright.sync_api import sync_playwright, expect

origin = {'latitude': -33.87, 'longitude': 151.21, 'label': 'Town Hall'}
destination = {'latitude': -33.92, 'longitude': 151.25, 'label': 'Coogee'}
request = {'requestId': 'req', 'riderAlias': 'rider1234', 'status': 'ACCEPTED',
           'pickup': origin, 'destination': destination, 'createdAt': '2026-10-19T00:00:00Z',
           'requestedDepartureAt': '2026-10-19T00:00:00Z', 'directionFit': 'GOOD'}

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width in [320, 390, 1440]:
        context = browser.new_context(viewport={'width': width, 'height': 900},
                                      has_touch=width < 700, is_mobile=width < 700)
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        state = {'driver': True, 'status': 'ACCEPTED', 'reject': False, 'sent': []}

        def respond(route):
            path = route.request.url.split('/api/')[-1]
            ride = {'rideId': 'test-ride', 'status': state['status'], 'driverAlias': 'driver1234',
                    'priceAud': 5, 'scheduledDepartureAt': '2026-10-19T00:00:00Z',
                    'expiresAt': '2099-10-19T00:00:00Z',
                    'plannedRoute': {'origin': origin, 'destination': destination},
                    'requests': [request] if state['driver'] else [], 'paymentMethod': 'PAYID',
                    'payIdType': 'EMAIL', 'payId': 'driver@example.com',
                    'pickupEstablished': state['status'] == 'CO_RIDE_ACTIVE'}
            if not state['driver']:
                ride['request'] = request
                ride['coRideCode'] = '0123'
                if state['status'] == 'ACCEPTED':
                    ride.pop('payId')
                    ride.pop('payIdType')
            if path == 'rides/test-ride/co-ride/confirm':
                state['sent'].append(route.request.post_data_json)
                if state['reject']:
                    route.fulfill(status=400, json={'error': 'CO_RIDE_CODE_INVALID'})
                    return
                state['status'] = 'CO_RIDE_ACTIVE'
            if path == 'university/session':
                data = {'unikey': 'driver1234' if state['driver'] else 'rider1234', 'canAdmin': False}
            elif path == 'current':
                data = {'current': None, 'currents': []}
            elif path == 'history':
                data = {'driver': [], 'rider': []}
            elif path == 'route-preview':
                data = {'points': [origin, destination], 'durationSeconds': 600}
            elif path.startswith('rides/test-ride'):
                data = {'ride': ride, 'serverNow': '2026-10-19T01:00:00Z'}
            else:
                data = {}
            route.fulfill(status=200, content_type='application/json', body=json.dumps(data))

        page.route('**/*', lambda r: r.continue_() if r.request.url.startswith('http://127.0.0.1:3090') else r.abort())
        page.route('**/api/**', respond)
        page.goto('http://127.0.0.1:3090/activity/test-ride')
        digits = page.locator('.pickup-code-input input')
        expect(digits).to_have_count(4)
        button = page.get_by_role('button', name='CONFIRM PICKUP', exact=True)
        expect(button).to_be_disabled()
        for index, digit in enumerate('0123'):
            cell = digits.nth(index)
            if width < 700:
                cell.tap()
            else:
                cell.click()
            expect(cell).to_be_focused()
            bounds = cell.bounding_box()
            assert bounds['width'] >= 44 and bounds['height'] >= 48
            cell.press(digit)
            expect(digits.nth(min(index + 1, 3))).to_be_focused()
        assert digits.evaluate_all('(els) => els.map(e => e.value).join("")') == '0123'
        expect(button).to_be_enabled()
        # Tap a filled middle cell and replace, rather than append or move other digits.
        if width < 700:
            digits.nth(1).tap()
        else:
            digits.nth(1).click()
        page.keyboard.press('9')
        assert digits.evaluate_all('(els) => els.map(e => e.value).join("")') == '0923'
        digits.nth(2).press('Backspace')
        expect(button).to_be_disabled()
        digits.nth(2).press('Backspace')
        expect(digits.nth(1)).to_be_focused()
        expect(digits.nth(1)).to_have_value('')
        # Paste supports leading zero and strips separators, without submission.
        digits.nth(0).evaluate('''el => {
          const data = new DataTransfer(); data.setData('text', '0 1-23');
          el.dispatchEvent(new ClipboardEvent('paste', {clipboardData:data, bubbles:true}));
        }''')
        assert digits.evaluate_all('(els) => els.map(e => e.value).join("")') == '0123'
        digits.nth(3).press('ArrowLeft')
        expect(digits.nth(2)).to_be_focused()
        digits.nth(2).press('ArrowRight')
        expect(digits.nth(3)).to_be_focused()
        assert not state['sent']
        page.evaluate('window.dispatchEvent(new Event("cocowheels:ride-updated"))')
        page.wait_for_timeout(600)
        assert digits.evaluate_all('(els) => els.map(e => e.value).join("")') == '0123'
        expect(page.get_by_role('button', name='Copy PayID')).to_have_count(0)
        expect(page.locator('.driver-payment-details')).to_contain_text('driver@example.com')
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        page.screenshot(path=f'/tmp/gumwheel-pickup-driver-{width}.png', full_page=True)
        state['reject'] = True
        button.click()
        expect(page.locator('.cancel-prompt p')).to_have_text('That code doesn’t match. Try again.')
        page.get_by_role('button', name='OKAY', exact=True).click()
        assert digits.evaluate_all('(els) => els.map(e => e.value).join("")') == '0123'
        state['reject'] = False
        button.click()
        expect(digits).to_have_count(0)
        assert state['sent'] == [{'code': '0123'}, {'code': '0123'}]
        # Rider display and payment-copy action remain, including completed history.
        state.update(driver=False, status='ACCEPTED')
        page.reload()
        expect(page.locator('.pickup-code-display span')).to_have_count(4)
        expect(page.get_by_role('button', name='Copy PayID')).to_have_count(0)
        expect(page.get_by_text('Visible after pickup confirmation', exact=True)).to_be_visible()
        page.locator('.leaflet-container').wait_for()
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        page.screenshot(path=f'/tmp/gumwheel-pickup-rider-{width}.png', full_page=True)
        state['status'] = 'CO_RIDE_ACTIVE'
        page.reload()
        expect(page.get_by_role('button', name='Copy PayID')).to_have_count(1)
        page.evaluate('navigator.clipboard.writeText = async value => { window.copiedPayId = value; }')
        page.get_by_role('button', name='Copy PayID').click()
        expect(page.locator('.cancel-prompt p')).to_have_text('PayID copied.')
        assert page.evaluate('window.copiedPayId') == 'driver@example.com'
        page.get_by_role('button', name='OKAY', exact=True).click()
        page.screenshot(path=f'/tmp/gumwheel-payment-rider-{width}.png', full_page=True)
        for driver in [True, False]:
            state.update(driver=driver, status='COMPLETED')
            page.reload()
            expect(page.locator('.pickup-confirmation')).to_have_count(0)
            expect(page.get_by_role('button', name='Copy PayID')).to_have_count(0 if driver else 1)
        assert not errors, errors
        print(f'PASS {width}: taps, focus/advance, replacement, deletion, paste, leading zero, arrows, polling persistence, invalid/valid submission, role-specific Copy and history; no runtime errors')
        context.close()
    browser.close()
