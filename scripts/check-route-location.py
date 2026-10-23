"""Local :3090 only. Mock GPS/APIs; no production writes or provider traffic."""
from playwright.sync_api import sync_playwright, expect

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width in [320, 390, 844, 1440]:
        for view in ['?start=driver', '?start=rider', 'usual-route']:
            page = browser.new_page(viewport={'width': width, 'height':900})
            errors = []
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.add_init_script("""window.gpsCalls=0; window.gpsMode='success';
              navigator.geolocation.getCurrentPosition=(ok, fail)=>{
                window.gpsCalls++;
                const result=()=>ok({coords:{latitude:-33.88,longitude:151.2},timestamp:Date.now()});
                if(window.gpsMode==='denied') fail({code:1});
                else if(window.gpsMode==='delay') window.finishGps=result;
                else result();
              };""")
            def respond(r):
                path=r.request.url.split('/api/')[-1].split('?')[0]
                if path=='university/session': data={'unikey':'ride1234'}
                elif path=='current': data={'current':None,'currents':[]}
                elif path=='usual-route': data={'route':None,'alertsAvailable':True}
                elif path=='place-label': data={'label':'Town Hall, Sydney','countryCode':'au'}
                else: data={}
                r.fulfill(json=data)
            page.route('**/*', lambda r: r.continue_() if r.request.url.startswith('http://127.0.0.1:3090') else r.abort())
            page.route('**/api/**', respond)
            page.goto('http://127.0.0.1:3090/'+view)
            if view=='usual-route': page.locator('summary').filter(has_text='Usual route').click()
            button=page.get_by_role('button', name='Use my location', exact=True)
            expect(button).to_have_count(1)
            expect(button).to_be_visible()
            page.wait_for_timeout(300)
            assert page.evaluate('window.gpsCalls')==0
            field=page.get_by_placeholder('Where from?',exact=True)
            b=button.bounding_box(); f=field.bounding_box()
            if width<700: assert b['y']>=f['y']+f['height']+8
            else: assert b['x']>=f['x']+f['width']-1
            assert b['height']>=44
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            page.screenshot(path=f'/tmp/location-{view.replace("?start=", "")}-{width}.png',full_page=True,animations='disabled')
            page.evaluate("window.gpsMode='denied'")
            button.click()
            expect(page.locator('.place-search [role="alert"]')).to_contain_text('Allow location access')
            page.evaluate("window.gpsMode='success'")
            button.click()
            expect(field).to_have_value('Town Hall, Sydney')
            expect(page.get_by_placeholder('Where to?',exact=True)).to_be_focused()
            page.evaluate("window.gpsMode='delay'")
            button.click()
            field.fill('My typed address')
            page.evaluate('window.finishGps()')
            page.wait_for_timeout(100)
            expect(field).to_have_value('My typed address')
            expect(button).to_be_enabled()
            assert not errors, errors
            print(f'PASS {view} {width}px')
            page.close()
    browser.close()
