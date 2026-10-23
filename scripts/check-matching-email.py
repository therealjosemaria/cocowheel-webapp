"""Isolated email-link browser checks. Mock all APIs; block external traffic."""
from datetime import datetime, timezone
import subprocess
from playwright.sync_api import sync_playwright, expect

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width in [320, 390, 1440]:
        page = browser.new_page(viewport={'width': width, 'height': 900})
        state = {'signed': True, 'available': True, 'saved': True, 'writes': [], 'searches': []}
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        origin = dict(latitude=-33.88, longitude=151.20, label='Town Hall')
        end = dict(latitude=-33.89, longitude=151.25, label='University of Sydney')
        now = datetime.now(timezone.utc).isoformat()
        route = dict(origin=origin,destination=end,days=[],minute=None,anyTime=True,alerts=True,priceAud=0,payId='',payIdType='MOBILE')
        def respond(r):
            path = r.request.url.split('/api/')[-1].split('?')[0]
            if r.request.method == 'POST' and path not in ['search','route-preview','place-label']:
                state['writes'].append(path)
            if path in ['usual-route', 'university/session'] and not state['signed']:
                r.fulfill(status=401, json={'error':'UNIVERSITY_VERIFICATION_REQUIRED'}); return
            if path == 'usual-route': data = {'route':route if state['saved'] else None,'alertsAvailable':True}
            elif path == 'university/session': data = {'unikey':'ride1234'}
            elif path == 'current': data = {'current':None,'currents':[]}
            elif path == 'vehicle': data = {'vehicle':None}
            elif path == 'search':
                state['searches'].append(r.request.post_data_json)
                data = {'serverNow':now,'candidates':[dict(rideId=id,driverAlias=id,priceAud=0,scheduledDepartureAt=now,expiresAt='2099-01-01T00:00:00Z',directionFit='GOOD',redactedCorridor=[origin,end],pickupDistanceMeters=100,destinationDistanceMeters=100,isOwnOffer=False,departureLabel='Town Hall',destinationLabel='University') for id in (['other','target'] if state['available'] else ['other'])]}
            elif path.startswith('rides/'):
                data = {'ride':dict(rideId=path.split('/')[1],driverAlias=path.split('/')[1],status='PUBLISHED',priceAud=0,scheduledDepartureAt=now,expiresAt='2099-01-01T00:00:00Z',plannedRoute={'origin':origin,'destination':end})}
            elif path == 'route-preview': data = {'points':[origin,end],'durationSeconds':600}
            else: data = {}
            r.fulfill(json=data)
        page.route('**/*', lambda r:r.continue_() if r.request.url.startswith('http://127.0.0.1:3090') else r.abort())
        page.route('**/api/**', respond)
        page.goto('http://127.0.0.1:3090/?start=rider&match=target')
        expect(page.get_by_role('button',name='target',exact=False)).to_have_attribute('aria-pressed','true')
        if width == 1440:
            expect(page.get_by_role('navigation',name='Primary navigation').get_by_role('button',name='Find a ride',exact=True)).to_have_attribute('aria-pressed','true')
        assert state['searches'][-1]['pickup']['latitude']==origin['latitude']
        page.screenshot(path=f'/tmp/email-match-{width}.png',full_page=True)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        page.goto('http://127.0.0.1:3090/usual-route?ride=target')
        expect(page.get_by_role('button',name='target',exact=False)).to_have_attribute('aria-pressed','true')
        state['available']=False
        page.goto('http://127.0.0.1:3090/?start=rider&match=target')
        expect(page.get_by_text('That ride is no longer available. You can browse other rides for your route.')).to_be_visible()
        page.get_by_role('button',name='OKAY',exact=False).click()
        expect(page.get_by_role('button',name='other',exact=False)).to_have_attribute('aria-pressed','true')
        state['signed']=False
        page.goto('http://127.0.0.1:3090/?start=rider&match=target')
        expect(page.get_by_text('Sign in to view rides matching your usual route.')).to_be_visible()
        state['signed']=True
        page.evaluate("window.dispatchEvent(new Event('cocowheels:identity-changed'))")
        expect(page.get_by_text('That ride is no longer available. You can browse other rides for your route.')).to_be_visible()
        page.goto('http://127.0.0.1:3090/usual-route?alerts=1')
        expect(page.locator('.usual-route-disclosure')).to_have_attribute('open','')
        expect(page.get_by_role('button',name='Mute email alerts',exact=True)).to_be_focused()
        page.screenshot(path=f'/tmp/email-mute-{width}.png',full_page=True)
        state['saved']=False
        page.goto('http://127.0.0.1:3090/?start=rider&match=target')
        expect(page.get_by_text('Your saved route is no longer available. Choose where from and where to to find a ride.')).to_be_visible()
        page.get_by_role('button',name='OKAY',exact=False).click()
        expect(page.get_by_placeholder('Where from?',exact=True)).to_be_visible()
        assert not state['writes'],state['writes']
        assert not errors,errors
        html = subprocess.check_output(['node','--import','tsx','-e',"const { routeAlertContent } = require('./server/route-alert-email.ts'); process.stdout.write(routeAlertContent('https://gumwheel.com','example','guest','2026-10-23T01:00:00Z',0).html)"],text=True)
        page.set_content(html)
        expect(page.get_by_role('link',name='View matching ride')).to_have_attribute('href','https://gumwheel.com/?start=rider&match=example')
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        page.screenshot(path=f'/tmp/matching-email-{width}.png',full_page=True)
        print(f'PASS {width}: direct/legacy target, alternatives, sign-in resume, mute focus, no writes')
        page.close()
    browser.close()
