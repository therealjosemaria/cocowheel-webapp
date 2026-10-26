"""Check local Home CTAs; mock all APIs and block external traffic."""
from playwright.sync_api import sync_playwright, expect
import os

BASE = os.environ.get('GUMWHEEL_TEST_URL', 'http://127.0.0.1:3201')

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width in [320, 390, 844, 1440]:
        page = browser.new_page(viewport={'width': width, 'height': 900})
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.route('**/*', lambda r: r.continue_() if r.request.url.startswith(BASE + '/') else r.abort())
        def api(route):
            path = route.request.url.split('/api/')[-1].split('?')[0]
            data = {'unikey': 'ride1234'} if path == 'university/session' else {'current': None, 'currents': []}
            route.fulfill(json=data)
        page.route('**/api/**', api)
        page.goto(BASE + '/')
        buttons = page.locator('.role-choice > button')
        expect(buttons).to_have_text(['FIND A JOURNEY', 'POST A JOURNEY'])
        assert buttons.nth(0).bounding_box()['y'] < buttons.nth(1).bounding_box()['y']
        assert buttons.nth(0).evaluate('(el) => getComputedStyle(el).backgroundColor') == 'rgb(17, 24, 39)'
        assert buttons.nth(1).evaluate('(el) => getComputedStyle(el).backgroundColor') == 'rgb(255, 255, 255)'
        buttons.nth(0).focus()
        page.keyboard.press('Tab')
        expect(buttons.nth(1)).to_be_focused()
        page.screenshot(path=f'/tmp/home-order-{width}.png', full_page=True, animations='disabled')
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        buttons.nth(0).click()
        expect(page.get_by_role('heading', name='Find a journey', exact=True)).to_be_visible()
        page.screenshot(path=f'/tmp/journey-find-{width}.png', full_page=True, animations='disabled')
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        page.goto(BASE + '/')
        page.locator('.role-choice > button').nth(1).click()
        expect(page.get_by_role('heading', name='Post a journey', exact=True)).to_be_visible()
        page.screenshot(path=f'/tmp/journey-post-{width}.png', full_page=True, animations='disabled')
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        mobile = width < 1000
        if mobile:
            page.get_by_role('button', name='Open menu', exact=True).click()
        nav = page.get_by_role('navigation', name='Mobile navigation' if mobile else 'Primary navigation', exact=True)
        expect(nav.locator('button')).to_have_text(['Find a journey', 'Post a journey'])
        page.screenshot(path=f'/tmp/menu-order-{width}.png', full_page=True, animations='disabled')
        nav.get_by_role('button', name='Find a journey', exact=True).click()
        expect(page.get_by_role('heading', name='Find a journey', exact=True)).to_be_visible()
        if mobile:
            page.get_by_role('button', name='Open menu', exact=True).click()
        expect(nav.get_by_role('button', name='Find a journey', exact=True)).to_have_attribute('aria-pressed', 'true')
        nav.get_by_role('button', name='Post a journey', exact=True).click()
        expect(page.get_by_role('heading', name='Post a journey', exact=True)).to_be_visible()
        page.goto(BASE + '/help')
        expect(page.get_by_role('heading', name='Find a journey', exact=True)).to_be_visible()
        expect(page.get_by_role('heading', name='Post a journey', exact=True)).to_be_visible()
        page.screenshot(path=f'/tmp/journey-help-{width}.png', full_page=True, animations='disabled')
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        assert not errors, errors
        print(f'PASS Home/menu order, colours, keyboard and destinations: {width}px')
        page.close()
    browser.close()
