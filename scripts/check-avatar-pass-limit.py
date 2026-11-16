"""Local real API / synthetic photos: rejected retries and three-pass feedback.
Use serve-map-avatar-fixture.mts and an optimized build targeting 3492; no paid calls.
"""
import base64
import uuid
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE = 'http://127.0.0.1:3491'
API = 'http://127.0.0.1:3492'
CONTROL = 'http://127.0.0.1:3494'
OUT = Path('/tmp/gumwheel-avatar-pass-limit-review'); OUT.mkdir(exist_ok=True)
PHOTO = Path('/tmp/gumwheel-avatar-upload-synthetic.jpg')
photo = 'data:image/jpeg;base64,' + base64.b64encode(PHOTO.read_bytes()).decode()
worker = {'Authorization': 'Bearer ' + 'synthetic-avatar-worker-key-' * 3}
control = {'X-Gumwheel-Fixture': '1'}
message = 'Three photos have passed the check in the last 24 hours. Try uploading again later.'

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width in [320, 390, 1440]:
        user = p.request.new_context(base_url=BASE, extra_http_headers={'Cookie': 'cocowheels_guest=synthetic-avatar-driver'})
        admin = p.request.new_context(base_url=BASE, extra_http_headers={'Cookie': 'cocowheels_guest=synthetic-avatar-admin', 'Origin': BASE, 'X-Admin-Request': '1'})
        def upload_and_check(verdict):
            response = user.post('/api/avatar/jobs', data={'photo': photo, 'submissionId': str(uuid.uuid4()), 'consent': True})
            assert response.ok, response.text()
            job = response.json()['job']
            claim = user.post(API + '/api/avatar-worker/claim', headers=worker, data={}).json()['job']
            assert claim['id'] == job['id']
            assert user.post(API + '/api/avatar-worker/result', headers=worker, data={'id': job['id'], 'lease': claim['lease'], 'verdict': verdict, 'reason': 'FEET' if verdict == 'rejected' else None}).ok
            return job['id']
        def profile(cookie):
            context = browser.new_context(viewport={'width': width, 'height': 1000})
            context.add_cookies([{'name': 'cocowheels_guest', 'value': cookie, 'url': BASE}])
            context.route('**/*', lambda route: route.continue_() if route.request.url.startswith(BASE) else route.abort())
            page = context.new_page(); page.goto(BASE + '/usual-route?avatar=1')
            return context, page, page.locator('.avatar-details')
        assert user.post(CONTROL + '/reset', headers=control).ok
        for _ in range(4): upload_and_check('rejected')
        context, page, avatar = profile('synthetic-avatar-driver')
        expect(avatar.get_by_role('status')).to_contain_text('feet')
        avatar.locator('input[type=file]').set_input_files(str(PHOTO))
        expect(avatar.get_by_role('button', name='Submit photo', exact=True)).to_be_visible()
        page.screenshot(path=str(OUT / f'rejected-retry-{width}.png'), full_page=True)
        avatar.get_by_role('button', name='Submit photo', exact=True).click()
        expect(avatar.get_by_role('status')).to_contain_text('queued for checking')
        assert user.get('/api/avatar/history').json()['total'] == 5
        context.close()
        assert user.post(CONTROL + '/reset', headers=control).ok
        for _ in range(3):
            job_id = upload_and_check('approved')
            assert admin.post(f'/api/admin/avatar-jobs/{job_id}/cancel', data={}).ok
        for role, cookie in [('driver', 'synthetic-avatar-driver'), ('rider', 'synthetic-avatar-owner')]:
            context, page, avatar = profile(cookie)
            if role == 'rider':
                # Same shared alert, without altering the assigned synthetic rider account.
                page.route('**/api/avatar/jobs', lambda route: route.fulfill(status=400, json={'error': 'AVATAR_UPLOAD_LIMIT'}) if route.request.method == 'POST' else route.continue_())
            avatar.locator('input[type=file]').set_input_files(str(PHOTO))
            avatar.get_by_role('button', name='Submit photo', exact=True).click()
            expect(avatar.get_by_role('alert')).to_have_text(message)
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            assert avatar.get_by_role('button', name='Submit photo', exact=True).is_enabled()
            page.screenshot(path=str(OUT / f'limit-{role}-{width}.png'), full_page=True)
            context.close()
        assert user.get('/api/avatar/history').json()['total'] == 3, 'Blocked upload must not create a fourth job'
        user.dispose(); admin.dispose()
        print(f'PASS {width}: rejected retries accepted, fourth verified-photo upload blocked without insertion, shared driver/rider feedback and no overflow')
    browser.close()
