"""Isolated browser check; no live API writes or external providers."""
from playwright.sync_api import sync_playwright, expect

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width in [320, 390, 844, 1440]:
        page = browser.new_page(viewport={'width': width, 'height': 900}, has_touch=width < 700)
        errors = []
        writes = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.route('**/*', lambda r: r.continue_() if r.request.url.startswith('http://127.0.0.1:3090') else r.abort())
        def api(route):
            if route.request.method != 'GET': writes.append(route.request.url)
            path = route.request.url.split('/api/')[-1].split('?')[0]
            route.fulfill(json={'unikey':'ride1234'} if path == 'university/session' else {'current':None,'currents':[]})
        page.route('**/api/**', api)
        page.goto('http://127.0.0.1:3090/?start=driver')
        trigger = page.get_by_role('button', name='Leaving in 30 min', exact=True)
        expect(trigger).to_be_visible()
        trigger.click()
        wheel = page.get_by_role('listbox', name='Departure delay')
        expect(wheel).to_be_focused()
        expect(page.get_by_role('option')).to_have_count(48)
        page.keyboard.press('ArrowDown')
        expect(page.get_by_role('option', selected=True)).to_have_text('In 1 hr')
        page.keyboard.press('ArrowDown')
        expect(page.get_by_role('option', selected=True)).to_have_text('In 1 hr 30 min')
        page.keyboard.press('End')
        expect(page.get_by_role('option', selected=True)).to_have_text('In 24 hr')
        page.get_by_role('button', name='DONE', exact=True).click()
        trigger = page.get_by_role('button', name='Leaving in 24 hr', exact=True)
        expect(trigger).to_be_focused()
        page.screenshot(path=f'/tmp/departure-form-{width}.png',full_page=True)
        trigger.click()
        expect(page.get_by_role('option', selected=True)).to_have_text('In 24 hr')
        page.keyboard.press('Home')
        page.keyboard.press('Escape')
        expect(trigger).to_be_focused()
        trigger.click()
        # Simulate the scroll position produced by a touch/trackpad swipe.
        wheel.evaluate('(el) => { el.scrollTop = 23 * 44; }')
        expect(page.get_by_role('option', selected=True)).to_have_text('In 12 hr')
        page.screenshot(path=f'/tmp/departure-wheel-{width}.png',full_page=True)
        page.keyboard.press('Shift+Tab')
        expect(page.get_by_role('button', name='GO BACK')).to_be_focused()
        page.get_by_role('button', name='GO BACK').click()
        expect(trigger).to_be_focused()
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        assert not errors, errors
        assert not writes, writes
        print(f'PASS {width}px: 48 choices, keyboard, scroll, boundaries, Done, cancel, focus, no writes/overflow')
        page.close()
    browser.close()
