"""Shared search overlay, all contexts. Mock providers/APIs; no live writes."""
from playwright.sync_api import sync_playwright, expect

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width in [320, 390, 844, 1440]:
        for view in ['?start=driver', '?start=rider', 'usual-route']:
            page = browser.new_page(viewport={'width':width,'height':900})
            errors=[]
            page.on('pageerror',lambda e: errors.append(str(e)))
            page.route('**/*',lambda r:r.continue_() if r.request.url.startswith('http://127.0.0.1:3090') else r.abort())
            def respond(r):
                path=r.request.url.split('/api/')[-1].split('?')[0]
                if path=='university/session': data={'unikey':'ride1234'}
                elif path=='usual-route': data={'route':None,'alertsAvailable':True}
                elif path=='place-search': data={'places':[{'latitude':-33.88+i/1000,'longitude':151.2,'label':f'{i} Example Street, Sydney','countryCode':'au'} for i in range(12)]}
                else: data={'current':None,'currents':[]}
                r.fulfill(json=data)
            page.route('**/api/**',respond)
            page.goto('http://127.0.0.1:3090/'+view)
            if view=='usual-route': page.locator('summary').filter(has_text='Usual route').click()
            origin=page.get_by_placeholder('Where from?',exact=True)
            destination=page.get_by_placeholder('Where to?',exact=True)
            origin.fill('Example')
            before=destination.bounding_box()['y']
            origin.press('Enter')
            results=page.get_by_role('region',name='Destination search results')
            expect(results).to_be_visible()
            assert abs(destination.bounding_box()['y']-before)<1
            anchor=page.locator('.place-search-input').first.bounding_box()
            box=results.bounding_box()
            assert abs(box['width']-anchor['width'])<1
            assert box['y'] >= anchor['y']+anchor['height']
            assert box['y']+box['height'] <= 900
            assert results.evaluate('(el)=>el.scrollHeight>el.clientHeight')
            page.screenshot(path=f'/tmp/overlay-{view.replace("?start=","")}-{width}.png',full_page=True)
            origin.press('ArrowDown')
            expect(results.get_by_role('button').first).to_be_focused()
            page.keyboard.press('ArrowDown')
            expect(results.get_by_role('button').nth(1)).to_be_focused()
            page.keyboard.press('Escape')
            expect(results).to_have_count(0)
            expect(origin).to_be_focused()
            origin.press('Enter')
            expect(results).to_be_visible()
            page.get_by_role('heading',level=1).click()
            expect(results).to_have_count(0)
            origin.press('Enter')
            expect(results).to_be_visible()
            results.get_by_role('button').nth(2).click()
            expect(origin).to_have_value('2 Example Street, Sydney')
            expect(destination).to_be_focused()
            expect(results).to_have_count(0)
            # Reduced viewport models the space remaining above an on-screen keyboard.
            page.set_viewport_size({'width':width,'height':500})
            destination.fill('Example')
            destination.press('Enter')
            expect(results).to_be_visible()
            box=results.bounding_box()
            assert box['y']>=0 and box['y']+box['height']<=500
            page.keyboard.press('Escape')
            assert not errors, errors
            print(f'PASS {view} {width}: no shift, fit, scrolling, keyboard, outside dismissal, selection')
            page.close()
    browser.close()
