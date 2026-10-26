"""Real consent/replacement modal layouts with mocked APIs; no production writes."""
import copy
import json
from playwright.sync_api import sync_playwright, expect

BASE = 'http://127.0.0.1:3201'
expect.set_options(timeout=20000)
origin = {'latitude': -33.88, 'longitude': 151.2, 'label': 'Town Hall, Sydney'}
end = {'latitude': -33.9, 'longitude': 151.25, 'label': 'University of Sydney'}
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width in [320, 390, 844, 1440]:
        page = browser.new_page(viewport={'width': width, 'height': 900})
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        state = {'saved': None}
        def respond(r):
            path = r.request.url.split('/api/')[-1].split('?')[0]
            if path == 'university/session': data = {'unikey': 'ride1234'}
            elif path == 'current': data = {'current': None, 'currents': []}
            elif path == 'usual-route/from-search':
                body = r.request.post_data_json
                route = copy.deepcopy(state['saved']) if state['saved'] else {'anyTime': True, 'days': [], 'minute': None, 'alerts': False, 'priceAud': 0, 'payId': '', 'payIdType': 'MOBILE'}
                route.update(origin=body['origin'], destination=body['destination'])
                state['saved'] = route
                data = {'route': route}
            elif path == 'usual-route': data = {'route': state['saved'], 'alertsAvailable': True}
            elif path == 'search': data = {'candidates': []}
            elif path == 'route-preview': data = {'points': [origin, end], 'durationSeconds': 600}
            else: data = {}
            r.fulfill(json=data)
        page.route('**/*', lambda r: r.continue_() if r.request.url.startswith(BASE) else r.abort())
        page.route('**/api/**', respond)
        page.add_init_script('sessionStorage.setItem("cocowheels:find-ride-draft:v1", JSON.stringify({...'+json.dumps({'pickup': origin, 'destination': end, 'departureAt': None})+',savedAt:Date.now()}));')
        def check(dialog, name):
            expect(dialog).to_be_visible()
            text = dialog.locator('p').first
            expect(text).to_have_css('text-align', 'left')
            text_box = text.bounding_box()
            actions = dialog.locator('.cancel-prompt-actions').bounding_box()
            assert abs(text_box['x'] - actions['x']) < 1
            assert abs(text_box['x'] - dialog.bounding_box()['x'] - 22) < 1
            assert abs(actions['y'] - text_box['y'] - text_box['height'] - 20) < 1
            buttons = dialog.get_by_role('button').all()
            first, second = [button.bounding_box() for button in buttons]
            assert abs(second['y'] - first['y'] - first['height'] - 8) < 1
            assert abs(first['height'] - second['height']) < 1
            box = dialog.bounding_box()
            assert abs(box['x'] + box['width'] / 2 - width / 2) < 1
            assert abs(box['y'] + box['height'] / 2 - 450) < 1
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            page.screenshot(path=f'/tmp/modal-spacing-{name}-{width}.png', full_page=True)
        page.goto(BASE + '/?start=rider')
        page.get_by_role('button', name='Save route', exact=True).click()
        consent = page.get_by_role('dialog', name='Would you like to receive emails when matching rides become available?')
        check(consent, 'consent')
        consent.get_by_role('button', name='Not now', exact=True).click()
        state['saved']['origin'] = {**origin, 'longitude': 151.1}
        page.goto(BASE + '/?start=rider')
        page.get_by_role('button', name='Save route', exact=True).click()
        replacement = page.get_by_role('dialog', name='Replace your saved route?')
        check(replacement, 'replacement')
        replacement.get_by_role('button', name='Cancel', exact=True).click()
        assert not errors, errors
        print(f'PASS {width}px: consent/replacement 20px text gap, 8px action gap, equal buttons, centred, no overflow/errors', flush=True)
        page.close()
    browser.close()
