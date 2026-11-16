"""Synthetic browser → real admin API → approval → fake Tripo → user avatar.
Run only with serve-map-avatar-fixture.mts on 3492/3494 and Next on 3491.
No production credentials, paid tasks or real emails.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
BASE='http://127.0.0.1:3491'
API='http://127.0.0.1:3492'
CONTROL='http://127.0.0.1:3494'
OUT=Path('/tmp/gumwheel-avatar-admin-review');OUT.mkdir(exist_ok=True)
worker={'Authorization':'Bearer '+'synthetic-avatar-worker-key-'*3,'Content-Type':'application/json'}
control={'X-Gumwheel-Fixture':'1'}

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    for width in [320,390,1440]:
        context=browser.new_context(viewport={'width':width,'height':1000})
        context.route('**/*',lambda r:r.continue_() if r.request.url.startswith(BASE) else r.abort())
        context.add_cookies([{'name':'cocowheels_guest','value':'synthetic-avatar-admin','url':BASE}])
        admin=p.request.new_context(base_url=BASE,extra_http_headers={'Cookie':'cocowheels_guest=synthetic-avatar-admin','Origin':BASE,'X-Admin-Request':'1'})
        user=p.request.new_context(base_url=BASE,extra_http_headers={'Cookie':'cocowheels_guest=synthetic-avatar-driver'})
        assert user.post(CONTROL+'/reset',headers=control).ok
        photo=Path('/tmp/gumwheel-avatar-upload-synthetic.jpg').read_bytes()
        import base64,uuid,re
        created=user.post('/api/avatar/jobs',data={'photo':'data:image/jpeg;base64,'+base64.b64encode(photo).decode(),'consent':True,'submissionId':str(uuid.uuid4())})
        assert created.ok,created.text()
        job_id=created.json()['job']['id']
        page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(BASE+'/')
        page.get_by_role('button',name='Profile:',exact=False).click()
        expect(page.get_by_role('link',name='Avatar submissions',exact=False)).to_be_visible()
        assert admin.get('/api/admin/avatar-jobs/notifications').json()['count']>0
        page.screenshot(path=str(OUT/f'profile-notice-{width}.png'),full_page=True)
        page.get_by_role('link',name='Avatar submissions',exact=False).click()
        expect(page.get_by_role('heading',name='Avatar management',exact=True)).to_be_visible()
        card=page.locator('#avatar-'+job_id)
        expect(card.get_by_role('img',name='Submitted photo for',exact=False)).to_be_visible()
        expect(card.get_by_text('Waiting for photo check',exact=False)).to_be_visible()
        page.wait_for_timeout(1200)
        assert admin.get('/api/admin/avatar-jobs/notifications').json()['count']==0
        page.screenshot(path=str(OUT/f'pending-{width}.png'),full_page=True)
        assert user.post(CONTROL+'/generate',headers=control).ok
        assert user.get('/api/avatar/jobs').json()['job']['status']=='QUEUED'
        claim=user.post(API+'/api/avatar-worker/claim',headers=worker,data={}).json()['job']
        assert claim and claim['id']==job_id
        assert user.post(API+'/api/avatar-worker/result',headers=worker,data={'id':job_id,'lease':claim['lease'],'verdict':'approved'}).ok
        assert admin.get('/api/admin/avatar-jobs/notifications').json()['count']==1
        assert user.post(CONTROL+'/generate',headers=control).ok
        assert admin.get('/api/admin/avatar-jobs').json()['jobs'][0]['taskId'] is None
        page.evaluate('window.dispatchEvent(new Event("focus"))')
        expect(card.get_by_role('button',name='Approve generation',exact=True)).to_be_visible()
        page.screenshot(path=str(OUT/f'approval-{width}.png'),full_page=True)
        card.get_by_role('button',name='Approve generation',exact=True).click()
        dialog=page.get_by_role('dialog')
        expect(dialog).to_contain_text('5 Tripo credits')
        page.screenshot(path=str(OUT/f'approve-dialog-{width}.png'),full_page=True)
        dialog.get_by_role('button',name='Go back',exact=True).click()
        expect(card.get_by_role('button',name='Approve generation',exact=True)).to_be_focused()
        # An uncertain action response keeps its recovery message through refresh.
        fault_url='**/api/admin/avatar-jobs/'+job_id+'/approve'
        page.route(fault_url,lambda r:r.fulfill(status=500,json={'error':'INTERNAL_ERROR'}))
        card.get_by_role('button',name='Approve generation',exact=True).click()
        dialog.get_by_role('button',name='Approve generation',exact=True).click()
        expect(page.get_by_role('alert').filter(has_text='Couldn’t confirm this action.')).to_be_visible()
        page.wait_for_timeout(800)
        expect(page.get_by_role('alert').filter(has_text='Couldn’t confirm this action.')).to_be_visible()
        page.screenshot(path=str(OUT/f'action-error-{width}.png'),full_page=True)
        page.unroute(fault_url)
        page.get_by_role('button',name='Refresh',exact=True).click()
        expect(page.get_by_role('alert').filter(has_text='Couldn’t confirm this action.')).to_have_count(0)
        card.get_by_role('button',name='Approve generation',exact=True).click()
        dialog.get_by_role('button',name='Approve generation',exact=True).click()
        expect(card.get_by_role('button',name='Approve generation',exact=True)).to_have_count(0)
        expect(card.get_by_text('Generation approval',exact=True)).to_be_visible()
        assert user.post(CONTROL+'/credits-low',headers=control).ok
        assert user.post(CONTROL+'/generate',headers=control).ok
        page.evaluate('window.dispatchEvent(new Event("focus"))')
        expect(card.get_by_text('Not enough Tripo credits.',exact=False)).to_be_visible()
        user_state=user.get('/api/avatar/jobs').json()['job']
        assert user_state['status']=='APPROVED' and user_state['reason'] is None
        page.screenshot(path=str(OUT/f'credit-hold-{width}.png'),full_page=True)
        assert user.post(CONTROL+'/credits-ready',headers=control).ok
        assert user.post(CONTROL+'/generate',headers=control).ok
        page.evaluate('window.dispatchEvent(new Event("focus"))')
        expect(card.get_by_text('Generating',exact=True)).to_be_visible()
        assert user.post(CONTROL+'/generate',headers=control).ok
        page.evaluate('window.dispatchEvent(new Event("focus"))')
        expect(card.get_by_role('img',name='Generated avatar for',exact=False)).to_be_visible()
        expect(card.get_by_text('Ready',exact=True)).to_be_visible()
        assert user.get('/api/avatar').json()['available'] is True
        page.screenshot(path=str(OUT/f'ready-{width}.png'),full_page=True)
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        # A later creation is cancelled from the exact same row/action/modal.
        # Model a later list page, then follow a real new-job notification.
        paging=re.compile(r'.*/api/admin/avatar-jobs\?.*')
        def paged(route):
            response=route.fetch();value=response.json();value['total']=26
            route.fulfill(response=response,json=value)
        page.route(paging,paged)
        page.evaluate('window.dispatchEvent(new Event("focus"))')
        expect(page.get_by_role('button',name='Next',exact=True)).to_be_visible()
        page.get_by_role('button',name='Next',exact=True).click()
        expect(page.get_by_text('Page 2',exact=True)).to_be_visible()
        new=user.post('/api/avatar/jobs',data={'photo':'data:image/jpeg;base64,'+base64.b64encode(photo).decode(),'consent':True,'submissionId':str(uuid.uuid4())}).json()['job']
        page.evaluate('window.dispatchEvent(new Event("focus"))')
        page.get_by_role('button',name='Profile:',exact=False).click()
        entry=page.get_by_role('link',name='Avatar submissions',exact=False)
        expect(entry).to_have_attribute('href','/admin/avatar-management?job='+new['id'])
        entry.click()
        expect(page.get_by_text('Page 1',exact=True)).to_be_visible()
        page.unroute(paging)
        new_card=page.locator('#avatar-'+new['id'])
        new_card.get_by_role('button',name='Cancel creation',exact=True).click()
        dialog=page.get_by_role('dialog')
        buttons=dialog.get_by_role('button')
        assert buttons.nth(0).inner_text().lower()=='go back'
        dialog.get_by_role('button',name='Cancel creation',exact=True).click()
        expect(new_card.get_by_text('Cancelled',exact=True)).to_be_visible()
        assert user.get('/api/avatar').json()['available'] is True
        page.screenshot(path=str(OUT/f'cancelled-{width}.png'),full_page=True)
        assert not errors,errors
        context.close();admin.dispose();user.dispose()
        # Other signed-in members see the ordinary denied screen, without photos.
        denied=browser.new_context(viewport={'width':width,'height':1000})
        denied.add_cookies([{'name':'cocowheels_guest','value':'synthetic-avatar-driver','url':BASE}])
        denied.route('**/*',lambda r:r.continue_() if r.request.url.startswith(BASE) else r.abort())
        dp=denied.new_page();dp.goto(BASE+'/admin/avatar-management')
        expect(dp.get_by_text('This account doesn’t have admin access.',exact=True)).to_be_visible()
        assert dp.locator('.admin-records img').count()==0
        assert dp.evaluate('document.documentElement.scrollWidth<=innerWidth')
        dp.screenshot(path=str(OUT/f'denied-{width}.png'),full_page=True)
        denied.close()
        print(f'PASS {width}: Profile notice, private photo, review acknowledgment, manual approval, credit hold hidden from user, fake generation preview, cancellation and denied member',flush=True)
    browser.close()
