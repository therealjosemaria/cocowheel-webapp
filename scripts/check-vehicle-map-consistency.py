"""Built :3201, all APIs mocked. Custom/fallback cars across shared map surfaces.
Run: /tmp/gumwheel-notification-check-env/bin/python scripts/check-vehicle-map-consistency.py
No production writes/providers. Scheduled polls paused to expose missing save signals.
"""
import json
from datetime import datetime, timezone
from playwright.sync_api import sync_playwright, expect
BASE='http://127.0.0.1:3201'
origin={'latitude':-33.918,'longitude':151.204,'label':'Example origin, Sydney'}
end={'latitude':-33.889,'longitude':151.187,'label':'Example destination, Sydney'}
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    for width in [390,1440]:
        context=browser.new_context(viewport={'width':width,'height':900})
        state={'vehicle':{'plate':'PRIVATE1','make':'Ford','model':'Ranger','year':'2025','colour':'Blue',
               'selection':{'make':'Ford','model':'ford-ranger','year':'2025','colour':'Blue'}}}
        errors=[]
        def artwork():
            v=state['vehicle']
            return '/brand/vehicles/v1/ford-ranger-'+v['colour'].lower()+'.webp' if v.get('selection',{}).get('colour') else None
        def api(r):
            path=r.request.url.split('/api/')[-1].split('?')[0]
            now=datetime.now(timezone.utc).isoformat()
            art=artwork()
            ride={'rideId':'COCO-TEST','driverAlias':'driver01','status':'PUBLISHED','priceAud':0,
                  'scheduledDepartureAt':now,'expiresAt':'2099-01-01T00:00:00Z','plannedRoute':{'origin':origin,'destination':end},
                  'departureLabel':origin['label'],'destinationLabel':end['label'],'vehicleArtwork':art}
            if path=='university/session':data={'unikey':'tester01'}
            elif path=='profile':data={'username':'tester01','email':'synthetic@example.com','photoUrl':None}
            elif path=='current':data={'current':None,'currents':[]}
            elif path=='notifications/reviewed':data={'keys':[]}
            elif path=='vehicle':
                if r.request.method=='POST':state['vehicle']=r.request.post_data_json
                data={'vehicle':state['vehicle']}
            elif path=='usual-route':data={'route':None,'alertsAvailable':True}
            elif path=='rider-demands':data={'requests':[],'sent':[{'id':'sent1','demandId':'d1','status':'PENDING',
                 'driverAlias':'driver01','createdAt':now,'departureAt':now,'origin':origin,'destination':end,'priceAud':0}]}
            elif path=='search':data={'candidates':[{**ride,'directionFit':'GOOD','redactedCorridor':[origin,end],
                 'pickupDistanceMeters':0,'destinationDistanceMeters':0,'isOwnOffer':False}], 'serverNow':now}
            elif path=='rides/COCO-TEST/preview':data={'ride':ride,'serverNow':now}
            elif path=='home-presence':
                assert not r.request.headers.get('cookie') and not r.request.headers.get('authorization')
                data={'cells':[{'role':'driver','latitude':-33.925,'longitude':151.175,'count':2,
                     **({'artworks':[art,None]} if art else {})},
                     {'role':'rider','latitude':-33.925,'longitude':151.175,'count':1}]}
            elif path=='route-preview':
                body=r.request.post_data_json
                data={'points':[body['origin'],body['destination']],'durationSeconds':600}
            elif path.startswith('profile-photo/'):
                r.fulfill(content_type='image/svg+xml',body='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="#64748b"/></svg>');return
            else:data={}
            r.fulfill(json=data)
        context.route('**/*',lambda r:r.continue_() if r.request.url.startswith(BASE) else r.abort())
        context.route('**/api/**',api)
        context.add_init_script('const oldTimeout=setTimeout,oldInterval=setInterval;window.setTimeout=(fn,ms,...args)=>ms===8000?0:oldTimeout(fn,ms,...args);window.setInterval=(fn,ms,...args)=>[15000,60000].includes(ms)?0:oldInterval(fn,ms,...args)')
        def page():
            result=context.new_page();result.on('pageerror',lambda e:errors.append(str(e)));return result
        home=page();home.goto(BASE)
        feed=home.locator('.home-presence')
        expect(feed.locator('.vehicle-artwork-marker')).to_have_attribute('src',artwork())
        expect(feed.locator('.journey-role-art-driver')).to_have_count(1)
        expect(feed.locator('.leaflet-marker-icon')).to_have_count(3)
        expect(feed.locator('button,.leaflet-popup,.leaflet-tooltip')).to_have_count(0)
        for icon in feed.locator('.leaflet-marker-icon').all():assert icon.get_attribute('tabindex') is None
        home.screenshot(path=f'/tmp/vehicle-everywhere-home-{width}.png',full_page=True)
        find=page()
        find.add_init_script('sessionStorage.setItem("cocowheels:find-ride-draft:v1",JSON.stringify({...'+json.dumps({'pickup':origin,'destination':end,'departureAt':None})+',savedAt:Date.now()}));')
        find.goto(BASE+'/?start=rider')
        expect(find.locator('.ride-option')).to_have_count(1)
        expect(find.locator('.ride-selection-map .vehicle-artwork-marker')).to_have_attribute('src',artwork())
        find.screenshot(path=f'/tmp/vehicle-everywhere-find-{width}.png',full_page=True)
        find.goto(BASE+'/rides/COCO-TEST')
        expect(find.locator('.vehicle-artwork-marker')).to_have_attribute('src',artwork())
        own=page();own.goto(BASE+'/activity/offers/sent1')
        expect(own.locator('.vehicle-artwork-marker')).to_have_attribute('src',artwork())
        own.screenshot(path=f'/tmp/vehicle-everywhere-offer-{width}.png',full_page=True)
        profile=page();profile.goto(BASE+'/usual-route')
        details=profile.locator('.vehicle-details');details.locator('summary').click()
        details.get_by_label('Colour',exact=True).select_option('Red')
        details.get_by_role('button',name='Save vehicle details',exact=True).click()
        expect(details.get_by_role('status')).to_be_visible()
        for target in [home,find,own]:
            expect(target.locator('.vehicle-artwork-marker')).to_have_attribute('src',artwork(),timeout=2000)
            expect(target.locator('.map-attribution')).to_have_count(1)
            expect(target.locator('.map-attribution')).to_have_css('left','7px')
            assert target.evaluate('document.documentElement.scrollWidth<=innerWidth')
        details.get_by_label('Colour',exact=True).select_option('other')
        details.get_by_label('Other colour',exact=True).fill('Teal')
        details.get_by_role('button',name='Save vehicle details',exact=True).click()
        expect(details.get_by_role('status')).to_be_visible()
        for target in [home,find,own]:
            expect(target.locator('.vehicle-artwork-marker')).to_have_count(0,timeout=2000)
            expect(target.locator('.journey-marker-model .journey-role-art-driver').first).to_be_visible()
        privacy=page();privacy.goto(BASE+'/privacy')
        expect(privacy.get_by_text('Number plates and the full saved vehicle record',exact=False)).to_be_visible()
        assert privacy.locator('.legal-content p:not(.legal-updated)').first.evaluate('(el)=>getComputedStyle(el).fontWeight')=='400'
        assert privacy.evaluate('document.documentElement.scrollWidth<=innerWidth')
        privacy.screenshot(path=f'/tmp/vehicle-everywhere-privacy-{width}.png',full_page=True)
        assert not errors,errors
        print(f'PASS {width}px: custom/generic Home, Find, preview and owner request map; cross-tab save, noninteractive Home and shared credits',flush=True)
        context.close()
    browser.close()
