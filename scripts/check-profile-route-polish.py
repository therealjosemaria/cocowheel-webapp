"""Local UI checks only: mock all APIs and block external traffic."""
from playwright.sync_api import sync_playwright, expect

expect.set_options(timeout=20000)
origin = dict(latitude=-33.88, longitude=151.20, label='Town Hall, Sydney', countryCode='au')
destination = dict(latitude=-33.89, longitude=151.25, label='University of Sydney', countryCode='au')
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width in [320,390,844,1440]:
        context=browser.new_context(viewport={'width':width,'height':900})
        page=context.new_page()
        errors=[]
        page.on('pageerror', lambda e: errors.append(str(e)))
        state={'saved':dict(origin=origin,destination=destination,days=[],minute=None,anyTime=True,alerts=False,priceAud=0,payId='',payIdType='MOBILE'),'writes':[]}
        def respond(r):
            path=r.request.url.split('/api/')[-1].split('?')[0]
            body=r.request.post_data_json if r.request.method=='POST' else None
            if path=='university/session': data={'unikey':'ride1234'}
            elif path=='current': data={'current':None,'currents':[]}
            elif path=='usual-route':
                if body: state['saved']=body; state['writes'].append(body)
                data={'route':state['saved'],'alertsAvailable':True}
            elif path=='place-search': data={'places':[origin if 'Town' in body['text'] else destination]}
            elif path=='search': data={'candidates':[]}
            elif path=='route-preview': data={'points':[origin,destination],'durationSeconds':600}
            else: data={}
            r.fulfill(json=data)
        page.route('**/*',lambda r:r.continue_() if r.request.url.startswith('http://127.0.0.1:3090') else r.abort())
        page.route('**/api/**',respond)
        page.goto('http://127.0.0.1:3090/usual-route')
        page.locator('.usual-route-disclosure > summary').click()
        summary=page.locator('.profile-route-summary')
        expect(summary).to_be_visible()
        a=summary.locator('> div').nth(0).bounding_box(); b=summary.locator('> div').nth(1).bounding_box()
        assert a['x']==b['x'] and b['y']>a['y']
        page.locator('.vehicle-details > summary').click()
        plate = page.locator('.vehicle-details .field').first
        expect(plate).to_be_visible()
        style = '(el) => { const s=getComputedStyle(el); return [s.color,s.fontSize,s.fontWeight,s.fontFamily,s.textTransform,s.letterSpacing]; }'
        for label in summary.locator('dt').all():
            assert label.evaluate(style) == plate.evaluate(style)
        for cell in summary.locator('> div').all():
            label = cell.locator('dt').bounding_box()
            value = cell.locator('dd').bounding_box()
            assert abs(value['y'] - label['y'] - label['height']) < 1
        page.screenshot(path=f'/tmp/profile-polish-summary-{width}.png',full_page=True)
        page.get_by_role('button',name='Edit route',exact=True).click()
        def check_swap_alignment():
            button=page.get_by_role('button',name='Swap addresses',exact=True).bounding_box()
            location=page.get_by_role('button',name='Use my location',exact=True).bounding_box()
            icon=page.locator('.route-swap:visible svg').bounding_box()
            assert abs(button['x']-location['x']-location['width']-8)<1
            assert abs(button['y']+button['height']/2-location['y']-location['height']/2)<1
            assert abs(icon['x']+icon['width']/2-button['x']-button['width']/2)<1
            assert abs(icon['y']+icon['height']/2-button['y']-button['height']/2)<1
            assert button['width']>=44 and button['height']>=44
        check_swap_alignment()
        page.get_by_role('button',name='Swap addresses',exact=True).click()
        expect(page.get_by_role('button',name='Swap addresses',exact=True)).to_be_focused()
        expect(page.get_by_placeholder('Where from?',exact=True)).to_have_value(destination['label'])
        expect(page.get_by_placeholder('Where to?',exact=True)).to_have_value(origin['label'])
        page.screenshot(path=f'/tmp/profile-polish-editor-{width}.png',full_page=True)
        page.get_by_role('button',name='Save route',exact=True).click()
        expect(summary).to_contain_text(destination['label'])
        assert state['writes'][-1]['origin']==destination and state['writes'][-1]['destination']==origin
        assert state['writes'][-1]['alerts']==False
        page.get_by_role('button',name='Edit schedule',exact=True).click()
        page.get_by_label('Any day, any time',exact=True).uncheck()
        expect(page.locator('.route-time-placeholder')).to_have_text('Choose a time')
        time=page.get_by_label('Usual departure time',exact=True)
        time.fill('10:30')
        expect(page.locator('.route-time-placeholder')).to_have_count(0)
        time.fill('')
        page.get_by_role('button',name='Mon',exact=True).focus()
        page.screenshot(path=f'/tmp/profile-polish-time-{width}.png',full_page=True)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        for role in ['driver','rider']:
            page.goto('http://127.0.0.1:3090/?start='+role)
            from_input=page.get_by_placeholder('Where from?',exact=True)
            expect(from_input).to_be_visible()
            check_swap_alignment()
            to_input=page.get_by_placeholder('Where to?',exact=True)
            from_input.fill('Town')
            page.locator('.place-search').first.get_by_role('button',name='Search',exact=True).click()
            page.get_by_role('button',name=origin['label'],exact=True).click()
            # Swapping one valid endpoint must preserve its pin; typed text stays unselected.
            to_input.fill('Unselected query')
            page.get_by_role('button',name='Swap addresses',exact=True).click()
            expect(from_input).to_have_value('Unselected query')
            expect(to_input).to_have_value(origin['label'])
            page.get_by_role('button',name='Swap addresses',exact=True).click()
            expect(from_input).to_have_value(origin['label'])
            expect(to_input).to_have_value('Unselected query')
            page.screenshot(path=f'/tmp/profile-polish-{role}-{width}.png')
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        assert not errors,errors
        print(f'PASS {width}: stacked profile, swap persisted pins, schedule placeholder, Offer/Find draft swaps, no overflow/errors')
        context.close()
    browser.close()
