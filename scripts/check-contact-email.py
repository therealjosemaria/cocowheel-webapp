"""Public contact page regression; isolated Next :3090, no email sent."""
from playwright.sync_api import sync_playwright, expect

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width in [320, 390, 1440]:
        context = browser.new_context(viewport={'width': width, 'height': 900})
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.route('**/*', lambda r: r.continue_() if r.request.url.startswith('http://127.0.0.1:3090') else r.abort())
        page.route('**/api/**', lambda r: r.fulfill(status=401, json={'error': 'UNIVERSITY_VERIFICATION_REQUIRED'}))
        for path in ['help', 'privacy', 'terms']:
            page.goto(f'http://127.0.0.1:3090/{path}')
            links = page.locator('a[href^="mailto:"]')
            expect(links).to_have_count(1)
            expected = 'mailto:jose@gumwheel.com' + ('?subject=GUMWHEEL%20suggestion' if path == 'help' else '')
            expect(links).to_have_attribute('href', expected)
            expect(links).to_have_text('Email us' if path == 'help' else 'jose@gumwheel.com')
            expect(page.locator('body')).not_to_contain_text('jmos0905@uni.sydney.edu.au')
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            page.screenshot(path=f'/tmp/contact-email-{path}-{width}.png', full_page=True)
            print(f'PASS {path} {width}px', flush=True)
        assert not errors, errors
        context.close()
    browser.close()
