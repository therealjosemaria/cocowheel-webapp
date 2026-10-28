"""Mocked browser contract; no live API writes or external provider calls."""
from datetime import datetime, timedelta, timezone
from playwright.sync_api import sync_playwright, expect

BASE = 'http://127.0.0.1:3201'
now = datetime.now(timezone.utc)
origin = dict(latitude=-33.91, longitude=151.18, label='Example origin')
destination = dict(latitude=-33.86, longitude=151.21, label='Example destination')
request = dict(id='replacement-test', alias='rider001', origin=origin, destination=destination,
               date='any', time='', status='OPEN', createdAt=(now-timedelta(hours=1)).isoformat(),
               expiresAt=(now+timedelta(hours=48)).isoformat(), offeredContributionAud=0)
offer = dict(id='proposal-test', demandId=request['id'], rideId='', pendingReplacement=True,
             createdAt=now.isoformat(),
             driverAlias='driver01', origin=origin, destination=destination, priceAud=0,
             departureAt=(now+timedelta(hours=1)).isoformat(), status='PENDING')

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width in [320, 390, 844, 1440]:
        context = browser.new_context(viewport={'width': width, 'height': 900})
        page = context.new_page()
        writes, errors = [], []
        withdrawn = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.route('**/*', lambda r: r.continue_() if r.request.url.startswith(BASE) else r.abort())
        def api(r):
            path = r.request.url.split('/api/')[-1].split('?')[0]
            if path == 'university/session': data = {'unikey':'driver01'}
            elif path == 'current': data = {'current':None, 'currents':[{'role':'DRIVER','ride':{'rideId':'source-test','status':'PUBLISHED', 'createdAt':(now-timedelta(hours=2)).isoformat(), 'driverAlias':'driver01', 'priceAud':0, 'scheduledDepartureAt':offer['departureAt'], 'plannedRoute':{'origin':origin,'destination':destination}, 'requests':[]}}], 'pendingDemandOffers':0}
            elif path == 'history': data = {'driver':[], 'rider':[]}
            elif path == 'rider-demands/search': data = {'requests':[request]}
            elif path == 'route-preview': data = {'points':[origin,destination], 'durationSeconds':600}
            elif path == 'rider-demands':
                visible_offer = dict(offer, status='WITHDRAWN' if withdrawn else 'PENDING')
                data = {'requests':[dict(request,offers=[visible_offer])], 'sent':[dict(offer,id='closed-newer',status='DECLINED',createdAt=(now+timedelta(hours=1)).isoformat()),visible_offer]}
            elif path.endswith('/withdraw'):
                withdrawn.append(path)
                data = {'ok':True}
            elif path.endswith('/offer'):
                writes.append(r.request.post_data_json)
                if not writes[-1].get('replacePostedRideId'):
                    r.fulfill(status=409,json={'error':'POSTED_JOURNEY_REPLACEMENT_REQUIRED'}); return
                data = {'offer':offer}
            else: data = {}
            r.fulfill(json=data)
        page.route('**/api/**', api)
        def capture(name):
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), name
            page.screenshot(path=f'/tmp/journey-replacement-{name}-{width}.png', full_page=True, animations='disabled')
        page.goto(BASE+'/?start=driver')
        page.get_by_role('button',name='See journey requests',exact=True).click()
        page.get_by_role('button',name='SEARCH',exact=True).click()
        page.locator('.journey-request-results .activity-card').first.get_by_role('button',name='Offer a ride',exact=True).click()
        review = page.get_by_role('dialog',name='Offer a ride',exact=True)
        review.locator('summary').click()
        review.get_by_role('checkbox',name='Ask for a contribution').check()
        review.get_by_role('textbox',name='You receive',exact=True).fill('')
        review.get_by_role('button',name='Offer a ride',exact=True).click()
        expect(review.get_by_role('alert')).to_contain_text('Enter an amount from $1')
        review.get_by_role('textbox',name='You receive',exact=True).fill('5')
        for label in ['Mobile','Email','Other']:
            review.get_by_role('radio',name=label,exact=True).click()
            review.get_by_role('button',name='Offer a ride',exact=True).click()
            expect(review.get_by_role('alert')).to_have_text('Enter your PayID to receive a contribution.')
        capture('payment-error')
        assert not writes
        review.get_by_role('checkbox',name='Ask for a contribution').uncheck()
        review.get_by_role('button',name='Offer a ride',exact=True).click()
        confirmation = page.get_by_role('dialog',name='If accepted, this will replace your posted journey.',exact=True)
        expect(confirmation).to_be_visible()
        capture('confirmation')
        confirmation.get_by_role('button',name='Go back',exact=True).click()
        expect(review).to_be_visible()
        assert len(writes) == 1 and not writes[0].get('replacePostedRideId')
        review.get_by_role('button',name='Offer a ride',exact=True).click()
        confirmation.get_by_role('button',name='Offer a ride',exact=True).click()
        page.wait_for_url('**/activity#offer-proposal-test')
        expect(page.get_by_text('Awaiting reply')).to_be_visible()
        expect(page.locator('.activity-card').first).to_have_attribute('id','offer-proposal-test')
        assert page.locator('.activity-card').count() == 4
        expect(page.get_by_role('button',name='WITHDRAW OFFER',exact=True)).to_have_count(0)
        expect(page.locator('#offer-proposal-test .activity-open')).to_have_text('DETAILS')
        assert page.get_by_text('Awaiting reply',exact=True).evaluate('(el) => getComputedStyle(el).color') == 'rgb(22, 101, 52)'
        assert writes[-1]['replacePostedRideId'] == 'source-test'
        assert writes[-1]['origin'] == origin and writes[-1]['destination'] == destination
        expect(page.get_by_role('link',name='View ride',exact=True)).to_have_count(0)
        capture('sent')
        page.goto(BASE+'/activity/requests/'+request['id'])
        expect(page.get_by_role('button',name='Accept ride',exact=True)).to_be_visible()
        expect(page.get_by_role('button',name='Decline',exact=True)).to_be_visible()
        capture('rider')
        page.goto(BASE+'/activity#offer-proposal-test')
        page.locator('#offer-proposal-test .activity-open').click()
        page.wait_for_url('**/activity/offers/proposal-test')
        expect(page.get_by_role('link',name='Back',exact=True)).to_be_visible()
        expect(page.locator('.activity-card')).to_have_count(1)
        expect(page.get_by_role('button',name='WITHDRAW OFFER',exact=True)).to_have_class('activity-request-end')
        expect(page.locator('.leaflet-container')).to_be_visible()
        expect(page.locator('.leaflet-overlay-pane path').first).to_be_visible()
        capture('offer-details')
        page.reload()
        page.get_by_role('button',name='WITHDRAW OFFER',exact=True).click()
        withdrawal = page.get_by_role('dialog',name='Withdraw this offer?',exact=True)
        capture('withdraw')
        withdrawal.get_by_role('button',name='Withdraw offer',exact=True).click()
        expect(page.get_by_text('Withdrawn',exact=True)).to_be_visible()
        expect(page.get_by_role('button',name='WITHDRAW OFFER',exact=True)).to_have_count(0)
        assert page.get_by_text('Withdrawn',exact=True).evaluate('(el) => getComputedStyle(el).color') != 'rgb(22, 101, 52)'
        capture('offer-withdrawn')
        page.goto(BASE+'/activity')
        expect(page.get_by_text('Withdrawn',exact=True)).to_be_visible()
        assert page.locator('.activity-card').first.get_attribute('id') != 'offer-proposal-test'
        page.goto(BASE+'/activity/offers/missing')
        expect(page.get_by_text('This offer is not available.',exact=True)).to_be_visible()
        page.goto(BASE+'/activity/requests/'+request['id'])
        expect(page.get_by_role('button',name='Accept ride',exact=True)).to_have_count(0)
        expect(page.get_by_text('withdrawn',exact=True)).to_be_visible()
        assert len(withdrawn) == 1
        assert not errors, errors
        print(f'PASS {width}: payment errors, confirmation, consent, sent/rider views and withdrawal', flush=True)
        context.close()
    browser.close()
