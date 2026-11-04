"""Built frontend :3201; synthetic APIs only, optional read-only OSM tiles.
Run: /tmp/gumwheel-notification-check-env/bin/python scripts/check-home-presence.py
"""
import os
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

BASE = 'http://127.0.0.1:3201'
cells = [{'role':'driver','latitude':-33.925,'longitude':151.175,'count':2},
         {'role':'rider','latitude':-33.925,'longitude':151.175,'count':1}]
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    for width in [320,390,844,1440]:
        context=browser.new_context(viewport={'width':width,'height':900},reduced_motion='reduce')
        page=context.new_page(); page.clock.install(); errors=[]; requests=[]; mode={'value':'posts','verified':False}
        page.on('pageerror',lambda error:errors.append(str(error)))
        def network(route):
            host=urlparse(route.request.url).hostname or ''
            if route.request.url.startswith(BASE) or (os.environ.get('GUMWHEEL_TEST_TILES')=='1' and host.endswith('.tile.openstreetmap.org') and route.request.method=='GET'): route.continue_()
            else: route.abort()
        context.route('**/*',network)
        def api(route):
            path=route.request.url.split('/api/')[-1].split('?')[0]
            requests.append((path,route.request.method))
            if path=='home-presence':
                assert route.request.method=='GET'
                assert not route.request.headers.get('cookie') and not route.request.headers.get('authorization')
                if mode['value']=='failed': route.fulfill(status=503,json={'error':'UNAVAILABLE'});return
                route.fulfill(json={'cells':cells if mode['value']=='posts' else [{**cells[0], 'count':1}] if mode['value']=='single' else []});return
            if path=='university/session':
                route.fulfill(status=200 if mode['verified'] else 401,json={'unikey':'fixture'} if mode['verified'] else {'error':'UNIVERSITY_VERIFICATION_REQUIRED'});return
            if path=='rides/example/preview':
                route.fulfill(status=200 if mode['verified'] else 401,json={'ride':{
                    'rideId':'example','driverAlias':'fixture','priceAud':0,'status':'PUBLISHED',
                    'scheduledDepartureAt':'2026-11-04T05:00:00Z','departureLabel':'Synthetic start',
                    'destinationLabel':'Synthetic end'},'serverNow':'2026-11-04T04:00:00Z'} if mode['verified'] else {'error':'UNIVERSITY_VERIFICATION_REQUIRED'});return
            route.fulfill(json={'current':None,'currents':[],'keys':[]})
        context.route('**/api/**',api)
        page.goto(BASE)
        preview=page.get_by_role('region',name='Posted journeys and journey requests by area')
        expect(preview.locator('.leaflet-marker-icon')).to_have_count(3)
        expect(preview.get_by_text('approx',exact=False)).to_have_count(0)
        credits=preview.locator('.map-attribution')
        expect(credits).to_have_count(1)
        expect(preview.locator('.leaflet-control-attribution')).to_have_count(0)
        expect(credits).to_have_css('left','7px');expect(credits).to_have_css('bottom','10px')
        expect(credits).to_have_css('background-color','rgba(255, 255, 255, 0.7)')
        expect(credits).to_have_css('box-shadow','none')
        expect(credits).to_have_css('border-radius','5px')
        expect(preview.locator('.leaflet-tile-pane')).to_have_css('filter','none')
        expect(credits.get_by_role('link',name='OpenStreetMap contributors')).to_have_attribute('href','https://www.openstreetmap.org/copyright')
        expect(preview.locator('button, input, .leaflet-control-zoom, .leaflet-popup, .leaflet-tooltip')).to_have_count(0)
        for icon in preview.locator('.leaflet-marker-icon').all():
            assert icon.get_attribute('tabindex') is None
        before=page.url
        preview.locator('.leaflet-container').click(position={'x':120,'y':60})
        assert page.url==before
        assert page.locator('dialog[open]').count()==0
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        # A read-only map must leave ordinary touch/page scrolling and CTAs available.
        expect(preview.locator('.leaflet-container')).not_to_have_class('leaflet-grab')
        page.wait_for_timeout(800)
        page.screenshot(path=f'/tmp/home-presence-posts-{width}.png',full_page=True)
        # Exercise the actual scheduled refresh without waiting a minute.
        mode['value']='single'; page.clock.fast_forward(60_001)
        expect(preview.locator('.leaflet-marker-icon')).to_have_count(1)
        mode['value']='empty'; page.clock.fast_forward(60_001)
        expect(preview).to_have_count(0)
        page.screenshot(path=f'/tmp/home-presence-empty-{width}.png',full_page=True)
        mode['value']='posts'; page.clock.fast_forward(60_001)
        expect(preview.locator('.leaflet-marker-icon')).to_have_count(3)
        mode['value']='failed'; page.clock.fast_forward(60_001)
        expect(preview).to_have_count(0)
        expect(page.locator('.home-presence-notice')).to_have_count(0)
        page.screenshot(path=f'/tmp/home-presence-unavailable-{width}.png',full_page=True)
        mode['value']='posts'; page.clock.fast_forward(60_001)
        expect(preview.locator('.leaflet-marker-icon')).to_have_count(3)
        expect(preview.get_by_role('status')).to_have_count(0)
        read_count=sum(path=='home-presence' for path,method in requests)
        page.evaluate("window.__hidden=true;Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.__hidden});document.dispatchEvent(new Event('visibilitychange'))")
        expect(preview).to_have_count(0)
        page.clock.fast_forward(60_001)
        assert sum(path=='home-presence' for path,method in requests)==read_count
        page.evaluate("window.__hidden=false;document.dispatchEvent(new Event('visibilitychange'))")
        expect(preview.locator('.leaflet-marker-icon')).to_have_count(3)
        # A shared direct journey link now offers the existing verification dialog.
        page.goto(BASE+'/rides/example')
        expect(page.get_by_text('Sign in to view this journey.',exact=True)).to_be_visible()
        page.screenshot(path=f'/tmp/home-presence-signin-{width}.png',full_page=True)
        sign_in=page.locator('.ride-preview').get_by_role('button',name='Sign in',exact=True)
        button_box=sign_in.bounding_box(); panel_box=page.locator('.ride-preview').bounding_box()
        assert button_box['x'] >= panel_box['x']+14
        assert button_box['x']+button_box['width'] <= panel_box['x']+panel_box['width']-14
        expect(sign_in).to_have_css('min-height','44px')
        sign_in.click()
        expect(page.get_by_role('dialog',name='Email verification')).to_be_visible()
        page.get_by_role('dialog',name='Email verification').get_by_role('button',name='Cancel',exact=True).click()
        mode['verified']=True
        page.evaluate("window.dispatchEvent(new Event('cocowheels:identity-changed'))")
        expect(page.get_by_text('Synthetic start',exact=True)).to_be_visible()
        assert not errors,errors
        assert not any(method!='GET' for path,method in requests),requests
        assert not any(path in ['availability','route-preview'] or path.endswith('/location') for path,method in requests),requests
        print(f'PASS {width}: real refresh, hidden on empty/failure, recovery, three distinct noninteractive icons per area, shared sign-in dialog and preview resume, no writes/GPS/routing',flush=True)
        context.close()
    browser.close()
