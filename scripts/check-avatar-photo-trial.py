"""Real Profile upload and result review under three isolated accounts.

Start serve-avatar-photo-trial.mts and optimized Next on 3491. Pass --upload with
three private photo paths, then run the actual Mac worker before --results.
No production login, provider credentials or real email transport are used here.
"""
import argparse
import base64
import json
import os
from pathlib import Path
import uuid
from playwright.sync_api import sync_playwright, expect

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--upload', nargs=3)
parser.add_argument('--results', action='store_true')
args = parser.parse_args()
if bool(args.upload) == bool(args.results): parser.error('Choose --upload PHOTO1 PHOTO2 PHOTO3 or --results.')
directory = Path(os.environ.get('GUMWHEEL_AVATAR_TRIAL_DIR', 'data/avatar-photo-trial')).resolve()
context_data = json.loads((directory/'context.json').read_text())
BASE = 'http://127.0.0.1:3491'
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    records = []
    for index, user in enumerate(context_data['users'], 1):
        context = browser.new_context(viewport={'width':390,'height':900})
        context.add_cookies([{'name':'cocowheels_guest','value':user['token'],'url':BASE}])
        context.route('**/*', lambda r:r.continue_() if r.request.url.startswith(BASE) else r.abort())
        page = context.new_page(); errors = []; page.on('pageerror', lambda e:errors.append(str(e)))
        page.goto(BASE+'/usual-route?avatar=1')
        avatar = page.locator('.avatar-details')
        expect(avatar.get_by_role('button', name='Upload photo', exact=True)).to_be_visible()
        if args.upload:
            photo = Path(args.upload[index-1])
            avatar.locator('input[type=file]').set_input_files(str(photo))
            page.wait_for_function('()=>document.querySelector(`.avatar-details img[alt="Photo to check"], .avatar-details [role="alert"]`)')
            if avatar.get_by_role('img',name='Photo to check',exact=True).count():
                avatar.get_by_role('button',name='Submit photo',exact=True).click()
                expect(avatar.get_by_role('status')).to_contain_text('queued for checking')
            else:
                expect(avatar.get_by_role('alert')).to_contain_text('at least 256 pixels wide and 512 pixels tall')
                # Independently prove the backend rejects the same original file.
                reply = context.request.post(BASE+'/api/avatar/jobs',headers={'Origin':BASE},data={
                    'photo':'data:image/png;base64,'+base64.b64encode(photo.read_bytes()).decode(),
                    'consent':True,'submissionId':str(uuid.uuid4())})
                assert reply.status == 400 and reply.json()['error']=='INVALID_AVATAR_PHOTO',reply.text()
        job = context.request.get(BASE+'/api/avatar/jobs').json()['job']
        if args.results and job:
            expect(avatar.get_by_role('status')).not_to_contain_text('queued for checking')
            assert job['status'] in ['APPROVED','REJECTED','READY'],job['status']
            page.wait_for_timeout(1000)
            assert context.request.get(BASE+'/api/avatar/jobs').json()['job']['notificationKey'] is None
        record = {'photo':index,'job':job,'message':avatar.get_by_role('status').inner_text() if job else avatar.get_by_role('alert').inner_text() if args.upload else 'No submission; upload validation rejected the image.'}
        records.append(record)
        assert context.request.get(BASE+'/api/avatar').json()['available'] is bool(job and job['status']=='READY')
        assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
        assert not errors,errors
        page.screenshot(path=str(directory/f'{"upload" if args.upload else "result"}-{index}.png'),full_page=True)
        print(json.dumps({'photo':index,'status':job['status'] if job else 'UPLOAD_REJECTED','reason':job['reason'] if job else 'IMAGE_DIMENSIONS','message':record['message']}),flush=True)
        context.close()
    ids = [record['job']['id'] for record in records if record['job']]
    assert len(ids) == len(set(ids)), 'Jobs must belong to separate accounts.'
    for index, user in enumerate(context_data['users']):
        session = p.request.new_context(base_url=BASE,extra_http_headers={'Cookie':'cocowheels_guest='+user['token']})
        reply = session.get('/api/avatar/jobs').json()
        for foreign in [value for value in ids if not records[index]['job'] or value != records[index]['job']['id']]:
            assert foreign not in json.dumps(reply)
            assert session.get('/api/admin/avatar-jobs/'+foreign+'/photo').status == 403
        session.dispose()
    if args.results:
        for width in [390,1440]:
            admin = browser.new_context(viewport={'width':width,'height':1000})
            admin.add_cookies([{'name':'cocowheels_guest','value':context_data['admin']['token'],'url':BASE}])
            admin.route('**/*',lambda r:r.continue_() if r.request.url.startswith(BASE) else r.abort())
            page = admin.new_page(); page.goto(BASE+'/admin/avatar-management')
            expect(page.get_by_role('heading',name='Avatar management',exact=True)).to_be_visible()
            expect(page.get_by_role('img',name='Submitted photo for',exact=False)).to_have_count(len(ids))
            for record in records:
                if not record['job']: continue
                card = page.locator('#avatar-'+record['job']['id'])
                expect(card.get_by_role('img',name='Submitted photo for',exact=False)).to_be_visible()
                if record['job']['status']=='REJECTED':
                    expect(card.get_by_text('Photo rejected',exact=False)).to_be_visible()
                    expect(card.get_by_role('button',name='Approve generation',exact=True)).to_have_count(0)
            assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
            page.screenshot(path=str(directory/f'admin-results-{width}.png'),full_page=True)
            admin.close()
    (directory/f'{"upload" if args.upload else "results"}.json').write_text(json.dumps(records,indent=2))
    browser.close()
