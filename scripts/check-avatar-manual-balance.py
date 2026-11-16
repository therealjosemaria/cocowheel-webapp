"""Manual-only Admin balance checks against the local synthetic API fixture.
No real Tripo request, email or paid generation. Next must use fixture port 3492.
"""
import re
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE = 'http://127.0.0.1:3491'
OUT = Path('/tmp/gumwheel-avatar-manual-balance'); OUT.mkdir(exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width in [320, 390, 1440]:
        context = browser.new_context(viewport={'width': width, 'height': 900})
        context.add_cookies([{'name': 'cocowheels_guest', 'value': 'synthetic-avatar-admin', 'url': BASE}])
        context.route('**/*', lambda r: r.continue_() if r.request.url.startswith(BASE) else r.abort())
        page = context.new_page(); errors = []; requests = {'balance': 0, 'list': 0}
        page.on('pageerror', lambda e: errors.append(str(e)))
        def count(request):
            if '/api/admin/avatar-jobs/balance' in request.url: requests['balance'] += 1
            if '/api/admin/avatar-jobs?' in request.url: requests['list'] += 1
        page.on('request', count)
        stamp = ['2026-11-01T00:00:00.000Z']
        def metadata(route):
            response = route.fetch(); value = response.json(); value['workerSeenAt'] = stamp[0]
            route.fulfill(response=response, json=value)
        page.route(re.compile(r'.*/api/admin/avatar-jobs\?.*'), metadata)
        page.clock.install()
        page.goto(BASE+'/admin/avatar-management')
        expect(page.get_by_role('heading', name='Avatar management', exact=True)).to_be_visible()
        panel = page.get_by_role('region', name='Tripo balance', exact=True)
        expect(panel.get_by_role('button', name='Check balance', exact=True)).to_be_visible()
        expect(panel.get_by_text('Tripo API balance', exact=True)).to_have_count(0)
        expect(panel.get_by_text('110 credits per avatar', exact=False)).to_have_count(0)
        page.clock.fast_forward(125_000)
        page.evaluate('window.dispatchEvent(new Event("focus")); document.dispatchEvent(new Event("visibilitychange"))')
        page.wait_for_timeout(250)
        assert requests['balance'] == 0, requests
        assert requests['list'] > 0
        page.screenshot(path=str(OUT/f'initial-{width}.png'), full_page=True)
        pending = []
        page.route('**/api/admin/avatar-jobs/balance', lambda r: pending.append(r))
        panel.get_by_role('button', name='Check balance', exact=True).evaluate('(button) => { button.click(); button.click(); }')
        expect(panel.get_by_role('button', name='Checking…', exact=True)).to_be_visible()
        page.wait_for_timeout(100)
        assert len(pending) == 1, 'Repeated activation must share the in-progress request'
        response = pending[0].fetch(); pending[0].fulfill(response=response)
        page.unroute('**/api/admin/avatar-jobs/balance')
        expect(panel.get_by_role('button', name='Refresh balance', exact=True)).to_be_visible()
        expect(panel.get_by_text('1,000 credits (US$10.00)', exact=True)).to_be_visible()
        expect(panel.get_by_text('P2-20260801 · 110 credits per avatar.', exact=False)).to_be_visible()
        assert requests['balance'] == 1, requests
        snapshot = panel.inner_text()
        initial_lists = requests['list']; stamp[0] = '2026-11-02T00:00:00.000Z'
        page.clock.fast_forward(125_000)
        page.evaluate('window.dispatchEvent(new Event("focus")); document.dispatchEvent(new Event("visibilitychange"))')
        page.wait_for_timeout(250)
        assert requests['list'] > initial_lists
        assert requests['balance'] == 1, requests
        assert panel.inner_text() == snapshot, 'Submission polling must not update the manual snapshot'
        page.screenshot(path=str(OUT/f'checked-{width}.png'), full_page=True)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        # Refresh is explicit, coalesces repeated activation, and keeps recovery controls.
        page.route('**/api/admin/avatar-jobs/balance', lambda r: r.fulfill(json={'availableCredits': None, 'frozenCredits': None, 'checkedAt': None}))
        panel.get_by_role('button', name='Refresh balance', exact=True).click()
        expect(panel.get_by_role('status')).to_contain_text('Refresh or open Tripo')
        assert requests['balance'] == 2, requests
        page.screenshot(path=str(OUT/f'unavailable-{width}.png'), full_page=True)
        page.reload()
        expect(page.get_by_role('button', name='Check balance', exact=True)).to_be_visible()
        page.clock.fast_forward(125_000)
        page.wait_for_timeout(250)
        assert requests['balance'] == 2, requests
        assert not errors, errors
        context.close()
        print(f'PASS {width}: no initial/timer/focus/visibility/reload balance requests, one per manual click, frozen cost/checker snapshot, submission refresh preserved, recovery and no overflow', flush=True)
    browser.close()
