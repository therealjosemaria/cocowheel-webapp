"""Real isolated API: Mac pass → admin quality rejection → user feedback/re-upload.
Run with serve-map-avatar-fixture.mts and Next on 3491. No paid tasks or email.
"""
import base64
import uuid
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE = 'http://127.0.0.1:3491'
API = 'http://127.0.0.1:3492'
CONTROL = 'http://127.0.0.1:3494'
OUT = Path('/tmp/gumwheel-avatar-rejection-review'); OUT.mkdir(exist_ok=True)
worker = {'Authorization': 'Bearer '+'synthetic-avatar-worker-key-'*3}
control = {'X-Gumwheel-Fixture': '1'}
photo = 'data:image/jpeg;base64,'+base64.b64encode(Path('/tmp/gumwheel-avatar-normalized.jpg').read_bytes()).decode()
reason = 'Your face and both hands need to be clearly visible.'

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width in [320, 390, 1440]:
        admin = p.request.new_context(base_url=BASE, extra_http_headers={'Cookie': 'cocowheels_guest=synthetic-avatar-admin', 'Origin': BASE, 'X-Admin-Request': '1'})
        user = p.request.new_context(base_url=BASE, extra_http_headers={'Cookie': 'cocowheels_guest=synthetic-avatar-driver'})
        assert user.post(CONTROL+'/reset', headers=control).ok
        created = user.post('/api/avatar/jobs', data={'photo': photo, 'consent': True, 'submissionId': str(uuid.uuid4())})
        assert created.ok, created.text()
        job_id = created.json()['job']['id']
        claim = user.post(API+'/api/avatar-worker/claim', headers=worker, data={}).json()['job']
        assert claim['id'] == job_id
        assert user.post(API+'/api/avatar-worker/result', headers=worker, data={'id': job_id, 'lease': claim['lease'], 'verdict': 'approved'}).ok
        context = browser.new_context(viewport={'width': width, 'height': 900})
        context.add_cookies([{'name': 'cocowheels_guest', 'value': 'synthetic-avatar-admin', 'url': BASE}])
        context.route('**/*', lambda r: r.continue_() if r.request.url.startswith(BASE) else r.abort())
        page = context.new_page(); errors = []; page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(BASE+'/admin/avatar-management?job='+job_id)
        card = page.locator('#avatar-'+job_id)
        expect(card.get_by_role('button', name='Approve generation', exact=True)).to_be_visible()
        balance = page.get_by_role('region', name='Tripo balance', exact=True)
        expect(balance.get_by_text('1,000 credits (US$10.00)', exact=True)).to_be_visible()
        topup = balance.get_by_role('link', name='Top up Tripo', exact=True)
        expect(topup).to_have_attribute('href', 'https://developers.tripo3d.ai/en/pricing?action=topup&from=pricing_hero')
        # Balance failure leaves the submissions/action list usable and offers recovery.
        page.route('**/api/admin/avatar-jobs/balance', lambda r: r.fulfill(json={'availableCredits': None, 'frozenCredits': None, 'checkedAt': None}))
        balance.get_by_role('button', name='Refresh balance', exact=True).click()
        expect(balance.get_by_role('status')).to_contain_text('Refresh or open Tripo')
        page.screenshot(path=str(OUT/f'balance-unavailable-{width}.png'), full_page=True)
        page.unroute('**/api/admin/avatar-jobs/balance')
        balance.get_by_role('button', name='Refresh balance', exact=True).click()
        expect(balance.get_by_text('1,000 credits (US$10.00)', exact=True)).to_be_visible()
        page.screenshot(path=str(OUT/f'verified-{width}.png'), full_page=True)
        card.get_by_role('button', name='Reject photo', exact=True).click()
        dialog = page.get_by_role('dialog'); buttons = dialog.get_by_role('button')
        assert buttons.nth(0).inner_text().lower() == 'go back'
        expect(dialog.get_by_role('button', name='Reject photo', exact=True)).to_be_enabled()
        dialog.get_by_role('button', name='Reject photo', exact=True).click()
        expect(dialog.get_by_role('alert')).to_contain_text('Add a reason')
        assert user.get('/api/avatar/jobs').json()['job']['status'] == 'APPROVED'
        dialog.get_by_role('textbox', name='Reason', exact=True).fill(reason)
        expect(dialog.get_by_role('alert')).to_have_count(0)
        page.screenshot(path=str(OUT/f'reason-modal-{width}.png'), full_page=True)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        dialog.get_by_role('button', name='Reject photo', exact=True).click()
        expect(dialog).to_have_count(0)
        expect(card.get_by_text('Photo rejected', exact=False)).to_contain_text(reason)
        expect(card.get_by_role('button', name='Approve generation', exact=True)).to_have_count(0)
        result = user.get('/api/avatar/jobs').json()['job']
        assert result['status'] == 'REJECTED' and result['reviewReason'] == reason and result['notificationKey']
        page.screenshot(path=str(OUT/f'rejected-admin-{width}.png'), full_page=True)
        # The submitter opens the same Profile notification/result UI and can upload again.
        uc = browser.new_context(viewport={'width': width, 'height': 900})
        uc.add_cookies([{'name': 'cocowheels_guest', 'value': 'synthetic-avatar-driver', 'url': BASE}])
        uc.route('**/*', lambda r: r.continue_() if r.request.url.startswith(BASE) else r.abort())
        up = uc.new_page(); up.on('pageerror', lambda e: errors.append(str(e)))
        up.goto(BASE+'/usual-route')
        up.get_by_role('button', name='Profile:', exact=False).click()
        up.get_by_role('link', name='Avatar update', exact=False).click()
        avatar = up.locator('.avatar-details')
        expect(avatar.get_by_role('status')).to_contain_text(reason)
        expect(avatar.get_by_role('status')).to_contain_text('Upload another photo.')
        expect(avatar.get_by_role('button', name='Upload photo', exact=True)).to_be_visible()
        page.wait_for_timeout(1200)
        assert user.get('/api/avatar/jobs').json()['job']['notificationKey'] is None
        up.screenshot(path=str(OUT/f'rejected-profile-{width}.png'), full_page=True)
        assert up.evaluate('document.documentElement.scrollWidth <= innerWidth')
        # Maximum-length unbroken feedback must not overflow Admin or Profile.
        long_reason = 'A'*400
        fresh = user.post('/api/avatar/jobs', data={'photo': photo, 'consent': True, 'submissionId': str(uuid.uuid4())}).json()['job']
        claim = user.post(API+'/api/avatar-worker/claim', headers=worker, data={}).json()['job']
        assert user.post(API+'/api/avatar-worker/result', headers=worker, data={'id': fresh['id'], 'lease': claim['lease'], 'verdict': 'approved'}).ok
        assert admin.post('/api/admin/avatar-jobs/'+fresh['id']+'/reject', data={'reason': long_reason}).ok
        page.evaluate('window.dispatchEvent(new Event("focus"))'); up.evaluate('window.dispatchEvent(new Event("focus"))')
        expect(page.locator('#avatar-'+fresh['id'])).to_contain_text(long_reason)
        expect(avatar.get_by_role('status')).to_contain_text(long_reason)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        assert up.evaluate('document.documentElement.scrollWidth <= innerWidth')
        up.screenshot(path=str(OUT/f'long-feedback-profile-{width}.png'), full_page=True)
        page.goto(BASE+'/privacy')
        expect(page.get_by_text('We may reject a passing photo on review', exact=False)).to_be_visible()
        page.screenshot(path=str(OUT/f'privacy-{width}.png'), full_page=True)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        assert not errors, errors
        uc.close(); context.close(); admin.dispose(); user.dispose()
        print(f'PASS {width}: private balance/recovery, shared reason modal, required feedback, rejected state, Profile notice/review and re-upload action', flush=True)
    browser.close()
