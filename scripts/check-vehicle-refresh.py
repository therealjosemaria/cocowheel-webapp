"""Built :3201; two synthetic tabs, mocked APIs, no production data or writes.
Run: /tmp/gumwheel-notification-check-env/bin/python scripts/check-vehicle-refresh.py
Periodic 8-second polling is suspended so it cannot mask a missing notification.
"""
from datetime import datetime, timezone
from playwright.sync_api import sync_playwright, expect

BASE = 'http://127.0.0.1:3201'
ORIGIN = {'latitude': -33.918, 'longitude': 151.204, 'label': 'Example origin, Sydney'}
END = {'latitude': -33.889, 'longitude': 151.187, 'label': 'Example destination, Sydney'}

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width, broadcast in [(320, True), (390, True), (1440, True), (390, False)]:
        context = browser.new_context(viewport={'width': width, 'height': 900})
        state = {'vehicle': None, 'snapshot': None, 'status': 'PUBLISHED', 'fail': False, 'hold': False}
        held, errors = [], []
        def api(route):
            path = route.request.url.split('/api/')[-1].split('?')[0]
            ride = {'rideId': 'refresh-test', 'driverAlias': 'driver01', 'status': state['status'],
                    'scheduledDepartureAt': datetime.now(timezone.utc).isoformat(),
                    'expiresAt': '2099-01-01T00:00:00Z', 'priceAud': 0,
                    'plannedRoute': {'origin': ORIGIN, 'destination': END},
                    'vehicle': state['snapshot'] or state['vehicle'], 'requests': []}
            if path == 'vehicle':
                if route.request.method == 'POST':
                    if state['status'] in ['ACCEPTED', 'RIDE_ACTIVE', 'CO_RIDE_ACTIVE']:
                        route.fulfill(status=409, json={'error': 'VEHICLE_IN_USE'}); return
                    if state['fail']:
                        route.fulfill(status=400, json={'error': 'INVALID_VEHICLE'}); return
                    state['vehicle'] = route.request.post_data_json
                data = {'vehicle': state['vehicle']}
            elif path == 'university/session': data = {'unikey': 'tester01'}
            elif path == 'profile': data = {'username': 'tester01', 'email': 'synthetic@example.com', 'photoUrl': None}
            elif path == 'current': data = {'current': None, 'currents': []}
            elif path == 'usual-route': data = {'route': None, 'alertsAvailable': True}
            elif path == 'rides/refresh-test':
                data = {'ride': ride}
                if state['hold']:
                    state['hold'] = False; held.append((route, data)); return
            elif path == 'history': data = {'driver': [ride], 'rider': []}
            elif path == 'route-preview': data = {'points': [ORIGIN, END], 'durationSeconds': 600}
            elif path == 'rider-demands': data = {'requests': [], 'sent': []}
            else: data = {}
            route.fulfill(json=data)
        context.route('**/*', lambda r: r.continue_() if r.request.url.startswith(BASE) else r.abort())
        context.route('**/api/**', api)
        context.add_init_script('const originalTimeout=window.setTimeout;window.setTimeout=(fn,ms,...args)=>ms===8000?0:originalTimeout(fn,ms,...args)')
        if not broadcast: context.add_init_script('window.BroadcastChannel=undefined')
        journey = context.new_page(); journey.on('pageerror', lambda e: errors.append(str(e)))
        journey.goto(BASE + '/activity/refresh-test')
        expect(journey.locator('.journey-marker-model .journey-role-art-driver')).to_be_visible()
        profile = context.new_page(); profile.on('pageerror', lambda e: errors.append(str(e)))
        profile.goto(BASE + '/usual-route')
        profile.evaluate("window.vehicleSaves=0;window.addEventListener('cocowheels:vehicle-saved',()=>window.vehicleSaves++)")
        details = profile.locator('.vehicle-details'); details.locator('summary').click()
        details.get_by_label('Number plate (required)', exact=True).fill('ABC123')
        for label, value in [('Make', 'Ford'), ('Model', 'ford-ranger'), ('Year', '2025'), ('Colour', 'Black')]:
            details.get_by_label(label, exact=True).select_option(value)
        save = details.get_by_role('button', name='Save vehicle details', exact=True)
        save.click(); expect(details.get_by_role('status')).to_be_visible()
        assert profile.evaluate('window.vehicleSaves') == 1
        marker = journey.locator('.vehicle-artwork-marker')
        if not broadcast: journey.evaluate("window.dispatchEvent(new Event('focus'))")
        expect(marker).to_have_attribute('src', '/brand/vehicles/v1/ford-ranger-black.webp', timeout=2000)
        if broadcast:
            # Older in-flight polls must not undo a newer save/refresh response.
            state['hold'] = True
            journey.evaluate("window.dispatchEvent(new Event('cocowheels:ride-updated'))")
            journey.wait_for_timeout(100)
            assert len(held) == 1
        details.get_by_label('Colour', exact=True).select_option('Blue')
        state['fail'] = True
        save.click(); expect(details.get_by_role('alert')).to_be_visible()
        assert profile.evaluate('window.vehicleSaves') == 1
        expect(marker).to_have_attribute('src', '/brand/vehicles/v1/ford-ranger-black.webp')
        state['fail'] = False
        save.click(); expect(details.get_by_role('status')).to_be_visible()
        if not broadcast: journey.evaluate("window.dispatchEvent(new Event('pageshow'))")
        expect(marker).to_have_attribute('src', '/brand/vehicles/v1/ford-ranger-blue.webp', timeout=2000)
        if held:
            route, data = held.pop(); route.fulfill(json=data)
            journey.wait_for_timeout(150)
            expect(marker).to_have_attribute('src', '/brand/vehicles/v1/ford-ranger-blue.webp')
        journey.screenshot(path=f'/tmp/vehicle-refresh-published-{width}.png', full_page=True)
        # Accepted trips keep the server's immutable snapshot after Profile edits.
        state['snapshot'] = state['vehicle']; state['status'] = 'ACCEPTED'
        journey.evaluate("window.dispatchEvent(new Event('cocowheels:ride-updated'))")
        details.get_by_label('Colour', exact=True).select_option('Red')
        prior_saves = profile.evaluate('window.vehicleSaves')
        expect(save).to_be_enabled()
        save.click()
        dialog = profile.get_by_role('dialog', name='Vehicle update', exact=True)
        expect(dialog).to_be_visible()
        expect(dialog.locator('p')).to_have_text('You can update your vehicle after your current journey ends.')
        expect(dialog.locator('h1,h2,h3')).to_have_count(0)
        assert profile.evaluate('window.vehicleSaves') == prior_saves
        assert state['vehicle']['colour'] == 'Blue'
        profile.screenshot(path=f'/tmp/vehicle-save-locked-{width}.png', full_page=True)
        dialog.get_by_role('button', name='OKAY', exact=True).click()
        expect(details.get_by_label('Colour', exact=True)).to_have_value('Red')
        expect(save).to_be_enabled()
        journey.evaluate("window.dispatchEvent(new Event('focus'))")
        expect(marker).to_have_attribute('src', '/brand/vehicles/v1/ford-ranger-blue.webp')
        state['snapshot'] = None; state['status'] = 'PUBLISHED'
        details.get_by_label('Colour', exact=True).select_option('other')
        details.get_by_label('Other colour', exact=True).fill('Teal')
        save.click(); expect(details.get_by_role('status')).to_be_visible()
        journey.evaluate("window.dispatchEvent(new Event('cocowheels:vehicle-saved'))")
        expect(journey.locator('.journey-marker-model .journey-role-art-driver')).to_be_visible(timeout=2000)
        expect(marker).to_have_count(0)
        assert journey.evaluate('document.documentElement.scrollWidth<=innerWidth')
        assert profile.evaluate('document.documentElement.scrollWidth<=innerWidth')
        assert not errors, errors
        print(f'PASS {width}px broadcast={broadcast}: immediate save, failed save, stale response, snapshot, generic fallback, focus/return', flush=True)
        context.close()
    browser.close()
