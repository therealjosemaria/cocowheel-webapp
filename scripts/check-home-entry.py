"""Production-build Home/session regression. All APIs synthetic; external traffic blocked.
Run after npm run build with a Python environment containing Playwright.
"""
import json
import os
import subprocess
import time
import urllib.request
from playwright.sync_api import sync_playwright, expect

BASE = 'http://127.0.0.1:3206'
MESSAGE = 'We couldn’t refresh your ride. Please try again.'
ride = {'rideId':'synthetic-home-journey','status':'PUBLISHED','driverAlias':'fixture',
        'priceAud':0,'scheduledDepartureAt':'2026-10-30T00:00:00Z','expiresAt':'2026-10-30T12:00:00Z',
        'plannedRoute':{'origin':{'latitude':-33.9,'longitude':151.2,'label':'Synthetic origin'},
                        'destination':{'latitude':-33.88,'longitude':151.19,'label':'Synthetic destination'}}}
cases = [('signed-out',401,500),('identity-failure',500,500),
         ('signed-in-journey',200,200),('signed-in-rider',200,200),('signed-in-ride-failure',200,500)]
with open('/tmp/gumwheel-home-entry-preview.log','w') as log:
    env = dict(os.environ, COCOWHEELS_API_PROXY_TARGET='http://127.0.0.1:1')
    preview = subprocess.Popen(['node','node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3206'],env=env,stdout=log,stderr=log)
    try:
        for attempt in range(100):
            try:
                with urllib.request.urlopen(BASE,timeout=5) as response:
                    assert response.status == 200
                    html=response.read().decode()
                    assert 'Share your journey.' in html and 'FIND A JOURNEY' in html and 'POST A JOURNEY' in html
                break
            except Exception:
                if preview.poll() is not None: raise RuntimeError('Preview failed; see /tmp/gumwheel-home-entry-preview.log')
                time.sleep(.2)
        else: raise RuntimeError('Preview not ready')
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
            for width in [390,1440]:
                for name,session_status,current_status in cases:
                    context=browser.new_context(viewport={'width':width,'height':900})
                    page=context.new_page()
                    errors=[]
                    page.on('pageerror',lambda error:errors.append(str(error)))
                    counts={'session':0,'current':0}
                    item={'role':'DRIVER','ride':ride}
                    if name=='signed-in-rider':
                        rider_ride={**ride,'status':'REQUESTED','request':{'requestId':'synthetic-request','status':'PENDING','pickup':ride['plannedRoute']['origin'],'destination':ride['plannedRoute']['destination']}}
                        item={'role':'RIDER','ride':rider_ride}
                    def route(r):
                        url=r.request.url
                        if url.startswith(BASE+'/api/'):
                            if '/university/session' in url:
                                counts['session']+=1
                                r.fulfill(status=session_status,json={'unikey':'fixture','username':'fixture'} if session_status==200 else {'error':'UNIVERSITY_SESSION_REQUIRED' if session_status==401 else 'TEST_FAILURE'})
                            elif '/current' in url:
                                counts['current']+=1
                                r.fulfill(status=current_status,json={'current':item,'currents':[item]} if current_status==200 else {'error':'TEST_FAILURE'})
                            else:r.fulfill(json={})
                        elif url.startswith(BASE):r.continue_()
                        else:r.abort()
                    page.route('**/*',route)
                    page.goto(BASE)
                    expect(page.get_by_role('heading',name='Share your journey.',exact=True)).to_be_visible()
                    page.wait_for_function("Array.from(document.querySelectorAll('.brand-art img')).every(img => img.complete && img.naturalWidth > 0)")
                    page.wait_for_timeout(700)
                    assert counts['session'] >= 1
                    if name=='signed-in-ride-failure':expect(page.get_by_text(MESSAGE,exact=True)).to_be_visible()
                    else:expect(page.get_by_text(MESSAGE,exact=True)).to_have_count(0)
                    if name in ['signed-in-journey','signed-in-rider']:
                        expect(page.locator('.home-current-ride')).to_have_count(1)
                        expect(page.locator('.home-current-ride')).to_have_attribute('href','/activity/synthetic-home-journey'+('?request=synthetic-request' if name=='signed-in-rider' else ''))
                        page.screenshot(path=f'/tmp/gumwheel-home-entry-restored-{name}-{width}.png',full_page=True,animations='disabled')
                        # Signing out clears the private summary through existing navigation synchronization.
                        session_status=401
                        page.evaluate("window.dispatchEvent(new Event('cocowheels:identity-changed'))")
                        expect(page.locator('.home-current-ride')).to_have_count(0)
                    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
                    assert not errors,errors
                    page.screenshot(path=f'/tmp/gumwheel-home-entry-{name}-{width}.png',full_page=True,animations='disabled')
                    page.locator('.role-choice').get_by_role('button',name='FIND A JOURNEY',exact=True).click()
                    expect(page.get_by_role('heading',name='Find a journey',exact=True)).to_be_visible()
                    print(json.dumps({'case':name,'width':width,'status':'PASS','requests':counts}),flush=True)
                    context.unroute_all(behavior='wait')
                    context.close()
            browser.close()
    finally:
        preview.terminate()
        preview.wait(timeout=10)
