"""Isolated UI checks against :3201; all APIs mocked, external traffic blocked."""
from playwright.sync_api import sync_playwright, expect
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

expect.set_options(timeout=20000)
BASE = 'http://127.0.0.1:3201'
origin = {'latitude': -33.88, 'longitude': 151.20, 'label': 'Town Hall, Sydney'}
destination = {'latitude': -33.88, 'longitude': 151.25, 'label': 'University of Sydney'}
tomorrow = datetime.now(ZoneInfo('Australia/Sydney')) + timedelta(days=1)
date_label = tomorrow.strftime('%a, %-d %b')
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width in [320, 390, 844, 1440]:
        context = browser.new_context(viewport={'width': width, 'height': 900}, timezone_id='America/New_York')
        page = context.new_page()
        errors, searches, offers, lookups = [], [], [], []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.route('**/*', lambda r: r.continue_() if r.request.url.startswith(BASE) else r.abort())
        def api(r):
            path = r.request.url.split('/api/')[-1].split('?')[0]
            if path == 'university/session': data = {'unikey': 'ride1234'}
            elif path == 'current': data = {'current': None, 'currents': []}
            elif path == 'place-search':
                lookups.append(r.request.post_data_json)
                data = {'places': [origin if 'Town' in lookups[-1]['text'] else destination]}
            elif path == 'place-label': data = {'label': origin['label'], 'countryCode': 'au'}
            elif path == 'route-preview': data = {'points': [origin, destination], 'durationSeconds': 600}
            elif path == 'search':
                searches.append(r.request.post_data_json)
                data = {'candidates': [], 'serverNow': datetime.now().isoformat()}
            elif path == 'rides' and r.request.method == 'POST':
                offers.append(r.request.post_data_json)
                r.fulfill(status=409, json={'error': 'OPEN_ITEM_EXISTS'}); return
            elif path == 'usual-route': data = {'route': None, 'alertsAvailable': True}
            else: data = {}
            r.fulfill(json=data)
        page.route('**/api/**', api)
        def select_address(label, text, result):
            page.get_by_role('button', name=label, exact=True).click()
            dialog = page.get_by_role('dialog', name=label, exact=True)
            field = dialog.get_by_role('textbox')
            field.fill(text[:2])
            page.wait_for_timeout(600)
            before = len(lookups)
            field.fill(text)
            page.wait_for_timeout(150)
            assert len(lookups) == before
            expect(dialog.get_by_role('button', name=result, exact=True)).to_be_visible()
            assert len(lookups) == before + 1
            page.screenshot(path=f'/tmp/calendar-address-{width}.png', full_page=True)
            dialog.get_by_role('button', name=result, exact=True).click()
            expect(dialog).not_to_be_visible()
        page.goto(BASE + '/?start=rider')
        def missing_route(action_name, screenshot):
            action = page.get_by_role('button', name=action_name, exact=True)
            expect(action).to_be_enabled()
            before = (len(searches), len(offers))
            action.click()
            warning = page.get_by_role('dialog', name='Route required', exact=True)
            expect(warning.get_by_text('Choose where from and where to.', exact=True)).to_be_visible()
            expect(warning.get_by_role('heading')).to_have_count(0)
            expect(warning.get_by_role('button', name='OKAY')).to_be_focused()
            page.keyboard.press('Tab')
            expect(warning.get_by_role('button', name='OKAY')).to_be_focused()
            page.screenshot(path=f'/tmp/route-warning-{screenshot}-{width}.png', full_page=True)
            page.keyboard.press('Escape')
            expect(warning).not_to_be_visible()
            expect(action).to_be_focused()
            assert before == (len(searches), len(offers))
        missing_route('FIND A RIDE', 'rider-empty')
        select_address('Where from?', 'Town Hall', origin['label'])
        missing_route('FIND A RIDE', 'rider-partial')
        expect(page.get_by_role('button', name='Where from?', exact=True)).to_contain_text(origin['label'])
        page.get_by_role('button', name='Swap addresses').click()
        missing_route('FIND A RIDE', 'rider-no-origin')
        page.get_by_role('button', name='Swap addresses').click()
        select_address('Where to?', 'University', destination['label'])
        assert not searches, 'Address selection must not submit discovery'
        page.get_by_role('button', name='Swap addresses').click()
        boxes = [page.get_by_role('button', name=name, exact=True).bounding_box() for name in ['Where from?', 'Where to?']]
        assert abs(boxes[0]['y'] - boxes[1]['y']) < 1
        assert boxes[1]['x'] >= boxes[0]['x'] + boxes[0]['width'] - 1
        expect(page.get_by_role('button', name='Where from?', exact=True)).to_contain_text(destination['label'])
        page.get_by_role('button', name='Swap addresses').click()
        date_button = page.get_by_role('button', name='Departure date:')
        original = date_button.inner_text()
        date_button.click()
        dialog = page.get_by_role('dialog', name='Departure date', exact=True)
        dialog.get_by_role('button', name=date_label, exact=True).click()
        page.screenshot(path=f'/tmp/calendar-picker-{width}.png', full_page=True)
        page.keyboard.press('Escape')
        expect(date_button).to_have_text(original)
        expect(date_button).to_be_focused()
        date_button.click()
        dialog.get_by_role('button', name=date_label, exact=True).click()
        dialog.get_by_role('button', name='DONE', exact=True).click()
        page.get_by_role('button', name='Departure time:').click()
        dialog = page.get_by_role('dialog', name='Departure time', exact=True)
        dialog.get_by_role('button', name='12:00 pm', exact=True).click()
        dialog.get_by_role('button', name='DONE', exact=True).click()
        # Any date and clock time are independent, including draft cancellation/reset.
        date_button.click()
        dialog = page.get_by_role('dialog', name='Departure date', exact=True)
        dialog.get_by_role('button', name='Any date', exact=True).click()
        page.screenshot(path=f'/tmp/calendar-any-date-picker-{width}.png', full_page=True)
        dialog.get_by_role('button', name='DONE', exact=True).click()
        expect(date_button).to_contain_text('Any date')
        expect(page.get_by_role('button', name='Departure time:')).to_contain_text('Around 12:00 pm')
        date_button.click()
        dialog.get_by_role('button', name='RESET', exact=True).click()
        page.keyboard.press('Escape')
        expect(date_button).to_contain_text('Any date')
        page.get_by_role('button', name='Departure time:').click()
        time_dialog = page.get_by_role('dialog', name='Departure time', exact=True)
        time_dialog.get_by_role('button', name='Any time', exact=True).click()
        time_dialog.get_by_role('button', name='DONE', exact=True).click()
        expect(date_button).to_contain_text('Any date')
        expect(page.get_by_role('button', name='Departure time:')).to_contain_text('Any time')
        page.get_by_role('button', name='Departure time:').click()
        time_dialog.get_by_role('button', name='12:00 pm', exact=True).click()
        time_dialog.get_by_role('button', name='DONE', exact=True).click()
        page.screenshot(path=f'/tmp/calendar-find-{width}.png', full_page=True)
        page.get_by_role('button', name='FIND A RIDE', exact=True).click()
        expect(page.get_by_role('heading', name='Choose a ride')).to_be_visible()
        page.wait_for_timeout(700)
        assert searches[-1]['departureDate'] == 'any'
        assert searches[-1]['departureTime'] == '12:00'
        page.reload()
        page.get_by_role('button', name='FIND A RIDE', exact=True).click()
        expect(page.get_by_role('heading', name='Choose a ride')).to_be_visible()
        page.wait_for_timeout(700)
        assert searches[-1]['departureDate'] == 'any'
        assert searches[-1]['departureTime'] == '12:00'
        page.goto(BASE + '/?start=driver')
        missing_route('OFFER A RIDE', 'driver-empty')
        # New page has a fresh module cache.
        select_address('Where from?', 'Town Hall', origin['label'])
        missing_route('OFFER A RIDE', 'driver-partial')
        expect(page.get_by_role('button', name='Where from?', exact=True)).to_contain_text(origin['label'])
        page.get_by_role('button', name='Swap addresses').click()
        missing_route('OFFER A RIDE', 'driver-no-origin')
        page.get_by_role('button', name='Swap addresses').click()
        select_address('Where to?', 'University', destination['label'])
        page.get_by_role('button', name='Departure date:').click()
        dialog = page.get_by_role('dialog', name='Departure date', exact=True)
        expect(dialog.get_by_role('button', name='Any date', exact=True)).to_have_count(0)
        dialog.get_by_role('button', name=date_label, exact=True).click()
        dialog.get_by_role('button', name='DONE', exact=True).click()
        page.get_by_role('button', name='Departure time:').click()
        dialog = page.get_by_role('dialog', name='Departure time', exact=True)
        dialog.get_by_role('button', name='12:00 pm', exact=True).click()
        page.screenshot(path=f'/tmp/calendar-clock-{width}.png', full_page=True)
        dialog.get_by_role('button', name='DONE', exact=True).click()
        page.screenshot(path=f'/tmp/calendar-offer-{width}.png', full_page=True)
        page.get_by_role('button', name='OFFER A RIDE', exact=True).click()
        expect(page.get_by_role('dialog')).to_be_visible()
        assert len(offers) == 1
        assert offers[0]['scheduledDepartureAt'][:10] == tomorrow.strftime('%Y-%m-%d')
        expected_departure = tomorrow.replace(hour=12, minute=0, second=0, microsecond=0).astimezone(timezone.utc)
        assert datetime.fromisoformat(offers[0]['scheduledDepartureAt'].replace('Z', '+00:00')) == expected_departure
        assert offers[0]['priceAud'] == 0
        assert not errors, errors
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        print(f'PASS {width}px: debounce, separate search, swap, date draft/cancel, time, Sydney payload, no exceptions/overflow')
        context.close()
    browser.close()
