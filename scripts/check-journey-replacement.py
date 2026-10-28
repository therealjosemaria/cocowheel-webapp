"""Mocked browser contract; no live API writes or external provider calls."""
from datetime import datetime, timedelta, timezone
from playwright.sync_api import sync_playwright, expect

BASE = 'http://127.0.0.1:3201'
now = datetime.now(timezone.utc)
origin = dict(latitude=-33.91, longitude=151.18, label='Example origin')
destination = dict(latitude=-33.86, longitude=151.21, label='Example destination')
request = dict(id='replacement-test', alias='rider001', origin=origin, destination=destination,
               date='any', time='', status='OPEN', createdAt=now.isoformat(),
               expiresAt=(now+timedelta(hours=48)).isoformat(), offeredContributionAud=0)
offer = dict(id='proposal-test', demandId=request['id'], rideId='', pendingReplacement=True,
             driverAlias='driver01', origin=origin, destination=destination, priceAud=0,
             departureAt=(now+timedelta(hours=1)).isoformat(), status='PENDING')

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width in [320, 390, 844, 1440]:
        context = browser.new_context(viewport={'width': width, 'height': 900})
        page = context.new_page()
        writes, errors = [], []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.route('**/*', lambda r: r.continue_() if r.request.url.startswith(BASE) else r.abort())
        def api(r):
            path = r.request.url.split('/api/')[-1].split('?')[0]
            if path == 'university/session': data = {'unikey':'driver01'}
            elif path == 'current': data = {'current':None, 'currents':([] if writes and writes[-1].get('replacePostedRideId') else [{'role':'DRIVER','ride':{'rideId':'source-test','status':'PUBLISHED', 'driverAlias':'driver01', 'priceAud':0, 'scheduledDepartureAt':offer['departureAt'], 'plannedRoute':{'origin':origin,'destination':destination}, 'requests':[]}}]), 'pendingDemandOffers':0}
            elif path == 'history': data = {'driver':[], 'rider':[]}
            elif path == 'rider-demands/search': data = {'requests':[request]}
            elif path == 'route-preview': data = {'points':[origin,destination], 'durationSeconds':600}
            elif path == 'rider-demands': data = {'requests':[dict(request,offers=[offer])], 'sent':[offer]}
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
            page.screenshot(path=f'/tmp/journey-replacement-{name}-{width}.png', full_page=True)
        page.goto(BASE+'/?start=driver')
        page.get_by_role('button',name='See journey requests',exact=True).click()
        page.get_by_role('button',name='SEARCH',exact=True).click()
        page.locator('.journey-request-results .activity-card').first.get_by_role('button',name='Offer a ride',exact=True).click()
        review = page.get_by_role('dialog',name='Offer a ride',exact=True)
        review.get_by_role('button',name='Offer a ride',exact=True).click()
        confirmation = page.get_by_role('dialog',name='If accepted, this will replace your posted journey.',exact=True)
        expect(confirmation).to_be_visible()
        capture('confirmation')
        confirmation.get_by_role('button',name='Go back',exact=True).click()
        expect(review).to_be_visible()
        assert len(writes) == 1 and not writes[0].get('replacePostedRideId')
        review.get_by_role('button',name='Offer a ride',exact=True).click()
        confirmation.get_by_role('button',name='Offer a ride',exact=True).click()
        page.wait_for_url('**/activity#ride-requests')
        expect(page.get_by_text('Awaiting reply')).to_be_visible()
        assert writes[-1]['replacePostedRideId'] == 'source-test'
        assert writes[-1]['origin'] == origin and writes[-1]['destination'] == destination
        expect(page.get_by_role('link',name='View ride',exact=True)).to_have_count(0)
        capture('sent')
        page.goto(BASE+'/activity/requests/'+request['id'])
        expect(page.get_by_role('button',name='Accept ride',exact=True)).to_be_visible()
        expect(page.get_by_role('button',name='Decline',exact=True)).to_be_visible()
        capture('rider')
        assert not errors, errors
        print(f'PASS {width}: confirmation, cancel, consent payload, sent and rider views', flush=True)
        context.close()
    browser.close()
