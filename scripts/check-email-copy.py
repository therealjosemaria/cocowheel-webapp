"""Render matching email copy in isolation; no server, provider or live data."""
import subprocess
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width in [320,390,1440]:
        page = browser.new_page(viewport={'width':width,'height':800})
        page.route('**/*', lambda r:r.abort())
        page.route('https://gumwheel.com/brand/gumwheel-original.png',lambda r:r.fulfill(path='public/brand/gumwheel-original.png',content_type='image/png'))
        for fare in [0,5.5]:
            html=subprocess.check_output(['node','--import','tsx','-e',f'const {{routeAlertContent}}=require("./server/route-alert-email.ts");process.stdout.write(routeAlertContent("https://gumwheel.com","example","guest","2026-10-23T03:40:00Z",{fare}).html)'],text=True)
            page.set_content(html)
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            assert 'Leaving at 2:40 pm on Friday, 23 October' in page.inner_text('body')
            assert ('Fare: Free' if fare == 0 else 'Fare: A$5.50') in page.inner_text('body')
            page.screenshot(path=f'/tmp/email-copy-{width}-{fare}.png',full_page=True)
        print(f'PASS {width}: free/paid, final text, no overflow')
    browser.close()
