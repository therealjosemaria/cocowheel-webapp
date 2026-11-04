"""Built :3201, synthetic account/journeys, all APIs mocked; no live writes.
Run: /tmp/gumwheel-notification-check-env/bin/python scripts/check-vehicle-catalogue.py
Optional GUMWHEEL_TEST_TILES=1 permits read-only OSM tiles for visual review.
"""
import os
from datetime import datetime, timezone
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

BASE = 'http://127.0.0.1:3201'
origin = {'latitude':-33.918,'longitude':151.204,'label':'Example origin, Sydney'}
end = {'latitude':-33.889,'longitude':151.187,'label':'Example destination, Sydney'}
now = datetime.now(timezone.utc).isoformat()
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    for width in [320,390,844,1440]:
        context = browser.new_context(viewport={'width':width,'height':900})
        page = context.new_page(); errors=[]; writes=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        state={'vehicle':{'plate':'ABC123','make':'Toyota','model':'Corolla','colour':'White'},'role':'DRIVER'}
        def network(r):
            host=urlparse(r.request.url).hostname or ''
            if r.request.url.startswith(BASE) or (os.environ.get('GUMWHEEL_TEST_TILES')=='1' and host.endswith('.tile.openstreetmap.org') and r.request.method=='GET'): r.continue_()
            else:r.abort()
        context.route('**/*',network)
        def api(r):
            path=r.request.url.split('/api/')[-1].split('?')[0]
            ride={'rideId':'catalogue-test','driverAlias':'driver01','status':'ACCEPTED','scheduledDepartureAt':now,
                'expiresAt':'2099-01-01T00:00:00Z','priceAud':0,'plannedRoute':{'origin':origin,'destination':end},
                'pickupEstablished':False,'vehicle':state['vehicle'],'requests':[],
                'request':{'requestId':'r1','status':'ACCEPTED','riderAlias':'rider01','pickup':origin,'destination':end,'createdAt':now,'requestedDepartureAt':now},'coRideCode':'1234'}
            if state['role']=='DRIVER':
                ride.pop('request');ride.pop('coRideCode')
                ride['rider']={'alias':'rider01','pickup':origin,'destination':end,'requestedDepartureAt':now,'directionFit':'GOOD'}
                ride['requests']=[{'requestId':'r1','status':'ACCEPTED','riderAlias':'rider01','pickup':origin,'destination':end,'createdAt':now,'requestedDepartureAt':now}]
            ride['driverLocation']={**origin,'latitude':origin['latitude']-0.003,'longitude':origin['longitude']-0.003,'capturedAt':now,'accuracyMeters':8,'stale':False}
            if path.startswith('profile-photo/'):
                r.fulfill(content_type='image/svg+xml',body='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="#64748b"/></svg>');return
            if path=='university/session':data={'unikey':'tester01'}
            elif path=='current':data={'current':None,'currents':[]}
            elif path=='history':data={'driver':[ride] if state['role']=='DRIVER' else [],'rider':[ride] if state['role']=='RIDER' else []}
            elif path=='profile':data={'username':'tester01','email':'synthetic@example.com','photoUrl':None}
            elif path=='vehicle':
                if r.request.method=='POST':state['vehicle']=r.request.post_data_json;writes.append(path)
                data={'vehicle':state['vehicle']}
            elif path=='usual-route':data={'route':None,'alertsAvailable':True}
            elif path=='rider-demands':data={'requests':[],'sent':[]}
            elif path=='notifications/reviewed':data={'keys':[]}
            elif path=='rides/catalogue-test':data={'ride':ride}
            elif path=='route-preview':data={'points':[origin,end],'durationSeconds':600}
            elif path=='home-presence':data={'cells':[{'role':'driver','latitude':-33.925,'longitude':151.175,'count':1}]}
            else:data={}
            r.fulfill(json=data)
        context.route('**/api/**',api)
        page.goto(BASE+'/usual-route')
        details=page.locator('.vehicle-details');details.locator('summary').click()
        expect(details.locator('.vehicle-artwork-generic')).to_be_visible() # Legacy matching text is still generic.
        for label,option in [('Make','Toyota'),('Model','toyota-corolla'),('Year','2018'),('Colour','Blue')]:
            details.get_by_label(label,exact=True).select_option(option)
        image=details.locator('img.vehicle-artwork-preview')
        expect(image).to_have_attribute('src','/brand/vehicles/v1/toyota-corolla-blue.webp')
        image.evaluate('(i)=>i.decode()')
        assert image.evaluate('(i)=>i.naturalWidth===384')
        details.get_by_role('button',name='Save vehicle details',exact=True).click()
        expect(details.get_by_role('status')).to_have_text('Vehicle details saved.')
        assert state['vehicle']['selection']=={'make':'Toyota','model':'toyota-corolla','colour':'Blue','year':'2018'}
        page.reload();details.locator('summary').click()
        expect(details.get_by_label('Model',exact=True)).to_have_value('toyota-corolla')
        page.screenshot(path=f'/tmp/catalogue-profile-{width}.png',full_page=True)
        assert details.get_by_label('Year',exact=True).locator('option').all_text_contents()==['Choose year','2022','2021','2020','2019','2018','Other']
        details.get_by_label('Year',exact=True).select_option('other')
        details.get_by_label('Other year',exact=True).fill('2024')
        expect(details.locator('.vehicle-artwork-generic')).to_be_visible()
        details.get_by_label('Year',exact=True).select_option('other')
        details.get_by_label('Other year',exact=True).fill('2099')
        details.get_by_role('button',name='Save vehicle details',exact=True).click()
        assert not details.get_by_label('Other year',exact=True).evaluate('(el)=>el.checkValidity()')
        details.get_by_label('Year',exact=True).select_option('2018')
        for field in ['Colour','Model','Make','Year']:
            # Every typed alternative, including an exact catalogue spelling, falls back.
            details.get_by_label(field,exact=True).select_option('other')
            details.get_by_label('Other '+field.lower(),exact=True).fill({'Colour':'Blue','Model':'Corolla','Make':'Toyota','Year':'2018'}[field])
            expect(details.locator('.vehicle-artwork-generic')).to_be_visible()
            details.get_by_label('Make',exact=True).select_option('Ford')
            details.get_by_label('Make',exact=True).select_option('Toyota')
            expect(details.get_by_label('Model',exact=True)).to_have_value('')
            details.get_by_label('Model',exact=True).select_option('toyota-corolla')
            details.get_by_label('Colour',exact=True).select_option('Blue')
            details.get_by_label('Year',exact=True).select_option('2018')
        details.get_by_label('Make',exact=True).select_option('Ford')
        expect(details.get_by_label('Model',exact=True)).to_have_value('')
        expect(details.locator('.vehicle-artwork-generic')).to_be_visible()
        expect(details.get_by_label('Model',exact=True).locator('option[value="toyota-corolla"]')).to_have_count(0)
        # Save a black Ranger to inspect dark-paint legibility on the light basemap.
        details.get_by_label('Model',exact=True).select_option('ford-ranger')
        details.get_by_label('Year',exact=True).select_option('2025')
        details.get_by_label('Colour',exact=True).select_option('Black')
        details.get_by_role('button',name='Save vehicle details',exact=True).click()
        expect(details.get_by_role('status')).to_be_visible()
        for role in ['DRIVER','RIDER']:
            state['role']=role
            page.goto(BASE+'/activity/catalogue-test')
            expect(page.locator('.vehicle-artwork-marker').first).to_have_attribute('src','/brand/vehicles/v1/ford-ranger-black.webp')
            page.wait_for_timeout(500)
            page.screenshot(path=f'/tmp/catalogue-{role.lower()}-{width}.png',full_page=True)
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        page.goto(BASE)
        expect(page.locator('.home-presence .journey-role-art-driver')).to_be_visible()
        expect(page.locator('.home-presence .vehicle-artwork-marker')).to_have_count(0)
        assert not errors,errors
        print(f'PASS {width}px: legacy/custom fallback, selections/save/reload, make dependency, both private roles, generic Home',flush=True)
        context.close()
    browser.close()
