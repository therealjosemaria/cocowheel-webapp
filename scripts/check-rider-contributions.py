"""Isolated contribution review/discovery checks. No live APIs or external providers."""
from playwright.sync_api import sync_playwright, expect
from datetime import datetime, timedelta, timezone

BASE = 'http://127.0.0.1:3201'
origin = dict(latitude=-33.91, longitude=151.18, label='Example origin, Sydney')
destination = dict(latitude=-33.86, longitude=151.21, label='Example destination, Sydney')
now = datetime.now(timezone.utc)
request = dict(id='contribution-test', alias='rider001', origin=origin, destination=destination,
               date='any', time='', status='OPEN', createdAt=now.isoformat(),
               expiresAt=(now+timedelta(hours=48)).isoformat(), offeredContributionAud=10.25)

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width in [320, 390, 844, 1440]:
        context = browser.new_context(viewport={'width':width, 'height':900})
        page = context.new_page()
        errors, writes = [], []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.route('**/*', lambda r: r.continue_() if r.request.url.startswith(BASE) else r.abort())
        def api(r):
            path = r.request.url.split('/api/')[-1].split('?')[0]
            if path == 'university/session': data = {'unikey':'rider001'}
            elif path == 'current': data = {'current':None, 'currents':[], 'pendingDemandOffers':0}
            elif path == 'history': data = {'driver':[], 'rider':[]}
            elif path == 'place-search': data = {'places':[origin if 'origin' in r.request.post_data_json['text'] else destination]}
            elif path == 'search': data = {'candidates':[], 'serverNow':now.isoformat()}
            elif path == 'route-preview': data = {'points':[origin,destination], 'durationSeconds':600}
            elif path == 'rider-demands/search': data = {'requests':[request, dict(request,id='legacy',offeredContributionAud=0)]}
            elif path == 'rider-demands' and r.request.method == 'GET': data = {'requests':[dict(request,offers=[])], 'sent':[]}
            elif path == 'rider-demands':
                writes.append(r.request.post_data_json)
                if not writes[-1].get('replaceDemandId'):
                    r.fulfill(status=409,json={'error':'DEMAND_ALREADY_OPEN'}); return
                data = {'request':request}
            elif path.startswith('profile-photo/'):
                r.fulfill(content_type='image/svg+xml',body='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#f1f5f9"/><circle cx="12" cy="8" r="3" fill="#64748b"/><path d="M5 22v-3a7 7 0 0 1 14 0v3" fill="#64748b"/></svg>'); return
            else: data = {}
            r.fulfill(json=data)
        page.route('**/api/**', api)
        def capture(name):
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), name
            page.screenshot(path=f'/tmp/contribution-{name}-{width}.png', full_page=True)
        page.goto(BASE+'/?start=rider')
        for label, text, pin in [('Where from?','origin',origin),('Where to?','destination',destination)]:
            page.get_by_role('button',name=label,exact=True).click()
            dialog = page.get_by_role('dialog',name=label,exact=True)
            dialog.get_by_role('textbox').fill(text)
            dialog.get_by_role('button',name=pin['label'],exact=True).click()
        page.get_by_role('button',name='FIND A JOURNEY',exact=True).click()
        page.get_by_role('button',name='Request this journey',exact=True).click()
        dialog = page.get_by_role('dialog',name='Request this journey',exact=True)
        capture('default')
        dialog.locator('summary').click()
        checkbox = dialog.get_by_role('checkbox',name='Offer a contribution')
        expect(checkbox).not_to_be_checked()
        checkbox.check()
        amount = dialog.get_by_role('textbox',name='Amount',exact=True)
        dialog.get_by_role('button',name='Request',exact=True).click()
        expect(dialog.get_by_role('alert')).to_contain_text('Enter an amount from $1')
        assert not writes
        amount.fill('10.25')
        expect(dialog.get_by_text('Your PayID',exact=True)).to_have_count(0)
        capture('amount')
        dialog.get_by_role('button',name='Request',exact=True).click()
        replacement = page.get_by_role('dialog',name='Replace your ride request?',exact=True)
        expect(replacement.get_by_text('A$10.25',exact=True)).to_be_visible()
        capture('replacement')
        replacement.get_by_role('button',name='Cancel',exact=True).click()
        page.get_by_role('button',name='Request this journey',exact=True).click()
        dialog.locator('summary').click()
        checkbox.uncheck()
        dialog.get_by_role('button',name='Request',exact=True).click()
        expect(replacement.get_by_text('No contribution offered',exact=True)).to_be_visible()
        replacement.get_by_role('button',name='Replace',exact=True).click()
        expect(page.get_by_role('link',name='View your post')).to_be_visible()
        assert writes[0]['offeredContributionAud'] == 10.25
        assert writes[-1]['offeredContributionAud'] == 0
        assert writes[-1]['replaceDemandId'] == request['id']
        page.goto(BASE+'/?start=driver')
        page.get_by_role('button',name='See journey requests',exact=True).click()
        page.get_by_role('button',name='SEARCH',exact=True).click()
        expect(page.get_by_text('A$10.25',exact=True)).to_be_visible()
        expect(page.get_by_text('No contribution offered',exact=True)).to_be_visible()
        capture('discovery')
        page.locator('.journey-request-results .activity-card').first.get_by_role('button',name='Offer a ride',exact=True).click()
        offer = page.get_by_role('dialog',name='Offer a ride',exact=True)
        expect(offer.get_by_text('A$10.25',exact=True)).to_be_visible()
        expect(offer.locator('summary')).to_have_text('Fare · Free')
        offer.locator('summary').click()
        offer.get_by_role('checkbox',name='Ask for a contribution').check()
        expect(offer.get_by_role('textbox',name='You receive')).to_be_visible()
        expect(offer.get_by_text('Your PayID',exact=True)).to_be_visible()
        capture('driver-offer')
        offer.get_by_role('button',name='Go back',exact=True).click()
        expect(offer).not_to_be_visible()
        page.goto(BASE+'/activity')
        expect(page.get_by_text('A$10.25',exact=True)).to_be_visible()
        capture('activity')
        page.goto(BASE+'/activity/requests/'+request['id'])
        expect(page.get_by_text('A$10.25',exact=True)).to_be_visible()
        capture('details')
        assert not errors, errors
        print(f'PASS {width}: consent, validation, replacement, zero, discovery, driver fare, owner details', flush=True)
        context.close()
    browser.close()
