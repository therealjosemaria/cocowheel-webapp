"""Isolated frontend :3090; all APIs mocked and external requests blocked."""
import json
from datetime import datetime, timezone
from playwright.sync_api import sync_playwright, expect
expect.set_options(timeout=15000)  # Allow dev compilation on the shared Pi.

origin = {'latitude': -33.88, 'longitude': 151.20, 'label': 'Town Hall, Sydney'}
destination = {'latitude': -33.88, 'longitude': 151.25, 'label': 'University of Sydney'}
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width in [320, 390, 844, 1440]:
        context = browser.new_context(viewport={'width': width, 'height': 900})
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        state = {'role': 'RIDER', 'fare': 0, 'status': 'ACCEPTED', 'writes': [], 'current':False}
        request = {'requestId':'req-free', 'riderAlias':'ride1234', 'status':'ACCEPTED', 'pickup':origin, 'destination':destination, 'createdAt':datetime.now(timezone.utc).isoformat(), 'requestedDepartureAt':datetime.now(timezone.utc).isoformat(), 'directionFit':'GOOD'}
        def respond(r):
            path = r.request.url.split('/api/')[-1].split('?')[0]
            ride = {'rideId':'free-trip', 'driverAlias':'driv1234', 'role':state['role'], 'status':state['status'], 'priceAud':state['fare'],
                'scheduledDepartureAt':datetime.now(timezone.utc).isoformat(), 'expiresAt':'2099-01-01T00:00:00Z',
                'plannedRoute':{'origin':origin,'destination':destination}, 'request':request, 'requests':[request],
                'pickupEstablished':state['status'] == 'CO_RIDE_ACTIVE', 'coRideCode':'1234' if state['role']=='RIDER' else None,
                'paymentMethod':'PAYID' if state['fare'] else None,
                'payId':'driver@example.com' if state['fare'] and (state['role']=='DRIVER' or state['status']=='CO_RIDE_ACTIVE') else None, 'payIdType':'EMAIL'}
            if state['role']=='DRIVER':
                ride.pop('request')
                ride['rider']={'alias':'ride1234','pickup':origin,'destination':destination,'requestedDepartureAt':request['requestedDepartureAt'],'directionFit':'GOOD'}
            if path == 'university/session': data = {'unikey':'driv1234' if state['role']=='DRIVER' else 'ride1234'}
            elif path == 'current':
                item={'role':state['role'],'ride':ride}
                data = {'current':item if state['current'] else None,'currents':[item] if state['current'] else []}
            elif path == 'history': data = {'driver':[ride] if state['role']=='DRIVER' else [],'rider':[ride] if state['role']=='RIDER' else []}
            elif path == 'place-search': data = {'places':[destination]}
            elif path == 'place-label': data = {'label':origin['label']}
            elif path == 'route-preview': data = {'points':[origin,destination],'durationSeconds':600}
            elif path == 'rides' and r.request.method=='POST':
                state['writes'].append(r.request.post_data_json)
                r.fulfill(status=409,json={'error':'OPEN_ITEM_EXISTS'}); return
            elif path.startswith('rides/free-trip'): data = {'ride':ride}
            elif path == 'search': data = {'candidates':[dict(ride, directionFit='GOOD',redactedCorridor=[origin,destination],pickupDistanceMeters=100,destinationDistanceMeters=100,isOwnOffer=False)]}
            else: data = {}
            r.fulfill(json=data)
        page.route('**/*', lambda r: r.continue_() if r.request.url.startswith('http://127.0.0.1:3090') else r.abort())
        page.route('**/api/**', respond)
        page.goto('http://127.0.0.1:3090/?start=driver')
        expect(page.locator('.contribution-choice > summary')).to_have_text('Fare · Free')
        expect(page.get_by_label('Your PayID mobile', exact=True)).to_have_count(0)
        page.wait_for_timeout(300)  # Let the initial form transition settle before capture.
        page.screenshot(path=f'/tmp/free-offer-{width}.png',full_page=True)
        page.locator('.contribution-choice > summary').click()
        checkbox = page.get_by_label('Ask for a contribution', exact=True)
        expect(checkbox).not_to_be_checked()
        checkbox.check()
        expect(page.get_by_label('Your PayID mobile', exact=True)).to_be_visible()
        page.get_by_role('radio', name='Email', exact=True).click()
        page.get_by_label('Your PayID email', exact=True).fill('driver@example.com')
        page.screenshot(path=f'/tmp/paid-offer-{width}.png',full_page=True)
        page.locator('.contribution-choice > summary').click()
        expect(checkbox).to_be_checked()  # Collapsing must never change the fare.
        page.locator('.contribution-choice > summary').click()
        checkbox.uncheck()
        expect(page.get_by_label('Your PayID email', exact=True)).to_have_count(0)
        page.evaluate("() => { navigator.geolocation.getCurrentPosition=(ok)=>ok({coords:{latitude:-33.88,longitude:151.2,accuracy:10},timestamp:Date.now()}); }")
        page.get_by_role('button',name='Use current location',exact=True).click()
        # Initial location consent uses the app's existing modal.
        if page.get_by_role('button',name='USE CURRENT LOCATION',exact=True).count():
            page.get_by_role('button',name='USE CURRENT LOCATION',exact=True).click()
        page.get_by_placeholder('Search destination',exact=True).fill('University')
        page.locator('.place-search').last.get_by_role('button',name='Search',exact=True).click()
        page.get_by_role('button',name=destination['label'],exact=True).click()
        page.get_by_role('button',name='OFFER A RIDE',exact=True).click()
        expect(page.get_by_role('dialog')).to_be_visible()
        assert state['writes'][-1]['priceAud']==0 and state['writes'][-1]['payId']==''
        page.get_by_role('button',name='OKAY',exact=True).click()
        checkbox.check()
        page.get_by_label('You receive', exact=True).fill('1.50')
        page.get_by_role('button',name='OFFER A RIDE',exact=True).click()
        expect(page.get_by_role('dialog')).to_be_visible()
        assert state['writes'][-1]['priceAud']==1.5 and state['writes'][-1]['payId']=='driver@example.com'
        for role in ['RIDER','DRIVER']:
            for status in ['ACCEPTED','CO_RIDE_ACTIVE','COMPLETED']:
                state.update(role=role,status=status,fare=0)
                page.goto('http://127.0.0.1:3090/activity/free-trip')
                expect(page.locator('.ride-preview-summary')).to_contain_text('Free')
                if role=='DRIVER':
                    expect(page.locator('.ride-preview-summary').get_by_text('Driver',exact=True)).to_have_count(0)
                    if status=='ACCEPTED':
                        expect(page.get_by_label('Pickup code digit 1',exact=True)).to_be_visible()
                expect(page.locator('.preview-field-payment,.preview-driver-payment')).to_have_count(0)
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
                page.screenshot(path=f'/tmp/free-detail-{role}-{status}-{width}.png',full_page=True)
        state.update(role='RIDER',status='ACCEPTED',fare=5)
        page.reload()
        expect(page.locator('.preview-field-payment')).to_contain_text('Visible after pickup confirmation')
        expect(page.locator('.preview-field-payment')).not_to_contain_text('driver@example.com')
        state.update(status='CO_RIDE_ACTIVE')
        page.reload()
        expect(page.locator('.preview-field-payment')).to_contain_text('driver@example.com')
        page.screenshot(path=f'/tmp/paid-detail-{width}.png',full_page=True)
        for role in ['RIDER','DRIVER']:
            state.update(role=role,status='COMPLETED',fare=0,current=False)
            page.goto('http://127.0.0.1:3090/activity')
            expect(page.locator('.activity-card')).to_contain_text('Free')
            page.screenshot(path=f'/tmp/free-activity-{role}-{width}.png',full_page=True)
            state.update(status='ACCEPTED',current=True)
            page.goto('http://127.0.0.1:3090/')
            expect(page.locator('.active-ride-price').first).to_have_text('Free')
            page.screenshot(path=f'/tmp/free-home-{role}-{width}.png',full_page=True)
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        state['current']=False
        state.update(role='RIDER',status='PUBLISHED',fare=0)
        page.evaluate('(draft) => sessionStorage.setItem("cocowheels:find-ride-draft:v1", JSON.stringify({...draft,savedAt:Date.now()}))',{'pickup':origin,'destination':destination,'departureAt':None})
        page.goto('http://127.0.0.1:3090/?start=rider')
        expect(page.locator('.ride-option-payment').first).to_have_text('Free')
        page.screenshot(path=f'/tmp/free-discovery-{width}.png',full_page=True)
        state['fare']=5
        page.goto('http://127.0.0.1:3090/?start=rider')
        expect(page.locator('.ride-option-payment').first).to_contain_text('A$5')
        expect(page.locator('.ride-option-payment').first).to_contain_text('PayID')
        for path in ['help','privacy','terms']:
            page.goto('http://127.0.0.1:3090/'+path)
            if path=='help': page.get_by_text('How do I pay?',exact=True).click()
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            page.screenshot(path=f'/tmp/free-{path}-{width}.png',full_page=True)
        assert not errors, errors
        print(f'PASS {width}: free/paid offer payloads; rider/driver stages; payment gate; legal/help layout')
        context.close()
    browser.close()
