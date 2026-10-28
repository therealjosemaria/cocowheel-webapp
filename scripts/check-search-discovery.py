"""Check production-built crawl output and Home with synthetic browser APIs only.
Run with Python + Playwright after npm run build. No live mail, trips or provider calls.
"""
import os
import subprocess
import time
import urllib.request
from html.parser import HTMLParser
from playwright.sync_api import sync_playwright, expect

BASE = 'http://127.0.0.1:3205'
PUBLIC = 'https://www.gumwheel.com'
class Head(HTMLParser):
    def __init__(self): super().__init__(); self.meta={}; self.canonical=[]
    def handle_starttag(self, tag, attrs):
        values=dict(attrs)
        if tag=='meta': self.meta[values.get('name') or values.get('property')]=values.get('content')
        if tag=='link' and values.get('rel')=='canonical': self.canonical.append(values.get('href'))

def fetch(path):
    with urllib.request.urlopen(BASE+path,timeout=10) as response:
        return response.status,response.read().decode()

with open('/tmp/gumwheel-discovery-preview.log','w') as log:
    # Prevent any server-side application fetch from reaching a live backend.
    env=dict(os.environ, COCOWHEELS_API_PROXY_TARGET='http://127.0.0.1:1')
    preview=subprocess.Popen(['node','node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3205'],env=env,stdout=log,stderr=log)
    try:
        for attempt in range(50):
            try: fetch('/'); break
            except Exception:
                if preview.poll() is not None: raise RuntimeError('Preview failed; see /tmp/gumwheel-discovery-preview.log')
                time.sleep(.2)
        for path in ['/','/help','/privacy','/terms']:
            status,html=fetch(path)
            head=Head();head.feed(html)
            assert status==200 and 'noindex' not in head.meta['robots'], (path,head.meta)
            assert [url.rstrip('/') for url in head.canonical]==[(PUBLIC+path).rstrip('/')], (path,head.canonical)
            assert head.meta['og:url'].rstrip('/')==(PUBLIC+path).rstrip('/')
            assert head.meta['description']
        for path in ['/activity','/usual-route','/admin','/rides/synthetic','/activity/requests/synthetic','/activity/offers/synthetic','/?match=private-test-key','/?match=&match=private-test-key']:
            status,html=fetch(path)
            head=Head();head.feed(html)
            assert status==200 and 'noindex' in head.meta['robots'], (path,head.meta)
            assert not head.canonical, (path,head.canonical)
        status,sitemap=fetch('/sitemap.xml')
        assert status==200
        assert sitemap.count('<loc>')==4
        for path in ['/','/help','/privacy','/terms']: assert f'<loc>{PUBLIC+path}</loc>' in sitemap
        status,robots=fetch('/robots.txt')
        assert status==200 and 'Allow: /' in robots and 'Disallow: /api/' in robots and f'Sitemap: {PUBLIC}/sitemap.xml' in robots
        print('PASS server metadata, private noindex, sitemap and robots',flush=True)
        with sync_playwright() as p:
            browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
            for width in [320,390,844,1440]:
                context=browser.new_context(viewport={'width':width,'height':900})
                page=context.new_page()
                errors=[]
                page.on('pageerror',lambda e: errors.append(str(e)))
                def route(r):
                    if r.request.url.startswith(BASE+'/api/'):
                        if '/university/session' in r.request.url: r.fulfill(status=401,json={'error':'UNIVERSITY_SESSION_REQUIRED'})
                        elif '/current' in r.request.url: r.fulfill(json={'current':None,'currents':[]})
                        elif '/history' in r.request.url: r.fulfill(json={'driver':[],'rider':[]})
                        else: r.fulfill(json={})
                    elif r.request.url.startswith(BASE): r.continue_()
                    else: r.abort()
                page.route('**/*',route)
                page.goto(BASE)
                expect(page.get_by_role('heading',name='Share your journey.',exact=True)).to_be_visible()
                expect(page).to_have_title('Sydney Carpooling | GUMWHEEL')
                page.wait_for_function("Array.from(document.querySelectorAll('.brand-art img')).every(img => img.complete && img.naturalWidth > 0)")
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
                page.screenshot(path=f'/tmp/gumwheel-home-discovery-{width}.png',full_page=True,animations='disabled')
                page.locator('.role-choice').get_by_role('button',name='FIND A JOURNEY',exact=True).click()
                expect(page.get_by_role('heading',name='Find a journey',exact=True)).to_be_visible()
                page.goto(BASE)
                page.locator('.role-choice').get_by_role('button',name='POST A JOURNEY',exact=True).click()
                expect(page.get_by_role('heading',name='Post a journey',exact=True)).to_be_visible()
                assert not errors, errors
                print(f'PASS {width}: Home heading, layout and both journey actions',flush=True)
                context.unroute_all(behavior='wait')
                context.close()
            browser.close()
    finally:
        preview.terminate()
        preview.wait(timeout=10)
