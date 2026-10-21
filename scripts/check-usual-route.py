"""Isolated Chromium UI fixtures on :3090. No production/API/provider emails."""
from playwright.sync_api import sync_playwright, expect
import copy
from datetime import datetime, timezone

origin = {'latitude': -33.88, 'longitude': 151.20, 'label': 'Town Hall, Sydney'}
destination = {'latitude': -33.88, 'longitude': 151.25, 'label': 'University of Sydney'}
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width in [320, 390, 844, 1440]:
        context = browser.new_context(viewport={'width': width, 'height': 900})
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        state = {'saved': None, 'writes': [], 'offers': [], 'signed': True, 'fail': False, 'missing': False}
        ride = {'rideId':'matching-ride', 'driverAlias':'driv1234', 'status':'PUBLISHED', 'priceAud':5,
                'scheduledDepartureAt': datetime.now(timezone.utc).isoformat(), 'expiresAt':'2099-01-01T00:00:00Z',
                'plannedRoute': {'origin':origin,'destination':destination}, 'paymentMethod':'PAYID'}
        def respond(r):
            path = r.request.url.split('/api/')[-1].split('?')[0]
            body = r.request.post_data_json if r.request.method == 'POST' else None
            if path == 'university/session':
                r.fulfill(status=200 if state['signed'] else 401, json={'unikey':'ride1234'} if state['signed'] else {'error':'UNIVERSITY_VERIFICATION_REQUIRED'})
            elif path == 'current':
                r.fulfill(json={'current': None, 'currents': []})
            elif path == 'usual-route':
                if state['fail']:
                    r.fulfill(status=503, json={'error':'UNAVAILABLE'}); return
                if not state['signed']:
                    r.fulfill(status=401, json={'error':'UNIVERSITY_VERIFICATION_REQUIRED'}); return
                if body:
                    state['writes'].append(copy.deepcopy(body))
                    state['saved'] = body
                r.fulfill(json={'route':state['saved'], 'alertsAvailable':True})
            elif path == 'usual-route/remove':
                state['saved'] = None
                r.fulfill(json={'ok':True})
            elif path == 'usual-route/offer':
                state['offers'].append(body)
                r.fulfill(status=409, json={'error':'OPEN_ITEM_EXISTS'})
            elif path == 'place-search':
                r.fulfill(json={'places':[origin if 'Town' in body['text'] else destination]})
            elif path == 'rides/matching-ride/preview':
                r.fulfill(status=404 if state['missing'] else 200,
                          json={'error':'RIDE_UNAVAILABLE'} if state['missing'] else {'ride':ride,'serverNow':datetime.now(timezone.utc).isoformat()})
            elif path == 'search':
                r.fulfill(json={'candidates':[dict(ride, directionFit='GOOD', redactedCorridor=[origin,destination],
                           pickupDistanceMeters=0, destinationDistanceMeters=0, isOwnOffer=False)]})
            elif path == 'route-preview':
                r.fulfill(json={'points':[origin,destination], 'durationSeconds':600})
            else:
                r.fulfill(json={})
        page.route('**/*', lambda r: r.continue_() if r.request.url.startswith('http://127.0.0.1:3090') else r.abort())
        page.route('**/api/**', respond)
        page.goto('http://127.0.0.1:3090/?start=driver')
        expect(page.get_by_role('radio', name='Now', exact=True)).to_be_visible()
        page.get_by_role('radio', name='In 1 hour', exact=True).click()
        expect(page.get_by_role('radio', name='In 1 hour', exact=True)).to_have_attribute('aria-checked','true')
        page.screenshot(path=f'/tmp/usual-route-normal-offer-{width}.png', full_page=True)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        page.goto('http://127.0.0.1:3090/usual-route')
        expect(page.get_by_role('heading', name='My usual route', exact=True)).to_be_visible()
        page.get_by_placeholder('Search origin').fill('Town Hall')
        page.locator('.place-search').nth(0).get_by_role('button', name='Search', exact=True).click()
        page.get_by_role('button', name=origin['label'], exact=True).click()
        page.get_by_placeholder('Search destination').fill('University')
        page.locator('.place-search').nth(1).get_by_role('button', name='Search', exact=True).click()
        page.get_by_role('button', name=destination['label'], exact=True).click()
        page.get_by_label('Email me matching rides', exact=True).check()
        page.get_by_role('button', name='Save route', exact=True).click()
        expect(page.get_by_role('dialog')).to_contain_text('Select your travel days')
        page.get_by_role('button', name='OKAY', exact=True).click()
        assert not state['writes']
        for day in ['Mon','Tue','Wed','Thu']:
            page.get_by_role('button', name=day, exact=True).click()
            expect(page.get_by_role('button', name=day, exact=True)).to_have_attribute('aria-pressed','true')
        page.get_by_label('Around', exact=True).fill('12:00')
        expect(page.get_by_text('11:00 am–1:00 pm · Sydney time', exact=True)).to_be_visible()
        page.screenshot(path=f'/tmp/usual-route-form-{width}.png', full_page=True)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        page.get_by_role('button', name='Save route', exact=True).click()
        expect(page.get_by_role('button', name='Mute email alerts', exact=True)).to_be_visible()
        assert state['saved']['days'] == [1,2,3,4]
        assert state['saved']['minute'] == 720
        page.reload()
        expect(page.get_by_role('button', name='Mute email alerts', exact=True)).to_be_visible()
        page.get_by_role('button', name='Mute email alerts', exact=True).click()
        expect(page.get_by_role('button', name='Enable email alerts', exact=True)).to_be_visible()
        assert not state['saved']['alerts']
        page.get_by_role('button', name='Enable email alerts', exact=True).click()
        expect(page.get_by_role('button', name='Mute email alerts', exact=True)).to_be_visible()
        assert state['saved']['priceAud'] == 0
        assert state['saved']['payId'] == ''
        page.locator('.contribution-choice > summary').click()
        page.get_by_label('Ask for a contribution', exact=True).check()
        page.get_by_role('radio', name='Email', exact=True).click()
        page.get_by_role('textbox', name='Your PayID', exact=True).fill('driver@example.com')
        page.get_by_role('button', name='Save payment preferences', exact=True).click()
        expect(page.get_by_text('A$5 · PayID', exact=True)).to_be_visible()
        page.reload()
        page.locator('.contribution-choice > summary').click()
        expect(page.get_by_label('Ask for a contribution', exact=True)).to_be_checked()
        expect(page.get_by_role('textbox', name='Your PayID', exact=True)).to_have_value('driver@example.com')
        page.get_by_role('radio', name='In 30 min', exact=True).click()
        page.screenshot(path=f'/tmp/usual-route-saved-{width}.png', full_page=True)
        page.evaluate("""() => { navigator.geolocation.getCurrentPosition = (success, failure) => failure({code:1}); }""")
        page.get_by_role('button', name='OFFER A RIDE', exact=True).click()
        expect(page.get_by_role('dialog')).to_contain_text('No ride was offered')
        page.get_by_role('button', name='OKAY', exact=True).click()
        assert not state['offers']
        page.evaluate("""() => { navigator.geolocation.getCurrentPosition = (success) => success({coords:{latitude:-33.89,longitude:151.19,accuracy:10},timestamp:Date.now()}); }""")
        page.get_by_role('button', name='OFFER A RIDE', exact=True).click()
        expect(page.get_by_role('dialog')).to_contain_text('already have an active ride')
        assert state['offers'][-1]['departureMinutes'] == 30
        assert state['offers'][-1]['origin']['longitude'] == 151.19
        page.get_by_role('button', name='OKAY', exact=True).click()
        page.goto('http://127.0.0.1:3090/usual-route?ride=matching-ride')
        state['missing'] = True
        page.get_by_role('button', name='Review matching ride', exact=True).click()
        expect(page.get_by_role('dialog')).to_contain_text('no longer available')
        page.get_by_role('button', name='OKAY', exact=True).click()
        state['missing'] = False
        page.get_by_role('button', name='Review matching ride', exact=True).click()
        expect(page).to_have_url('http://127.0.0.1:3090/rides/matching-ride')
        expect(page.get_by_role('button', name='REQUEST TO JOIN', exact=True)).to_be_visible()
        assert len(state['offers']) == 1
        page.goto('http://127.0.0.1:3090/usual-route')
        page.get_by_role('button', name='Replace saved route', exact=True).click()
        expect(page.get_by_role('dialog', name='Replace saved route')).to_be_visible()
        expect(page.get_by_role('button', name='KEEP IT', exact=True)).to_be_focused()
        page.keyboard.press('Escape')
        expect(page.get_by_role('dialog')).to_have_count(0)
        page.get_by_role('button', name='Replace saved route', exact=True).click()
        page.get_by_role('button', name='REMOVE SAVED ROUTE', exact=True).click()
        expect(page.get_by_role('button', name='Save route', exact=True)).to_be_visible()
        assert state['saved'] is None
        state['fail'] = True
        page.reload()
        expect(page.get_by_role('dialog')).to_be_visible()
        page.get_by_role('button', name='OKAY', exact=True).click()
        expect(page.get_by_role('button', name='Try again', exact=True)).to_be_visible()
        expect(page.get_by_text('Sign in to save your private route.', exact=True)).to_have_count(0)
        state['fail'] = False
        page.get_by_role('button', name='Try again', exact=True).click()
        expect(page.get_by_role('button', name='Save route', exact=True)).to_be_visible()
        state['signed'] = False
        page.evaluate("window.dispatchEvent(new Event('cocowheels:identity-changed'))")
        expect(page.get_by_text('Sign in to save your private route.', exact=True)).to_be_visible()
        expect(page.get_by_role('button', name='Save route', exact=True)).to_have_count(0)
        assert not errors, errors
        print(f'PASS usual route {width}px', flush=True)
        context.close()
    browser.close()
