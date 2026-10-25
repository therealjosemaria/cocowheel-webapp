"""Isolated rider-demand UI checks: all API responses mocked, external traffic blocked."""
from playwright.sync_api import sync_playwright, expect
from datetime import datetime, timedelta, timezone

BASE = 'http://127.0.0.1:3201'
expect.set_options(timeout=20000)
origin = {'latitude': -33.91, 'longitude': 151.18, 'label': 'Example origin, Sydney'}
destination = {'latitude': -33.86, 'longitude': 151.21, 'label': 'Example destination, Sydney'}
now = datetime.now(timezone.utc)
request = dict(id='request-1', alias='rider001', origin=origin, destination=destination, date='any', time='', status='OPEN', createdAt=now.isoformat(), expiresAt=(now+timedelta(hours=48)).isoformat())
offer = dict(id='offer-1', demandId='request-1', rideId='COCO-TEST123', driverAlias='driver01', departureAt=(now+timedelta(hours=1)).isoformat(), priceAud=0, origin=origin, destination=destination, status='PENDING')

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width in [320,390,844,1440]:
        context=browser.new_context(viewport={'width':width,'height':900})
        page=context.new_page()
        errors, writes=[],[]
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.route('**/*', lambda r: r.continue_() if r.request.url.startswith(BASE) else r.abort())
        def api(r):
            path=r.request.url.split('/api/')[-1].split('?')[0]
            if path=='university/session': data={'unikey':'rider001'}
            elif path=='current': data={'current':None,'currents':[],'pendingDemandOffers':1}
            elif path=='history': data={'driver':[],'rider':[]}
            elif path.startswith('profile-photo/'):
                r.fulfill(content_type='image/svg+xml',body='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#f1f5f9"/><circle cx="12" cy="8" r="3" fill="#64748b"/><path d="M5 22v-3a7 7 0 0 1 14 0v3" fill="#64748b"/></svg>'); return
            elif path=='place-search': data={'places':[origin if 'origin' in r.request.post_data_json['text'] else destination]}
            elif path=='route-preview': data={'points':[origin,destination],'durationSeconds':600}
            elif path=='search': data={'candidates':[],'serverNow':now.isoformat()}
            elif path=='rider-demands/search': data={'requests':[request,dict(request,id='request-2',alias='rider002')]}
            elif path=='rider-demands' and r.request.method=='GET': data={'requests':[dict(request,offers=[offer])],'sent':[]}
            elif path=='rider-demands' and r.request.method=='POST':
                writes.append(r.request.post_data_json); data={'request':request}
            elif path.endswith('/offer'):
                writes.append(r.request.post_data_json)
                r.fulfill(status=409,json={'error':'VEHICLE_PLATE_REQUIRED'}); return
            elif path.endswith('/respond') or path.endswith('/cancel'): data={'ok':True}
            else: data={}
            r.fulfill(json=data)
        page.route('**/api/**',api)
        def address(label,text):
            page.get_by_role('button',name=label,exact=True).click()
            dialog=page.get_by_role('dialog',name=label,exact=True)
            dialog.get_by_role('textbox').fill(text)
            dialog.get_by_role('button',name=origin['label'] if text=='origin' else destination['label'],exact=True).click()
        def capture(name):
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), name
            page.screenshot(path=f'/tmp/demand-{name}-{width}.png',full_page=True)
        page.goto(BASE+'/?start=rider')
        address('Where from?','origin'); address('Where to?','destination')
        page.get_by_role('button',name='FIND A RIDE',exact=True).click()
        expect(page.get_by_role('heading',name='Choose a ride')).to_be_visible()
        capture('rider-results')
        page.get_by_role('button',name='Post a ride request',exact=True).click()
        dialog=page.get_by_role('dialog',name='Post this ride request?',exact=True)
        expect(dialog.get_by_text('Drivers can see these addresses',exact=False)).to_be_visible()
        capture('post-review')
        page.keyboard.press('Escape')
        expect(page.get_by_role('button',name='Post a ride request',exact=True)).to_be_focused()
        assert not writes
        page.get_by_role('button',name='Post a ride request',exact=True).click()
        dialog.get_by_role('button',name='Post request',exact=True).click()
        expect(page.get_by_role('link',name='View your request')).to_be_visible()
        assert writes[-1]['origin']==origin
        page.goto(BASE+'/?start=driver')
        page.get_by_role('button',name='Find riders',exact=True).click()
        capture('driver-search')
        page.get_by_role('button',name='FIND RIDERS',exact=True).click()
        page.get_by_role('dialog',name='Route required').get_by_role('button',name='OKAY').click()
        address('Where from?','origin'); address('Where to?','destination')
        page.get_by_role('button',name='FIND RIDERS',exact=True).click()
        expect(page.locator('.demand-page').get_by_text('rider001',exact=True)).to_be_visible()
        page.get_by_role('button',name='Show route',exact=True).first.click()
        expect(page.get_by_role('button',name='Hide route',exact=True)).to_have_count(1)
        page.get_by_role('button',name='Show route',exact=True).click()
        expect(page.get_by_role('button',name='Hide route',exact=True)).to_have_count(1)
        capture('driver-results')
        page.locator('.demand-page .activity-card').first.get_by_role('button',name='Offer a ride',exact=True).click()
        dialog=page.get_by_role('dialog',name='Offer a ride',exact=True)
        capture('offer-review')
        dialog.get_by_role('button',name='Departure date:').click()
        expect(page.get_by_role('dialog',name='Departure date',exact=True)).to_be_visible()
        page.keyboard.press('Escape')
        expect(dialog).to_be_visible()
        expect(page.get_by_role('dialog',name='Departure date',exact=True)).not_to_be_visible()
        dialog.locator('summary').filter(has_text='Fare').click()
        dialog.get_by_role('checkbox',name='Ask for a contribution').check()
        dialog.get_by_label('You receive').fill('2.50')
        dialog.get_by_role('radio',name='Email',exact=True).click()
        dialog.get_by_label('Your PayID email').fill('driver@example.com')
        capture('offer-contribution')
        dialog.get_by_role('checkbox',name='Ask for a contribution').uncheck()
        dialog.get_by_role('button',name='Offer a ride',exact=True).click()
        plate=page.get_by_role('dialog',name='Add your number plate',exact=True)
        expect(plate).to_be_visible(); capture('plate')
        plate.get_by_role('button',name='Go back').click()
        expect(dialog).to_be_visible()
        page.keyboard.press('Escape'); expect(dialog).not_to_be_visible()
        page.goto(BASE+'/activity#ride-requests')
        expect(page.get_by_role('button',name='Accept ride')).to_be_visible()
        expect(page.get_by_text('Completed, cancelled, and expired rides will appear here.')).to_have_count(0)
        capture('activity')
        page.get_by_role('button',name='Cancel request',exact=True).click()
        confirm=page.get_by_role('dialog',name='Cancel your ride request?',exact=True)
        expect(confirm).to_be_visible(); capture('cancel')
        page.keyboard.press('Escape')
        page.goto(BASE+'/privacy')
        expect(page.get_by_text('Posting a ride request shares',exact=False)).to_be_visible()
        capture('privacy')
        page.goto(BASE+'/terms')
        expect(page.get_by_text('Riders can also post a journey',exact=False)).to_be_visible()
        capture('terms')
        assert not errors, errors
        print(f'PASS width={width}: posting, search, one selected map route, nested picker, plate, activity, cancellation, no overflow/errors',flush=True)
        context.close()
    browser.close()
