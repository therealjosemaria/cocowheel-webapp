"""Mocked login-message UI checks. Start isolated Next on port 3090 first."""
from playwright.sync_api import sync_playwright, expect
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    for width in [390,1440]:
        page=browser.new_page(viewport={'width':width,'height':900})
        state={'seconds':55}
        def respond(route):
            if route.request.url.endswith('/university/code'):
                route.fulfill(status=429,json={'error':'VERIFICATION_RATE_LIMITED',**({'retryAfterSeconds':state['seconds']} if state['seconds'] is not None else {})})
            else:
                route.fulfill(status=401,json={'error':'UNIVERSITY_VERIFICATION_REQUIRED'})
        page.route('**/*',lambda r:r.continue_() if r.request.url.startswith('http://127.0.0.1:3090') else r.abort())
        page.route('**/api/**',respond)
        page.goto('http://127.0.0.1:3090/help',wait_until='networkidle')
        page.get_by_role('button',name='Profile:',exact=False).click()
        page.get_by_role('button',name='Verify UniKey',exact=True).click()
        page.get_by_role('textbox',name='UniKey',exact=True).fill('abcd1234')
        for seconds,message in [(55,'Please try again in 55 seconds.'),(780,'Please try again in 13 minutes.'),(None,'Please wait a little before trying again.')]:
            state['seconds']=seconds
            page.get_by_role('button',name='Send code',exact=True).click()
            expect(page.locator('.university-dialog [role="alert"]')).to_have_text(message)
            page.screenshot(path=f'/tmp/login-wait-{width}-{seconds}.png')
        print('PASS',width,flush=True)
        page.close()
    browser.close()
