"""Mocked browser review: run against the built local site on port 3201."""
import json
from datetime import datetime, timezone
from playwright.sync_api import sync_playwright, expect

BASE='http://127.0.0.1:3201'
origin={'latitude':-33.918,'longitude':151.204,'label':'Example origin, Sydney'}
end={'latitude':-33.889,'longitude':151.187,'label':'Example destination, Sydney'}
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    for width in [320,390,1440]:
        ctx=browser.new_context(viewport={'width':width,'height':900})
        state={'vehicle':None,'modes':[],'search':[]}
        errors=[]
        def api(r):
            path=r.request.url.split('/api/')[-1].split('?')[0]
            now=datetime.now(timezone.utc).isoformat()
            if path.startswith('profile-photo/'):
                r.fulfill(content_type='image/svg+xml', body='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="#64748b"/></svg>'); return
            if path=='university/session': data={'unikey':'test0001'}
            elif path=='profile': data={'username':'test0001','email':'synthetic@example.com','photoUrl':None}
            elif path=='current': data={'current':None,'currents':[]}
            elif path=='usual-route': data={'route':None,'alertsAvailable':True}
            elif path=='vehicle':
                if r.request.method=='POST':
                    v=r.request.post_data_json
                    if v.get('type')=='bicycle' and not v.get('passengerReady'):
                        r.fulfill(status=400,json={'error':'BICYCLE_SEAT_REQUIRED'});return
                    state['vehicle']=v
                data={'vehicle':state['vehicle']}
            elif path=='search':
                state['search'].append(r.request.post_data_json)
                data={'candidates':[{'rideId':'COCO-TEST','driverAlias':'driver01','status':'PUBLISHED','priceAud':0,'scheduledDepartureAt':now,'expiresAt':'2099-01-01T00:00:00Z','vehicleType':'bicycle','directionFit':'GOOD','redactedCorridor':[origin,end],'pickupDistanceMeters':0,'destinationDistanceMeters':0,'isOwnOffer':False,'departureLabel':origin['label'],'destinationLabel':end['label'],'vehicleArtwork':'/brand/vehicles/v1/passenger-bicycle-blue.webp'}], 'serverNow':now}
            elif path=='route-preview':
                body=r.request.post_data_json
                state['modes'].append(body.get('mode','drive'))
                data={'points':[body['origin'],body['destination']],'durationSeconds':600}
            elif path=='rides/COCO-TEST/preview': data={'ride':{'plannedRoute':{'origin':origin,'destination':end},'vehicleType':'bicycle','vehicleArtwork':'/brand/vehicles/v1/passenger-bicycle-blue.webp'},'serverNow':now}
            elif path=='home-presence': data={'cells':[]}
            else:data={}
            r.fulfill(json=data)
        ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(BASE) else r.abort())
        ctx.route('**/api/**',api)
        page=ctx.new_page();page.on('pageerror',lambda e:errors.append(e.stack or str(e)))
        page.goto(BASE+'/usual-route')
        details=page.locator('.vehicle-details');details.locator('summary').click()
        details.get_by_label('Vehicle type').select_option('bicycle')
        expect(details.get_by_text('My bicycle is designed for a passenger and has a passenger seat.')).to_be_visible()
        expect(details.get_by_label('Number plate (required)')).to_have_count(0)
        page.screenshot(path=f'/tmp/gumwheel-bike-profile-{width}.png',full_page=True)
        details.get_by_role('button',name='Save vehicle details',exact=True).click()
        expect(details.get_by_role('alert')).to_be_visible()
        details.get_by_label('My bicycle is designed for a passenger and has a passenger seat.').check()
        details.locator('select').nth(1).select_option('Blue')
        details.get_by_role('button',name='Save vehicle details',exact=True).click()
        expect(details.get_by_text('Vehicle details saved.')).to_be_visible()
        assert state['vehicle']['type']=='bicycle' and state['vehicle']['plate']==''
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        page.add_init_script('sessionStorage.setItem("cocowheels:find-ride-draft:v1",JSON.stringify({...'+json.dumps({'pickup':origin,'destination':end,'departureAt':None,'vehicleType':'bicycle'})+',savedAt:Date.now()}));')
        page.goto(BASE+'/?start=rider')
        expect(page.locator('.ride-option')).to_have_count(1)
        expect(page.locator('.ride-option').get_by_text('Bicycle',exact=False)).to_be_visible()
        page.screenshot(path=f'/tmp/gumwheel-bike-search-{width}.png',full_page=True)
        assert state['search'][-1]['vehicleType']=='bicycle'
        assert 'bicycle' in state['modes']
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        page.locator('.leaflet-control-zoom-in').click()
        page.get_by_role('button',name='Back to route search').click()
        page.wait_for_timeout(400)
        expect(page.get_by_label('Vehicle type')).to_have_value('bicycle')
        page.screenshot(path=f'/tmp/gumwheel-bike-filter-{width}.png',full_page=True)
        page.goto(BASE+'/privacy')
        page.screenshot(path=f'/tmp/gumwheel-bike-privacy-{width}.png',full_page=True)
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        assert not errors,errors
        ctx.close()
        print('passed',width,flush=True)
    browser.close()
