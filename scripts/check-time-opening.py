"""Time-list opening position; Next :3201, mocked APIs and no external traffic."""
from datetime import datetime, timezone
from playwright.sync_api import sync_playwright, expect
BASE = 'http://127.0.0.1:3201'
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width in [320, 390, 844, 1440]:
        for scenario in ['rider', 'late', 'driver']:
            context = browser.new_context(viewport={'width': width, 'height': 900}, timezone_id='America/Los_Angeles')
            page = context.new_page(); errors = []; writes = []
            page.on('pageerror', lambda e: errors.append(str(e)))
            if scenario != 'driver': page.clock.set_fixed_time(datetime(2026, 10, 31, 12, 50, tzinfo=timezone.utc) if scenario == 'late' else datetime(2026, 10, 31, 1, 58, tzinfo=timezone.utc))
            page.route('**/*', lambda r: r.continue_() if r.request.url.startswith(BASE) else r.abort())
            def api(r):
                if r.request.method != 'GET': writes.append(r.request.url)
                path = r.request.url.split('/api/')[-1].split('?')[0]
                data = {'unikey': 'tester01'} if path == 'university/session' else {'keys': []} if path == 'notifications/reviewed' else {'current': None, 'currents': []}
                r.fulfill(json=data)
            page.route('**/api/**', api)
            page.goto(BASE + ('/?start=driver' if scenario == 'driver' else '/?start=rider'))
            if scenario == 'driver':
                expect(page.get_by_role('heading', name='Post a journey', exact=True)).to_be_visible()
                page.clock.set_fixed_time(datetime(2026, 10, 31, 1, 58, tzinfo=timezone.utc))
            def open_time():
                page.get_by_role('button', name='Departure time:', exact=False).click()
                return page.get_by_role('dialog', name='Departure time', exact=True)
            def visible_time(time):
                box = page.locator('.clock-options').bounding_box()
                target = page.locator(f'[data-time="{time}"]').bounding_box()
                assert target['y'] >= box['y'] - 1 and target['y'] + target['height'] <= box['y'] + box['height'] + 1, (box, target)
            dialog = open_time()
            visible_time(dialog.locator('[data-time][aria-pressed="true"]').get_attribute('data-time') if scenario == 'driver' else '23:30' if scenario == 'late' else '13:00')
            if scenario != 'driver':
                expect(dialog.get_by_role('button', name='Any time', exact=True)).to_have_attribute('aria-pressed', 'true')
                expect(dialog.get_by_role('button', name='DONE', exact=True)).to_be_enabled()
            else:
                expect(dialog.locator('[data-time="00:00"]')).to_be_disabled()
            page.screenshot(path=f'/tmp/time-opening-{scenario}-{width}.png', full_page=True)
            if scenario == 'rider':
                dialog.locator('[data-time="15:00"]').click()
                dialog.get_by_role('button', name='DONE', exact=True).click()
                expect(page.get_by_role('button', name='Departure time: 3:00 pm', exact=True)).to_be_visible()
                dialog = open_time(); visible_time('15:00')
                dialog.locator('[data-time="17:00"]').click()
                dialog.get_by_role('button', name='GO BACK', exact=True).click()
                expect(page.get_by_role('button', name='Departure time: 3:00 pm', exact=True)).to_be_focused()
                dialog = open_time()
                dialog.get_by_role('button', name='Any time', exact=True).click()
                dialog.get_by_role('button', name='DONE', exact=True).click()
                dialog = open_time(); visible_time('13:00')
                dialog.get_by_role('button', name='Back', exact=True).click()
            else:
                dialog.get_by_role('button', name='Back', exact=True).click()
            if scenario == 'late':
                page.get_by_role('button', name='Departure date:', exact=False).click()
                calendar = page.get_by_role('dialog', name='Departure date', exact=True)
                calendar.get_by_role('button', name='Any date', exact=True).click()
                calendar.get_by_role('button', name='DONE', exact=True).click()
                dialog = open_time(); visible_time('00:00')
                dialog.get_by_role('button', name='Back', exact=True).click()
            if scenario != 'driver':
                page.get_by_role('button', name='Departure date:', exact=False).click()
                calendar = page.get_by_role('dialog', name='Departure date', exact=True)
                calendar.get_by_role('button', name='Sat, 31 Oct' if scenario == 'late' else 'Sun, 1 Nov', exact=True).click()
                calendar.get_by_role('button', name='DONE', exact=True).click()
                dialog = open_time(); visible_time('23:30' if scenario == 'late' else '00:00')
                expect(dialog.get_by_role('button', name='Any time', exact=True)).to_have_attribute('aria-pressed', 'true')
                dialog.get_by_role('button', name='Back', exact=True).click()
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            assert not errors, errors
            assert not writes, writes
            context.unroute_all(behavior='wait'); context.close()
            print(f'PASS {width} {scenario}: opening position, selection/cancel, dates, Sydney time, no writes/errors/overflow', flush=True)
    browser.close()
