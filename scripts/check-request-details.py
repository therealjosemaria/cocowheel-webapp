"""Requested journey details: synthetic owner API, no live writes/providers."""
from playwright.sync_api import sync_playwright, expect

BASE = 'http://127.0.0.1:3201'
pin = {'latitude': -33.90, 'longitude': 151.20, 'label': 'Example origin, Sydney'}
end = dict(pin, latitude=-33.87, label='Example destination, Sydney')
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width in [320, 390, 844, 1440]:
        context = browser.new_context(viewport={'width': width, 'height': 900})
        page = context.new_page()
        errors, writes = [], []
        state = {'status': 'OPEN', 'offer': 'PENDING', 'http': 200, 'fail_action': False}
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.route('**/*', lambda r: r.continue_() if r.request.url.startswith(BASE) else r.abort())
        def api(r):
            path = r.request.url.split('/api/')[-1].split('?')[0]
            data = {}
            if path == 'university/session': data = {'unikey': 'tester01'}
            elif path == 'current': data = {'current': None, 'currents': []}
            elif path == 'history': data = {'driver': [], 'rider': []}
            elif path == 'rider-demands':
                if state['http'] != 200:
                    r.fulfill(status=state['http'], json={'error': 'NOT_AUTHORIZED' if state['http'] == 403 else 'SERVER_ERROR'}); return
                data = {'requests': [{'id': 'mine', 'origin': pin, 'destination': end, 'date': 'any', 'time': '',
                    'status': state['status'], 'expiresAt': '2026-10-28T01:00:00Z', 'offers': [{
                        'id': 'offer-1', 'rideId': 'COCO-TEST', 'driverAlias': 'driver01',
                        'departureAt': '2026-10-27T01:00:00Z', 'priceAud': 0, 'status': state['offer']}]}], 'sent': []}
            elif path == 'route-preview': data = {'points': [pin, end]}
            elif path.startswith('profile-photo/'):
                r.fulfill(content_type='image/svg+xml', body='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#e2e8f0"/></svg>'); return
            elif r.request.method == 'POST':
                writes.append((path, r.request.post_data_json))
                if state['fail_action']:
                    r.fulfill(status=409, json={'error': 'DEMAND_CHANGED'}); return
                if path.endswith('/cancel'): state['status'] = 'CANCELLED'
                if path.endswith('/respond'):
                    if r.request.post_data_json['decision'] == 'ACCEPT':
                        data = {'ride': {'rideId': 'COCO-TEST'}}
                    else: state['offer'] = 'DECLINED'
            r.fulfill(json=data)
        page.route('**/api/**', api)
        page.goto(BASE + '/activity')
        card = page.locator('.demand-activity .activity-card')
        expect(card.locator('dt').filter(has_text='Status')).to_have_count(1)
        expect(card.get_by_text('Open', exact=True)).to_be_visible()
        expect(page.get_by_role('button', name='Show route')).to_have_count(0)
        expect(page.get_by_role('button', name='Withdraw post')).to_have_count(0)
        expect(page.locator('.demand-offer')).to_have_count(0)
        card.locator('.activity-open').click()
        expect(page).to_have_url(BASE + '/activity/requests/mine')
        expect(page.get_by_role('button', name='Accept ride')).to_be_visible()
        expect(page.locator('.demand-map')).to_be_visible()
        expect(page.get_by_text('Road path by', exact=False)).to_be_visible()
        back = page.get_by_role('link', name='Back', exact=True)
        assert back.bounding_box()['height'] >= 44
        assert card.bounding_box()['y'] - (back.bounding_box()['y'] + back.bounding_box()['height']) >= 16
        page.screenshot(path=f'/tmp/request-details-open-{width}.png', full_page=True)
        page.get_by_role('button', name='Decline', exact=True).click()
        expect(page.get_by_text('declined', exact=True)).to_be_visible()
        assert writes[-1] == ('rider-demands/offers/offer-1/respond', {'decision': 'DECLINE'})
        state['offer'] = 'PENDING'
        page.reload()
        state['fail_action'] = True
        page.get_by_role('button', name='Accept ride').click()
        expect(page.locator('.demand-activity').get_by_role('alert')).to_be_visible()
        assert writes[-1] == ('rider-demands/offers/offer-1/respond', {'decision': 'ACCEPT'})
        expect(page.get_by_role('button', name='Accept ride')).to_be_visible()
        state['fail_action'] = False
        page.reload()
        page.get_by_role('button', name='Withdraw post', exact=True).click()
        modal = page.get_by_role('dialog', name='Withdraw your post?')
        expect(modal).to_be_visible()
        before = len(writes)
        page.keyboard.press('Escape')
        assert len(writes) == before
        page.get_by_role('button', name='Withdraw post', exact=True).click()
        modal.get_by_role('button', name='Withdraw post', exact=True).click()
        expect(card.get_by_text('Withdrawn', exact=True)).to_be_visible()
        expect(page.get_by_role('button', name='Withdraw post')).to_have_count(0)
        expect(page.get_by_role('button', name='Accept ride')).to_have_count(0)
        assert writes[-1] == ('rider-demands/mine/cancel', {})
        for status, label in [('EXPIRED', 'Expired'), ('FULFILLED', 'Fulfilled')]:
            state['status'] = status
            page.reload()
            expect(card.get_by_text(label, exact=True)).to_be_visible()
            expect(page.locator('.demand-map')).to_be_visible()
            expect(page.get_by_text('Road path by', exact=False)).to_be_visible()
            expect(page.get_by_role('button', name='Withdraw post')).to_have_count(0)
            expect(page.get_by_role('button', name='Accept ride')).to_have_count(0)
        page.screenshot(path=f'/tmp/request-details-closed-{width}.png', full_page=True)
        page.goto(BASE + '/activity/requests/not-mine')
        expect(page.get_by_text('This journey request is not available.')).to_be_visible()
        expect(card).to_have_count(0)
        page.goto(BASE + '/activity/requests/mine')
        expect(card).to_be_visible()
        state['http'] = 403
        page.evaluate("window.dispatchEvent(new Event('cocowheels:identity-changed'))")
        expect(page.locator('.demand-activity').get_by_role('alert')).to_be_visible()
        expect(card).to_have_count(0)
        state['http'] = 200
        page.get_by_role('button', name='Try again', exact=True).click()
        expect(card).to_be_visible()
        page.get_by_role('link', name='Back', exact=True).click()
        expect(page).to_have_url(BASE + '/activity')
        expect(page.get_by_role('heading', name='Activity', exact=True)).to_be_visible()
        state['status'], state['offer'] = 'OPEN', 'PENDING'
        page.route('**/rides/COCO-TEST', lambda r: r.fulfill(content_type='text/html', body='<h1>Accepted ride destination</h1>'))
        page.goto(BASE + '/activity/requests/mine')
        page.get_by_role('button', name='Accept ride').click()
        expect(page).to_have_url(BASE + '/rides/COCO-TEST')
        assert writes[-1] == ('rider-demands/offers/offer-1/respond', {'decision': 'ACCEPT'})
        assert not errors, errors
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        print(f'PASS {width}: summary/detail, statuses, decline, failed accept, withdraw, private/missing, retry, Back', flush=True)
        context.close()
    browser.close()
