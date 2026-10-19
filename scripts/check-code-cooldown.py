"""Isolated Next :3090, mocked emails/API; Playwright clock avoids minute waits."""
from playwright.sync_api import sync_playwright, expect
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    for width,height in [(320,800),(390,844),(844,390),(1440,900)]:
        context=browser.new_context(viewport={'width':width,'height':height})
        page=context.new_page()
        page.clock.install()
        state={'sends':0,'mode':'success'}
        def respond(route):
            if route.request.url.endswith('/university/code'):
                state['sends']+=1
                if state['mode']=='limited': route.fulfill(status=429,json={'error':'VERIFICATION_RATE_LIMITED','retryAfterSeconds':780})
                else: route.fulfill(status=200,json={'challengeId':'a'*48,'deliveryAddress':'abcd1234@uni.sydney.edu.au'})
            else: route.fulfill(status=401,json={'error':'UNIVERSITY_VERIFICATION_REQUIRED'})
        page.route('**/*',lambda r:r.continue_() if r.request.url.startswith('http://127.0.0.1:3090') else r.abort())
        page.route('**/api/**',respond)
        def open_dialog():
            page.get_by_role('button',name='Profile:',exact=False).click()
            page.get_by_role('button',name='Verify UniKey',exact=True).click()
        page.goto('http://127.0.0.1:3090/help',wait_until='networkidle')
        open_dialog()
        page.get_by_role('textbox',name='UniKey',exact=True).fill('abcd1234')
        page.get_by_role('button',name='Send code',exact=True).click()
        resend=page.get_by_role('button',name='Request a new code',exact=False)
        expect(resend).to_be_disabled()
        expect(page.get_by_role('button',name='Verify',exact=True)).to_be_enabled()
        page.clock.fast_forward(15000)
        expect(resend).to_have_text('Request a new code in 45s')
        controls=page.locator('.university-form > button')
        boxes=[controls.nth(i).bounding_box() for i in range(3)]
        for previous,current in zip(boxes,boxes[1:]):
            assert abs(current['y']-previous['y']-previous['height']-16)<1
        assert resend.evaluate('(e)=>getComputedStyle(e).borderTopWidth')=='1px'
        cancel=page.get_by_role('button',name='Cancel',exact=True)
        for prop in ['borderTopColor','borderRadius','fontSize','padding']:
            assert resend.evaluate('(e,p)=>getComputedStyle(e)[p]',prop)==cancel.evaluate('(e,p)=>getComputedStyle(e)[p]',prop)
        assert resend.evaluate('(e)=>getComputedStyle(e).opacity')=='1'
        assert resend.evaluate('(e)=>getComputedStyle(e).backgroundColor')=='rgb(226, 232, 240)'
        assert resend.evaluate('(e)=>getComputedStyle(e).color')=='rgb(100, 116, 139)'
        resend.hover()
        assert resend.evaluate('(e)=>getComputedStyle(e).transform')=='none'
        assert resend.evaluate('(e)=>getComputedStyle(e).textDecorationLine')=='none'
        assert resend.bounding_box()['height']>=44
        page.screenshot(path=f'/tmp/code-cooldown-{width}-resend.png')
        page.clock.fast_forward(45000)
        expect(resend).to_be_enabled()
        assert resend.evaluate('(e)=>getComputedStyle(e).backgroundColor')==cancel.evaluate('(e)=>getComputedStyle(e).backgroundColor')
        assert resend.evaluate('(e)=>getComputedStyle(e).textDecorationLine')=='none'
        page.screenshot(path=f'/tmp/code-cooldown-{width}-ready.png')
        # Reset the clock to test persistence of a fresh cooldown through closure.
        resend.click()
        page.get_by_role('button',name='Send code',exact=True).click()
        expect(resend).to_have_text('Request a new code in 1 min')
        page.clock.fast_forward(15000)
        page.get_by_role('button',name='Cancel',exact=True).click()
        open_dialog()
        send=page.locator('.university-form .primary')
        expect(send).to_be_disabled()
        expect(send).to_have_text('Send code in 45s')
        page.locator('.university-form').dispatch_event('submit')
        assert state['sends']==2
        page.reload(wait_until='networkidle')
        open_dialog()
        page.get_by_role('textbox',name='UniKey',exact=True).fill('abcd1234')
        page.clock.run_for(1)
        expect(send).to_be_disabled()
        page.clock.fast_forward(46000)
        expect(send).to_be_enabled()
        expect(send).to_have_text('Send code')
        assert state['sends']==2 # timer never sends or polls
        state['mode']='limited'
        send.click()
        expect(send).to_be_disabled()
        expect(send).to_have_text('Send code in 13 min')
        expect(page.locator('.university-dialog [role="alert"]')).to_have_count(0)
        page.screenshot(path=f'/tmp/code-cooldown-{width}-limited.png')
        page.clock.fast_forward(720000)
        expect(send).to_have_text('Send code in 1 min')
        page.clock.fast_forward(1000)
        expect(send).to_have_text('Send code in 59s')
        page.clock.fast_forward(59000)
        expect(send).to_have_text('Send code')
        expect(send).to_be_enabled()
        assert state['sends']==3
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        print('PASS',width,height,flush=True)
        context.close()
    browser.close()
