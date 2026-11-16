"""Isolated real API + optimized browser: private history and admin check timing.
Use serve-map-avatar-fixture.mts on 3492/3494, Next 3491 and synthetic upload JPEG.
No real accounts, email or paid calls. Screenshots: /tmp/gumwheel-avatar-history-review.
"""
import base64
import uuid
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE = 'http://127.0.0.1:3491'
API = 'http://127.0.0.1:3492'
CONTROL = 'http://127.0.0.1:3494'
OUT = Path('/tmp/gumwheel-avatar-history-review'); OUT.mkdir(exist_ok=True)
photo = 'data:image/jpeg;base64,' + base64.b64encode(Path('/tmp/gumwheel-avatar-upload-synthetic.jpg').read_bytes()).decode()
worker = {'Authorization': 'Bearer ' + 'synthetic-avatar-worker-key-' * 3}
control = {'X-Gumwheel-Fixture': '1'}

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width in [320, 390, 1440]:
        user = p.request.new_context(base_url=BASE, extra_http_headers={'Cookie': 'cocowheels_guest=synthetic-avatar-driver'})
        admin = p.request.new_context(base_url=BASE, extra_http_headers={'Cookie': 'cocowheels_guest=synthetic-avatar-admin', 'Origin': BASE, 'X-Admin-Request': '1'})
        assert user.post(CONTROL + '/reset', headers=control).ok
        def upload():
            response = user.post('/api/avatar/jobs', data={'photo': photo, 'submissionId': str(uuid.uuid4()), 'consent': True})
            assert response.ok, response.text()
            return response.json()['job']['id']
        def check(verdict, reason=None, duration=None):
            claim = user.post(API + '/api/avatar-worker/claim', headers=worker, data={}).json()['job']
            assert claim
            response = user.post(API + '/api/avatar-worker/result', headers=worker, data={'id': claim['id'], 'lease': claim['lease'], 'verdict': verdict, 'reason': reason, 'durationMs': duration})
            assert response.ok, response.text()
        first = upload(); check('rejected', 'FEET', 2345)
        second = upload(); check('approved', duration=789)
        reason = 'Keep both hands visible and leave space around your feet.'
        assert admin.post(f'/api/admin/avatar-jobs/{second}/reject', data={'reason': reason}).ok
        third = upload()
        contexts = []
        errors = []
        def page_for(cookie):
            context = browser.new_context(viewport={'width': width, 'height': 1000})
            contexts.append(context)
            context.add_cookies([{'name': 'cocowheels_guest', 'value': cookie, 'url': BASE}])
            context.route('**/*', lambda route: route.continue_() if route.request.url.startswith(BASE) else route.abort())
            page = context.new_page(); page.on('pageerror', lambda error: errors.append(str(error)))
            return page
        ap = page_for('synthetic-avatar-admin')
        ap.goto(BASE + '/admin/avatar-management')
        old = ap.locator('#avatar-' + first)
        reviewed = ap.locator('#avatar-' + second)
        pending = ap.locator('#avatar-' + third)
        expect(old.get_by_text('Photo check failed', exact=True)).to_be_visible()
        expect(old.get_by_text('2.3 s', exact=True)).to_be_visible()
        expect(reviewed.get_by_text('Rejected on review', exact=True)).to_be_visible()
        expect(reviewed.get_by_text('0.8 s', exact=True)).to_be_visible()
        expect(pending.get_by_text('Not recorded', exact=True)).to_have_count(2)
        for card in [old, reviewed, pending]:
            expect(card.get_by_text('Submitted', exact=True)).to_be_visible()
            expect(card.get_by_text('Checked', exact=True)).to_be_visible()
            expect(card.get_by_text('Check duration', exact=True)).to_be_visible()
        ap.screenshot(path=str(OUT / f'admin-results-{width}.png'), full_page=True)
        up = page_for('synthetic-avatar-driver')
        requests = []
        up.on('request', lambda request: requests.append(request.url) if '/api/avatar/history' in request.url else None)
        up.goto(BASE + '/usual-route?avatar=1')
        avatar = up.locator('.avatar-details')
        expect(avatar.get_by_text('Personal avatar', exact=True)).to_be_visible()
        history = avatar.locator('.avatar-upload-history')
        assert not history.evaluate('(element) => element.open')
        assert not requests, 'History must not load while closed'
        history.locator('summary').click()
        expect(history.locator('article')).to_have_count(3)
        expect(history.get_by_text(reason, exact=False)).to_be_visible()
        expect(history.get_by_text('Photo rejected', exact=True)).to_have_count(2)
        expect(history.get_by_text('Waiting for photo check', exact=True)).to_be_visible()
        expect(history.get_by_role('img', name='Submitted photo', exact=True)).to_have_count(3)
        for image in history.locator('img').all():
            image.scroll_into_view_if_needed()
            up.wait_for_function('(image) => image.complete && image.naturalWidth > 0', arg=image.element_handle())
        assert history.get_by_role('button').count() == 0, 'Rows are read-only'
        assert not history.get_by_role('textbox').count()
        assert not any(text in history.inner_text().lower() for text in ['tripo', 'credit', 'generation approval'])
        assert up.evaluate('document.documentElement.scrollWidth <= innerWidth')
        assert ap.evaluate('document.documentElement.scrollWidth <= innerWidth')
        up.screenshot(path=str(OUT / f'profile-history-{width}.png'), full_page=True)
        # Retained outcomes survive an admin cancellation; its photo is removed.
        assert admin.post(f'/api/admin/avatar-jobs/{third}/cancel', data={}).ok
        up.evaluate('window.dispatchEvent(new Event("focus"))')
        expect(history.get_by_text('Photo removed', exact=True)).to_be_visible()
        expect(history.get_by_text('Cancelled', exact=True)).to_be_visible()
        up.screenshot(path=str(OUT / f'profile-removed-{width}.png'), full_page=True)
        # The other signed-in role/account has an empty independent history.
        rp = page_for('synthetic-avatar-owner')
        rp.goto(BASE + '/usual-route?avatar=1')
        rp.locator('.avatar-upload-history summary').click()
        expect(rp.get_by_text('No uploads yet.', exact=True)).to_be_visible()
        rp.screenshot(path=str(OUT / f'rider-empty-{width}.png'), full_page=True)
        assert not errors, errors
        for context in contexts: context.close()
        user.dispose(); admin.dispose()
        print(f'PASS {width}px: private read-only history, outcomes/removal, both roles, admin timings and no overflow')
    browser.close()
