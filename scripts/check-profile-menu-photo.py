"""Local mocked navigation checks; no production requests or writes."""
from playwright.sync_api import sync_playwright, expect
import re

BASE = 'http://127.0.0.1:3201'
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width in [320, 390, 844, 1440]:
        context = browser.new_context(viewport={'width': width, 'height': 900})
        page = context.new_page()
        state = {'signed': True, 'photo': None, 'broken': False}
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        def respond(route):
            path = route.request.url.split('/api/')[-1].split('?')[0]
            if path == 'university/session':
                route.fulfill(status=200 if state['signed'] else 401, json={'unikey': 'owner@example.com', 'username': 'testuser'})
            elif path == 'profile':
                route.fulfill(json={'username': 'testuser', 'email': 'owner@example.com', 'photoUrl': state['photo']})
            elif path == 'current':
                current = {'role': 'DRIVER', 'ride': {'rideId': 'mock-ride', 'status': 'PUBLISHED', 'driverAlias': 'testuser', 'fareCents': 0, 'requests': [{'requestId': 'mock-request', 'status': 'PENDING', 'createdAt': '2026-10-24T00:00:00Z'}]}}
                route.fulfill(json={'current': current, 'currents': [current]})
            elif path.startswith('profile-photo/'):
                if state['broken']: route.abort()
                else: route.fulfill(content_type='image/svg+xml', body='<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#64748b"/><circle cx="40" cy="28" r="14" fill="#e2e8f0"/><path d="M12 80 Q12 45 40 45 Q68 45 68 80" fill="#e2e8f0"/></svg>')
            else: route.fulfill(json={})
        page.route('**/*', lambda r: r.continue_() if r.request.url.startswith(BASE) else r.abort())
        page.route('**/api/**', respond)
        page.goto(BASE + '/help')
        button = page.locator('.guest-identity-button')
        expect(button).to_have_attribute('aria-label', 'Profile: testuser, 1 unread updates')
        expect(button.locator('img')).to_have_count(0)
        original = button.bounding_box()
        state['photo'] = '/api/profile-photo/testuser?v=1'
        page.evaluate('window.dispatchEvent(new Event("cocowheels:profile-changed"))')
        expect(button.locator('img')).to_have_class('profile-menu-photo loaded')
        expect(button.locator('.profile-update-badge')).to_have_text('1')
        assert button.locator('.profile-update-badge').evaluate('(e) => { const r=e.getBoundingClientRect(); return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2) === e; }')
        assert button.bounding_box() == original
        assert button.locator('img').evaluate('(e) => getComputedStyle(e).borderRadius') == '50%'
        button.click()
        expect(button).to_have_attribute('aria-expanded', 'true')
        expect(page.locator('#guest-identity-popover')).to_have_css('opacity', '1')
        page.screenshot(path=f'/tmp/profile-menu-photo-{width}.png', full_page=True)
        page.keyboard.press('Escape')
        expect(button).to_have_attribute('aria-expanded', 'false')
        state['broken'] = True
        state['photo'] = '/api/profile-photo/testuser?v=2'
        page.evaluate('window.dispatchEvent(new Event("cocowheels:profile-changed"))')
        expect(button.locator('img')).to_have_attribute('src', re.compile(r'/api/profile-photo/testuser\?v=2$'))
        expect(button.locator('img')).to_have_css('opacity', '0')
        expect(button.locator('svg')).to_be_visible()
        state['signed'] = False
        page.evaluate('window.dispatchEvent(new Event("cocowheels:identity-changed"))')
        expect(button.locator('img')).to_have_count(0)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        assert not errors, errors
        print(f'PASS {width}: photo refresh, fallback, menu, sign-out, unchanged dimensions, no overflow/errors')
        context.close()
    browser.close()
