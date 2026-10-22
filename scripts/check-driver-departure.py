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
                ride['conversations']=[{'requestId':'request','peer':'guest','unread':0,'stopped':False}]
                ride['request']={'requestId':'request','status':'PENDING','pickup':origin,'destination':end,
                                 'riderAlias':'ride1234','createdAt':departure,'requestedDepartureAt':departure}
            elif state['status']=='ACCEPTED':
                ride['requests']=[{'requestId':'request','status':'ACCEPTED','pickup':origin,'destination':end,'riderAlias':'ride1234','requestedDepartureAt':departure}]
                ride['conversations']=[{'requestId':'request','peer':'ride1234','unread':0,'stopped':False}]
            item={'role':state['role'],'ride':ride}
            if path=='university/session': data={'unikey':'driv1234' if state['role']=='DRIVER' else 'ride1234'}
            elif path=='current': data={'current':item,'currents':[item]}
            elif path=='history': data={'driver':[ride] if state['role']=='DRIVER' else [],'rider':[ride] if state['role']=='RIDER' else []}
            elif path=='search': data={'candidates':[{'rideId':f'colour-{minutes}','driverAlias':f'driver{index}','priceAud':0,'directionFit':'GOOD','redactedCorridor':[origin,end],'expiresAt':'2099-01-01T00:00:00Z','pickupDistanceMeters':0,'destinationDistanceMeters':0,'isOwnOffer':False,'departureLabel':origin['label'],'destinationLabel':end['label'],'scheduledDepartureAt':(datetime.now(timezone.utc)+timedelta(minutes=minutes)).isoformat()} for index,minutes in enumerate([109,5,-109])]}
            elif path=='route-preview': data={'points':[origin,end],'durationSeconds':600}
            elif '/conversations/' in path: data={'messages':[],'stopped':False}
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
        expect(page.locator('.preview-driver-departure .driver-departure-status')).to_have_text('In 30 min')
        expect(page.locator('.preview-driver-departure time')).to_have_attribute('datetime',departure)
        expect(page.get_by_text('Sydney time',exact=False)).to_have_count(0)
        page.screenshot(path=f'/tmp/driver-departure-{width}.png',full_page=True,animations='disabled')
        for minutes, tone, colour in [(109,'scheduled','rgb(22, 101, 52)'),(5,'soon','rgb(133, 77, 14)'),(-109,'delayed','rgb(180, 35, 24)')]:
            departure=(datetime.now(timezone.utc)+timedelta(minutes=minutes)).isoformat()
            page.reload()
            value=page.locator(f'.preview-driver-departure .departure-tone-{tone}')
            expect(value).to_be_visible()
            expect(value).to_have_css('color',colour)
            expect(page.locator('.preview-driver-departure time')).to_have_attribute('datetime',departure)
            expect(page.locator('.preview-driver-departure time')).to_have_css('color','rgb(17, 24, 39)')
            if tone=='delayed': expect(value).to_have_text('Delayed 1 hr 49 min')
            if tone=='scheduled': expect(value).to_have_text('In 1 hr 49 min')
            value.scroll_into_view_if_needed()
            page.screenshot(path=f'/tmp/departure-{tone}-{width}.png',animations='disabled')
        for status in ['CO_RIDE_ACTIVE','COMPLETED']:
            state['status']=status
            page.reload()
            expect(page.locator('.ride-preview-fields')).to_be_visible()
            expect(page.locator('.preview-driver-departure')).to_have_count(0)
        state['status']='ACCEPTED'
        page.reload()
        chat=page.locator('#messages-request')
        expect(chat).to_be_visible()
        expect(chat).not_to_have_attribute('open','')
        chat.locator('summary').click()
        suggestion=page.get_by_role('button',name='Hi! Where would you like me to pick you up?',exact=True)
        expect(suggestion).to_be_visible()
        suggestion.click()
        expect(chat.get_by_role('textbox',name='Message',exact=True)).to_have_value('Hi! Where would you like me to pick you up?')
        page.screenshot(path=f'/tmp/driver-message-starter-{width}.png',full_page=True,animations='disabled')
        chat.locator('summary').click()
        expect(chat).not_to_have_attribute('open','')
        page.evaluate("location.hash = 'messages-request'")
        expect(chat).to_have_attribute('open','')
        page.evaluate("history.replaceState(history.state, '', location.pathname)")
        state.update(role='RIDER',status='REQUESTED')
        departure=(datetime.now(timezone.utc)+timedelta(minutes=30)).isoformat()
        page.reload()
        expect(page.locator('.ride-preview-fields')).to_be_visible()
        expect(page.locator('.preview-driver-departure')).to_have_count(0)
        expect(page.get_by_text('Sydney time',exact=False)).to_have_count(0)
        cell=page.locator('.ride-preview-fields .preview-rider-departure')
        expect(cell.locator('dt')).to_have_text('Departure')
        expect(cell.locator('time')).to_have_attribute('datetime',departure)
        expect(cell.locator('.driver-departure-status')).to_have_text('In 30 min')
        expect(page.locator('.ride-preview-summary > .usual-route-hint')).to_have_count(0)
        expect(page.get_by_text('Messages with guest',exact=False)).to_be_visible()
        duration=page.locator('.ride-preview-fields > div').filter(has=page.get_by_text('Estimated duration',exact=True))
        assert abs(cell.bounding_box()['y']-duration.bounding_box()['y'])<1
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        page.screenshot(path=f'/tmp/rider-departure-cell-{width}.png',full_page=True,animations='disabled')
        for minutes,expected in [(109,'In 1 hr 49 min'),(-109,'Delayed 1 hr 49 min')]:
            departure=(datetime.now(timezone.utc)+timedelta(minutes=minutes)).isoformat()
            page.reload()
            expect(cell.locator('time')).to_have_attribute('datetime',departure)
            expect(cell.locator('.driver-departure-status')).to_have_text(expected)
        for status in ['ACCEPTED','CO_RIDE_ACTIVE','COMPLETED']:
            state['status']=status
            page.reload()
            expect(page.locator('.ride-preview-fields')).to_be_visible()
            expect(page.locator('.preview-rider-departure')).to_have_count(0)
        page.evaluate('draft => sessionStorage.setItem("cocowheels:find-ride-draft:v1", JSON.stringify({...draft,savedAt:Date.now()}))', {'pickup':origin,'destination':end,'departureAt':None})
        page.goto('http://127.0.0.1:3090/?start=rider')
        for tone,colour in [('scheduled','rgb(22, 101, 52)'),('soon','rgb(133, 77, 14)'),('delayed','rgb(180, 35, 24)')]:
            value=page.locator(f'.ride-option-departure.departure-tone-{tone}')
            expect(value).to_be_visible()
            expect(value).to_have_css('color',colour)
            if tone=='delayed': expect(value).to_have_text('Delayed 1 hr 49 min')
            if tone=='scheduled': expect(value).to_have_text('Departs in 1 hr 49 min')
        expect(page.locator('.ride-option time')).to_have_count(0)
        page.locator('.ride-option-departure').last.scroll_into_view_if_needed()
        page.screenshot(path=f'/tmp/departure-discovery-{width}.png',animations='disabled')
        assert not errors,errors
        print(f'PASS driver countdown, role gates and Home width {width}px')
        page.close()
    browser.close()
