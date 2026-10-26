"""Own-request discovery: local frontend, mocked APIs, no live writes."""
from playwright.sync_api import sync_playwright, expect

BASE = 'http://127.0.0.1:3201'
pin = {'latitude': -33.9, 'longitude': 151.2, 'label': 'Example suburb, Sydney'}
request = {'id': 'own-request', 'alias': 'tester01', 'origin': pin, 'destination': pin,
           'date': 'any', 'time': '', 'status': 'OPEN', 'isOwn': True}
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width in [320, 390, 844, 1440]:
        page = browser.new_page(viewport={'width': width, 'height': 900})
        errors, offers, searches = [], [], []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.route('**/*', lambda r: r.continue_() if r.request.url.startswith(BASE) else r.abort())
        def api(r):
            path = r.request.url.split('/api/')[-1].split('?')[0]
            if path == 'university/session': data = {'unikey': 'tester01'}
            elif path == 'current': data = {'current': None, 'currents': []}
            elif path.startswith('profile-photo/'):
                r.fulfill(content_type='image/svg+xml', body='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#f1f5f9"/><circle cx="12" cy="8" r="3" fill="#64748b"/><path d="M5 22v-3a7 7 0 0 1 14 0v3" fill="#64748b"/></svg>')
                return
            elif path == 'rider-demands/search':
                searches.append(r.request.post_data_json)
                data = {'requests': [request, dict(request, id='other-request', alias='other001', isOwn=False)]}
            elif path.endswith('/offer'):
                offers.append(r.request.post_data_json)
                r.fulfill(status=409, json={'error': 'OWN_RIDE_JOIN_NOT_ALLOWED'})
                return
            else: data = {}
            r.fulfill(json=data)
        page.route('**/api/**', api)
        page.goto(BASE + '/?start=driver')
        page.get_by_role('button', name='See journey requests', exact=True).click()
        page.get_by_role('button', name='SEARCH', exact=True).click()
        cards = page.locator('.demand-page .activity-card')
        expect(cards).to_have_count(2)
        assert searches == [{'date': 'any', 'time': ''}]
        own = cards.first.get_by_role('button', name='Offer a ride', exact=True)
        own.click()
        warning = page.get_by_role('dialog')
        expect(warning.get_by_text('You can’t offer a ride to yourself.', exact=True)).to_be_visible()
        expect(warning.get_by_role('button', name='OKAY', exact=True)).to_be_visible()
        assert offers == []
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        page.screenshot(path=f'/tmp/own-request-warning-{width}.png', full_page=True)
        page.keyboard.press('Escape')
        expect(own).to_be_focused()
        own.click()
        warning.get_by_role('button', name='OKAY', exact=True).click()
        expect(cards).to_have_count(2)
        page.screenshot(path=f'/tmp/own-request-results-{width}.png', full_page=True)
        # Older/missing ownership metadata still cannot bypass server rejection.
        cards.nth(1).get_by_role('button', name='Offer a ride', exact=True).click()
        review = page.get_by_role('dialog', name='Offer a ride', exact=True)
        review.get_by_role('button', name='Offer a ride', exact=True).click()
        expect(review.get_by_role('alert')).to_have_text('You can’t offer a ride to yourself.')
        assert len(offers) == 1
        assert not errors, errors
        print(f'PASS {width}: own card, empty filters, shared warning, focus, no self-offer submission and server-error fallback', flush=True)
        page.close()
    browser.close()
