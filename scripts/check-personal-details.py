"""Isolated Profile UI regression: mock APIs; no production writes or emails.
Run against a local frontend on port 3201 with Playwright/Chromium installed.
"""
from playwright.sync_api import sync_playwright, expect

expect.set_options(timeout=30000)
BASE = 'http://127.0.0.1:3201'
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width in [320, 390, 844, 1440]:
        context = browser.new_context(viewport={'width': width, 'height': 900})
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        state = {'username': 'wwwwwwww', 'email': 'a.long.private.email.address@example.com', 'photoUrl': None}
        writes = []
        def respond(route):
            path = route.request.url.split('/api/')[-1].split('?')[0]
            if path == 'profile':
                if route.request.method == 'POST':
                    body = route.request.post_data_json
                    writes.append(body)
                    if body['username'] == 'taken':
                        route.fulfill(status=409, json={'error': 'USERNAME_UNAVAILABLE'})
                        return
                    state['username'] = body['username']
                    if 'photo' in body: state['photoUrl'] = body['photo']
                data = state
            elif path == 'university/code': data = {'challengeId': 'mock-challenge', 'deliveryAddress': 'new@example.com'}
            elif path == 'university/verify': data = {'ok': True}
            elif path == 'university/session': data = {'unikey': 'owner@example.com', 'username': state['username']}
            elif path == 'usual-route': data = {'route': None, 'alertsAvailable': True}
            elif path == 'current': data = {'current': None, 'currents': []}
            elif path.startswith('profile-photo/'):
                route.fulfill(content_type='image/svg+xml', body='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="#64748b"/></svg>')
                return
            else: data = {}
            route.fulfill(json=data)
        page.route('**/*', lambda r: r.continue_() if r.request.url.startswith(BASE) else r.abort())
        page.route('**/api/**', respond)
        page.goto(BASE + '/usual-route')
        details = page.locator('.personal-details')
        expect(details).to_be_visible()
        expect(details).not_to_have_attribute('open', '')
        details.locator('summary').click()
        expect(details).to_contain_text(state['email'])
        page.screenshot(path=f'/tmp/personal-summary-{width}.png', full_page=True)
        details.get_by_role('button', name='Edit', exact=True).click()
        username = details.get_by_label('Username', exact=True)
        expect(username).to_have_value('wwwwwwww')
        username.fill('taken')
        details.get_by_role('button', name='Save', exact=True).click()
        expect(details.get_by_role('alert')).to_contain_text('unavailable')
        username.fill('newname8')
        details.get_by_role('button', name='Save', exact=True).click()
        expect(details.get_by_role('button', name='Edit', exact=True)).to_be_visible()
        expect(details).to_contain_text('newname8')
        details.get_by_role('button', name='Edit', exact=True).click()
        username.fill('changed')
        details.get_by_role('button', name='Cancel', exact=True).click()
        expect(details).not_to_contain_text('changed')
        details.get_by_role('button', name='Edit', exact=True).click()
        details.locator('input[type=file]').set_input_files({'name': 'bad.svg', 'mimeType': 'image/svg+xml', 'buffer': b'<svg/>'})
        expect(details.get_by_role('alert')).to_contain_text('JPG, PNG or WebP')
        # A real browser-generated PNG exercises decode, crop and WebP preparation.
        png = page.locator('.profile-photo-preview').screenshot()
        details.locator('input[type=file]').set_input_files({'name': 'portrait.png', 'mimeType': 'image/png', 'buffer': png})
        expect(details.get_by_role('img', name='Your profile photo')).to_be_visible()
        details.get_by_role('button', name='Save', exact=True).click()
        expect(details.get_by_role('button', name='Edit', exact=True)).to_be_visible()
        assert writes[-1]['photo'].startswith('data:image/webp;base64,')
        details.get_by_role('button', name='Edit', exact=True).click()
        page.screenshot(path=f'/tmp/personal-editor-{width}.png', full_page=True)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        assert not errors, errors
        assert len(writes) == 3
        page.evaluate('window.dispatchEvent(new Event("cocowheels:verify-university"))')
        dialog = page.get_by_role('dialog', name='Email verification')
        expect(dialog).to_be_visible()
        dialog.get_by_label('Email', exact=True).fill('new@example.com')
        page.screenshot(path=f'/tmp/personal-login-{width}.png')
        dialog.get_by_role('button', name='Send code', exact=True).click()
        dialog = page.get_by_role('dialog', name='Enter your code')
        expect(dialog).to_contain_text('Sent to new@example.com')
        dialog.get_by_label('Verification code').fill('123456')
        dialog.get_by_role('button', name='Verify', exact=True).click()
        expect(dialog).not_to_be_visible()
        print(f'PASS {width}: private email, eight-character username, collapsed accordion, save/conflict/cancel, invalid image, no overflow or JS errors')
        context.close()
    browser.close()
