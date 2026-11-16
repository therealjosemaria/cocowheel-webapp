"""Browser → isolated actual queue/API → fake Tripo → assigned avatar.
Use the explicit serve-map-avatar-fixture.mts; never production.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE='http://127.0.0.1:3491'
API='http://127.0.0.1:3492'
CONTROL='http://127.0.0.1:3494'
OUT=Path('/tmp/gumwheel-avatar-upload-review'); OUT.mkdir(exist_ok=True)
worker={'Authorization':'Bearer '+'synthetic-avatar-worker-key-'*3,'Content-Type':'application/json'}

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    for width in [320,390,1440]:
        context=browser.new_context(viewport={'width':width,'height':900})
        assert context.request.post(CONTROL+'/reset',headers={'X-Gumwheel-Fixture':'1'}).ok
        context.add_cookies([{'name':'cocowheels_guest','value':'synthetic-avatar-driver','url':BASE}])
        context.route('**/*',lambda r:r.continue_() if r.request.url.startswith(BASE) else r.abort())
        page=context.new_page(); errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(BASE+'/usual-route')
        avatar=page.locator('.avatar-details'); avatar.locator('summary').click()
        expect(avatar.get_by_role('button',name='Upload photo',exact=True)).to_be_visible()
        expect(avatar.get_by_role('checkbox',name='Personal avatar',exact=True)).not_to_be_checked()
        page.screenshot(path=str(OUT/f'default-{width}.png'),full_page=True)
        avatar.locator('input[type=file]').set_input_files({'name':'bad.svg','mimeType':'image/svg+xml','buffer':b'<svg/>'})
        expect(avatar.get_by_role('alert')).to_contain_text('JPG, PNG or WebP')
        avatar.locator('input[type=file]').set_input_files('/tmp/gumwheel-avatar-normalized.jpg')
        expect(avatar.get_by_role('img',name='Photo to check',exact=True)).to_be_visible()
        avatar.get_by_role('button',name='Submit photo',exact=True).click()
        expect(avatar.get_by_role('alert')).to_contain_text('Agree to')
        assert context.request.get(BASE+'/api/avatar/jobs').json()['job'] is None
        avatar.get_by_role('checkbox',name='Check my photo and create my avatar if it passes.',exact=True).check()
        page.screenshot(path=str(OUT/f'upload-{width}.png'),full_page=True)
        avatar.get_by_role('button',name='Submit photo',exact=True).click()
        expect(avatar.get_by_role('status')).to_contain_text('queued for checking')
        page.reload(); avatar.locator('summary').click()
        expect(avatar.get_by_role('status')).to_contain_text('queued for checking')
        page.screenshot(path=str(OUT/f'queued-{width}.png'),full_page=True)
        job=context.request.post(API+'/api/avatar-worker/claim',headers=worker,data={}).json()['job']
        assert job
        assert context.request.post(API+'/api/avatar-worker/result',headers=worker,data={'id':job['id'],'lease':job['lease'],'verdict':'rejected','reason':'FEET'}).ok
        # A collapsed Profile does not mark the result reviewed.
        page.reload(); page.wait_for_timeout(1000)
        assert context.request.get(BASE+'/api/avatar/jobs').json()['job']['notificationKey']
        profile=page.get_by_role('button',name='Profile:',exact=False)
        profile.click()
        notice=page.get_by_role('link',name='Avatar update',exact=False)
        expect(notice).to_be_visible()
        notice.click()
        expect(avatar.get_by_role('status')).to_contain_text('both feet')
        page.screenshot(path=str(OUT/f'rejected-{width}.png'),full_page=True)
        page.wait_for_timeout(1000)
        assert context.request.get(BASE+'/api/avatar/jobs').json()['job']['notificationKey'] is None
        avatar.locator('input[type=file]').set_input_files('/tmp/gumwheel-avatar-normalized.jpg')
        avatar.get_by_role('checkbox',name='Check my photo and create my avatar if it passes.',exact=True).check()
        avatar.get_by_role('button',name='Submit photo',exact=True).click()
        expect(avatar.get_by_role('status')).to_contain_text('queued for checking')
        job=context.request.post(API+'/api/avatar-worker/claim',headers=worker,data={}).json()['job']
        assert context.request.post(API+'/api/avatar-worker/result',headers=worker,data={'id':job['id'],'lease':job['lease'],'verdict':'approved','reason':None}).ok
        page.evaluate('window.dispatchEvent(new Event("focus"))')
        expect(avatar.get_by_role('status')).to_contain_text('creation is queued')
        assert context.request.post(CONTROL+'/generate',headers={'X-Gumwheel-Fixture':'1'}).ok
        assert context.request.post(CONTROL+'/generate',headers={'X-Gumwheel-Fixture':'1'}).ok
        page.evaluate('window.dispatchEvent(new Event("focus"))')
        expect(avatar.get_by_role('status')).to_contain_text('avatar is ready')
        avatar.get_by_role('button',name='Edit',exact=True).click()
        avatar.get_by_role('checkbox',name='Personal avatar',exact=True).check()
        expect(avatar.get_by_role('img',name='Your map avatar',exact=True)).to_be_visible()
        avatar.get_by_role('button',name='Save',exact=True).click()
        expect(avatar.get_by_role('button',name='Edit',exact=True)).to_be_visible()
        page.screenshot(path=str(OUT/f'ready-{width}.png'),full_page=True)
        assert context.request.get(BASE+'/api/avatar').json()['enabled'] is True
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        assert not errors,errors
        print(f'PASS {width}: upload visible, image/consent checks, queue persistence, real API worker verdict, collapsed unread result, Profile notification deep link, review, fake P2 assignment and save',flush=True)
        context.close()
    browser.close()
