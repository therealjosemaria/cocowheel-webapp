"""Mocked messaging UI regression. Next :3090; no production/provider calls.
Run with Python Playwright and /usr/bin/chromium. Screenshots in /tmp.
"""
from playwright.sync_api import sync_playwright, expect

pin = {'latitude': -33.87, 'longitude': 151.21, 'label': 'Town Hall'}
end = {'latitude': -33.92, 'longitude': 151.25, 'label': 'Coogee'}
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width in [320, 390, 844, 1440]:
        for driver in [True, False]:
            context = browser.new_context(viewport={'width': width, 'height': 600 if width == 844 else 900})
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda e: errors.append(str(e)))
            state = {'messages': [], 'unread': 0, 'stopped': False, 'fail': False, 'bodies': [], 'signedIn': True, 'completed': False}
            def respond(route):
                path = route.request.url.split('/api/')[-1].split('?')[0]
                if not state['signedIn']:
                    route.fulfill(status=401, json={'error': 'UNIVERSITY_VERIFICATION_REQUIRED'})
                    return
                req = {'requestId': 'req0', 'riderAlias': 'ride1234', 'status': 'PENDING', 'pickup': pin, 'destination': end, 'createdAt': '2026-10-20T00:00:00Z', 'requestedDepartureAt': '2026-10-20T00:00:00Z', 'directionFit': 'GOOD'}
                ride = {'rideId': 'test-ride', 'driverAlias': 'driv1234', 'status': 'COMPLETED' if state['completed'] else 'REQUESTED', 'priceAud': 5, 'scheduledDepartureAt': '2026-10-20T00:00:00Z', 'expiresAt': '2099-10-20T00:00:00Z', 'plannedRoute': {'origin': pin, 'destination': end}, 'paymentMethod': 'PAYID', 'pickupEstablished': False, 'conversations': [] if state['completed'] else [{'requestId': 'req0', 'peer': 'ride1234' if driver else 'driv1234', 'unread': state['unread'], 'stopped': state['stopped']}]}
                if driver: ride['requests'] = [req]
                else: ride['request'] = req
                item = {'role': 'DRIVER' if driver else 'RIDER', 'ride': ride}
                if state.get('accepted') and not state['completed']:
                    ride['status'] = 'ACCEPTED'
                    req['status'] = 'ACCEPTED'
                    ride['coRideCode'] = '1234'
                if '/conversations/' in path:
                    if path.endswith('/read'):
                        state['unread'] = 0
                        data = {'ok': True}
                    elif path.endswith('/stop'):
                        state['stopped'] = True
                        state['unread'] = 0
                        data = {'ok': True}
                    elif route.request.method == 'POST':
                        body = route.request.post_data_json
                        state['bodies'].append(body)
                        if state['fail']:
                            state['fail'] = False
                            route.fulfill(status=503, json={'error': 'UNAVAILABLE'})
                            return
                        state['messages'].append({'id': len(state['messages'])+1, 'mine': True, 'text': body['text'], 'createdAt': '2026-10-20T00:00:00Z'})
                        data = {'id': len(state['messages'])}
                    else: data = {'messages': state['messages'], 'stopped': state['stopped']}
                elif path == 'university/session': data = {'unikey': 'driv1234' if driver else 'ride1234', 'canAdmin': False}
                elif path == 'current': data = {'current': item, 'currents': [item]}
                elif path == 'route-preview': data = {'points': [pin, end], 'durationSeconds': 600}
                elif path.startswith('rides/test-ride'): data = {'ride': ride}
                else: data = {}
                route.fulfill(status=200, json=data)
            page.route('**/*', lambda r: r.continue_() if r.request.url.startswith('http://127.0.0.1:3090') else r.abort())
            page.route('**/api/**', respond)
            page.goto('http://127.0.0.1:3090/activity/test-ride')
            chat = page.locator('#messages-req0')
            expect(chat).not_to_have_attribute('open', '')
            if not driver:
                page.goto('http://127.0.0.1:3090/activity/test-ride?request=req0&compose=1')
                expect(chat).to_have_attribute('open', '')
                expect(chat.get_by_role('textbox', name='Message', exact=True)).to_have_value('Hi! Where should we meet, and what’s your car’s number plate?')
                assert 'compose=' not in page.url
                assert not state['bodies']
                page.screenshot(path=f'/tmp/messaging-compose-{width}.png', full_page=True)
                chat.get_by_role('textbox', name='Message', exact=True).fill('')
                page.evaluate("window.dispatchEvent(new Event('cocowheels:current-updated'))")
                expect(chat.get_by_role('textbox', name='Message', exact=True)).to_have_value('')
                chat.locator('summary').click()
            chat.locator('summary').click()
            textbox = chat.get_by_role('textbox', name='Message', exact=True)
            expect(textbox).to_be_visible()
            heights = chat.locator('.message-actions button').evaluate_all('(buttons)=>buttons.map(b=>b.getBoundingClientRect().height)')
            assert len(heights) == 1 and heights[0] >= 44, heights
            expect(chat.get_by_role('button', name='Stop messaging', exact=True)).to_have_count(0)
            expect(page.get_by_role('dialog', name='Stop messaging')).to_have_count(0)
            if not driver:
                chat.get_by_role('button', name='Hi! Where should we meet', exact=False).click()
                expect(textbox).to_have_value('Hi! Where should we meet, and what’s your car’s number plate?')
                assert not state['bodies']
            textbox.fill('<img src=x onerror=alert(1)> meeting point?')
            page.evaluate("window.dispatchEvent(new Event('cocowheels:current-updated'))")
            expect(textbox).to_have_value('<img src=x onerror=alert(1)> meeting point?')
            state['fail'] = True
            chat.get_by_role('button', name='Send message', exact=True).click()
            expect(page.get_by_role('button', name='OKAY', exact=True)).to_be_visible()
            page.get_by_role('button', name='OKAY', exact=True).click()
            expect(textbox).not_to_have_value('')
            chat.get_by_role('button', name='Send message', exact=True).click()
            expect(textbox).to_have_value('')
            expect(chat.locator('.message-list li')).to_have_count(1)
            assert state['bodies'][0]['clientId'] == state['bodies'][1]['clientId']
            assert chat.locator('.message-list img').count() == 0
            assert len(state['messages']) == 1
            expect(chat.get_by_role('link', name='Ride actions', exact=True)).to_have_count(0)
            page.locator('#ride-actions').scroll_into_view_if_needed()
            expect(page.locator('#ride-actions')).to_be_in_viewport()
            # Existing withdrawal/cancellation uses the established confirmation UI.
            action = page.locator('#ride-actions').get_by_role('button', name='CANCEL RIDE' if driver else 'WITHDRAW REQUEST', exact=True)
            expect(action).to_be_enabled()
            action.click()
            keep = page.get_by_role('button', name='KEEP IT', exact=True)
            expect(keep).to_be_focused()
            page.keyboard.press('Shift+Tab')
            expect(page.get_by_role('dialog').get_by_role('button').last).to_be_focused()
            page.keyboard.press('Escape')
            expect(keep).to_have_count(0)
            expect(action).to_be_focused()
            chat.locator('summary').scroll_into_view_if_needed()
            expect(textbox).to_be_enabled()
            expect(chat.get_by_role('link', name='Report a concern via WhatsApp')).to_have_count(0)
            expect(page.get_by_role('link', name='Report a concern via WhatsApp')).to_have_count(1)
            support_icon = page.locator('.ride-report-icon')
            expect(support_icon).to_have_attribute('aria-hidden', 'true')
            expect(support_icon).to_have_attribute('focusable', 'false')
            assert support_icon.bounding_box()['width'] == 14
            assert support_icon.bounding_box()['height'] == 14
            assert page.get_by_role('link', name='Report a concern via WhatsApp').get_attribute('href').startswith('https://wa.me/61452340432?text=')
            page.screenshot(path=f'/tmp/messaging-{width}-{driver}.png', full_page=True)
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            # Unread metadata updates the existing single Profile card and links to chat.
            chat.locator('summary').click()
            state['messages'].append({'id': 2, 'mine': False, 'text': 'Meet outside the station.', 'createdAt': '2026-10-20T00:01:00Z'})
            state['unread'] = 1
            page.goto('http://127.0.0.1:3090/help')
            page.get_by_role('button', name='Profile:', exact=False).click()
            expect(page.locator('.profile-active-ride')).to_have_count(1)
            expect(page.locator('.profile-active-ride')).to_contain_text('1 unread message')
            expect(page.locator('#guest-identity-popover')).to_contain_text('University email verified')
            expect(page.locator('#guest-identity-popover')).to_have_css('opacity', '1')
            page.screenshot(path=f'/tmp/messaging-profile-{width}-{driver}.png')
            page.locator('.profile-active-ride').click()
            expect(chat).to_have_attribute('open', '')
            expect(chat.locator('.message-list li')).to_have_count(2)
            chat.locator('.message-list li').last.scroll_into_view_if_needed()
            page.wait_for_function("document.querySelector('.profile-active-ride')?.textContent?.includes('unread message') === false")
            chat.locator('summary').click()
            state['unread'] = 1
            page.evaluate("window.dispatchEvent(new Event('cocowheels:messages-updated'))")
            page.get_by_role('button', name='Profile:', exact=False).click()
            expect(page.locator('.profile-active-ride')).to_contain_text('1 unread message')
            page.locator('.profile-active-ride').click()
            expect(chat).to_have_attribute('open', '')
            state['messages'].append({'id': 3, 'mine': False, 'text': 'x'*1000, 'createdAt': '2026-10-20T00:02:00Z'})
            state['unread'] = 1
            page.evaluate("window.dispatchEvent(new Event('cocowheels:current-updated'))")
            # A current-update during an in-flight load is intentionally coalesced;
            # allow the normal 10-second poll to deliver the next snapshot.
            expect(chat.locator('.message-list li')).to_have_count(3, timeout=15000)
            with page.expect_response(lambda response: '/conversations/req0/read' in response.url):
                chat.locator('.message-read-marker').scroll_into_view_if_needed()
            assert state['unread'] == 0
            # Previously stopped conversations remain stopped, without any new stop UI.
            state['stopped'] = True
            page.evaluate("window.dispatchEvent(new Event('cocowheels:ride-updated'))")
            expect(chat).to_contain_text('Messaging has been stopped. Your ride is unchanged.')
            expect(chat.get_by_role('textbox')).to_have_count(0)
            assert state['stopped']
            state['accepted'] = True
            page.evaluate("window.dispatchEvent(new Event('cocowheels:ride-updated'))")
            expect(page.locator('.ride-status-text').filter(has_text='Awaiting pickup')).to_be_visible()
            expect(chat).to_have_attribute('open', '')
            expect(chat).to_contain_text('Messaging has been stopped. Your ride is unchanged.')
            page.screenshot(path=f'/tmp/messaging-accepted-{width}-{driver}.png', full_page=True)
            state['completed'] = True
            page.evaluate("window.dispatchEvent(new Event('cocowheels:ride-updated'))")
            expect(chat).to_have_count(0)
            # A fresh account/session event clears any already-rendered private text.
            state['signedIn'] = False
            page.evaluate("window.dispatchEvent(new Event('cocowheels:identity-changed'))")
            expect(page.get_by_text('Meet outside the station.', exact=True)).to_have_count(0)
            assert not errors, errors
            print(f'PASS messaging {width}px {"driver" if driver else "rider"}')
            context.close()
    browser.close()
