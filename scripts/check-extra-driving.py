"""Local :3090 only. Synthetic rides, mocked APIs, no external requests."""
from playwright.sync_api import sync_playwright, expect

expect.set_options(timeout=20000)
pins = [dict(latitude=-33.88, longitude=151.20+i*.01, label=f'Test stop {i}') for i in range(5)]
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width in [320, 390, 1440]:
        context = browser.new_context(viewport={'width':width,'height':900})
        page = context.new_page()
        errors=[]
        page.on('pageerror', lambda e: errors.append(str(e)))
        state={'role':'DRIVER','fail':False}
        def respond(r):
            path=r.request.url.split('/api/')[-1].split('?')[0]
            requests=[dict(requestId=f'req-{i}',riderAlias=f'rider{i}',status='PENDING',pickup=pins[1],destination=pins[i],createdAt='2026-10-23T00:00:00Z',requestedDepartureAt='2026-10-23T00:00:00Z',directionFit='GOOD') for i in [2,3]]
            ride=dict(rideId='detour',driverAlias='driver1',role=state['role'],status='PUBLISHED',priceAud=0,scheduledDepartureAt='2099-01-01T00:00:00Z',expiresAt='2099-01-02T00:00:00Z',plannedRoute={'origin':pins[0],'destination':pins[4]},requests=requests)
            if path=='university/session': data={'unikey':'driver1' if state['role']=='DRIVER' else 'rider2'}
            elif path=='current': data={'current':None,'currents':[]}
            elif path.startswith('rides/detour'): data={'ride':ride}
            elif path=='route-preview':
                body=r.request.post_data_json
                a=round((body['origin']['longitude']-151.20)/.01)
                b=round((body['destination']['longitude']-151.20)/.01)
                if state['fail']:
                    r.fulfill(status=503,json={'error':'ROUTE_PREVIEW_UNAVAILABLE'}); return
                seconds={(0,4):1500,(0,1):300,(1,2):1000,(2,4):680,(1,3):1100,(3,4):700}.get((a,b),600)
                data={'points':[body['origin'],body['destination']],'durationSeconds':seconds,'distanceMeters':1000}
            else: data={}
            r.fulfill(json=data)
        page.route('**/*',lambda r:r.continue_() if r.request.url.startswith('http://127.0.0.1:3090') else r.abort())
        page.route('**/api/**',respond)
        page.goto('http://127.0.0.1:3090/activity/detour')
        cards=page.locator('.driver-request-accordion')
        expect(cards).to_have_count(2)
        expect(page.locator('.extra-driving-estimate')).to_have_count(0)
        for i,label in [(0,'About 8 min'),(1,'About 10 min')]:
            cards.nth(i).locator('summary').first.click()
            expect(cards.nth(i).locator('.extra-driving-estimate')).to_have_text(label)
            expect(cards.nth(i).get_by_role('button',name='Show route',exact=True)).to_have_attribute('aria-pressed','false')
            expect(cards.nth(i).locator('.request-extra-driving dt svg')).to_have_count(1)
            requested=cards.nth(i).locator('.driver-request-fields > div').nth(2).bounding_box()
            extra=cards.nth(i).locator('.request-extra-driving').bounding_box()
            assert abs(requested['x']-extra['x']) < 1 and extra['y'] > requested['y']
        cards.nth(0).get_by_role('button',name='Show route',exact=True).click()
        expect(cards.nth(0).get_by_role('button',name='Hide route',exact=True)).to_have_attribute('aria-pressed','true')
        cards.nth(1).get_by_role('button',name='Show route',exact=True).click()
        expect(cards.nth(0).get_by_role('button',name='Show route',exact=True)).to_have_attribute('aria-pressed','false')
        expect(cards.nth(1).get_by_role('button',name='Hide route',exact=True)).to_have_attribute('aria-pressed','true')
        assert cards.locator(':scope[open]').count()==2
        expect(cards.nth(0).locator('.extra-driving-estimate')).to_have_text('About 8 min')
        cards.nth(1).get_by_role('button',name='Hide route',exact=True).click()
        expect(cards.nth(1).locator('.extra-driving-estimate')).to_have_text('About 10 min')
        expect(page.get_by_role('button',name='Hide route',exact=True)).to_have_count(0)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        page.screenshot(path=f'/tmp/extra-driving-{width}.png',full_page=True)
        state['fail']=True
        page.reload()
        cards.nth(0).locator('summary').first.click()
        expect(cards.nth(0).locator('.extra-driving-estimate')).to_have_text('Estimate unavailable')
        state['fail']=False
        cards.nth(0).locator('summary').first.click()
        cards.nth(0).locator('summary').first.click()
        expect(cards.nth(0).locator('.extra-driving-estimate')).to_have_text('About 8 min')
        state['role']='RIDER'
        page.reload()
        expect(page.locator('.extra-driving-estimate')).to_have_count(0)
        assert not errors,errors
        print(f'PASS {width}: lazy estimates, two requests, switching/hide, failure, rider isolation, no overflow/errors')
        context.close()
    browser.close()
