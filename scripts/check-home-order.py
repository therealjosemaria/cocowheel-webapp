"""Check local Home CTAs; mock all APIs and block external traffic."""
from playwright.sync_api import sync_playwright, expect

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width in [320, 390, 844, 1440]:
        page = browser.new_page(viewport={'width': width, 'height': 900})
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.route('**/*', lambda r: r.continue_() if r.request.url.startswith('http://127.0.0.1:3090') else r.abort())
        def api(route):
            path = route.request.url.split('/api/')[-1].split('?')[0]
            data = {'unikey': 'ride1234'} if path == 'university/session' else {'current': None, 'currents': []}
            route.fulfill(json=data)
        page.route('**/api/**', api)
        page.goto('http://127.0.0.1:3090/')
        buttons = page.locator('.role-choice > button')
        expect(buttons).to_have_text(['FIND A RIDE', 'OFFER A RIDE'])
        assert buttons.nth(0).bounding_box()['y'] < buttons.nth(1).bounding_box()['y']
        assert buttons.nth(0).evaluate('(el) => getComputedStyle(el).backgroundColor') == 'rgb(17, 24, 39)'
        assert buttons.nth(1).evaluate('(el) => getComputedStyle(el).backgroundColor') == 'rgb(255, 255, 255)'
        buttons.nth(0).focus()
        page.keyboard.press('Tab')
        expect(buttons.nth(1)).to_be_focused()
        page.screenshot(path=f'/tmp/home-order-{width}.png', full_page=True, animations='disabled')
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        buttons.nth(0).click()
        expect(page.get_by_role('heading', name='Find a ride', exact=True)).to_be_visible()
        page.goto('http://127.0.0.1:3090/')
        page.locator('.role-choice > button').nth(1).click()
        expect(page.get_by_role('heading', name='Offer a ride', exact=True)).to_be_visible()
        mobile = width < 1000
        if mobile:
            page.get_by_role('button', name='Open menu', exact=True).click()
        nav = page.get_by_role('navigation', name='Mobile navigation' if mobile else 'Primary navigation', exact=True)
        expect(nav.locator('button')).to_have_text(['Find a ride', 'Offer a ride'])
        page.screenshot(path=f'/tmp/menu-order-{width}.png', full_page=True, animations='disabled')
        nav.get_by_role('button', name='Find a ride', exact=True).click()
        expect(page.get_by_role('heading', name='Find a ride', exact=True)).to_be_visible()
        if mobile:
            page.get_by_role('button', name='Open menu', exact=True).click()
        expect(nav.get_by_role('button', name='Find a ride', exact=True)).to_have_attribute('aria-pressed', 'true')
        nav.get_by_role('button', name='Offer a ride', exact=True).click()
        expect(page.get_by_role('heading', name='Offer a ride', exact=True)).to_be_visible()
        assert not errors, errors
        print(f'PASS Home/menu order, colours, keyboard and destinations: {width}px')
        page.close()
    browser.close()
