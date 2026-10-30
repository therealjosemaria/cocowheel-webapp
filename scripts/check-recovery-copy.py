"""Review recovery instructions with synthetic API states on Next :3090.
External requests are blocked. No live journey, account or provider writes.
"""
from playwright.sync_api import sync_playwright, expect
BASE = 'http://127.0.0.1:3090'
origin = {'latitude': -33.88, 'longitude': 151.20, 'label': 'Town Hall, Sydney'}
destination = dict(origin, longitude=151.25, label='University of Sydney')
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width in [390, 1440]:
        for scenario in ['private', 'public', 'profile', 'missing-request']:
            context = browser.new_context(viewport={'width': width, 'height': 900})
            page = context.new_page(); errors = []; writes = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.route('**/*', lambda r: r.continue_() if r.request.url.startswith(BASE) else r.abort())
            def api(r):
                path = r.request.url.split('/api/')[-1].split('?')[0]
                if r.request.method != 'GET': writes.append(path)
                if path.startswith('rides/missing'):
                    r.fulfill(status=403 if scenario == 'private' else 404, json={'error': 'RIDE_ACCESS_DENIED' if scenario == 'private' else 'RIDE_UNAVAILABLE'}); return
                if path == 'usual-route' and r.request.method == 'POST':
                    r.fulfill(status=404, json={'error': 'DEMAND_NOT_FOUND' if scenario == 'missing-request' else 'RIDE_UNAVAILABLE'}); return
                if path == 'university/session': data = {'unikey': 'tester01', 'ratings': {'driver': None, 'rider': None}}
                elif path == 'notifications/reviewed': data = {'keys': []}
                elif path == 'usual-route': data = {'route': {'origin': origin, 'destination': destination, 'days': [], 'minute': None, 'anyTime': True, 'alerts': False}, 'alertsAvailable': True}
                elif path == 'profile': data = {'username': 'tester01', 'email': 'synthetic@example.com', 'photoUrl': None}
                elif path == 'vehicle': data = {'vehicle': None}
                elif path == 'current': data = {'current': None, 'currents': []}
                elif path == 'history': data = {'driver': [], 'rider': []}
                elif path == 'rider-demands': data = {'requests': [], 'sent': []}
                else: data = {}
                r.fulfill(json=data)
            page.route('**/api/**', api)
            url = '/activity/missing' if scenario == 'private' else '/rides/missing' if scenario == 'public' else '/usual-route'
            page.goto(BASE + url)
            if scenario in ['profile', 'missing-request']:
                page.locator('.usual-route-disclosure > summary').click()
                page.get_by_role('button', name='Enable email alerts', exact=True).click()
                surface = page.get_by_role('dialog')
                expect(surface).to_be_visible()
            else: surface = page
            message = 'Open Activity to view your journeys.' if scenario == 'private' else 'Open Activity to check your journeys.' if scenario == 'missing-request' else 'Use Find a journey to look for another.'
            expect(surface.get_by_text(message, exact=False)).to_be_visible()
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            assert not errors, errors
            assert writes == (['usual-route'] if scenario in ['profile', 'missing-request'] else []), writes
            page.screenshot(path=f'/tmp/gumwheel-recovery-{scenario}-{width}.png', full_page=True)
            context.unroute_all(behavior='wait'); context.close()
            print(f'PASS {width} {scenario}: clear next step, existing surface, no errors/overflow or live writes', flush=True)
    browser.close()
