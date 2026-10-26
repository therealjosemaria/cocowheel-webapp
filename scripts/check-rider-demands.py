"""Isolated rider-demand UI checks: all API responses mocked, external traffic blocked."""
from playwright.sync_api import sync_playwright, expect
from datetime import datetime, timedelta, timezone
import os

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
        errors, writes, searches=[],[],[]
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.route('**/*', lambda r: r.continue_() if r.request.url.startswith(BASE) else r.abort())
        def api(r):
            path=r.request.url.split('/api/')[-1].split('?')[0]
            if path=='university/session': data={'unikey':'rider001'}
            elif path=='current': data={'current':None,'currents':[],'pendingDemandOffers':0,'activeDemand':request if any('date' in body for body in writes) else None}
            elif path=='history': data={'driver':[],'rider':[]}
            elif path=='usual-route': data={'route':{'origin':origin,'destination':destination,'alerts':True},'alertsAvailable':True}
            elif path.startswith('profile-photo/'):
                r.fulfill(content_type='image/svg+xml',body='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#f1f5f9"/><circle cx="12" cy="8" r="3" fill="#64748b"/><path d="M5 22v-3a7 7 0 0 1 14 0v3" fill="#64748b"/></svg>'); return
            elif path=='place-search': data={'places':[origin if 'origin' in r.request.post_data_json['text'] else destination]}
            elif path=='route-preview': data={'points':[origin,destination],'durationSeconds':600}
            elif path=='search': data={'candidates':[],'serverNow':now.isoformat()}
            elif path=='rider-demands/search':
                searches.append(r.request.post_data_json)
                data={'requests':[request,dict(request,id='request-2',alias='rider002')]}
            elif path=='rider-demands' and r.request.method=='GET': data={'requests':[dict(request,offers=[offer])],'sent':[]}
            elif path=='rider-demands' and r.request.method=='POST':
                if not r.request.post_data_json.get('replaceDemandId'):
                    r.fulfill(status=409,json={'error':'DEMAND_ALREADY_OPEN'}); return
                writes.append(r.request.post_data_json); data={'request':request}
            elif path=='rides':
                writes.append(r.request.post_data_json)
                r.fulfill(status=409,json={'error':'LIFT_REQUEST_WITHDRAWAL_REQUIRED'} if not r.request.post_data_json.get('withdrawLiftRequestId') else {'error':'INVALID_DEPARTURE_TIME'}); return
            elif path.endswith('/offer'):
                writes.append(r.request.post_data_json)
                body=r.request.post_data_json
                code='VEHICLE_PLATE_REQUIRED' if not body.get('plate') else 'LIFT_REQUEST_WITHDRAWAL_REQUIRED' if not body.get('withdrawLiftRequestId') else 'DEMAND_UNAVAILABLE'
                r.fulfill(status=409,json={'error':code}); return
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
            for modal in page.locator('.demand-prompt:visible').all():
                message = modal.locator(':scope > p').first
                expect(message).to_have_css('text-align', 'left')
                left = message.bounding_box()['x']
                for field in modal.locator('.demand-fields dt, .demand-fields dd').all():
                    assert abs(field.bounding_box()['x'] - left) < 1, (name, 'indented modal field')
            page.screenshot(path=f'/tmp/demand-{name}-{width}.png',full_page=True)
        page.goto(BASE+'/?start=rider')
        address('Where from?','origin'); address('Where to?','destination')
        page.get_by_role('button',name='FIND A JOURNEY',exact=True).click()
        expect(page.get_by_role('button',name='Request this journey',exact=True)).to_be_visible()
        ask=page.get_by_role('button',name='Request this journey',exact=True)
        save=page.get_by_role('button',name='Save route',exact=True)
        page.wait_for_timeout(300)
        capture('rider-results')
        expect(page.locator('.ride-options button.text-button')).to_have_count(0)
        expect(page.locator('.ride-search-secondary-actions button').first).to_have_text('Save route')
        expect(page.locator('.ride-search-secondary-actions button').nth(1)).to_have_text('Request this journey')
        if width == 320:
            assert save.bounding_box()['y']+save.bounding_box()['height'] <= ask.bounding_box()['y']
        else:
            assert abs(ask.bounding_box()['y']-save.bounding_box()['y']) < 1
            assert save.bounding_box()['x']+save.bounding_box()['width'] <= ask.bounding_box()['x']
        assert ask.bounding_box()['height'] >= 44 and save.bounding_box()['height'] >= 44
        capture('rider-results')
        save.click()
        expect(page.get_by_role('button',name='Route saved',exact=True)).to_be_disabled()
        assert not writes
        join=page.get_by_role('button',name='REQUEST TO JOIN',exact=True)
        expect(join).to_be_enabled()
        join.click()
        expect(page.get_by_text('Select a ride from the list to continue.',exact=True)).to_be_visible()
        capture('select-ride-notice')
        page.get_by_role('button',name='OKAY',exact=True).click()
        assert not writes
        page.get_by_role('button',name='Request this journey',exact=True).click()
        dialog=page.get_by_role('dialog',name='Request this journey',exact=True)
        expect(dialog.get_by_text('Drivers can see these addresses',exact=False)).to_be_visible()
        buttons=dialog.locator('.cancel-prompt-actions > button')
        expect(buttons).to_have_count(2)
        styles=buttons.evaluate_all('(els) => els.map(el => { const s=getComputedStyle(el); const b=el.getBoundingClientRect(); return {width:b.width,height:b.height,font:s.fontFamily,size:s.fontSize,weight:s.fontWeight,padding:s.padding,radius:s.borderRadius}; })')
        assert styles[0] == styles[1], styles
        assert styles[0]['height'] >= 44
        assert dialog.locator('.cancel-prompt-actions').evaluate('(el) => getComputedStyle(el).gap') == '8px'
        capture('post-review')
        page.keyboard.press('Escape')
        expect(page.get_by_role('button',name='Request this journey',exact=True)).to_be_focused()
        assert not writes
        page.get_by_role('button',name='Request this journey',exact=True).click()
        dialog.get_by_role('button',name='Request',exact=True).click()
        replace=page.get_by_role('dialog',name='Replace your ride request?',exact=True)
        expect(replace).to_be_visible()
        capture('replace-post')
        replace.get_by_role('button',name='Cancel',exact=True).click()
        expect(replace).not_to_be_visible()
        assert not writes
        page.get_by_role('button',name='Request this journey',exact=True).click()
        dialog.get_by_role('button',name='Request',exact=True).click()
        expect(replace).to_be_visible()
        replace.get_by_role('button',name='Replace',exact=True).click()
        expect(page.get_by_role('link',name='View your post')).to_be_visible()
        assert writes[-1]['origin']==origin
        assert writes[-1]['replaceDemandId']=='request-1'
        profile=page.get_by_role('button',name='Profile:',exact=False)
        profile.click()
        expect(page.locator('#guest-identity-popover').get_by_role('link',name='Your post',exact=True)).to_be_visible()
        assert 'updates' not in profile.get_attribute('aria-label')
        page.wait_for_timeout(250)
        capture('profile-post')
        profile.click()
        if os.environ.get('GUMWHEEL_REQUEST_COPY_ONLY') == '1':
            assert not errors, errors
            print(f'PASS {width}: request wording, Save route unchanged, review/cancel/replace, focus and spacing', flush=True)
            context.close()
            continue
        page.goto(BASE+'/?start=driver')
        offer_button=page.get_by_role('button',name='POST A JOURNEY',exact=True)
        find_button=page.get_by_role('button',name='See journey requests',exact=True)
        assert find_button.bounding_box()['y'] > offer_button.bounding_box()['y']
        assert find_button.bounding_box()['y'] - (offer_button.bounding_box()['y'] + offer_button.bounding_box()['height']) >= 12
        capture('offer-entry')
        address('Where from?','origin'); address('Where to?','destination')
        offer_button.click()
        switch=page.get_by_role('dialog',name='Withdraw your post and offer a ride?',exact=True)
        expect(switch).to_be_visible(); capture('switch')
        switch.get_by_role('button',name='Go back',exact=True).click()
        assert not writes[-1].get('withdrawLiftRequestId')
        offer_button.click()
        switch.get_by_role('button',name='Withdraw & offer',exact=True).click()
        page.get_by_role('button',name='OKAY',exact=True).click()
        assert writes[-1]['withdrawLiftRequestId']=='request-1'
        page.goto(BASE+'/?start=driver')
        page.get_by_role('button',name='See journey requests',exact=True).click()
        page.wait_for_timeout(300)
        back=page.get_by_role('button',name='Back',exact=True)
        heading=page.get_by_role('heading',name='Journey requests',exact=True)
        assert back.bounding_box()['y']+back.bounding_box()['height'] <= heading.bounding_box()['y']
        assert abs(back.bounding_box()['x']-heading.bounding_box()['x']) < 1
        back.click()
        expect(page.get_by_role('button',name='POST A JOURNEY',exact=True)).to_be_visible()
        page.get_by_role('button',name='See journey requests',exact=True).click()
        page.wait_for_timeout(300)
        capture('driver-search')
        page.get_by_role('button',name='SEARCH',exact=True).click()
        expect(page.locator('.demand-page').get_by_text('rider001',exact=True)).to_be_visible()
        assert 'origin' not in searches[-1] and 'destination' not in searches[-1]
        assert searches[-1]['date']=='any' and searches[-1]['time']==''
        capture('unfiltered-results')
        page.locator('.demand-page .activity-card').first.get_by_role('button',name='Offer a ride',exact=True).click()
        unfiltered_offer=page.get_by_role('dialog',name='Offer a ride',exact=True)
        expect(unfiltered_offer.get_by_text(origin['label'],exact=True)).to_be_visible()
        expect(unfiltered_offer.get_by_text(destination['label'],exact=True)).to_be_visible()
        capture('unfiltered-offer')
        if os.environ.get('GUMWHEEL_MODAL_AUDIT_ONLY') == '1':
            assert not errors, errors
            print(f'PASS {width}: rider review, replacement, role switch and driver offer modal alignment', flush=True)
            context.close()
            continue
        page.keyboard.press('Escape')
        page.get_by_role('button',name='Edit search',exact=True).click()
        address('Where from?','origin')
        page.get_by_role('button',name='SEARCH',exact=True).click()
        expect(page.locator('.demand-page').get_by_text('rider001',exact=True)).to_be_visible()
        assert searches[-1]['origin']==origin and 'destination' not in searches[-1]
        capture('pickup-results')
        page.get_by_role('button',name='Edit search',exact=True).click()
        page.get_by_role('button',name='Where from?',exact=True).click()
        page.get_by_role('dialog',name='Where from?',exact=True).get_by_role('textbox').fill('')
        page.keyboard.press('Escape')
        address('Where to?','destination')
        page.get_by_role('button',name='SEARCH',exact=True).click()
        expect(page.locator('.demand-page').get_by_text('rider001',exact=True)).to_be_visible()
        assert 'origin' not in searches[-1] and searches[-1]['destination']==destination
        capture('destination-results')
        page.get_by_role('button',name='Edit search',exact=True).click()
        address('Where from?','origin'); address('Where to?','destination')
        page.get_by_role('button',name='SEARCH',exact=True).click()
        expect(page.locator('.demand-page').get_by_text('rider001',exact=True)).to_be_visible()
        edit=page.get_by_role('button',name='Edit search',exact=True)
        assert edit.bounding_box()['y']+edit.bounding_box()['height'] <= heading.bounding_box()['y']
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
        plate.get_by_role('textbox').fill('ABC123')
        plate.get_by_role('button',name='Save & offer',exact=True).click()
        expect(switch).to_be_visible(); capture('response-switch')
        switch.get_by_role('button',name='Withdraw & offer',exact=True).click()
        expect(plate.get_by_role('alert')).to_be_visible()
        assert writes[-1]['withdrawLiftRequestId']=='request-1'
        assert writes[-1]['plate']=='ABC123'
        plate.get_by_role('button',name='Go back').click()
        expect(dialog).to_be_visible()
        page.keyboard.press('Escape'); expect(dialog).not_to_be_visible()
        page.goto(BASE+'/activity#ride-requests')
        expect(page.locator('.demand-activity .activity-open')).to_be_visible()
        expect(page.get_by_text('Completed, cancelled, and expired rides will appear here.')).to_have_count(0)
        capture('activity')
        page.locator('.demand-activity .activity-open').click()
        expect(page.get_by_role('button',name='Accept ride')).to_be_visible()
        page.get_by_role('button',name='Withdraw post',exact=True).click()
        confirm=page.get_by_role('dialog',name='Withdraw your post?',exact=True)
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
