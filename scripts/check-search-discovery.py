"""Check production-built crawl output and Home with synthetic browser APIs only.
Run with Python + Playwright after npm run build. No live mail, trips or provider calls.
"""
import json
import os
import subprocess
import time
import urllib.request
import urllib.error
from html.parser import HTMLParser
from playwright.sync_api import sync_playwright, expect

BASE = 'http://127.0.0.1:3205'
PUBLIC = 'https://www.gumwheel.com'
class Head(HTMLParser):
    def __init__(self): super().__init__(); self.meta={}; self.canonical=[]; self.alternates=[]
    def handle_starttag(self, tag, attrs):
        values=dict(attrs)
        if tag=='meta': self.meta[values.get('name') or values.get('property')]=values.get('content')
        if tag=='link' and values.get('rel')=='canonical': self.canonical.append(values.get('href'))
        if tag=='link' and values.get('rel')=='alternate': self.alternates.append(values)

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
        for path in ['/','/help','/about','/carpooling/sydney','/privacy','/terms']:
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
        try:
            fetch('/__gumwheel-missing-page')
            raise AssertionError('Missing page must return HTTP 404')
        except urllib.error.HTTPError as response:
            assert response.code==404
            assert 'Page not found' in response.read().decode()
        _,home_html=fetch('/')
        import re
        identity=re.search(r'<script type="application/ld\+json">(.*?)</script>',home_html).group(1)
        assert [item['@type'] for item in json.loads(identity)['@graph']]==['WebSite','Organization']
        assert 'Application' not in identity and 'aggregateRating' not in identity
        for path,content_type in [('/llms.txt','text/plain'),('/help.md','text/markdown')]:
            with urllib.request.urlopen(BASE+path) as response:
                text=response.read().decode()
                assert response.headers.get('Content-Type').startswith(content_type)
                assert response.headers.get('X-Robots-Tag')=='noindex, follow'
                assert 'GUMWHEEL' in text and 'university email' in text
                if path=='/help.md': assert response.headers.get('Link')=='<https://www.gumwheel.com/help>; rel="canonical"'
        _,help_html=fetch('/help')
        help_head=Head(); help_head.feed(help_html)
        assert any(item.get('type')=='text/markdown' and item.get('href')==PUBLIC+'/help.md' for item in help_head.alternates)
        status,sitemap=fetch('/sitemap.xml')
        assert status==200
        assert sitemap.count('<loc>')==6
        for path in ['/','/help','/about','/carpooling/sydney','/privacy','/terms']: assert f'<loc>{PUBLIC+path}</loc>' in sitemap
        with urllib.request.urlopen(BASE+'/indexnow-key.txt') as proof:
            assert proof.status==200 and proof.headers.get('X-Robots-Tag')=='noindex, nofollow'
            assert len(proof.read().decode().strip())==32
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
                page.goto(BASE+'/help')
                details=page.locator('.help-faq details')
                expect(details).to_have_count(8)
                expect(page.locator('.help-faq details[open]')).to_have_count(0)
                expect(page.locator('.how-it-works-steps li')).to_have_count(8)
                page.screenshot(path=f'/tmp/gumwheel-help-discovery-{width}.png',full_page=True,animations='disabled')
                page.get_by_text('What is GUMWHEEL?',exact=True).click()
                expect(page.get_by_text('GUMWHEEL is a browser-based carpooling pilot in Sydney.',exact=False).first).to_be_visible()
                page.get_by_role('link',name='About GUMWHEEL',exact=True).click()
                expect(page.get_by_role('heading',name='About GUMWHEEL',exact=True)).to_be_visible()
                expect(page.get_by_role('link',name='jose@gumwheel.com',exact=True)).to_have_attribute('href','mailto:jose@gumwheel.com')
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
                page.screenshot(path=f'/tmp/gumwheel-about-discovery-{width}.png',full_page=True,animations='disabled')
                page.get_by_role('link',name='Carpooling in Sydney',exact=True).click()
                expect(page.get_by_role('heading',name='Carpooling in Sydney',exact=True)).to_be_visible()
                expect(page.get_by_role('link',name='Find a journey',exact=True)).to_have_attribute('href','/?start=rider')
                expect(page.get_by_role('link',name='Post a journey',exact=True)).to_have_attribute('href','/?start=driver')
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
                page.screenshot(path=f'/tmp/gumwheel-sydney-guide-{width}.png',full_page=True,animations='disabled')
                page.get_by_role('link',name='Find a journey',exact=True).click()
                expect(page.get_by_role('heading',name='Find a journey',exact=True)).to_be_visible()
                page.goto(BASE+'/carpooling/sydney')
                page.get_by_role('link',name='Post a journey',exact=True).click()
                expect(page.get_by_role('heading',name='Post a journey',exact=True)).to_be_visible()
                page.goto(BASE+'/carpooling/sydney')
                page.get_by_role('link',name='How it works',exact=True).last.click()
                expect(page.get_by_role('heading',name='How it works',exact=True)).to_be_visible()
                page.get_by_text('What if I can’t find a journey?',exact=True).click()
                page.get_by_text('Do I need an app or a university email?',exact=True).click()
                expect(page.get_by_text('A university email is not required.',exact=False)).to_be_visible()
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
                page.screenshot(path=f'/tmp/gumwheel-help-expanded-{width}.png',full_page=True,animations='disabled')
                response=page.goto(BASE+'/__gumwheel-missing-page')
                assert response.status==404
                expect(page.get_by_role('heading',name='Page not found',exact=True)).to_be_visible()
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
                page.screenshot(path=f'/tmp/gumwheel-missing-page-{width}.png',full_page=True,animations='disabled')
                page.locator('.help-section').get_by_role('link',name='Home',exact=True).click()
                expect(page.get_by_role('heading',name='Share your journey.',exact=True)).to_be_visible()
                assert not errors, errors
                print(f'PASS {width}: Home heading, layout and both journey actions',flush=True)
                context.unroute_all(behavior='wait')
                context.close()
            nojs=browser.new_context(java_script_enabled=False,viewport={'width':390,'height':900})
            plain=nojs.new_page()
            plain.route('**/*',lambda r: r.continue_() if r.request.url.startswith(BASE) else r.abort())
            plain.goto(BASE)
            expect(plain.locator('noscript p').last).to_be_visible()
            expect(plain.locator('noscript p').last).to_contain_text('Enable JavaScript to search and arrange journeys.')
            plain.locator('noscript a[href="/about"]').click()
            expect(plain.get_by_role('heading',name='About GUMWHEEL',exact=True)).to_be_visible()
            assert plain.evaluate('document.documentElement.scrollWidth <= innerWidth')
            plain.screenshot(path='/tmp/gumwheel-about-nojs.png',full_page=True)
            nojs.close()
            print('PASS JavaScript-disabled Home guidance and About navigation',flush=True)
            browser.close()
    finally:
        preview.terminate()
        preview.wait(timeout=10)
