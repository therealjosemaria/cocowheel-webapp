"""Country handoff and storage/cache boundaries; Next :3201 with synthetic APIs."""
from playwright.sync_api import sync_playwright, expect
BASE = 'http://127.0.0.1:3201'
au = {'latitude': -33.918, 'longitude': 151.204, 'countryCode': 'au', 'label': 'Rosebery NSW 2018, Australia'}
redfern = dict(au, latitude=-33.893, label='Redfern NSW, Australia')
foreign = {'latitude': 40, 'longitude': 44, 'countryCode': 'am', 'label': '2018, Armenia'}
paris = {'latitude': 48.86, 'longitude': 2.35, 'countryCode': 'fr', 'label': 'Paris, France'}
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width in [390, 1440]:
        context = browser.new_context(viewport={'width': width, 'height': 900})
        context.add_init_script("if(!localStorage.getItem('cocowheels:country-preference:v1')) localStorage.setItem('cocowheels:country-preference:v1',JSON.stringify({countryCode:'au',expiresAt:Date.now()+2*86400000}));")
        lookups = []; errors = []; writes = []
        context.route('**/*', lambda r: r.continue_() if r.request.url.startswith(BASE) else r.abort())
        def api(r):
            path = r.request.url.split('/api/')[-1].split('?')[0]
            if r.request.method != 'GET': writes.append(path)
            if path == 'place-search':
                body = r.request.post_data_json; lookups.append(body)
                data = {'places': [paris, au] if 'France' in body['text'] else [redfern, foreign] if body['text'] == 'Redfern' else [au, foreign]}
            elif path == 'university/session': data = {'unikey': 'tester01'}
            elif path == 'notifications/reviewed': data = {'keys': []}
            elif path == 'profile': data = {'username': 'tester01', 'email': 'synthetic@example.com', 'photoUrl': None}
            elif path == 'vehicle': data = {'vehicle': None}
            elif path == 'route-preview': data = {'points': [au, redfern], 'durationSeconds': 600}
            elif path == 'usual-route': data = {'route': None, 'alertsAvailable': True}
            else: data = {'current': None, 'currents': []}
            r.fulfill(json=data)
        context.route('**/api/**', api)
        page = context.new_page(); page.on('pageerror', lambda e: errors.append(str(e)))
        def sheet(page, name, text, result):
            page.get_by_role('button', name=name, exact=True).click()
            dialog = page.get_by_role('dialog', name=name, exact=True)
            dialog.get_by_role('textbox').fill(text)
            expect(dialog.get_by_role('button', name=result['label'], exact=True)).to_be_visible()
            return dialog
        page.goto(BASE + '/?start=rider')
        dialog = sheet(page, 'Where from?', '2018', au)
        assert lookups[-1]['countryCode'] == 'au' and 'bias' not in lookups[-1]
        expect(dialog.get_by_role('button', name=foreign['label'], exact=True)).to_be_visible()
        page.screenshot(path=f'/tmp/local-search-postcode-{width}.png', full_page=True)
        dialog.get_by_role('button', name=au['label'], exact=True).click()
        country = page.evaluate("JSON.parse(localStorage.getItem('cocowheels:country-preference:v1'))")
        assert country['countryCode'] == 'au' and country['expiresAt'] - page.evaluate('Date.now()') > 6 * 86400000
        dialog = sheet(page, 'Where to?', 'Redfern', redfern)
        assert lookups[-1]['countryCode'] == 'au' and lookups[-1]['bias'] == {'latitude': au['latitude'], 'longitude': au['longitude']}
        page.screenshot(path=f'/tmp/local-search-destination-{width}.png', full_page=True)
        dialog.get_by_role('button', name=redfern['label'], exact=True).click()
        page.goto(BASE + '/?start=driver')
        dialog = sheet(page, 'Where from?', 'Paris France', paris)
        page.screenshot(path=f'/tmp/local-search-driver-overseas-{width}.png', full_page=True)
        dialog.get_by_role('button', name=paris['label'], exact=True).click()
        assert page.evaluate("JSON.parse(localStorage.getItem('cocowheels:country-preference:v1')).countryCode") == 'fr'
        dialog = sheet(page, 'Where to?', 'Redfern', redfern)
        assert lookups[-1]['countryCode'] == 'fr' and lookups[-1]['bias'] == {'latitude': paris['latitude'], 'longitude': paris['longitude']}
        dialog.get_by_role('button', name='Back', exact=True).click()
        before = len(lookups)
        dialog = sheet(page, 'Where from?', '2018', au)
        assert len(lookups) == before + 1 and lookups[-1]['countryCode'] == 'fr'
        dialog.get_by_role('button', name='Back', exact=True).click()
        before = len(lookups)
        dialog = sheet(page, 'Where from?', '2018', au)
        page.wait_for_timeout(600)
        assert len(lookups) == before, 'Identical hinted query should reuse its one-minute cache'
        dialog.get_by_role('button', name='Back', exact=True).click()
        other = context.new_page(); other.on('pageerror', lambda e: errors.append(str(e)))
        other.goto(BASE + '/?start=rider')
        dialog = sheet(other, 'Where from?', '2018', au)
        assert lookups[-1]['countryCode'] == 'fr' and 'bias' not in lookups[-1], 'New tab keeps country only'
        assert other.evaluate("sessionStorage.getItem('cocowheels:search-location:v1')") is None
        other.goto(BASE + '/usual-route')
        other.locator('.usual-route-disclosure > summary').click()
        other.get_by_placeholder('Where from?', exact=True).fill('Rosebery')
        other.locator('.place-search').first.get_by_role('button', name='Search', exact=True).click()
        expect(other.get_by_role('button', name=au['label'], exact=True)).to_be_visible()
        other.screenshot(path=f'/tmp/local-search-profile-{width}.png', full_page=True)
        other.get_by_role('button', name=au['label'], exact=True).click()
        assert other.evaluate("JSON.parse(localStorage.getItem('cocowheels:country-preference:v1')).countryCode") == 'au'
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        assert not errors, errors
        assert all(path in ['place-search', 'route-preview'] for path in writes), writes
        context.unroute_all(behavior='wait'); context.close()
        print(f'PASS {width}: five-day country, origin/destination, foreign options, new tab, Profile, country-aware cache; no live writes/errors', flush=True)
    browser.close()
