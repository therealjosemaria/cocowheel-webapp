"""Isolated :3090 browser fixture; all API calls mocked, external traffic blocked."""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width in [390, 1440]:
        for role in ['DRIVER', 'RIDER']:
            page = browser.new_page(viewport={'width':width, 'height':900})
            state = {'status':'PUBLISHED' if role == 'DRIVER' else 'REQUESTED', 'reads':0, 'writes':0}
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.add_init_script("""window.gpsCalls=0; navigator.geolocation.getCurrentPosition=(success)=>{
                window.gpsCalls++; success({coords:{latitude:-33.88,longitude:151.2,accuracy:10},timestamp:Date.now()});
            };""")
            page.route('**/*', lambda r: r.continue_() if r.request.url.startswith('http://127.0.0.1:3090') else r.abort())
            def respond(route):
                path = route.request.url.split('/api/')[-1].split('?')[0]
                ride = {'rideId':'privacy-fixture','status':state['status'],'priceAud':0,'driverAlias':'driv1234',
                        'scheduledDepartureAt':'2099-01-01T00:00:00Z','expiresAt':'2099-01-01T06:00:00Z',
                        'plannedRoute':{'origin':{'latitude':-33.8,'longitude':151.2,'label':'Origin'},
                                        'destination':{'latitude':-33.9,'longitude':151.3,'label':'Destination'}}}
                if path == 'university/session': data = {'unikey':'driv1234' if role == 'DRIVER' else 'ride1234'}
                elif path == 'current':
                    state['reads'] += 1
                    data = {'currents':[{'role':role,'ride':ride,'locationSource':{'canReport':True}}]}
                elif path.endswith('/location'):
                    assert state['status'] == 'ACCEPTED'
                    state['writes'] += 1
                    data = {'ride':ride}
                else: data = {}
                route.fulfill(json=data)
            page.route('**/api/**', respond)
            page.goto('http://127.0.0.1:3090/')
            page.wait_for_timeout(1000)
            assert state['reads'] > 0
            assert page.evaluate('window.gpsCalls') == 0
            if role == 'DRIVER':
                state['status'] = 'REQUESTED'
                page.evaluate("window.dispatchEvent(new Event('cocowheels:identity-changed'))")
                page.wait_for_timeout(500)
                assert page.evaluate('window.gpsCalls') == 0
            state['status'] = 'ACCEPTED'
            page.evaluate("window.dispatchEvent(new Event('cocowheels:identity-changed'))")
            page.wait_for_function('window.gpsCalls > 0')
            page.wait_for_timeout(300)
            assert state['writes'] > 0
            if role == 'RIDER':
                page.goto('http://127.0.0.1:3090/privacy')
                page.screenshot(path=f'/tmp/gps-privacy-notice-{width}.png', full_page=True, animations='disabled')
            assert not errors, errors
            print(f'PASS {role} GPS acceptance gate {width}px')
            page.close()
    browser.close()
