"""Render actual reminder templates, Help and Privacy using synthetic browser APIs.
Requires production Next preview at :3201; no emails or live provider traffic.
"""
import json
import subprocess
from playwright.sync_api import sync_playwright, expect
BASE='http://127.0.0.1:3201'
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    for width in [320,390,844,1440]:
        context=browser.new_context(viewport={'width':width,'height':900})
        page=context.new_page();errors=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        def route(r):
            if r.request.url=='https://www.gumwheel.com/brand/gumwheel-original.png':r.fulfill(path='public/brand/gumwheel-original.png',content_type='image/png')
            elif r.request.url.startswith(BASE+'/api/'):
                if '/university/session' in r.request.url:r.fulfill(status=401,json={'error':'UNIVERSITY_VERIFICATION_REQUIRED'})
                else:r.fulfill(json={})
            elif r.request.url.startswith(BASE):r.continue_()
            else:r.abort()
        page.route('**/*',route)
        for kind in ['REQUEST','ACCEPTED','OFFER','MESSAGE']:
            code=f"const {{journeyReminderContent}}=require('./server/notification-email.ts');process.stdout.write(JSON.stringify(journeyReminderContent('https://www.gumwheel.com','{kind}','/activity/synthetic?request=opaque#messages-opaque')));"
            content=json.loads(subprocess.check_output(['node','--import','tsx','-e',code],text=True))
            page.set_content(content['html'])
            expect(page.get_by_role('heading',level=1)).to_have_text(content['subject'])
            expect(page.get_by_role('link',name='View update')).to_have_attribute('href','https://www.gumwheel.com/activity/synthetic?request=opaque#messages-opaque')
            page.wait_for_function('document.querySelector("img").complete && document.querySelector("img").naturalWidth===1254')
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            page.screenshot(path=f'/tmp/journey-reminder-email-{kind}-{width}.png',full_page=True)
        page.goto(BASE+'/help')
        page.get_by_text('How will I know about journey updates?',exact=True).click()
        expect(page.get_by_text('If a new request, offer, acceptance or message remains unreviewed for five minutes',exact=False)).to_be_visible()
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        page.screenshot(path=f'/tmp/journey-reminder-help-{width}.png',full_page=True)
        page.goto(BASE+'/privacy')
        expect(page.get_by_text('These service reminders are separate from opt-in usual-route matching',exact=False)).to_be_visible()
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        page.screenshot(path=f'/tmp/journey-reminder-privacy-{width}.png',full_page=True)
        assert not errors,errors
        print(f'PASS {width}: four branded reminder emails, private CTA, Help and Privacy, no overflow/errors',flush=True)
        context.unroute_all(behavior='wait');context.close()
    browser.close()
