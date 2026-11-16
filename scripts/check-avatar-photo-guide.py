"""Photo guide, public access and preserved upload draft; synthetic fixture only.

Optimized Next :3491 with serve-map-avatar-fixture.mts on :3492. No uploads,
generation, real email, location providers or production account writes.
"""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get('GUMWHEEL_TEST_BASE_URL', 'http://127.0.0.1:3491').rstrip('/')
PUBLIC_ONLY = os.environ.get('GUMWHEEL_GUIDE_PUBLIC_ONLY') == '1'
OUT = Path('/tmp/gumwheel-avatar-photo-guide'); OUT.mkdir(exist_ok=True)
PHOTO = '/tmp/gumwheel-avatar-guide-photo.png'

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    for width in [320,390,844,1440]:
        context = browser.new_context(viewport={'width':width,'height':950})
        context.route('**/*',lambda r:r.continue_() if r.request.url.startswith(BASE) and (not PUBLIC_ONLY or r.request.method in ['GET','HEAD']) else r.abort())
        page = context.new_page(); errors=[]; writes=[]
        context.on('page',lambda new:new.on('pageerror',lambda e:errors.append(str(e))))
        page.on('pageerror',lambda e:errors.append(str(e)))
        context.on('request',lambda r:writes.append(r.url) if r.method!='GET' and '/api/avatar' in r.url else None)
        reply=page.goto(BASE+'/avatar-photo-guide'); assert reply.status==200
        expect(page.get_by_role('heading',name='Avatar photo guide',exact=True)).to_be_visible()
        expect(page.get_by_role('heading',name='For best results',exact=True)).to_be_visible()
        expect(page.locator('.avatar-photo-tips li')).to_have_count(4)
        expect(page.locator('link[rel=canonical]')).to_have_attribute('href','https://www.gumwheel.com/avatar-photo-guide')
        expect(page.locator('meta[name=robots]')).to_have_attribute('content','index, follow')
        example=page.locator('.avatar-photo-frame img')
        expect(example).to_be_visible(); expect(example).to_have_attribute('src','/brand/avatar-photo-guide-front-v1.webp')
        page.wait_for_function('()=>document.querySelector(".avatar-photo-frame img").naturalWidth>0')
        frame=page.locator('.avatar-photo-frame').bounding_box(); art=example.bounding_box()
        for gap in [art['x']-frame['x'], art['y']-frame['y'], frame['x']+frame['width']-art['x']-art['width'], frame['y']+frame['height']-art['y']-art['height']]:
            assert gap>=24,(width,gap)
        back=page.get_by_role('link',name='Back',exact=True).bounding_box()
        heading=page.get_by_role('heading',level=1).bounding_box()
        assert back['y']+back['height']<=heading['y'] and abs(back['x']-heading['x'])<1
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        page.screenshot(path=str(OUT/f'guide-{width}.png'),full_page=True)
        assert '/avatar-photo-guide' in context.request.get(BASE+'/sitemap.xml').text()
        if PUBLIC_ONLY:
            if width==390:
                page.get_by_role('link',name='Back',exact=True).click()
                expect(page).to_have_url(BASE+'/usual-route?avatar=1')
                expect(page.get_by_role('heading',name='Profile',exact=True)).to_be_visible()
                assert len(context.pages)==1
            assert not errors,errors
            print(f'PASS public {width}: anonymous guide, front-facing asset, framing margins, canonical/indexing/sitemap and containment; real writes blocked',flush=True)
            context.close();continue
        context.add_cookies([{'name':'cocowheels_guest','value':'synthetic-avatar-driver','url':BASE}])
        page.goto(BASE+'/usual-route?avatar=1'); avatar=page.locator('.avatar-details')
        guide=avatar.get_by_role('link',name='Photo guide',exact=True)
        expect(guide).to_have_count(1);assert guide.get_attribute('target') is None
        expect(avatar.get_by_role('button',name='Upload photo',exact=True)).to_be_visible()
        page.screenshot(path=str(OUT/f'profile-upload-{width}.png'),full_page=True)
        avatar.locator('input[type=file]').set_input_files(PHOTO)
        preview=avatar.get_by_role('img',name='Photo to check',exact=True);expect(preview).to_be_visible()
        expect(avatar.get_by_role('checkbox')).to_have_count(0)
        expect(avatar).to_contain_text('We’ll check that your photo meets these requirements before creating your avatar and notify you with the results.')
        assert 'Tripo' not in avatar.inner_text() and 'approval' not in avatar.inner_text()
        draft=preview.get_attribute('src')
        guide.click();expect(page).to_have_url(BASE+'/avatar-photo-guide')
        expect(page.get_by_role('heading',name='Avatar photo guide',exact=True)).to_be_visible()
        assert len(context.pages)==1
        page.get_by_role('link',name='Back',exact=True).click()
        expect(page).to_have_url(BASE+'/usual-route?avatar=1')
        expect(preview).to_have_attribute('src',draft)
        guide.click();expect(page).to_have_url(BASE+'/avatar-photo-guide')
        page.go_back();expect(preview).to_have_attribute('src',draft)
        page.go_forward();expect(page).to_have_url(BASE+'/avatar-photo-guide')
        page.go_back();expect(preview).to_have_attribute('src',draft)
        assert len(context.pages)==1
        assert page.evaluate('!JSON.stringify([Object.entries(localStorage),Object.entries(sessionStorage),history.state]).includes("data:image/")')
        page.screenshot(path=str(OUT/f'profile-draft-{width}.png'),full_page=True)
        avatar.get_by_role('button',name='Cancel',exact=True).click()
        guide.click();page.get_by_role('link',name='Back',exact=True).click()
        expect(avatar.get_by_role('button',name='Upload photo',exact=True)).to_be_visible()
        expect(preview).to_have_count(0)
        # A rejection offers the same guide without repeating the requirements.
        context.route('**/api/avatar/jobs',lambda r:r.fulfill(json={'accepting':True,'job':{'id':'guide-rejection','status':'REJECTED','reason':'HANDS','notificationKey':None,'createdAt':'2026-11-16T00:00:00Z'}}))
        page.reload();expect(guide).to_have_count(1)
        expect(avatar.get_by_role('status')).to_contain_text('both hands')
        expect(avatar.get_by_role('button',name='Upload photo',exact=True)).to_be_visible()
        page.screenshot(path=str(OUT/f'profile-rejected-{width}.png'),full_page=True)
        context.unroute('**/api/avatar/jobs')
        if width==390:
            page.reload()
            avatar.locator('input[type=file]').set_input_files(PHOTO)
            expect(preview).to_be_visible();guide.click()
            page.get_by_role('link',name='Privacy',exact=True).click()
            expect(page).to_have_url(BASE+'/privacy')
            page.go_back();page.get_by_role('link',name='Back',exact=True).click()
            expect(avatar.get_by_role('button',name='Upload photo',exact=True)).to_be_visible()
            expect(preview).to_have_count(0)
            avatar.locator('input[type=file]').set_input_files(PHOTO)
            expect(preview).to_be_visible();guide.click()
            page.evaluate('window.dispatchEvent(new Event("cocowheels:identity-changed"))')
            page.get_by_role('link',name='Back',exact=True).click()
            expect(avatar.get_by_role('button',name='Upload photo',exact=True)).to_be_visible()
            expect(preview).to_have_count(0)
            avatar.locator('input[type=file]').set_input_files(PHOTO)
            expect(preview).to_be_visible();guide.click()
            page.clock.install();page.clock.fast_forward(30*60*1000+1)
            page.get_by_role('link',name='Back',exact=True).click()
            expect(avatar.get_by_role('button',name='Upload photo',exact=True)).to_be_visible()
            expect(preview).to_have_count(0)
            print('PASS draft privacy: no browser-storage/history photo, clear on another route, identity change and 30-minute expiry',flush=True)
        avatar.locator('input[type=file]').set_input_files(PHOTO)
        expect(preview).to_be_visible();guide.click()
        context.clear_cookies();context.add_cookies([{'name':'cocowheels_guest','value':'synthetic-avatar-owner','url':BASE}])
        page.get_by_role('link',name='Back',exact=True).click();expect(guide).to_have_count(1)
        expect(preview).to_have_count(0)
        expect(avatar.get_by_role('button',name='Update photo',exact=True)).to_be_visible()
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        page.screenshot(path=str(OUT/f'profile-update-{width}.png'),full_page=True)
        assert not errors,errors
        assert not writes,writes
        print(f'PASS {width}: public guide/SEO, framed example, same-tab guide/Back/browser history with draft retained, cancelled draft cleared, rejection/update links, no upload writes/errors/overflow',flush=True)
        context.close()
    browser.close()
