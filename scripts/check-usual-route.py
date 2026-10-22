"""Isolated Chromium UI fixtures on :3090. No production/API/provider emails."""
from playwright.sync_api import sync_playwright, expect
import copy
import re
from datetime import datetime, timezone, timedelta

origin = {'latitude': -33.88, 'longitude': 151.20, 'label': 'Town Hall, Sydney', 'countryCode':'au'}
destination = {'latitude': -33.88, 'longitude': 151.25, 'label': 'University of Sydney', 'countryCode':'au'}
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width in [320, 390, 844, 1440]:
        context = browser.new_context(viewport={'width': width, 'height': 900})
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        state = {'saved': None, 'writes': [], 'offers': [], 'signed': True, 'fail': False, 'missing': False, 'searches': []}
        ride = {'rideId':'matching-ride', 'driverAlias':'driv1234', 'status':'PUBLISHED', 'priceAud':5,
                'scheduledDepartureAt': (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(), 'expiresAt':'2099-01-01T00:00:00Z',
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
                state['searches'].append(body)
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
        expect(page.get_by_role('radio', name='Now', exact=True)).to_have_count(0)
        expect(page.get_by_role('radio', name='In 30 min', exact=True)).to_have_attribute('aria-checked','true')
        expect(page.get_by_placeholder('Where from?', exact=True)).to_be_focused()
        expect(page.get_by_role('button', name='Use current location', exact=True)).to_have_count(0)
        page.get_by_role('radio', name='In 1 hour', exact=True).click()
        expect(page.get_by_role('radio', name='In 1 hour', exact=True)).to_have_attribute('aria-checked','true')
        page.screenshot(path=f'/tmp/usual-route-normal-offer-{width}.png', full_page=True)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        page.goto('http://127.0.0.1:3090/?start=rider')
        expect(page.get_by_placeholder('Where from?', exact=True)).to_be_focused()
        expect(page.get_by_role('button', name='Use current location', exact=True)).to_have_count(0)
        page.get_by_placeholder('Where to?', exact=True).fill('University')
        page.locator('.place-search').last.get_by_role('button', name='Search', exact=True).click()
        page.get_by_role('button', name=destination['label'], exact=True).click()
        expect(page.get_by_role('heading', name='Choose a ride', exact=True)).to_have_count(0)
        page.get_by_placeholder('Where from?', exact=True).fill('Town Hall')
        page.locator('.place-search').first.get_by_role('button', name='Search', exact=True).click()
        page.get_by_role('button', name=origin['label'], exact=True).click()
        assert state['searches'][-1]['countryCode'] == 'au'
        assert state['searches'][-1]['bias'] == {'latitude':destination['latitude'], 'longitude':destination['longitude']}
        expect(page.get_by_role('heading', name='Choose a ride', exact=True)).to_be_visible()
        expect(page.locator('.ride-option')).to_have_count(1)
        expect(page.locator('.ride-option-departure')).to_have_text('Departs in 1 hr')
        expect(page.locator('.ride-option-main small').first).to_contain_text('10 min away')
        expect(page.locator('.leaflet-container')).to_be_visible()
        expect(page.locator('.ride-selection-route-key .driver-location-age')).to_have_count(0)
        page.screenshot(path=f'/tmp/private-discovery-{width}.png', full_page=True, animations='disabled')
        if width == 390:
            page.clock.install()
            page.clock.set_system_time(datetime.fromisoformat(ride['scheduledDepartureAt']))
            page.clock.run_for(1100)
            expect(page.locator('.ride-option-departure')).to_have_text('Departing now')
            page.clock.fast_forward(61000)
            expect(page.locator('.ride-option-departure')).to_have_text('Delayed 1 min')
            page.clock.set_system_time(datetime.now(timezone.utc))
        page.get_by_role('button', name='Back to route search', exact=True).click()
        expect(page.get_by_placeholder('Where from?', exact=True)).to_have_value(origin['label'])
        expect(page.get_by_placeholder('Where to?', exact=True)).to_have_value(destination['label'])
        page.screenshot(path=f'/tmp/shared-route-find-{width}.png', full_page=True, animations='disabled')
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        page.get_by_placeholder('Where from?', exact=True).fill('Town')
        expect(page.get_by_placeholder('Where from?', exact=True)).to_be_focused()
        expect(page.get_by_role('heading', name='Choose a ride', exact=True)).to_have_count(0)
        page.locator('.place-search').first.get_by_role('button', name='Search', exact=True).click()
        page.get_by_role('button', name=origin['label'], exact=True).click()
        expect(page.get_by_role('heading', name='Choose a ride', exact=True)).to_be_visible()
        page.goto('http://127.0.0.1:3090/usual-route')
        expect(page.get_by_role('heading', name='My usual route', exact=True)).to_be_visible()
        expect(page.get_by_role('heading', name='Profile', exact=True)).to_be_visible()
        expect(page.get_by_placeholder('Where from?', exact=True)).to_be_focused()
        page.get_by_role('button', name=re.compile('^Profile:')).click()
        expect(page.get_by_role('link', name='Profile', exact=True)).to_be_visible()
        page.screenshot(path=f'/tmp/profile-menu-{width}.png', full_page=True)
        page.get_by_role('link', name='Profile', exact=True).click()
        expect(page.get_by_label('Email me matching rides', exact=True)).not_to_be_checked()
        page.get_by_label('Email me matching rides', exact=True).check()
        page.get_by_label('Email me matching rides', exact=True).click()
        expect(page.get_by_role('dialog')).to_contain_text('You won’t receive matching ride emails')
        page.screenshot(path=f'/tmp/profile-mute-{width}.png', full_page=True)
        page.keyboard.press('Escape')
        expect(page.get_by_label('Email me matching rides', exact=True)).to_be_focused()
        page.get_by_label('Email me matching rides', exact=True).click()
        page.get_by_role('button', name='GO BACK', exact=True).click()
        expect(page.get_by_label('Email me matching rides', exact=True)).to_be_checked()
        page.get_by_label('Email me matching rides', exact=True).click()
        page.get_by_role('button', name='TURN OFF EMAILS', exact=True).click()
        expect(page.get_by_label('Email me matching rides', exact=True)).not_to_be_checked()
        page.get_by_placeholder('Where from?').fill('Town Hall')
        page.locator('.place-search').nth(0).get_by_role('button', name='Search', exact=True).click()
        page.get_by_role('button', name=origin['label'], exact=True).click()
        assert state['searches'][-1]['countryCode'] == 'au'
        assert state['searches'][-1]['bias'] == {'latitude':origin['latitude'], 'longitude':origin['longitude']}
        expect(page.get_by_placeholder('Where to?', exact=True)).to_be_focused()
        page.goto('http://127.0.0.1:3090/help')
        page.goto('http://127.0.0.1:3090/usual-route')
        expect(page.get_by_placeholder('Where from?', exact=True)).to_have_value(origin['label'])
        expect(page.get_by_placeholder('Where to?', exact=True)).to_be_focused()
        assert not state['writes']
        page.get_by_placeholder('Where to?').fill('University')
        page.reload()
        expect(page.get_by_placeholder('Where to?', exact=True)).to_have_value('University')
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
        time_input = page.get_by_label('Usual departure time', exact=True)
        time_input.fill('12:00')
        expect(time_input).to_have_value('12:00')
        expect(page.get_by_text('Around', exact=True)).to_have_count(0)
        assert time_input.evaluate('''el => {
            const input = el.getBoundingClientRect();
            const parent = el.parentElement.getBoundingClientRect();
            return input.left >= parent.left && input.right <= parent.right + 1;
        }''')
        expect(page.get_by_text('11:00 am–1:00 pm · Sydney time', exact=True)).to_have_count(0)
        page.screenshot(path=f'/tmp/usual-route-form-{width}.png', full_page=True)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        page.get_by_role('button', name='Save route', exact=True).click()
        expect(page.get_by_role('button', name='Mute email alerts', exact=True)).to_be_visible()
        assert state['saved']['days'] == [1,2,3,4]
        assert state['saved']['minute'] == 720
        assert page.evaluate("sessionStorage.getItem('cocowheels:profile-route-draft:v1:ride1234')") is None
        page.reload()
        expect(page.get_by_role('button', name='Mute email alerts', exact=True)).to_be_visible()
        page.get_by_role('button', name='Mute email alerts', exact=True).click()
        page.get_by_role('button', name='TURN OFF EMAILS', exact=True).click()
        expect(page.get_by_role('button', name='Enable email alerts', exact=True)).to_be_visible()
        assert not state['saved']['alerts']
        page.get_by_role('button', name='Enable email alerts', exact=True).click()
        expect(page.get_by_role('button', name='Mute email alerts', exact=True)).to_be_visible()
        assert state['saved']['priceAud'] == 0
        assert state['saved']['payId'] == ''
        page.locator('.contribution-choice > summary').click()
        page.get_by_label('Ask for a contribution', exact=True).check()
        expect(page.get_by_placeholder('04xx xxx xxx')).to_be_visible()
        page.get_by_role('radio', name='Other', exact=True).click()
        expect(page.get_by_placeholder('ABN or organisation identifier')).to_be_visible()
        page.get_by_role('radio', name='Email', exact=True).click()
        expect(page.get_by_placeholder('name@example.com')).to_be_visible()
        page.get_by_role('textbox', name='Your PayID email', exact=True).fill('driver@example.com')
        page.get_by_label('You receive', exact=True).fill('5.50')
        page.get_by_label('You receive', exact=True).fill('999999')
        expect(page.get_by_label('You receive', exact=True)).to_have_value('5.50')
        page.get_by_role('button', name='Save payment preferences', exact=True).click()
        expect(page.get_by_text('A$5.50 · PayID', exact=True)).to_be_visible()
        page.reload()
        page.locator('.contribution-choice > summary').click()
        expect(page.get_by_label('Ask for a contribution', exact=True)).to_be_checked()
        expect(page.get_by_role('textbox', name='Your PayID email', exact=True)).to_have_value('driver@example.com')
        expect(page.get_by_role('radio', name='Now', exact=True)).to_have_count(0)
        expect(page.get_by_role('radio', name='In 30 min', exact=True)).to_have_count(0)
        page.screenshot(path=f'/tmp/usual-route-saved-{width}.png', full_page=True)
        expect(page.get_by_role('button', name='OFFER A RIDE', exact=True)).to_have_count(0)
        assert not state['offers']
        page.goto('http://127.0.0.1:3090/usual-route?ride=matching-ride')
        state['missing'] = True
        page.get_by_role('button', name='Review matching ride', exact=True).click()
        expect(page.get_by_role('dialog')).to_contain_text('no longer available')
        page.get_by_role('button', name='OKAY', exact=True).click()
        state['missing'] = False
        page.get_by_role('button', name='Review matching ride', exact=True).click()
        expect(page).to_have_url('http://127.0.0.1:3090/rides/matching-ride')
        expect(page.get_by_role('button', name='REQUEST TO JOIN', exact=True)).to_be_visible()
        assert not state['offers']
        page.goto('http://127.0.0.1:3090/usual-route')
        page.get_by_role('button', name='Edit route', exact=True).click()
        expect(page.get_by_role('button', name='Save route', exact=True)).to_be_visible()
        page.get_by_role('button', name='Cancel', exact=True).click()
        assert state['saved'] is not None
        state['fail'] = True
        page.reload()
        expect(page.get_by_role('dialog')).to_be_visible()
        page.get_by_role('button', name='OKAY', exact=True).click()
        expect(page.get_by_role('button', name='Try again', exact=True)).to_be_visible()
        expect(page.get_by_text('Sign in to save your private route.', exact=True)).to_have_count(0)
        state['fail'] = False
        page.get_by_role('button', name='Try again', exact=True).click()
        expect(page.get_by_role('button', name='Edit route', exact=True)).to_be_visible()
        state['signed'] = False
        page.evaluate("window.dispatchEvent(new Event('cocowheels:identity-changed'))")
        expect(page.get_by_text('Sign in to save your private route.', exact=True)).to_be_visible()
        expect(page.get_by_role('button', name='Save route', exact=True)).to_have_count(0)
        assert not errors, errors
        print(f'PASS usual route {width}px', flush=True)
        context.close()
    browser.close()
