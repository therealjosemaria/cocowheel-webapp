"""Mocked Profile layout regression; isolated Next frontend on localhost:3090."""
from playwright.sync_api import sync_playwright, expect

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width in [320, 390, 844, 1440]:
        for rated in [False, True]:
            context = browser.new_context(viewport={'width': width, 'height': 900})
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda e: errors.append(str(e)))
            def respond(r):
                path = r.request.url.split('/api/')[-1].split('?')[0]
                if path == 'university/session':
                    r.fulfill(json={'unikey':'mosciarobusiness@gmail.com', 'canAdmin':False,
                        'ratings': {'driver': {'average':4.8, 'count':10} if rated else None, 'rider':None}})
                elif path == 'current':
                    r.fulfill(json={'current':None, 'currents':[]})
                elif path == 'usual-route':
                    r.fulfill(json={'route':None, 'alertsAvailable':True})
                else:
                    r.fulfill(json={})
            page.route('**/*', lambda r: r.continue_() if r.request.url.startswith('http://127.0.0.1:3090') else r.abort())
            page.route('**/api/**', respond)
            page.goto('http://127.0.0.1:3090/')
            page.get_by_role('button', name='Profile:', exact=False).click()
            panel = page.locator('#guest-identity-popover')
            expect(panel).to_have_css('opacity', '1')
            rider = panel.locator('.profile-ratings > div').nth(1)
            expect(rider).to_contain_text('Not enough ratings yet')
            link = panel.get_by_role('link', name='My usual route', exact=True)
            logout = panel.get_by_role('button', name='Sign out', exact=True)
            a, b, rating = link.bounding_box(), logout.bounding_box(), rider.bounding_box()
            assert a['y'] >= rating['y'] + rating['height'] + 11.9, (a, rating)
            assert abs(a['width']-b['width']) < 0.1 and abs(a['height']-b['height']) < 0.1, (a,b)
            assert abs(b['y'] - a['y'] - a['height'] - 12) < 0.1, (a,b)
            for prop in ['font-size','font-family','font-weight','border-radius','border-top-width','padding-top','color']:
                assert link.evaluate('(e,p)=>getComputedStyle(e).getPropertyValue(p)',prop) == logout.evaluate('(e,p)=>getComputedStyle(e).getPropertyValue(p)',prop), prop
            bounds = panel.bounding_box()
            assert bounds['x'] >= 0 and bounds['x']+bounds['width'] <= width
            assert a['height'] >= 44
            page.screenshot(path=f'/tmp/profile-layout-{width}-{rated}.png')
            link.focus()
            link.press('Enter')
            expect(page).to_have_url('http://127.0.0.1:3090/usual-route')
            expect(page.get_by_role('heading', name='My usual route', exact=True)).to_be_visible()
            assert not errors, errors
            print(f'PASS Profile {width}px rated={rated}', flush=True)
            context.close()
    browser.close()
