"""Local :3090; mock APIs and block providers. No production ride mutations."""
from datetime import datetime, timezone, timedelta
from playwright.sync_api import sync_playwright, expect

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    for width in [390,1440]:
        page=browser.new_page(viewport={'width':width,'height':900})
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        state={'role':'DRIVER','status':'PUBLISHED'}
        origin={'latitude':-33.88,'longitude':151.2,'label':'Town Hall, Sydney'}
        end={'latitude':-33.9,'longitude':151.25,'label':'University of Sydney'}
        departure=(datetime.now(timezone.utc)+timedelta(minutes=30)).isoformat()
        def respond(r):
            path=r.request.url.split('/api/')[-1].split('?')[0]
            ride={'rideId':'driver-countdown','status':state['status'],'driverAlias':'driv1234','priceAud':0,
                  'scheduledDepartureAt':departure,'expiresAt':'2099-01-01T00:00:00Z',
                  'plannedRoute':{'origin':origin,'destination':end},
                  'pickupEstablished':state['status']=='CO_RIDE_ACTIVE','requests':[]}
            if state['role']=='RIDER':
                ride['request']={'requestId':'request','status':'PENDING','pickup':origin,'destination':end,
                                 'riderAlias':'ride1234','createdAt':departure,'requestedDepartureAt':departure}
            item={'role':state['role'],'ride':ride}
            if path=='university/session': data={'unikey':'driv1234' if state['role']=='DRIVER' else 'ride1234'}
            elif path=='current': data={'current':item,'currents':[item]}
            elif path=='history': data={'driver':[ride] if state['role']=='DRIVER' else [],'rider':[ride] if state['role']=='RIDER' else []}
            elif path=='route-preview': data={'points':[origin,end],'durationSeconds':600}
            elif path.startswith('rides/'): data={'ride':ride,'serverNow':datetime.now(timezone.utc).isoformat()}
            else: data={}
            r.fulfill(json=data)
        page.route('**/*',lambda r:r.continue_() if r.request.url.startswith('http://127.0.0.1:3090') else r.abort())
        page.route('**/api/**',respond)
        page.goto('http://127.0.0.1:3090/')
        card=page.locator('.home-current-ride')
        expect(card).to_be_visible()
        button=page.locator('.role-card').first
        assert abs(card.bounding_box()['width']-button.bounding_box()['width'])<1
        page.screenshot(path=f'/tmp/home-current-width-{width}.png',full_page=True,animations='disabled')
        page.goto('http://127.0.0.1:3090/activity/driver-countdown')
        expect(page.locator('.preview-driver-departure dd')).to_have_text('In 30 min')
        expect(page.get_by_text('Sydney time',exact=False)).to_have_count(0)
        page.screenshot(path=f'/tmp/driver-departure-{width}.png',full_page=True,animations='disabled')
        for status in ['CO_RIDE_ACTIVE','COMPLETED']:
            state['status']=status
            page.reload()
            expect(page.locator('.ride-preview-fields')).to_be_visible()
            expect(page.locator('.preview-driver-departure')).to_have_count(0)
        state.update(role='RIDER',status='REQUESTED')
        page.reload()
        expect(page.locator('.ride-preview-fields')).to_be_visible()
        expect(page.locator('.preview-driver-departure')).to_have_count(0)
        expect(page.get_by_text('Sydney time',exact=False)).to_have_count(0)
        assert not errors,errors
        print(f'PASS driver countdown, role gates and Home width {width}px')
        page.close()
    browser.close()
