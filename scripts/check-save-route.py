"""Mocked browser flow on local :3090. No production writes or provider calls."""
import copy
import json
from playwright.sync_api import sync_playwright, expect

origin = {'latitude':-33.88,'longitude':151.2,'label':'Town Hall, Sydney'}
end = {'latitude':-33.9,'longitude':151.25,'label':'University of Sydney'}
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    for width in [320,390,844,1440]:
        page = browser.new_page(viewport={'width':width,'height':900})
        errors=[]
        page.on('pageerror', lambda e: errors.append(str(e)))
        state={'saved':None,'writes':[],'fail':False}
        def respond(r):
            path=r.request.url.split('/api/')[-1].split('?')[0]
            body=r.request.post_data_json if r.request.method=='POST' else None
            if path=='university/session': data={'unikey':'ride1234'}
            elif path=='current': data={'current':None,'currents':[]}
            elif path=='usual-route/from-search':
                if state['fail']:
                    r.fulfill(status=409,json={'error':'USUAL_ROUTE_CHANGED'}); return
                assert body['expected']==state['saved']
                route=copy.deepcopy(state['saved']) if state['saved'] else {'anyTime':True,'days':[],'minute':None,'alerts':False,'priceAud':0,'payId':'','payIdType':'MOBILE'}
                route.update(origin=body['origin'],destination=body['destination'])
                if body['notify']: route['alerts']=True
                state['saved']=route
                state['writes'].append(copy.deepcopy(body))
                data={'route':route}
            elif path=='usual-route':
                if body: state['saved']=body
                data={'route':state['saved'],'alertsAvailable':True}
            elif path=='search': data={'candidates':[]}
            elif path=='place-search': data={'places':[{**end,'label':'New destination, Sydney','longitude':151.3}]}
            elif path=='route-preview': data={'points':[origin,end],'durationSeconds':600}
            else: data={}
            r.fulfill(json=data)
        page.route('**/*', lambda r:r.continue_() if r.request.url.startswith('http://127.0.0.1:3090') else r.abort())
        page.route('**/api/**',respond)
        page.add_init_script('sessionStorage.setItem("cocowheels:find-ride-draft:v1", JSON.stringify({...'+json.dumps({'pickup':origin,'destination':end,'departureAt':None})+',savedAt:Date.now()}));')
        def find():
            page.goto('http://127.0.0.1:3090/?start=rider')
            expect(page.get_by_role('button',name='Save route',exact=True)).to_be_visible()
        find()
        page.get_by_role('button',name='Save route',exact=True).click()
        dialog=page.get_by_role('dialog',name='Would you like to receive emails when matching rides become available?')
        expect(dialog).to_be_visible()
        assert dialog.evaluate("el => el.parentElement.parentElement === document.body")
        expect(dialog.locator('p').first).to_have_css('text-align','left')
        assert dialog.locator('p').first.locator('br').count()==1
        expect(dialog.locator('.save-route-profile-note')).to_have_css('font-size','14px')
        expect(dialog.locator('.save-route-profile-note')).to_have_css('color','rgb(100, 116, 139)')
        assert state['saved']['alerts'] is False
        expect(dialog.get_by_role('button',name='Notify me',exact=True)).to_be_focused()
        page.screenshot(path=f'/tmp/save-route-consent-{width}.png',full_page=True)
        dialog.get_by_role('button',name='Not now',exact=True).click()
        expect(page.get_by_role('button',name='Route saved',exact=True)).to_be_disabled()
        expect(page.get_by_role('button', name='Ask for a ride',exact=True)).to_be_visible()
        assert state['saved']['alerts'] is False
        page.screenshot(path=f'/tmp/save-route-screen-{width}.png',full_page=True)
        # Same route does not rewrite or reactivate an existing opt-out.
        find(); page.get_by_role('button',name='Save route',exact=True).click()
        expect(page.get_by_role('button',name='Route saved',exact=True)).to_be_disabled()
        assert len(state['writes'])==1
        # Different route: cancellation, then replacement and explicit opt-in.
        state['saved']['origin']={**origin,'longitude':151.1}
        state['saved'].update(anyTime=False,days=[1],minute=660,priceAud=5,payId='driver@example.com',payIdType='EMAIL')
        find(); page.get_by_role('button',name='Save route',exact=True).click()
        replace=page.get_by_role('dialog',name='Replace your saved route?')
        expect(replace).to_be_visible()
        replace.get_by_role('button',name='Cancel',exact=True).click()
        assert len(state['writes'])==1
        page.get_by_role('button',name='Save route',exact=True).click()
        replace.get_by_role('button',name='Replace',exact=True).click()
        expect(dialog).to_be_visible()
        assert state['saved']['alerts'] is False and state['saved']['days']==[1]
        assert state['saved']['payId']=='driver@example.com'
        dialog.get_by_role('button',name='Notify me',exact=True).click()
        expect(dialog).to_have_count(0)
        assert state['saved']['alerts'] is True
        expect(page.get_by_role('button', name='Ask for a ride',exact=True)).to_be_visible()
        # Enabled alerts skip consent on replacement.
        state['saved']['origin']={**origin,'longitude':151.1}
        find(); page.get_by_role('button',name='Save route',exact=True).click()
        replace.get_by_role('button',name='Replace',exact=True).click()
        expect(page.get_by_role('button',name='Route saved',exact=True)).to_be_disabled()
        expect(dialog).to_have_count(0)
        # Conflict must not claim success.
        state['saved']['origin']={**origin,'longitude':151.1}; state['fail']=True
        find(); page.get_by_role('button',name='Save route',exact=True).click()
        replace.get_by_role('button',name='Replace',exact=True).click()
        expect(page.get_by_text('Your route settings changed. Please save again.',exact=True)).to_be_visible()
        state['fail']=False
        # Profile refinement stays in place, without replacement confirmation.
        state['saved'].update(anyTime=True,days=[],minute=None)
        page.goto('http://127.0.0.1:3090/usual-route')
        page.get_by_role('button',name='Edit schedule',exact=True).click()
        page.get_by_role('checkbox',name='Any day, any time',exact=True).uncheck()
        page.get_by_role('button',name='Mon',exact=True).click()
        page.get_by_label('Usual departure time',exact=True).fill('10:00')
        page.screenshot(path=f'/tmp/save-route-profile-{width}.png',full_page=True)
        page.get_by_role('button',name='Save schedule',exact=True).click()
        expect(page.get_by_role('button',name='Edit schedule',exact=True)).to_be_visible()
        assert state['saved']['days']==[1] and state['saved']['minute']==600
        assert state['saved']['alerts'] is True and state['saved']['payId']=='driver@example.com'
        expect(page.get_by_role('heading',name='Matching ride alerts',exact=True)).to_be_visible()
        expect(page.get_by_role('heading',name='Usual route',exact=True).locator('svg')).to_be_visible()
        headings=page.locator('.usual-route-body h2')
        assert headings.count()==2
        assert headings.evaluate_all('els => els.every(el => { const s=getComputedStyle(el), first=getComputedStyle(els[0]); return s.fontSize===first.fontSize && s.fontWeight===first.fontWeight && s.color===first.color; })')
        expect(page.get_by_text('Your routine is private.',exact=False)).to_have_count(0)
        expect(page.get_by_role('heading',name='Payment preferences',exact=True)).to_have_count(0)
        expect(page.locator('.contribution-choice')).to_have_count(0)
        expect(page.get_by_text('9:00 am–11:00 am',exact=False)).to_be_visible()
        expect(page.get_by_text('Sydney time',exact=False)).to_have_count(0)
        expect(page.get_by_role('button',name='OFFER A RIDE',exact=True)).to_have_count(0)
        expect(page.get_by_role('button',name='Replace saved route',exact=True)).to_have_count(0)
        before=copy.deepcopy(state['saved'])
        page.get_by_role('button',name='Edit route',exact=True).click()
        page.get_by_role('textbox',name='Where to?',exact=True).fill('Unsaved destination')
        expect(page.get_by_role('button',name='Save route',exact=True)).to_be_disabled()
        page.get_by_role('button',name='Cancel',exact=True).click()
        assert state['saved']==before
        page.get_by_role('button',name='Edit route',exact=True).click()
        expect(page.get_by_role('textbox',name='Where to?',exact=True)).to_have_value(before['destination']['label'])
        page.get_by_role('textbox',name='Where to?',exact=True).fill('New destination')
        page.get_by_role('textbox',name='Where to?',exact=True).press('Enter')
        page.get_by_role('button',name='New destination, Sydney',exact=True).click()
        page.screenshot(path=f'/tmp/profile-edit-route-{width}.png',full_page=True)
        page.get_by_role('button',name='Save route',exact=True).click()
        expect(page.get_by_role('button',name='Edit route',exact=True)).to_be_visible()
        assert state['saved']['destination']['longitude']==151.3
        assert {k:v for k,v in state['saved'].items() if k not in ['origin','destination']}=={k:v for k,v in before.items() if k not in ['origin','destination']}
        page.screenshot(path=f'/tmp/profile-preferences-{width}.png',full_page=True)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        assert not errors,errors
        print(f'PASS save, consent, replacement, opt-out, conflict, Profile refinement {width}px',flush=True)
        page.close()
    browser.close()
