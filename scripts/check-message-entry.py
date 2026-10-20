"""Mocked request-to-message checks. Isolated Next server on :3090."""
import json
from datetime import datetime, timedelta, timezone
from playwright.sync_api import sync_playwright, expect

pin = {'latitude': -33.87, 'longitude': 151.21, 'label': 'Town Hall'}
end = {'latitude': -33.92, 'longitude': 151.25, 'label': 'Coogee'}
starter = 'Hi! Where should we meet, and what’s your car’s number plate?'
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width in [320, 393, 1440]:
        for preview in [False, True]:
            context = browser.new_context(viewport={'width': width, 'height': 900})
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda e: errors.append(str(e)))
            state = {'requested': False, 'fail': True, 'sends': 0}
            req = {'requestId': 'req0', 'riderAlias': 'ride1234', 'status': 'PENDING', 'pickup': pin, 'destination': end, 'createdAt': '2026-10-20T00:00:00Z', 'requestedDepartureAt': '2026-10-20T00:00:00Z', 'directionFit': 'GOOD'}
            base = {'rideId': 'test-ride', 'driverAlias': 'driv1234', 'status': 'PUBLISHED', 'priceAud': 5, 'scheduledDepartureAt': '2026-10-20T00:00:00Z', 'expiresAt': '2099-10-20T00:00:00Z', 'plannedRoute': {'origin': pin, 'destination': end}, 'paymentMethod': 'PAYID', 'pickupEstablished': False}
            base['driverLocation'] = dict(pin, capturedAt=(datetime.now(timezone.utc)-timedelta(minutes=57)).isoformat(), moving=False, stale=True, accuracyMeters=10)
            def respond(route):
                path = route.request.url.split('/api/')[-1].split('?')[0]
                ride = dict(base)
                if state['requested']:
                    ride.update(status='REQUESTED', request=req, conversations=[{'requestId': 'req0', 'peer': 'driv1234', 'unread': 0, 'stopped': False}])
                if path.endswith('/requests'):
                    if state['fail']:
                        state['fail'] = False
                        route.fulfill(status=503, json={'error': 'UNAVAILABLE'})
                        return
                    state['requested'] = True
                    ride.update(status='REQUESTED', request=req)
                    data = {'ride': ride}
                elif '/conversations/' in path:
                    if route.request.method == 'POST': state['sends'] += 1
                    data = {'messages': [], 'stopped': False}
                elif path == 'university/session': data = {'unikey': 'ride1234', 'canAdmin': False}
                elif path == 'current': data = {'current': None, 'currents': []}
                elif path == 'search': data = {'candidates': [dict(base, directionFit='GOOD', redactedCorridor=[pin, end], pickupDistanceMeters=200, destinationDistanceMeters=200, isOwnOffer=False, departureLabel='Town Hall', destinationLabel='Coogee')], 'serverNow': '2026-10-20T00:00:00Z'}
                elif path == 'route-preview': data = {'points': [pin, end], 'durationSeconds': 600}
                elif path.startswith('rides/test-ride'): data = {'ride': ride}
                else: data = {}
                route.fulfill(status=200, json=data)
            page.route('**/*', lambda r: r.continue_() if r.request.url.startswith('http://127.0.0.1:3090') else r.abort())
            page.route('**/api/**', respond)
            page.add_init_script('sessionStorage.setItem("cocowheels:find-ride-draft:v1", JSON.stringify({...'+json.dumps({'pickup': pin, 'destination': end, 'departureAt': None})+', savedAt: Date.now()})); sessionStorage.setItem("cocowheels:ride-preview:v1:test-ride", '+json.dumps(json.dumps({'pickup': pin, 'destination': end, 'directionFit': 'GOOD'}))+');')
            page.goto('http://127.0.0.1:3090'+('/rides/test-ride' if preview else '/?start=rider'))
            hint = page.get_by_text('You can message the driver after requesting.', exact=True)
            expect(hint).to_be_visible()
            button = page.get_by_role('button', name='REQUEST TO JOIN', exact=True)
            expect(button).to_be_enabled()
            expect(page.locator('.driver-location-age')).to_contain_text('Driver · Updated 57 min ago')
            labels = page.locator('.ride-selection-route-key > span')
            for label in labels.all():
                assert label.evaluate('(el) => el.getBoundingClientRect().height <= 20')
            if width < 600:
                assert page.locator('.driver-location-age').bounding_box()['y'] < labels.first.bounding_box()['y']
            page.screenshot(path=f'/tmp/message-entry-{width}-{preview}.png', full_page=True)
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            button.click()
            expect(page.get_by_role('button', name='OKAY', exact=True)).to_be_visible()
            assert '/activity/' not in page.url
            page.get_by_role('button', name='OKAY', exact=True).click()
            button.click()
            textbox = page.locator('#messages-req0').get_by_role('textbox', name='Message', exact=True)
            expect(textbox).to_have_value(starter, timeout=15000)
            assert 'request=req0' in page.url and 'compose=' not in page.url
            assert state['sends'] == 0
            expect(page.get_by_role('link', name='Report a concern via WhatsApp')).to_have_count(1)
            support = page.get_by_role('link', name='Report a concern via WhatsApp')
            assert support.get_attribute('href').startswith('https://wa.me/61452340432?text=')
            assert support.get_attribute('target') == '_blank'
            assert support.get_attribute('rel') == 'noopener noreferrer'
            expect(page.get_by_text('Opens email. Not an emergency service.', exact=True)).to_have_count(0)
            expect(page.get_by_role('link', name='Ride actions', exact=True)).to_have_count(0)
            report_size = page.get_by_role('link', name='Report a concern via WhatsApp').evaluate('(el) => getComputedStyle(el).fontSize')
            assert report_size == page.locator('.footer-legal a').first.evaluate('(el) => getComputedStyle(el).fontSize') == '12px'
            expect(page.locator('#messages-req0').get_by_role('link', name='Report a concern via WhatsApp')).to_have_count(0)
            legend = page.locator('.ride-selection-route-key').bounding_box()
            summary = page.locator('.ride-preview-summary').bounding_box()
            assert summary['y'] - (legend['y'] + legend['height']) >= 12
            assert page.evaluate('window.scrollY') < 100
            textbox.fill('Where should I wait?')
            page.evaluate("window.dispatchEvent(new Event('cocowheels:current-updated'))")
            expect(textbox).to_have_value('Where should I wait?')
            page.screenshot(path=f'/tmp/message-entry-detail-{width}-{preview}.png', full_page=True)
            page.reload()
            expect(page.locator('#messages-req0')).not_to_have_attribute('open', '')
            if not preview:
                for legal in ['privacy', 'terms']:
                    page.goto('http://127.0.0.1:3090/'+legal)
                    expect(page.get_by_text('Report a concern via WhatsApp', exact=False)).to_be_visible()
                    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
                    page.screenshot(path=f'/tmp/whatsapp-{legal}-{width}.png', full_page=True)
            assert not errors, errors
            print(f'PASS {width}px {"preview" if preview else "chooser"}: failure, request, editable draft, no auto-send, no scroll, reload')
            context.close()
    browser.close()
