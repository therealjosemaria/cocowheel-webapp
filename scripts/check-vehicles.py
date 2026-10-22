"""Mocked mobile/desktop vehicle UI; local :3090, external requests blocked."""
from datetime import datetime, timezone
from playwright.sync_api import sync_playwright, expect

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width in [320, 390, 1440]:
        page = browser.new_page(viewport={'width': width, 'height': 900})
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        state = {'vehicle': None, 'accepted': False, 'role': 'DRIVER', 'fail': False}
        origin = {'latitude': -33.88, 'longitude': 151.2, 'label': 'Town Hall, Sydney'}
        end = {'latitude': -33.9, 'longitude': 151.25, 'label': 'University of Sydney'}
        now = datetime.now(timezone.utc).isoformat()
        def respond(r):
            path = r.request.url.split('/api/')[-1].split('?')[0]
            request = {'requestId': 'req1', 'status': 'ACCEPTED' if state['accepted'] else 'PENDING', 'pickup': origin, 'destination': end, 'riderAlias': 'ride1234', 'createdAt': now, 'requestedDepartureAt': now, 'directionFit': 'GOOD'}
            ride = {'rideId': 'vehicle-test', 'driverAlias': 'driv1234', 'status': 'ACCEPTED' if state['accepted'] else 'REQUESTED', 'scheduledDepartureAt': now, 'expiresAt': '2099-01-01T00:00:00Z', 'priceAud': 0, 'plannedRoute': {'origin': origin, 'destination': end}, 'pickupEstablished': False}
            if state['role'] == 'DRIVER': ride['requests'] = [request]
            else: ride.update(request=request, coRideCode='1234')
            if state['accepted']: ride['vehicle'] = state['vehicle']
            item = {'role': state['role'], 'ride': ride}
            if path == 'vehicle':
                if r.request.method == 'POST': state['vehicle'] = r.request.post_data_json
                data = {'vehicle': state['vehicle']}
            elif path == 'usual-route': data = {'route': None, 'alertsAvailable': True}
            elif path == 'university/session': data = {'unikey': 'driv1234' if state['role'] == 'DRIVER' else 'ride1234'}
            elif path == 'current': data = {'current': item, 'currents': [item]}
            elif path == 'route-preview': data = {'points': [origin, end], 'durationSeconds': 600}
            elif path.endswith('/requests/req1'):
                body = r.request.post_data_json
                if not body.get('plate'):
                    r.fulfill(status=409, json={'error': 'VEHICLE_PLATE_REQUIRED'}); return
                if state['fail']:
                    state['fail'] = False
                    r.fulfill(status=503, json={'error': 'UNAVAILABLE'}); return
                state.update(accepted=True, vehicle={'plate': body['plate'], 'make': '', 'model': '', 'colour': ''})
                data = {'ride': dict(ride, status='ACCEPTED', vehicle=state['vehicle'])}
            elif path.startswith('rides/'): data = {'ride': ride}
            else: data = {}
            r.fulfill(json=data)
        page.route('**/*', lambda r: r.continue_() if r.request.url.startswith('http://127.0.0.1:3090') else r.abort())
        page.route('**/api/**', respond)
        page.goto('http://127.0.0.1:3090/usual-route')
        usual = page.locator('.usual-route-disclosure')
        expect(usual).not_to_have_attribute('open', '')
        expect(usual.get_by_placeholder('Where from?', exact=True)).not_to_be_visible()
        usual.locator('summary').click()
        usual.get_by_placeholder('Where from?', exact=True).fill('Unfinished origin')
        usual.locator('summary').click()
        expect(usual.get_by_placeholder('Where from?', exact=True)).not_to_be_visible()
        details = page.locator('.vehicle-details')
        expect(details).to_be_visible()
        expect(details.locator('summary')).to_have_text('Vehicle details (drivers only)')
        expect(details).not_to_have_attribute('open', '')
        details.locator('summary').click()
        expect(details.get_by_role('button', name='Save vehicle details')).to_have_class('primary')
        expect(details.get_by_label('Number plate (required)')).to_have_attribute('required', '')
        for label, value in [('Number plate (required)', 'ABC123'), ('Make', 'Toyota'), ('Model', 'Corolla'), ('Colour', 'White')]:
            details.get_by_label(label, exact=True).fill(value)
        details.get_by_role('button', name='Save vehicle details', exact=True).click()
        expect(details.get_by_text('Vehicle details saved.')).to_be_visible()
        page.screenshot(path=f'/tmp/vehicle-profile-{width}.png', full_page=True)
        usual.locator('summary').click()
        expect(usual.get_by_placeholder('Where from?', exact=True)).to_have_value('Unfinished origin')
        expect(details).to_have_attribute('open', '')
        page.screenshot(path=f'/tmp/profile-expanded-{width}.png', full_page=True)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        state['vehicle'] = None  # Exercise a driver who has not saved a plate.
        page.goto('http://127.0.0.1:3090/activity/vehicle-test')
        page.locator('.driver-request-accordion > summary').click()
        page.get_by_role('button', name='ACCEPT RIDER', exact=True).click()
        dialog = page.get_by_role('dialog', name='Add your number plate')
        expect(dialog).to_be_visible()
        dialog.get_by_role('button', name='Go back').click()
        assert not state['accepted']
        page.get_by_role('button', name='ACCEPT RIDER', exact=True).click()
        dialog.get_by_label('Number plate (required)').fill('xyz123')
        expect(dialog.get_by_label('Number plate (required)')).to_have_value('XYZ123')
        page.screenshot(path=f'/tmp/vehicle-prompt-{width}.png', full_page=True)
        state['fail'] = True
        dialog.get_by_role('button', name='Save & accept').click()
        expect(dialog.get_by_role('alert')).to_be_visible()
        assert not state['accepted']
        expect(dialog.get_by_label('Number plate (required)')).to_have_value('XYZ123')
        with page.expect_navigation(wait_until='load'):
            dialog.get_by_role('button', name='Save & accept').click()
        expect(dialog).not_to_be_visible()
        assert state['accepted']
        state['role'] = 'RIDER'
        page.reload()
        expect(page.locator('.ride-vehicle')).to_contain_text('XYZ123')
        page.screenshot(path=f'/tmp/vehicle-rider-{width}.png', full_page=True)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        assert not errors, errors
        print(f'PASS {width}px: profile, save, cancel acceptance, failure retry, accepted rider vehicle')
        page.close()
    browser.close()
