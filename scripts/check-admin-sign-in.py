"""Isolated admin sign-in UI contract; synthetic API, no real mail/data/provider calls.
Run after npm run build using a Python environment with Playwright installed.
"""
import json
import os
import subprocess
import threading
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from playwright.sync_api import sync_playwright, expect

BASE = 'http://127.0.0.1:3204'
class Fixture(BaseHTTPRequestHandler):
    def log_message(self, *_): pass
    def reply(self, data, status=200, cookie=None):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Cache-Control', 'private, no-store')
        if cookie: self.send_header('Set-Cookie', cookie)
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())
    def do_GET(self):
        owner = 'cocowheels_guest=owner-test' in self.headers.get('Cookie', '')
        signed = owner or 'cocowheels_guest=other-test' in self.headers.get('Cookie', '')
        path = self.path.split('?')[0]
        if path == '/api/university/session':
            self.reply({'unikey':'jmos0905' if owner else 'other001', 'canAdmin':owner}, 200 if signed else 401)
        elif path == '/api/admin/dashboard':
            self.reply({'counts':[], 'rides':[], 'total':0}, 200 if owner else 403)
        elif path == '/api/current': self.reply({'current':None, 'currents':[]})
        elif path == '/api/profile': self.reply({'username':'jmos0905' if owner else 'other001','photoUrl':None})
        else: self.reply({})
    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers.get('Content-Length','0'))))
        if self.path == '/api/university/code':
            self.reply({'challengeId': 'owner' if body['unikey']=='owner@example.test' else 'other', 'deliveryAddress':body['unikey']})
        elif self.path == '/api/university/verify':
            if body['code'] != '123456': self.reply({'error':'VERIFICATION_INVALID'},401)
            else: self.reply({'unikey':'jmos0905'},cookie='cocowheels_guest='+('owner-test' if body['challengeId']=='owner' else 'other-test')+'; Path=/; HttpOnly; SameSite=Strict')
        else: self.reply({})

api = ThreadingHTTPServer(('127.0.0.1',0),Fixture)
threading.Thread(target=api.serve_forever,daemon=True).start()
api_base = f'http://127.0.0.1:{api.server_port}'
env = dict(os.environ, COCOWHEELS_API_PROXY_TARGET=api_base)
with open('/tmp/gumwheel-admin-preview.log','w') as log:
    preview = subprocess.Popen(['node','node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3204'], env=env, stdout=log, stderr=log)
    try:
        for attempt in range(50):
            try:
                urllib.request.urlopen(BASE+'/admin',timeout=1).close()
                break
            except Exception:
                if preview.poll() is not None: raise RuntimeError('Preview failed; see /tmp/gumwheel-admin-preview.log')
                time.sleep(.2)
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
            for width in [320,390,844,1440]:
                context = browser.new_context(viewport={'width':width,'height':900})
                page = context.new_page()
                errors=[]
                page.on('pageerror',lambda e:errors.append(str(e)))
                def route(r):
                    if r.request.url.startswith(BASE+'/api/'):
                        response = r.fetch(url=api_base+r.request.url[len(BASE):])
                        r.fulfill(response=response)
                    elif r.request.url.startswith(BASE): r.continue_()
                    else: r.abort()
                page.route('**/*',route)
                def capture(name):
                    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
                    page.screenshot(path=f'/tmp/admin-{name}-{width}.png',full_page=True,animations='disabled')
                page.goto(BASE+'/admin')
                expect(page.get_by_role('heading',name='Admin',exact=True)).to_be_visible()
                email = page.locator('.admin-sign-in').get_by_role('textbox',name='Email',exact=True)
                email.fill('owner@example.test')
                page.locator('.admin-sign-in').get_by_role('button',name='Send code',exact=True).click()
                code = page.locator('.admin-sign-in').get_by_role('textbox',name='Verification code',exact=True)
                expect(email).to_be_visible()
                expect(code).to_be_visible()
                capture('code')
                code.fill('000000')
                page.locator('.admin-sign-in').get_by_role('button',name='Verify',exact=True).click()
                expect(page.locator('.admin-sign-in').get_by_role('alert')).to_contain_text('invalid or expired')
                code.fill('123456')
                page.locator('.admin-sign-in').get_by_role('button',name='Verify',exact=True).click()
                expect(page.get_by_text('Read-only',exact=True)).to_be_visible()
                page.reload()
                expect(page.get_by_text('Read-only',exact=True)).to_be_visible()
                page.goto(BASE)
                expect(page.get_by_role('button',name='Profile: jmos0905',exact=True)).to_be_visible()
                expect(page.locator('a[href="/admin"]')).to_have_count(0)
                if width < 1000:
                    page.get_by_role('button',name='Open menu',exact=True).click()
                    expect(page.get_by_role('navigation',name='Mobile navigation')).to_be_visible()
                capture('menu')
                context.clear_cookies()
                page.goto(BASE+'/admin')
                email = page.locator('.admin-sign-in').get_by_role('textbox',name='Email',exact=True)
                email.fill('other@example.test')
                page.locator('.admin-sign-in').get_by_role('button',name='Send code',exact=True).click()
                page.locator('.admin-sign-in').get_by_role('textbox',name='Verification code').fill('123456')
                page.locator('.admin-sign-in').get_by_role('button',name='Verify',exact=True).click()
                expect(page.locator('.admin-sign-in').get_by_role('alert')).to_have_text('This account doesn’t have admin access.')
                expect(page.get_by_text('Read-only',exact=True)).to_have_count(0)
                capture('denied')
                page.reload()
                expect(page.locator('.admin-sign-in').get_by_role('alert')).to_have_text('This account doesn’t have admin access.')
                context.clear_cookies()
                page.goto(BASE)
                page.get_by_role('button',name='Profile: No guest name yet',exact=True).click()
                page.get_by_role('button',name='Sign in',exact=True).click()
                dialog = page.get_by_role('dialog',name='Email verification',exact=True)
                expect(dialog).to_be_visible()
                dialog.get_by_role('textbox',name='Email',exact=True).fill('modal@example.test')
                dialog.get_by_role('button',name='Send code',exact=True).click()
                page.get_by_role('textbox',name='Verification code',exact=True).fill('123456')
                page.get_by_role('button',name='Verify',exact=True).click()
                expect(page.locator('dialog[open].university-dialog')).to_have_count(0)
                context.clear_cookies()
                context.add_cookies([{'name':'cocowheels_guest','value':'expired-test','url':BASE}])
                page.goto(BASE+'/admin')
                expect(page.locator('.admin-sign-in').get_by_role('textbox',name='Email',exact=True)).to_be_visible()
                expect(page.get_by_text('Read-only',exact=True)).to_have_count(0)
                assert page.url == BASE+'/admin'
                assert not errors,errors
                print(f'PASS {width}: owner OTP, invalid code, non-owner denial, menus and shared sign-in modal',flush=True)
                context.unroute_all(behavior="wait")
                context.close()
            browser.close()
    finally:
        preview.terminate()
        preview.wait(timeout=10)
        api.shutdown()
        api.server_close()
