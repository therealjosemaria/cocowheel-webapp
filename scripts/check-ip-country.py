"""Synthetic first-visit country contracts; isolated Next preview on :3201."""
from playwright.sync_api import sync_playwright, expect
BASE = 'http://127.0.0.1:3201'
place = {'latitude': -33.918, 'longitude': 151.204, 'countryCode': 'au', 'label': 'Rosebery NSW 2018, Australia'}
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width in [390, 1440]:
        for hint, stored, status in [('fr', None, 200), (None, None, 200), ('XX', None, 200), (None, None, 503), ('fr', 'au', 200)]:
            context = browser.new_context(viewport={'width': width, 'height': 900})
            if stored:
                context.add_init_script("localStorage.setItem('cocowheels:country-preference:v1', JSON.stringify({countryCode:'au',expiresAt:Date.now()+86400000}));")
            calls = []; searches = []; errors = []; unexpected = []
            context.route('**/*', lambda r: r.continue_() if r.request.url.startswith(BASE) else r.abort())
            def country(r):
                calls.append(True)
                r.fulfill(status=status, json={'countryCode': hint})
            context.route('**/search-country', country)
            def api(r):
                path = r.request.url.split('/api/')[-1].split('?')[0]
                if path == 'place-search':
                    searches.append(r.request.post_data_json); data = {'places': [place]}
                elif path == 'university/session': data = {'unikey': 'tester01'}
                elif path == 'notifications/reviewed': data = {'keys': []}
                elif path == 'profile': data = {'username': 'tester01', 'email': 'synthetic@example.com', 'photoUrl': None}
                elif path == 'route-preview': data = {'points': [place, place], 'durationSeconds': 600}
                else: data = {'current': None, 'currents': []}
                if r.request.method != 'GET' and path not in ['place-search', 'route-preview']: unexpected.append(path)
                r.fulfill(json=data)
            context.route('**/api/**', api)
            page = context.new_page(); page.on('pageerror', lambda e: errors.append(str(e)))
            page.goto(BASE + '/?start=rider')
            page.get_by_role('button', name='Where from?', exact=True).click()
            dialog = page.get_by_role('dialog', name='Where from?', exact=True)
            dialog.get_by_role('textbox').fill('2018')
            expect(dialog.get_by_role('button', name=place['label'], exact=True)).to_be_visible()
            expected = stored or (hint if hint == 'fr' and status == 200 else None)
            assert searches[-1].get('countryCode') == expected, searches
            assert len(calls) == (0 if stored else 1)
            if not stored: assert page.evaluate("localStorage.getItem('cocowheels:country-preference:v1')") is None
            # A second search reuses only the country hint, not the first query.
            dialog.get_by_role('textbox').fill('Rosebery')
            page.wait_for_timeout(800)
            assert len(searches) == 2 and len(calls) == (0 if stored else 1)
            dialog.get_by_role('button', name=place['label'], exact=True).click()
            page.get_by_role('button', name='Where to?', exact=True).click()
            dialog = page.get_by_role('dialog', name='Where to?', exact=True)
            dialog.get_by_role('textbox').fill('Redfern')
            expect(dialog.get_by_role('button', name=place['label'], exact=True)).to_be_visible()
            assert searches[-1]['countryCode'] == 'au', searches
            assert not errors and not unexpected, (errors, unexpected)
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            context.unroute_all(behavior='wait'); context.close()
            print(f'PASS {width}: hint={hint}, stored={stored}, status={status}; one lookup, selected country wins, no real writes', flush=True)
        context = browser.new_context(viewport={'width': width, 'height': 900})
        context.route('**/*', lambda r: r.continue_() if r.request.url.startswith(BASE) else r.abort())
        context.route('**/api/**', api)
        page = context.new_page(); page.goto(BASE + '/privacy')
        expect(page.get_by_text('Before you select a location,', exact=False)).to_be_visible()
        page.screenshot(path=f'/tmp/ip-country-privacy-{width}.png', full_page=True)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        context.close()
    browser.close()
